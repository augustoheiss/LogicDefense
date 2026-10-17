/**
 * Sekundo — Clean-Room Privilege Matrix & Fair-Rotation Auto-Assignment Engine
 *
 * Implements:
 * 1. 26 Domain-Agnostic Operational Capability Flags (`CapabilityKey`) grouped into
 *    5 color-coded operational domains.
 * 2. 5 Multi-Facet Filter Dimensions (`profileCategory`, `roleTier`, `statusFlags`,
 *    `operationalGroup`, `recencyFlag`) for CAD-style matrix filtering.
 * 3. 24 Synthetic Clean-Room Participant Profiles (`DEFAULT_PRIVILEGE_MATRIX_PARTICIPANTS`)
 *    with zero real PII and zero religious/institutional terminology.
 * 4. Deterministic Constraint-Satisfaction & FIFO Fair-Rotation Auto-Scheduler
 *    (`autoAssignScheduleRegistry` and `autoAssignEventSlots`):
 *    - Enforces strict capability eligibility per slot type
 *    - Enforces ZERO same-day / same-session collisions (across Chair, Opening,
 *      Closing, Primary Assignee, and Assistant/Reader)
 *    - Prioritizes Most-Constrained Slots First so rare specialists are not
 *      consumed on generic slots
 *    - Scores candidates by FIFO (oldest `lastAssignedIsoDate`), lowest total
 *      `assignmentCount`, and group alternation
 *    - Pairs Titular + Assistant within the same `profileCategory` by default
 *      (with optional mixed-category toggle) while avoiding repeat pairings.
 *
 * Skills: agency-clean-room-data-hygiene-engineer, agency-software-architect
 */

import type { FlatSkeletonEntry } from '../skeleton/types';
import {
  type ParticipantProfile,
  type ParticipantCategory,
  type ParticipantRoleTier,
  type ParticipantStatusFlag,
  normalizePersonKey,
} from './participantDirectory';

export type CapabilityDomainId =
  | 'coordenacao_abertura'
  | 'bloco_analitico'
  | 'bloco_praticas_duplas'
  | 'bloco_operacional_sintese'
  | 'logistica_plenaria_campo'
  | 'custom_csv';

export type CapabilityKey =
  // Domain 1: Coordenação & Abertura (2)
  | 'cap_abertura_fechamento'
  | 'cap_presidencia_sessao'
  // Domain 2: Bloco Analítico / Fundamentos (3)
  | 'cap_tema_central'
  | 'cap_analise_aprofundada'
  | 'cap_leitura_tecnica'
  // Domain 3: Bloco de Práticas & Duplas (5)
  | 'cap_pratica_1_titular'
  | 'cap_pratica_2_titular'
  | 'cap_pratica_3_titular'
  | 'cap_pratica_4_discurso'
  | 'cap_pratica_ajudante'
  // Domain 4: Bloco Operacional & Síntese (4)
  | 'cap_modulo_operacional_1'
  | 'cap_modulo_operacional_2'
  | 'cap_estudo_dirigido_condutor'
  | 'cap_estudo_dirigido_leitor'
  // Domain 5: Logística, Áudio/Vídeo, Plenária & Campo (12)
  | 'cap_recepcao_portaria'
  | 'cap_auditorio_indicador'
  | 'cap_transmissao_remota'
  | 'cap_palco_plataforma'
  | 'cap_microfone_volante'
  | 'cap_mesa_som_midia'
  | 'cap_plenaria_orador'
  | 'cap_plenaria_presidente'
  | 'cap_plenaria_condutor'
  | 'cap_plenaria_leitor'
  | 'cap_lider_equipe_campo'
  | 'cap_manutencao_instalacoes'
  // Domain 6: Dynamic CSV / Custom Privileges
  | (string & {});

export interface CapabilityColumnMeta {
  key: CapabilityKey;
  shortLabel: string;
  fullLabel: string;
  domainId: CapabilityDomainId;
  domainLabel: string;
  accentColor: string;
  isCustom?: boolean;
}

