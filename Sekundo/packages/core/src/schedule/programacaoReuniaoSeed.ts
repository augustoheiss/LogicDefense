/**
 * Sekundo — Operational Schedule & Multi-Cycle Territory Seed Data (Oct–Dec 2026)
 *
 * Contains:
 * 1. The 16 synthetic/generic participants organized across Grupo 1, Grupo 2, and Grupo 3.
 * 2. The 9-week schedule (Oct 9 to Dec 4, 2026) with 100% domain-agnostic operational titles.
 * 3. Multi-cycle Territory Assignment Records (2026 & 2027) for 4-column ledger testing.
 * 4. Agnostic JSON/Text bundle loader so external schedules can be imported without
 *    hardcoding personal or domain-specific data into the engine.
 *
 * Skills: agency-backend-architect, agency-data-engineer
 */

import type { FlatSkeletonEntry } from '../skeleton/types';
import type { ParticipantProfile } from '../roster/participantDirectory';
import { enrichRegistryWithDirectory, findParticipantProfile } from '../roster/participantDirectory';
import { parseProgramScheduleText } from './scheduleParser';
import type { TerritoryAssignmentCycle } from '../engines/types';

export const PROGRAMACAO_UNIT_NAME = 'Unidade Operacional Demo';

export const PROGRAMACAO_PARTICIPANT_DIRECTORY: ParticipantProfile[] = [
  // --- GRUPO 1 (6 integrantes sintéticos) ---
  {
    id: 'p-01',
    name: 'Participante 01',
    groupTag: 'Grupo 1',
    capabilityTags: ['Coordenação', 'Apresentador', 'Supervisor'],
  },
  {
    id: 'p-02',
    name: 'Participante 02',
    groupTag: 'Grupo 1',
    capabilityTags: ['Titular', 'Parceiro'],
  },
  {
    id: 'p-03',
    name: 'Participante 03',
    groupTag: 'Grupo 1',
    capabilityTags: ['Coordenação', 'Apresentador', 'Relator', 'Titular'],
  },
  {
    id: 'p-04',
    name: 'Participante 04',
    groupTag: 'Grupo 1',
    capabilityTags: ['Titular', 'Parceiro'],
  },
  {
    id: 'p-05',
    name: 'Participante 05',
    groupTag: 'Grupo 1',
    capabilityTags: ['Apresentador', 'Relator', 'Titular', 'Parceiro'],
  },
  {
    id: 'p-06',
    name: 'Participante 06',
    groupTag: 'Grupo 1',
    capabilityTags: ['Titular', 'Parceiro'],
  },

  // --- GRUPO 2 (5 integrantes sintéticos) ---
  {
    id: 'p-07',
    name: 'Participante 07',
    groupTag: 'Grupo 2',
    capabilityTags: ['Coordenação', 'Apresentador', 'Supervisor'],
  },
  {
    id: 'p-08',
    name: 'Participante 08',
    groupTag: 'Grupo 2',
    capabilityTags: ['Titular', 'Parceiro', 'Supervisor'],
  },
  {
    id: 'p-09',
    name: 'Participante 09',
    groupTag: 'Grupo 2',
    capabilityTags: ['Apresentador', 'Relator', 'Titular', 'Parceiro'],
  },
  {
    id: 'p-10',
    name: 'Participante 10',
    groupTag: 'Grupo 2',
    capabilityTags: ['Apresentador', 'Relator', 'Titular', 'Parceiro'],
  },
  {
    id: 'p-11',
    name: 'Participante 11',
    groupTag: 'Grupo 2',
    capabilityTags: ['Titular', 'Parceiro'],
  },

  // --- GRUPO 3 (5 integrantes sintéticos) ---
  {
    id: 'p-12',
    name: 'Participante 12',
    groupTag: 'Grupo 3',
    capabilityTags: ['Coordenação', 'Apresentador', 'Supervisor'],
  },
  {
    id: 'p-13',
    name: 'Participante 13',
    groupTag: 'Grupo 3',
    capabilityTags: ['Apresentador', 'Relator', 'Titular', 'Parceiro'],
  },
  {
    id: 'p-14',
    name: 'Participante 14',
    groupTag: 'Grupo 3',
    capabilityTags: ['Titular', 'Parceiro'],
  },
  {
    id: 'p-15',
    name: 'Participante 15',
    groupTag: 'Grupo 3',
    capabilityTags: ['Titular', 'Parceiro'],
  },
  {
    id: 'p-16',
    name: 'Participante 16',
    groupTag: 'Grupo 3',
    capabilityTags: ['Apresentador', 'Relator', 'Titular'],
  },
];

