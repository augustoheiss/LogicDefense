# Plano de Pesquisa: PFM App Retention Analysis

Este documento detalha o plano de implementação e a especificação técnica para o setor de **Finanças Pessoais (PFM) e Mecanismos de Retenção**, elaborado a partir do estudo do artigo *"O Motor de Retenção Ativa em Finanças Pessoais: Análise Macroeconómica de Churn, Soberania de Dados e Interfaces Adaptativas no Setor de PFM"*.

---

## 🎯 Executive Summary & Sector Mapping

* **Setor de Aplicação:** Finanças Pessoais (PFM / Personal Finance Management).
* **Visão Geral:** O estudo aborda a crise de retenção no mercado de PFM (onde o churn acumula entre 85% e 90% até o 30º dia pós-instalação). Analisa as causas do abandono precoce (complexidade de UI, quebras em integrações bancárias via Plaid/Yodlee, fadiga de digitação e estados vazios sem utilidade imediata). Propõe a substituição do rastreio passivo retrospectivo pela **Engenharia Financeira Ativa** (Cash Flow dinâmico de 13 semanas, Monte Carlo, decomposição de metas, diagramas de Sankey, interfaces adaptativas baseadas em *Endowed Progress* e arquitetura local-first sob SQLite WAL e suporte local a assistentes via MCP).

---

## 🧮 Mathematical Models & Formulas

### 1. Limite da Memória de Trabalho Humana na UI (Miller's Law)
A complexidade cognitiva da interface deve respeitar os limites de chunks de processamento simultâneos na memória de trabalho:
$$N_{\text{items}} = 7 \pm 2 \quad (\text{ou } 4 \pm 1 \text{ em ambientes de alta ansiedade})$$
Módulos financeiros com excesso de cartões e inputs paralelos geram rejeição e hesitação cognitiva, acelerando o churn precoce.

---

### 2. Simulação Estocástica de Monte Carlo para Análise de Sucesso Financeiro
Para projeções de longo prazo e risco de sequência de retornos (*sequence-of-returns risk*), a variação do patrimônio ($W$) no tempo $t$ é modelada por caminhos de rendimento aleatórios baseados em médias históricas e volatilidade:
$$W_t = W_{t-1} \times (1 + R_t) - G_t$$
Onde:
* $R_t \sim \mathcal{N}(\mu, \sigma^2)$: rendimento estocástico da carteira no período $t$ modelado por uma distribuição normal.
* $\mu$: taxa média real de retorno histórico.
* $\sigma$: desvio padrão (volatilidade) dos ativos.
* $G_t$: saídas/gastos programados de capital (drawdown) no ano $t$.
A aplicação roda $N = 10.000$ trajetórias locais para estimar a probabilidade acumulada de o patrimônio manter-se acima de zero até a idade alvo (Bandas de Sucesso).

---

### 3. Modelo Psicofísico de Interfaces Adaptativas (*Endowed Progress Effect*)
O esforço percebido para completar a configuração inicial diminui se o utilizador sentir que já começou com progresso atribuído ficticiamente:
$$\text{Motivação} \propto \frac{\text{Progresso Atual}}{\text{Distância Total da Meta}}$$
* Se o onboarding exigir 5 etapas e começar em $0/5$, a taxa de conclusão é estatisticamente menor.
* Se a UI exibir $2/7$ etapas pré-concluídas (ex: Conta Criada e Chave Criptográfica Gerada localmente), o utilizador se engaja mais devido ao Efeito de Gradiente de Meta e ao Efeito Zeigarnik (desconforto mental por pendências).

---

## 💡 Immediate Implementation Ideas

1. **Dashboard de Transição Adaptativa (Adaptive Cockpit):**
   * **Estado de Dados Zero:** Exibe apenas um checklist de onboarding guiado por um assistente de IA conversacional local. Painéis e gráficos pesados ficam ocultados física e logicamente (unmounted).
   * **Estado de Dados Parciais:** Conforme o utilizador arrasta um extrato CSV ou tira print de transações (processadas via OCR local), skeletons dinâmicos são substituídos por gráficos simples e regras rápidas de categorização.
   * **Estado Pleno:** Liberação total do painel de controle (Sankey, Monte Carlo, Cmd+K).
2. **Visualizador de Fluxo de Caixa Sankey Dinâmico:**
   Substituir gráficos de pizza tradicionais por diagramas de Sankey interativos, exibindo de forma fluida a transição de receitas (salários, dividendos) para categorias de despesas e aportes de poupança/investimento.
3. **Simulador de Linha do Tempo Financeira (Rolling Cash Flow):**
   Uma janela deslizante de 13 semanas que mapeia a previsão de saldo disponível diário, antecipando estrangulamentos de caixa antes do vencimento de despesas recorrentes identificadas.
4. **Leitor de Extrato Bancário via OCR Local:**
   Um scanner no navegador que analisa capturas de tela do extrato bancário móvel (utilizando Web Workers e processamento na máquina do utilizador) e popula instantaneamente o registro de despesas locais sem conexão à nuvem.
5. **Modo Economia de Energia OLED (Pure Black Dark Theme):**
   Implementação de um tema `#000000` estrito no dashboard para poupar até 12% da bateria em dispositivos OLED, otimizando o desgaste físico em sessões de longa simulação financeira.

---

## 🔬 Topics Needing Deep Study / Open Questions

* **Complexidade do Mecanismo de Deduplicação Local:** Sem um servidor para gerenciar identidades, como resolver transações duplicadas em importações consecutivas de extratos CSV parciais usando hashing local estável (ex: hash de data + valor + descrição)?
* **Limitações de Performance do Monte Carlo no Navegador:** Executar 10.000 simulações stocásticas com branching complexo de cenários em JavaScript pode congelar a interface. Como arquitetar o motor estatístico usando Web Workers para manter a taxa de atualização a 60 FPS?
* **Padrões ActualQL:** Como estender a sintaxe de consulta local para suportar filtros eficientes em linguagem natural convertida localmente por LLMs leves (via Ollama ou WebGPU locais)?

---

## 🏷️ CSV Schema & Auto-Activation Tags

### CSV Schema de Histórico de Transações e Metas PFM
```csv
data_movimento,descricao_comerciante,valor_cents,categoria,meta_associada,status_consolidacao
```

### Tags de Auto-Ativação (Tags/Metadata que disparam o Módulo de PFM/Retenção):
* **Cabeçalhos de Colunas / Chaves:** `data_movimento`, `descricao_comerciante`, `valor_cents`, `meta_associada`
* **Expressões e Metadados do Conteúdo:**
  * `Personal Finance`, `PFM`, `Sankey Diagram`, `Sankey financeiro`, `Diagrama de Sankey`, `Fluxo de Caixa Rolante`, `Rolling Cash Flow`
  * `Monte Carlo`, `Simulação Estocástica`, `Branching de Cenários`, `FIRE`, `Sequence of Returns`
  * `Retenção Dia 30`, `Churn Precoce`, `Endowed Progress`, `Efeito Zeigarnik`, `Gradiente de Meta`
  * `ActualQL`, `Actual Budget`, `SQLite WAL`, `iCloud Sync`, `Self-hosted Docker`
  * `OCR Local`, `Tesseract WASM`, `Pure Black Theme`, `Consola Cmd+K`
