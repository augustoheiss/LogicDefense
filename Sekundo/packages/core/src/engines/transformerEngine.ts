/**
 * Sekundo — Engine Transformer (Metamórfica & Universal)
 *
 * An open, metamorphic engine that allows users to:
 * 1. Define custom schema columns for CSV and tree metadata.
 * 2. Toggle active mathematical laws from any universal engine on/off at will.
 * 3. Execute all active mathematical calculations in real time, compiling
 *    cross-domain metrics, health badges, and operational alerts.
 */

import type { SkeletonNode, NodeType } from '../skeleton/types';
import type { EventEngine, EngineMetrics } from './types';
import {
  type TransformerConfig,
  type TransformerMetrics,
  type TransformerAlert,
  type TransformerSummaryBadge,
  type TransformerMathModuleId,
  DEFAULT_TRANSFORMER_CONFIG,
} from './transformerTypes';

// ---------------------------------------------------------------------------
// Mathematical Calculation Modules
// ---------------------------------------------------------------------------

/**
 * 1. Territory / Coverage Rollup Math (0/1 Boolean)
 */
function computeCoverageRollup(nodes: SkeletonNode[]): {
  metrics: { totalUnits: number; workedUnits: number; coveragePercent: number };
  alerts: TransformerAlert[];
  badges: TransformerSummaryBadge[];
} {
  let totalUnits = 0;
  let workedUnits = 0;

  function visit(n: SkeletonNode) {
    if (n.children.length === 0) {
      totalUnits++;
      const meta = n.meta || {};
      const isWorked =
        meta.worked === 1 ||
        meta.trabalhado === 1 ||
        meta.trabalhado === '1' ||
        meta.worked === '1' ||
        n.value === '1' ||
        n.value?.toLowerCase() === 'concluido';

      if (isWorked) {
        workedUnits++;
      }
    }
    for (const c of n.children) visit(c);
  }

  for (const root of nodes) visit(root);

  const coveragePercent =
    totalUnits > 0 ? Math.round((workedUnits / totalUnits) * 1000) / 10 : 0;

  const alerts: TransformerAlert[] = [];
  if (totalUnits > 0 && coveragePercent < 20) {
    alerts.push({
      id: 'low_coverage',
      level: 'info',
      title: 'Cobertura em Fase Inicial',
      message: `Apenas ${coveragePercent}% dos nós estão marcados como trabalhados (${workedUnits}/${totalUnits}).`,
    });
  }

  const badges: TransformerSummaryBadge[] = [
    {
      id: 'coverage_pct',
      label: 'Cobertura',
      value: `${coveragePercent}%`,
      sublabel: `${workedUnits}/${totalUnits} unidades`,
      color: coveragePercent >= 80 ? '#10B981' : coveragePercent >= 50 ? '#F59E0B' : '#3B82F6',
    },
  ];

  return {
    metrics: { totalUnits, workedUnits, coveragePercent },
    alerts,
    badges,
  };
}

/**
 * 2. Geo Proximity & Coordinates Math
 */
function computeGeoProximity(nodes: SkeletonNode[]): {
  metrics: { validGeoPoints: number; missingGeoPoints: number; centerLat: number; centerLng: number };
  alerts: TransformerAlert[];
  badges: TransformerSummaryBadge[];
} {
  let validPoints = 0;
  let missingPoints = 0;
  let sumLat = 0;
  let sumLng = 0;

  function visit(n: SkeletonNode) {
    if (n.children.length === 0) {
      const meta = n.meta || {};
      const lat = Number(meta.lat ?? meta.latitude);
      const lng = Number(meta.lng ?? meta.longitude);

      if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
        validPoints++;
        sumLat += lat;
        sumLng += lng;
      } else {
        missingPoints++;
      }
    }
    for (const c of n.children) visit(c);
  }

  for (const root of nodes) visit(root);

  const centerLat = validPoints > 0 ? sumLat / validPoints : 0;
  const centerLng = validPoints > 0 ? sumLng / validPoints : 0;

  const alerts: TransformerAlert[] = [];
  if (missingPoints > 0 && validPoints > 0) {
    alerts.push({
      id: 'geo_missing_coords',
      level: 'info',
      title: 'Pontos Sem Coordenadas',
      message: `${missingPoints} nós terminais não possuem latitude/longitude para plotagem no mapa tático.`,
    });
  }

  const badges: TransformerSummaryBadge[] = [
    {
      id: 'geo_points',
      label: 'Pontos Geo',
      value: validPoints,
      sublabel: `${missingPoints} sem coordenadas`,
      color: '#6366F1',
    },
  ];

  return {
    metrics: { validGeoPoints: validPoints, missingGeoPoints: missingPoints, centerLat, centerLng },
    alerts,
    badges,
  };
}