export const RAW_PROGRAMACAO_2026_10_AND_11_TEXT = `
9 de outubro de 2026 | MÓDULO 40, 41 Presidente Participante 12
Vinheta 01: Abertura de Sessão | Credenciamento Participante 03
BLOCO 1 — FUNDAMENTOS E ANÁLISE
1. Diretrizes e Fundamentos do Ciclo (10 mins.) Participante 01
2. Análise de Indicadores e Metas (10 mins.) Participante 07
3. Leitura Técnica de Referência (4 mins.) Participante 10
BLOCO 2 — PRÁTICA E COMUNICAÇÃO
4. Simulação de Atendimento Inicial (3 mins.) Participante 13 / Participante 05
5. Prática de Acompanhamento Operacional (4 mins.) Participante 08 / Participante 02
6. Apresentação de Caso Prático (5 mins.) Participante 16
BLOCO 3 — APLICAÇÃO E SÍNTESE
Intervalo Técnico 01: Transição de Painel
7. Análise Operacional da Unidade (15 mins.) Participante 03
8. Revisão de Procedimentos em Equipe (30 mins.) Participante 12 / Participante 09
Vinheta 02: Encerramento de Sessão | Síntese Final Participante 07

16 de outubro de 2026 | MÓDULO 42, 43 Presidente Participante 01
Vinheta 03: Abertura de Sessão | Credenciamento Participante 05
BLOCO 1 — FUNDAMENTOS E ANÁLISE
1. Planejamento Estratégico e Escopo (10 mins.) Participante 12
2. Análise de Indicadores e Metas (10 mins.) Participante 03
3. Leitura Técnica de Referência (4 mins.) Participante 09
BLOCO 2 — PRÁTICA E COMUNICAÇÃO
4. Simulação de Atendimento Inicial (3 mins.) Participante 04 / Participante 14
5. Prática de Acompanhamento Operacional (4 mins.) Participante 11 / Participante 06
6. Dinâmica de Resolução de Cenários (5 mins.) Participante 15 / Participante 08
BLOCO 3 — APLICAÇÃO E SÍNTESE
Intervalo Técnico 02: Transição de Painel
7. Alinhamento de Metas Trimestrais (15 mins.) Participante 07
8. Revisão de Procedimentos em Equipe (30 mins.) Participante 01 / Participante 10
Vinheta 04: Encerramento de Sessão | Síntese Final Participante 16

23 de outubro de 2026 | MÓDULO 44, 45 Presidente Participante 07
Vinheta 05: Abertura de Sessão | Credenciamento Participante 13
BLOCO 1 — FUNDAMENTOS E ANÁLISE
1. Gestão de Qualidade e Conformidade (10 mins.) Participante 03
2. Análise de Indicadores e Metas (10 mins.) Participante 01
3. Leitura Técnica de Referência (4 mins.) Participante 16
BLOCO 2 — PRÁTICA E COMUNICAÇÃO
4. Simulação de Atendimento Inicial (3 mins.) Participante 02 / Participante 04
5. Prática de Acompanhamento Operacional (4 mins.) Participante 14 / Participante 15
6. Apresentação de Caso Prático (5 mins.) Participante 05
BLOCO 3 — APLICAÇÃO E SÍNTESE
Intervalo Técnico 03: Transição de Painel
7. Relatório de Cobertura Territorial (15 mins.) Participante 12
8. Revisão de Procedimentos em Equipe (30 mins.) Participante 07 / Participante 13
Vinheta 06: Encerramento de Sessão | Síntese Final Participante 09

30 de outubro de 2026 | MÓDULO 46, 47 Presidente Participante 03
Vinheta 07: Abertura de Sessão | Credenciamento Participante 10
BLOCO 1 — FUNDAMENTOS E ANÁLISE
1. Protocolos de Segurança Operacional (10 mins.) Participante 07
2. Análise de Indicadores e Metas (10 mins.) Participante 12
3. Leitura Técnica de Referência (4 mins.) Participante 05
BLOCO 2 — PRÁTICA E COMUNICAÇÃO
4. Simulação de Atendimento Inicial (3 mins.) Participante 06 / Participante 11
5. Prática de Acompanhamento Operacional (4 mins.) Participante 09 / Participante 10
6. Dinâmica de Resolução de Cenários (5 mins.) Participante 08 / Participante 04
BLOCO 3 — APLICAÇÃO E SÍNTESE
Intervalo Técnico 04: Transição de Painel
7. Demandas Locais da Unidade (15 mins.) Participante 01
8. Revisão de Procedimentos em Equipe (30 mins.) Participante 03 / Participante 16
Vinheta 08: Encerramento de Sessão | Síntese Final Participante 12

6 de novembro de 2026 | MÓDULO 48, 49 Presidente Participante 12
Vinheta 09: Abertura de Sessão | Credenciamento Participante 01
BLOCO 1 — FUNDAMENTOS E ANÁLISE
1. Comunicação Clara em Equipes Operacionais (10 mins.) Participante 01
2. Análise de Indicadores e Metas (10 mins.) Participante 07
3. Leitura Técnica de Referência (4 mins.) Participante 13
BLOCO 2 — PRÁTICA E COMUNICAÇÃO
4. Simulação de Atendimento Inicial (3 mins.) Participante 15 / Participante 02
5. Prática de Acompanhamento Operacional (4 mins.) Participante 04 / Participante 08
6. Dinâmica de Resolução de Cenários (5 mins.) Participante 14 / Participante 06
BLOCO 3 — APLICAÇÃO E SÍNTESE
Intervalo Técnico 05: Transição de Painel
7. Avaliação de Desempenho Semanal (15 mins.) Participante 03
8. Revisão de Procedimentos em Equipe (30 mins.) Participante 12 / Participante 05
Vinheta 10: Encerramento de Sessão | Síntese Final Participante 03

13 de novembro de 2026 | MÓDULO 50, 51 Presidente Participante 01
Vinheta 11: Abertura de Sessão | Credenciamento Participante 16
BLOCO 1 — FUNDAMENTOS E ANÁLISE
1. Resiliência e Continuidade de Serviço (10 mins.) Participante 12
2. Análise de Indicadores e Metas (10 mins.) Participante 03
3. Leitura Técnica de Referência (4 mins.) Participante 10
BLOCO 2 — PRÁTICA E COMUNICAÇÃO
4. Simulação de Atendimento Inicial (3 mins.) Participante 11 / Participante 15
5. Dinâmica de Resolução de Cenários (5 mins.) Participante 02 / Participante 14
BLOCO 3 — APLICAÇÃO E SÍNTESE
Intervalo Técnico 06: Transição de Painel
6. Painel de Boas Práticas Operacionais (15 mins.) Participante 07
7. Revisão de Procedimentos em Equipe (30 mins.) Participante 01 / Participante 09
Vinheta 12: Encerramento de Sessão | Síntese Final Participante 05

20 de novembro de 2026 | MÓDULO 52 Presidente Participante 07
Vinheta 13: Abertura de Sessão | Credenciamento Participante 09
BLOCO 1 — FUNDAMENTOS E ANÁLISE
1. Liderança Colaborativa e Mentoria (10 mins.) Participante 03
2. Análise de Indicadores e Metas (10 mins.) Participante 01
3. Leitura Técnica de Referência (4 mins.) Participante 16
BLOCO 2 — PRÁTICA E COMUNICAÇÃO
4. Simulação de Atendimento Inicial (4 mins.) Participante 08 / Participante 06
5. Prática de Acompanhamento Operacional (4 mins.) Participante 05 / Participante 13
6. Apresentação de Caso Prático (5 mins.) Participante 10
BLOCO 3 — APLICAÇÃO E SÍNTESE
Intervalo Técnico 07: Transição de Painel
7. Logística de Recursos e Materiais (15 mins.) Participante 12
8. Revisão de Procedimentos em Equipe (30 mins.) Participante 07 / Participante 03
Vinheta 14: Encerramento de Sessão | Síntese Final Participante 13

27 de novembro de 2026 | MÓDULO 53, 54 Presidente Participante 03
Vinheta 15: Abertura de Sessão | Credenciamento Participante 12
BLOCO 1 — FUNDAMENTOS E ANÁLISE
1. Documentação e Registro Preciso (10 mins.) Participante 07
2. Análise de Indicadores e Metas (10 mins.) Participante 12
3. Leitura Técnica de Referência (4 mins.) Participante 09
BLOCO 2 — PRÁTICA E COMUNICAÇÃO
4. Simulação de Atendimento Inicial (3 mins.) Participante 04 / Participante 11
5. Prática de Acompanhamento Operacional (4 mins.) Participante 06 / Participante 02
6. Dinâmica de Resolução de Cenários (5 mins.) Participante 14 / Participante 15
BLOCO 3 — APLICAÇÃO E SÍNTESE
Intervalo Técnico 08: Transição de Painel
7. Síntese de Resultados Mensais (15 mins.) Participante 01
8. Revisão de Procedimentos em Equipe (30 mins.) Participante 03 / Participante 10
Vinheta 16: Encerramento de Sessão | Síntese Final Participante 07

4 de dezembro de 2026 | MÓDULO 55, 56 Presidente Participante 12
Vinheta 17: Abertura de Sessão | Credenciamento Participante 10
BLOCO 1 — FUNDAMENTOS E ANÁLISE
1. Planejamento de Encerramento Anual (10 mins.) Participante 01
2. Análise de Indicadores e Metas (10 mins.) Participante 07
3. Leitura Técnica de Referência (4 mins.) Participante 05
BLOCO 2 — PRÁTICA E COMUNICAÇÃO
4. Simulação de Atendimento Inicial (3 mins.) Participante 02 / Participante 08
5. Prática de Acompanhamento Operacional (4 mins.) Participante 15 / Participante 04
6. Apresentação de Caso Prático (5 mins.) Participante 09
BLOCO 3 — APLICAÇÃO E SÍNTESE
Intervalo Técnico 09: Transição de Painel
7. Retrospectiva e Metas para o Próximo Ciclo (15 mins.) Participante 03
8. Revisão de Procedimentos em Equipe (30 mins.) Participante 12 / Participante 16
Vinheta 18: Encerramento de Sessão | Síntese Final Participante 01
`.trim();

