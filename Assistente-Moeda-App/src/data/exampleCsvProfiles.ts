import { WorkspacePresetType, InvestorProfileType } from '../core/types';
import { SectorId } from '../core/sectorRegistry';

export interface ExampleCSVProfile {
  id: string;
  code: string;
  fileName: string;
  title: string;
  shortTitle: string;
  subtitle: string;
  emoji: string;
  accentColor: string;
  presetId: WorkspacePresetType;
  investorProfileType: InvestorProfileType;
  activeSectors: SectorId[];
  recommendedFor: string[];
  keyFeatures: string[];
  /** CSV completo no padrão ## COIN ASSISTANT BACKUP v3 ## (inclui metas, perfil investidor, setores e linhas) */
  fullBackupV3Csv: string;
  /** CSV tabular direto (apenas cabeçalho de colunas + linhas) ideal para abrir no Excel/Google Sheets */
  compactSimpleCsv: string;
  /** Prompt estruturado pronto para a pessoa copiar e colar na sua própria IA junto com seus dados reais */
  aiBuilderPrompt: string;
}

function extractRowsBlock(fullBackupV3Csv: string): string {
  const marker = '## ROWS ##';
  const idx = fullBackupV3Csv.indexOf(marker);
  if (idx === -1) return fullBackupV3Csv.trim();
  return fullBackupV3Csv.slice(idx + marker.length).trim();
}

export function buildAiPromptForProfile(
  profile: ExampleCSVProfile,
  useFullBackupFormat: boolean = true
): string {
  const csvSample = useFullBackupFormat ? profile.fullBackupV3Csv.trim() : profile.compactSimpleCsv.trim();
  return [
    `Você é um assistente especialista em organização financeira e geração de arquivos CSV compatíveis com o aplicativo "Assistente Moeda".`,
    ``,
    `OBJETIVO:`,
    `Transformar os meus dados financeiros pessoais/empresariais (que vou colar logo abaixo) em um arquivo CSV válido seguindo EXATAMENTE a estrutura do perfil "${profile.title}".`,
    ``,
    `REGRAS OBRIGATÓRIAS DO FORMATO CSV:`,
    `1. Mantenha os blocos de cabeçalho (## COIN ASSISTANT BACKUP v3 ##, ## INVESTOR_PROFILE ## e ## ROWS ##) exatamente na mesma ordem do modelo.`,
    `2. Na seção ## ROWS ##, preserve exatamente estas 15 colunas na primeira linha:`,
    `   id,date,value,description,entryType,monthlyValue,monthCount,period_start,period_end,category,tags,metadata_json,ticker,quantity,unitPrice`,
    `3. Valores aceitos para "entryType":`,
    `   - revenue (receitas, salários, vendas, aluguéis recebidos, dividendos/proventos)`,
    `   - expense (despesas fixas, variáveis, impostos, compras, parcelas)`,
    `   - deposit (aportes em reserva de emergência, renda fixa, FIIs, ações, ETFs ou caixa corporativo)`,
    `   - waiver (abono de meta / folga programada / Banco de Tempo)`,
    `   - partner_in (entrada/aporte de sócio ou reembolso recebido)`,
    `   - partner_out (saída/repasse para sócio ou distribuição)`,
    `   - unresolved (lançamento pendente de confirmação)`,
    `4. "value" deve ser sempre um número positivo com ponto decimal (ex: 1450.00). Não use "R$" nem separador de milhar.`,
    `5. "date" deve estar no formato ISO YYYY-MM-DD (ex: 2026-10-05).`,
    `6. Para despesas anuais rateadas (ex: IPVA, Seguro, IPTU, Material Escolar, Anuidade), preencha: value (total anual), monthlyValue (valor mensal), monthCount (12), period_start (YYYY-01-01) e period_end (YYYY-12-31).`,
    `7. Para investimentos ("deposit" ou "revenue" de Proventos), preencha quando aplicável: ticker (ex: SELIC, IPCA2035, HGLG11, WEGE3, IVVB11), quantity e unitPrice, além de metadata_json com {"assetClass":"cash_reserves" | "fixed_income_ipca" | "real_estate_funds" | "equities_brazil" | "equities_global" | "business_capital"}.`,
    `8. Responda APENAS com o bloco de código \`\`\`csv ... \`\`\` pronto para copiar e importar no Assistente Moeda.`,
    ``,
    `=== MODELO DE REFERÊNCIA (${profile.fileName} - DADOS FICTÍCIOS) ===`,
    '```csv',
    csvSample,
    '```',
    ``,
    `=== MEUS DADOS PARA CONVERTER EM CSV ===`,
    `[COLE AQUI SEUS EXTRATOS, FATURAS, ANOTAÇÕES OU DESCREVA SUA ROTINA FINANCEIRA PARA SUA IA]`
  ].join('\n');
}

