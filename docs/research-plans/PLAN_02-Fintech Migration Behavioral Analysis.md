# Plano de Pesquisa: Fintech Migration Behavioral Analysis

Este documento detalha o plano de implementação e a especificação técnica para o setor de **Auditoria, Segurança e Conformidade Legal**, elaborado a partir do estudo do artigo *"O Paradoxo da Migração para a Nuvem na Contabilidade Digital: Uma Análise Comportamental e Arquitetural da Transição de Sistemas"*.

---

## 🎯 Executive Summary & Sector Mapping

* **Setor de Aplicação:** Legal / Impostos e Auditoria (Legal, Audit & Taxes).
* **Visão Geral:** O estudo analisa a resistência psicológica de profissionais financeiros (caracterizados por altíssima Conscienciosidade e aversão ao risco) na transição para a nuvem sob a ótica da economia comportamental. Propõe a superação das barreiras de privacidade de dados por meio de uma arquitetura *local-first stateless* baseada no browser (DuckDB-WASM e PGlite), com integridade matemática garantida (exclusão de floats e armazenamento em inteiros/centavos) e rastreabilidade total de dados (*Data Lineage*).

---

## 🧮 Mathematical Models & Formulas

### 1. Modelos de Solvência e Manipulação Contábil (Auditoria Clássica)
* **Altman Z-Score (Previsão de Falência para PMEs):**
  Identifica o risco de insolvência a partir de rácios de liquidez, rentabilidade, alavancagem e eficiência.
* **Beneish M-Score (Deteção de Fraude e Manipulação):**
  Mede se os lucros foram inflacionados de forma artificial. Um dos seus componentes fundamentais é o **Asset Quality Index (AQI)**:
  $$AQI = \frac{1 - \frac{\text{Ativos Circulantes}_t + \text{Imobilizado}_t + \text{Investimentos}_t}{\text{Ativos Totais}_t}}{1 - \frac{\text{Ativos Circulantes}_{t-1} + \text{Imobilizado}_{t-1} + \text{Investimentos}_{t-1}}{\text{Ativos Totais}_{t-1}}}$$
  *Valores superiores a 1.0 indicam uma capitalização indevida de despesas operacionais no balanço.*

### 2. Métricas Ontológicas de Auditoria (Livro Razão - GL)

| Métrica | Formulação Matemática | Variáveis de Extração no CSV |
| :--- | :--- | :--- |
| **Margem Bruta** | $$\text{Margem Bruta} = \frac{\text{Lucro Bruto}}{\text{Receita Bruta}}$$ | `Codigo_Receita`, `Codigo_CPMC`, `Valor_Centimos` |
| **Margem EBITDA** | $$\text{Margem EBITDA} = \frac{\text{EBITDA}}{\text{Receita Bruta}}$$ | `Codigo_EBITDA`, `Codigo_Receitas`, `Valor_Centimos` |
| **Rácio Corrente** | $$\text{Rácio Corrente} = \frac{\text{Ativo Circulante}}{\text{Passivo Circulante}}$$ | `Classe_Ativo_Circulante`, `Classe_Passivo_Circulante` |
| **Rácio Ácido** | $$\text{Rácio Ácido} = \frac{\text{Disponibilidades} + \text{Clientes}}{\text{Passivo Circulante}}$$ | `Contas_Disponibilidades`, `Contas_Clientes`, `Contas_Inventario` |
| **DSO (Rotação de Receber)** | $$DSO = \frac{\text{Saldo Clientes}}{\text{Total Vendas a Crédito}} \times 365$$ | `Saldo_Contas_Receber`, `Total_Vendas_Credito` |
| **Rácio Debt to Equity (D/E)** | $$D/E = \frac{\text{Total do Passivo}}{\text{Capital Próprio}}$$ | `Total_Passivo`, `Total_Capital_Proprio` |
| **Cash Flow Operacional** | $$\text{CFO} = \text{EBIT} + \text{Itens Não-Caixa} - \Delta NCG$$ | `EBIT_Code`, `Non_Cash_Items`, `WCR_Variables` |