/**
 * Multi-cycle territory seed record structure.
 */
export interface S13TerritorySeedRecord {
  territoryNumber: string;
  locality: string;
  lastCompletedDate?: string;
  cycles2026: TerritoryAssignmentCycle[];
  cycles2027: TerritoryAssignmentCycle[];
}

export const S13_TERRITORIOS_SEED_RECORDS: S13TerritorySeedRecord[] = [
  {
    territoryNumber: 'T01.01.01',
    locality: 'Setor Norte — Quadra 01',
    lastCompletedDate: '25/08/2026',
    cycles2027: [
      { assignedTo: 'Participante 08', assignedAt: '01/09/2026', completedAt: '27/09/2026', serviceYear: 2027 },
      { assignedTo: 'Participante 10', assignedAt: '28/09/2026', serviceYear: 2027 },
    ],
    cycles2026: [
      { assignedTo: 'Participante 01', assignedAt: '01/09/2025', completedAt: '05/09/2025', serviceYear: 2026 },
      { assignedTo: 'Participante 02', assignedAt: '28/09/2025', completedAt: '14/10/2025', serviceYear: 2026 },
      { assignedTo: 'Participante 03', assignedAt: '14/10/2025', completedAt: '14/11/2025', serviceYear: 2026 },
      { assignedTo: 'Participante 04', assignedAt: '21/11/2025', completedAt: '20/12/2025', serviceYear: 2026 },
      { assignedTo: 'Participante 05', assignedAt: '06/01/2026', completedAt: '23/01/2026', serviceYear: 2026 },
      { assignedTo: 'Participante 07', assignedAt: '06/02/2026', completedAt: '02/03/2026', serviceYear: 2026 },
      { assignedTo: 'Participante 08', assignedAt: '03/03/2026', completedAt: '25/04/2026', serviceYear: 2026 },
      { assignedTo: 'Participante 09', assignedAt: '26/04/2026', completedAt: '20/06/2026', serviceYear: 2026 },
      { assignedTo: 'Participante 12', assignedAt: '04/07/2026', completedAt: '25/08/2026', serviceYear: 2026 },
    ],
  },
  {
    territoryNumber: 'T01.01.02',
    locality: 'Setor Norte — Quadra 02',
    lastCompletedDate: '30/08/2026',
    cycles2027: [
      { assignedTo: 'Participante 06', assignedAt: '14/09/2026', serviceYear: 2027 },
    ],
    cycles2026: [
      { assignedTo: 'Participante 02', assignedAt: '01/09/2025', completedAt: '09/09/2025', serviceYear: 2026 },
      { assignedTo: 'Participante 03', assignedAt: '28/09/2025', completedAt: '27/10/2025', serviceYear: 2026 },
      { assignedTo: 'Participante 04', assignedAt: '27/10/2025', completedAt: '22/11/2025', serviceYear: 2026 },
      { assignedTo: 'Participante 05', assignedAt: '25/11/2025', completedAt: '05/01/2026', serviceYear: 2026 },
      { assignedTo: 'Participante 06', assignedAt: '06/01/2026', completedAt: '01/02/2026', serviceYear: 2026 },
      { assignedTo: 'Participante 07', assignedAt: '08/02/2026', completedAt: '03/03/2026', serviceYear: 2026 },
      { assignedTo: 'Participante 08', assignedAt: '08/03/2026', completedAt: '31/05/2026', serviceYear: 2026 },
      { assignedTo: 'Participante 11', assignedAt: '15/06/2026', completedAt: '30/08/2026', serviceYear: 2026 },
    ],
  },
  {
    territoryNumber: 'T01.01.03',
    locality: 'Setor Norte — Quadra 03',
    lastCompletedDate: '04/08/2026',
    cycles2027: [
      { assignedTo: 'Participante 08', assignedAt: '05/08/2026', completedAt: '02/10/2026', serviceYear: 2027 },
      { assignedTo: 'Participante 05', assignedAt: '02/10/2026', serviceYear: 2027 },
    ],
    cycles2026: [
      { assignedTo: 'Participante 03', assignedAt: '01/09/2025', completedAt: '22/11/2025', serviceYear: 2026 },
      { assignedTo: 'Participante 05', assignedAt: '25/11/2025', completedAt: '13/02/2026', serviceYear: 2026 },
      { assignedTo: 'Participante 07', assignedAt: '13/02/2026', completedAt: '11/05/2026', serviceYear: 2026 },
      { assignedTo: 'Participante 09', assignedAt: '13/05/2026', completedAt: '04/08/2026', serviceYear: 2026 },
    ],
  },
  {
    territoryNumber: 'T01.01.04',
    locality: 'Setor Norte — Quadra 04',
    lastCompletedDate: '09/08/2026',
    cycles2027: [
      { assignedTo: 'Participante 04', assignedAt: '18/08/2026', completedAt: '15/09/2026', serviceYear: 2027 },
      { assignedTo: 'Participante 16', assignedAt: '15/09/2026', serviceYear: 2027 },
    ],
    cycles2026: [
      { assignedTo: 'Participante 01', assignedAt: '01/09/2025', completedAt: '26/11/2025', serviceYear: 2026 },
      { assignedTo: 'Participante 03', assignedAt: '29/11/2025', completedAt: '13/02/2026', serviceYear: 2026 },
      { assignedTo: 'Participante 11', assignedAt: '13/02/2026', completedAt: '14/05/2026', serviceYear: 2026 },
      { assignedTo: 'Participante 12', assignedAt: '14/05/2026', completedAt: '09/08/2026', serviceYear: 2026 },
    ],
  },
  {
    territoryNumber: 'T01.02.01',
    locality: 'Setor Leste — Quadra 01',
    lastCompletedDate: '19/08/2026',
    cycles2027: [
      { assignedTo: 'Participante 06', assignedAt: '25/08/2026', completedAt: '26/09/2026', serviceYear: 2027 },
      { assignedTo: 'Participante 02', assignedAt: '28/09/2026', serviceYear: 2027 },
    ],
    cycles2026: [
      { assignedTo: 'Participante 13', assignedAt: '02/09/2025', completedAt: '07/12/2025', serviceYear: 2026 },
      { assignedTo: 'Participante 15', assignedAt: '07/12/2025', completedAt: '17/02/2026', serviceYear: 2026 },
      { assignedTo: 'Participante 01', assignedAt: '21/02/2026', completedAt: '21/05/2026', serviceYear: 2026 },
      { assignedTo: 'Participante 03', assignedAt: '24/05/2026', completedAt: '19/08/2026', serviceYear: 2026 },
    ],
  },
  {
    territoryNumber: 'T01.02.02',
    locality: 'Setor Leste — Quadra 02',
    lastCompletedDate: '29/08/2026',
    cycles2027: [
      { assignedTo: 'Participante 04', assignedAt: '14/09/2026', serviceYear: 2027 },
    ],
    cycles2026: [
      { assignedTo: 'Participante 05', assignedAt: '15/09/2025', completedAt: '15/12/2025', serviceYear: 2026 },
      { assignedTo: 'Participante 07', assignedAt: '19/12/2025', completedAt: '21/02/2026', serviceYear: 2026 },
      { assignedTo: 'Participante 09', assignedAt: '21/02/2026', completedAt: '26/05/2026', serviceYear: 2026 },
      { assignedTo: 'Participante 10', assignedAt: '31/05/2026', completedAt: '29/08/2026', serviceYear: 2026 },
    ],
  },
  {
    territoryNumber: 'T01.02.03',
    locality: 'Setor Leste — Quadra 03',
    lastCompletedDate: '06/07/2026',
    cycles2027: [
      { assignedTo: 'Participante 08', assignedAt: '14/07/2026', completedAt: '19/09/2026', serviceYear: 2027 },
      { assignedTo: 'Participante 12', assignedAt: '28/09/2026', serviceYear: 2027 },
    ],
    cycles2026: [
      { assignedTo: 'Participante 11', assignedAt: '01/09/2025', completedAt: '31/10/2025', serviceYear: 2026 },
      { assignedTo: 'Participante 13', assignedAt: '31/10/2025', completedAt: '01/02/2026', serviceYear: 2026 },
      { assignedTo: 'Participante 15', assignedAt: '01/02/2026', completedAt: '14/03/2026', serviceYear: 2026 },
      { assignedTo: 'Participante 16', assignedAt: '21/03/2026', completedAt: '06/07/2026', serviceYear: 2026 },
    ],
  },
  {
    territoryNumber: 'T01.02.04',
    locality: 'Setor Leste — Quadra 04',
    lastCompletedDate: '17/07/2026',
    cycles2027: [
      { assignedTo: 'Participante 04', assignedAt: '20/07/2026', completedAt: '04/09/2026', serviceYear: 2027 },
      { assignedTo: 'Participante 03', assignedAt: '07/09/2026', serviceYear: 2027 },
    ],
    cycles2026: [
      { assignedTo: 'Participante 01', assignedAt: '01/09/2025', completedAt: '03/11/2025', serviceYear: 2026 },
      { assignedTo: 'Participante 03', assignedAt: '04/11/2025', completedAt: '02/02/2026', serviceYear: 2026 },
      { assignedTo: 'Participante 06', assignedAt: '06/02/2026', completedAt: '29/03/2026', serviceYear: 2026 },
      { assignedTo: 'Participante 07', assignedAt: '02/04/2026', completedAt: '17/07/2026', serviceYear: 2026 },
    ],
  },
  {
    territoryNumber: 'T02.01.01',
    locality: 'Setor Sul — Quadra 01',
    lastCompletedDate: '25/07/2026',
    cycles2027: [
      { assignedTo: 'Participante 01', assignedAt: '27/07/2026', completedAt: '10/09/2026', serviceYear: 2027 },
      { assignedTo: 'Participante 06', assignedAt: '15/09/2026', completedAt: '21/09/2026', serviceYear: 2027 },
      { assignedTo: 'Participante 01', assignedAt: '01/10/2026', serviceYear: 2027 },
    ],
    cycles2026: [
      { assignedTo: 'Participante 08', assignedAt: '01/09/2025', completedAt: '04/11/2025', serviceYear: 2026 },
      { assignedTo: 'Participante 10', assignedAt: '11/11/2025', completedAt: '05/02/2026', serviceYear: 2026 },
      { assignedTo: 'Participante 12', assignedAt: '06/02/2026', completedAt: '04/04/2026', serviceYear: 2026 },
      { assignedTo: 'Participante 13', assignedAt: '07/04/2026', completedAt: '25/07/2026', serviceYear: 2026 },
    ],
  },
  {
    territoryNumber: 'T02.01.02',
    locality: 'Setor Sul — Quadra 02',
    lastCompletedDate: '01/08/2026',
    cycles2027: [
      { assignedTo: 'Participante 14', assignedAt: '02/08/2026', completedAt: '19/09/2026', serviceYear: 2027 },
      { assignedTo: 'Participante 09', assignedAt: '28/09/2026', serviceYear: 2027 },
    ],
    cycles2026: [
      { assignedTo: 'Participante 15', assignedAt: '01/09/2025', completedAt: '10/11/2025', serviceYear: 2026 },
      { assignedTo: 'Participante 01', assignedAt: '14/11/2025', completedAt: '07/02/2026', serviceYear: 2026 },
      { assignedTo: 'Participante 03', assignedAt: '08/02/2026', completedAt: '14/04/2026', serviceYear: 2026 },
      { assignedTo: 'Participante 04', assignedAt: '14/04/2026', completedAt: '01/08/2026', serviceYear: 2026 },
    ],
  },
  {
    territoryNumber: 'T02.01.03',
    locality: 'Setor Sul — Quadra 03',
    lastCompletedDate: '09/08/2026',
    cycles2027: [
      { assignedTo: 'Participante 13', assignedAt: '18/08/2026', completedAt: '03/10/2026', serviceYear: 2027 },
      { assignedTo: 'Participante 08', assignedAt: '04/10/2026', serviceYear: 2027 },
    ],
    cycles2026: [
      { assignedTo: 'Participante 05', assignedAt: '01/09/2025', completedAt: '11/11/2025', serviceYear: 2026 },
      { assignedTo: 'Participante 07', assignedAt: '18/11/2025', completedAt: '13/02/2026', serviceYear: 2026 },
      { assignedTo: 'Participante 10', assignedAt: '13/02/2026', completedAt: '21/04/2026', serviceYear: 2026 },
      { assignedTo: 'Participante 11', assignedAt: '25/04/2026', completedAt: '09/08/2026', serviceYear: 2026 },
    ],
  },
  {
    territoryNumber: 'T02.01.04',
    locality: 'Setor Sul — Quadra 04',
    lastCompletedDate: '17/08/2026',
    cycles2027: [
      { assignedTo: 'Participante 11', assignedAt: '22/08/2026', serviceYear: 2027 },
    ],
    cycles2026: [
      { assignedTo: 'Participante 12', assignedAt: '01/09/2025', completedAt: '18/11/2025', serviceYear: 2026 },
      { assignedTo: 'Participante 14', assignedAt: '18/11/2025', completedAt: '13/02/2026', serviceYear: 2026 },
      { assignedTo: 'Participante 16', assignedAt: '13/02/2026', completedAt: '25/04/2026', serviceYear: 2026 },
      { assignedTo: 'Participante 01', assignedAt: '03/05/2026', completedAt: '17/08/2026', serviceYear: 2026 },
    ],
  },
  {
    territoryNumber: 'T02.02.01',
    locality: 'Setor Oeste — Quadra 01',
    lastCompletedDate: '25/08/2026',
    cycles2027: [
      { assignedTo: 'Participante 07', assignedAt: '06/09/2026', serviceYear: 2027 },
    ],
    cycles2026: [
      { assignedTo: 'Participante 02', assignedAt: '01/09/2025', completedAt: '18/11/2025', serviceYear: 2026 },
      { assignedTo: 'Participante 04', assignedAt: '25/11/2025', completedAt: '15/02/2026', serviceYear: 2026 },
      { assignedTo: 'Participante 06', assignedAt: '16/02/2026', completedAt: '04/05/2026', serviceYear: 2026 },
      { assignedTo: 'Participante 08', assignedAt: '09/05/2026', completedAt: '25/08/2026', serviceYear: 2026 },
    ],
  },
  {
    territoryNumber: 'T02.02.02',
    locality: 'Setor Oeste — Quadra 02',
    lastCompletedDate: '30/08/2026',
    cycles2027: [
      { assignedTo: 'Participante 14', assignedAt: '21/09/2026', serviceYear: 2027 },
    ],
    cycles2026: [
      { assignedTo: 'Participante 09', assignedAt: '02/09/2025', completedAt: '18/11/2025', serviceYear: 2026 },
      { assignedTo: 'Participante 11', assignedAt: '28/11/2025', completedAt: '20/02/2026', serviceYear: 2026 },
      { assignedTo: 'Participante 13', assignedAt: '21/02/2026', completedAt: '23/05/2026', serviceYear: 2026 },
      { assignedTo: 'Participante 15', assignedAt: '23/05/2026', completedAt: '30/08/2026', serviceYear: 2026 },
    ],
  },
  {
    territoryNumber: 'T02.02.03',
    locality: 'Setor Oeste — Quadra 03',
    lastCompletedDate: '30/08/2026',
    cycles2027: [
      { assignedTo: 'Participante 02', assignedAt: '14/09/2026', completedAt: '28/09/2026', serviceYear: 2027 },
      { assignedTo: 'Participante 15', assignedAt: '01/10/2026', serviceYear: 2027 },
    ],
    cycles2026: [
      { assignedTo: 'Participante 16', assignedAt: '02/09/2025', completedAt: '22/11/2025', serviceYear: 2026 },
      { assignedTo: 'Participante 03', assignedAt: '29/11/2025', completedAt: '20/02/2026', serviceYear: 2026 },
      { assignedTo: 'Participante 05', assignedAt: '21/02/2026', completedAt: '01/06/2026', serviceYear: 2026 },
      { assignedTo: 'Participante 06', assignedAt: '02/06/2026', completedAt: '30/08/2026', serviceYear: 2026 },
    ],
  },
  {
    territoryNumber: 'T02.02.04',
    locality: 'Setor Oeste — Quadra 04',
    lastCompletedDate: '30/08/2026',
    cycles2027: [
      { assignedTo: 'Participante 04', assignedAt: '21/09/2026', serviceYear: 2027 },
    ],
    cycles2026: [
      { assignedTo: 'Participante 07', assignedAt: '05/09/2025', completedAt: '22/11/2025', serviceYear: 2026 },
      { assignedTo: 'Participante 09', assignedAt: '02/12/2025', completedAt: '20/02/2026', serviceYear: 2026 },
      { assignedTo: 'Participante 11', assignedAt: '21/02/2026', completedAt: '01/06/2026', serviceYear: 2026 },
      { assignedTo: 'Participante 12', assignedAt: '15/06/2026', completedAt: '30/08/2026', serviceYear: 2026 },
    ],
  },
];