const CSV_01_SURVIVAL = `## COIN ASSISTANT BACKUP v3 ##
table_id,example_survival_family_01
api_key,am_sheet_example_fictitious
last_event_seq,0
name,Exemplo 01 - Orçamento Familiar & Reserva (Fictício)
description,Modelo fictício de controle doméstico para organizar contas fixas, reduzir gastos variáveis e construir reserva de emergência.
active_sectors,%5B%22core_cashflow%22%2C%22core_revenue%22%2C%22core_costs%22%2C%22core_goals%22%2C%22personal_finance%22%5D
dashboard_config,%7B%22preset%22%3A%22survival%22%2C%22widgetOrder%22%3A%5B%22month_summary%22%2C%22next_action%22%2C%22health_score%22%2C%22what_if%22%2C%22recent_activity%22%2C%22pillars%22%2C%22insights%22%2C%22lessons%22%2C%22quick_actions%22%2C%22investor_summary%22%2C%22sector_simulators%22%5D%2C%22hiddenWidgets%22%3A%5B%22investor_summary%22%2C%22sector_simulators%22%5D%7D
goal_global_daily,180
goal_global_weekly,1260
goal_global_annual,43200
goal_daily_2026,180
goal_weekly_2026,1260
goal_annual_2026,43200
## INVESTOR_PROFILE ##
profile_type,safety
emergency_fund_goal_months,6
fire_annual_multiplier,25
monthly_contribution_goal,500
## ROWS ##
id,date,value,description,entryType,monthlyValue,monthCount,period_start,period_end,category,tags,metadata_json,ticker,quantity,unitPrice
ex01-01,2026-08-05,4200.00,"SALARIO MENSAL EMPRESA EXEMPLO ALPHA (FICTICIO)",revenue,,,,,"Salário","renda_fixa,clt","{}",,,
ex01-02,2026-08-06,1450.00,"ALUGUEL RESIDENCIAL APTO VILA VERDE (FICTICIO)",expense,,,,,"Moradia","custo_fixo,aluguel","{}",,,
ex01-03,2026-08-07,320.00,"CONDOMINIO E AGUA RESIDENCIAL (FICTICIO)",expense,,,,,"Moradia","custo_fixo","{}",,,
ex01-04,2026-08-08,890.50,"COMPRA DO MES ATACADISTA BOMPRECO (FICTICIO)",expense,,,,,"Alimentação","mercado,essencial","{}",,,
ex01-05,2026-08-10,185.40,"CONTA DE ENERGIA ELETRICA (FICTICIO)",expense,,,,,"Utilidades","luz,custo_fixo","{}",,,
ex01-06,2026-08-12,119.90,"INTERNET FIBRA RESIDENCIAL (FICTICIO)",expense,,,,,"Utilidades","internet,custo_fixo","{}",,,
ex01-07,2026-08-15,650.00,"RENDA EXTRA ENCOMENDAS FIM DE SEMANA (FICTICIO)",revenue,,,,,"Renda Extra","extra,familiar","{}",,,
ex01-08,2026-08-18,240.00,"FARMACIA E MEDICAMENTOS USO CONTINUO (FICTICIO)",expense,,,,,"Saúde","farmacia,essencial","{}",,,
ex01-09,2026-08-22,210.00,"DELIVERY E LANCHES APLICATIVO (FICTICIO)",expense,,,,,"Lazer & Variáveis","delivery,variavel","{}",,,
ex01-10,2026-08-25,500.00,"APORTE CAIXINHA RESERVA DE EMERGENCIA 100% CDI",deposit,,,,,"Reserva de Emergência","reserva,liquidez,sankey","{""assetClass"":""cash_reserves""}",SELIC,1,500.00
ex01-11,2026-09-05,4200.00,"SALARIO MENSAL EMPRESA EXEMPLO ALPHA (FICTICIO)",revenue,,,,,"Salário","renda_fixa,clt","{}",,,
ex01-12,2026-09-06,1450.00,"ALUGUEL RESIDENCIAL APTO VILA VERDE (FICTICIO)",expense,,,,,"Moradia","custo_fixo,aluguel","{}",,,
ex01-13,2026-09-07,320.00,"CONDOMINIO E AGUA RESIDENCIAL (FICTICIO)",expense,,,,,"Moradia","custo_fixo","{}",,,
ex01-14,2026-09-09,845.20,"COMPRA DO MES ATACADISTA BOMPRECO (FICTICIO)",expense,,,,,"Alimentação","mercado,essencial","{}",,,
ex01-15,2026-09-10,172.80,"CONTA DE ENERGIA ELETRICA (FICTICIO)",expense,,,,,"Utilidades","luz,custo_fixo","{}",,,
ex01-16,2026-09-12,119.90,"INTERNET FIBRA RESIDENCIAL (FICTICIO)",expense,,,,,"Utilidades","internet,custo_fixo","{}",,,
ex01-17,2026-09-16,780.00,"RENDA EXTRA FREELA DESIGN GRAFICO (FICTICIO)",revenue,,,,,"Renda Extra","extra,familiar","{}",,,
ex01-18,2026-09-20,165.00,"TRANSPORTE PUBLICO E RECARGA BILHETE (FICTICIO)",expense,,,,,"Transporte","mobilidade","{}",,,
ex01-19,2026-09-25,600.00,"APORTE CAIXINHA RESERVA DE EMERGENCIA 100% CDI",deposit,,,,,"Reserva de Emergência","reserva,liquidez,sankey","{""assetClass"":""cash_reserves""}",SELIC,1,600.00
ex01-20,2026-10-05,4200.00,"SALARIO MENSAL EMPRESA EXEMPLO ALPHA (FICTICIO)",revenue,,,,,"Salário","renda_fixa,clt","{}",,,
ex01-21,2026-10-06,1450.00,"ALUGUEL RESIDENCIAL APTO VILA VERDE (FICTICIO)",expense,,,,,"Moradia","custo_fixo,aluguel","{}",,,
ex01-22,2026-10-07,320.00,"CONDOMINIO E AGUA RESIDENCIAL (FICTICIO)",expense,,,,,"Moradia","custo_fixo","{}",,,
ex01-23,2026-10-08,810.00,"COMPRA DO MES ATACADISTA BOMPRECO (FICTICIO)",expense,,,,,"Alimentação","mercado,essencial","{}",,,
ex01-24,2026-10-10,540.00,"MATERIAL ESCOLAR ANUAL RATEADO (12 MESES)",expense,45.00,12,2026-01-01,2026-12-31,"Educação","escola,anual","{}",,,
ex01-25,2026-10-12,720.00,"RENDA EXTRA ENCOMENDAS OUTUBRO (FICTICIO)",revenue,,,,,"Renda Extra","extra,familiar","{}",,,
ex01-26,2026-10-14,700.00,"APORTE TESOURO SELIC RESERVA FAMILIAR",deposit,,,,,"Reserva de Emergência","reserva,liquidez,monte_carlo","{""assetClass"":""cash_reserves""}",SELIC,1,700.00`;

const CSV_02_FREELANCER = `## COIN ASSISTANT BACKUP v3 ##
table_id,example_freelancer_autonomo_02
api_key,am_sheet_example_fictitious
last_event_seq,0
name,Exemplo 02 - Autônomo & Renda Variável (Fictício)
description,Modelo fictício para autônomos, criadores e freelancers com metas semanais, Banco de Tempo, abonos de descanso e despesas anuais rateadas.
active_sectors,%5B%22core_cashflow%22%2C%22core_revenue%22%2C%22core_costs%22%2C%22core_goals%22%2C%22core_predictions%22%2C%22personal_finance%22%5D
dashboard_config,%7B%22preset%22%3A%22freelancer%22%2C%22widgetOrder%22%3A%5B%22health_score%22%2C%22next_action%22%2C%22month_summary%22%2C%22pillars%22%2C%22insights%22%2C%22recent_activity%22%2C%22what_if%22%2C%22quick_actions%22%2C%22sector_simulators%22%2C%22investor_summary%22%2C%22lessons%22%5D%2C%22hiddenWidgets%22%3A%5B%22lessons%22%5D%7D
goal_global_daily,300
goal_global_weekly,2100
goal_global_annual,38400
goal_daily_2026,300
goal_weekly_2026,2100
goal_annual_2026,38400
## INVESTOR_PROFILE ##
profile_type,balanced
emergency_fund_goal_months,6
fire_annual_multiplier,25
monthly_contribution_goal,1200
## ROWS ##
id,date,value,description,entryType,monthlyValue,monthCount,period_start,period_end,category,tags,metadata_json,ticker,quantity,unitPrice
ex02-01,2026-08-03,1450.00,"PROJETO LANDING PAGE CLIENTE FICTICIO BETA",revenue,,,,,"Projetos","freela,web","{}",,,
ex02-02,2026-08-07,950.00,"MANUTENCAO MENSAL SISTEMA CLIENTE GAMA (FICTICIO)",revenue,,,,,"Recorrência","retainer,mensal","{}",,,
ex02-03,2026-08-10,1200.00,"LICENCA ANUAL SUITE DE DESIGN E CLOUD (12 MESES)",expense,100.00,12,2026-01-01,2026-12-31,"Infraestrutura","software,anual","{}",,,
ex02-04,2026-08-12,81.90,"GUIA DAS MEI SIMPLES NACIONAL (FICTICIO)",expense,,,,,"Impostos","mei,das","{}",,,
ex02-05,2026-08-14,1800.00,"CONSULTORIA UX SPRINT SEMANAL (FICTICIO)",revenue,,,,,"Consultoria","ux,sprint","{}",,,
ex02-06,2026-08-18,2150.00,"CUSTO DE VIDA MENSAL MORADIA E ALIMENTACAO (FICTICIO)",expense,,,,,"Custo Pessoal","moradia,mercado","{}",,,
ex02-07,2026-08-21,1100.00,"FREELA IDENTIDADE VISUAL MARCA SOLAR (FICTICIO)",revenue,,,,,"Projetos","design,branding","{}",,,
ex02-08,2026-08-25,1000.00,"APORTE RESERVA AUTONOMO TESOURO SELIC",deposit,,,,,"Investimentos","reserva,selic","{""assetClass"":""cash_reserves""}",SELIC,1,1000.00
ex02-09,2026-09-02,1600.00,"ENTREGA MODULO APP MOBILE CLIENTE DELTA (FICTICIO)",revenue,,,,,"Projetos","mobile,dev","{}",,,
ex02-10,2026-09-07,950.00,"MANUTENCAO MENSAL SISTEMA CLIENTE GAMA (FICTICIO)",revenue,,,,,"Recorrência","retainer,mensal","{}",,,
ex02-11,2026-09-10,600.00,"ABONO DE DESCANSO PROGRAMADO / FERIADO PROLONGADO",waiver,,,,,"Banco de Tempo","abono,folga","{}",,,
ex02-12,2026-09-12,81.90,"GUIA DAS MEI SIMPLES NACIONAL (FICTICIO)",expense,,,,,"Impostos","mei,das","{}",,,
ex02-13,2026-09-15,2400.00,"PROJETO E-COMMERCE COMPLETO LOJA EXEMPLO",revenue,,,,,"Projetos","ecommerce,web","{}",,,
ex02-14,2026-09-18,2200.00,"CUSTO DE VIDA MENSAL MORADIA E ALIMENTACAO (FICTICIO)",expense,,,,,"Custo Pessoal","moradia,mercado","{}",,,
ex02-15,2026-09-22,280.00,"COWORKING E INTERNET MOVEL DE BACKUP (FICTICIO)",expense,,,,,"Infraestrutura","coworking,operacional","{}",,,
ex02-16,2026-09-26,1200.00,"APORTE TESOURO IPCA+ 2035 APOSENTADORIA",deposit,,,,,"Investimentos","ipca,longo_prazo","{""assetClass"":""fixed_income_ipca""}",IPCA2035,1,1200.00
ex02-17,2026-10-02,1950.00,"SPRINT DESENVOLVIMENTO API CLIENTE OMEGA (FICTICIO)",revenue,,,,,"Projetos","backend,api","{}",,,
ex02-18,2026-10-05,950.00,"MANUTENCAO MENSAL SISTEMA CLIENTE GAMA (FICTICIO)",revenue,,,,,"Recorrência","retainer,mensal","{}",,,
ex02-19,2026-10-08,1350.00,"TREINAMENTO E MENTORIA TECNICA ONLINE (FICTICIO)",revenue,,,,,"Mentoria","aula,extra","{}",,,
ex02-20,2026-10-10,2180.00,"CUSTO DE VIDA MENSAL MORADIA E ALIMENTACAO (FICTICIO)",expense,,,,,"Custo Pessoal","moradia,mercado","{}",,,
ex02-21,2026-10-12,81.90,"GUIA DAS MEI SIMPLES NACIONAL (FICTICIO)",expense,,,,,"Impostos","mei,das","{}",,,
ex02-22,2026-10-14,1150.00,"COMPRA COTAS FII HGLG11 RENDA PASSIVA",deposit,,,,,"Investimentos","fii,renda_passiva","{""assetClass"":""real_estate_funds""}",HGLG11,7,164.28`;

