/**
 * Sekundo — Agnostic Demonstration Seed & Local Schedule Bundle Loader
 *
 * IMPORTANT PRIVACY & HYGIENE GUARANTEE:
 * This file contains ONLY fictional, anonymized, domain-agnostic demonstration
 * data for automated testing and default UI preview. Real personal names,
 * spreadsheet rows, and unit schedules are NEVER hardcoded in source control;
 * they are loaded locally by the user via `parseSekundoScheduleBundle` or
 * `parseProgramScheduleText` and persisted exclusively in device `localStorage`.
 *
 * Skills: agency-universal-document-compiler, agency-pdf-engine-architect
 */

import type { FlatSkeletonEntry } from '../skeleton/types';
import type { TerritoryAssignmentCycle } from '../engines/types';
import type { ParticipantProfile } from '../roster/participantDirectory';
import { parseProgramScheduleText } from './scheduleParser';

export const PROGRAMACAO_UNIT_NAME = 'Unidade Operacional Demo — Sekundo';

/**
 * Fictional, anonymized demonstration directory across 3 operational groups.
 */
export const PROGRAMACAO_PARTICIPANT_DIRECTORY: ParticipantProfile[] = [
  // GRUPO 1
  { id: 'g1-01', name: 'Carlos Eduardo F. Silva', groupTag: 'Grupo 1', capabilityTags: ['Coordenador', 'Instrutor'] },
  { id: 'g1-02', name: 'Mariana G. Costa', groupTag: 'Grupo 1', capabilityTags: ['Titular Regular'] },
  { id: 'g1-03', name: 'Roberto Gomes Almeida', groupTag: 'Grupo 1', capabilityTags: ['Supervisor', 'Orador'] },
  { id: 'g1-04', name: 'Simon C. de Souza', groupTag: 'Grupo 1', capabilityTags: ['Supervisor', 'Titular Regular'] },
  { id: 'g1-05', name: 'Eliane R. Martins', groupTag: 'Grupo 1', capabilityTags: ['Titular Regular'] },
  { id: 'g1-06', name: 'Josué G. Oliveira', groupTag: 'Grupo 1', capabilityTags: ['Assistente Técnico', 'Titular Regular'] },

  // GRUPO 2
  { id: 'g2-01', name: 'Fernando d. S. Conçeição', groupTag: 'Grupo 2', capabilityTags: ['Supervisor', 'Orador'] },
  { id: 'g2-02', name: 'Juliana P. Mendes', groupTag: 'Grupo 2', capabilityTags: ['Titular Regular'] },
  { id: 'g2-03', name: 'Lucas Joel R. Pereira', groupTag: 'Grupo 2', capabilityTags: ['Assistente Técnico'] },
  { id: 'g2-04', name: 'Javier E. Morales', groupTag: 'Grupo 2', capabilityTags: ['Supervisor', 'Instrutor'] },
  { id: 'g2-05', name: 'Adriana S. Lima', groupTag: 'Grupo 2', capabilityTags: ['Titular Regular'] },

  // GRUPO 3
  { id: 'g3-01', name: 'Tiago A. Rocha Neto', groupTag: 'Grupo 3', capabilityTags: ['Supervisor', 'Orador'] },
  { id: 'g3-02', name: 'Paulo Henrick F. Castro', groupTag: 'Grupo 3', capabilityTags: ['Participante'] },
  { id: 'g3-03', name: 'Rebeca S. Barbosa', groupTag: 'Grupo 3', capabilityTags: ['Titular Regular'] },
  { id: 'g3-04', name: 'Patrícia S. Cardoso', groupTag: 'Grupo 3', capabilityTags: ['Titular Regular'] },
  { id: 'g3-05', name: 'Edson M. Ferreira', groupTag: 'Grupo 3', capabilityTags: ['Supervisor', 'Orador'] },
];

/**
 * Agnostic demonstration schedule text (9 weekly sessions) for unit tests and initial preview.
 */