export const CAPABILITY_COLUMNS: CapabilityColumnMeta[] = [
  // 1. Coordenação & Abertura (Azul Técnico)
  {
    key: 'cap_abertura_fechamento',
    shortLabel: 'Abertura/Fech.',
    fullLabel: 'Abertura e Encerramento de Sessão',
    domainId: 'coordenacao_abertura',
    domainLabel: 'Coordenação & Abertura',
    accentColor: '#2563EB',
  },
  {
    key: 'cap_presidencia_sessao',
    shortLabel: 'Presidência',
    fullLabel: 'Presidência / Coordenação Geral de Sessão',
    domainId: 'coordenacao_abertura',
    domainLabel: 'Coordenação & Abertura',
    accentColor: '#2563EB',
  },

  // 2. Bloco Analítico / Fundamentos (Teal)
  {
    key: 'cap_tema_central',
    shortLabel: 'Tema Central',
    fullLabel: 'Bloco 1: Diretrizes e Tema Central (10m)',
    domainId: 'bloco_analitico',
    domainLabel: 'Bloco 1 — Analítico',
    accentColor: '#0D9488',
  },
  {
    key: 'cap_analise_aprofundada',
    shortLabel: 'Análise Técn.',
    fullLabel: 'Bloco 1: Análise de Indicadores e Metas (10m)',
    domainId: 'bloco_analitico',
    domainLabel: 'Bloco 1 — Analítico',
    accentColor: '#0D9488',
  },
  {
    key: 'cap_leitura_tecnica',
    shortLabel: 'Leitura (4m)',
    fullLabel: 'Bloco 1: Leitura Técnica de Referência (4m)',
    domainId: 'bloco_analitico',
    domainLabel: 'Bloco 1 — Analítico',
    accentColor: '#0D9488',
  },

  // 3. Bloco de Práticas & Duplas (Âmbar)
  {
    key: 'cap_pratica_1_titular',
    shortLabel: 'Prática 1 (Tit.)',
    fullLabel: 'Bloco 2: Simulação Inicial — Titular',
    domainId: 'bloco_praticas_duplas',
    domainLabel: 'Bloco 2 — Práticas & Duplas',
    accentColor: '#D97706',
  },
  {
    key: 'cap_pratica_2_titular',
    shortLabel: 'Prática 2 (Tit.)',
    fullLabel: 'Bloco 2: Acompanhamento Operacional — Titular',
    domainId: 'bloco_praticas_duplas',
    domainLabel: 'Bloco 2 — Práticas & Duplas',
    accentColor: '#D97706',
  },
  {
    key: 'cap_pratica_3_titular',
    shortLabel: 'Prática 3 (Tit.)',
    fullLabel: 'Bloco 2: Resolução de Cenários — Titular',
    domainId: 'bloco_praticas_duplas',
    domainLabel: 'Bloco 2 — Práticas & Duplas',
    accentColor: '#D97706',
  },
  {
    key: 'cap_pratica_4_discurso',
    shortLabel: 'Caso Prático',
    fullLabel: 'Bloco 2: Apresentação de Caso Prático Individual',
    domainId: 'bloco_praticas_duplas',
    domainLabel: 'Bloco 2 — Práticas & Duplas',
    accentColor: '#D97706',
  },
  {
    key: 'cap_pratica_ajudante',
    shortLabel: 'Ajudante/Parc.',
    fullLabel: 'Bloco 2: Parceiro / Ajudante em Simulações em Dupla',
    domainId: 'bloco_praticas_duplas',
    domainLabel: 'Bloco 2 — Práticas & Duplas',
    accentColor: '#D97706',
  },

  // 4. Bloco Operacional & Síntese (Bordô / Vermelho Técnico)
  {
    key: 'cap_modulo_operacional_1',
    shortLabel: 'Pauta Oper. 1',
    fullLabel: 'Bloco 3: Pauta de Aplicação Operacional 1 (15m)',
    domainId: 'bloco_operacional_sintese',
    domainLabel: 'Bloco 3 — Aplicação & Síntese',
    accentColor: '#BE123C',
  },
  {
    key: 'cap_modulo_operacional_2',
    shortLabel: 'Pauta Oper. 2',
    fullLabel: 'Bloco 3: Pauta de Aplicação Operacional 2',
    domainId: 'bloco_operacional_sintese',
    domainLabel: 'Bloco 3 — Aplicação & Síntese',
    accentColor: '#BE123C',
  },
  {
    key: 'cap_estudo_dirigido_condutor',
    shortLabel: 'Cond. Síntese',
    fullLabel: 'Bloco 3: Condutor de Revisão em Equipe (30m)',
    domainId: 'bloco_operacional_sintese',
    domainLabel: 'Bloco 3 — Aplicação & Síntese',
    accentColor: '#BE123C',
  },
  {
    key: 'cap_estudo_dirigido_leitor',
    shortLabel: 'Leitor Síntese',
    fullLabel: 'Bloco 3: Leitor de Revisão em Equipe (30m)',
    domainId: 'bloco_operacional_sintese',
    domainLabel: 'Bloco 3 — Aplicação & Síntese',
    accentColor: '#BE123C',
  },

  // 5. Logística, Áudio/Vídeo, Plenária & Campo (Verde / Roxo)
  {
    key: 'cap_recepcao_portaria',
    shortLabel: 'Recepção',
    fullLabel: 'Logística: Recepção e Controle de Acesso',
    domainId: 'logistica_plenaria_campo',
    domainLabel: 'Logística, Plenária & Campo',
    accentColor: '#16A34A',
  },
  {
    key: 'cap_auditorio_indicador',
    shortLabel: 'Auditório',
    fullLabel: 'Logística: Indicador Interno de Auditório',
    domainId: 'logistica_plenaria_campo',
    domainLabel: 'Logística, Plenária & Campo',
    accentColor: '#16A34A',
  },
  {
    key: 'cap_transmissao_remota',
    shortLabel: 'Vídeo/Remoto',
    fullLabel: 'Mídia: Operador de Transmissão Remota / Conferência',
    domainId: 'logistica_plenaria_campo',
    domainLabel: 'Logística, Plenária & Campo',
    accentColor: '#16A34A',
  },
  {
    key: 'cap_palco_plataforma',
    shortLabel: 'Palco',
    fullLabel: 'Mídia: Suporte de Palco e Plataforma',
    domainId: 'logistica_plenaria_campo',
    domainLabel: 'Logística, Plenária & Campo',
    accentColor: '#16A34A',
  },
  {
    key: 'cap_microfone_volante',
    shortLabel: 'Microfones',
    fullLabel: 'Mídia: Operação de Microfones Volantes',
    domainId: 'logistica_plenaria_campo',
    domainLabel: 'Logística, Plenária & Campo',
    accentColor: '#16A34A',
  },
  {
    key: 'cap_mesa_som_midia',
    shortLabel: 'Mesa Áudio',
    fullLabel: 'Mídia: Operação de Mesa de Áudio e Projeção',
    domainId: 'logistica_plenaria_campo',
    domainLabel: 'Logística, Plenária & Campo',
    accentColor: '#16A34A',
  },
  {
    key: 'cap_plenaria_orador',
    shortLabel: 'Orador Plen.',
    fullLabel: 'Plenária: Palestrante de Sessão Plenária',
    domainId: 'logistica_plenaria_campo',
    domainLabel: 'Logística, Plenária & Campo',
    accentColor: '#7C3AED',
  },
  {
    key: 'cap_plenaria_presidente',
    shortLabel: 'Presid. Plen.',
    fullLabel: 'Plenária: Presidente de Sessão Plenária',
    domainId: 'logistica_plenaria_campo',
    domainLabel: 'Logística, Plenária & Campo',
    accentColor: '#7C3AED',
  },
  {
    key: 'cap_plenaria_condutor',
    shortLabel: 'Condut. Plen.',
    fullLabel: 'Plenária: Condutor de Painel Plenário',
    domainId: 'logistica_plenaria_campo',
    domainLabel: 'Logística, Plenária & Campo',
    accentColor: '#7C3AED',
  },
  {
    key: 'cap_plenaria_leitor',
    shortLabel: 'Leitor Plen.',
    fullLabel: 'Plenária: Leitor de Painel Plenário',
    domainId: 'logistica_plenaria_campo',
    domainLabel: 'Logística, Plenária & Campo',
    accentColor: '#7C3AED',
  },
  {
    key: 'cap_lider_equipe_campo',
    shortLabel: 'Dirig. Campo',
    fullLabel: 'Campo: Líder / Dirigente de Saída Operacional',
    domainId: 'logistica_plenaria_campo',
    domainLabel: 'Logística, Plenária & Campo',
    accentColor: '#0284C7',
  },
  {
    key: 'cap_manutencao_instalacoes',
    shortLabel: 'Manutenção',
    fullLabel: 'Infraestrutura: Organização e Manutenção de Instalações',
    domainId: 'logistica_plenaria_campo',
    domainLabel: 'Logística, Plenária & Campo',
    accentColor: '#0284C7',
  },
];

