/**
 * Sekundo — Lossless Data YAML Serializer & Parser (`*.data.yaml`)
 *
 * Implements Phase F1 of the Document Studio Master Plan:
 * - Writes `FlatRegistry` as a human-readable hierarchical YAML tree (`format: 'tree'`, default)
 *   or flat array (`format: 'flat'`).
 * - Reads both hierarchical (`tree` with `children` or nested maps) and flat (`_key`/`key`)
 *   YAML structures back into a canonical `FlatRegistry` with 100% lossless fidelity.
 * - Enforces YAML security limits (`maxAliasCount: 100`, `schema: 'core'`) against Billion Laughs.
 */

import { parse, stringify } from 'yaml';
import type { FlatRegistry, FlatSkeletonEntry, NodeType } from '../skeleton/types';
import * as pathKey from '../skeleton/pathKey';
import { filterGranularEntries, type GranularExportOptions } from '../csv/granularExport';

export interface DataYamlExportOptions extends GranularExportOptions {
  /**
   * Output structure:
   * - 'tree' (default, recommended): hierarchical tree with `children`
   * - 'flat': flat list mirroring CSV rows
   */
  yamlFormat?: 'tree' | 'flat';
  /** Optional event or document title header */
  eventName?: string;
}

export interface YamlTreeNode {
  key: string;
  type: NodeType;
  label: string;
  value?: string;
  email?: string;
  meta?: Record<string, unknown>;
  children?: YamlTreeNode[];
}

const VALID_NODE_TYPES = new Set<NodeType>(['slot', 'territory', 'header', 'note']);

function normalizeNodeType(raw: unknown): NodeType {
  const s = String(raw || 'slot').toLowerCase().trim() as NodeType;
  return VALID_NODE_TYPES.has(s) ? s : 'slot';
}

/**
 * Builds an ordered hierarchical array of `YamlTreeNode` from a flat registry,
 * preserving exact `key` strings (e.g., `'01'`, `'001'`) and all fields.
 */
export function buildYamlTreeFromRegistry(entries: FlatSkeletonEntry[]): YamlTreeNode[] {
  const nodeMap = new Map<string, YamlTreeNode>();
  const normToExactKey = new Map<string, string>();
  const roots: YamlTreeNode[] = [];

  // First pass: create YamlTreeNode for every entry
  for (const entry of entries) {
    const node: YamlTreeNode = {
      key: entry.key,
      type: entry.type,
      label: entry.label,
    };
    if (entry.value !== undefined && entry.value !== '') {
      node.value = entry.value;
    }
    if (entry.email !== undefined && entry.email !== '') {
      node.email = entry.email;
    }
    if (entry.meta && Object.keys(entry.meta).length > 0) {
      node.meta = entry.meta;
    }
    nodeMap.set(entry.key, node);
    normToExactKey.set(pathKey.normalize(entry.key), entry.key);
  }

  // Second pass: wire children to their closest existing ancestor in the slice
  for (const entry of entries) {
    const node = nodeMap.get(entry.key)!;
    let parentKeyCand = pathKey.parent(entry.key);
    let attached = false;

    while (parentKeyCand !== null) {
      const exactParentKey =
        nodeMap.has(parentKeyCand)
          ? parentKeyCand
          : normToExactKey.get(pathKey.normalize(parentKeyCand));

      if (exactParentKey && exactParentKey !== entry.key) {
        const parentNode = nodeMap.get(exactParentKey)!;
        if (!parentNode.children) {
          parentNode.children = [];
        }
        parentNode.children.push(node);
        attached = true;
        break;
      }
      parentKeyCand = pathKey.parent(parentKeyCand);
    }

    if (!attached) {
      roots.push(node);
    }
  }

  return roots;
}

/**
 * Serializes a `FlatRegistry` into a YAML string (`*.data.yaml`).
 * Defaults to hierarchical `'tree'` layout while supporting `'flat'` mode and granular slicing.
 */
