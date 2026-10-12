/**
 * Sekundo — Transformer Engine Type Definitions
 *
 * Defines the Metamorphic Engine where users dynamically:
 * 1. Choose which fields/columns to store in CSV and nodes.
 * 2. Toggle active mathematical laws from any built-in engine on/off at will.
 * 3. Receive consolidated real-time metric computations and operational alerts.
 */

// ---------------------------------------------------------------------------
// 1. Math Modules (Pluggable Mathematical Laws)
// ---------------------------------------------------------------------------

export type TransformerMathModuleId =
  | 'coverage_rollup'      // Territory: Boolean 0/1 rollup, coverage %, worked vs pending
  | 'geo_proximity'        // Spatial: Coordinates (lat/lng), centroids, Haversine checks
  | 'roster_conflicts'     // Roster: Double-booking detection (same person in overlapping slots)
  | 'roster_workload'      // Roster: Task distribution balance and workload variance
  | 'run_of_show_timing'   // ROS: Planned vs actual duration, cumulative drift (Delta), HARD_OUT
  | 'graicunas_span'       // ICS: Graicunas formula R = n*(2^(n-1) + n - 1), cognitive span > 7
  | 'weighted_wbs'         // WBS: Time-weighted progress rollup Sum(Progress * Hours) / Sum(Hours)
  | 'tournament_score'     // Tournament: Match scoring, wins/losses, rematch detection
  | 'synthesis_summary'    // Study: Executive synthesis aggregation and question tracking
  | 'canvassing_funnel';   // Canvassing: Door contact rates and code distribution

export interface TransformerMathModuleMeta {
  id: TransformerMathModuleId;
  name: string;
  category: 'logistics' | 'workforce' | 'timing' | 'command' | 'strategy';
  description: string;
  icon: string;
  formulaDescription: string;
  requiredFields: string[];
}

export const TRANSFORMER_MATH_MODULES: TransformerMathModuleMeta[] = [
  {
    id: 'coverage_rollup',
    name: 'Rollup de Cobertura (0/1 Booleano)',
    category: 'logistics',
    description: 'Calcula percentual de conclusão e agrega nós trabalhados da base até o topo.',
    icon: 'checkbox-marked-circle-outline',
    formulaDescription: 'Coverage % = (Worked Units / Total Units) * 100',
    requiredFields: ['trabalhado'],
  },
  {
    id: 'geo_proximity',
    name: 'Geolocalização & Centroides',
    category: 'logistics',
    description: 'Valida coordenadas e computa dispersão espacial e pontos extremos.',
    icon: 'map-marker-radius-outline',
    formulaDescription: 'Distância Haversine entre coordenadas latitude/longitude',
    requiredFields: ['latitude', 'longitude'],
  },
  {
    id: 'roster_conflicts',
    name: 'Anti Double-Booking de Pessoal',
    category: 'workforce',
    description: 'Detecta conflitos da mesma pessoa designada simultaneamente em múltiplos nós.',
    icon: 'account-alert-outline',
    formulaDescription: 'Verificação combinatória de atribuição simultânea em mesmo horário/sala',
    requiredFields: ['responsavel'],
  },
  {
    id: 'roster_workload',
    name: 'Balanceamento de Carga de Trabalho',
    category: 'workforce',
    description: 'Mede a distribuição de tarefas por voluntário/membro e calcula desvio padrão.',
    icon: 'scale-balance',
    formulaDescription: 'Variância de carga de trabalho entre participantes',
    requiredFields: ['responsavel', 'duracao_min'],
  },
  {
    id: 'run_of_show_timing',
    name: 'Desvio Cumulativo & Âncoras Hard Out',
    category: 'timing',
    description: 'Rastreia desvio acumulado em segundos e dispara alertas para cortes emergenciais.',
    icon: 'timer-alert-outline',
    formulaDescription: 'Delta = Sum(ActualDuration - PlannedDuration)',
    requiredFields: ['duracao_planejada_seg'],
  },
  {
    id: 'graicunas_span',
    name: 'Span de Controle de Graicunas (FEMA ICS)',
    category: 'command',
    description: 'Calcula complexidade relacional de Graicunas e alerta quando ramificações > 7.',
    icon: 'shield-alert-outline',
    formulaDescription: 'R = n * (2^(n - 1) + n - 1), com limite ótimo de 3 a 7 subordinados',
    requiredFields: [],
  },
  {
    id: 'weighted_wbs',
    name: 'Progresso Ponderado por Horas (WBS)',
    category: 'strategy',
    description: 'Agrega o progresso percentual ponderado pelo volume de horas estimadas.',
    icon: 'chart-bell-curve-cumulative',
    formulaDescription: 'Progress % = Sum(Progresso * Horas) / Sum(Horas)',
    requiredFields: ['progresso_pct', 'estimativa_horas'],
  },
  {
    id: 'tournament_score',
    name: 'Emparelhamento & Anti-Revanche',
    category: 'strategy',
    description: 'Soma vitórias/derrotas de concorrentes e detecta partidas repetidas.',
    icon: 'trophy-variant-outline',
    formulaDescription: 'Matriz de confrontos com invariante de anti-revanche de grafo bipartido',
    requiredFields: ['jogador_a', 'jogador_b'],
  },
  {
    id: 'synthesis_summary',
    name: 'Síntese Coletiva de Estudos',
    category: 'strategy',
    description: 'Agrega pontos-chave e compila resumo executivo unificado da árvore.',
    icon: 'book-open-page-variant-outline',
    formulaDescription: 'Consolidação de sínteses e perguntas-chave pendentes',
    requiredFields: ['sintese'],
  },
  {
    id: 'canvassing_funnel',
    name: 'Funil de Contato & Engajamento',
    category: 'logistics',
    description: 'Mapeia taxas de conversão de visitas porta a porta (contatado, ausente, recusa).',
    icon: 'door-open',
    formulaDescription: 'Taxa de contato = Contatados / Portas Visitadas',
    requiredFields: ['contato_status'],
  },
];