export const RAW_PROGRAMACAO_2026_10_AND_11_TEXT = `
Unidade Operacional Demo — Sekundo Reunião do meio de semana
9 de outubro de 2026 | MÓDULO 40, 41 Presidente Tiago A. Rocha Neto
Cântico 33: Abertura Operacional Oração Fernando d. S. Conçeição
Comentários iniciais
BLOCO 1 — FUNDAMENTOS E ANÁLISE
1. Princípios de planejamento e proteção de equipe (10 mins.) Roberto Gomes Almeida
2. Destaques e pontos-chave da semana (10 mins.) Carlos Eduardo F. Silva
3. Leitura técnica comentada (4 mins.) Lucas Joel R. Pereira
BLOCO 2 — PRÁTICA E COMUNICAÇÃO
4. Inicie conversas (2 mins.) Paulo Henrick F. Castro / Josué G. Oliveira
5. Inicie conversas (2 mins.) Juliana P. Mendes / Adriana S. Lima
6. Inicie conversas (4 mins.) Rebeca S. Barbosa / Mariana G. Costa
7. Explique o protocolo (3 mins.) Patrícia S. Cardoso / Eliane R. Martins
BLOCO 3 — APLICAÇÃO E SÍNTESE
Cântico 17: Transição Intermediária
8. Apoio contínuo às equipes de campo (15 mins.) Simon C. de Souza
9. Estudo analítico em grupo (30 mins.) Edson M. Ferreira / Lucas Joel R. Pereira
Comentários finais
Cântico 38: Encerramento Oração Javier E. Morales

16 de outubro de 2026 | MÓDULO 42, 43 Presidente Simon C. de Souza
Cântico 104: Abertura Operacional Oração Josué G. Oliveira
Comentários iniciais
BLOCO 1 — FUNDAMENTOS E ANÁLISE
1. Tomada de decisão colaborativa (10 mins.) Fernando d. S. Conçeição
2. Destaques e pontos-chave da semana (10 mins.) Javier E. Morales
3. Leitura técnica comentada (4 mins.) Paulo Henrick F. Castro
BLOCO 2 — PRÁTICA E COMUNICAÇÃO
4. Inicie conversas (4 mins.) Mariana G. Costa / Eliane R. Martins
5. Acompanhamento de campo (3 mins.) Rebeca S. Barbosa / Patrícia S. Cardoso
6. Desenvolvimento de equipe (5 mins.) Juliana P. Mendes / Adriana S. Lima
BLOCO 3 — APLICAÇÃO E SÍNTESE
Cântico 124: Transição Intermediária
7. Diretrizes de execução segura (15 mins.) Fernando d. S. Conçeição
8. Estudo analítico em grupo (30 mins.) Tiago A. Rocha Neto / Carlos Eduardo F. Silva
Comentários finais
Cântico 122: Encerramento Oração Edson M. Ferreira

23 de outubro de 2026 | MÓDULO 44-48 Presidente Edson M. Ferreira
Cântico 60: Abertura Operacional Oração Lucas Joel R. Pereira
Comentários iniciais
BLOCO 1 — FUNDAMENTOS E ANÁLISE
1. Foco nas prioridades essenciais (10 mins.) Carlos Eduardo F. Silva
2. Destaques e pontos-chave da semana (10 mins.) Roberto Gomes Almeida
3. Leitura técnica comentada (4 mins.) Paulo Henrick F. Castro
BLOCO 2 — PRÁTICA E COMUNICAÇÃO
4. Inicie conversas (3 mins.) Mariana G. Costa / Eliane R. Martins
5. Acompanhamento de campo (4 mins.) Rebeca S. Barbosa / Juliana P. Mendes
6. Exposição temática (5 mins.) Lucas Joel R. Pereira
BLOCO 3 — APLICAÇÃO E SÍNTESE
Cântico 79: Transição Intermediária
7. Necessidades operacionais da unidade (15 mins.) Javier E. Morales
8. Estudo analítico em grupo (30 mins.) Simon C. de Souza / Josué G. Oliveira
Comentários finais
Cântico 126: Encerramento Oração Fernando d. S. Conçeição

30 de outubro de 2026 | MÓDULO 49, 50 Presidente Javier E. Morales
Cântico 9: Abertura Operacional Oração Roberto Gomes Almeida
Comentários iniciais
BLOCO 1 — FUNDAMENTOS E ANÁLISE
1. Resiliência em projetos de longo prazo (10 mins.) Fernando d. S. Conçeição
2. Destaques e pontos-chave da semana (10 mins.) Tiago A. Rocha Neto
3. Leitura técnica comentada (4 mins.) Josué G. Oliveira
BLOCO 2 — PRÁTICA E COMUNICAÇÃO
4. Inicie conversas (3 mins.) Adriana S. Lima / Juliana P. Mendes
5. Acompanhamento de campo (4 mins.) Patrícia S. Cardoso / Mariana G. Costa
6. Explique o protocolo (5 mins.) Lucas Joel R. Pereira / Paulo Henrick F. Castro
BLOCO 3 — APLICAÇÃO E SÍNTESE
Cântico 149: Transição Intermediária
7. Relatório de cobertura regional (15 mins.) Edson M. Ferreira
8. Estudo analítico em grupo (30 mins.) Roberto Gomes Almeida / Carlos Eduardo F. Silva
Comentários finais
Cântico 150: Encerramento Oração Simon C. de Souza

6 de novembro de 2026 | MÓDULO 51, 52 Presidente Roberto Gomes Almeida
Cântico 148: Abertura Operacional Oração Tiago A. Rocha Neto
Comentários iniciais
BLOCO 1 — FUNDAMENTOS E ANÁLISE
1. Cumprimento de metas e cronogramas (10 mins.) Simon C. de Souza
2. Destaques e pontos-chave da semana (10 mins.) Edson M. Ferreira
3. Leitura técnica comentada (4 mins.) Paulo Henrick F. Castro
BLOCO 2 — PRÁTICA E COMUNICAÇÃO
4. Inicie conversas (2 mins.) Eliane R. Martins / Mariana G. Costa
5. Inicie conversas (3 mins.) Rebeca S. Barbosa / Patrícia S. Cardoso
6. Acompanhamento de campo (3 mins.) Juliana P. Mendes / Adriana S. Lima
7. Desenvolvimento de equipe (5 mins.) Carlos Eduardo F. Silva / Josué G. Oliveira
BLOCO 3 — APLICAÇÃO E SÍNTESE
Cântico 97: Transição Intermediária
8. Fortalecimento da confiança na equipe (15 mins.) Carlos Eduardo F. Silva
9. Estudo analítico em grupo (30 mins.) Javier E. Morales / Lucas Joel R. Pereira
Comentários finais
Cântico 96: Encerramento Oração Fernando d. S. Conçeição

13 de novembro de 2026 | SÍNTESE 1, 2 Presidente Fernando d. S. Conçeição
Cântico 58: Abertura Operacional Oração Carlos Eduardo F. Silva
Comentários iniciais
BLOCO 1 — FUNDAMENTOS E ANÁLISE
1. Prevenção de falhas operacionais (10 mins.) Edson M. Ferreira
2. Destaques e pontos-chave da semana (10 mins.) Josué G. Oliveira
3. Leitura técnica comentada (4 mins.) Lucas Joel R. Pereira
BLOCO 2 — PRÁTICA E COMUNICAÇÃO
4. Inicie conversas (3 mins.) Adriana S. Lima / Juliana P. Mendes
5. Acompanhamento de campo (4 mins.) Mariana G. Costa / Eliane R. Martins
6. Desenvolvimento de equipe (5 mins.) Rebeca S. Barbosa / Patrícia S. Cardoso
BLOCO 3 — APLICAÇÃO E SÍNTESE
Cântico 116: Transição Intermediária
7. Resultados trimestrais da organização (10 mins.) Tiago A. Rocha Neto
8. Necessidades operacionais da unidade (5 mins.) Simon C. de Souza
9. Estudo analítico em grupo (30 mins.) Fernando d. S. Conçeição / Roberto Gomes Almeida
Comentários finais
Cântico 128: Encerramento Oração Javier E. Morales

20 de novembro de 2026 | SÍNTESE 3-5 Presidente Carlos Eduardo F. Silva
Cântico 44: Abertura Operacional Oração Josué G. Oliveira
Comentários iniciais
BLOCO 1 — FUNDAMENTOS E ANÁLISE
1. Paciência estratégica em campo (10 mins.) Lucas Joel R. Pereira
2. Destaques e pontos-chave da semana (10 mins.) Fernando d. S. Conçeição
3. Leitura técnica comentada (4 mins.) Paulo Henrick F. Castro
BLOCO 2 — PRÁTICA E COMUNICAÇÃO
4. Inicie conversas (3 mins.) Patrícia S. Cardoso / Rebeca S. Barbosa
5. Acompanhamento de campo (4 mins.) Mariana G. Costa / Juliana P. Mendes
6. Estudo de caso prático (5 mins.) Javier E. Morales
BLOCO 3 — APLICAÇÃO E SÍNTESE
Cântico 90: Transição Intermediária
7. Reintegração e apoio aos colaboradores (15 mins.) Roberto Gomes Almeida
8. Estudo analítico em grupo (30 mins.) Fernando d. S. Conçeição / Josué G. Oliveira
Comentários finais
Cântico 75: Encerramento Oração Simon C. de Souza

27 de novembro de 2026 | SÍNTESE 6, 7 Presidente Fernando d. S. Conçeição
Cântico 158: Abertura Operacional Oração Carlos Eduardo F. Silva
Comentários iniciais
BLOCO 1 — FUNDAMENTOS E ANÁLISE
1. Superação de obstáculos operacionais (10 mins.) Tiago A. Rocha Neto
2. Destaques e pontos-chave da semana (10 mins.) Simon C. de Souza
3. Leitura técnica comentada (4 mins.) Lucas Joel R. Pereira
BLOCO 2 — PRÁTICA E COMUNICAÇÃO
4. Inicie conversas (3 mins.) Fernando d. S. Conçeição / Paulo Henrick F. Castro
5. Inicie conversas (4 mins.) Patrícia S. Cardoso / Mariana G. Costa
6. Exposição temática (5 mins.) Josué G. Oliveira
BLOCO 3 — APLICAÇÃO E SÍNTESE
Cântico 109: Transição Intermediária
7. Apoio logístico contínuo (15 mins.) Josué G. Oliveira
8. Estudo analítico em grupo (30 mins.) Edson M. Ferreira / Javier E. Morales
Comentários finais
Cântico 74: Encerramento Oração Roberto Gomes Almeida

4 de dezembro de 2026 | PROJETO 1, 2 Presidente Edson M. Ferreira
Cântico 65: Abertura Operacional Oração Lucas Joel R. Pereira
Comentários iniciais
BLOCO 1 — FUNDAMENTOS E ANÁLISE
1. Sincronização e ritmo de trabalho (10 mins.) Javier E. Morales
2. Destaques e pontos-chave da semana (10 mins.) Carlos Eduardo F. Silva
3. Leitura técnica comentada (4 mins.) Paulo Henrick F. Castro
BLOCO 2 — PRÁTICA E COMUNICAÇÃO
4. Inicie conversas (3 mins.) Josué G. Oliveira / Edson M. Ferreira
5. Desenvolvimento de equipe (5 mins.) Juliana P. Mendes / Adriana S. Lima
6. Exposição temática (4 mins.) Roberto Gomes Almeida
BLOCO 3 — APLICAÇÃO E SÍNTESE
Cântico 63: Transição Intermediária
7. Necessidades operacionais da unidade (15 mins.) Tiago A. Rocha Neto
8. Estudo analítico em grupo (30 mins.) Simon C. de Souza / Roberto Gomes Almeida
Comentários finais
Cântico 134: Encerramento Oração Fernando d. S. Conçeição
`;