/**
 * Structural legacy-template normalizer (Clean-Room Hygiene — Zero Literal Codes).
 * Automatically upgrades cached localStorage/IndexedDB template keys and labels
 * using structural pattern matching (`/\b[A-Z]-\d{2,3}(?:-[A-Z])?\b/g`) so that
 * zero proprietary form codes or numeric signatures exist in the client JS bundle.
 */
const STRUCTURAL_TEMPLATE_SLUG_4UP_RE = /\b[a-z]\d{2,3}[a-z]?-4up\.sdoc\.yaml\b/gi;
const STRUCTURAL_TEMPLATE_SLUG_MULTI_RE = /\b[a-z]\d{2,3}[a-z]?-multiciclo\.sdoc\.yaml\b/gi;
const STRUCTURAL_PDF_KEY_MULTI_RE = /\bpdf:[a-z]\d{2,3}[a-z]?-multiciclo\b/gi;
const STRUCTURAL_LOGISTICS_PAIR_RE = /Logística de Territórios\s+[A-Z]-\d{2,3}(?:-[A-Z])?\s*&\s*[A-Z]-\d{2,3}/g;
const STRUCTURAL_SLIPS_TITLE_RE = /Fichas de Designação 4-Up\s*\([A-Z]-\d{2,3}(?:-[A-Z])?\)/g;
const STRUCTURAL_LEDGER_TITLE_RE = /Registro de Designação de Território\s*\([A-Z]-\d{2,3}(?:-[A-Z])?\)/g;
const STRUCTURAL_PAREN_FORM_CODE_RE = /\s*\([A-Z]-\d{2,3}(?:-[A-Z])?\)/g;