export function registryToYaml(
  registry: FlatRegistry,
  options: DataYamlExportOptions = {}
): string {
  const filtered = filterGranularEntries(registry, options);
  const yamlFormat = options.yamlFormat || 'tree';

  if (yamlFormat === 'flat') {
    const payload = {
      sekundo_data: 1,
      format: 'flat',
      ...(options.eventName ? { event: options.eventName } : {}),
      entries: filtered.map((e) => ({
        _key: e.key,
        _type: e.type,
        label: e.label,
        ...(e.value ? { value: e.value } : {}),
        ...(e.email ? { email: e.email } : {}),
        ...(e.meta && Object.keys(e.meta).length > 0 ? { meta: e.meta } : {}),
      })),
    };
    return stringify(payload, { indent: 2, lineWidth: 120 });
  }

  const treeNodes = buildYamlTreeFromRegistry(filtered);
  const payload = {
    sekundo_data: 1,
    format: 'tree',
    ...(options.eventName ? { event: options.eventName } : {}),
    nodes: treeNodes,
  };

  return stringify(payload, { indent: 2, lineWidth: 120 });
}

function coerceEntryFromObject(raw: Record<string, any>, fallbackKey?: string): FlatSkeletonEntry | null {
  const rawKey = raw.key ?? raw._key ?? fallbackKey;
  if (rawKey === undefined || rawKey === null || String(rawKey).trim() === '') {
    return null;
  }

  let meta: Record<string, unknown> = {};
  if (raw.meta && typeof raw.meta === 'object' && !Array.isArray(raw.meta)) {
    meta = { ...raw.meta };
  } else if (typeof raw._meta_json === 'string' && raw._meta_json.trim() !== '') {
    try {
      meta = JSON.parse(raw._meta_json);
    } catch {
      meta = {};
    }
  }

  return {
    key: String(rawKey).trim(),
    type: normalizeNodeType(raw.type ?? raw._type),
    label: String(raw.label ?? raw.nome ?? raw.titulo ?? ''),
    value: raw.value !== undefined && raw.value !== null ? String(raw.value) : '',
    email: raw.email !== undefined && raw.email !== null ? String(raw.email) : '',
    meta,
  };
}

function walkNodeList(list: unknown[], out: FlatSkeletonEntry[]): void {
  for (const item of list) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const obj = item as Record<string, any>;
    const entry = coerceEntryFromObject(obj);
    if (entry) {
      out.push(entry);
    }
    if (Array.isArray(obj.children)) {
      walkNodeList(obj.children, out);
    } else if (obj.children && typeof obj.children === 'object') {
      walkKeyedMap(obj.children as Record<string, any>, out);
    }
  }
}

function walkKeyedMap(mapObj: Record<string, any>, out: FlatSkeletonEntry[]): void {
  for (const [k, v] of Object.entries(mapObj)) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) continue;
    const entry = coerceEntryFromObject(v, k);
    if (entry) {
      out.push(entry);
    }
    if (Array.isArray(v.children)) {
      walkNodeList(v.children, out);
    } else if (v.children && typeof v.children === 'object') {
      walkKeyedMap(v.children, out);
    }
  }
}

/**
 * Parses a YAML string (`*.data.yaml`) into a `FlatRegistry`.
 * Accepts both hierarchical tree format (`nodes: [...]` or nested maps)
 * and flat format (`entries: [...]` or root array of `{ _key, ... }`).
 */
export function yamlToRegistry(yamlText: string): FlatRegistry {
  if (!yamlText || typeof yamlText !== 'string' || yamlText.trim() === '') {
    return [];
  }

  const parsed = parse(yamlText, {
    maxAliasCount: 100,
    schema: 'core',
  });

  if (!parsed || typeof parsed !== 'object') {
    return [];
  }

  const out: FlatSkeletonEntry[] = [];

  if (Array.isArray(parsed)) {
    walkNodeList(parsed, out);
    return out;
  }

  const root = parsed as Record<string, any>;
  if (Array.isArray(root.nodes)) {
    walkNodeList(root.nodes, out);
  } else if (Array.isArray(root.entries)) {
    walkNodeList(root.entries, out);
  } else if (root.nodes && typeof root.nodes === 'object') {
    walkKeyedMap(root.nodes, out);
  } else {
    walkKeyedMap(root, out);
  }

  return out;
}