// ---------------------------------------------------------------------------
// 2. Custom Fields Catalog
// ---------------------------------------------------------------------------

export interface TransformerFieldDefinition {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'date';
  category: string;
  defaultVal?: string | number | boolean;
  associatedModule?: TransformerMathModuleId;
}

export const CATALOG_STANDARD_FIELDS: TransformerFieldDefinition[] = [
  // Território & Endereço
  { key: 'endereco', label: 'Endereço Completo', type: 'string', category: 'Território', defaultVal: '' },
  { key: 'latitude', label: 'Latitude', type: 'number', category: 'Território', defaultVal: 0, associatedModule: 'geo_proximity' },
  { key: 'longitude', label: 'Longitude', type: 'number', category: 'Território', defaultVal: 0, associatedModule: 'geo_proximity' },
  { key: 'trabalhado', label: 'Trabalhado (0 ou 1)', type: 'number', category: 'Território', defaultVal: 0, associatedModule: 'coverage_rollup' },

  // Pessoal & Escalas
  { key: 'responsavel', label: 'Responsável / Designado', type: 'string', category: 'Pessoal', defaultVal: '', associatedModule: 'roster_conflicts' },
  { key: 'sala', label: 'Sala / Local', type: 'string', category: 'Pessoal', defaultVal: '' },
  { key: 'horario_inicio', label: 'Horário de Início', type: 'string', category: 'Pessoal', defaultVal: '' },
  { key: 'duracao_min', label: 'Duração (minutos)', type: 'number', category: 'Pessoal', defaultVal: 30, associatedModule: 'roster_workload' },
  { key: 'confirmado', label: 'Presença Confirmada (1/0)', type: 'number', category: 'Pessoal', defaultVal: 0 },

  // Produção & Timing
  { key: 'duracao_planejada_seg', label: 'Duração Planejada (seg)', type: 'number', category: 'Produção', defaultVal: 180, associatedModule: 'run_of_show_timing' },
  { key: 'duracao_real_seg', label: 'Duração Real (seg)', type: 'number', category: 'Produção', defaultVal: 180, associatedModule: 'run_of_show_timing' },
  { key: 'ancora_hard', label: 'Âncora Rígida (HARD_OUT)', type: 'string', category: 'Produção', defaultVal: 'NONE' },
  { key: 'pad_buffer', label: 'Item Amortecedor de Corte', type: 'number', category: 'Produção', defaultVal: 0 },

  // Projeto & WBS
  { key: 'estimativa_horas', label: 'Estimativa (horas)', type: 'number', category: 'Projeto', defaultVal: 8, associatedModule: 'weighted_wbs' },
  { key: 'progresso_pct', label: 'Progresso (%)', type: 'number', category: 'Projeto', defaultVal: 0, associatedModule: 'weighted_wbs' },
  { key: 'prioridade', label: 'Prioridade (Alta/Média/Baixa)', type: 'string', category: 'Projeto', defaultVal: 'Média' },

  // Torneios & Competições
  { key: 'jogador_a', label: 'Competidor A', type: 'string', category: 'Torneio', defaultVal: '', associatedModule: 'tournament_score' },
  { key: 'jogador_b', label: 'Competidor B', type: 'string', category: 'Torneio', defaultVal: '', associatedModule: 'tournament_score' },
  { key: 'score_a', label: 'Pontos Competidor A', type: 'number', category: 'Torneio', defaultVal: 0 },
  { key: 'score_b', label: 'Pontos Competidor B', type: 'number', category: 'Torneio', defaultVal: 0 },

  // Conhecimento & Síntese
  { key: 'sintese', label: 'Síntese do Tópico', type: 'string', category: 'Estudos', defaultVal: '', associatedModule: 'synthesis_summary' },
  { key: 'pergunta_chave', label: 'Pergunta Central', type: 'string', category: 'Estudos', defaultVal: '' },

  // Canvassing & Engajamento
  { key: 'contato_status', label: 'Status do Contato (CNT/NH/REF)', type: 'string', category: 'Canvassing', defaultVal: 'NH', associatedModule: 'canvassing_funnel' },
  { key: 'intencao_voto', label: 'Engajamento / Intenção', type: 'string', category: 'Canvassing', defaultVal: '' },

  // Genérico & Observações
  { key: 'observacoes', label: 'Observações / Notas', type: 'string', category: 'Geral', defaultVal: '' },
  { key: 'tags', label: 'Etiquetas / Tags', type: 'string', category: 'Geral', defaultVal: '' },
];

