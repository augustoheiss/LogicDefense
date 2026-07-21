# Plano de Pesquisa: Brazilian Tax Math Optimization

Este documento detalha o plano de implementação e a especificação técnica para o setor de **Planejamento Tributário e Cálculos Judiciais Brasileiros**, elaborado a partir do estudo do artigo *"Análise Forense de Engenharia Fiscal e Computacional: Otimização de Regimes Tributários, Modelagem de Correção de Débitos Judiciais e Segurança de Dados Lado-Cliente"*.

---

## 🎯 Executive Summary & Sector Mapping

* **Setor de Aplicação:** Legal / Impostos e Auditoria (Legal, Audit & Taxes).
* **Visão Geral:** O estudo modela a complexidade tributária brasileira (corporativa e individual) e a liquidação de débitos cíveis e trabalhistas. Ele engloba a transição dinâmica de anexos do Simples Nacional (Fator R), a apuração do Lucro Presumido com regras do IRPJ progressivo e PIS/COFINS cumulativos (incluindo o impacto da proposta PLP 182/2025), a modelagem do IRPF 2026 (Lei nº 15.270/2025) com o Redutor Mensal Especial e o Imposto de Renda Mínimo (IRPFM), e o cálculo de juros de mora e correção de débitos (ADC 58 e Lei nº 14.905/2024 com a nova Taxa Legal do Banco Central). A execução e armazenamento são modelados local-first (SQLite WASM no OPFS e Web Workers).

---

## 🧮 Mathematical Models & Formulas

### 1. O Algoritmo do Fator R (Simples Nacional)
Determina se uma empresa prestadora de serviços recolhe pelo Anexo III (alíquota inicial de $6\%$) ou Anexo V (alíquota inicial de $15,5\%$):
$$FatorR = \frac{\text{Massa Salarial}_{12}}{\text{Receita Bruta}_{12}}$$

* Se $FatorR \ge 28\%$: Enquadramento no **Anexo III**.
* Se $FatorR < 28\%$: Enquadramento no **Anexo V**.
* *Convenção de Fronteira:* Se $\text{Receita Bruta}_{12} = 0$ e $\text{Massa Salarial}_{12} > 0 \implies FatorR = 100\% \implies$ **Anexo III**.

A alíquota efetiva ($Aliq_{\text{efetiva}}$) para o faturamento acumulado é calculada por:
$$Aliq_{\text{efetiva}} = \frac{RBT_{12} \times Aliq_{\text{nominal}} - \text{ParcelaADeduzir}}{RBT_{12}}$$

---

### 2. O Apurador de Lucro Presumido (Serviços)
* **Presunção IRPJ/CSLL (Regra Geral):** $32\%$ da Receita Trimestral ($R_{\text{trim}}$).
  *(PLP 182/2025 propõe acréscimo de 10% sobre a presunção $\implies 35,2\%$ para receitas anuais $> 1,2$M)*
* **Base de Cálculo do IRPJ:** $BC_{\text{IRPJ}} = R_{\text{trim}} \times 0.32$
* **IRPJ Total:**
  $$IRPJ_{\text{total}} = BC_{\text{IRPJ}} \times 0.15 + (BC_{\text{IRPJ}} - 60.000) \times 0.10 \times \mathbb{I}(BC_{\text{IRPJ}} > 60.000)$$
* **CSLL Total:**
  $$CSLL_{\text{total}} = (R_{\text{trim}} \times 0.32) \times 0.09$$
* **PIS/COFINS Cumulativos:** PIS a $0,65\%$ e COFINS a $3,00\%$ sobre a receita bruta mensal (sem dedução de ISS das bases de IRPJ/CSLL - STJ Tema 1.312).

---

### 3. Modelagem do IRPF 2026 & IRPFM (Lei nº 15.270/2025)

