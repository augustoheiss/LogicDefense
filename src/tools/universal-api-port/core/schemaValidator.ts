/**
 * Schema Validator — Structural validation with user-friendly messages.
 *
 * Validates an OpenAPI document after parsing and produces a list
 * of categorized diagnostics (error / warning / info) that the UI
 * can render as an actionable checklist.
 *
 * Design: pure function, no side-effects, no throws.
 */

import type {
  OpenApiDocument,
  HttpMethod,
  OperationObject,
} from '../types/openapi';

/* ── Diagnostic types ────────────────────────────────────────── */

export type DiagnosticSeverity = 'error' | 'warning' | 'info';

export interface Diagnostic {
  severity: DiagnosticSeverity;
  path: string;       // JSON-pointer-like location (e.g. "paths./alunos.get")
  message: string;    // User-friendly message in PT-BR
  hint?: string;      // Actionable suggestion
}

export interface ValidationResult {
  valid: boolean;             // false if any error-level diagnostic exists
  diagnostics: Diagnostic[];
  summary: {
    errors: number;
    warnings: number;
    infos: number;
  };
}

/* ── Helpers ─────────────────────────────────────────────────── */

const HTTP_METHODS: HttpMethod[] = ['get', 'post', 'put', 'patch', 'delete'];

function push(
  diagnostics: Diagnostic[],
  severity: DiagnosticSeverity,
  path: string,
  message: string,
  hint?: string
) {
  diagnostics.push({ severity, path, message, hint });
}

/* ── Validators ──────────────────────────────────────────────── */

function validateRoot(doc: OpenApiDocument, diags: Diagnostic[]) {
  // openapi version
  if (!doc.openapi) {
    push(diags, 'error', 'openapi', 'Campo "openapi" ausente.', 'Adicione ex: "openapi": "3.0.3"');
  } else if (!/^3\.\d+\.\d+$/.test(doc.openapi)) {
    push(diags, 'warning', 'openapi', `Versão "${doc.openapi}" pode não ser suportada.`, 'Use 3.0.x ou 3.1.x para compatibilidade máxima.');
  }

  // info block
  if (!doc.info) {
    push(diags, 'error', 'info', 'Bloco "info" ausente.', 'Adicione { "title": "...", "version": "..." }');
  } else {
    if (!doc.info.title) {
      push(diags, 'error', 'info.title', 'Título da API ausente.', 'Adicione um "title" dentro de "info".');
    }
    if (!doc.info.version) {
      push(diags, 'warning', 'info.version', 'Versão da API não informada.', 'Adicione um "version" dentro de "info".');
    }
    if (!doc.info.description) {
      push(diags, 'info', 'info.description', 'Descrição da API não fornecida.', 'Uma descrição ajuda operadores a entender o propósito da API.');
    }
  }

  // paths
  if (!doc.paths) {
    push(diags, 'error', 'paths', 'Bloco "paths" ausente — nenhum endpoint encontrado.', 'Adicione ao menos um caminho em "paths".');
  } else if (Object.keys(doc.paths).length === 0) {
    push(diags, 'warning', 'paths', 'Bloco "paths" está vazio — nenhum endpoint para renderizar.');
  }

  // servers
  if (!doc.servers || doc.servers.length === 0) {
    push(diags, 'warning', 'servers', 'Nenhum servidor definido.', 'Sem "servers", você precisará informar a Base URL manualmente.');
  } else {
    doc.servers.forEach((srv, i) => {
      if (!srv.url) {
        push(diags, 'error', `servers[${i}].url`, `Servidor #${i + 1} sem URL.`);
      } else if (!srv.url.startsWith('http')) {
        push(diags, 'info', `servers[${i}].url`, `URL "${srv.url}" é relativa.`, 'URLs relativas são válidas mas podem causar confusão na hora de executar.');
      }
    });
  }
}