/**
 * 3. Roster Conflicts & Anti-Double-Booking Math
 */
function computeRosterConflicts(nodes: SkeletonNode[]): {
  metrics: { conflictsDetected: number; totalAssignments: number; uniqueAssignees: number };
  alerts: TransformerAlert[];
  badges: TransformerSummaryBadge[];
} {
  const assigneeSlots: Map<string, { key: string; name: string; time?: string; room?: string }[]> = new Map();
  let totalAssignments = 0;

  function visit(n: SkeletonNode) {
    const meta = (n.meta || {}) as Record<string, any>;
    const person = String(meta.responsavel || meta.assignedTo || n.value || '').trim();
    if (person && person !== '0' && person !== '1') {
      totalAssignments++;
      const time = meta.horario_inicio ? String(meta.horario_inicio) : meta.horario ? String(meta.horario) : meta.time ? String(meta.time) : undefined;
      const room = meta.sala ? String(meta.sala) : meta.room ? String(meta.room) : undefined;
      const existing = assigneeSlots.get(person) || [];
      existing.push({ key: n.key, name: n.label, time, room });
      assigneeSlots.set(person, existing);
    }
    for (const c of n.children) visit(c);
  }

  for (const root of nodes) visit(root);

  const alerts: TransformerAlert[] = [];
  let conflictsCount = 0;

  for (const [person, slots] of assigneeSlots.entries()) {
    if (slots.length > 1) {
      // Check for simultaneous time or general multiple-booking
      const sameTime = slots.filter((s, idx) => slots.some((other, oIdx) => idx !== oIdx && s.time && s.time === other.time));
      if (sameTime.length > 0) {
        conflictsCount++;
        alerts.push({
          id: `conflict_${person}`,
          level: 'critical',
          title: `Double-Booking: ${person}`,
          message: `${person} possui designações simultâneas no mesmo horário (${sameTime[0].time}) nos nós ${sameTime.map((s) => s.key).join(', ')}.`,
          pathKey: sameTime[0].key,
        });
      }
    }
  }

  const badges: TransformerSummaryBadge[] = [
    {
      id: 'roster_conflicts',
      label: 'Conflitos Pessoal',
      value: conflictsCount === 0 ? 'Zero' : `${conflictsCount} Conflito(s)`,
      sublabel: `${assigneeSlots.size} voluntários`,
      color: conflictsCount === 0 ? '#10B981' : '#EF4444',
    },
  ];

  return {
    metrics: { conflictsDetected: conflictsCount, totalAssignments, uniqueAssignees: assigneeSlots.size },
    alerts,
    badges,
  };
}

/**
 * 4. Roster Workload Balance Math
 */
function computeRosterWorkload(nodes: SkeletonNode[]): {
  metrics: { maxAssignmentsPerPerson: number; averageTasks: number; overloadedPersons: string[] };
  alerts: TransformerAlert[];
  badges: TransformerSummaryBadge[];
} {
  const counts: Map<string, number> = new Map();

  function visit(n: SkeletonNode) {
    const meta = (n.meta || {}) as Record<string, any>;
    const person = String(meta.responsavel || meta.assignedTo || '').trim();
    if (person) {
      counts.set(person, (counts.get(person) || 0) + 1);
    }
    for (const c of n.children) visit(c);
  }

  for (const root of nodes) visit(root);

  let maxCount = 0;
  let total = 0;
  const overloaded: string[] = [];

  for (const [person, cnt] of counts.entries()) {
    total += cnt;
    if (cnt > maxCount) maxCount = cnt;
    if (cnt >= 4) overloaded.push(`${person} (${cnt}x)`);
  }

  const avg = counts.size > 0 ? Math.round((total / counts.size) * 10) / 10 : 0;
  const alerts: TransformerAlert[] = [];

  if (overloaded.length > 0) {
    alerts.push({
      id: 'workload_overload',
      level: 'warning',
      title: 'Sobrecarga de Designações',
      message: `Membros com muitas atribuições concentradas: ${overloaded.join(', ')}.`,
    });
  }

  const badges: TransformerSummaryBadge[] = [
    {
      id: 'workload_avg',
      label: 'Média de Carga',
      value: `${avg} tarefas/pessoa`,
      sublabel: `Máximo: ${maxCount}`,
      color: maxCount > 3 ? '#F59E0B' : '#10B981',
    },
  ];

  return {
    metrics: { maxAssignmentsPerPerson: maxCount, averageTasks: avg, overloadedPersons: overloaded },
    alerts,
    badges,
  };
}