#### IRPF Mensal
1. **Base de Cálculo Líquida ($BC_{\text{líquida}}$):**
   $$BC_{\text{líquida}} = Rend_{\text{tributável\_bruto}} - Prev_{\text{social}} - Dependentes \times 189.59 - Pensão$$
2. **Imposto de Renda Bruto ($IR_{\text{bruto}}$):**
   $$IR_{\text{bruto}} = BC_{\text{líquida}} \times Aliq_{\text{marginal}} - \text{ParcelaADeduzir}$$
3. **Redutor Mensal Especial ($Red_{\text{especial}}$) sobre o Rendimento Bruto:**
   * Se $Rend_{\text{bruto}} \le 5.000,00 \implies Red_{\text{especial}} = IR_{\text{bruto}}$ (isenção total).
   * Se $5.000,00 < Rend_{\text{bruto}} \le 7.350,00$:
     $$Red_{\text{especial}} = \text{RedMax} \times \left(1 - \frac{Rend_{\text{bruto}} - 5.000}{2.350}\right)$$
     *(onde $\text{RedMax}$ é o $IR_{\text{bruto}}$ calculado no ponto de R$ 5.000,00)*
   * Se $Rend_{\text{bruto}} > 7.350,00 \implies Red_{\text{especial}} = 0$.
4. **Imposto de Renda Retido na Fonte ($IR_{\text{efetivo}}$):**
   $$IR_{\text{efetivo}} = \max(0, IR_{\text{bruto}} - Red_{\text{especial}})$$

#### IRPF Mínimo (IRPFM) para Renda Global Anual $> 600.000,00$:
Aplica-se alíquota progressiva de $10\%$ a $15\%$ sobre a receita global líquida ajustada ($RG_{\text{ajustada}}$):
$$IRPFM_{\text{bruto}} = RG_{\text{ajustada}} \times Aliq_{\text{IRPFM}}$$
O valor final a recolher deduz impostos já pagos:
$$IRPFM_{\text{net}} = \max(0, IRPFM_{\text{bruto}} - (IR_{\text{anual}} + IR_{\text{fonte}} + IR_{\text{exterior}} + IR_{\text{lucros\_distribuídos}}))$$

---

### 4. Liquidação Trabalhista e Cível (ADC 58 & Lei nº 14.905/2024)

#### Liquidação de Crédito Trabalhista:
* **Fase Pré-Judicial (até dia anterior ao ajuizamento):**
  * Competências até 29/08/2024: IPCA-E + TRD simples (Lei 8.177/91).
  * Competências a partir de 30/08/2024: IPCA + TRD simples.
* **Fase Judicial (do ajuizamento em diante):**
  * Período de 18/12/2020 a 29/08/2024: Taxa SELIC integral (conglobante).
  * Período a partir de 30/08/2024: IPCA + Taxa Legal (SELIC - IPCA) simples e autônoma.

#### Metodologia da Taxa Legal ($TL_m$ - Resolução CMN nº 5.171/2024):
$$TL_m = \frac{SELIC_{\text{acum\_m-1}} - IPCA15_{m-1}}{1 + IPCA15_{m-1}}$$
*(onde $SELIC_{\text{acum}}$ é acumulada com fatores diários $f_d = \sqrt[252]{1 + \text{SELIC}_{\text{anual}}}$. Se a inflação superar a SELIC $\implies TL_m = 0$)*
* **Acúmulo de meses:** Capitalização simples $\sum TL_m$.
* **Pro-rata die:** $TL_{\text{dia}} = \frac{TL_m}{\text{DiasCorridos}_m}$.

---

### 5. Breakeven de Dedução Padrão vs. Completa (PGBL/VGBL)
* **Dedução Simplificada:** $D_{\text{simplificado}} = \min(Rend_{\text{bruto}} \times 0.20, 17.640,00)$
* **Deduções Legais (Completo):**
  $$D_{\text{completo}} = \text{INSS} + \text{Dep} \times 2.275,08 + \sum \min(\text{Educação}, 3.561,50) + \text{Saúde} + \text{PGBL}$$
