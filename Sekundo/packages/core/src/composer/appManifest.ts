/**
 * Sekundo — App Composer Manifest & Daily Logistics Cockpit (`composer/appManifest.ts`)
 *
 * Implements Phase F5 (§1.6 & §3.4):
 * - Schema and parser for `sekundo.app.yaml` ("O aplicativo que o usuário monta").
 * - Enforces human-in-the-loop governance (`confirmar: true` by default on all `rituais`).
 * - Computes the cross-board daily logistics digest for the `/hoje` screen
 *   (`compromissos_do_dia`, `mensagens_a_enviar`, `documentos_a_imprimir`, `territorios_vencendo`).
 */

import { parse, stringify } from 'yaml';
import type { FlatRegistry } from '../skeleton/types';
import { computeTerritoryRecencyList } from '../engines/territoryEngine';

export interface ComposerOutputSpec {
  kind: 'pdf' | 'whatsapp' | 'csv' | 'yaml';
  template?: string;
  format?: 'canonical' | 'clean_human' | 'tree' | 'flat';
}

export interface ComposerPrancheta {
  id: string;
  nome?: string;
  engine: string;
  leis?: string[];
  lentes?: string[];
  saidas: ComposerOutputSpec[];
}

export interface ComposerRitual {
  id?: string;
  quando: string;
  fazer: string;
  /** Human-in-the-loop governance: always defaults to `true` so nothing executes without consent. */
  confirmar: boolean;
}

export type HojeWidgetId =
  | 'compromissos_do_dia'
  | 'mensagens_a_enviar'
  | 'documentos_a_imprimir'
  | 'territorios_vencendo';

export interface SekundoAppManifest {
  app: string;
  pranchetas: ComposerPrancheta[];
  hoje: {
    mostrar: HojeWidgetId[];
  };
  rituais: ComposerRitual[];
}

export const DEFAULT_SEKUNDO_APP_YAML = `# sekundo.app.yaml — O Aplicativo Montado pelo Usuário
app: Unidade Operacional Demo — Sekundo
pranchetas:
  - id: reuniao
    nome: Programação da Reunião & Designações
    engine: transformer
    leis: [roster_conflicts, run_of_show_timing]
    lentes: [meu_compromisso, por_grupo, cronometro]
    saidas:
      - { kind: whatsapp, template: quadro_semanal }
      - { kind: pdf,      template: s89-4up.sdoc.yaml }
      - { kind: csv,      format: clean_human }
      - { kind: yaml,     format: tree }
  - id: territorios
    nome: Logística de Territórios S-13-S & S-12
    engine: territory_logistics
    lentes: [mapa, checklist, recencia]
    saidas:
      - { kind: pdf,      template: s13s-multiciclo.sdoc.yaml }
      - { kind: whatsapp, template: territorios }
      - { kind: yaml,     format: tree }
hoje:
  mostrar:
    - compromissos_do_dia
    - mensagens_a_enviar
    - documentos_a_imprimir
    - territorios_vencendo
rituais:
  - { quando: "domingo 18:00", fazer: "whatsapp:quadro_semanal", confirmar: true }
  - { quando: "rollover",      fazer: "pdf:s13s-multiciclo",     confirmar: true }
`;