/**
 * 5. Run-of-Show Timing & Cumulative Drift Math
 */
function computeRunOfShowTiming(
  nodes: SkeletonNode[],
  warningDriftSec = 60
): {
  metrics: { totalPlannedSec: number; totalActualSec: number; cumulativeDriftSec: number; hardOutThreatened: boolean };
  alerts: TransformerAlert[];
  badges: TransformerSummaryBadge[];
} {
  let planned = 0;
  let actual = 0;
  let hardOutThreatened = false;

  function visit(n: SkeletonNode) {
    const meta = n.meta || {};
    const pSec = Number(meta.duracao_planejada_seg ?? meta.plannedDurationSec ?? 0);
    const aSec = Number(meta.duracao_real_seg ?? meta.actualDurationSec ?? pSec);
    const constraint = meta.ancora_hard || meta.timingConstraint;

    planned += pSec;
    actual += aSec;

    if (constraint === 'HARD_OUT' && actual > planned) {
      hardOutThreatened = true;
    }

    for (const c of n.children) visit(c);
  }

  for (const root of nodes) visit(root);

  const drift = actual - planned;
  const alerts: TransformerAlert[] = [];

  if (Math.abs(drift) >= warningDriftSec) {
    alerts.push({
      id: 'ros_drift_warning',
      level: drift > 0 ? 'critical' : 'warning',
      title: drift > 0 ? 'Show Atrasado (Drift Positivo)' : 'Show Adiantado (Drift Negativo)',
      message: `Desvio cumulativo atual de ${drift > 0 ? '+' : ''}${drift} segundos (${Math.round(drift / 60)} min).`,
    });
  }

  if (hardOutThreatened) {
    alerts.push({
      id: 'hard_out_breach',
      level: 'critical',
      title: 'Âncora HARD_OUT Ameaçada!',
      message: 'O desvio acumulado ultrapassa a margem de segurança do encerramento fixo.',
    });
  }

  const sign = drift > 0 ? '+' : '';
  const badges: TransformerSummaryBadge[] = [
    {
      id: 'ros_drift',
      label: 'Desvio Run-of-Show',
      value: `${sign}${drift}s`,
      sublabel: `Planejado: ${Math.round(planned / 60)}m | Real: ${Math.round(actual / 60)}m`,
      color: Math.abs(drift) < warningDriftSec ? '#10B981' : drift > 0 ? '#EF4444' : '#3B82F6',
    },
  ];

  return {
    metrics: { totalPlannedSec: planned, totalActualSec: actual, cumulativeDriftSec: drift, hardOutThreatened },
    alerts,
    badges,
  };
}

/**
 * 6. Graicunas Cognitive Span Math (FEMA ICS / NIMS)
 */
