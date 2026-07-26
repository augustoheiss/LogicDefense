# Diagnóstico de Emergência: Recuperação da Importação da Planilha de Produção

**Data:** 26 de Julho de 2026  
**Aplicação:** `Assistente-Moeda-App`  
**Status:** DIAGNÓSTICO E PLANO DE RECUPERAÇÃO EMERGENCIAL  

---

## 1. Resumo Executivo & Situação Atual

Após as recentes alterações no mecanismo de reconhecimento de metas dinâmicas (`goal_*_YYYY`), normalização de tipos de entrada e sequência de fechamento de modais, o aplicativo entrou em um estado crítico onde **nenhuma planilha (nem a planilha de produção legada, nem as planilhas novas de testes) consegue ser carregada ou exibida na tela**.

Sintomas específicos relatados pelo usuário:
1. **Planilha de Produção com Metas Anuais:** Carrega apenas sobrescritas semanais/manuais pontuais (`weeklyGoals`), mas **não carrega nenhuma linha de transação** na tabela.
2. **Outras Planilhas e backups normais:** Não exibem nem as metas globais e **não carregam nenhuma linha de transação**.
3. **Bloqueio de Trabalho:** O usuário está impedido de prosseguir com seu trabalho diário na planilha de produção.

Este documento analisa a causa raiz técnica exata desse colapso, documenta os modos de falha e propõe um **plano de recuperação imediato e minimalista** para restaurar 100% o funcionamento da planilha de produção original e das planilhas de testes.

---

## 2. Análise da Causa Raiz Técnica

Nossa investigação forense no código descobriu **quatro pontos de quebra críticos** introduzidos durante a tentativa de suporte a metas anuais:

```
+---------------------------------------------------------------------------------------------------+
|                           FLUXO DE IMPORTAÇÃO & CAUSAS DO COLAPSO                                 |
+---------------------------------------------------------------------------------------------------+
|                                                                                                   |
|  [Arquivo CSV Legado / Produção]                                                                  |
|          │                                                                                        |
|          ▼                                                                                        |
|  [1. Rigidez do Delimitador no Bloco de Metas]                                                    |
|      - O código faz `line.split(',')` fixo no cabeçalho. Em planilhas brasileiras (separadas por `;`) |
|        a linha `name;Motorista` ou `goal_daily;100` não é dividida por vírgula e é descatada!      |
|          │                                                                                        |
|          ▼                                                                                        |
|  [2. Rejeição de Chaves Globais de Metas (Regex `^goal_(daily|weekly|annual)_(\d{4})$`)]          |
|      - O parser exige o sufixo numérico do ano `_2026`. Chaves legadas como `goal_daily`,          |
|        `goal_weekly`, `meta_diaria`, `meta_semanal` não casam com a Regex e são descartadas,     |
|        zerando todas as metas globais da planilha!                                                |
|          │                                                                                        |
|          ▼                                                                                        |
|  [3. Falha no Reconhecimento de Linhas sem Marcador `## ROWS ##`]                                 |
|      - Se a planilha legada não possui a tag `## ROWS ##` e contém linhas iniciais de metadados    |
|        (ex: `meta_diaria,100`), o parser trata a linha 0 como cabeçalho da tabela.               |
|      - Como `meta_diaria` não é `data` nem `valor`, `dateIdx` vira `-1` e o parser retorna         |
|        0 linhas com o erro "Cabeçalhos inválidos", bloqueando a abertura!                        |
|          │                                                                                        |
|          ▼                                                                                        |
|  [4. Detecção de Delimitador Conflitante entre Metadados e Transações]                            |
|      - `detectDelimiter(lines[0])` avalia a linha 0. Se a linha 0 for um metadado curto,           |
|        detecta `,`, mas a tabela de transações abaixo usa `;`. O `splitCSVLine` usa o delimitador |
|        errado e falha em extrair os valores das colunas!                                          |
|                                                                                                   |
+---------------------------------------------------------------------------------------------------+
```

---

## 3. Modos de Falha Detalhados

### Modo de Falha A: Rejeição de Chaves Sem Ano (`goal_daily`, `goal_weekly`, `goal_annual`)
* **Onde ocorre:** `src/utils/csvEngine.ts` (linhas 218–240)
* **Mecanismo:** A Regex introduzida foi `/^goal_(daily|weekly|annual)_(\d{4})$/`.
* **Consequência:** 
  - Planilhas de produção que contêm metas globais padrão como `goal_daily,100` ou `goal_weekly,700` (sem o ano `_2026` no final) **não casam com a Regex**.
  - O objeto `metaObj.tableGoals` fica completamente vazio.
  - As metas globais desaparecem e a interface renderiza cartões com metas zeradas.

### Modo de Falha B: Encontrando Cabeçalho em CSV sem `## ROWS ##` com Linhas de Metadados
* **Onde ocorre:** `src/utils/csvEngine.ts` (linhas 248–294)
* **Mecanismo:** Se um arquivo CSV de produção não tiver o marcador sintético `## ROWS ##` e contiver pares chave-valor no topo (ex: `name,Minha Planilha` ou `meta_diaria,50`), o parser pega a linha 0 como a linha de nomes de colunas (`headers`).
* **Consequência:**
  - `dateIdx` é procurado em `['name', 'minha planilha']` -> Retorna `-1`.
  - `amountIdx` é procurado em `['name', 'minha planilha']` -> Retorna `-1`.
  - O parser cai no `if (dateIdx === -1 || amountIdx === -1)` e aborta imediatamente retornando `rows: []` com erro `"Cabeçalhos inválidos"`.
  - **Nenhuma transação é importada**.