export const ALL_CAPABILITY_KEYS: CapabilityKey[] = CAPABILITY_COLUMNS.map((c) => c.key);

export const ROLE_TIER_LABELS: Record<ParticipantRoleTier, string> = {
  coordenador_senior: 'Nível Sênior / Coordenador',
  assistente_tecnico: 'Nível Técnico / Assistente',
  operador_base: 'Operador Base',
};

export const PROFILE_CATEGORY_LABELS: Record<ParticipantCategory, string> = {
  perfil_a: 'Grade A (Coordenação & Geral)',
  perfil_b: 'Grade B (Práticas & Duplas)',
};

export const STATUS_FLAG_LABELS: Record<ParticipantStatusFlag, string> = {
  integral_regular: 'Ativo Integral',
  integral_continuo: 'Dedicação Contínua',
  capacitador: 'Instrutor / Capacitador',
  em_qualificacao: 'Em Qualificação',
  externo_convidado: 'Convidado Externo',
  recem_designado: 'Recém-Designado',
};

/**
 * Builds an empty 26-key boolean capability record initialized to false.
 */
export function createEmptyCapabilitiesMap(): Record<CapabilityKey, boolean> {
  const map = {} as Record<CapabilityKey, boolean>;
  for (const col of CAPABILITY_COLUMNS) {
    map[col.key] = false;
  }
  return map;
}

/**
 * Deterministically derives a full 26-column privilege matrix for a participant
 * based on their roleTier, profileCategory, or legacy capabilityTags.
 */
export function buildPresetCapabilities(
  profileCategory: ParticipantCategory,
  roleTier: ParticipantRoleTier,
  variantIndex: number = 0
): Record<CapabilityKey, boolean> {
  const map = createEmptyCapabilitiesMap();

  if (profileCategory === 'perfil_b') {
    // Grade B focuses on Block 2 interactive simulations, dyad partnerships, and facility support
    map.cap_pratica_1_titular = true;
    map.cap_pratica_2_titular = true;
    map.cap_pratica_3_titular = variantIndex % 3 !== 2;
    map.cap_pratica_ajudante = true;
    map.cap_manutencao_instalacoes = true;
    return map;
  }

  // Grade A (perfil_a) differentiated by Role Tier:
  if (roleTier === 'coordenador_senior') {
    map.cap_abertura_fechamento = true;
    map.cap_presidencia_sessao = true;
    map.cap_tema_central = true;
    map.cap_analise_aprofundada = true;
    map.cap_modulo_operacional_1 = true;
    map.cap_modulo_operacional_2 = true;
    map.cap_estudo_dirigido_condutor = true;
    map.cap_plenaria_orador = true;
    map.cap_plenaria_presidente = true;
    map.cap_plenaria_condutor = variantIndex % 2 === 0;
    map.cap_lider_equipe_campo = true;
    map.cap_manutencao_instalacoes = true;
    return map;
  }

  if (roleTier === 'assistente_tecnico') {
    map.cap_abertura_fechamento = true;
    map.cap_tema_central = true;
    map.cap_analise_aprofundada = variantIndex % 2 === 0;
    map.cap_leitura_tecnica = true;
    map.cap_pratica_1_titular = true;
    map.cap_pratica_2_titular = true;
    map.cap_pratica_3_titular = true;
    map.cap_pratica_4_discurso = true;
    map.cap_pratica_ajudante = true;
    map.cap_modulo_operacional_1 = true;
    map.cap_estudo_dirigido_leitor = true;
    map.cap_recepcao_portaria = true;
    map.cap_auditorio_indicador = true;
    map.cap_transmissao_remota = true;
    map.cap_palco_plataforma = true;
    map.cap_microfone_volante = true;
    map.cap_mesa_som_midia = true;
    map.cap_plenaria_presidente = variantIndex % 2 === 0;
    map.cap_plenaria_leitor = true;
    map.cap_lider_equipe_campo = true;
    map.cap_manutencao_instalacoes = true;
    return map;
  }

  // operador_base in perfil_a
  map.cap_abertura_fechamento = variantIndex % 2 === 0;
  map.cap_leitura_tecnica = true;
  map.cap_pratica_1_titular = true;
  map.cap_pratica_2_titular = true;
  map.cap_pratica_3_titular = variantIndex % 2 === 0;
  map.cap_pratica_4_discurso = variantIndex % 2 === 1;
  map.cap_pratica_ajudante = true;
  map.cap_estudo_dirigido_leitor = variantIndex % 2 === 0;
  map.cap_recepcao_portaria = true;
  map.cap_auditorio_indicador = true;
  map.cap_microfone_volante = true;
  map.cap_palco_plataforma = variantIndex % 2 === 0;
  map.cap_mesa_som_midia = variantIndex % 3 === 0;
  map.cap_plenaria_leitor = variantIndex % 3 === 0;
  map.cap_manutencao_instalacoes = true;
  return map;
}

/**
 * Synchronizes summary `capabilityTags` from the 26-column boolean `capabilities` map.
 */
export function deriveSummaryTagsFromCapabilities(
  capabilities: Record<string, boolean>,
  roleTier?: ParticipantRoleTier
): string[] {
  const tags = new Set<string>();
  if (
    roleTier === 'coordenador_senior' ||
    capabilities.cap_presidencia_sessao ||
    capabilities.cap_estudo_dirigido_condutor
  ) {
    tags.add('Coordenação');
    tags.add('Supervisor');
  }
  if (
    capabilities.cap_tema_central ||
    capabilities.cap_analise_aprofundada ||
    capabilities.cap_modulo_operacional_1
  ) {
    tags.add('Apresentador');
  }
  if (
    capabilities.cap_leitura_tecnica ||
    capabilities.cap_estudo_dirigido_leitor ||
    capabilities.cap_plenaria_leitor
  ) {
    tags.add('Relator');
  }
  if (
    capabilities.cap_pratica_1_titular ||
    capabilities.cap_pratica_2_titular ||
    capabilities.cap_pratica_3_titular ||
    capabilities.cap_pratica_4_discurso
  ) {
    tags.add('Titular');
  }
  if (capabilities.cap_pratica_ajudante) {
    tags.add('Parceiro');
  }
  if (
    capabilities.cap_mesa_som_midia ||
    capabilities.cap_microfone_volante ||
    capabilities.cap_transmissao_remota
  ) {
    tags.add('Logística');
  }
  return Array.from(tags);
}

