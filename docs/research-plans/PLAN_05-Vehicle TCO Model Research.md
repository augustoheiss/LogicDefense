# Plano de Pesquisa: Vehicle TCO Model Research

Este documento detalha o plano de implementação e a especificação técnica para o setor de **Veículos e Gestão de Frota**, elaborado a partir do estudo do artigo *"Modelação Avançada do Custo Total de Propriedade (TCO) de Veículos Ligeiros e Comerciais: Uma Abordagem Logística e Atuarial"*.

---

## 🎯 Executive Summary & Sector Mapping

* **Setor de Aplicação:** Veículos e Gestão de Frota (Vehicles & Fleet).
* **Visão Geral:** O estudo propõe uma abordagem logística e atuarial avançada para frotas e veículos individuais de PMEs. O motor de cálculo substitui os custos históricos lineares por um modelo dinâmico de Custo por Quilômetro ($CPK$) parametrizado em tempo real. Ele integra desgaste de pneus conforme a rugosidade do asfalto ($IRI$), cálculo de seguros sob telemetria comportamental (UBI), curvas de depreciação combinando idade e uso mecânico, análise de investimento (VAL) comparando propriedade vs. mobilidade compartilhada (com desconto de impostos, tax shield e tempo produtivo ganho) e otimização preditiva de componentes críticos via distribuição de Weibull.

---

## 🧮 Mathematical Models & Formulas

### 1. Modelo Dinâmico de Custo Técnico por Quilômetro ($CPK$)
O custo por quilômetro consolidado é expresso pela soma:
$$CPK = C_{\text{energia}} + C_{\text{pneus}} + C_{\text{manutenção}} + C_{\text{seguro}} + C_{\text{depreciação}}$$

#### Custo Dinâmico de Energia ($C_{\text{energia}}$) em L/100 km ou kWh/100 km:
$$C_{\text{energia}} = \frac{FC_{\text{real}} \times (P_{\text{ref}} + \sigma_{90}) \times (1 + \delta_{\text{condutor}})}{100}$$
*(onde $P_{\text{ref}}$ é o preço base local, $\sigma_{90}$ é a volatilidade cambial/energia a 90 dias, e $\delta_{\text{condutor}}$ é o coeficiente de estilo de condução - degradação de até 15%)*

#### Custo Dinâmico de Pneus ($C_{\text{pneus}}$):
$$C_{\text{pneus}} = N_{\text{pneus}} \times \frac{C_{\text{unitário}}}{K_{\text{ref}} \cdot e^{-\lambda \cdot IRI}}$$
*(onde $N_{\text{pneus}}$ é a quantidade de pneus, $C_{\text{unitário}}$ o custo unitário, $K_{\text{ref}}$ a vida útil nominal e $\lambda$ a sensibilidade à rugosidade da estrada $IRI$)*

#### Seguro Baseado no Uso (UBI - $C_{\text{seguro}}$):
$$C_{\text{seguro}} = \frac{P_{\text{estático}}}{K_{\text{anual}}} + C_{\text{km\_base}} \times \left(1 + \sum_{i} \frac{N_i}{D_{\text{ref}}} \times w_i\right)$$
*(cruzando prémio fixo diluído com penalizações por eventos de aceleração brusca $N_i$ ponderados pela severidade $w_i$)*

---

### 2. Estimação do Valor Residual do Ativo (Depreciação)
Para capturar o desgaste simultâneo por tempo e quilometragem acumulada, aplica-se uma regressão log-linear múltipla ponderada:
$$\ln(V(t, d)) = \beta_0 - \beta_1 \cdot t - \beta_2 \cdot d - \beta_3 \cdot (t \times d) + \epsilon$$
* $V(t, d)$: valor residual estimado.
* $t$: idade do veículo em anos; $d$: quilometragem acumulada.
* $\beta_3$: termo de interação multiplicativa (penalização severa por alta idade + alto uso).

---

### 3. Análise Econômica Comparativa a 5 Anos (Propriedade vs. Mobilidade)

#### Propriedade Própria Comercial ($VAL_{\text{propriedade}}$) com Benefícios Fiscais (Tax Shield):
$$VAL_{\text{propriedade}} = -I_0 - \sum_{t=1}^{5} \frac{C_{\text{op}}(t) \times (1 - \tau) - \tau \cdot D_{\text{fiscal}}(t)}{(1 + r)^t} + \frac{V_{\text{residual}} - \tau \cdot (V_{\text{residual}} - V_{\text{contábil}}) \cdot \mathbb{I}(V_{\text{residual}} > V_{\text{contábil}})}{(1 + r)^5}$$
*(onde $I_0$ é o investimento inicial, $C_{\text{op}}$ os custos de CPK, $\tau$ o imposto societário (IRC), $D_{\text{fiscal}}$ a depreciação contábil, e $r$ a taxa de desconto)*

#### Mobilidade Compartilhada Corporativa ($VAL_{\text{partilhada}}$):
$$VAL_{\text{partilhada}} = -\sum_{t=1}^{5} \frac{C_{\text{viagens}}(t) - B_{\text{tempo\_recuperado}}(t)}{(1 + r)^t}$$
Onde o benefício de produtividade por tempo livre de condução ($B_{\text{tempo\_recuperado}}$) é dado por:
$$B_{\text{tempo\_recuperado}} = \text{TempoViagemHoras} \times \text{TaxaSalarial} \times \eta_{\text{eficácia\_laboral}}$$
*(onde $\eta_{\text{eficácia\_laboral}} \in [0, 1]$ representa a eficiência média de trabalho no banco de trás)*