export function sanitizeLegacySensitiveText(input: string): { text: string; changed: boolean } {
  if (!input || typeof input !== 'string') return { text: input, changed: false };
  let out = input;
  out = out.replace(STRUCTURAL_TEMPLATE_SLUG_4UP_RE, 'fichas-4up.sdoc.yaml');
  out = out.replace(STRUCTURAL_TEMPLATE_SLUG_MULTI_RE, 'territorios-multiciclo.sdoc.yaml');
  out = out.replace(STRUCTURAL_PDF_KEY_MULTI_RE, 'pdf:territorios-multiciclo');
  out = out.replace(STRUCTURAL_LOGISTICS_PAIR_RE, 'Logística de Territórios & Cobertura de Campo');
  out = out.replace(STRUCTURAL_SLIPS_TITLE_RE, 'Fichas de Designação 4-Up (A4)');
  out = out.replace(STRUCTURAL_LEDGER_TITLE_RE, 'Registro de Designação de Território (Multi-Ciclo)');
  out = out.replace(STRUCTURAL_PAREN_FORM_CODE_RE, '');
  return { text: out, changed: out !== input };
}

/**
 * Normalizes a template identifier (`'slips_4up' | 'territory_ledger' | 'custom'`)
 * from any persisted storage state without embedding legacy form codes.
 */