/**
 * Resolves any raw privilege string from a CSV spreadsheet (either a canonical `cap_*` key,
 * a localized label like "Presidência" / "Microfones" / "Leitura", or an arbitrary user-created
 * privilege like "Privilegio_Custom_Audio_HD" or "Som Volante") into a canonical or custom key.
 * Also supports explicit boolean assignment syntax (`Privilegio=0`, `Privilegio=nao`, `!Privilegio`).
 */
export function resolveCapabilityKeyOrCustom(rawToken: string): {
  key: CapabilityKey;
  enabled: boolean;
  isCustom: boolean;
  label: string;
} {
  let clean = (rawToken || '').trim();
  if (!clean) {
    return { key: '', enabled: false, isCustom: false, label: '' };
  }

  let enabled = true;
  if (clean.startsWith('!') || clean.startsWith('-')) {
    enabled = false;
    clean = clean.slice(1).trim();
  } else {
    const eqMatch = clean.match(/^(.+?)\s*[=:]\s*(.+)$/);
    if (eqMatch) {
      clean = eqMatch[1].trim();
      const valNorm = normalizePersonKey(eqMatch[2]);
      if (
        valNorm === '0' ||
        valNorm === 'false' ||
        valNorm === 'nao' ||
        valNorm === 'n' ||
        valNorm === 'inativo' ||
        valNorm === 'no' ||
        valNorm === 'off'
      ) {
        enabled = false;
      } else {
        enabled = true;
      }
    }
  }

  // 1. Direct match by canonical key
  const direct = CAPABILITY_COLUMNS.find((c) => c.key.toLowerCase() === clean.toLowerCase());
  if (direct) {
    return {
      key: direct.key,
      enabled,
      isCustom: false,
      label: direct.shortLabel,
    };
  }

  // 2. Match by normalized shortLabel or fullLabel (only when not a custom identifier with underscores)
  const normToken = normalizePersonKey(clean);
  if (normToken && !clean.includes('_')) {
    const byLabel = CAPABILITY_COLUMNS.find(
      (c) =>
        normalizePersonKey(c.shortLabel) === normToken ||
        normalizePersonKey(c.fullLabel) === normToken
    );
    if (byLabel) {
      return {
        key: byLabel.key,
        enabled,
        isCustom: false,
        label: byLabel.shortLabel,
      };
    }
  }

  // 3. Arbitrary custom privilege defined by the user in the CSV spreadsheet
  const sanitizedKey = clean.replace(/^[=+@]+/, '').trim();
  const forbiddenProtoKeys = new Set([
    '__proto__',
    'constructor',
    'prototype',
    'tostring',
    'valueof',
    'hasownproperty',
  ]);
  if (!sanitizedKey || forbiddenProtoKeys.has(sanitizedKey.toLowerCase())) {
    return null;
  }

  return {
    key: sanitizedKey,
    enabled,
    isCustom: true,
    label: sanitizedKey,
  };
}

/**
 * Returns the 26 standard `CAPABILITY_COLUMNS` plus any dynamic/custom privilege columns
 * discovered across the participants' `capabilities` maps (Domain 6: `custom_csv`).
 */
export function getEffectiveCapabilityColumns(
  participants: ParticipantProfile[] = [],
  extraCustomKeys: string[] = []
): CapabilityColumnMeta[] {
  const builtinKeySet = new Set<string>(CAPABILITY_COLUMNS.map((c) => c.key));
  const forbiddenProtoKeys = new Set([
    '__proto__',
    'constructor',
    'prototype',
    'tostring',
    'valueof',
    'hasownproperty',
  ]);
  const discoveredCustomKeys = new Set<string>();

  for (const k of extraCustomKeys) {
    const trimmed = (k || '').trim();
    if (
      trimmed &&
      !builtinKeySet.has(trimmed) &&
      !forbiddenProtoKeys.has(trimmed.toLowerCase())
    ) {
      discoveredCustomKeys.add(trimmed);
    }
  }

  for (const p of participants) {
    if (!p || !p.capabilities) continue;
    for (const k of Object.keys(p.capabilities)) {
      const trimmed = (k || '').trim();
      if (
        trimmed &&
        !builtinKeySet.has(trimmed) &&
        !forbiddenProtoKeys.has(trimmed.toLowerCase())
      ) {
        discoveredCustomKeys.add(trimmed);
      }
    }
  }

  const customColumns: CapabilityColumnMeta[] = Array.from(discoveredCustomKeys).map((customKey) => ({
    key: customKey,
    shortLabel: customKey,
    fullLabel: `Privilégio da Planilha: ${customKey}`,
    domainId: 'custom_csv',
    domainLabel: 'Planilha / Customizados',
    accentColor: '#EC4899',
    isCustom: true,
  }));

  return [...CAPABILITY_COLUMNS, ...customColumns];
}

export const discoverDynamicCapabilityColumns = getEffectiveCapabilityColumns;
export const discoverDynamicPrivilegeCatalog = getEffectiveCapabilityColumns;

/**
 * Ensures any ParticipantProfile has a complete 26-key `capabilities` matrix
 * (plus any custom CSV privileges), `profileCategory`, `roleTier`, and `statusFlags` populated.
 *
 * When `profile.preserveExplicitCapabilities` or `options.preserveExplicitCapabilities` is true,
 * NEVER injects `buildPresetCapabilities(...)` — only the privileges explicitly marked `true`
 * in `profile.capabilities` remain `true`, and all other standard privileges are `false`.
 */