const CSV_03_DRIVER = `## COIN ASSISTANT BACKUP v3 ##
table_id,example_driver_fleet_03
api_key,am_sheet_example_fictitious
last_event_seq,0
name,Exemplo 03 - Motorista de App & Frota TCO (Fictício)
description,Modelo fictício para motoristas de aplicativo, entregadores e gestores de frota com controle de CPK, combustível, manutenção Weibull e seguro anual rateado.
active_sectors,%5B%22core_cashflow%22%2C%22core_revenue%22%2C%22core_costs%22%2C%22core_goals%22%2C%22core_predictions%22%2C%22personal_finance%22%2C%22vehicles%22%5D
dashboard_config,%7B%22preset%22%3A%22freelancer%22%2C%22widgetOrder%22%3A%5B%22health_score%22%2C%22month_summary%22%2C%22sector_simulators%22%2C%22next_action%22%2C%22pillars%22%2C%22insights%22%2C%22recent_activity%22%2C%22what_if%22%2C%22quick_actions%22%2C%22investor_summary%22%2C%22lessons%22%5D%2C%22hiddenWidgets%22%3A%5B%22lessons%22%5D%7D
goal_global_daily,260
goal_global_weekly,1820
goal_global_annual,42000
goal_daily_2026,260
goal_weekly_2026,1820
goal_annual_2026,42000
## INVESTOR_PROFILE ##
profile_type,safety
emergency_fund_goal_months,6
fire_annual_multiplier,25
monthly_contribution_goal,600
## ROWS ##
id,date,value,description,entryType,monthlyValue,monthCount,period_start,period_end,category,tags,metadata_json,ticker,quantity,unitPrice
ex03-01,2026-08-03,1980.00,"GANHOS SEMANA 01 UBER E 99 POP (FICTICIO)",revenue,,,,,"Ganhos de Aplicativo","deadhead,tipo_viagem,cpk","{""milhas_km"":1120,""idveiculo"":""CAR01""}",,,
ex03-02,2026-08-04,540.00,"ABASTECIMENTO ETANOL/GASOLINA SEMANA 01 (FICTICIO)",expense,,,,,"Combustível","cpk,fuel,tco_vehicle","{""idveiculo"":""CAR01"",""litros"":95}",,,
ex03-03,2026-08-10,2120.00,"GANHOS SEMANA 02 UBER E PARTICULARES (FICTICIO)",revenue,,,,,"Ganhos de Aplicativo","deadhead,tipo_viagem,cpk","{""milhas_km"":1180,""idveiculo"":""CAR01""}",,,
ex03-04,2026-08-11,560.00,"ABASTECIMENTO POSTO ESTRELA SEMANA 02 (FICTICIO)",expense,,,,,"Combustível","cpk,fuel,tco_vehicle","{""idveiculo"":""CAR01"",""litros"":98}",,,
ex03-05,2026-08-15,2640.00,"SEGURO AUTO ANUAL PROTECAO TOTAL (12 MESES)",expense,220.00,12,2026-01-01,2026-12-31,"Documentação & Seguro","cpk,ubi,tco_vehicle","{""idveiculo"":""CAR01"",""perfil_msrp"":75000}",,,
ex03-06,2026-08-17,1890.00,"GANHOS SEMANA 03 APLICATIVOS (FICTICIO)",revenue,,,,,"Ganhos de Aplicativo","deadhead,tipo_viagem","{""milhas_km"":1050,""idveiculo"":""CAR01""}",,,
ex03-07,2026-08-18,510.00,"ABASTECIMENTO SEMANA 03 (FICTICIO)",expense,,,,,"Combustível","cpk,fuel,tco_vehicle","{""idveiculo"":""CAR01""}",,,
ex03-08,2026-08-22,420.00,"TROCA DE OLEO FILTROS E ALINHAMENTO PREVENTIVO",expense,,,,,"Manutenção Frota","cpk,weibull,tco_vehicle","{""idveiculo"":""CAR01"",""odometer"":45000}",,,
ex03-09,2026-08-24,2050.00,"GANHOS SEMANA 04 APLICATIVOS (FICTICIO)",revenue,,,,,"Ganhos de Aplicativo","deadhead,tipo_viagem","{""milhas_km"":1150,""idveiculo"":""CAR01""}",,,
ex03-10,2026-08-25,530.00,"ABASTECIMENTO SEMANA 04 (FICTICIO)",expense,,,,,"Combustível","cpk,fuel,tco_vehicle","{""idveiculo"":""CAR01""}",,,
ex03-11,2026-08-28,600.00,"APORTE FUNDO TROCA DE VEICULO E RESERVA CDI",deposit,,,,,"Reserva Frota","reserva,selic","{""assetClass"":""cash_reserves""}",SELIC,1,600.00
ex03-12,2026-09-07,2010.00,"GANHOS SEMANA 01 SETEMBRO APPS (FICTICIO)",revenue,,,,,"Ganhos de Aplicativo","deadhead,tipo_viagem","{""milhas_km"":1140,""idveiculo"":""CAR01""}",,,
ex03-13,2026-09-08,545.00,"ABASTECIMENTO SEMANA 01 SETEMBRO (FICTICIO)",expense,,,,,"Combustível","cpk,fuel,tco_vehicle","{""idveiculo"":""CAR01""}",,,
ex03-14,2026-09-14,1950.00,"GANHOS SEMANA 02 SETEMBRO APPS (FICTICIO)",revenue,,,,,"Ganhos de Aplicativo","deadhead,tipo_viagem","{""milhas_km"":1090,""idveiculo"":""CAR01""}",,,
ex03-15,2026-09-15,525.00,"ABASTECIMENTO SEMANA 02 SETEMBRO (FICTICIO)",expense,,,,,"Combustível","cpk,fuel,tco_vehicle","{""idveiculo"":""CAR01""}",,,
ex03-16,2026-09-18,260.00,"ABONO DIA DE OFICINA E REVISAO PROGRAMADA",waiver,,,,,"Banco de Tempo","abono,manutencao","{}",,,
ex03-17,2026-09-21,2180.00,"GANHOS SEMANA 03 SETEMBRO APPS E VIAGENS (FICTICIO)",revenue,,,,,"Ganhos de Aplicativo","deadhead,tipo_viagem","{""milhas_km"":1210,""idveiculo"":""CAR01""}",,,
ex03-18,2026-09-22,570.00,"ABASTECIMENTO SEMANA 03 SETEMBRO (FICTICIO)",expense,,,,,"Combustível","cpk,fuel,tco_vehicle","{""idveiculo"":""CAR01""}",,,
ex03-19,2026-09-28,650.00,"APORTE FUNDO DEPRECIACAO VEICULO TESOURO SELIC",deposit,,,,,"Reserva Frota","reserva,selic","{""assetClass"":""cash_reserves""}",SELIC,1,650.00
ex03-20,2026-10-05,2090.00,"GANHOS SEMANA 01 OUTUBRO APPS (FICTICIO)",revenue,,,,,"Ganhos de Aplicativo","deadhead,tipo_viagem","{""milhas_km"":1160,""idveiculo"":""CAR01""}",,,
ex03-21,2026-10-06,550.00,"ABASTECIMENTO SEMANA 01 OUTUBRO (FICTICIO)",expense,,,,,"Combustível","cpk,fuel,tco_vehicle","{""idveiculo"":""CAR01""}",,,
ex03-22,2026-10-12,2240.00,"GANHOS SEMANA 02 OUTUBRO APPS E EVENTOS (FICTICIO)",revenue,,,,,"Ganhos de Aplicativo","deadhead,tipo_viagem","{""milhas_km"":1240,""idveiculo"":""CAR01""}",,,
ex03-23,2026-10-13,580.00,"ABASTECIMENTO SEMANA 02 OUTUBRO (FICTICIO)",expense,,,,,"Combustível","cpk,fuel,tco_vehicle","{""idveiculo"":""CAR01""}",,,`;

