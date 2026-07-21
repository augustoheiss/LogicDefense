# Plano de Pesquisa: Advanced SMB Financial Modeling

Este documento detalha o plano de implementação e a especificação técnica para o setor de **PMEs / Gestão Contábil e Financeira**, elaborado a partir do estudo do artigo *"Análise Avançada de Métricas de Liquidez, Volatilidade e Estruturas Tributárias para PMEs: Um Guia de Engenharia Financeira Local-First"*.

---

## 🎯 Executive Summary & Sector Mapping

* **Setor de Aplicação:** PMEs / Gestão Contábil e Financeira (Accounting & SMBs).
* **Visão Geral:** O estudo visa substituir as planilhas estáticas tradicionais por modelos de fluxo dinâmicos e probabilísticos rodando inteiramente no lado do cliente (*local-first*). O foco principal é a otimização de capital de giro baseada em tempos de entrega logísticos (*Lead-Time*), previsões probabilísticas de fluxo de caixa (*Cash Flow at Risk*), cálculo eficiente e robusto de volatilidade de margens (Algoritmo de Welford), simulação detalhada de encargos trabalhistas sob regimes fiscais brasileiros, e um parser contábil eficiente em tokens para reconciliação de planos de contas (SPED ECD).

---

## 🧮 Mathematical Models & Formulas

### 1. Ciclo de Conversão de Caixa ($CCC$)
O $CCC$ quantifica o tempo decorrido entre o desembolso e a entrada de caixa:
$$CCC = PME + PMR - PMP$$

Onde:
* **$PME$ (Prazo Médio de Estocagem):** 
  $$PME = \frac{\text{Estoque Médio} \times T}{CPV}$$
* **$PMR$ (Prazo Médio de Recebimento):**
  $$PMR = \frac{\text{Contas a Receber Médias} \times T}{\text{Receita Operacional Bruta}}$$
* **$PMP$ (Prazo Médio de Pagamento):**
  $$PMP = \frac{\text{Contas a Pagar Médias} \times T}{\text{Compras}}$$
*(onde $T$ é o período em dias)*

### 2. Necessidade de Capital de Giro Dinâmica ($NCG_D$) com Buffers de Inventário
Considerando o consumo diário médio de insumos ($DD$), lead-time do fornecedor ($LT$) e estoque de segurança ($SS$):
$$NCG_D(t) = (DD \times LT) + SS(t)$$

Onde o Estoque de Segurança ($SS(t)$) é calculado sob condições de incerteza da procura e do lead-time:
$$SS(t) = Z_{\alpha} \times \sqrt{LT \times \sigma_D^2 + D^2 \times \sigma_{LT}^2}$$

* $Z_{\alpha}$: nível de serviço requerido (quantil da distribuição normal).
* $\sigma_D$: desvio-padrão da procura diária.
* $D$: procura média diária.
* $\sigma_{LT}$: volatilidade do lead-time de entrega do fornecedor.

### 3. Previsão Probabilística de Caixa & Cash Flow at Risk ($CFaR$)
Dadas as probabilidades de cenário $P_i(t)$ no tempo $t$ onde $\sum P_i(t) = 1$:
* **Fluxo de Caixa Esperado:**
  $$E[CF(t)] = \sum_{i} P_i(t) \times CF_i(t)$$
* **Variância do Fluxo de Caixa:**
  $$\sigma^2(CF(t)) = \sum_{i} P_i(t) \times (CF_i(t) - E[CF(t)])^2$$
* **Cash Flow at Risk ($CFaR$):**
  $$CFaR = E[CF(t)] - Z_{1-\alpha} \times \sigma(CF(t))$$
*(onde $Z_{1-\alpha}$ é o quantil correspondente para o nível de confiança, ex: $Z_{0.95} = 1.645$ ou $Z_{0.99} = 2.33$)*

### 4. Algoritmo de Welford para Volatilidade de Margens (Passagem Única)
Para evitar o cancelamento catastrófico em ponto flutuante no navegador, as médias ($M$) e somas de desvios quadráticos ($S$) são atualizadas incrementalmente:
$$M_k = M_{k-1} + \frac{x_k - M_{k-1}}{k}$$
$$S_k = S_{k-1} + (x_k - M_{k-1})(x_k - M_k)$$

Para a variância amostral ($s_k^2$) e desvio-padrão amostral ($s_k$):
$$s_k^2 = \frac{S_k}{k - 1}$$
$$s_k = \sqrt{s_k^2}$$

#### Algoritmo de Welford para Janela Deslizante de Tamanho $W$:
Ao introduzir $x_t$ e remover o elemento antigo $x_{t-W}$:
$$M_t = M_{t-1} + \frac{x_t - x_{t-W}}{W}$$
$$S_t = S_{t-1} + (x_t - x_{t-W})(x_t - M_t + x_{t-W} - M_{t-1})$$
$$s_t^2 = \frac{S_t}{W - 1}$$