export function ensureParticipantPrivilegeMatrix(
  profile: ParticipantProfile,
  index: number = 0,
  options?: { preserveExplicitCapabilities?: boolean }
): ParticipantProfile {
  const hasCoord = profile.capabilityTags?.includes('Coordenação');
  const hasApresentador = profile.capabilityTags?.includes('Apresentador');
  const hasRelator = profile.capabilityTags?.includes('Relator');

  const inferredCategory: ParticipantCategory =
    profile.profileCategory ||
    (hasCoord || hasApresentador || hasRelator ? 'perfil_a' : 'perfil_b');

  const inferredTier: ParticipantRoleTier =
    profile.roleTier ||
    (hasCoord
      ? 'coordenador_senior'
      : hasApresentador
      ? 'assistente_tecnico'
      : 'operador_base');

  const preserveExplicit =
    Boolean(profile.preserveExplicitCapabilities) ||
    Boolean(options?.preserveExplicitCapabilities);

  const baseCaps = preserveExplicit
    ? createEmptyCapabilitiesMap()
    : buildPresetCapabilities(inferredCategory, inferredTier, index);

  const mergedCaps: Record<string, boolean> = {
    ...baseCaps,
    ...(profile.capabilities || {}),
  };

  const statusFlags: ParticipantStatusFlag[] =
    profile.statusFlags && profile.statusFlags.length > 0
      ? profile.statusFlags
      : inferredTier === 'coordenador_senior'
      ? ['integral_regular', 'capacitador']
      : inferredTier === 'assistente_tecnico'
      ? ['integral_regular']
      : ['em_qualificacao'];

  const updatedTags = deriveSummaryTagsFromCapabilities(mergedCaps, inferredTier);
  // Also include any active custom privilege keys in capabilityTags for easy visibility
  const builtinKeySet = new Set<string>(ALL_CAPABILITY_KEYS);
  const customActiveTags = Object.entries(mergedCaps)
    .filter(([k, v]) => Boolean(v) && !builtinKeySet.has(k))
    .map(([k]) => k);

  const mergedTags = Array.from(
    new Set([
      ...(preserveExplicit ? [] : profile.capabilityTags || []),
      ...updatedTags,
      ...customActiveTags,
    ])
  );

  return {
    ...profile,
    profileCategory: inferredCategory,
    roleTier: inferredTier,
    statusFlags,
    capabilities: mergedCaps,
    capabilityTags: mergedTags,
    assignmentCount: profile.assignmentCount ?? 0,
    lastAssignedIsoDate: profile.lastAssignedIsoDate ?? '',
    active: profile.active ?? true,
    preserveExplicitCapabilities: preserveExplicit || profile.preserveExplicitCapabilities,
  };
}

/**
 * 24 Clean-Room Synthetic Participants covering Grupo 1, Grupo 2, Grupo 3,
 * both Profile Categories (Grade A & Grade B), and all 3 Role Tiers.
 */
const RAW_SYNTHETIC_MATRIX_SPECS: Array<{
  id: string;
  name: string;
  groupTag: string;
  profileCategory: ParticipantCategory;
  roleTier: ParticipantRoleTier;
  statusFlags: ParticipantStatusFlag[];
}> = [
  // Grupo 1 (8 integrantes: 2 Sênior, 2 Técnico, 2 Base Grade A, 2 Base Grade B)
  {
    id: 'p-01',
    name: 'Participante 01',
    groupTag: 'Grupo 1',
    profileCategory: 'perfil_a',
    roleTier: 'coordenador_senior',
    statusFlags: ['integral_regular', 'capacitador'],
  },
  {
    id: 'p-02',
    name: 'Participante 02',
    groupTag: 'Grupo 1',
    profileCategory: 'perfil_b',
    roleTier: 'operador_base',
    statusFlags: ['integral_regular'],
  },
  {
    id: 'p-03',
    name: 'Participante 03',
    groupTag: 'Grupo 1',
    profileCategory: 'perfil_a',
    roleTier: 'coordenador_senior',
    statusFlags: ['integral_continuo', 'capacitador'],
  },
  {
    id: 'p-04',
    name: 'Participante 04',
    groupTag: 'Grupo 1',
    profileCategory: 'perfil_b',
    roleTier: 'operador_base',
    statusFlags: ['integral_continuo'],
  },
  {
    id: 'p-05',
    name: 'Participante 05',
    groupTag: 'Grupo 1',
    profileCategory: 'perfil_a',
    roleTier: 'assistente_tecnico',
    statusFlags: ['integral_regular'],
  },
  {
    id: 'p-06',
    name: 'Participante 06',
    groupTag: 'Grupo 1',
    profileCategory: 'perfil_b',
    roleTier: 'operador_base',
    statusFlags: ['em_qualificacao'],
  },

  // Grupo 2 (5 originais + extras)
  {
    id: 'p-07',
    name: 'Participante 07',
    groupTag: 'Grupo 2',
    profileCategory: 'perfil_a',
    roleTier: 'coordenador_senior',
    statusFlags: ['integral_regular', 'capacitador'],
  },
  {
    id: 'p-08',
    name: 'Participante 08',
    groupTag: 'Grupo 2',
    profileCategory: 'perfil_b',
    roleTier: 'operador_base',
    statusFlags: ['integral_regular', 'capacitador'],
  },
  {
    id: 'p-09',
    name: 'Participante 09',
    groupTag: 'Grupo 2',
    profileCategory: 'perfil_a',
    roleTier: 'assistente_tecnico',
    statusFlags: ['integral_regular'],
  },
  {
    id: 'p-10',
    name: 'Participante 10',
    groupTag: 'Grupo 2',
    profileCategory: 'perfil_a',
    roleTier: 'operador_base',
    statusFlags: ['em_qualificacao'],
  },
  {
    id: 'p-11',
    name: 'Participante 11',
    groupTag: 'Grupo 2',
    profileCategory: 'perfil_b',
    roleTier: 'operador_base',
    statusFlags: ['integral_continuo'],
  },

  // Grupo 3 (5 originais + extras)
  {
    id: 'p-12',
    name: 'Participante 12',
    groupTag: 'Grupo 3',
    profileCategory: 'perfil_a',
    roleTier: 'coordenador_senior',
    statusFlags: ['integral_regular', 'capacitador'],
  },
  {
    id: 'p-13',
    name: 'Participante 13',
    groupTag: 'Grupo 3',
    profileCategory: 'perfil_a',
    roleTier: 'assistente_tecnico',
    statusFlags: ['integral_regular'],
  },
  {
    id: 'p-14',
    name: 'Participante 14',
    groupTag: 'Grupo 3',
    profileCategory: 'perfil_b',
    roleTier: 'operador_base',
    statusFlags: ['integral_regular'],
  },
  {
    id: 'p-15',
    name: 'Participante 15',
    groupTag: 'Grupo 3',
    profileCategory: 'perfil_b',
    roleTier: 'operador_base',
    statusFlags: ['em_qualificacao'],
  },
  {
    id: 'p-16',
    name: 'Participante 16',
    groupTag: 'Grupo 3',
    profileCategory: 'perfil_a',
    roleTier: 'operador_base',
    statusFlags: ['integral_regular'],
  },

  // Integrantes adicionais sintéticos (17 a 24) para rotação ampla sem repetição
  {
    id: 'p-17',
    name: 'Participante 17',
    groupTag: 'Grupo 1',
    profileCategory: 'perfil_a',
    roleTier: 'assistente_tecnico',
    statusFlags: ['integral_regular'],
  },
  {
    id: 'p-18',
    name: 'Participante 18',
    groupTag: 'Grupo 1',
    profileCategory: 'perfil_b',
    roleTier: 'operador_base',
    statusFlags: ['integral_regular'],
  },
  {
    id: 'p-19',
    name: 'Participante 19',
    groupTag: 'Grupo 2',
    profileCategory: 'perfil_a',
    roleTier: 'assistente_tecnico',
    statusFlags: ['integral_continuo'],
  },
  {
    id: 'p-20',
    name: 'Participante 20',
    groupTag: 'Grupo 2',
    profileCategory: 'perfil_b',
    roleTier: 'operador_base',
    statusFlags: ['integral_regular'],
  },
  {
    id: 'p-21',
    name: 'Participante 21',
    groupTag: 'Grupo 2',
    profileCategory: 'perfil_a',
    roleTier: 'operador_base',
    statusFlags: ['recem_designado'],
  },
  {
    id: 'p-22',
    name: 'Participante 22',
    groupTag: 'Grupo 3',
    profileCategory: 'perfil_a',
    roleTier: 'coordenador_senior',
    statusFlags: ['integral_regular', 'capacitador'],
  },
  {
    id: 'p-23',
    name: 'Participante 23',
    groupTag: 'Grupo 3',
    profileCategory: 'perfil_b',
    roleTier: 'operador_base',
    statusFlags: ['integral_continuo'],
  },
  {
    id: 'p-24',
    name: 'Participante 24',
    groupTag: 'Grupo 3',
    profileCategory: 'perfil_a',
    roleTier: 'operador_base',
    statusFlags: ['em_qualificacao'],
  },
];

