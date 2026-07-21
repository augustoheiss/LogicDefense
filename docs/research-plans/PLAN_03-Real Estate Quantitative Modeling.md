# Plano de Pesquisa: Real Estate Quantitative Modeling

Este documento detalha o plano de implementação e a especificação técnica para o setor de **Investimentos Imobiliários e Financiamentos**, elaborado a partir do estudo do artigo *"Engenharia Quantitativa de Investimentos Imobiliários: Modelos de Amortização Dinâmica, Análise de Rendimento sob Inflação, Depreciação Ross-Heidecke e Arquitetura de Interface de Revelação Progressiva"*.

---

## 🎯 Executive Summary & Sector Mapping

* **Setor de Aplicação:** Real Estate / Financiamento e Imóveis (Real Estate & Mortgages).
* **Visão Geral:** O estudo foca na estruturação matemática de modelos de decisão para investimentos imobiliários. Ele engloba o desenvolvimento de motores de amortização comparativos (Price e SAC) capazes de processar amortizações extraordinárias com recálculos de prazo ou parcela; análises multianuais de rentabilidade real com base em projeções indexadas (IGP-M e IPCA) e taxa de desconto ajustada pela Equação de Fisher; avaliação de ativos por ciclo de mercado (*Cap Rate*, *Cash-on-Cash*, *GRM*); cálculo de desgaste estrutural físico de benfeitorias urbanas pelo Método Ross-Heidecke; e uma arquitetura reativa local-first (Zustand + React) com revelação progressiva da interface a partir de triggers de chaves de registo.

---

## 🧮 Mathematical Models & Formulas

### 1. Motores de Amortização Dinâmica (Price vs SAC)

#### Tabela Price (Sistema Francês - Prestações Constantes)
A prestação periódica ($P$) é fixa e calculada através da fórmula da anuidade:
$$P = PV \times \frac{i \times (1+i)^n}{(1+i)^n - 1}$$
*(onde $PV$ é o Saldo Devedor inicial, $i$ é a taxa periódica e $n$ é o total de períodos)*

Cálculos recursivos por período $t$:
* **Juros do período:** $J_t = SD_{t-1} \times i$
* **Amortização do período:** $A_t = P - J_t$
* **Saldo devedor resultante:** $SD_t = SD_{t-1} - A_t$

#### SAC (Sistema de Amortização Constante - Amortizações Constantes)
A cota de amortização ($A$) é fixa:
$$A = \frac{PV}{n}$$

Cálculos recursivos por período $t$:
* **Juros do período:** $J_t = SD_{t-1} \times i$
* **Prestação do período:** $P_t = A + J_t$
* **Saldo devedor resultante:** $SD_t = SD_{t-1} - A$

---

### 2. Recálculo em Amortizações Extraordinárias ($AE$)
Após amortizar um montante extraordinário $AE$ no período $t$, o saldo devedor atualiza para $SD_t' = SD_t - AE$. O motor de cálculo oferece duas opções:

#### Opção A: Redução do Prazo (Term Reduction) - Mantém a Prestação Original
* **Price (Novo número de parcelas restantes $n'$):**
  $$n' = -\frac{\ln\left(1 - \frac{SD_t' \times i}{P}\right)}{\ln(1+i)}$$
* **SAC (Novo número de parcelas restantes $n'$):**
  $$n' = \frac{SD_t'}{A}$$