### 5. Encargos Trabalhistas & Benefício Fiscal (Tax Shield)
* **RAT Ajustado:**
  $$RAT_{\text{ajustado}} = RAT_{\text{base}} \times FAP$$
  *(onde $RAT_{\text{base}} \in \{1\%, 2\%, 3\%\}$ e $FAP \in [0.5, 2.0]$)*
* **Benefício Fiscal (Tax Shield - $TS_{\text{folha}}$) no Lucro Real:**
  $$TS_{\text{folha}} = \text{Despesas de Pessoal} \times (T_{\text{IRPJ}} + T_{\text{CSLL}})$$
  *(considerando $T_{\text{IRPJ}} + T_{\text{CSLL}} = 34\%$ no teto de dedutibilidade fiscal)*
* **Custo Efetivo Líquido do Funcionário ($C_{\text{efetivo}}$):**
  $$C_{\text{efetivo}} = \text{Despesas Totais} - TS_{\text{folha}} + \text{Benefícios Isentos}$$

---

## 💡 Immediate Implementation Ideas

1. **Dashboard de Simulação de Buffers DRP:** 
   Criar uma interface gráfica onde o gestor insira a variabilidade de lead-time e demanda e visualize dinamicamente a divisão dos buffers em cores (Vermelha, Amarela, Verde) e o impacto monetário no capital de giro necessário.
2. **Calculador de Volatilidade de Rentabilidade em Tempo Real:** 
   Implementar em TypeScript/Javascript o Algoritmo de Welford deslizante para atualizar dinamicamente desvios-padrão das margens (Bruta, EBITDA e Líquida) à medida que novas transações são inseridas/reconciliadas, sem persistência redundante de arrays na memória local.
3. **Simulador Multicritério de Folha de Pagamento:** 
   Um componente interativo de contratação que compare os custos totais (nominais e efetivos) de contratação CLT sob o regime do Simples Nacional, Lucro Presumido e Lucro Real (com e sem dedutibilidade do Tax Shield de 34% e variação dinâmica de FAP).
4. **Parser Contábil Local-First (Estrutura em Árvore):**
   Implementar um parser eficiente para carregar o Plano de Contas via CSV token-efficient, aplicando uma travessia pós-ordem recursiva para consolidar os saldos das contas analíticas (folhas) até a raiz, sinalizando incoerências de classificação ou inversão de natureza.

---

## 🔬 Topics Needing Deep Study / Open Questions

* **Arredondamento nos Sistemas Oficiais:** Como mitigar a diferença entre o cálculo local do FAP (com 4 casas decimais) e as plataformas governamentais (SEFIP) que utilizam truncamentos específicos a cada etapa do cálculo, para evitar discrepâncias de centavos nas guias de recolhimento?
* **Elasticidade e Covariância:** No modelo de Cash Flow at Risk ($CFaR$) por método Bottom-Up, como o frontend pode estimar de forma simplificada a matriz de covariância entre variáveis macro (como a taxa SELIC) e micro (elasticidade-preço de vendas) sem exigir o carregamento de bases de dados históricas externas massivas?
* **Gestão de Buffer Circular em LocalStorage:** Qual a melhor estrutura de dados no `localStorage` para manter buffers deslizantes de transações comerciais para o cálculo do Welford deslizante mantendo a consistência e velocidade do aplicativo?

---

## 🏷️ CSV Schema & Auto-Activation Tags

### CSV Schema de Plano de Contas (Token-Efficient)
```csv
id,parent_id,level,type,nature,code,name,balance
```

### Tags de Auto-Ativação (Tags/Metadata que disparam o Módulo PME/Contabilidade):
* **Cabeçalhos de Colunas / Chaves:** `parent_id`, `nature`, `balance`, `code`, `level`
* **Expressões e Metadados do Conteúdo:** 
  * `FAP`, `RAT`, `RAT Ajustado`, `INSS Patronal`, `Simples Nacional`, `Lucro Presumido`, `Lucro Real`, `Tax Shield`, `FGTS`
  * `Margem EBITDA`, `Margem Bruta`, `Margem Líquida`, `EBITDA`
  * `Welford`, `Desvio Padrão Margem`, `Volatilidade Margem`
  * `CFaR`, `Cash Flow at Risk`, `Worst Case`, `Best Case`, `Base Case`
  * `Lead-Time`, `Estoque de Segurança`, `Zona Vermelha`, `Buffer DRP`, `Ciclo de Conversão de Caixa`, `PME`, `PMR`, `PMP`