const CSV_04_INVESTOR = `## COIN ASSISTANT BACKUP v3 ##
table_id,example_investor_fire_04
api_key,am_sheet_example_fictitious
last_event_seq,0
name,Exemplo 04 - Investidor & Carteira FIRE (Fictício)
description,Modelo fictício de acumulação patrimonial, proventos mensais (FIIs e Ações), alocação global e independência financeira (Regra dos 4%).
active_sectors,%5B%22core_cashflow%22%2C%22core_revenue%22%2C%22core_costs%22%2C%22core_goals%22%2C%22core_predictions%22%2C%22personal_finance%22%2C%22real_estate%22%2C%22legal_taxes%22%5D
dashboard_config,%7B%22preset%22%3A%22investor%22%2C%22widgetOrder%22%3A%5B%22investor_summary%22%2C%22health_score%22%2C%22month_summary%22%2C%22sector_simulators%22%2C%22pillars%22%2C%22insights%22%2C%22what_if%22%2C%22next_action%22%2C%22recent_activity%22%2C%22quick_actions%22%2C%22lessons%22%5D%2C%22hiddenWidgets%22%3A%5B%22lessons%22%2C%22quick_actions%22%5D%7D
goal_global_daily,450
goal_global_weekly,3150
goal_global_annual,66000
goal_daily_2026,450
goal_weekly_2026,3150
goal_annual_2026,66000
## INVESTOR_PROFILE ##
profile_type,balanced
emergency_fund_goal_months,6
fire_annual_multiplier,25
monthly_contribution_goal,3500
## ROWS ##
id,date,value,description,entryType,monthlyValue,monthCount,period_start,period_end,category,tags,metadata_json,ticker,quantity,unitPrice
ex04-01,2026-08-05,11500.00,"REMUNERACAO EXECUTIVA EMPRESA FICTICIA TECH",revenue,,,,,"Salário & Carreira","renda_principal","{}",,,
ex04-02,2026-08-08,5200.00,"CUSTO DE VIDA MENSAL CONSOLIDADO (MORADIA E CONTAS)",expense,,,,,"Custo de Vida","custo_fixo,sankey","{}",,,
ex04-03,2026-08-10,18000.00,"SALDO RESERVA DE EMERGENCIA TESOURO SELIC",deposit,,,,,"Investimentos","reserva,selic,monte_carlo","{""assetClass"":""cash_reserves""}",SELIC,12,1500.00
ex04-04,2026-08-12,24000.00,"POSICAO TESOURO IPCA+ 2035 PROTECAO INFLACAO",deposit,,,,,"Investimentos","ipca,renda_fixa,monte_carlo","{""assetClass"":""fixed_income_ipca""}",IPCA2035,10,2400.00
ex04-05,2026-08-14,16400.00,"CARTEIRA FII LOGISTICA HGLG11",deposit,,,,,"Investimentos","fii,renda_passiva,cap_rate","{""assetClass"":""real_estate_funds""}",HGLG11,100,164.00
ex04-06,2026-08-15,485.00,"DIVIDENDOS E RENDIMENTOS ISENTOS FIIs AGOSTO",revenue,,,,,"Proventos","dividendos,renda_passiva","{}",HGLG11,100,4.85
ex04-07,2026-08-18,15200.00,"CARTEIRA ACOES BRASIL WEGE3 E ITUB4",deposit,,,,,"Investimentos","acoes,b3,dividendos","{""assetClass"":""equities_brazil""}",WEGE3,400,38.00
ex04-08,2026-08-22,10500.00,"ETF S&P 500 EXTERIOR IVVB11",deposit,,,,,"Investimentos","global,dolar,fbar","{""assetClass"":""equities_global""}",IVVB11,35,300.00
ex04-09,2026-09-05,11500.00,"REMUNERACAO EXECUTIVA EMPRESA FICTICIA TECH",revenue,,,,,"Salário & Carreira","renda_principal","{}",,,
ex04-10,2026-09-08,5350.00,"CUSTO DE VIDA MENSAL CONSOLIDADO SETEMBRO",expense,,,,,"Custo de Vida","custo_fixo,sankey","{}",,,
ex04-11,2026-09-15,540.00,"PROVENTOS FIIs E JCP ACOES SETEMBRO",revenue,,,,,"Proventos","dividendos,renda_passiva","{}",MXRF11,500,1.08
ex04-12,2026-09-20,3500.00,"APORTE MENSAL FII KNCR11 RENDA IMOBILIARIA",deposit,,,,,"Investimentos","fii,aporte","{""assetClass"":""real_estate_funds""}",KNCR11,35,100.00
ex04-13,2026-10-05,11500.00,"REMUNERACAO EXECUTIVA EMPRESA FICTICIA TECH",revenue,,,,,"Salário & Carreira","renda_principal","{}",,,
ex04-14,2026-10-08,5100.00,"CUSTO DE VIDA MENSAL CONSOLIDADO OUTUBRO",expense,,,,,"Custo de Vida","custo_fixo,sankey","{}",,,
ex04-15,2026-10-12,610.00,"RENDIMENTOS DE FIIs E DIVIDENDOS OUTUBRO",revenue,,,,,"Proventos","dividendos,renda_passiva","{}",TAEE11,200,3.05
ex04-16,2026-10-14,3800.00,"APORTE MENSAL ETF GLOBAL WRLD11",deposit,,,,,"Investimentos","global,etf,monte_carlo","{""assetClass"":""equities_global""}",WRLD11,38,100.00`;

