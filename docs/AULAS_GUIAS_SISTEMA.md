# Guia Educacional & Manual do Sistema: Engenharia Financeira Ativa

Este guia detalha o funcionamento técnico e operacional do sistema de setores adaptativos do **Assistente Moeda**. Todos os motores de simulação e apuração de conformidade rodam 100% no navegador (lado do cliente), sem conexões centralizadas, em respeito às diretrizes de soberania de dados.

---

## 📥 1. O Motor de Importação In-Place CSV (`csvEngine.ts`)

Ao contrário das importações financeiras tradicionais que geram novas tabelas isoladas ("tabelas órfãs"), o motor unificado do Assistente Moeda processa e mescla os dados diretamente na planilha selecionada no momento.

### Fluxo de Funcionamento:
1. **Normalização de Delimitadores**: O motor identifica automaticamente se o CSV usa vírgula (`,`), ponto e vírgula (`;`) ou tabulação (`\t`).
2. **Normalização de Campos**: Trata datas (`YYYY-MM-DD`, `DD/MM/YYYY`) e limpa símbolos monetários (como `R$`, `$`, `"`) para conversão estável de valores.
3. **Escaneamento de Cabeçalhos e Tags (Auto-Ativação)**:
   * O importador busca correspondências em cabeçalhos (ex: `massa_salarial_12` ou `cnae_codigo`) e no conteúdo das linhas (ex: `cpk`, `Fator R`, `tabela_price`).
   * Ao detectar uma palavra-chave correspondente a um dos 9 setores, ele ativa o setor correspondente no painel de configurações (`activeSectors`), revelando instantaneamente os widgets interativos correspondentes sem necessidade de recarga da interface.

---

## 🧮 2. Os 9 Setores Atuariais & Financeiros

Abaixo estão detalhados os 9 módulos integrados no dashboard:

### Setor 1: Contabilidade & Operações PME (`smb_accounting`)
* **NCG Buffer Zone**: Define faixas de segurança de capital de giro (Verde: confortável, Amarela: atenção, Vermelha: criticidade).
* **Welford Algorithm**: Mede a volatilidade de margens brutas/líquidas em tempo real de forma incremental (sem armazenar todos os registros na memória).
* **Expected CFaR**: Modela o fluxo de caixa sob risco estocástico em cenários de quebra.
* **Tax Shield de CLT**: Mede a economia fiscal de contratações nos regimes tributários brasileiros.

### Setor 2 & 7: Legal, Tributário & Cálculos Judiciais (`legal_taxes`)
* **Fator R (Simples Nacional)**:
  * Divide a folha salarial acumulada de 12 meses pelo faturamento bruto de 12 meses.
  * Se o resultado for $\ge 28\%$, enquadra o prestador de serviços de TI no Anexo III (alíquota inicial de 6% em vez dos 15.5% do Anexo V).
  * O widget calcula dinamicamente o pró-labore ideal necessário para reequilibrar essa taxa.
* **Lucro Presumido**: Apura impostos cumulativos (IRPJ, CSLL, PIS, COFINS) e simula o impacto da PLP 182/2025 (+10% sobre a presunção).
* **IRPF 2026 & Redutor Especial (Lei nº 15.270/2025)**:
  * Simula o novo cálculo salarial líquido de 2026. Aplica isenção total até R$ 5.000,00 e o redutor regressivo especial até R$ 7.350,00.
* **PJe-Calc Judicial Debt (ADC 58)**:
  * Liquidação de débitos judiciais de forma híbrida: atualiza pela inflação (IPCA-E/TR) na fase pré-processual e pelo regime SELIC ou IPCA + Taxa Legal CMN após o ajuizamento.

### Setor 3 & 4: Matemática Imobiliária & PropTech (`real_estate`)
* **SAC vs. Price**:
  * Tabela Price (juros maiores no início, parcelas fixas) vs. Sistema SAC (prestações decrescentes).
  * Permite simular aportes extraordinários para redução de tempo contratual ou valor da parcela.
* **Depreciação Ross-Heidecke**: Calcula a perda de valor estrutural físico ($K_d$) de ativos imobiliários comerciais e industriais.
* **Turnover de Inquilinos ($C_{rotatividade}$)**: Calcula a perda financeira causada por rescisões (meses de vacância + marketing + reformas + burocracia contratual).

### Setor 5 & 6: Veículos & Gestão de Frota (`vehicles`)
* **CPK Dinâmico**: Calcula o custo por quilômetro integrando o estilo de direção (telemetria), desgaste de pneus em pavimentos ásperos (índice IRI) e seguros comportamentais (UBI).
* **NPV Buy vs. Rideshare**: Avalia a viabilidade financeira a 5 anos comparando a compra de frotas com o rideshare corporativo (recuperando horas de produtividade no banco de trás).
* **Substituição Preventiva de Weibull**:
  * Otimiza a quilometragem recomendada ($M^*$) para troca de componentes mecânicos antes que ocorram falhas em rota.