---

### 4. Algoritmo Preditivo de Otimização de Manutenção (Weibull)
Em vez de usar a ineficiente Quilometragem Média Entre Falhas ($MMBF$), que causa quebras prematuras em 54% dos casos ($\beta > 1$), calcula-se a quilometragem ótima de intervenção preventiva ($M^*$) que minimiza o custo totalizado:
$$EC(M) = \frac{C_{\text{prev}} \cdot e^{-(M/\eta)^\beta} + C_{\text{corr}} \cdot (1 - e^{-(M/\eta)^\beta})}{\int_{0}^{M} e^{-(u/\eta)^\beta} \, du}$$
* $C_{\text{prev}}$: custo de substituição agendada.
* $C_{\text{corr}}$: custo de reparação emergencial após quebra em rota ($C_{\text{corr}} \gg C_{\text{prev}}$).
* $\beta, \eta$: parâmetros de forma e escala da distribuição de Weibull do componente.

---

## 💡 Immediate Implementation Ideas

1. **Simulador de Viabilidade Financeira (Comprar vs. Táxi/Uber):**
   Ferramenta interativa que compare o TCO dinâmico de deter um carro comercial com o uso de mobilidade compartilhada corporativa, incluindo a monetização de horas de condução convertidas em trabalho no cálculo do $VAL$.
2. **Otimizador Weibull de Manutenção de Frota:**
   Criar um componente de planejamento de frota que utilize os coeficientes de Weibull fornecidos pelo artigo para calcular a quilometragem ótima ($M^*$) de troca de itens de desgaste (pastilhas, injetores, filtros de partículas), sinalizando graficamente o desvio em relação ao MMBF.
3. **Módulo de CPK em Tempo Real via Reconciliação local:**
   Componente do dashboard que calcula de forma dinâmica o CPK diário da frota do utilizador à medida que ele reconcilia faturas de postos de combustível, reparações e prémios de seguros.
4. **Calculadora Telemetria UBI (Seguro por Uso):**
   Criar um simulador onde o utilizador ajusta scores de frenagem, curvas e excesso de velocidade e vê imediatamente a economia potencial sob o regime de Seguro Baseado no Uso.

---

## 🔬 Topics Needing Deep Study / Open Questions

* **Peculiaridades de Cálculo da Integral de Weibull no Browser:** A função de custo esperado $EC(M)$ requer integração numérica no denominador. Como implementar um resolvedor numérico leve em JS/TS para encontrar o mínimo sem comprometer a performance do frontend?
* **Indexação da Volatilidade Energética $\sigma_{90}$:** Como o frontend local-first obteria de forma leve e estritamente local (ou offline) o desvio-padrão de volatilidade energética regional de 90 dias?
* **Amortização Fiscal vs. Amortização Real:** As regras do Fisco em diferentes países fixam quotas de amortização de viaturas de forma estrita. Como reconciliar a depreciação fiscal fixa (para fins de benefício de imposto) com a perda real de valor de mercado (para fins de valuation de frota) sem duplicar lançamentos?

---

## 🏷️ CSV Schema & Auto-Activation Tags

### CSV Schema de Frotas e Custos Operacionais (Desnormalizado)
```csv
idVeiculo,perfil_categoria,perfil_propulsao,perfil_msrp,perfil_distanciaAnual,energia_precoBase,energia_volatilidadeIndice,energia_consumoNominal,energia_fatorCondutor,energia_fatorRota,pneus_quantidadePneus,pneus_precoUnitario,pneus_vidaNominal,pneus_iriEstrada,pneus_sensibilidadeIri,seguro_premioBase,seguro_taxaVariavel,seguro_pontuacaoSeguranca,seguro_fatorRisco,deprec_coefIdade,deprec_coefQuilometragem,deprec_idadeAtualAnos,deprec_quilometragemAcumulada,weibull_beta,weibull_eta,weibull_custoPrev,weibull_custoCorr
```

### Tags de Auto-Ativação (Tags/Metadata que disparam o Módulo de Frota/Veículos):
* **Cabeçalhos de Colunas / Chaves:** `idVeiculo`, `perfil_propulsao`, `energia_precoBase`, `pneus_iriEstrada`, `seguro_pontuacaoSeguranca`, `weibull_beta`, `weibull_eta`, `weibull_custoPrev`
* **Expressões e Metadados do Conteúdo:**
  * `CPK`, `Custo por Quilómetro`, `WLTP`, `WLTP consumo`, `TCO Veículo`
  * `Desgaste de Pneus`, `Abrasão Pneu`, `Pavimento IRI`, `Rugosidade Pavimento`
  * `Usage-Based Insurance`, `UBI`, `Telemetria seguro`, `Pontuação de Segurança`
  * `Decaimento Exponencial Veículo`, `Valor Residual Veículo`, `Desvalorização Veículo`
  * `VAL frota`, `Tax Shield frotas`, `Benefício Fiscal Veículos`, `Tempo Útil Recuperado`
  * `Weibull`, `Weibull frotas`, `MMBF`, `Mean Miles Between Failure`, `Reparação Corretiva`, `Manutenção Preventiva`
