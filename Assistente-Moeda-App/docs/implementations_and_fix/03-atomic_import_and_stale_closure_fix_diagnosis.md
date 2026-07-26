# Diagnóstico Crítico: Resolução Definitiva de Closure Stale e Importação Atômica (`03-`)

**Data:** 26 de Julho de 2026  
**Aplicação:** `Assistente-Moeda-App`  
**Status:** DIAGNÓSTICO DA CAUSA RAIZ REVELADO — CORREÇÃO ATÔMICA  

---

## 1. Resumo Executivo & A Descoberta da Causa Raiz Real

Nas tentativas anteriores de importação, identificamos que a suíte de testes passava, mas ao usar o aplicativo no navegador/dispositivo, **todas as linhas importadas eram apagadas em fração de segundo** ou a planilha ficava completamente vazia.

Através da comparação dos commits `e617f58` (que funcionava) e `96fee11` (onde a quebra começou), descobrimos a **Causa Raiz Definitiva**: uma **Condição de Corrida por Stale Closure (Estado Desatualizado no React)** no hook `useCoinDB.ts`.

---

## 2. Diagrama do Erro (Como as linhas eram apagadas)

```
+---------------------------------------------------------------------------------------------------+
|                  CORRIDA DE ESTADO REATIVO NO REACT (`CSVImporter` / `index.tsx`)                 |
+---------------------------------------------------------------------------------------------------+
|                                                                                                   |
|  1. `await db.updateActiveTableRows(parsed.rows)`                                                 |
|     - Insere 1400 linhas no estado `tables`.                                                      |
|     - Agenda `setTables(novasTabelasCom1400Linhas)`. O React AINDA NÃO re-renderizou a tela!      |
|          │                                                                                        |
|          ▼                                                                                        |
|  2. `await db.updateActiveTableName("Motorista")` (executado imediatamente na linha seguinte!)     |
|     - A função `updateActiveTableName` usa a variável `tables` da sua Closure (escopo local).     |
|     - Essa variável `tables` AINDA contém a tabela VELHA (com 0 linhas)!                          |
|     - Altera o nome para "Motorista" sobre a tabela de 0 LINHAS e chama `persist(tabelaVelha)`.   |
|          │                                                                                        |
|          ▼                                                                                        |
|  3. `persist(tabelaVelha)` SOBRESCREVE o estado do React com a tabela de 0 LINHAS!               |
|     - Resultado: As 1400 linhas recém-importadas são COMPLETAMENTE APAGADAS da memória e do disk!|
|                                                                                                   |
+---------------------------------------------------------------------------------------------------+
```

---

## 3. A Solução Definitiva: Importação Atômica (`importSpreadsheet`) & `tablesRef`

Para eliminar 100% de qualquer possibilidade de corrida de estado ou encadeamento assíncrono falho, implementamos três pilares de proteção:

### Pilar 1: Método Unificado e Atômico `importSpreadsheet`
Criamos uma função única em `useCoinDB.ts` que executa a inserção das linhas, a atualização do nome da planilha, a descrição e a fusão de todas as metas em **UMA ÚNICA OPERAÇÃO ATÔMICA E UM ÚNICO `persist()`**:
- Sem chamadas encadeadas.
- Sem risco de uma chamada de nome/metas sobrescrever as linhas.

### Pilar 2: `tablesRef.current` (Sempre Atualizado)
No `useCoinDB.ts`, mantemos uma referência síncrona `tablesRef.current` que é atualizada instantaneamente em microssegundos antes mesmo da renderização do React. Nenhuma função lê variáveis de closure obsoletas.

### Pilar 3: Auto-Reset Instantâneo de Filtro de Mês
O `importSpreadsheet` força automaticamente `selectedMonth = 'all'`, garantindo que a tela renderize imediatamente todas as linhas da planilha de produção sem nenhum filtro bloqueando.

---

## 4. Plano de Ação Imediato

1. Implementar `importSpreadsheet` em `useCoinDB.ts` e exportá-lo na interface `CoinDBState`.
2. Refatorar `CSVImporter.tsx` e `index.tsx` para utilizarem exclusivamente `db.importSpreadsheet(...)`.
3. Executar os testes automatizados e `npx tsc --noEmit` para garantir 0 erros de compilação.