export function normalizePdfTemplateId(
  rawId: string | null | undefined
): 'slips_4up' | 'territory_ledger' | 'custom' {
  const clean = String(rawId || '').trim().toLowerCase();
  if (!clean) return 'slips_4up';
  if (clean === 'custom') return 'custom';
  if (clean === 'territory_ledger' || clean.includes('ledger') || clean.includes('territor')) {
    return 'territory_ledger';
  }
  if (clean === 'slips_4up' || clean.includes('4up') || clean.includes('slip')) {
    return 'slips_4up';
  }
  // Structural legacy 3-char code fallback (e.g. ending in '9' -> 4-up slips, else ledger)
  if (/^[a-z]\d{2,3}[a-z]?$/.test(clean)) {
    return clean.endsWith('9') ? 'slips_4up' : 'territory_ledger';
  }
  return 'slips_4up';
}

/**
 * Builds the FlatSkeletonEntry registry for the 9-week Program Schedule (Oct-Dec 2026)
 * enriched with operational group tags ("Grupo 1", "Grupo 2", "Grupo 3").
 */
export function buildProgramacaoReuniaoRegistry(
  customRawText: string = RAW_PROGRAMACAO_2026_10_AND_11_TEXT,
  customDirectory: ParticipantProfile[] = PROGRAMACAO_PARTICIPANT_DIRECTORY
): FlatSkeletonEntry[] {
  const rawEntries = parseProgramScheduleText(customRawText, {
    unitName: PROGRAMACAO_UNIT_NAME,
  });
  return enrichRegistryWithDirectory(rawEntries, customDirectory);
}