const CSV_05_SMB = `## COIN ASSISTANT BACKUP v3 ##
table_id,example_smb_business_05
api_key,am_sheet_example_fictitious
last_event_seq,0
name,Exemplo 05 - PME, Comércio & Sócios (Fictício)
description,Modelo empresarial fictício com faturamento B2B, folha CLT, pró-labore (Fator R), capital de giro (NCG/CFaR), impostos e conta-corrente de sócios.
active_sectors,%5B%22core_cashflow%22%2C%22core_revenue%22%2C%22core_costs%22%2C%22core_goals%22%2C%22core_predictions%22%2C%22smb_accounting%22%2C%22legal_taxes%22%2C%22vehicles%22%2C%22real_estate%22%2C%22personal_finance%22%5D
dashboard_config,%7B%22preset%22%3A%22smb%22%2C%22widgetOrder%22%3A%5B%22month_summary%22%2C%22sector_simulators%22%2C%22health_score%22%2C%22insights%22%2C%22pillars%22%2C%22recent_activity%22%2C%22next_action%22%2C%22investor_summary%22%2C%22what_if%22%2C%22quick_actions%22%2C%22lessons%22%5D%2C%22hiddenWidgets%22%3A%5B%22lessons%22%5D%7D
goal_global_daily,1500
goal_global_weekly,10500
goal_global_annual,312000
goal_daily_2026,1500
goal_weekly_2026,10500
goal_annual_2026,312000
## INVESTOR_PROFILE ##
profile_type,smb_hybrid
emergency_fund_goal_months,12
fire_annual_multiplier,25
monthly_contribution_goal,4000
## ROWS ##
id,date,value,description,entryType,monthlyValue,monthCount,period_start,period_end,category,tags,metadata_json,ticker,quantity,unitPrice
ex05-01,2026-08-05,48500.00,"FATURAMENTO CONTRATOS B2B ESTUDIO HORIZONTE (FICTICIO)",revenue,,,,,"Receita de Vendas","ncg,welford,rolling_margin","{""massa_salarial_12"":168000,""receita_bruta_12"":560000}",,,
ex05-02,2026-08-06,8200.00,"FOLHA DE PAGAMENTO EQUIPE CLT E ENCARGOS (FICTICIO)",expense,,,,,"Massa Salarial","fap_rat,payroll_tax,fator_r","{}",,,
ex05-03,2026-08-07,6000.00,"PRO-LABORE SOCIOS ADMINISTRADORES (OTIMIZACAO FATOR R)",expense,,,,,"Retiradas","fator_r,irpf_2026,simples_nacional","{}",,,
ex05-04,2026-08-10,3800.00,"ALUGUEL COMERCIAL E CONDOMINIO SEDE (FICTICIO)",expense,,,,,"Infraestrutura","custo_fixo,aluguel","{}",,,
ex05-05,2026-08-15,9400.00,"FORNECEDORES E INSUMOS DE PRODUCAO (FICTICIO)",expense,,,,,"Fornecedores","ncg,cmv","{}",,,
ex05-06,2026-08-20,3150.00,"GUIA DAS SIMPLES NACIONAL ANEXO III (FICTICIO)",expense,,,,,"Impostos","simples_nacional,fator_r","{}",,,
ex05-07,2026-08-22,2500.00,"APORTE TEMPORARIO SOCIO A PARA COMPRA DE EQUIPAMENTO",partner_in,,,,,"Sócios","partner,aporte_socio","{}",,,
ex05-08,2026-08-28,5000.00,"RESERVA CAPITAL DE GIRO PME CDB LIQUIDEZ DIARIA",deposit,,,,,"Capital de Giro","ncg,cfar,business_capital","{""assetClass"":""business_capital""}",CDI,1,5000.00
ex05-09,2026-09-05,52400.00,"FATURAMENTO VENDAS E SERVICOS SETEMBRO (FICTICIO)",revenue,,,,,"Receita de Vendas","ncg,welford,rolling_margin","{""massa_salarial_12"":170000,""receita_bruta_12"":575000}",,,
ex05-10,2026-09-06,8200.00,"FOLHA DE PAGAMENTO EQUIPE CLT E ENCARGOS (FICTICIO)",expense,,,,,"Massa Salarial","fap_rat,payroll_tax,fator_r","{}",,,
ex05-11,2026-09-07,6000.00,"PRO-LABORE SOCIOS ADMINISTRADORES (OTIMIZACAO FATOR R)",expense,,,,,"Retiradas","fator_r,irpf_2026,simples_nacional","{}",,,
ex05-12,2026-09-10,3800.00,"ALUGUEL COMERCIAL E CONDOMINIO SEDE (FICTICIO)",expense,,,,,"Infraestrutura","custo_fixo,aluguel","{}",,,
ex05-13,2026-09-16,10200.00,"FORNECEDORES E REPOSICAO DE ESTOQUE (FICTICIO)",expense,,,,,"Fornecedores","ncg,cmv","{}",,,
ex05-14,2026-09-20,3400.00,"GUIA DAS SIMPLES NACIONAL ANEXO III (FICTICIO)",expense,,,,,"Impostos","simples_nacional,fator_r","{}",,,
ex05-15,2026-09-25,2500.00,"REEMBOLSO AO SOCIO A REFERENTE ADIANTAMENTO AGOSTO",partner_out,,,,,"Sócios","partner,reembolso_socio","{}",,,
ex05-16,2026-09-28,6000.00,"APORTE RESERVA DE CONTINGENCIA EMPRESARIAL",deposit,,,,,"Capital de Giro","ncg,cfar,business_capital","{""assetClass"":""business_capital""}",CDI,1,6000.00
ex05-17,2026-10-05,55800.00,"FATURAMENTO VENDAS E CONTRATOS OUTUBRO (FICTICIO)",revenue,,,,,"Receita de Vendas","ncg,welford,rolling_margin","{""massa_salarial_12"":172000,""receita_bruta_12"":590000}",,,
ex05-18,2026-10-06,8200.00,"FOLHA DE PAGAMENTO EQUIPE CLT E ENCARGOS (FICTICIO)",expense,,,,,"Massa Salarial","fap_rat,payroll_tax,fator_r","{}",,,
ex05-19,2026-10-07,6000.00,"PRO-LABORE SOCIOS ADMINISTRADORES (OTIMIZACAO FATOR R)",expense,,,,,"Retiradas","fator_r,irpf_2026,simples_nacional","{}",,,
ex05-20,2026-10-10,3800.00,"ALUGUEL COMERCIAL E CONDOMINIO SEDE (FICTICIO)",expense,,,,,"Infraestrutura","custo_fixo,aluguel","{}",,,
ex05-21,2026-10-12,9800.00,"FORNECEDORES E LOGISTICA DE ENTREGA (FICTICIO)",expense,,,,,"Fornecedores","ncg,cmv","{}",,,
ex05-22,2026-10-14,4500.00,"APORTE TESOURO SELIC CAIXA CORPORATIVO PME",deposit,,,,,"Reserva Corporativa","reserva,selic","{""assetClass"":""cash_reserves""}",SELIC,1,4500.00`;

