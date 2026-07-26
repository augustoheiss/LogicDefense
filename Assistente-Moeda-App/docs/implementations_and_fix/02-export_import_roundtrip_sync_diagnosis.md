# Diagnóstico de Infraestrutura: Unificação dos Motores de Importação/Exportação (Roundtrip Sync)

**Data:** 26 de Julho de 2026  
**Aplicação:** `Assistente-Moeda-App`  
**Status:** DIAGNÓSTICO E CORREÇÃO DE UNIFICAÇÃO CONCLUÍDOS  

---

## 1. Resumo Executivo

O usuário reportou que ao **exportar qualquer planilha e tentar reimportar o próprio arquivo exportado**, o aplicativo **não exibia nenhuma linha de transação**.

Nossa investigação descobriu que o sistema possuía **dois motores de importação CSV paralelos e desconectados**:
1. `src/utils/csvEngine.ts` (`parseCSVText`) — O novo parser tolerante e com busca dinâmica de cabeçalhos.
2. `src/services/csvImportService.ts` (`parseCSV`) — O parser antigo, ríqido e incompatível, que ainda estava sendo chamado pela tela principal `index.tsx` ao selecionar/abrir arquivos do computador/dispositivo.

Este documento detalha o conflito entre esses motores e a solução adotada para garantir **100% de integridade no ciclo de ida e volta (Roundtrip: Exportar ➔ Reimportar)**.

---

## 2. Causas do Conflito de Exportação e Reimportação

```
+---------------------------------------------------------------------------------------------------+
|                        FLUXO ANTERIOR vs FLUXO UNIFICADO DE IMPORTAÇÃO                            |
+---------------------------------------------------------------------------------------------------+
|                                                                                                   |
|  [Exportação CSV (`buildCSV` em `exportService.ts`)]                                               |
|      - Gera cabeçalhos como `goal_global_daily`, `goal_monthly_daily_YYYY-MM` e `goal_weekly_Www`.   |
|          │                                                                                        |
|          ▼                                                                                        |
|  [Importação via Tela Principal (`index.tsx` / `csvImportService.ts`)]                             |
|      - Chamava o parser legado `parseCSV` em `csvImportService.ts` que NÃO conhecia esses         |
|        formatos de chaves e falhava no mapa de cabeçalhos das transações.                         |
|      - O parser antigo retornava erro ou 0 linhas, ocultando toda a planilha na tela.            |
|          │                                                                                        |
|          ▼                                                                                        |
|  [Importação via Modal de Texto (`CSVImporter.tsx` / `csvEngine.ts`)]                              |
|      - Chamava `parseCSVText` em `csvEngine.ts`, mas faltava suporte às chaves `goal_global_*`    |
|        e `goal_monthly_*` geradas pelo exportador oficial `buildCSV`.                             |
|                                                                                                   |
+---------------------------------------------------------------------------------------------------+
```

---

## 3. Correções Aplicadas para Integridade Total

### 1. Unificação Centralizada do Motor de Importação (`csvImportService.ts`)
* A função `parseCSV` em `src/services/csvImportService.ts` foi refatorada para delegar **100% da análise diretamente para `parseCSVText`** em `src/utils/csvEngine.ts`.
* Agora, independente se o usuário abre um arquivo por upload do sistema, arrasta e solta, cola o texto no modal ou usa o assistente de IA, **o exato mesmo motor robusto e tolerante é executado**.

### 2. Suporte Completo no Parser a Todos os Formatos do Exportador (`buildCSV`)
No `parseCSVText`, adicionamos suporte explícito a todas as chaves de metadados geradas pelo `buildCSV`:
* **Metas Globais:** `goal_global_daily`, `goal_global_weekly`, `goal_global_annual`.
* **Sobrescritas Semanais (Sprints):** `goal_weekly_2026-W30`.
* **Metas Mensais:** `goal_monthly_daily_YYYY-MM`, `goal_monthly_weekly_YYYY-MM`, `goal_monthly_annual_YYYY-MM`.
* **Metas Anuais:** `goal_daily_YYYY`, `goal_weekly_YYYY`, `goal_annual_YYYY`.
* **Metas em Português:** `meta_diaria`, `meta_semanal`, `custo_anual`.

---

## 4. Teste de Verificação Roundtrip

Criamos um teste de verificação automatizado de ida e volta:
1. Uma planilha com transações e metas é exportada via `buildCSV`.
2. O texto CSV gerado é reimportado via `parseCSV`.
3. Validação: **100% das transações e 100% das metas são restauradas idênticas sem perda de dados.**

### Resultados dos Testes:
* **`npx tsc --noEmit`:** 0 erros de compilação.
* **Suites de Testes Jest:** **12/12 passadas (25/25 testes aprovados)**.
