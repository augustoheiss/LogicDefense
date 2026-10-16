/**
 * Sekundo — CSV Universal Engine Auto-Detector
 *
 * Inspects CSV headers, metadata, and cell values to automatically classify
 * and recommend one or multiple matching Universal Engines ("Universal Laws").
 * Supports composite / multi-engine events (e.g., an event combining territory
 * field management with volunteer roster assignments).
 */

import type { EngineId } from '../engines/types';

export interface DetectedEngineMatch {
  engineId: EngineId;
  name: string;
  confidence: number; // 0 to 100
  reasons: string[];
}

export interface EngineDetectionReport {
  primaryEngine: EngineId;
  suggestedEngines: EngineId[];
  isMultiEngineCandidate: boolean;
  matches: DetectedEngineMatch[];
  summary: string;
}

function stripAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

/**
 * Detects matching Universal Engines from a raw CSV string.
 */
export function detectEnginesFromCSV(csvText: string): EngineDetectionReport {
  if (!csvText || csvText.trim() === '') {
    return {
      primaryEngine: 'generic_wbs',
      suggestedEngines: ['generic_wbs'],
      isMultiEngineCandidate: false,
      matches: [],
      summary: 'CSV vazio. Padrão: Estrutura Livre (WBS Universal).',
    };
  }

  // Extract first 15 lines for analysis
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim() !== '').slice(0, 20);
  if (lines.length === 0) {
    return {
      primaryEngine: 'generic_wbs',
      suggestedEngines: ['generic_wbs'],
      isMultiEngineCandidate: false,
      matches: [],
      summary: 'Nenhuma linha encontrada. Padrão: Estrutura Livre.',
    };
  }

  // Parse header tokens
  const headerLine = lines[0];
  const delim = headerLine.includes(';') && !headerLine.includes(',') ? ';' : ',';
  const headers = headerLine
    .split(delim)
    .map((h) => stripAccents(h.replace(/^["']|["']$/g, '').trim()));

  const headerSet = new Set(headers);
  const sampleBody = stripAccents(lines.slice(1).join(' '));
  const normalizedBody = sampleBody.replace(/["'\\]/g, '');

  // Score tracking per engine
  const scores: Record<EngineId, { confidence: number; reasons: string[] }> = {
    territory_logistics: { confidence: 0, reasons: [] },
    roster_assignments: { confidence: 0, reasons: [] },
    study_synthesis: { confidence: 0, reasons: [] },
    incident_command: { confidence: 0, reasons: [] },
    live_production_ros: { confidence: 0, reasons: [] },
    tournament_pairings: { confidence: 0, reasons: [] },
    canvassing_logistics: { confidence: 0, reasons: [] },
    generic_wbs: { confidence: 15, reasons: ['Compatível com qualquer hierarquia tabular'] },
    transformer: { confidence: 0, reasons: [] },
  };

  // Helper check
  const hasHeader = (...candidates: string[]): boolean => {
    return candidates.some((c) => headerSet.has(c) || headers.some((h) => h.includes(c)));
  };

  const bodyContains = (...terms: string[]): boolean => {
    return terms.some((t) => {
      const cleanTerm = t.replace(/["'\\]/g, '');
      return sampleBody.includes(t) || normalizedBody.includes(cleanTerm);
    });
  };

  // 1. Territory Logistics
  if (hasHeader('latitude', 'lat', 'longitude', 'lng')) {
    scores.territory_logistics.confidence += 45;
    scores.territory_logistics.reasons.push('Contém colunas de coordenadas geográficas (lat/lng)');
  }
  if (hasHeader('trabalhado', 'worked', 'lastworkedat', 'workername')) {
    scores.territory_logistics.confidence += 35;
    scores.territory_logistics.reasons.push('Contém status de cobertura de campo (trabalhado/worked)');
  }
  if (hasHeader('endereco', 'address', 'quadra', 'bairro', 'rua', 'logradouro')) {
    scores.territory_logistics.confidence += 20;
    scores.territory_logistics.reasons.push('Identificação de endereços e quadras territoriais');
  }
  if (bodyContains('"lat":', '"lng":', '"worked":', 'quadra', 'territorio')) {
    scores.territory_logistics.confidence += 25;
    scores.territory_logistics.reasons.push('Metadados ou rótulos territoriais detectados no corpo');
  }

  // 2. Roster Assignments
  if (hasHeader('designado', 'assignedto', 'orador', 'leitor', 'presidente', 'speaker', 'atribuido')) {
    scores.roster_assignments.confidence += 40;
    scores.roster_assignments.reasons.push('Contém designação de pessoas para funções/partes');
  }
  if (hasHeader('sala', 'room', 'duracao_min', 'durationminutes', 'duracao')) {
    scores.roster_assignments.confidence += 25;
    scores.roster_assignments.reasons.push('Especificação de salas e durações de discursos/tarefas');
  }
  if (hasHeader('confirmado', 'confirmed', 'assistente', 'assistantto', 'substituto', 'substitute')) {
    scores.roster_assignments.confidence += 25;
    scores.roster_assignments.reasons.push('Controle de confirmação e assistentes/substitutos');
  }
  if (bodyContains('"assignedto":', '"room":', '"durationminutes":', '"duration":')) {
    scores.roster_assignments.confidence += 35;
    scores.roster_assignments.reasons.push('Metadados JSON de funções, salas ou durações detectados');
  }
  if (bodyContains('discurso', 'orador', 'leitor', 'auditorio', 'presidente')) {
    scores.roster_assignments.confidence += 25;
    scores.roster_assignments.reasons.push('Termos de sessões e escalas de participantes detectados');
  }

  // 3. Study & Synthesis
  if (hasHeader('pesquisador', 'researchername', 'sintese', 'synthesistext')) {
    scores.study_synthesis.confidence += 45;
    scores.study_synthesis.reasons.push('Campos de pesquisador e texto de síntese identificados');
  }
  if (hasHeader('principais_achados', 'keyfindings', 'referencias', 'references')) {
    scores.study_synthesis.confidence += 35;
    scores.study_synthesis.reasons.push('Campos de achados-chave e citações bibliográficas');
  }
  if (bodyContains('"synthesistext":', '"keyfindings":', '"researchername":')) {
    scores.study_synthesis.confidence += 35;
    scores.study_synthesis.reasons.push('Metadados JSON de síntese e achados de pesquisa detectados');
  }
  if (bodyContains('submitted', 'reviewed', 'in_progress', 'simposio')) {
    scores.study_synthesis.confidence += 25;
    scores.study_synthesis.reasons.push('Metadados de status e relatórios de síntese detectados');
  }

  // 4. Incident Command (ICS)
  if (hasHeader('funcao_ics', 'icsrole', 'incident_commander', 'safety_officer', 'operacoes', 'radio')) {
    scores.incident_command.confidence += 45;
    scores.incident_command.reasons.push('Cargos regulamentados FEMA ICS ou canais de rádio táticos');
  }
  if (hasHeader('radiochannel', 'efetivo', 'allocatedpersonnel', 'periodo_operacional')) {
    scores.incident_command.confidence += 35;
    scores.incident_command.reasons.push('Gestão de contingente de emergência e frequências de rádio');
  }
  if (bodyContains('incident_commander', 'safety_officer', 'ics-201', 'span_of_control', 'defesa civil')) {
    scores.incident_command.confidence += 30;
    scores.incident_command.reasons.push('Vocabulário tático de comando de incidentes reconhecido');
  }

  // 5. Live Production Run-of-Show
  if (hasHeader('duracao_seg', 'planneddurationsec', 'restricao', 'timingconstraint')) {
    scores.live_production_ros.confidence += 45;
    scores.live_production_ros.reasons.push('Temporização em segundos e restrições de tempo (HARD_START/OUT)');
  }
  if (hasHeader('cue_audio', 'audiocue', 'cue_video', 'videocue', 'cue_iluminacao', 'lightingcue', 'pad_buffer')) {
    scores.live_production_ros.confidence += 40;
    scores.live_production_ros.reasons.push('Cues técnicos de áudio, vídeo, iluminação e buffers de régie');
  }
  if (bodyContains('hard_start', 'hard_out', 'padbuffer', 'mic_check', 'green_room', 'vt01')) {
    scores.live_production_ros.confidence += 25;
    scores.live_production_ros.reasons.push('Termos de transmissão e bastidores de palco detectados');
  }

  // 6. Tournament Systems
  if (hasHeader('rodada', 'roundindex', 'mesa', 'boardnumber', 'tabuleiro')) {
    scores.tournament_pairings.confidence += 40;
    scores.tournament_pairings.reasons.push('Identificação de rodadas e mesas de competição');
  }
  if (hasHeader('jogador_a', 'jogador_b', 'contestanta', 'contestantb', 'placar_a', 'placar_b', 'is_bye', 'isbye')) {
    scores.tournament_pairings.confidence += 45;
    scores.tournament_pairings.reasons.push('Confrontos diretos, placares e condição de folga (BYE)');
  }
  if (bodyContains('suico', 'swiss', 'bye', 'kasparov', 'carlsen', 'emparceiramento', 'torneio')) {
    scores.tournament_pairings.confidence += 20;
    scores.tournament_pairings.reasons.push('Padrão de torneios competitivos detectado no conteúdo');
  }

  // 7. Canvassing Logistics
  if (hasHeader('codigo_contato', 'contactcode', 'ordem_rota', 'elotorder')) {
    scores.canvassing_logistics.confidence += 50;
    scores.canvassing_logistics.reasons.push('Códigos de visitação de campanha (CNT/NH/REF) e ordenação eLOT');
  }
  if (bodyContains('cnt', 'nh', 'ref', 'dnc', 'lan', 'vac', 'ina', 'hos')) {
    // Only boost if there are multiple occurrences
    const matchesCount = ['cnt', 'nh', 'ref', 'dnc'].filter((code) => sampleBody.includes(code)).length;
    if (matchesCount >= 2) {
      scores.canvassing_logistics.confidence += 35;
      scores.canvassing_logistics.reasons.push('Códigos universais de canvassing presentes nas células');
    }
  }

  // 8. Generic WBS
  if (hasHeader('wbs', 'fase', 'entregavel', 'tarefa', 'projeto', 'milestone')) {
    scores.generic_wbs.confidence += 50;
    scores.generic_wbs.reasons.push('Terminologia formal de pacotes de trabalho e fases de projeto');
  }

  // 9. Transformer Engine Detection (Explicit keyword or multi-attribute composite)
  if (hasHeader('transformer', 'metamorfico', 'custom', 'personalizado') || bodyContains('transformer', 'metamorfico')) {
    scores.transformer.confidence += 70;
    scores.transformer.reasons.push('Identificador explícito de formato metamórfico Transformer');
  }

  let activeDomainCount = 0;
  if (scores.territory_logistics.confidence >= 25) activeDomainCount++;
  if (scores.roster_assignments.confidence >= 25) activeDomainCount++;
  if (scores.live_production_ros.confidence >= 25) activeDomainCount++;
  if (scores.incident_command.confidence >= 25) activeDomainCount++;
  if (scores.tournament_pairings.confidence >= 25) activeDomainCount++;
  if (scores.study_synthesis.confidence >= 25) activeDomainCount++;
  if (scores.canvassing_logistics.confidence >= 25) activeDomainCount++;

  if (activeDomainCount >= 2) {
    scores.transformer.confidence = Math.max(scores.transformer.confidence, 45 + activeDomainCount * 10);
    scores.transformer.reasons.push(
      `Esquema híbrido combinando ${activeDomainCount} domínios matemáticos simultâneos`
    );
  }

  // Normalize scores and sort
  const engineNames: Record<EngineId, string> = {
    territory_logistics: 'Logística de Territórios & Visitas',
    roster_assignments: 'Escalas & Designações de Pessoal',
    study_synthesis: 'Síntese de Estudos & Pesquisa',
    generic_wbs: 'Estrutura Livre & WBS Universal',
    incident_command: 'Comando de Incidentes (FEMA ICS)',
    live_production_ros: 'Produção ao Vivo & Run-of-Show',
    tournament_pairings: 'Emparelhamento de Torneios',
    canvassing_logistics: 'Canvassing & Campanhas de Campo',
    transformer: 'Engine Transformer (Metamórfica & Universal)',
  };

  const matches: DetectedEngineMatch[] = (Object.keys(scores) as EngineId[])
    .map((engineId) => {
      const entry = scores[engineId];
      const capped = Math.min(100, Math.max(0, entry.confidence));
      return {
        engineId,
        name: engineNames[engineId],
        confidence: capped,
        reasons: entry.reasons,
      };
    })
    .sort((a, b) => b.confidence - a.confidence);

  // Highest match
  const bestMatch = matches[0];
  const primaryEngine: EngineId = bestMatch.confidence >= 25 ? bestMatch.engineId : 'generic_wbs';

  // Multi-engine candidates: any additional engines with >= 40% confidence
  const highConfidenceMatches = matches.filter((m) => m.confidence >= 40);
  const isMultiEngineCandidate = highConfidenceMatches.length > 1;
  const suggestedEngines = highConfidenceMatches.length > 0
    ? highConfidenceMatches.map((m) => m.engineId)
    : [primaryEngine];

  let summary = `Engine recomendada: ${engineNames[primaryEngine]} (${bestMatch.confidence}% de aderência).`;
  if (isMultiEngineCandidate) {
    const names = suggestedEngines.map((id) => engineNames[id]).join(' + ');
    summary = `Detectado perfil de Múltiplas Engines (${names}). O evento pode ativar essas leis em conjunto.`;
  }

  return {
    primaryEngine,
    suggestedEngines,
    isMultiEngineCandidate,
    matches,
    summary,
  };
}