export const DEFAULT_PRIVILEGE_MATRIX_PARTICIPANTS: ParticipantProfile[] =
  RAW_SYNTHETIC_MATRIX_SPECS.map((spec, idx) => {
    const capabilities = buildPresetCapabilities(spec.profileCategory, spec.roleTier, idx);
    const capabilityTags = deriveSummaryTagsFromCapabilities(capabilities, spec.roleTier);
    return {
      id: spec.id,
      name: spec.name,
      groupTag: spec.groupTag,
      profileCategory: spec.profileCategory,
      roleTier: spec.roleTier,
      statusFlags: spec.statusFlags,
      capabilities,
      capabilityTags,
      assignmentCount: 0,
      lastAssignedIsoDate: '',
      active: true,
    };
  });

export interface PrivilegeMatrixFilterCriteria {
  categories?: ParticipantCategory[];
  roleTiers?: ParticipantRoleTier[];
  statusFlags?: ParticipantStatusFlag[];
  groupTag?: string; // 'ALL' or specific group like 'Grupo 1'
  searchQuery?: string;
  requiredCapability?: CapabilityKey;
}

/**
 * Multi-facet filter matching the top control ribbon of the Privilege Matrix editor.
 */
export function filterParticipantsByMatrixCriteria(
  participants: ParticipantProfile[],
  criteria: PrivilegeMatrixFilterCriteria
): ParticipantProfile[] {
  const normSearch = normalizePersonKey(criteria.searchQuery);

  return participants.filter((raw) => {
    const p = ensureParticipantPrivilegeMatrix(raw);
    if (p.active === false) return false;

    if (criteria.categories && criteria.categories.length > 0) {
      if (!p.profileCategory || !criteria.categories.includes(p.profileCategory)) {
        return false;
      }
    }

    if (criteria.roleTiers && criteria.roleTiers.length > 0) {
      if (!p.roleTier || !criteria.roleTiers.includes(p.roleTier)) {
        return false;
      }
    }

    if (criteria.statusFlags && criteria.statusFlags.length > 0) {
      const pFlags = p.statusFlags || [];
      const hasAny = criteria.statusFlags.some((f) => pFlags.includes(f));
      if (!hasAny) return false;
    }

    if (criteria.groupTag && criteria.groupTag !== 'ALL') {
      if (p.groupTag !== criteria.groupTag) return false;
    }

    if (criteria.requiredCapability) {
      if (!p.capabilities?.[criteria.requiredCapability]) return false;
    }

    if (normSearch) {
      const matchName = normalizePersonKey(p.name).includes(normSearch);
      const matchGroup = normalizePersonKey(p.groupTag).includes(normSearch);
      if (!matchName && !matchGroup) return false;
    }

    return true;
  });
}

export interface InferredSlotRequirement {
  primaryCapability: CapabilityKey;
  requiresPartner: boolean;
  partnerCapability: CapabilityKey;
  scarcityPriority: number; // Lower number = solved earlier (Most-Constrained First)
}

/**
 * Deterministically maps any schedule slot (by title, section index, or slot number)
 * to its required `CapabilityKey` and partner requirement.
 */
export function inferSlotRequiredCapability(
  slotLabel: string,
  sectionIndex: number = 0,
  slotIndexInSection: number = 0
): InferredSlotRequirement {
  const norm = normalizePersonKey(slotLabel);

  // Block 3: Study / Team Review (30m) — requires Conductor + Reader
  if (
    norm.includes('revisao de procedimentos') ||
    norm.includes('estudo') ||
    norm.includes('30 min')
  ) {
    return {
      primaryCapability: 'cap_estudo_dirigido_condutor',
      requiresPartner: true,
      partnerCapability: 'cap_estudo_dirigido_leitor',
      scarcityPriority: 2,
    };
  }

  // Block 1: Reading (4m)
  if (norm.includes('leitura') || norm.includes('4 min')) {
    return {
      primaryCapability: 'cap_leitura_tecnica',
      requiresPartner: false,
      partnerCapability: 'cap_pratica_ajudante',
      scarcityPriority: 6,
    };
  }

  // Block 1: Indicator Analysis (10m)
  if (norm.includes('analise de indicadores') || (sectionIndex === 0 && slotIndexInSection === 1)) {
    return {
      primaryCapability: 'cap_analise_aprofundada',
      requiresPartner: false,
      partnerCapability: 'cap_pratica_ajudante',
      scarcityPriority: 3,
    };
  }

  // Block 1: Main Theme (10m)
  if (
    norm.includes('diretrizes') ||
    norm.includes('planejamento') ||
    norm.includes('gestao') ||
    norm.includes('protocolos') ||
    sectionIndex === 0
  ) {
    return {
      primaryCapability: 'cap_tema_central',
      requiresPartner: false,
      partnerCapability: 'cap_pratica_ajudante',
      scarcityPriority: 3,
    };
  }

  // Block 2: Individual Case Presentation (Discurso / Exposição)
  if (norm.includes('caso pratico') || norm.includes('exposicao')) {
    return {
      primaryCapability: 'cap_pratica_4_discurso',
      requiresPartner: false,
      partnerCapability: 'cap_pratica_ajudante',
      scarcityPriority: 5,
    };
  }

  // Block 2: Dyad Simulations (Simulação / Prática / Dinâmica)
  if (
    norm.includes('simulacao') ||
    norm.includes('pratica de acompanhamento') ||
    norm.includes('dinamica') ||
    sectionIndex === 1
  ) {
    const praticaCap: CapabilityKey =
      slotIndexInSection === 0
        ? 'cap_pratica_1_titular'
        : slotIndexInSection === 1
        ? 'cap_pratica_2_titular'
        : 'cap_pratica_3_titular';
    return {
      primaryCapability: praticaCap,
      requiresPartner: true,
      partnerCapability: 'cap_pratica_ajudante',
      scarcityPriority: 5,
    };
  }

  // Block 3: Operational Application Slots (15m)
  return {
    primaryCapability:
      slotIndexInSection === 0 ? 'cap_modulo_operacional_1' : 'cap_modulo_operacional_2',
    requiresPartner: false,
    partnerCapability: 'cap_pratica_ajudante',
    scarcityPriority: 4,
  };
}