function computeGraicunasSpan(
  nodes: SkeletonNode[],
  maxLimit = 7
): {
  metrics: { spanBreaches: number; maxDirectSubordinates: number; totalSupervisorNodes: number };
  alerts: TransformerAlert[];
  badges: TransformerSummaryBadge[];
} {
  let breaches = 0;
  let maxSubordinates = 0;
  let supervisors = 0;
  const breachNodes: string[] = [];

  function visit(n: SkeletonNode) {
    const count = n.children.length;
    if (count > 0) {
      supervisors++;
      if (count > maxSubordinates) maxSubordinates = count;

      if (count > maxLimit) {
        breaches++;
        // Graicunas formula: R = n * (2^(n - 1) + n - 1)
        const graicunasR = count * (Math.pow(2, count - 1) + count - 1);
        breachNodes.push(`${n.label} (${count} subordinados, ${graicunasR} relações)`);
      }
    }
    for (const c of n.children) visit(c);
  }

  for (const root of nodes) visit(root);

  const alerts: TransformerAlert[] = [];
  if (breaches > 0) {
    alerts.push({
      id: 'graicunas_overload',
      level: 'critical',
      title: 'Sobrecarga de Graicunas (Span of Control)',
      message: `${breaches} nó(s) excedem o limite de ${maxLimit} subordinados diretos: ${breachNodes.join('; ')}.`,
    });
  }

  const badges: TransformerSummaryBadge[] = [
    {
      id: 'graicunas_span',
      label: 'Span de Controle',
      value: breaches === 0 ? 'Saudável' : `${breaches} Gargalo(s)`,
      sublabel: `Máx: ${maxSubordinates} subordinados`,
      color: breaches === 0 ? '#10B981' : '#EF4444',
    },
  ];

  return {
    metrics: { spanBreaches: breaches, maxDirectSubordinates: maxSubordinates, totalSupervisorNodes: supervisors },
    alerts,
    badges,
  };
}

/**
 * 7. Weighted WBS Progress Math
 */
function computeWeightedWBS(nodes: SkeletonNode[]): {
  metrics: { totalEstimatedHours: number; weightedProgressPercent: number; leafCount: number };
  alerts: TransformerAlert[];
  badges: TransformerSummaryBadge[];
} {
  let totalHours = 0;
  let weightedProgressSum = 0;
  let leaves = 0;

  function visit(n: SkeletonNode) {
    if (n.children.length === 0) {
      leaves++;
      const meta = n.meta || {};
      const hours = Number(meta.estimativa_horas ?? meta.estimatedHours ?? 8);
      const prog = Number(meta.progresso_pct ?? meta.progressPercent ?? (n.value === '1' ? 100 : 0));

      totalHours += hours;
      weightedProgressSum += (prog / 100) * hours;
    }
    for (const c of n.children) visit(c);
  }

  for (const root of nodes) visit(root);

  const overallPercent =
    totalHours > 0 ? Math.round((weightedProgressSum / totalHours) * 1000) / 10 : 0;

  const alerts: TransformerAlert[] = [];
  const badges: TransformerSummaryBadge[] = [
    {
      id: 'wbs_weighted_progress',
      label: 'Progresso Ponderado',
      value: `${overallPercent}%`,
      sublabel: `${totalHours} horas estimadas no projeto`,
      color: overallPercent >= 80 ? '#10B981' : overallPercent >= 40 ? '#F59E0B' : '#3B82F6',
    },
  ];

  return {
    metrics: { totalEstimatedHours: totalHours, weightedProgressPercent: overallPercent, leafCount: leaves },
    alerts,
    badges,
  };
}

/**
 * 8. Tournament Score & Rematch Invariant Math
 */
function computeTournamentMath(nodes: SkeletonNode[]): {
  metrics: { totalMatches: number; rematchesDetected: number; activeContestants: number };
  alerts: TransformerAlert[];
  badges: TransformerSummaryBadge[];
} {
  let matches = 0;
  let rematches = 0;
  const matchPairs = new Set<string>();
  const contestants = new Set<string>();

  function visit(n: SkeletonNode) {
    const meta = (n.meta || {}) as Record<string, any>;
    const a = String(meta.jogador_a || meta.contestantA || '').trim();
    const b = String(meta.jogador_b || meta.contestantB || '').trim();

    if (a && b) {
      matches++;
      contestants.add(a);
      contestants.add(b);

      const pairKey = [a, b].sort().join(' vs ');
      if (matchPairs.has(pairKey)) {
        rematches++;
      } else {
        matchPairs.add(pairKey);
      }
    }
    for (const c of n.children) visit(c);
  }

  for (const root of nodes) visit(root);

  const alerts: TransformerAlert[] = [];
  if (rematches > 0) {
    alerts.push({
      id: 'tournament_rematch_warning',
      level: 'warning',
      title: 'Revanche Detectada no Torneio',
      message: `${rematches} confronto(s) já ocorreram em rodadas anteriores (invariante do Sistema Suíço violada).`,
    });
  }

  const badges: TransformerSummaryBadge[] = [
    {
      id: 'tournament_matches',
      label: 'Partidas / Chaves',
      value: matches,
      sublabel: `${contestants.size} competidores (${rematches} revanches)`,
      color: rematches === 0 ? '#10B981' : '#F59E0B',
    },
  ];

  return {
    metrics: { totalMatches: matches, rematchesDetected: rematches, activeContestants: contestants.size },
    alerts,
    badges,
  };
}