export interface S13TerritorySeedRecord {
  territoryNumber: string;
  locality: string;
  lastCompleted2027?: string;
  lastCompleted2026?: string;
  cycles2027: TerritoryAssignmentCycle[];
  cycles2026: TerritoryAssignmentCycle[];
}

export interface SekundoScheduleBundle {
  schemaVersion?: string;
  unitName: string;
  participants: ParticipantProfile[];
  rawScheduleText: string;
  s13TerritoryRecords: S13TerritorySeedRecord[];
}

/**
 * Fictional multi-cycle S-13-S demonstration records (2027 & 2026).
 */
export const S13_TERRITORIOS_SEED_RECORDS: S13TerritorySeedRecord[] = [
  {
    territoryNumber: 'T01.01.01',
    locality: 'Setor Central A',
    lastCompleted2027: '30/08/2026',
    lastCompleted2026: '30/08/2024',
    cycles2027: [
      { assignedTo: 'Carlos Eduardo F. Silva', assignedAt: '15/09/2026', completedAt: '03/10/2026', serviceYear: 2027 },
    ],
    cycles2026: [
      { assignedTo: 'Simon C. de Souza', assignedAt: '05/11/2025', completedAt: '05/11/2025', serviceYear: 2026 },
      { assignedTo: 'Simon C. de Souza', assignedAt: '10/12/2025', completedAt: '10/12/2025', serviceYear: 2026 },
      { assignedTo: 'Carlos Eduardo F. Silva', assignedAt: '13/01/2026', completedAt: '13/01/2026', serviceYear: 2026 },
      { assignedTo: 'Carlos Eduardo F. Silva', assignedAt: '10/02/2026', completedAt: '10/02/2026', serviceYear: 2026 },
      { assignedTo: 'Javier E. Morales', assignedAt: '17/03/2026', completedAt: '17/03/2026', serviceYear: 2026 },
      { assignedTo: 'Javier E. Morales', assignedAt: '14/04/2026', completedAt: '14/04/2026', serviceYear: 2026 },
      { assignedTo: 'Javier E. Morales', assignedAt: '12/05/2026', completedAt: '12/05/2026', serviceYear: 2026 },
      { assignedTo: 'Javier E. Morales', assignedAt: '09/06/2026', completedAt: '09/06/2026', serviceYear: 2026 },
      { assignedTo: 'Roberto Gomes Almeida', assignedAt: '29/08/2026', completedAt: '30/08/2026', serviceYear: 2026 },
    ],
  },
  {
    territoryNumber: 'T01.01.02',
    locality: 'Setor Central B',
    lastCompleted2027: '16/06/2026',
    lastCompleted2026: '30/08/2024',
    cycles2027: [
      { assignedTo: 'Rebeca S. Barbosa', assignedAt: '04/09/2026', completedAt: '18/09/2026', serviceYear: 2027 },
      { assignedTo: 'Simon C. de Souza', assignedAt: '18/09/2026', completedAt: '28/09/2026', serviceYear: 2027 },
      { assignedTo: 'Eliane R. Martins', assignedAt: '05/10/2026', serviceYear: 2027 },
    ],
    cycles2026: [
      { assignedTo: 'Javier E. Morales', assignedAt: '17/03/2026', completedAt: '17/03/2026', serviceYear: 2026 },
      { assignedTo: 'Javier E. Morales', assignedAt: '19/05/2026', completedAt: '19/05/2026', serviceYear: 2026 },
      { assignedTo: 'Javier E. Morales', assignedAt: '16/06/2026', completedAt: '16/06/2026', serviceYear: 2026 },
    ],
  },
  {
    territoryNumber: 'T01.01.03',
    locality: 'Setor Central C',
    lastCompleted2027: '01/06/2026',
    lastCompleted2026: '18/10/2024',
    cycles2027: [],
    cycles2026: [
      { assignedTo: 'Fernando d. S. Conçeição', assignedAt: '10/11/2025', completedAt: '10/11/2025', serviceYear: 2026 },
      { assignedTo: 'Fernando d. S. Conçeição', assignedAt: '15/12/2025', completedAt: '15/12/2025', serviceYear: 2026 },
      { assignedTo: 'Fernando d. S. Conçeição', assignedAt: '19/01/2026', completedAt: '19/01/2026', serviceYear: 2026 },
      { assignedTo: 'Fernando d. S. Conçeição', assignedAt: '16/02/2026', completedAt: '16/02/2026', serviceYear: 2026 },
      { assignedTo: 'Josué G. Oliveira', assignedAt: '21/03/2026', completedAt: '21/03/2026', serviceYear: 2026 },
      { assignedTo: 'Fernando d. S. Conçeição', assignedAt: '20/04/2026', completedAt: '20/04/2026', serviceYear: 2026 },
      { assignedTo: 'Fernando d. S. Conçeição', assignedAt: '01/06/2026', completedAt: '01/06/2026', serviceYear: 2026 },
    ],
  },
  {
    territoryNumber: 'T01.01.04',
    locality: 'Setor Central D',
    lastCompleted2027: '15/06/2026',
    cycles2027: [
      { assignedTo: 'Simon C. de Souza', assignedAt: '20/09/2026', completedAt: '20/09/2026', serviceYear: 2027 },
    ],
    cycles2026: [
      { assignedTo: 'Fernando d. S. Conçeição', assignedAt: '10/11/2025', completedAt: '10/11/2025', serviceYear: 2026 },
      { assignedTo: 'Josué G. Oliveira', assignedAt: '21/03/2026', completedAt: '21/03/2026', serviceYear: 2026 },
    ],
  },
  {
    territoryNumber: 'T01.03.02',
    locality: 'Setor Norte A',
    lastCompleted2027: '18/05/2026',
    cycles2027: [
      { assignedTo: 'Simon C. de Souza', assignedAt: '14/09/2026', completedAt: '15/09/2026', serviceYear: 2027 },
      { assignedTo: 'Simon C. de Souza', assignedAt: '05/10/2026', serviceYear: 2027 },
    ],
    cycles2026: [
      { assignedTo: 'Fernando d. S. Conçeição', assignedAt: '10/11/2025', completedAt: '10/11/2025', serviceYear: 2026 },
      { assignedTo: 'Simon C. de Souza', assignedAt: '18/03/2026', completedAt: '18/03/2026', serviceYear: 2026 },
    ],
  },
  {
    territoryNumber: 'T01.03.03',
    locality: 'Setor Norte B',
    lastCompleted2027: '30/08/2026',
    cycles2027: [
      { assignedTo: 'Eliane R. Martins', assignedAt: '14/09/2026', completedAt: '16/09/2026', serviceYear: 2027 },
      { assignedTo: 'Mariana G. Costa', assignedAt: '05/10/2026', serviceYear: 2027 },
    ],
    cycles2026: [
      { assignedTo: 'Javier E. Morales', assignedAt: '16/08/2026', completedAt: '30/08/2026', serviceYear: 2026 },
    ],
  },
  {
    territoryNumber: 'T01.04.01',
    locality: 'Setor Leste A',
    lastCompleted2027: '30/08/2026',
    cycles2027: [
      { assignedTo: 'Mariana G. Costa', assignedAt: '10/10/2026', serviceYear: 2027 },
    ],
    cycles2026: [
      { assignedTo: 'Josué G. Oliveira', assignedAt: '29/08/2026', completedAt: '30/08/2026', serviceYear: 2026 },
    ],
  },
  {
    territoryNumber: 'T02.01.01',
    locality: 'Setor Leste B',
    lastCompleted2027: '24/08/2026',
    cycles2027: [
      { assignedTo: 'Carlos Eduardo F. Silva', assignedAt: '24/09/2026', completedAt: '24/09/2026', serviceYear: 2027 },
      { assignedTo: 'Lucas Joel R. Pereira', assignedAt: '01/10/2026', serviceYear: 2027 },
    ],
    cycles2026: [
      { assignedTo: 'Roberto Gomes Almeida', assignedAt: '24/08/2026', completedAt: '24/08/2026', serviceYear: 2026 },
    ],
  },
  {
    territoryNumber: 'T02.02.01',
    locality: 'Setor Sul A',
    lastCompleted2027: '08/08/2026',
    cycles2027: [
      { assignedTo: 'Tiago A. Rocha Neto', assignedAt: '07/09/2026', completedAt: '07/09/2026', serviceYear: 2027 },
      { assignedTo: 'Carlos Eduardo F. Silva', assignedAt: '03/10/2026', serviceYear: 2027 },
    ],
    cycles2026: [
      { assignedTo: 'Tiago A. Rocha Neto', assignedAt: '08/08/2026', completedAt: '08/08/2026', serviceYear: 2026 },
    ],
  },
  {
    territoryNumber: 'T02.02.02',
    locality: 'Setor Sul B',
    lastCompleted2027: '30/08/2026',
    cycles2027: [
      { assignedTo: 'Rebeca S. Barbosa', assignedAt: '18/09/2026', serviceYear: 2027 },
    ],
    cycles2026: [
      { assignedTo: 'Javier E. Morales', assignedAt: '16/08/2026', completedAt: '30/08/2026', serviceYear: 2026 },
    ],
  },
  {
    territoryNumber: 'T02.02.09',
    locality: 'Setor Sul C',
    lastCompleted2027: '27/08/2026',
    cycles2027: [
      { assignedTo: 'Juliana P. Mendes', assignedAt: '07/09/2026', completedAt: '07/09/2026', serviceYear: 2027 },
      { assignedTo: 'Fernando d. S. Conçeição', assignedAt: '28/09/2026', serviceYear: 2027 },
    ],
    cycles2026: [
      { assignedTo: 'Lucas Joel R. Pereira', assignedAt: '20/08/2026', completedAt: '27/08/2026', serviceYear: 2026 },
    ],
  },
  {
    territoryNumber: 'T02.03.03',
    locality: 'Setor Oeste A',
    lastCompleted2027: '14/03/2026',
    cycles2027: [
      { assignedTo: 'Edson M. Ferreira', assignedAt: '22/09/2026', serviceYear: 2027 },
    ],
    cycles2026: [
      { assignedTo: 'Fernando d. S. Conçeição', assignedAt: '14/03/2026', completedAt: '14/03/2026', serviceYear: 2026 },
    ],
  },
  {
    territoryNumber: 'T02.04.03',
    locality: 'Setor Oeste B',
    lastCompleted2027: '30/08/2026',
    cycles2027: [
      { assignedTo: 'Simon C. de Souza', assignedAt: '13/09/2026', completedAt: '13/09/2026', serviceYear: 2027 },
      { assignedTo: 'Adriana S. Lima', assignedAt: '29/09/2026', serviceYear: 2027 },
    ],
    cycles2026: [
      { assignedTo: 'Tiago A. Rocha Neto', assignedAt: '29/08/2026', completedAt: '30/08/2026', serviceYear: 2026 },
    ],
  },
  {
    territoryNumber: 'T02.05.02',
    locality: 'Setor Oeste C',
    lastCompleted2027: '30/08/2026',
    cycles2027: [
      { assignedTo: 'Rebeca S. Barbosa', assignedAt: '04/09/2026', completedAt: '18/09/2026', serviceYear: 2027 },
      { assignedTo: 'Carlos Eduardo F. Silva', assignedAt: '04/10/2026', completedAt: '11/10/2026', serviceYear: 2027 },
    ],
    cycles2026: [
      { assignedTo: 'Simon C. de Souza', assignedAt: '16/08/2026', completedAt: '30/08/2026', serviceYear: 2026 },
    ],
  },
  {
    territoryNumber: 'T03.01.01',
    locality: 'Setor Industrial A',
    lastCompleted2027: '29/08/2026',
    cycles2027: [
      { assignedTo: 'Tiago A. Rocha Neto', assignedAt: '12/09/2026', completedAt: '26/09/2026', serviceYear: 2027 },
      { assignedTo: 'Edson M. Ferreira', assignedAt: '03/10/2026', serviceYear: 2027 },
    ],
    cycles2026: [
      { assignedTo: 'Roberto Gomes Almeida', assignedAt: '29/08/2026', completedAt: '29/08/2026', serviceYear: 2026 },
    ],
  },
  {
    territoryNumber: 'T03.01.05',
    locality: 'Setor Industrial B',
    lastCompleted2027: '28/03/2026',
    cycles2027: [
      { assignedTo: 'Fernando d. S. Conçeição', assignedAt: '20/09/2026', serviceYear: 2027 },
    ],
    cycles2026: [
      { assignedTo: 'Roberto Gomes Almeida', assignedAt: '28/03/2026', completedAt: '28/03/2026', serviceYear: 2026 },
    ],
  },
];

