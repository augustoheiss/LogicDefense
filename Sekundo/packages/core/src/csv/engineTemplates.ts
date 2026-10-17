/**
 * Sekundo — Canonical Engine CSV Templates
 *
 * Provides ready-to-use, error-free CSV templates for each of the 8 Universal Engines.
 * Users and Agents can export, inspect, copy or download these templates to immediately
 * understand the column schemas and data structures required for each engine.
 */

import type { EngineId } from '../engines/types';

export interface EngineCSVTemplate {
  engineId: EngineId;
  name: string;
  category: string;
  description: string;
  suggestedFilename: string;
  /** Full technical CSV with _key, _type, label, value, email, _meta_json */
  canonicalCsv: string;
  /** User-friendly, clean human CSV with intuitive column headers */
  cleanHumanCsv: string;
  columnGuides: { column: string; description: string; example: string }[];
  keyConventions: string;
}

export const ENGINE_TEMPLATES: Record<EngineId, EngineCSVTemplate> = {
  territory_logistics: {
    engineId: 'territory_logistics',
    name: 'Logística de Territórios & Visitas de Campo',
    category: 'Campo & Geografia',
    description: 'Gestão de mapas de quadras, ruas e residências com status trabalhado (0/1), geolocalização e histórico de visitas.',
    suggestedFilename: 'modelo_territorios_sekundo.csv',
    canonicalCsv: [
      '_key,_type,label,value,email,_meta_json',
      '01,root,Território 01 - Centro,,,"{}"',
      '01-01,branch,Quadra 101 - Rua das Flores,,,"{}"',
      '01-01-01,leaf,Casa 101,1,,"{""worked"":1,""address"":""Rua das Flores, 101"",""line2"":""Fundos"",""bairro"":""Centro"",""city"":""Metrópole"",""state"":""PR"",""postalCode"":""80000-000"",""isForeign"":false,""propertyType"":""residencia"",""lat"":-25.4284,""lng"":-49.2733,""assignedAt"":""2026-06-01"",""completedAt"":""2026-06-14"",""workerName"":""Participante 01""}"',
      '01-01-02,leaf,Casa 105,0,,"{""worked"":0,""address"":""Rua das Flores, 105"",""line2"":"""",""bairro"":""Centro"",""city"":""Metrópole"",""state"":""PR"",""postalCode"":""80000-000"",""isForeign"":true,""propertyType"":""residencia"",""lat"":-25.4291,""lng"":-49.2740,""assignedAt"":""2026-10-01"",""notes"":""Fala Espanhol - Interessado""}"',
      '01-02,branch,Quadra 102 - Av Central,,,"{}"',
      '01-02-01,leaf,Edifício Horizonte Apto 21,0,,"{""worked"":0,""address"":""Av Central, 500"",""line2"":""Apto 21"",""bairro"":""Centro"",""city"":""Metrópole"",""state"":""PR"",""postalCode"":""80000-100"",""isForeign"":false,""propertyType"":""predio"",""lat"":-25.4312,""lng"":-49.2715}"',
      '01-02-02,leaf,Panificadora Alvorada,1,,"{""worked"":1,""address"":""Av Central, 550"",""line2"":""Térreo Comercial"",""bairro"":""Centro"",""city"":""Metrópole"",""state"":""PR"",""postalCode"":""80000-100"",""isForeign"":false,""propertyType"":""comercio"",""lat"":-25.4320,""lng"":-49.2722,""completedAt"":""2026-10-12"",""workerName"":""Participante 02""}"',
    ].join('\n'),
    cleanHumanCsv: [
      'key,tipo,nome,trabalhado,endereco,latitude,longitude,complemento,bairro,cidade,estado,cep,estrangeiro,tipo_imovel,responsavel,data_designacao,data_conclusao,observacoes',
      '01,raiz,Território 01 - Centro,,,,,,,,,,,,,,',
      '01-01,bloco,Quadra 101 - Rua das Flores,,,,,,,,,,,,,,',
      '01-01-01,item,Casa 101,1,"Rua das Flores, 101",-25.428400,-49.273300,Fundos,Centro,Metrópole,PR,80000-000,nao,residencia,Participante 01,2026-06-01,2026-06-14,',
      '01-01-02,item,Casa 105,0,"Rua das Flores, 105",-25.429100,-49.274000,,Centro,Metrópole,PR,80000-000,sim,residencia,,2026-10-01,,Fala Espanhol - Interessado',
      '01-02,bloco,Quadra 102 - Av Central,,,,,,,,,,,,,,',
      '01-02-01,item,Edifício Horizonte Apto 21,0,"Av Central, 500",-25.431200,-49.271500,Apto 21,Centro,Metrópole,PR,80000-100,nao,predio,,,,',
      '01-02-02,item,Panificadora Alvorada,1,"Av Central, 550",-25.432000,-49.272200,Térreo Comercial,Centro,Metrópole,PR,80000-100,nao,comercio,Participante 02,,2026-10-12,Visita concluída com sucesso',
    ].join('\n'),
    columnGuides: [
      { column: '_key / key', description: 'Código hierárquico único (ex: 01, 01-01, 01-01-01)', example: '01-01-01' },
      { column: '_type / tipo', description: 'root / branch / leaf (ou raiz / bloco / item)', example: 'leaf' },
      { column: 'label / nome', description: 'Título da quadra ou número da residência', example: 'Casa 101' },
      { column: 'value / trabalhado', description: '1 se já trabalhado, 0 ou vazio se pendente', example: '1' },
      { column: 'address / endereco', description: 'Endereço completo ou logradouro', example: 'Rua das Flores, 101' },
      { column: 'lat / latitude', description: 'Latitude decimal WGS84 para visualização no mapa', example: '-25.428400' },
      { column: 'lng / longitude', description: 'Longitude decimal WGS84 para visualização no mapa', example: '-49.273300' },
      { column: 'line2 / complemento', description: 'Complemento (Fundos, Sobrado, Apto 21, etc.)', example: 'Apto 21' },
      { column: 'bairro', description: 'Nome do bairro ou distrito', example: 'Centro' },
      { column: 'city / cidade', description: 'Nome do município', example: 'Metrópole' },
      { column: 'state / estado', description: 'Sigla da UF (2 letras)', example: 'PR' },
      { column: 'postalCode / cep', description: 'Código de Endereçamento Postal', example: '80000-000' },
      { column: 'isForeign / estrangeiro', description: 'Marcação se o atendimento requer outro idioma (sim / nao)', example: 'sim' },
      { column: 'propertyType / tipo_imovel', description: 'Tipo predial: residencia, comercio, predio', example: 'residencia' },
      { column: 'workerName / responsavel', description: 'Nome do operador/participante que realizou o atendimento', example: 'Participante 01' },
      { column: 'data_designacao', description: 'Data em que o setor/unidade foi alocado (AAAA-MM-DD)', example: '2026-06-01' },
      { column: 'data_conclusao', description: 'Data em que o setor/unidade foi concluído (AAAA-MM-DD)', example: '2026-06-14' },
      { column: 'observacoes', description: 'Anotações contextuais ou observações operacionais', example: 'Fala Espanhol' },
    ],
    keyConventions: 'Nível 1 (01) = Setor Geral; Nível 2 (01-01) = Quadra / Eixo; Nível 3 (01-01-01) = Unidade / Ponto de Atendimento com Coordenadas Cartográficas.',
  },

  roster_assignments: {
    engineId: 'roster_assignments',
    name: 'Escalas & Designações de Pessoal',
    category: 'Recursos Humanos & Operações de Equipe',
    description: 'Atribuição de apresentadores, relatores, coordenadores e salas com controle de confirmação, substitutos e duração.',
    suggestedFilename: 'modelo_escalas_pessoal_sekundo.csv',
    canonicalCsv: [
      '_key,_type,label,value,email,_meta_json',
      '01,root,Plenária Geral de Operações,,,"{}"',
      '01-01,branch,Sessão Matutina - Painel Principal,,,"{}"',
      '01-01-01,leaf,Apresentação de Abertura,Participante 01,alex@email.com,"{""assignedTo"":""Participante 01"",""room"":""Auditório Principal"",""durationMinutes"":15,""confirmed"":true,""materialReference"":""Diretriz Operacional 2026""}"',
      '01-01-02,leaf,Relatório Geral de Atividades,Participante 05,enzo@email.com,"{""assignedTo"":""Participante 05"",""room"":""Auditório Principal"",""durationMinutes"":10,""confirmed"":false}"',
      '01-02,branch,Workshops & Mesas Temáticas,,,"{}"',
      '01-02-01,leaf,Oficina de Boas Práticas,Participante 02,ana@email.com,"{""assignedTo"":""Participante 02"",""assistantTo"":""Participante 04"",""room"":""Sala de Treinamento B"",""durationMinutes"":45,""confirmed"":true}"',
      '01-02-02,leaf,Painel de Metodologia e Processos,Participante 03,caio@email.com,"{""assignedTo"":""Participante 03"",""room"":""Sala de Treinamento B"",""durationMinutes"":30,""confirmed"":true}"',
    ].join('\n'),
    cleanHumanCsv: [
      'key,tipo,parte,designado,email,assistente,sala,duracao_min,confirmado,referencia',
      '01,sessao,Plenária Geral de Operações,,,,,,,,',
      '01-01,secao,Sessão Matutina - Painel Principal,,,,,,,,',
      '01-01-01,item,Apresentação de Abertura,Participante 01,alex@email.com,,Auditório Principal,15,sim,Diretriz Operacional 2026',
      '01-01-02,item,Relatório Geral de Atividades,Participante 05,enzo@email.com,,Auditório Principal,10,nao,',
      '01-02,secao,Workshops & Mesas Temáticas,,,,,,,,',
      '01-02-01,item,Oficina de Boas Práticas,Participante 02,ana@email.com,Participante 04,Sala de Treinamento B,45,sim,Manual de Procedimentos',
      '01-02-02,item,Painel de Metodologia e Processos,Participante 03,caio@email.com,,Sala de Treinamento B,30,sim,Guia de Execução',
    ].join('\n'),
    columnGuides: [
      { column: '_key / key', description: 'Código sequencial da escala (ex: 01, 01-01, 01-01-01)', example: '01-01-01' },
      { column: 'label / parte', description: 'Título da função ou parte do programa', example: 'Apresentação Inicial' },
      { column: 'value / designado', description: 'Nome do integrante ou participante designado', example: 'Participante 01' },
      { column: 'email', description: 'E-mail do designado para notificações ou convites P2P', example: 'alex@email.com' },
      { column: 'assistente', description: 'Nome do ajudante ou parceiro da tarefa', example: 'Participante 04' },
      { column: 'sala', description: 'Local físico ou sala virtual da designação', example: 'Auditório Principal' },
      { column: 'duracao_min', description: 'Duração prevista da parte em minutos', example: '10' },
      { column: 'confirmado', description: 'Status de confirmação (sim / nao ou true / false)', example: 'sim' },
    ],
    keyConventions: 'Nível 1 = Evento / Reunião; Nível 2 = Seção temática; Nível 3 = Designação individual com tempo e pessoa.',
  },

  study_synthesis: {
    engineId: 'study_synthesis',
    name: 'Síntese de Estudos & Pesquisa em Grupo',
    category: 'Educação & Pesquisa Acadêmica',
    description: 'Coordenação de grupos de pesquisa com sínteses de membros, referências bibliográficas e sumário executivo integrado.',
    suggestedFilename: 'modelo_pesquisa_sintese_sekundo.csv',
    canonicalCsv: [
      '_key,_type,label,value,email,_meta_json',
      '01,root,Simpósio: Tecnologias Livres 2026,,,"{}"',
      '01-01,branch,Módulo 1: Bancos Vetoriais Offline,,,"{}"',
      '01-01-01,leaf,Benchmarking HNSW vs IVF,Dr. Aris,aris@lab.org,"{""researcherName"":""Dr. Aris"",""status"":""submitted"",""synthesisText"":""HNSW obteve 98% recall com latência sub-5ms em CPU local."",""keyFindings"":[""Zero dependência de GPU"",""Consumo de memória 45MB""]}"',
      '01-01-02,leaf,Quantização Int8 em WebAssembly,Participante 03,lucas@lab.org,"{""researcherName"":""Participante 03"",""status"":""in_progress"",""synthesisText"":""Em fase de testes comparativos."",""keyFindings"":[""Perda de acurácia menor que 1.1%""]}"',
      '01-02,branch,Módulo 2: Criptografia P2P Local-First,,,"{}"',
      '01-02-01,leaf,Auditoria XChaCha20-Poly1305,Helena Rios,helena@lab.org,"{""researcherName"":""Helena Rios"",""status"":""reviewed"",""synthesisText"":""Algoritmo validado contra ataques de replay e adulteração de tags."",""keyFindings"":[""Velocidade 3x superior ao AES em CPU mobile""]}"',
    ].join('\n'),
    cleanHumanCsv: [
      'key,tipo,tema,pesquisador,email,status,sintese,principais_achados,referencias',
      '01,raiz,Simpósio: Tecnologias Livres 2026,,,,,,,',
      '01-01,modulo,Módulo 1: Bancos Vetoriais Offline,,,,,,,',
      '01-01-01,topico,Benchmarking HNSW vs IVF,Dr. Aris,aris@lab.org,submitted,"HNSW obteve 98% recall com sub-5ms","Zero GPU; Consumo 45MB","Malkov (2018)"',
      '01-01-02,topico,Quantização Int8 em WebAssembly,Participante 03,lucas@lab.org,in_progress,"Em fase de testes comparativos","Perda < 1.1%","Wasm SIMD Spec"',
      '01-02,modulo,Módulo 2: Criptografia P2P Local-First,,,,,,,',
      '01-02-01,topico,Auditoria XChaCha20-Poly1305,Helena Rios,helena@lab.org,reviewed,"Validado contra ataques de replay","Velocidade 3x em mobile","RFC 8439"',
    ].join('\n'),
    columnGuides: [
      { column: '_key / key', description: 'Código do tema/subtema (ex: 01, 01-01, 01-01-01)', example: '01-01-01' },
      { column: 'label / tema', description: 'Título do tópico de pesquisa', example: 'Benchmarking HNSW vs IVF' },
      { column: 'pesquisador', description: 'Nome do pesquisador encarregado', example: 'Dr. Aris' },
      { column: 'status', description: 'pending | in_progress | submitted | reviewed', example: 'submitted' },
      { column: 'sintese', description: 'Texto da síntese e conclusões preliminares', example: 'HNSW obteve 98% recall...' },
      { column: 'principais_achados', description: 'Pontos-chave e descobertas principais', example: 'Zero GPU; Baixo consumo' },
    ],
    keyConventions: 'Nível 1 = Projeto geral; Nível 2 = Eixo de pesquisa; Nível 3 = Tópico com síntese do pesquisador.',
  },

  generic_wbs: {
    engineId: 'generic_wbs',
    name: 'Estrutura Analítica de Projeto Livre (WBS Universal)',
    category: 'Gestão de Projetos & Tarefas',
    description: 'Organização hierárquica livre para qualquer tipo de projeto, fases, entregáveis e checklists.',
    suggestedFilename: 'modelo_wbs_livre_sekundo.csv',
    canonicalCsv: [
      '_key,_type,label,value,email,_meta_json',
      '01,root,Lançamento de Software 2026,,,"{}"',
      '01-01,branch,Fase 1: Arquitetura Core,,,"{}"',
      '01-01-01,leaf,Definição de Tipos e Contratos,Concluído,dev1@empresa.com,"{}"',
      '01-01-02,leaf,Testes de Unidade de PathKey,Concluído,dev2@empresa.com,"{}"',
      '01-02,branch,Fase 2: Interface do Usuário,,,"{}"',
      '01-02-01,leaf,Telas Responsivas Web e Mobile,Em Andamento,ui@empresa.com,"{}"',
      '01-02-02,leaf,Checklist de Acessibilidade WCAG,Pendente,qa@empresa.com,"{}"',
    ].join('\n'),
    cleanHumanCsv: [
      'key,tipo,titulo,status,responsavel_email,observacoes',
      '01,projeto,Lançamento de Software 2026,,,',
      '01-01,fase,Fase 1: Arquitetura Core,,,',
      '01-01-01,tarefa,Definição de Tipos e Contratos,Concluído,dev1@empresa.com,100% coberto',
      '01-01-02,tarefa,Testes de Unidade de PathKey,Concluído,dev2@empresa.com,Vitest 123 passing',
      '01-02,fase,Fase 2: Interface do Usuário,,,',
      '01-02-01,tarefa,Telas Responsivas Web e Mobile,Em Andamento,ui@empresa.com,Expo Router',
      '01-02-02,tarefa,Checklist de Acessibilidade WCAG,Pendente,qa@empresa.com,Auditoria AA',
    ].join('\n'),
    columnGuides: [
      { column: '_key / key', description: 'Código WBS do entregável (01, 01-01, 01-01-01)', example: '01-01-01' },
      { column: 'label / titulo', description: 'Nome da fase ou tarefa', example: 'Definição de Tipos' },
      { column: 'value / status', description: 'Status ou porcentagem de conclusão', example: 'Concluído' },
      { column: 'email', description: 'E-mail do responsável pela tarefa', example: 'dev1@empresa.com' },
    ],
    keyConventions: 'Nível 1 = Macro Projeto; Nível 2 = Pacote de Trabalho / Fase; Nível 3 = Atividade executável.',
  },

  incident_command: {
    engineId: 'incident_command',
    name: 'Comando de Incidentes (FEMA ICS / NIMS)',
    category: 'Defesa Civil & Emergências',
    description: 'Cadeia de comando para emergências com span of control de Graicunas (3 a 7 subordinados), canais de rádio e alocação.',
    suggestedFilename: 'modelo_comando_incidentes_sekundo.csv',
    canonicalCsv: [
      '_key,_type,label,value,email,_meta_json',
      '01,root,Operação Enchente Sul (ICS-201),,,"{}"',
      '01-01,branch,Comando Unificado,,,"{""supervisorName"":""Cmt. Nogueira""}"',
      '01-01-01,leaf,Comandante do Incidente,Nogueira,nogueira@defesacivil.gov,"{""icsRole"":""INCIDENT_COMMANDER"",""radioChannel"":""Canal 1 (Comando)"",""allocatedPersonnel"":1}"',
      '01-01-02,leaf,Oficial de Segurança,Moreira,moreira@defesacivil.gov,"{""icsRole"":""SAFETY_OFFICER"",""radioChannel"":""Canal 2 (Segurança)"",""allocatedPersonnel"":4}"',
      '01-02,branch,Seção de Operações,,,"{""supervisorName"":""Maj. Cavalcanti""}"',
      '01-02-01,leaf,Divisão Alfa - Busca Aquática,Cavalcanti,cavalcanti@defesacivil.gov,"{""icsRole"":""OPERATIONS"",""radioChannel"":""Canal 3 (Operações)"",""allocatedPersonnel"":12}"',
      '01-02-02,leaf,Divisão Beta - Evacuação Terrestre,Peixoto,peixoto@defesacivil.gov,"{""icsRole"":""OPERATIONS"",""radioChannel"":""Canal 4 (Tático)"",""allocatedPersonnel"":8}"',
    ].join('\n'),
    cleanHumanCsv: [
      'key,tipo,funcao_ics,oficial,email,radio,efetivo,supervisor',
      '01,incidente,Operação Enchente Sul (ICS-201),,,,,',
      '01-01,secao,Comando Unificado,,,,,,Cmt. Nogueira',
      '01-01-01,posto,Comandante do Incidente,Nogueira,nogueira@defesacivil.gov,Canal 1 (Comando),1,Nogueira',
      '01-01-02,posto,Oficial de Segurança,Moreira,moreira@defesacivil.gov,Canal 2 (Segurança),4,Nogueira',
      '01-02,secao,Seção de Operações,,,,,,Maj. Cavalcanti',
      '01-02-01,posto,Divisão Alfa - Busca Aquática,Cavalcanti,cavalcanti@defesacivil.gov,Canal 3 (Operações),12,Maj. Cavalcanti',
      '01-02-02,posto,Divisão Beta - Evacuação Terrestre,Peixoto,peixoto@defesacivil.gov,Canal 4 (Tático),8,Maj. Cavalcanti',
    ].join('\n'),
    columnGuides: [
      { column: '_key / key', description: 'Código do posto no organograma ICS (01, 01-01, etc)', example: '01-01-01' },
      { column: 'label / funcao_ics', description: 'Função FEMA ICS (ex: INCIDENT_COMMANDER, OPERATIONS)', example: 'Comandante do Incidente' },
      { column: 'radio', description: 'Frequência ou canal do rádio VHF/UHF', example: 'Canal 1 (Comando)' },
      { column: 'efetivo', description: 'Número de profissionais ou brigadistas sob este posto', example: '12' },
    ],
    keyConventions: 'Nível 1 = Incidente; Nível 2 = Seção (Operações, Planejamento, Logística, Finanças); Nível 3 = Divisões e Forças-Tarefa.',
  },

  live_production_ros: {
    engineId: 'live_production_ros',
    name: 'Produção ao Vivo & Run-of-Show (Régie)',
    category: 'Eventos & Transmissões ao Vivo',
    description: 'Cronograma segundo a segundo para transmissões, shows e eventos presenciais, com cues técnicos e cálculo de atraso/drift.',
    suggestedFilename: 'modelo_run_of_show_sekundo.csv',
    canonicalCsv: [
      '_key,_type,label,value,email,_meta_json',
      '01,root,Transmissão Gala de Premiação 2026,,,"{}"',
      '01-01,branch,Bloco 1: Abertura e Keynote,,,"{}"',
      '01-01-01,leaf,Vídeo Teaser Institucional,VT 01,vt@regie.local,"{""plannedDurationSec"":180,""timingConstraint"":""HARD_START"",""videoCue"":""VT01_Abertura.mp4"",""audioCue"":""Trilha Master 5.1""}"',
      '01-01-02,leaf,Discurso de Boas-Vindas,Mestre de Cerimônia,mc@regie.local,"{""plannedDurationSec"":300,""talentName"":""Mestre de Cerimônia"",""talentStatus"":""ON_STAGE"",""lightingCue"":""Preset Cena 1 - Foco Palco Centro""}"',
      '01-01-03,leaf,Buffer Musical de Ajuste,DJ Live,dj@regie.local,"{""plannedDurationSec"":120,""isPadBuffer"":true,""audioCue"":""Fade out sob comando""}"',
      '01-02,branch,Bloco 2: Entrega de Troféus,,,"{}"',
      '01-02-01,leaf,Anúncio Categoria Revelação,Apresentador 2,ap@regie.local,"{""plannedDurationSec"":240,""timingConstraint"":""SOFT_START"",""videoCue"":""Slide Revelacao 2026""}"',
    ].join('\n'),
    cleanHumanCsv: [
      'key,tipo,elemento,duracao_seg,restricao,apresentador,cue_audio,cue_video,cue_iluminacao,pad_buffer',
      '01,show,Transmissão Gala de Premiação 2026,,,,,,,,',
      '01-01,bloco,Bloco 1: Abertura e Keynote,,,,,,,,',
      '01-01-01,cue,Vídeo Teaser Institucional,180,HARD_START,,Trilha Master 5.1,VT01_Abertura.mp4,,nao',
      '01-01-02,cue,Discurso de Boas-Vindas,300,SOFT_START,Mestre de Cerimônia,,Slide Logo,Preset Cena 1,nao',
      '01-01-03,cue,Buffer Musical de Ajuste,120,SOFT_START,DJ Live,Fade out sob comando,,,sim',
      '01-02,bloco,Bloco 2: Entrega de Troféus,,,,,,,,',
      '01-02-01,cue,Anúncio Categoria Revelação,240,SOFT_START,Apresentador 2,Vinheta Trofeu,Slide Revelacao,,nao',
    ].join('\n'),
    columnGuides: [
      { column: '_key / key', description: 'Código do momento da régie (01, 01-01, 01-01-01)', example: '01-01-01' },
      { column: 'duracao_seg', description: 'Duração exata prevista em segundos', example: '180' },
      { column: 'restricao', description: 'HARD_START | SOFT_START | HARD_OUT', example: 'HARD_START' },
      { column: 'cue_audio', description: 'Comando de som (áudio, microfones, trilha)', example: 'Trilha Master 5.1' },
      { column: 'cue_video', description: 'Arquivo ou switcher de vídeo', example: 'VT01_Abertura.mp4' },
      { column: 'cue_iluminacao', description: 'Preset ou mesa DMX de luz', example: 'Preset Cena 1' },
      { column: 'pad_buffer', description: 'sim se o momento pode ser encurtado se o show atrasar', example: 'sim' },
    ],
    keyConventions: 'Nível 1 = Transmissão/Evento; Nível 2 = Bloco/Segmento; Nível 3 = Cues técnicos de palco e régie.',
  },

  tournament_pairings: {
    engineId: 'tournament_pairings',
    name: 'Emparelhamento de Torneios & Competições',
    category: 'Esportes & Jogos Competitivos',
    description: 'Gestão de rodadas, mesas de xadrez/eSports, sistema suíço, eliminação, pontuações e BYE automático.',
    suggestedFilename: 'modelo_torneio_rodadas_sekundo.csv',
    canonicalCsv: [
      '_key,_type,label,value,email,_meta_json',
      '01,root,Campeonato Regional de Xadrez 2026,,,"{}"',
      '01-01,branch,Rodada 1 (Sistema Suíço),,,"{}"',
      '01-01-01,leaf,Mesa 1: GM Kasparov vs IM Anand,Kasparov,kasparov@fide.org,"{""roundIndex"":1,""boardNumber"":1,""contestantA"":""Kasparov"",""contestantB"":""Anand"",""scoreA"":1,""scoreB"":0,""winner"":""Kasparov""}"',
      '01-01-02,leaf,Mesa 2: Carlsen vs Nakamura,Carlsen,carlsen@fide.org,"{""roundIndex"":1,""boardNumber"":2,""contestantA"":""Carlsen"",""contestantB"":""Nakamura"",""scoreA"":0.5,""scoreB"":0.5}"',
      '01-01-03,leaf,Mesa 3: Polgar vs BYE,Polgar,polgar@fide.org,"{""roundIndex"":1,""boardNumber"":3,""contestantA"":""Polgar"",""isBye"":true,""scoreA"":1,""winner"":""Polgar""}"',
      '01-02,branch,Rodada 2 (Sistema Suíço),,,"{}"',
      '01-02-01,leaf,Mesa 1: Kasparov vs Carlsen,Pendente,,,"{""roundIndex"":2,""boardNumber"":1,""contestantA"":""Kasparov"",""contestantB"":""Carlsen""}"',
    ].join('\n'),
    cleanHumanCsv: [
      'key,tipo,partida,rodada,mesa,jogador_a,jogador_b,placar_a,placar_b,vencedor,is_bye',
      '01,torneio,Campeonato Regional de Xadrez 2026,,,,,,,,',
      '01-01,fase,Rodada 1 (Sistema Suíço),,,,,,,,',
      '01-01-01,mesa,Mesa 1: Kasparov vs Anand,1,1,Kasparov,Anand,1,0,Kasparov,nao',
      '01-01-02,mesa,Mesa 2: Carlsen vs Nakamura,1,2,Carlsen,Nakamura,0.5,0.5,Empate,nao',
      '01-01-03,mesa,Mesa 3: Polgar vs BYE,1,3,Polgar,,1,0,Polgar,sim',
      '01-02,fase,Rodada 2 (Sistema Suíço),,,,,,,,',
      '01-02-01,mesa,Mesa 1: Kasparov vs Carlsen,2,1,Kasparov,Carlsen,,,Pendente,nao',
    ].join('\n'),
    columnGuides: [
      { column: '_key / key', description: 'Código do confronto (01, 01-01, 01-01-01)', example: '01-01-01' },
      { column: 'rodada', description: 'Número sequencial da rodada', example: '1' },
      { column: 'mesa', description: 'Número do tabuleiro ou quadra/arena', example: '1' },
      { column: 'jogador_a / jogador_b', description: 'Nomes dos competidores', example: 'Kasparov vs Anand' },
      { column: 'placar_a / placar_b', description: 'Pontos conquistados na partida', example: '1 e 0' },
      { column: 'is_bye', description: 'sim se o competidor folga com ponto automático', example: 'sim' },
    ],
    keyConventions: 'Nível 1 = Campeonato Geral; Nível 2 = Rodada (Suíço ou Mata-mata); Nível 3 = Mesas e Confrontos.',
  },

  canvassing_logistics: {
    engineId: 'canvassing_logistics',
    name: 'Canvassing & Campanhas Porta a Porta',
    category: 'Mobilização Social & Campanhas',
    description: 'Campanhas de campo avançadas com 8 códigos padronizados (CNT, NH, REF, DNC, LAN, VAC, INA, HOS) e rota eLOT.',
    suggestedFilename: 'modelo_canvassing_campanhas_sekundo.csv',
    canonicalCsv: [
      '_key,_type,label,value,email,_meta_json',
      '01,root,Campanha Zona Norte - Setor 4,,,"{}"',
      '01-01,branch,Rua das Acácias (Pares),,,"{}"',
      '01-01-01,leaf,Nº 200,CNT,operador1@campanha.org,"{""contactCode"":""CNT"",""eLotOrder"":1,""canvasserName"":""Participante 02"",""lastVisitedAt"":""2026-10-11T10:15:00Z""}"',
      '01-01-02,leaf,Nº 204,NH,,,"{""contactCode"":""NH"",""eLotOrder"":2,""canvasserName"":""Participante 02""}"',
      '01-01-03,leaf,Nº 208,DNC,,,"{""contactCode"":""DNC"",""eLotOrder"":3,""canvasserName"":""Participante 02""}"',
      '01-01-04,leaf,Nº 212,LAN,,,"{""contactCode"":""LAN"",""foreignLanguage"":""Espanhol"",""eLotOrder"":4}"',
      '01-02,branch,Rua das Acácias (Ímpares),,,"{}"',
      '01-02-01,leaf,Nº 201,VAC,,,"{""contactCode"":""VAC"",""eLotOrder"":5}"',
    ].join('\n'),
    cleanHumanCsv: [
      'key,tipo,endereco_porta,codigo_contato,ordem_rota,voluntario,lingua_estrangeira,data_visita',
      '01,campanha,Campanha Zona Norte - Setor 4,,,,,,',
      '01-01,trecho,Rua das Acácias (Pares),,,,,,',
      '01-01-01,porta,Nº 200,CNT,1,Participante 02,,2026-10-11T10:15:00Z',
      '01-01-02,porta,Nº 204,NH,2,Participante 02,,',
      '01-01-03,porta,Nº 208,DNC,3,Participante 02,,',
      '01-01-04,porta,Nº 212,LAN,4,,Espanhol,',
      '01-02,trecho,Rua das Acácias (Ímpares),,,,,,',
      '01-02-01,porta,Nº 201,VAC,5,,,',
    ].join('\n'),
    columnGuides: [
      { column: '_key / key', description: 'Código do lote/porta (01, 01-01, 01-01-01)', example: '01-01-01' },
      { column: 'codigo_contato', description: 'CNT (Atendido), NH (Ausente), REF (Recusou), DNC (Não atender), LAN (Idioma), VAC (Vazio), INA (Acesso restrito), HOS (Restrição)', example: 'CNT' },
      { column: 'ordem_rota', description: 'Número de sequência do roteiro (eLOT)', example: '1' },
      { column: 'voluntario', description: 'Nome do recenseador/operador', example: 'Participante 02' },
      { column: 'lingua_estrangeira', description: 'Idioma caso o atendimento não seja em português', example: 'Espanhol' },
    ],
    keyConventions: 'Nível 1 = Região da Campanha; Nível 2 = Logradouro/Trecho com sequência par/ímpar; Nível 3 = Porta numerada.',
  },
  financial_ledger: {
    engineId: 'financial_ledger',
    name: 'Assistente Moeda (Finanças & Setores)',
    category: 'Finanças, Patrimônio & Setores',
    description: 'Controle financeiro soberano de receitas, despesas, investimentos FIRE, banco de tempo (waivers) e parcerias com integração API/Turso.',
    suggestedFilename: 'modelo_assistente_moeda_sekundo.csv',
    canonicalCsv: [
      '_key,_type,label,value,email,_meta_json',
      '01,root,🪙 Assistente Moeda — Orçamento Operacional,3 lançamentos,,"{""enginePartition"":""financial_ledger""}"',
      '01-01,item,Receita Operacional Semanal,1850,,"{""date"":""2026-10-10"",""amountBRL"":1850,""entryType"":""revenue"",""category"":""Operacional""}"',
      '01-02,item,Custo Operacional & Manutenção,420,,"{""date"":""2026-10-12"",""amountBRL"":420,""entryType"":""expense"",""category"":""Custos Fixos""}"',
      '01-03,item,Aporte Reserva Tesouro Selic,500,,"{""date"":""2026-10-15"",""amountBRL"":500,""entryType"":""deposit"",""category"":""Reserva""}"',
    ].join('\n'),
    cleanHumanCsv: [
      'key,tipo,descricao,valor,data,entry_type,categoria',
      '01,header,🪙 Assistente Moeda — Orçamento Operacional,,,,',
      '01-01,item,Receita Operacional Semanal,1850,2026-10-10,revenue,Operacional',
      '01-02,item,Custo Operacional & Manutenção,420,2026-10-12,expense,Custos Fixos',
      '01-03,item,Aporte Reserva Tesouro Selic,500,2026-10-15,deposit,Reserva',
    ].join('\n'),
    columnGuides: [
      { column: '_key / key', description: 'Código hierárquico do lançamento (01, 01-01)', example: '01-01' },
      { column: 'valor / value', description: 'Valor monetário em R$ (BRL)', example: '1850' },
      { column: 'entry_type', description: 'Tipo: revenue, expense, deposit, waiver, partner_in, partner_out', example: 'revenue' },
      { column: 'data', description: 'Data no formato YYYY-MM-DD', example: '2026-10-10' },
      { column: 'categoria', description: 'Categoria ou centro de custo', example: 'Operacional' },
    ],
    keyConventions: 'Nível 1 = Tabela Financeira; Nível 2 = Lançamento ou Categoria Setorial.',
  },
  transformer: {
    engineId: 'transformer',
    name: 'Engine Transformer (Metamórfica & Universal)',
    category: 'Universal & Metamórfico',
    description: 'Motor flexível onde você escolhe exatamente as colunas a guardar no CSV e ativa a matemática de qualquer outra Engine sob demanda.',
    suggestedFilename: 'modelo_transformer_sekundo.csv',
    canonicalCsv: [
      '_key,_type,label,value,email,_meta_json',
      '01,root,Projeto Metamórfico Global,,,"{}"',
      '01-01,branch,Módulo Operacional A,,,"{}"',
      '01-01-01,leaf,Atividade Alpha,1,,"{""endereco"":""Av Paulista, 1000"",""lat"":-23.5615,""lng"":-46.6560,""trabalhado"":1,""responsavel"":""Participante 01"",""duracao_min"":45,""estimativa_horas"":4,""progresso_pct"":100,""observacoes"":""Concluído com sucesso""}"',
      '01-01-02,leaf,Atividade Beta,0,,"{""endereco"":""Av Paulista, 1050"",""lat"":-23.5620,""lng"":-46.6552,""trabalhado"":0,""responsavel"":""Participante 02"",""duracao_min"":30,""estimativa_horas"":8,""progresso_pct"":25,""observacoes"":""Aguardando liberação""}"',
    ].join('\n'),
    cleanHumanCsv: [
      'key,tipo,nome,responsavel,duracao_min,trabalhado,endereco,latitude,longitude,estimativa_horas,progresso_pct,observacoes',
      '01,raiz,Projeto Metamórfico Global,,,,,,,,,',
      '01-01,bloco,Módulo Operacional A,,,,,,,,,',
      '01-01-01,item,Atividade Alpha,Participante 01,45,1,"Av Paulista, 1000",-23.561500,-46.656000,4,100,Concluído com sucesso',
      '01-01-02,item,Atividade Beta,Participante 02,30,0,"Av Paulista, 1050",-23.562000,-46.655200,8,25,Aguardando liberação',
    ].join('\n'),
    columnGuides: [
      { column: '_key / key', description: 'Código hierárquico estruturado (01, 01-01, 01-01-01)', example: '01-01-01' },
      { column: 'responsavel', description: 'Nome do responsável (usado no detector de conflitos e balanceamento)', example: 'Participante 01' },
      { column: 'duracao_min', description: 'Duração em minutos para cálculo de carga horária', example: '45' },
      { column: 'trabalhado', description: '1 se finalizado, 0 se pendente (ativa rollup de cobertura)', example: '1' },
      { column: 'endereco', description: 'Endereço físico para roteirização e coordenadas', example: 'Av Paulista, 1000' },
      { column: 'latitude', description: 'Latitude decimal WGS84 para plotagem no mapa', example: '-23.561500' },
      { column: 'longitude', description: 'Longitude decimal WGS84 para plotagem no mapa', example: '-46.656000' },
      { column: 'estimativa_horas', description: 'Esforço estimado para cálculo de WBS ponderado', example: '8' },
      { column: 'progresso_pct', description: 'Porcentagem de conclusão da tarefa (0 a 100)', example: '75' },
      { column: 'observacoes', description: 'Anotações contextuais livres', example: 'Observação da equipe' },
    ],
    keyConventions: 'Esquema metamórfico dinâmico: adicione ou remova qualquer coluna; o Transformer preserva tudo e executa as Leis Matemáticas ativas.',
  },
};

/**
 * Get CSV Template for a specific Universal Engine.
 */
export function getEngineTemplate(engineId: EngineId): EngineCSVTemplate {
  return ENGINE_TEMPLATES[engineId] || ENGINE_TEMPLATES.generic_wbs;
}

/**
 * List all available Engine CSV templates in canonical order.
 */
export function listEngineTemplates(): EngineCSVTemplate[] {
  return Object.values(ENGINE_TEMPLATES);
}

/**
 * Returns formatted CSV string for a given engine in requested format.
 */
export function exportTemplateCSV(
  engineId: EngineId,
  format: 'canonical' | 'clean_human' = 'canonical'
): string {
  const template = getEngineTemplate(engineId);
  return format === 'canonical' ? template.canonicalCsv : template.cleanHumanCsv;
}