/**
 * 9. Study Synthesis Executive Summary Math
 */
function computeSynthesisMath(nodes: SkeletonNode[]): {
  metrics: { totalTopics: number; submittedCount: number; pendingCount: number; completionPercent: number };
  alerts: TransformerAlert[];
  badges: TransformerSummaryBadge[];
} {
  let totalTopics = 0;
  let submitted = 0;

  function visit(n: SkeletonNode) {
    if (n.children.length === 0) {
      totalTopics++;
      const meta = (n.meta || {}) as Record<string, any>;
      const synthesis = String(meta.sintese || meta.synthesisText || '').trim();
      if (synthesis.length > 0) {
        submitted++;
      }
    }
    for (const c of n.children) visit(c);
  }

  for (const root of nodes) visit(root);

  const completionPercent =
    totalTopics > 0 ? Math.round((submitted / totalTopics) * 1000) / 10 : 0;

  const alerts: TransformerAlert[] = [];
  if (submitted < totalTopics) {
    alerts.push({
      id: 'synthesis_pending',
      level: 'info',
      title: 'Sínteses em Andamento',
      message: `${totalTopics - submitted} tópicos aguardando envio da síntese individual para consolidar o relatório final.`,
    });
  }

  const badges: TransformerSummaryBadge[] = [
    {
      id: 'synthesis_completion',
      label: 'Sínteses Coletivas',
      value: `${completionPercent}%`,
      sublabel: `${submitted}/${totalTopics} entregues`,
      color: completionPercent >= 100 ? '#10B981' : '#8B5CF6',
    },
  ];

  return {
    metrics: { totalTopics, submittedCount: submitted, pendingCount: totalTopics - submitted, completionPercent },
    alerts,
    badges,
  };
}

/**
 * 10. Canvassing Funnel Math
 */
function computeCanvassingMath(nodes: SkeletonNode[]): {
  metrics: { totalDoors: number; contactedCount: number; notHomeCount: number; refusedCount: number; contactRatePercent: number };
  alerts: TransformerAlert[];
  badges: TransformerSummaryBadge[];
} {
  let totalDoors = 0;
  let contacted = 0;
  let notHome = 0;
  let refused = 0;

  function visit(n: SkeletonNode) {
    if (n.children.length === 0) {
      totalDoors++;
      const meta = (n.meta || {}) as Record<string, any>;
      const code = String(meta.contato_status || meta.contactCode || '').toUpperCase().trim();

      if (code === 'CNT' || code === 'CONTATADO') contacted++;
      else if (code === 'REF' || code === 'RECUSADO') refused++;
      else notHome++;
    }
    for (const c of n.children) visit(c);
  }

  for (const root of nodes) visit(root);

  const rate = totalDoors > 0 ? Math.round((contacted / totalDoors) * 1000) / 10 : 0;

  const alerts: TransformerAlert[] = [];
  const badges: TransformerSummaryBadge[] = [
    {
      id: 'canvassing_rate',
      label: 'Taxa de Contato',
      value: `${rate}%`,
      sublabel: `${contacted} contatados / ${totalDoors} portas`,
      color: rate >= 40 ? '#10B981' : '#F59E0B',
    },
  ];

  return {
    metrics: { totalDoors, contactedCount: contacted, notHomeCount: notHome, refusedCount: refused, contactRatePercent: rate },
    alerts,
    badges,
  };
}

// ---------------------------------------------------------------------------
// Unified Transformer Metrics Calculator
// ---------------------------------------------------------------------------

/**
 * Traverses the skeleton tree and executes ONLY the user-activated mathematical laws.
 */