/**
 * Builds the enriched FlatSkeletonEntry[] for the schedule seed.
 */
export function buildProgramacaoReuniaoRegistry(): FlatSkeletonEntry[] {
  return parseProgramScheduleText(RAW_PROGRAMACAO_2026_10_AND_11_TEXT, {
    unitName: PROGRAMACAO_UNIT_NAME,
    directory: PROGRAMACAO_PARTICIPANT_DIRECTORY,
  });
}

/**
 * Converts an array of `S13TerritorySeedRecord` into a canonical `FlatSkeletonEntry[]`
 * registry for territory tracking, WhatsApp group digests, and S-13-S PDF generation.
 */
export function buildS13RegistryFromRecords(
  records: S13TerritorySeedRecord[]
): FlatSkeletonEntry[] {
  return records.map((rec, idx) => {
    const numParts = rec.territoryNumber.replace(/^T/i, '').split('.');
    const key =
      numParts.length === 3
        ? numParts.join('-')
        : `01-01-${String(idx + 1).padStart(2, '0')}`;
    const allCycles = [...(rec.cycles2026 || []), ...(rec.cycles2027 || [])];
    const latest = allCycles[allCycles.length - 1];
    const isCurrentlyOpen = Boolean(latest && !latest.completedAt);

    return {
      key,
      type: 'territory',
      label: `${rec.territoryNumber} — ${rec.locality}`,
      value: latest?.assignedTo || '',
      email: '',
      meta: {
        territoryNumber: rec.territoryNumber,
        territory_number: rec.territoryNumber,
        locality: rec.locality,
        worked: isCurrentlyOpen ? 0 : 1,
        workerName: latest?.assignedTo,
        assignedAt: latest?.assignedAt,
        completedAt: latest?.completedAt,
        lastCompletedBeforeYear: rec.lastCompleted2027 || rec.lastCompleted2026,
        lastCompleted2027: rec.lastCompleted2027,
        lastCompleted2026: rec.lastCompleted2026,
        assignmentHistory: allCycles,
      },
    };
  });
}