*Nota: Todas as variáveis de valor monetário devem ser processadas em cêntimos inteiros para evitar imprecisões decimais de ponto flutuante ($amountInCents \in \mathbb{Z}$).*

### 3. Modelo de Rastreabilidade e Data Lineage (Append-Only)
Para manter a auditabilidade imutável, o Livro Razão local opera sob o princípio *append-only*:
$$\text{Saldo}_i(t) = \text{Saldo}_i(0) + \sum_{k=1}^{n} \text{Lancamento}_k(t)$$
* Qualquer retificação é feita por meio de lançamentos de estorno e reversão com timestamps criptográficos, sem sobrescritas físicas de dados.

---

## 💡 Immediate Implementation Ideas

1. **Calculadora Criptograficamente Segura de Altman & Beneish:**
   Um dashboard local executado via DuckDB-WASM que calcula instantaneamente os rácios Altman Z-Score e Beneish M-Score a partir de balancetes enviados pelo utilizador, exibindo alertas visuais de risco financeiro de forma imediata.
2. **Importador de Diário Contábil (GL) com Validação de Partidas Dobradas:**
   Uma interface de drag-and-drop que valida se o CSV cumpre estritamente $\sum \text{Débitos} = \sum \text{Créditos}$ em inteiros (cêntimos) antes de permitir a visualização de relatórios.
3. **Servidor MCP Local de Reconciliação:**
   Expor os dados do Livro Razão local através de um servidor MCP (Model Context Protocol). O utilizador pode rodar modelos LLM locais (ex: Claude Desktop) para consultar e fazer perguntas sobre a sua contabilidade diretamente na sua máquina, garantindo 100% de privacidade dos dados.
4. **Visualizador de Data Lineage:**
   Um componente visual em árvore ou gráfico de fluxo que reconstrói a proveniência e o histórico de alterações de uma conta contábil específica a partir dos lançamentos de estorno e reversão contidos no CSV.

---

## 🔬 Topics Needing Deep Study / Open Questions

* **Escalabilidade do DuckDB-WASM no Browser:** Qual é o limite prático de linhas do Livro Razão (GL) que o DuckDB-WASM e o PGlite conseguem processar na memória volátil do navegador sem causar lentidão perceptível ao utilizador final?
* **Padrão Criptográfico de Assinatura para Rastreabilidade:** Que padrão de assinatura digital e carimbo de data/hora (timestamp) pode ser aplicado localmente no browser para provar a integridade e imutabilidade dos lançamentos importados, sem depender de uma autoridade central na nuvem?
* **Tratamento de Transações Efêmeras em IA:** Como garantir que prompts de linguagem natural convertidos em transações pela IA (stateless TypeScript parser) permaneçam isolados em memória e não vazem via cache ou logs do sistema operacional?

---

## 🏷️ CSV Schema & Auto-Activation Tags

### CSV Schema de Lançamentos de Auditoria (Livro Razão)
```csv
transaction_id,timestamp,debit_account,credit_account,amount_in_cents,description,reversal_ref_id
```

### Tags de Auto-Ativação (Tags/Metadata que disparam o Módulo Legal/Auditoria):
* **Cabeçalhos de Colunas / Chaves:** `Codigo_Receita`, `Codigo_CPMC`, `Codigo_EBITDA`, `Classe_Ativo_Circulante`, `Classe_Passivo_Circulante`, `Contas_Disponibilidades`, `Contas_Clientes`, `Saldo_Contas_Receber`, `Total_Passivo`, `Total_Capital_Proprio`, `amount_in_cents`, `reversal_ref_id`
* **Expressões e Metadados do Conteúdo:**
  * `Altman`, `Z-Score`, `Beneish`, `M-Score`, `Asset Quality Index`, `AQI`
  * `Livro Razão`, `General Ledger`, `GL`, `Balancete Geral`
  * `Estorno`, `Reversão`, `DSO`, `Rácio Corrente`, `Rácio Ácido`, `Quick Ratio`, `Data Lineage`, `Rastreabilidade`
  * `DuckDB-WASM`, `PGlite`, `Zero-Knowledge`, `Model Context Protocol`, `MCP`