export function calculateTransformerMetrics(
  tree: SkeletonNode[],
  config: TransformerConfig = DEFAULT_TRANSFORMER_CONFIG
): TransformerMetrics {
  let totalNodes = 0;
  let leafNodes = 0;

  function count(n: SkeletonNode) {
    totalNodes++;
    if (n.children.length === 0) leafNodes++;
    for (const c of n.children) count(c);
  }
  for (const r of tree) count(r);

  const activeModules = config.activeMathModules || [];
  const moduleResults: Record<string, any> = {};
  const allAlerts: TransformerAlert[] = [];
  const allBadges: TransformerSummaryBadge[] = [];

  // Default Node Count Badge
  allBadges.push({
    id: 'nodes_summary',
    label: 'Total de Nós',
    value: totalNodes,
    sublabel: `${leafNodes} folhas | ${activeModules.length} leis ativas`,
    color: '#94A3B8',
  });

  for (const modId of activeModules) {
    switch (modId) {
      case 'coverage_rollup': {
        const res = computeCoverageRollup(tree);
        moduleResults[modId] = res.metrics;
        allAlerts.push(...res.alerts);
        allBadges.push(...res.badges);
        break;
      }
      case 'geo_proximity': {
        const res = computeGeoProximity(tree);
        moduleResults[modId] = res.metrics;
        allAlerts.push(...res.alerts);
        allBadges.push(...res.badges);
        break;
      }
      case 'roster_conflicts': {
        const res = computeRosterConflicts(tree);
        moduleResults[modId] = res.metrics;
        allAlerts.push(...res.alerts);
        allBadges.push(...res.badges);
        break;
      }
      case 'roster_workload': {
        const res = computeRosterWorkload(tree);
        moduleResults[modId] = res.metrics;
        allAlerts.push(...res.alerts);
        allBadges.push(...res.badges);
        break;
      }
      case 'run_of_show_timing': {
        const res = computeRunOfShowTiming(tree, config.parameters?.timingWarningDriftSec);
        moduleResults[modId] = res.metrics;
        allAlerts.push(...res.alerts);
        allBadges.push(...res.badges);
        break;
      }
      case 'graicunas_span': {
        const res = computeGraicunasSpan(tree, config.parameters?.maxSpanOfControl);
        moduleResults[modId] = res.metrics;
        allAlerts.push(...res.alerts);
        allBadges.push(...res.badges);
        break;
      }
      case 'weighted_wbs': {
        const res = computeWeightedWBS(tree);
        moduleResults[modId] = res.metrics;
        allAlerts.push(...res.alerts);
        allBadges.push(...res.badges);
        break;
      }
      case 'tournament_score': {
        const res = computeTournamentMath(tree);
        moduleResults[modId] = res.metrics;
        allAlerts.push(...res.alerts);
        allBadges.push(...res.badges);
        break;
      }
      case 'synthesis_summary': {
        const res = computeSynthesisMath(tree);
        moduleResults[modId] = res.metrics;
        allAlerts.push(...res.alerts);
        allBadges.push(...res.badges);
        break;
      }
      case 'canvassing_funnel': {
        const res = computeCanvassingMath(tree);
        moduleResults[modId] = res.metrics;
        allAlerts.push(...res.alerts);
        allBadges.push(...res.badges);
        break;
      }
    }
  }

  return {
    totalNodes,
    leafNodes,
    activeModules,
    moduleResults,
    alerts: allAlerts,
    summaryBadges: allBadges,
  };
}

// ---------------------------------------------------------------------------
// Engine Definition Contract
// ---------------------------------------------------------------------------

export const transformerEngine: EventEngine = {
  id: 'transformer',
  name: 'Engine Transformer (Metamórfica & Universal)',
  description:
    'Motor metamórfico dinâmico que permite personalizar colunas do CSV e ligar/desligar todas as Leis Matemáticas das outras engines sob demanda a qualquer instante.',
  icon: 'tune-variant',
  allowedNodeTypes: ['header', 'slot', 'territory', 'note'],

  defaultNodeTypeForDepth: (depth: number): NodeType => {
    if (depth <= 2) return 'header';
    return 'slot';
  },

  validateNode: () => {
    return { valid: true, errors: [] };
  },

  calculateMetrics: (tree: SkeletonNode[]): EngineMetrics => {
    const data = calculateTransformerMetrics(tree, DEFAULT_TRANSFORMER_CONFIG);
    return {
      engineId: 'transformer',
      data,
    };
  },

  supportedExports: ['csv', 'xlsx', 'pdf', 'yaml', 'geojson'],
};