* **Dreno Oculto ($D_{oculto}$)**: Shock card onboarding que calcula a dissonância cognitiva entre o financiamento mensal e o TCO estrutural total do carro.

### Setor 8: Soberania & Privacidade (`legal_taxes`)
* **Expected Utility of Compliance ($EU$)**: Modela a propensão à proteção de dados e conformidade fiscal local.
* **HIPAA Conduit Exception**: Verifica se o armazenamento local atinge conformidade total com a isenção de BAA na área de saúde.
* **Subpoena Shield**: Analisa a vulnerabilidade de intimações judiciais silenciosas na nuvem tradicional.

### Setor 9: Retenção & Simulações PFM (`personal_finance`)
* **Monte Carlo FIRE**: Roda 10.000 trajetórias estocásticas de evolução de patrimônio no navegador para avaliar a probabilidade de sobrevivência de uma carteira de investimentos na aposentadoria.
* **Cash Flow Predictor**: Janela de 13 semanas diárias para antecipar quedas de caixa.

---

## 🛠️ 3. Roteiro de Simulação Prática

### Simulação 1: Transição do Fator R
1. Vá até o painel **Simples Nacional Fator R**.
2. Ajuste o faturamento de 12 meses para `R$ 400.000,00` e a folha salarial para `R$ 90.000,00`.
3. Veja que o Fator R projetado estará em `22.5%`, enquadrando a empresa no **Anexo V** (alíquota maior).
4. O advisor de pró-labore recomendará aumentar o pró-labore em `R$ 22.000,00` acumulados para enquadrar a TI no **Anexo III**, reduzindo a alíquota imediatamente.

### Simulação 2: Monte Carlo FIRE
1. No painel de **Monte Carlo FIRE**, defina o patrimônio inicial em `R$ 1.000.000,00` e retiradas anuais de `R$ 45.000,00` (regra dos 4.5%).
2. Coloque o retorno real médio em `5%` e a volatilidade em `12%` para simular uma carteira moderada em anos de flutuação.
3. Clique em simular. O motor processará localmente 10.000 caminhos estatísticos exibindo a probabilidade real de sucesso e o pior cenário financeiro histórico (P10).

---

## 🔄 4. Fluxo de Sincronização Híbrida & Cofre Soberano (Zero-Knowledge)

Para conciliar a conveniência da sincronização em nuvem com a privacidade absoluta de dados confidenciais, o aplicativo implementa uma arquitetura de sincronização local-first integrada ao **Supabase**.

### 1. Modelo de Dados PostgreSQL
O banco de dados remoto possui três tabelas fundamentais:
* **`profiles`**: Registra as preferências do usuário, setores ativos (`active_sectors`) e a preferência de Cofre Soberano (`zero_knowledge_enabled`).
* **`worksheets`**: Representa os arquivos de planilhas locais.
* **`ledger_entries`**: Lançamentos contábeis com suporte a transações tradicionais (débito/crédito, valor em centavos) e o payload encriptado (`encrypted_payload`).

### 2. Segurança por RLS (Row Level Security)
Nenhuma tabela do Supabase permite acesso indiscriminado. Todas contêm regras estritas de segurança em nível de linha:
```sql
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso total do usuário aos próprios lançamentos"
  ON public.ledger_entries FOR ALL
  USING (auth.uid() = user_id);
```
Isso garante que, mesmo em texto claro, os dados de um usuário são inacessíveis para qualquer outro usuário autenticado no sistema.

### 3. Modo Cofre Soberano (Zero-Knowledge E2EE)
Quando o usuário ativa a flag `zero_knowledge_enabled` em seu perfil:
1. **Encriptação Antes do Upload**: Antes de enviar qualquer registro para o Supabase, o motor local (`supabaseSync.ts`) gera uma chave a partir do ID do usuário e aplica uma cifragem local nos campos sensíveis (`description`, `category`, `tags`, e metadados dinâmicos).
2. **Payload Ofuscado**: A descrição é substituída por `"CRIPTOGRAFADO LOCALMENTE (E2EE)"` e o restante das informações estruturadas é encapsulado no campo `encrypted_payload`.
3. **Decodificação Local In-Place**: Ao puxar os dados de volta para o cliente, o motor descriptografa o payload localmente de forma in-place, restaurando a visualização exata das planilhas sem que os dados decifrados tenham passado pelo servidor.