* **Limite PGBL:** $\min(\text{Aportes}, Rend_{\text{bruto}} \times 0.12)$
* **Decisão:** Se $D_{\text{completo}} \le D_{\text{simplificado}} \implies$ **Aporte em VGBL** (tributa apenas ganho no resgate). Se superior $\implies$ **Aporte em PGBL** (deduz até 12% da base tributável).

---

## 💡 Immediate Implementation Ideas

1. **Calculadora Inteligente de Fator R:**
   Interface mensal onde o empresário insere faturamento e pró-labore. O sistema indica o Fator R projetado e sugere reajustes de pró-labore para enquadrar a empresa no Anexo III, economizando impostos de forma preventiva.
2. **Resolvedor de Atualização Monetária PJe-Calc Local:**
   Um simulador de débito judicial que aplica a regra híbrida da ADC 58 e a nova Lei nº 14.905/24. O processamento calcula a Taxa Legal diária e mensal a partir de tabelas SELIC/IPCA persistidas localmente no OPFS via SQLite WASM.
3. **Simulador IRPF 2026 com Redutor Especial:**
   Um comparador que simula o salário líquido CLT e PJ de 2026, calculando o Redutor Mensal Especial com gráficos de decaimento regressivo para rendas entre R$ 5.000,00 e R$ 7.350,00.
4. **Calibrador PGBL vs. VGBL:**
   Otimizador financeiro que analisa as despesas dedutíveis declaradas do utilizador e indica o valor exato a aportar em PGBL para atingir a isenção tributária máxima de 12% sem desperdiçar capital ineficiente.

---

## 🔬 Topics Needing Deep Study / Open Questions

* **Resolvedor Diário da SELIC no OPFS:** A atualização pro-rata requer a cotação diária da SELIC. Como gerenciar a atualização desse banco de dados local de taxas sem infringir a premissa de *zero-telemetria* (ou minimizando a conexão a APIs de dados governamentais)?
* **Peculiaridades de Transição do IRPFM:** Em caso de reorganização societária (holding familiar), como os dividendos isentos e o JCP devem ser declarados no modelo IRPFM sem que ocorram bitributações em cascata na PF?
* **Segurança de Execução no Web Worker:** Como garantir que o cache de consultas SQL executadas pelo SQLite no OPFS não guarde registros de identificação pessoal (CPF, nomes de credores e devedores) no disco local da máquina de forma desprotegida?

---

## 🏷️ CSV Schema & Auto-Activation Tags

### CSV Schema de Simulação Fiscal e Cálculo Trabalhista
```csv
data_vencimento,valor_original,tipo_debito,data_ajuizamento,data_quitacao,massa_salarial_12,receita_bruta_12,cnae_codigo
```

### Tags de Auto-Ativação (Tags/Metadata que disparam o Módulo Fiscal/Tributário):
* **Cabeçalhos de Colunas / Chaves:** `data_ajuizamento`, `massa_salarial_12`, `receita_bruta_12`, `cnae_codigo`, `tipo_debito`
* **Expressões e Metadados do Conteúdo:**
  * `Fator R`, `Simples Nacional`, `Anexo III`, `Anexo V`, `DAS`
  * `Lucro Presumido`, `Adicional IRPJ`, `CSLL`, `PIS`, `COFINS`, `PLP 182/2025`
  * `IRPF 2026`, `Redutor Especial`, `Lei 15.270/2025`, `IRPFM`, `Imposto Mínimo`
  * `ADC 58`, `Justiça do Trabalho`, `TRD`, `IPCA-E`, `Taxa Legal`, `Lei 14.905/2024`, `Resolução CMN 5.171/2024`
  * `PGBL`, `VGBL`, `Deduções Legais`, `Declaração Completa`, `Desconto Simplificado`
  * `OPFS`, `SQLite WASM`, `Web Workers`