function validatePaths(doc: OpenApiDocument, diags: Diagnostic[]) {
  if (!doc.paths) return;

  for (const [pathStr, pathItem] of Object.entries(doc.paths)) {
    // Path format
    if (!pathStr.startsWith('/')) {
      push(diags, 'error', `paths.${pathStr}`, `Caminho "${pathStr}" não começa com "/".`, 'Todos os paths devem iniciar com barra.');
    }

    // Check for path-level parameters with {param} in the path
    const pathParamNames = [...pathStr.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);

    let hasAnyMethod = false;

    for (const method of HTTP_METHODS) {
      const operation = pathItem[method] as OperationObject | undefined;
      if (!operation) continue;
      hasAnyMethod = true;

      const loc = `paths.${pathStr}.${method}`;

      // responses required
      if (!operation.responses || Object.keys(operation.responses).length === 0) {
        push(diags, 'warning', loc, `${method.toUpperCase()} ${pathStr} — sem respostas definidas.`, 'Adicione ao menos uma resposta (ex: "200").');
      }

      // summary recommended
      if (!operation.summary && !operation.description) {
        push(diags, 'info', loc, `${method.toUpperCase()} ${pathStr} — sem resumo ou descrição.`, 'Adicionar summary ajuda operadores a entender o endpoint.');
      }

      // Validate path params are declared in parameters
      if (pathParamNames.length > 0) {
        const declaredParams = [
          ...(pathItem.parameters ?? []),
          ...(operation.parameters ?? []),
        ]
          .filter((p) => p.in === 'path')
          .map((p) => p.name);

        for (const expected of pathParamNames) {
          if (!declaredParams.includes(expected)) {
            push(
              diags,
              'warning',
              `${loc}.parameters`,
              `Parâmetro de caminho "{${expected}}" não declarado nos parâmetros.`,
              `Adicione { "name": "${expected}", "in": "path", "required": true, "schema": { "type": "string" } }.`
            );
          }
        }
      }

      // POST/PUT/PATCH without requestBody
      if (['post', 'put', 'patch'].includes(method) && !operation.requestBody) {
        push(diags, 'info', loc, `${method.toUpperCase()} ${pathStr} — sem corpo de requisição definido.`, 'Considere adicionar um "requestBody" com o schema esperado.');
      }

      // deprecated flag
      if (operation.deprecated) {
        push(diags, 'info', loc, `${method.toUpperCase()} ${pathStr} — marcado como DEPRECATED.`);
      }
    }

    if (!hasAnyMethod) {
      push(diags, 'warning', `paths.${pathStr}`, `Caminho "${pathStr}" não tem nenhum método HTTP definido.`);
    }
  }
}

function validateRefs(doc: OpenApiDocument, diags: Diagnostic[]) {
  if (!doc.components?.schemas) return;

  // Collect all $ref strings used in the document
  const refs = new Set<string>();
  const collectRefs = (obj: unknown, path: string) => {
    if (!obj || typeof obj !== 'object') return;
    const record = obj as Record<string, unknown>;
    if (typeof record['$ref'] === 'string') {
      refs.add(`${path}→${record['$ref']}`);
    }
    for (const [key, val] of Object.entries(record)) {
      if (key === '$ref') continue;
      collectRefs(val, `${path}.${key}`);
    }
  };
  collectRefs(doc.paths, 'paths');

  // Verify each $ref resolves
  for (const entry of refs) {
    const [path, ref] = entry.split('→');
    if (!ref.startsWith('#/')) {
      push(diags, 'warning', path, `Referência externa "${ref}" não é suportada.`, 'Apenas referências locais (#/...) são resolvidas pelo cliente.');
      continue;
    }

    const segments = ref.replace('#/', '').split('/');
    let current: unknown = doc;
    let resolved = true;
    for (const seg of segments) {
      if (!current || typeof current !== 'object') { resolved = false; break; }
      current = (current as Record<string, unknown>)[seg];
    }

    if (!resolved || current === undefined) {
      push(diags, 'error', path, `Referência "${ref}" não encontrada no documento.`, 'Verifique se o schema referenciado existe em "components.schemas".');
    }
  }
}

function validateSecurity(doc: OpenApiDocument, diags: Diagnostic[]) {
  if (doc.security && doc.security.length > 0 && !doc.components?.securitySchemes) {
    push(
      diags,
      'warning',
      'security',
      'Schema usa "security" global mas não define "components.securitySchemes".',
      'Adicione os esquemas de autenticação referenciados.'
    );
  }
}

/* ── Main export ─────────────────────────────────────────────── */

/**
 * Validates an OpenAPI document and returns structured diagnostics.
 * Always returns a result — never throws.
 */
export function validateSchema(doc: OpenApiDocument): ValidationResult {
  const diagnostics: Diagnostic[] = [];

  validateRoot(doc, diagnostics);
  validatePaths(doc, diagnostics);
  validateRefs(doc, diagnostics);
  validateSecurity(doc, diagnostics);

  const errors = diagnostics.filter((d) => d.severity === 'error').length;
  const warnings = diagnostics.filter((d) => d.severity === 'warning').length;
  const infos = diagnostics.filter((d) => d.severity === 'info').length;

  return {
    valid: errors === 0,
    diagnostics,
    summary: { errors, warnings, infos },
  };
}