const CSV_06_REAL_ESTATE = `## COIN ASSISTANT BACKUP v3 ##
table_id,example_real_estate_06
api_key,am_sheet_example_fictitious
last_event_seq,0
name,Exemplo 06 - Imóveis, Aluguéis & Financiamento SAC (Fictício)
description,Modelo fictício voltado para gestão de imóveis de renda, locação por temporada, amortização SAC vs PRICE e Cap Rate imobiliário.
active_sectors,%5B%22core_cashflow%22%2C%22core_revenue%22%2C%22core_costs%22%2C%22core_goals%22%2C%22personal_finance%22%2C%22real_estate%22%2C%22legal_taxes%22%5D
dashboard_config,%7B%22preset%22%3A%22investor%22%2C%22widgetOrder%22%3A%5B%22sector_simulators%22%2C%22month_summary%22%2C%22investor_summary%22%2C%22health_score%22%2C%22pillars%22%2C%22insights%22%2C%22recent_activity%22%2C%22what_if%22%2C%22next_action%22%2C%22quick_actions%22%2C%22lessons%22%5D%2C%22hiddenWidgets%22%3A%5B%22lessons%22%5D%7D
goal_global_daily,320
goal_global_weekly,2240
goal_global_annual,39000
goal_daily_2026,320
goal_weekly_2026,2240
goal_annual_2026,39000
## INVESTOR_PROFILE ##
profile_type,income
emergency_fund_goal_months,6
fire_annual_multiplier,25
monthly_contribution_goal,2500
## ROWS ##
id,date,value,description,entryType,monthlyValue,monthCount,period_start,period_end,category,tags,metadata_json,ticker,quantity,unitPrice
ex06-01,2026-08-05,3200.00,"RECEITA ALUGUEL APTO JARDINS UNIDADE 102 (FICTICIO)",revenue,,,,,"Aluguéis","rental_income,cap_rate","{""property_value"":520000,""monthly_rent"":3200}",,,
ex06-02,2026-08-08,2450.00,"RECEITA LOCACAO SALA COMERCIAL CENTRO (FICTICIO)",revenue,,,,,"Aluguéis","rental_income,cap_rate","{""property_value"":380000,""monthly_rent"":2450}",,,
ex06-03,2026-08-10,2890.00,"PARCELA FINANCIAMENTO IMOBILIARIO SISTEMA SAC (24/180)",expense,,,,,"Financiamento Imobiliário","sistema_sac,tabela_price,ross_heidecke","{""property_value"":520000,""installment_no"":24}",,,
ex06-04,2026-08-15,1800.00,"IPTU E SEGURO RESIDENCIAL ANUAL RATEADO (12 MESES)",expense,150.00,12,2026-01-01,2026-12-31,"Imóveis","iptu,cap_rate","{}",,,
ex06-05,2026-08-20,2200.00,"APORTE FUNDO IMOBILIARIO KNRI11 RENDA MENSAL",deposit,,,,,"Investimentos","fii,cap_rate,renda_passiva","{""assetClass"":""real_estate_funds""}",KNRI11,15,146.67
ex06-06,2026-09-05,3200.00,"RECEITA ALUGUEL APTO JARDINS UNIDADE 102 (FICTICIO)",revenue,,,,,"Aluguéis","rental_income,cap_rate","{""property_value"":520000,""monthly_rent"":3200}",,,
ex06-07,2026-09-08,2450.00,"RECEITA LOCACAO SALA COMERCIAL CENTRO (FICTICIO)",revenue,,,,,"Aluguéis","rental_income,cap_rate","{""property_value"":380000,""monthly_rent"":2450}",,,
ex06-08,2026-09-10,2875.00,"PARCELA FINANCIAMENTO IMOBILIARIO SISTEMA SAC (25/180)",expense,,,,,"Financiamento Imobiliário","sistema_sac,tabela_price,ross_heidecke","{""property_value"":520000,""installment_no"":25}",,,
ex06-09,2026-09-14,1950.00,"LOCACAO TEMPORADA STUDIO PRAIA (FICTICIO)",revenue,,,,,"Temporada","rental_income,cap_rate","{}",,,
ex06-10,2026-09-18,480.00,"MANUTENCAO HIDRAULICA E PINTURA PREVENTIVA IMOVEL",expense,,,,,"Manutenção Imóvel","ross_heidecke,cap_rate","{}",,,
ex06-11,2026-09-25,2500.00,"AMORTIZACAO EXTRAORDINARIA FINANCIAMENTO SAC + APORTE FII",deposit,,,,,"Investimentos","sistema_sac,fii","{""assetClass"":""real_estate_funds""}",HGLG11,15,166.67
ex06-12,2026-10-05,3200.00,"RECEITA ALUGUEL APTO JARDINS UNIDADE 102 (FICTICIO)",revenue,,,,,"Aluguéis","rental_income,cap_rate","{""property_value"":520000,""monthly_rent"":3200}",,,
ex06-13,2026-10-08,2450.00,"RECEITA LOCACAO SALA COMERCIAL CENTRO (FICTICIO)",revenue,,,,,"Aluguéis","rental_income,cap_rate","{""property_value"":380000,""monthly_rent"":2450}",,,
ex06-14,2026-10-10,2860.00,"PARCELA FINANCIAMENTO IMOBILIARIO SISTEMA SAC (26/180)",expense,,,,,"Financiamento Imobiliário","sistema_sac,tabela_price,ross_heidecke","{""property_value"":520000,""installment_no"":26}",,,
ex06-15,2026-10-14,2600.00,"APORTE RESERVA DE VACANCIA E MANUTENCAO SELIC",deposit,,,,,"Reserva Imobiliária","reserva,selic","{""assetClass"":""cash_reserves""}",SELIC,1,2600.00`;

const CSV_07_LIBERAL = `## COIN ASSISTANT BACKUP v3 ##
table_id,example_liberal_tax_07
api_key,am_sheet_example_fictitious
last_event_seq,0
name,Exemplo 07 - Profissional Liberal, Médico & Advogado (Fator R)
description,Modelo fictício para clínicas, médicos, advogados e consultores PJ focados em eficiência tributária (Fator R 28%, Livro-Caixa e PGBL/IRPF).
active_sectors,%5B%22core_cashflow%22%2C%22core_revenue%22%2C%22core_costs%22%2C%22core_goals%22%2C%22personal_finance%22%2C%22legal_taxes%22%2C%22smb_accounting%22%5D
dashboard_config,%7B%22preset%22%3A%22smb%22%2C%22widgetOrder%22%3A%5B%22sector_simulators%22%2C%22health_score%22%2C%22month_summary%22%2C%22investor_summary%22%2C%22pillars%22%2C%22insights%22%2C%22recent_activity%22%2C%22what_if%22%2C%22next_action%22%2C%22quick_actions%22%2C%22lessons%22%5D%2C%22hiddenWidgets%22%3A%5B%22lessons%22%5D%7D
goal_global_daily,800
goal_global_weekly,5600
goal_global_annual,120000
goal_daily_2026,800
goal_weekly_2026,5600
goal_annual_2026,120000
## INVESTOR_PROFILE ##
profile_type,balanced
emergency_fund_goal_months,6
fire_annual_multiplier,25
monthly_contribution_goal,4000
## ROWS ##
id,date,value,description,entryType,monthlyValue,monthCount,period_start,period_end,category,tags,metadata_json,ticker,quantity,unitPrice
ex07-01,2026-08-05,24000.00,"HONORARIOS E CONSULTAS CLINICA / ESCRITORIO EXEMPLO (FICTICIO)",revenue,,,,,"Honorários Profissionais","fator_r,simples_nacional,irpf_2026","{""massa_salarial_12"":84000,""receita_bruta_12"":288000}",,,
ex07-02,2026-08-07,7000.00,"PRO-LABORE E FOLHA SECRETARIA (META FATOR R >= 28%)",expense,,,,,"Pró-Labore & Folha","fator_r,irpf_2026,simples_nacional","{""massa_salarial_12"":84000,""receita_bruta_12"":288000}",,,
ex07-03,2026-08-10,2600.00,"ALUGUEL SALA CLINICA E CONDOMINIO DEDUTIVEL (FICTICIO)",expense,,,,,"Livro-Caixa Dedutível","custo_fixo,livro_caixa","{}",,,
ex07-04,2026-08-15,1080.00,"ANUIDADE CONSELHO DE CLASSE E SEGURO RC PROFISSIONAL (12M)",expense,90.00,12,2026-01-01,2026-12-31,"Conselho & Seguros","anuidade,dedutivel","{}",,,
ex07-05,2026-08-20,1440.00,"IMPOSTO SIMPLES NACIONAL ANEXO III REDUZIDO (FICTICIO)",expense,,,,,"Impostos","simples_nacional,fator_r","{}",,,
ex07-06,2026-08-25,3500.00,"APORTE PREVIDENCIA PGBL (BENEFICIO DEDUCAO 12% IRPF)",deposit,,,,,"Previdência & Investimentos","irpf_2026,pgbl,fixed_income_ipca","{""assetClass"":""fixed_income_ipca""}",IPCA2035,1,3500.00
ex07-07,2026-09-05,25500.00,"HONORARIOS E PROCEDIMENTOS SETEMBRO (FICTICIO)",revenue,,,,,"Honorários Profissionais","fator_r,simples_nacional,irpf_2026","{""massa_salarial_12"":85500,""receita_bruta_12"":295000}",,,
ex07-08,2026-09-07,7200.00,"PRO-LABORE E FOLHA SECRETARIA SETEMBRO (FATOR R >= 28%)",expense,,,,,"Pró-Labore & Folha","fator_r,irpf_2026,simples_nacional","{}",,,
ex07-09,2026-09-10,2600.00,"ALUGUEL SALA CLINICA E CONDOMINIO DEDUTIVEL (FICTICIO)",expense,,,,,"Livro-Caixa Dedutível","custo_fixo,livro_caixa","{}",,,
ex07-10,2026-09-20,1530.00,"IMPOSTO SIMPLES NACIONAL ANEXO III SETEMBRO (FICTICIO)",expense,,,,,"Impostos","simples_nacional,fator_r","{}",,,
ex07-11,2026-09-25,4000.00,"APORTE RESERVA LIQUIDEZ E FUNDO IMOBILIARIO",deposit,,,,,"Investimentos","fii,reserva","{""assetClass"":""real_estate_funds""}",HGLG11,25,160.00
ex07-12,2026-10-05,26200.00,"HONORARIOS E CONSULTAS OUTUBRO (FICTICIO)",revenue,,,,,"Honorários Profissionais","fator_r,simples_nacional,irpf_2026","{""massa_salarial_12"":87000,""receita_bruta_12"":302000}",,,
ex07-13,2026-10-07,7400.00,"PRO-LABORE E FOLHA SECRETARIA OUTUBRO (FATOR R >= 28%)",expense,,,,,"Pró-Labore & Folha","fator_r,irpf_2026,simples_nacional","{}",,,
ex07-14,2026-10-10,2600.00,"ALUGUEL SALA CLINICA E CONDOMINIO DEDUTIVEL (FICTICIO)",expense,,,,,"Livro-Caixa Dedutível","custo_fixo,livro_caixa","{}",,,
ex07-15,2026-10-14,4200.00,"APORTE TESOURO SELIC RESERVA TRIBUTARIA E PATRIMONIO",deposit,,,,,"Investimentos","reserva,selic","{""assetClass"":""cash_reserves""}",SELIC,1,4200.00`;