export interface AutoAssignOptions {
  /**
   * When true (default), dyad practice slots pair Titular + Ajudante within the
   * same `profileCategory` ('perfil_a' with 'perfil_a', 'perfil_b' with 'perfil_b').
   */
  strictSameCategoryPairing?: boolean;
  /**
   * Optional operational group filter ('ALL' or 'Grupo 1' etc.)
   */
  preferredGroupTag?: string;
  /**
   * Target session keys to auto-assign (if omitted, assigns all sessions in the registry)
   */
  targetSessionKeys?: string[];
}

export interface AutoAssignSummary {
  sessionsAssigned: number;
  slotsAssigned: number;
  sameDayCollisions: number;
  privilegeViolations: number;
  assignmentsByParticipant: Record<string, number>;
}

/**
 * Ranks eligible candidates by FIFO (least-recently-assigned first), then lowest
 * total assignment count, then group balance.
 */
function pickBestCandidate(
  participants: ParticipantProfile[],
  requiredCapability: CapabilityKey,
  usedInSession: Set<string>,
  options: {
    requiredCategory?: ParticipantCategory;
    avoidPartnerId?: string;
    preferredGroupTag?: string;
  } = {}
): ParticipantProfile | undefined {
  const eligible = participants.filter((p) => {
    if (p.active === false) return false;
    if (usedInSession.has(p.id)) return false;
    if (!p.capabilities?.[requiredCapability]) return false;
    if (options.requiredCategory && p.profileCategory !== options.requiredCategory) {
      return false;
    }
    return true;
  });

  if (eligible.length === 0) {
    // Fallback if strictSameCategoryPairing had no match: relax category constraint only,
    // NEVER relax capability or same-day collision!
    if (options.requiredCategory) {
      return pickBestCandidate(participants, requiredCapability, usedInSession, {
        ...options,
        requiredCategory: undefined,
      });
    }
    return undefined;
  }

  eligible.sort((a, b) => {
    // 1. Prefer preferredGroupTag if specified
    if (options.preferredGroupTag && options.preferredGroupTag !== 'ALL') {
      const aGroupMatch = a.groupTag === options.preferredGroupTag ? 0 : 1;
      const bGroupMatch = b.groupTag === options.preferredGroupTag ? 0 : 1;
      if (aGroupMatch !== bGroupMatch) return aGroupMatch - bGroupMatch;
    }

    // 2. Avoid repeating exact last partner if alternatives exist
    if (options.avoidPartnerId) {
      const aRepeat = a.lastPartnerId === options.avoidPartnerId ? 1 : 0;
      const bRepeat = b.lastPartnerId === options.avoidPartnerId ? 1 : 0;
      if (aRepeat !== bRepeat) return aRepeat - bRepeat;
    }

    // 3. FIFO: Oldest `lastAssignedIsoDate` first (empty string '' means never assigned -> highest priority)
    const dateA = a.lastAssignedIsoDate || '0000-00-00';
    const dateB = b.lastAssignedIsoDate || '0000-00-00';
    if (dateA !== dateB) {
      return dateA.localeCompare(dateB);
    }

    // 4. Load Balance: Lowest `assignmentCount` first
    const countA = a.assignmentCount ?? 0;
    const countB = b.assignmentCount ?? 0;
    if (countA !== countB) {
      return countA - countB;
    }

    // 5. Deterministic tie-breaker by ID
    return a.id.localeCompare(b.id, undefined, { numeric: true });
  });

  return eligible[0];
}

/**
 * Automatically assigns participants to a `FlatSkeletonEntry[]` schedule registry
 * following the 26-column Privilege Matrix, Zero Same-Day Collision rule, and FIFO Fair Rotation.
 */