// ---------------------------------------------------------------------------
// 3. Transformer Configuration stored on EventConfig
// ---------------------------------------------------------------------------

export interface TransformerConfig {
  /** Column keys to store in CSV and node metadata */
  customFields: string[];

  /** Active mathematical calculation modules */
  activeMathModules: TransformerMathModuleId[];

  /** Optional parameters for math tuning */
  parameters?: {
    maxSpanOfControl?: number;       // default: 7
    workDayHours?: number;           // default: 8
    timingWarningDriftSec?: number;  // default: 60
  };
}

export const DEFAULT_TRANSFORMER_CONFIG: TransformerConfig = {
  customFields: [
    'endereco',
    'trabalhado',
    'responsavel',
    'duracao_min',
    'estimativa_horas',
    'progresso_pct',
    'observacoes',
  ],
  activeMathModules: [
    'coverage_rollup',
    'roster_conflicts',
    'weighted_wbs',
  ],
  parameters: {
    maxSpanOfControl: 7,
    workDayHours: 8,
    timingWarningDriftSec: 60,
  },
};

// ---------------------------------------------------------------------------
// 4. Unified Mathematical Metrics Output
// ---------------------------------------------------------------------------

export interface TransformerAlert {
  id: string;
  level: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  pathKey?: string;
}

export interface TransformerSummaryBadge {
  id: string;
  label: string;
  value: string | number;
  sublabel?: string;
  color?: string; // hex
}

export interface TransformerMetrics {
  totalNodes: number;
  leafNodes: number;
  activeModules: TransformerMathModuleId[];
  moduleResults: Record<string, any>;
  alerts: TransformerAlert[];
  summaryBadges: TransformerSummaryBadge[];
}