const CSV_08_UNIVERSAL_TEMPLATE = `## COIN ASSISTANT BACKUP v3 ##
table_id,example_ai_universal_template_08
api_key,am_sheet_example_fictitious
last_event_seq,0
name,Exemplo 08 - Modelo Universal para Montar com Sua IA (Fictício)
description,Template autodocumentado com 1 exemplo de cada tipo de lançamento suportado pelo Assistente Moeda para servir de gabarito para sua IA pessoal.
active_sectors,%5B%22core_cashflow%22%2C%22core_revenue%22%2C%22core_costs%22%2C%22core_goals%22%2C%22core_predictions%22%2C%22personal_finance%22%5D
goal_global_daily,250
goal_global_weekly,1750
goal_global_annual,45000
## INVESTOR_PROFILE ##
profile_type,balanced
emergency_fund_goal_months,6
fire_annual_multiplier,25
monthly_contribution_goal,1000
## ROWS ##
id,date,value,description,entryType,monthlyValue,monthCount,period_start,period_end,category,tags,metadata_json,ticker,quantity,unitPrice
tpl-01,2026-10-01,3500.00,"EXEMPLO RECEITA PONTUAL (SALARIO OU VENDA FICTICIA)",revenue,,,,,"Receitas","exemplo,receita","{}",,,
tpl-02,2026-10-02,1200.00,"EXEMPLO DESPESA FIXA MENSAL (ALUGUEL FICTICIO)",expense,,,,,"Moradia","exemplo,custo_fixo","{}",,,
tpl-03,2026-10-03,240.50,"EXEMPLO DESPESA VARIAVEL (SUPERMERCADO FICTICIO)",expense,,,,,"Alimentação","exemplo,variavel","{}",,,
tpl-04,2026-10-04,1800.00,"EXEMPLO DESPESA ANUAL RATEADA (SEGURO 12 MESES)",expense,150.00,12,2026-01-01,2026-12-31,"Seguros","exemplo,anual","{}",,,
tpl-05,2026-10-05,1000.00,"EXEMPLO APORTE EM RESERVA DE EMERGENCIA (SELIC)",deposit,,,,,"Investimentos","exemplo,reserva","{""assetClass"":""cash_reserves""}",SELIC,1,1000.00
tpl-06,2026-10-06,820.00,"EXEMPLO COMPRA DE ATIVO COM TICKER (5 COTAS FII)",deposit,,,,,"Investimentos","exemplo,fii","{""assetClass"":""real_estate_funds""}",HGLG11,5,164.00
tpl-07,2026-10-07,250.00,"EXEMPLO ABONO DE META / FOLGA JUSTIFICADA (WAIVER)",waiver,,,,,"Banco de Tempo","exemplo,abono","{}",,,
tpl-08,2026-10-08,500.00,"EXEMPLO ENTRADA DE PARCERIA / REEMBOLSO DE SOCIO",partner_in,,,,,"Parcerias","exemplo,socio","{}",,,
tpl-09,2026-10-09,500.00,"EXEMPLO SAIDA DE PARCERIA / REPASSE A SOCIO",partner_out,,,,,"Parcerias","exemplo,socio","{}",,,
tpl-10,2026-10-10,89.90,"EXEMPLO ITEM EM QUARENTENA PARA REVISAR DEPOIS",unresolved,,,,,"Pendentes","exemplo,revisar","{}",,,`;