export function autoAssignScheduleRegistry(
  scheduleRegistry: FlatSkeletonEntry[],
  rawParticipants: ParticipantProfile[],
  options: AutoAssignOptions = {}
): {
  updatedRegistry: FlatSkeletonEntry[];
  updatedParticipants: ParticipantProfile[];
  summary: AutoAssignSummary;
} {
  const strictSameCategoryPairing = options.strictSameCategoryPairing ?? true;
  const participants = rawParticipants.map((p, idx) => ensureParticipantPrivilegeMatrix(p, idx));
  const clonedRegistry: FlatSkeletonEntry[] = scheduleRegistry.map((e) => ({
    ...e,
    meta: { ...(e.meta || {}) },
  }));

  // Group entries by session key (first segment of key, e.g. "01", "02")
  const sessionHeaderIndices = new Map<string, number>();
  const sessionSectionIndices = new Map<string, number[]>();
  const sessionSlotIndices = new Map<string, number[]>();

  clonedRegistry.forEach((entry, idx) => {
    const parts = entry.key.split('-');
    const sessionKey = parts[0];
    if (parts.length === 1 && entry.type === 'header') {
      sessionHeaderIndices.set(sessionKey, idx);
      if (!sessionSectionIndices.has(sessionKey)) sessionSectionIndices.set(sessionKey, []);
      if (!sessionSlotIndices.has(sessionKey)) sessionSlotIndices.set(sessionKey, []);
    } else if (parts.length === 2 && entry.type === 'header') {
      const list = sessionSectionIndices.get(sessionKey) || [];
      list.push(idx);
      sessionSectionIndices.set(sessionKey, list);
    } else if (parts.length >= 3 && entry.type === 'slot') {
      const list = sessionSlotIndices.get(sessionKey) || [];
      list.push(idx);
      sessionSlotIndices.set(sessionKey, list);
    }
  });

  let sessionsAssigned = 0;
  let slotsAssigned = 0;
  let sameDayCollisions = 0;
  let privilegeViolations = 0;
  const assignmentsByParticipant: Record<string, number> = {};

  const recordAllocation = (p: ParticipantProfile, sessionIsoDate: string, partnerId?: string) => {
    p.assignmentCount = (p.assignmentCount ?? 0) + 1;
    p.lastAssignedIsoDate = sessionIsoDate;
    if (partnerId) p.lastPartnerId = partnerId;
    assignmentsByParticipant[p.name] = (assignmentsByParticipant[p.name] ?? 0) + 1;
  };

  for (const [sessionKey, headerIdx] of sessionHeaderIndices.entries()) {
    if (
      options.targetSessionKeys &&
      options.targetSessionKeys.length > 0 &&
      !options.targetSessionKeys.includes(sessionKey)
    ) {
      continue;
    }

    sessionsAssigned++;
    const headerEntry = clonedRegistry[headerIdx];
    const headerMeta = (headerEntry.meta || {}) as Record<string, any>;
    const sessionIsoDate =
      (headerMeta.sessionDate as string) ||
      `2026-10-${String(sessionsAssigned * 7).padStart(2, '0')}`;

    const usedInSession = new Set<string>();

    // 1. Assign Session Chair (`cap_presidencia_sessao`) — Most Constrained #1
    const chairCandidate = pickBestCandidate(
      participants,
      'cap_presidencia_sessao',
      usedInSession,
      { preferredGroupTag: options.preferredGroupTag }
    );
    if (chairCandidate) {
      usedInSession.add(chairCandidate.id);
      headerMeta.chairPerson = chairCandidate.name;
      headerEntry.value = chairCandidate.name;
      recordAllocation(chairCandidate, sessionIsoDate);
      slotsAssigned++;
    }

    // 2. Collect all slots in this session and sort by `scarcityPriority` (Most-Constrained First)
    const slotIdxs = sessionSlotIndices.get(sessionKey) || [];
    const slotDescriptors = slotIdxs.map((registryIdx) => {
      const entry = clonedRegistry[registryIdx];
      const parts = entry.key.split('-');
      const sectionIdx = Math.max(0, parseInt(parts[1] || '1', 10) - 1);
      const slotIdxInSection = Math.max(0, parseInt(parts[2] || '1', 10) - 1);
      const req = inferSlotRequiredCapability(entry.label, sectionIdx, slotIdxInSection);
      return { registryIdx, entry, req };
    });

    slotDescriptors.sort((a, b) => a.req.scarcityPriority - b.req.scarcityPriority);

    for (const desc of slotDescriptors) {
      const slotMeta = (desc.entry.meta || {}) as Record<string, any>;
      const primary = pickBestCandidate(
        participants,
        desc.req.primaryCapability,
        usedInSession,
        { preferredGroupTag: options.preferredGroupTag }
      );

      if (primary) {
        if (usedInSession.has(primary.id)) sameDayCollisions++;
        if (!primary.capabilities?.[desc.req.primaryCapability]) privilegeViolations++;
        usedInSession.add(primary.id);

        let assistant: ParticipantProfile | undefined;
        if (desc.req.requiresPartner) {
          const isPracticePartner = desc.req.partnerCapability === 'cap_pratica_ajudante';
          assistant = pickBestCandidate(
            participants,
            desc.req.partnerCapability,
            usedInSession,
            {
              requiredCategory:
                strictSameCategoryPairing && isPracticePartner
                  ? primary.profileCategory
                  : undefined,
              avoidPartnerId: primary.id,
              preferredGroupTag: options.preferredGroupTag,
            }
          );

          if (assistant) {
            if (usedInSession.has(assistant.id)) sameDayCollisions++;
            if (!assistant.capabilities?.[desc.req.partnerCapability]) privilegeViolations++;
            usedInSession.add(assistant.id);
            recordAllocation(assistant, sessionIsoDate, primary.id);
            slotsAssigned++;
          }
        }

        recordAllocation(primary, sessionIsoDate, assistant?.id);
        slotsAssigned++;

        slotMeta.assignedTo = primary.name;
        slotMeta.groupTag = primary.groupTag;
        slotMeta.capabilityTags = primary.capabilityTags;
        slotMeta.requiredCapability = desc.req.primaryCapability;

        if (assistant) {
          slotMeta.assistantTo = assistant.name;
          slotMeta.assistantGroupTag = assistant.groupTag;
          desc.entry.value = `${primary.name} / ${assistant.name}`;
        } else {
          delete slotMeta.assistantTo;
          delete slotMeta.assistantGroupTag;
          desc.entry.value = primary.name;
        }
      }
    }

    // 3. Assign Opening & Closing (`cap_abertura_fechamento`) from remaining free participants
    const openingCandidate = pickBestCandidate(
      participants,
      'cap_abertura_fechamento',
      usedInSession,
      { preferredGroupTag: options.preferredGroupTag }
    );
    if (openingCandidate) {
      usedInSession.add(openingCandidate.id);
      headerMeta.openingPrayer = openingCandidate.name;
      recordAllocation(openingCandidate, sessionIsoDate);
      slotsAssigned++;
    }

    const closingCandidate = pickBestCandidate(
      participants,
      'cap_abertura_fechamento',
      usedInSession,
      { preferredGroupTag: options.preferredGroupTag }
    );
    if (closingCandidate) {
      usedInSession.add(closingCandidate.id);
      headerMeta.closingPrayer = closingCandidate.name;
      recordAllocation(closingCandidate, sessionIsoDate);
      slotsAssigned++;
    }
  }

  return {
    updatedRegistry: clonedRegistry,
    updatedParticipants: participants,
    summary: {
      sessionsAssigned,
      slotsAssigned,
      sameDayCollisions,
      privilegeViolations,
      assignmentsByParticipant,
    },
  };
}