export function parseAppManifestYaml(yamlText: string): SekundoAppManifest {
  const raw = parse(yamlText || DEFAULT_SEKUNDO_APP_YAML, {
    maxAliasCount: 100,
    schema: 'core',
  }) as Record<string, any>;

  if (!raw || typeof raw !== 'object') {
    return parseAppManifestYaml(DEFAULT_SEKUNDO_APP_YAML);
  }

  const pranchetas: ComposerPrancheta[] = Array.isArray(raw.pranchetas)
    ? raw.pranchetas.map((p: any, idx: number) => ({
        id: String(p.id || `prancheta_${idx + 1}`),
        nome: p.nome ? String(p.nome) : String(p.id || `Prancheta ${idx + 1}`),
        engine: String(p.engine || 'transformer'),
        leis: Array.isArray(p.leis) ? p.leis.map(String) : [],
        lentes: Array.isArray(p.lentes) ? p.lentes.map(String) : [],
        saidas: Array.isArray(p.saidas)
          ? p.saidas.map((s: any) => ({
              kind: (['pdf', 'whatsapp', 'csv', 'yaml'].includes(s.kind) ? s.kind : 'pdf') as ComposerOutputSpec['kind'],
              template: s.template ? String(s.template) : undefined,
              format: s.format,
            }))
          : [{ kind: 'pdf' }, { kind: 'whatsapp' }, { kind: 'csv' }, { kind: 'yaml' }],
      }))
    : [];

  const rituais: ComposerRitual[] = Array.isArray(raw.rituais)
    ? raw.rituais.map((r: any, idx: number) => ({
        id: String(r.id || `ritual_${idx + 1}`),
        quando: String(r.quando || 'manual'),
        fazer: String(r.fazer || 'whatsapp:quadro_semanal'),
        // Governance by Design: defaults to true even if omitted
        confirmar: r.confirmar !== false,
      }))
    : [];

  const validWidgets = new Set<HojeWidgetId>([
    'compromissos_do_dia',
    'mensagens_a_enviar',
    'documentos_a_imprimir',
    'territorios_vencendo',
  ]);
  const mostrar: HojeWidgetId[] = Array.isArray(raw.hoje?.mostrar)
    ? raw.hoje.mostrar.filter((w: any): w is HojeWidgetId => validWidgets.has(w))
    : [
        'compromissos_do_dia',
        'mensagens_a_enviar',
        'documentos_a_imprimir',
        'territorios_vencendo',
      ];

  return {
    app: String(raw.app || 'Meu Aplicativo Sekundo'),
    pranchetas,
    hoje: { mostrar },
    rituais,
  };
}

export function stringifyAppManifestYaml(manifest: SekundoAppManifest): string {
  return stringify(manifest, { indent: 2, lineWidth: 120 });
}

export interface HojeCockpitSummary {
  compromissosDoDia: {
    key: string;
    partTitle: string;
    assignee: string;
    assistant?: string;
    date: string;
    room: string;
  }[];
  mensagensAEnviar: {
    recipient: string;
    summary: string;
    channel: 'whatsapp';
  }[];
  documentosAImprimir: {
    pranchetaId: string;
    pranchetaNome: string;
    template: string;
    kind: 'pdf' | 'yaml' | 'csv';
  }[];
  territoriosVencendo: {
    territoryNumber: string;
    label: string;
    daysSinceCompleted: number;
    percent: number;
  }[];
}

export function computeHojeCockpitSummary(
  manifest: SekundoAppManifest,
  registry: FlatRegistry
): HojeCockpitSummary {
  const filledSlots = registry
    .filter((e) => e.type === 'slot' && e.value && e.value.trim() !== '')
    .slice(0, 12);

  const compromissosDoDia = filledSlots.map((s) => ({
    key: s.key,
    partTitle: s.label,
    assignee: s.value,
    assistant: (s.meta?.assistantTo as string) || undefined,
    date: (s.meta?.date as string) || 'Esta Semana',
    room: (s.meta?.room as string) || 'Salão Principal',
  }));

  const mensagensAEnviar = filledSlots.slice(0, 6).map((s) => ({
    recipient: s.value,
    summary: `Lembrete: ${s.label} (${(s.meta?.room as string) || 'Salão Principal'})`,
    channel: 'whatsapp' as const,
  }));

  const documentosAImprimir: HojeCockpitSummary['documentosAImprimir'] = [];
  for (const p of manifest.pranchetas) {
    for (const out of p.saidas) {
      if (out.kind === 'pdf' || out.kind === 'yaml' || out.kind === 'csv') {
        documentosAImprimir.push({
          pranchetaId: p.id,
          pranchetaNome: p.nome || p.id,
          template: out.template || `${p.id}.${out.kind}`,
          kind: out.kind,
        });
      }
    }
  }

  const territoryEntries = registry.filter(
    (e) => e.type === 'territory' || Boolean(e.meta?.territoryNumber)
  );
  const recency = computeTerritoryRecencyList(
    territoryEntries.length > 0 ? territoryEntries : registry,
    'hierarchical'
  );
  const territoriosVencendo = recency.slice(0, 6).map((t) => ({
    territoryNumber: t.territoryNumber,
    label: t.label,
    daysSinceCompleted: t.daysSinceCompleted ?? 0,
    percent: t.percent,
  }));

  return {
    compromissosDoDia,
    mensagensAEnviar,
    documentosAImprimir,
    territoriosVencendo,
  };
}