const RAW_PROFILES: Omit<ExampleCSVProfile, 'compactSimpleCsv' | 'aiBuilderPrompt'>[] = [
  {
    id: 'survival_family',
    code: '01',
    fileName: '01_Orcamento_Familiar_Sobrevivencia.csv',
    title: 'Orçamento Familiar & Sobrevivência',
    shortTitle: 'Familiar / Casa',
    subtitle: 'Salário, contas fixas da casa, mercado, despesa escolar anual rateada e reserva de emergência.',
    emoji: '🏠',
    accentColor: '#3B82F6',
    presetId: 'survival',
    investorProfileType: 'safety',
    activeSectors: ['core_cashflow', 'core_revenue', 'core_costs', 'core_goals', 'personal_finance'],
    recommendedFor: [
      'Famílias e assalariados CLT organizando contas da casa',
      'Quem quer descobrir para onde o dinheiro está indo e montar Reserva de Emergência',
      'Controle simples de entradas, gastos essenciais e metas mensais'
    ],
    keyFeatures: [
      '3 meses completos (Agosto, Setembro e Outubro/2026) totalmente fictícios',
      'Exemplo de Despesa Anual Rateada em 12 meses (Material Escolar)',
      'Aportes mensais em Reserva de Emergência (Tesouro Selic / Caixinha CDI)'
    ],
    fullBackupV3Csv: CSV_01_SURVIVAL,
  },
  {
    id: 'freelancer_autonomo',
    code: '02',
    fileName: '02_Autonomo_Freelancer_BancoDeTempo.csv',
    title: 'Autônomo, Freelancer & Banco de Tempo',
    shortTitle: 'Autônomo / PJ',
    subtitle: 'Renda variável por projetos, contratos recorrentes, guia MEI/DAS, licenças anuais e abonos de descanso.',
    emoji: '⚡',
    accentColor: '#10B981',
    presetId: 'freelancer',
    investorProfileType: 'balanced',
    activeSectors: ['core_cashflow', 'core_revenue', 'core_costs', 'core_goals', 'core_predictions', 'personal_finance'],
    recommendedFor: [
      'Freelancers, prestadores de serviço, designers, programadores e consultores',
      'Quem trabalha com metas diárias/semanais e quer usar o Banco de Tempo sem culpa',
      'MEIs e autônomos que separam custo de ferramentas e reserva própria'
    ],
    keyFeatures: [
      'Uso prático do tipo "waiver" (Abono de Descanso / Feriado no Banco de Tempo)',
      'Despesa anual de software/cloud diluída automaticamente em 12 meses',
      'Aportes combinando Reserva Selic, Tesouro IPCA+ e Fundo Imobiliário (HGLG11)'
    ],
    fullBackupV3Csv: CSV_02_FREELANCER,
  },
  {
    id: 'driver_fleet',
    code: '03',
    fileName: '03_Motorista_App_Frota_Veiculos.csv',
    title: 'Motorista de App, Entregador & Frota TCO',
    shortTitle: 'Motorista / Frota',
    subtitle: 'Ganhos semanais Uber/99, combustível por KM (CPK), manutenção preventiva Weibull e seguro anual.',
    emoji: '🚗',
    accentColor: '#F59E0B',
    presetId: 'freelancer',
    investorProfileType: 'safety',
    activeSectors: ['core_cashflow', 'core_revenue', 'core_costs', 'core_goals', 'core_predictions', 'personal_finance', 'vehicles'],
    recommendedFor: [
      'Motoristas de aplicativo (Uber, 99, InDrive), entregadores e taxistas',
      'Pequenas frotas e profissionais que dependem do veículo para trabalhar',
      'Quem quer calcular o Custo por Quilômetro (CPK) real e depreciação'
    ],
    keyFeatures: [
      'Ativa automaticamente o setor "Frota & Veículos" com tags cpk, fuel, weibull e ubi',
      'Metadados JSON com quilometragem rodada (milhas_km) e litros abastecidos',
      'Seguro Auto anual rateado em 12 meses + Fundo para troca de veículo'
    ],
    fullBackupV3Csv: CSV_03_DRIVER,
  },
  {
    id: 'investor_fire',
    code: '04',
    fileName: '04_Investidor_Carteira_FIRE.csv',
    title: 'Investidor, Dividendos & Carteira FIRE',
    shortTitle: 'Investidor FIRE',
    subtitle: 'Alocação em Selic, IPCA+, FIIs, Ações B3 e ETFs Globais com tickers, cotações e proventos mensais.',
    emoji: '📈',
    accentColor: '#F59E0B',
    presetId: 'investor',
    investorProfileType: 'balanced',
    activeSectors: ['core_cashflow', 'core_revenue', 'core_costs', 'core_goals', 'core_predictions', 'personal_finance', 'real_estate', 'legal_taxes'],
    recommendedFor: [
      'Investidores focados em Independência Financeira (FIRE) e Renda Passiva',
      'Quem quer acompanhar cobertura do custo de vida por dividendos e FIIs',
      'Carteiras diversificadas entre Brasil (Selic, IPCA+, FIIs, Ações) e Exterior (IVVB11/WRLD11)'
    ],
    keyFeatures: [
      'Preenchimento completo de ticker, quantity, unitPrice e assetClass nos aportes',
      'Receitas de Proventos/Dividendos (HGLG11, MXRF11, TAEE11) para cálculo de Renda Passiva',
      'Alimenta imediatamente o Painel do Investidor, Termômetro FIRE e Alocação por Classe'
    ],
    fullBackupV3Csv: CSV_04_INVESTOR,
  },
  {
    id: 'smb_business',
    code: '05',
    fileName: '05_PME_Comercio_Socios_Contabilidade.csv',
    title: 'PME, Comércio, Contabilidade & Sócios',
    shortTitle: 'PME & Sócios',
    subtitle: 'Faturamento B2B, folha CLT, pró-labore (Fator R), fornecedores (NCG/CMV) e conta-corrente de sócios.',
    emoji: '🏢',
    accentColor: '#8B5CF6',
    presetId: 'smb',
    investorProfileType: 'smb_hybrid',
    activeSectors: ['core_cashflow', 'core_revenue', 'core_costs', 'core_goals', 'core_predictions', 'smb_accounting', 'legal_taxes', 'vehicles', 'real_estate', 'personal_finance'],
    recommendedFor: [
      'Pequenas e Médias Empresas (PMEs), comércios, agências e estúdios',
      'Sociedades empresariais que precisam controlar entradas e reembolsos de sócios (partner_in / partner_out)',
      'Gestores monitorando Necessidade de Capital de Giro (NCG), Folha e Simples Nacional'
    ],
    keyFeatures: [
      'Ativa os motores de Contabilidade PME (ncg, welford, fap_rat) e Fiscal (fator_r, simples_nacional)',
      'Demonstração de Aporte Temporário de Sócio (partner_in) e Reembolso ao Sócio (partner_out)',
      'Reserva de Capital de Giro corporativo (assetClass: business_capital)'
    ],
    fullBackupV3Csv: CSV_05_SMB,
  },
  {
    id: 'real_estate_sac',
    code: '06',
    fileName: '06_Imoveis_Alugueis_Financiamento_SAC.csv',
    title: 'Imóveis, Aluguéis & Financiamento SAC',
    shortTitle: 'Imóveis & SAC',
    subtitle: 'Gestão de aluguéis residenciais/comerciais, temporada, parcelas decrescentes SAC, IPTU anual e FIIs.',
    emoji: '🏘️',
    accentColor: '#EC4899',
    presetId: 'investor',
    investorProfileType: 'income',
    activeSectors: ['core_cashflow', 'core_revenue', 'core_costs', 'core_goals', 'personal_finance', 'real_estate', 'legal_taxes'],
    recommendedFor: [
      'Proprietários de imóveis de aluguel, salas comerciais ou locação por temporada (Airbnb)',
      'Quem possui financiamento imobiliário (SAC ou Tabela Price) e planeja amortizações',
      'Investidores que combinam imóveis físicos (Cap Rate / Ross-Heidecke) com Fundos Imobiliários'
    ],
    keyFeatures: [
      'Ativa o setor "Imóveis & Patrimônio" (tags rental_income, cap_rate, sistema_sac, ross_heidecke)',
      'Metadados com valor estimado do imóvel (property_value) e número da parcela SAC',
      'IPTU e seguro residencial anual rateados em 12 meses + Reserva de vacância'
    ],
    fullBackupV3Csv: CSV_06_REAL_ESTATE,
  },
  {
    id: 'liberal_professional_tax',
    code: '07',
    fileName: '07_Profissional_Liberal_Medico_Advogado_FatorR.csv',
    title: 'Profissional Liberal, Médico & Advogado (Fator R)',
    shortTitle: 'Médico / Advogado',
    subtitle: 'Consultórios e escritórios PJ com otimização do Fator R (28%), Livro-Caixa dedutível e PGBL IRPF.',
    emoji: '⚕️',
    accentColor: '#06B6D4',
    presetId: 'smb',
    investorProfileType: 'balanced',
    activeSectors: ['core_cashflow', 'core_revenue', 'core_costs', 'core_goals', 'personal_finance', 'legal_taxes', 'smb_accounting'],
    recommendedFor: [
      'Médicos, dentistas, psicólogos, advogados, engenheiros e arquitetos (PJ ou autônomos)',
      'Empresas do Simples Nacional que buscam manter a folha/pró-labore >= 28% (Anexo III vs Anexo V)',
      'Profissionais que utilizam Livro-Caixa e Previdência PGBL para eficiência no IRPF'
    ],
    keyFeatures: [
      'Ativa o setor "Jurídico & Impostos" (tags fator_r, simples_nacional, irpf_2026, livro_caixa)',
      'Metadados com massa_salarial_12 e receita_bruta_12 para simulação imediata do Fator R',
      'Anuidade de conselho de classe (CRM/OAB/CREA) rateada em 12 meses + Aporte PGBL'
    ],
    fullBackupV3Csv: CSV_07_LIBERAL,
  },
  {
    id: 'ai_universal_template',
    code: '08',
    fileName: '08_Modelo_Base_Universal_Para_IA.csv',
    title: 'Modelo Universal Autodocumentado p/ Sua IA',
    shortTitle: 'Gabarito p/ IA',
    subtitle: 'Contém exatamente 1 exemplo de cada tipo de linha (revenue, expense, rateio 12m, deposit, ticker, waiver, sócios e quarentena).',
    emoji: '🤖',
    accentColor: '#6366F1',
    presetId: 'freelancer',
    investorProfileType: 'balanced',
    activeSectors: ['core_cashflow', 'core_revenue', 'core_costs', 'core_goals', 'core_predictions', 'personal_finance'],
    recommendedFor: [
      'Qualquer pessoa que queira ensinar rapidamente o formato do Assistente Moeda para sua própria IA (ChatGPT, Claude, Gemini, DeepSeek)',
      'Testar todos os 7 tipos de lançamento (entryType) da planilha em apenas 10 linhas enxutas',
      'Criar um CSV personalizado do zero a partir de extratos bancários ou faturas'
    ],
    keyFeatures: [
      '10 linhas didáticas cobrindo 100% dos recursos do parser CSV v3',
      'Ideal para copiar junto com o Prompt de IA e colar com seus dados reais na sua IA de confiança',
      'Leve, rápido de inspecionar e fácil de editar no Excel, Google Sheets ou bloco de notas'
    ],
    fullBackupV3Csv: CSV_08_UNIVERSAL_TEMPLATE,
  },
];

export const EXAMPLE_CSV_PROFILES: ExampleCSVProfile[] = RAW_PROFILES.map((item) => {
  const compactSimpleCsv = extractRowsBlock(item.fullBackupV3Csv);
  const fullProfile: ExampleCSVProfile = {
    ...item,
    compactSimpleCsv,
    aiBuilderPrompt: '',
  };
  fullProfile.aiBuilderPrompt = buildAiPromptForProfile(fullProfile, true);
  return fullProfile;
});

export function getExampleProfileById(id: string): ExampleCSVProfile | undefined {
  return EXAMPLE_CSV_PROFILES.find((p) => p.id === id || p.code === id || p.fileName === id);
}

export function getExampleProfilesForPreset(presetId: WorkspacePresetType): ExampleCSVProfile[] {
  return EXAMPLE_CSV_PROFILES.filter((p) => p.presetId === presetId);
}