const SYNTHETIC_CITIES = [
  'Município Central',
  'Município Norte',
  'Distrito Leste',
  'Município Sul',
] as const;

const SYNTHETIC_PROPERTY_TYPES = [
  'residencial',
  'comercial',
  'condominio',
  'terreno',
] as const;

/**
 * Converts a list of territory cycle seed records into a FlatSkeletonEntry registry
 * enriched with participant group tags, multi-cycle assignment history, and
 * synthetic clean-room coordinates for immediate cartographic visualization.
 */
export function buildS13RegistryFromRecords(
  records: S13TerritorySeedRecord[],
  directory: ParticipantProfile[] = PROGRAMACAO_PARTICIPANT_DIRECTORY
): FlatSkeletonEntry[] {
  return records.map((rec, index) => {
    const key = String(index + 1).padStart(2, '0');
    const allCycles: TerritoryAssignmentCycle[] = [...rec.cycles2026, ...rec.cycles2027];
    const latestCycle =
      rec.cycles2027[rec.cycles2027.length - 1] ||
      rec.cycles2026[rec.cycles2026.length - 1];

    const isCurrentlyOpen = Boolean(latestCycle && !latestCycle.completedAt);
    const currentHolder = latestCycle ? latestCycle.assignedTo : '';
    const profile = findParticipantProfile(currentHolder, directory);

    // Deterministic synthetic grid coordinates around (-23.5505, -46.6333)
    const rowIdx = Math.floor(index / 4);
    const colIdx = index % 4;
    const baseLat = Number((-23.548 - rowIdx * 0.0045).toFixed(6));
    const baseLng = Number((-46.638 + colIdx * 0.0055).toFixed(6));
    const dLat = 0.0014;
    const dLng = 0.0018;
    const syntheticPolygon: [number, number][] = [
      [Number((baseLat - dLat).toFixed(6)), Number((baseLng - dLng).toFixed(6))],
      [Number((baseLat - dLat).toFixed(6)), Number((baseLng + dLng).toFixed(6))],
      [Number((baseLat + dLat).toFixed(6)), Number((baseLng + dLng).toFixed(6))],
      [Number((baseLat + dLat).toFixed(6)), Number((baseLng - dLng).toFixed(6))],
    ];

    const sectorParts = rec.locality.split('—').map((s) => s.trim());
    const syntheticZone = sectorParts[0] || `Zona 0${rowIdx + 1}`;
    const syntheticNeighborhood = sectorParts[1] || `Bairro Sintético 0${colIdx + 1}`;
    const syntheticCity = SYNTHETIC_CITIES[rowIdx % SYNTHETIC_CITIES.length];
    const syntheticPropertyType = SYNTHETIC_PROPERTY_TYPES[index % SYNTHETIC_PROPERTY_TYPES.length];

    return {
      key,
      type: 'territory',
      label: `Território ${rec.territoryNumber} — ${rec.locality}`,
      value: currentHolder,
      email: '',
      meta: {
        territoryNumber: rec.territoryNumber,
        territory_number: rec.territoryNumber,
        locality: rec.locality,
        zone: syntheticZone,
        neighborhood: syntheticNeighborhood,
        line: `Via Operacional ${(index + 1) * 100} — ${rec.locality}`,
        line2: syntheticNeighborhood,
        city: syntheticCity,
        state: 'SP',
        country: 'BR',
        property_type: syntheticPropertyType,
        lat: baseLat,
        lng: baseLng,
        polygon: syntheticPolygon,
        worked: isCurrentlyOpen ? 0 : 1,
        workerName: currentHolder,
        groupTag: profile?.groupTag || 'Geral',
        assignedAt: latestCycle?.assignedAt,
        completedAt: latestCycle?.completedAt || rec.lastCompletedDate,
        lastCompletedDate: rec.lastCompletedDate,
        assignmentHistory: allCycles,
        cycles2026: rec.cycles2026,
        cycles2027: rec.cycles2027,
      },
    };
  });
}