### Modo de Falha C: Split Fixo por Vírgula `,` em Blocos com Delimitador Ponto e Vírgula `;`
* **Onde ocorre:** `src/utils/csvEngine.ts` (linha 202)
* **Mecanismo:** No bloco de extração do cabeçalho `metaLines.forEach`, o código faz `line.split(',')`.
* **Consequência:** Em planilhas geradas pelo Excel em português (Brasil), os arquivos são delimitados por ponto e vírgula `;`. A linha `goal_daily_2026;100` não é dividida por `,`, gerando um array de 1 item `['goal_daily_2026;100']`. A condição `parts.length >= 2` falha e a meta é totalmente ignorada.

### Modo de Falha D: Varredura de Cabeçalho da Tabela Real (Header Scanner)
* **Onde ocorre:** `src/utils/csvEngine.ts` (linhas 248–285)
* **Mecanismo:** Quando o arquivo não possui `## ROWS ##`, o parser assume cegamente que a linha `lines[0]` é a coluna de transações.
* **Consequência:** Se o arquivo tem comentários, título ou metadados nas primeiras linhas, o parser falha. Ele precisa procurar ativamente a primeira linha que contenha colunas reais de data e valor.

---

## 4. Plano de Ação Emergencial de Recuperação

Para restaurar imediatamente a compatibilidade total e permitir o carregamento da planilha de produção legada e de qualquer planilha nova, o plano é simplificar e flexibilizar o parser com as seguintes ações:

### Ação 1: Scanner Universal de Cabeçalho de Transações (Zero-Failure Header Finder)
- Atualizar `parseCSVText` para varrer as linhas do arquivo (com ou sem `## ROWS ##`) até encontrar a **linha real que contém as colunas de data e valor** (`date` / `data` e `amount` / `valor`).
- Todas as linhas acima da linha de cabeçalho identificada serão tratadas como bloco de metadados, independentemente de existir a tag `## ROWS ##` ou não.

### Ação 2: Delimitador Flexível por Linha de Metadado
- Substituir `line.split(',')` por `splitCSVLine(line, detectDelimiter(line))` no bloco de metadados para aceitar tanto vírgulas `,` quanto ponto e vírgula `;`.

### Ação 3: Suporte Universal a Metas Globais e Anuais (Regex Expandida)
- Expandir o parser de chaves de metas para reconhecer:
  - Metas Globais sem ano: `goal_daily`, `goal_weekly`, `goal_annual`, `meta_diaria`, `meta_semanal`, `custo_anual`.
  - Metas Anuais com ano: `goal_daily_YYYY`, `goal_weekly_YYYY`, `goal_annual_YYYY`.
  - Metas Mensais: `goal_monthly_daily_YYYY-MM`, etc.

### Ação 4: Fallback Seguro de Inserção de Linhas
- Garantir que `addRows` / `updateActiveTableRows` sempre persista os dados na planilha ativa e defina `selectedMonth = 'all'` para que todas as linhas importadas fiquem imediatamente visíveis na tela.

---

## 5. Garantia de Preservação e Testes

1. A planilha de produção antiga voltará a abrir normalmente sem a necessidade de converter ou renomear arquivos.
2. Todas as planilhas de testes (com metas globais, metas anuais ou sem metas) serão carregadas instantaneamente.
3. Execução de `npx tsc --noEmit` e `npm test` para confirmar 100% de aprovação técnica.