#### Opção B: Redução da Parcela (Payment Reduction) - Mantém o Prazo Remanescente ($n_{\text{rem}}$)
* **Price (Nova prestação mensal $P'$):**
  $$P' = SD_t' \times \frac{i \times (1+i)^{n_{\text{rem}}}}{(1+i)^{n_{\text{rem}}} - 1}$$
* **SAC (Nova cota de amortização linear $A'$):**
  $$A' = \frac{SD_t'}{n_{\text{rem}}}$$

---

### 3. Modelagem de Rendimento Multianual & Equação de Fisher
* **Projeção de Fluxo de Caixa Nominal ($CF_{\text{nom}}(t)$):**
  $$CF_{\text{nom}}(t) = \text{ReceitaBruta}_0 \times (1 - \text{Vacância}) \times (1 + \theta_{\text{IGP-M}})^t - \text{DespesasOp}_0 \times (1 + \theta_{\text{IPCA}})^t$$
* **Projeção de Fluxo de Caixa Real ($CF_{\text{real}}(t)$) deflacionado pelo IPCA:**
  $$CF_{\text{real}}(t) = \frac{CF_{\text{nom}}(t)}{(1 + \theta_{\text{IPCA}})^t}$$
* **Cálculo da TIR Real ($IRR_{\text{real}}$) e Fisher:**
  A TIR Real é a taxa $r$ que zera o $VPL_{\text{real}}$:
  $$-I_0 + \sum_{t=1}^{N} \frac{CF_{\text{real}}(t)}{(1 + r)^t} = 0$$
  Pela Equação de Fisher, relaciona-se com a TIR Nominal ($IRR_{\text{nom}}$) e a inflação geométrica média ($\theta_{\text{inflação}}$):
  $$1 + IRR_{\text{nom}} = (1 + IRR_{\text{real}}) \times (1 + \theta_{\text{inflação}})$$

---

### 4. Métricas de Rendimento Operacional
* **Cap Rate (Capitalization Rate):**
  $$\text{Cap Rate} = \frac{NOI}{V_{\text{mercado}}}$$
  *(onde $NOI$ é o Lucro Operacional Líquido do ano 1 e $V_{\text{mercado}}$ é o valor de aquisição)*
* **Cash-on-Cash Return (CoC):**
  $$\text{CoC} = \frac{NOI - \text{Serviço Anual da Dívida}}{\text{Capital Próprio Inicial Investido}}$$
* **Gross Rent Multiplier (GRM):**
  $$\text{GRM} = \frac{\text{Preço de Aquisição}}{\text{Receita Bruta Anual de Aluguer}}$$

---

### 5. Curva de Depreciação Ross-Heidecke & Provisões de CapEx
* **Idade Percentual ($x$):** $x = \frac{\text{Idade Efetiva}}{\text{Vida Útil Estimada}}$
* **Coeficiente Ross ($\alpha$):**
  $$\alpha = \frac{1}{2} \times (x + x^2)$$
* **Coeficiente de Depreciação Ross-Heidecke ($K_d$):**
  $$K_d = \alpha + H \times (1 - \alpha)$$
  *(onde $H$ é o Coeficiente de Heidecke baseado no estado de conservação, de 0.0 para "Novo" a 1.0 para "Sem Valor")*
* **Valor Depreciado do Imóvel ($V_{\text{depreciado}}$) com Valor Residual ($V_{\text{residual}}$):**
  $$V_{\text{depreciado}} = (V_{\text{novo}} - V_{\text{residual}}) \times (1 - K_d) + V_{\text{residual}}$$
* **Taxa de Depreciação Marginal Anual ($\Delta K_d(t)$) para cálculo de provisões de CapEx:**
  $$\Delta K_d(t) = \frac{2t - 1 + L}{2L^2} \times (1 - H)$$
  *(onde $t$ é o ano atual, $L$ é a vida útil total e $H$ é o Heidecke)*

---

## 💡 Immediate Implementation Ideas

1. **Simulador Interativo Price vs SAC com Amortização Extraordinária:**
   Interface gráfica com gráficos de linha mostrando o saldo devedor ao longo do tempo. O utilizador pode inserir amortizações extraordinárias em pontos específicos do gráfico e comparar instantaneamente a redução de prazo vs parcela.
2. **Dashboard de Análise Multianual de Rendimento Real (Fisher & Indexadores):**
   Módulo de cálculo de fluxos de caixa descontados em que o utilizador ajusta as taxas de projeção do IGP-M (receitas) e IPCA (despesas) para visualizar o impacto real no $VPL$ e $TIR$ real do portfólio.
3. **Calculadora Ross-Heidecke de CapEx de Portfólio:**
   Ferramenta para cadastrar imóveis e benfeitorias, avaliar o estado de conservação Heidecke e gerar automaticamente a taxa de depreciação marginal e a provisão teórica anual de CapEx necessária para cada ativo.
4. **Motor de Revelação Progressiva com Zustand:**
   Implementar a lógica reativa onde o Módulo Imobiliário no frontend do Assistente Moeda é montado e exibido de forma dinâmica apenas quando chaves como `rental_income`, `mortgage_interest` ou `property_value` são identificadas no `localStorage` ou no CSV importado.

---

## 🔬 Topics Needing Deep Study / Open Questions

* **Comportamento do IGP-M Negativo:** Em períodos de deflação cambial, o IGP-M pode sofrer variações negativas. Como a interface deve gerir cláusulas contratuais de aluguer que proíbem o reajuste negativo (correção apenas para cima)?
* **Readequação da Idade Efetiva em Vistorias:** De que forma reformas parciais (ex: apenas elétrica ou apenas pintura) devem reduzir numericamente a "idade efetiva" no cálculo do Ross-Heidecke? Há alguma tabela paramétrica padrão para ponderação de sistemas de engenharia?
* **Otimização de Lazy Loading para Componentes Visuais complexos (Mermaid/Gráficos):** Como garantir que o bundle principal continue leve, fazendo o code-splitting do motor de amortização (que requer pacotes de renderização de gráficos complexos) apenas quando o módulo imobiliário for ativado?

---

## 🏷️ CSV Schema & Auto-Activation Tags

### CSV Schema de Transações de Rendimento Imobiliário
```csv
property_id,property_name,rental_income,mortgage_interest,amortization_type,property_value,useful_life,effective_age,heidecke_state
```

### Tags de Auto-Ativação (Tags/Metadata que disparam o Módulo Imobiliário/Financiamento):
* **Cabeçalhos de Colunas / Chaves:** `rental_income`, `mortgage_interest`, `property_value`, `useful_life`, `effective_age`, `heidecke_state`, `amortization_type`
* **Expressões e Metadados do Conteúdo:**
  * `Tabela Price`, `Sistema SAC`, `SAC`, `Price`, `SACRE`
  * `Amortização Extraordinária`, `Extraordinary Amortization`, `Term Reduction`, `Payment Reduction`, `Redução de Prazo`, `Redução de Parcela`
  * `Cap Rate`, `Capitalization Rate`, `Cash-on-Cash`, `CoC`, `Gross Rent Multiplier`, `GRM`, `Valuation`
  * `Ross-Heidecke`, `Ross Heidecke`, `Heidecke`, `Depreciação Física`, `Vnovo`, `Vresidual`, `CapEx`
  * `IGP-M`, `IGPM`, `IPCA`, `Taxa Selic`, `Selic`, `Equação de Fisher`, `Fisher Equation`