export function buildTerritoriosS13HistoricalRegistry(): FlatSkeletonEntry[] {
  return buildS13RegistryFromRecords(S13_TERRITORIOS_SEED_RECORDS);
}

/**
 * Parses a local `.json` schedule bundle (such as `sekundo-programacao-2026-2027.json`
 * stored in the user's local folder outside Git) into ready-to-use Sekundo registries.
 */
export function parseSekundoScheduleBundle(jsonText: string): {
  unitName: string;
  participants: ParticipantProfile[];
  scheduleRegistry: FlatSkeletonEntry[];
  territoryRegistry: FlatSkeletonEntry[];
} {
  const parsed = JSON.parse(jsonText) as Partial<SekundoScheduleBundle>;
  const unitName = parsed.unitName || PROGRAMACAO_UNIT_NAME;
  const participants = Array.isArray(parsed.participants)
    ? parsed.participants
    : PROGRAMACAO_PARTICIPANT_DIRECTORY;
  const scheduleRegistry = parsed.rawScheduleText
    ? parseProgramScheduleText(parsed.rawScheduleText, {
        unitName,
        directory: participants,
      })
    : buildProgramacaoReuniaoRegistry();
  const territoryRegistry = Array.isArray(parsed.s13TerritoryRecords)
    ? buildS13RegistryFromRecords(parsed.s13TerritoryRecords)
    : buildTerritoriosS13HistoricalRegistry();

  return {
    unitName,
    participants,
    scheduleRegistry,
    territoryRegistry,
  };
}