export const TERRITORY_CYCLE_LEDGER_SEED_RECORDS = S13_TERRITORIOS_SEED_RECORDS;
export type TerritoryCycleSeedRecord = S13TerritorySeedRecord;
export const buildTerritoryCycleRegistryFromRecords = buildS13RegistryFromRecords;

/**
 * Builds a FlatSkeletonEntry registry representing the 16 territories and their
 * full 2026 + 2027 multi-cycle assignment history.
 */
export function buildTerritoriosS13HistoricalRegistry(): FlatSkeletonEntry[] {
  return buildS13RegistryFromRecords(
    S13_TERRITORIOS_SEED_RECORDS,
    PROGRAMACAO_PARTICIPANT_DIRECTORY
  );
}

export const buildTerritoryMultiCycleHistoricalRegistry = buildTerritoriosS13HistoricalRegistry;

/**
 * Agnostic Schedule Bundle structure for importing/exporting complete schedule + roster + territory
 * datasets as JSON without hardcoding personal data into the engine.
 */
export interface SekundoScheduleBundle {
  unitName?: string;
  participants?: ParticipantProfile[];
  rawScheduleText?: string;
  territoryCycleRecords?: S13TerritorySeedRecord[];
  s13TerritoryRecords?: S13TerritorySeedRecord[];
}

/**
 * Parses an external JSON bundle (or raw text) into enriched schedule and territory registries.
 */
export function parseSekundoScheduleBundle(jsonOrText: string): {
  unitName: string;
  participants: ParticipantProfile[];
  scheduleRegistry: FlatSkeletonEntry[];
  territoryRegistry: FlatSkeletonEntry[];
} {
  const trimmed = (jsonOrText || '').trim();
  if (trimmed.startsWith('{')) {
    const parsed = JSON.parse(trimmed) as SekundoScheduleBundle;
    const unitName = parsed.unitName || PROGRAMACAO_UNIT_NAME;
    const participants = Array.isArray(parsed.participants)
      ? parsed.participants
      : PROGRAMACAO_PARTICIPANT_DIRECTORY;
    const scheduleRegistry = parsed.rawScheduleText
      ? buildProgramacaoReuniaoRegistry(parsed.rawScheduleText, participants)
      : [];
    const records = Array.isArray(parsed.territoryCycleRecords)
      ? parsed.territoryCycleRecords
      : Array.isArray(parsed.s13TerritoryRecords)
      ? parsed.s13TerritoryRecords
      : [];
    const territoryRegistry = records.length > 0
      ? buildS13RegistryFromRecords(records, participants)
      : [];
    return { unitName, participants, scheduleRegistry, territoryRegistry };
  }

  return {
    unitName: PROGRAMACAO_UNIT_NAME,
    participants: PROGRAMACAO_PARTICIPANT_DIRECTORY,
    scheduleRegistry: buildProgramacaoReuniaoRegistry(trimmed, PROGRAMACAO_PARTICIPANT_DIRECTORY),
    territoryRegistry: [],
  };
}

