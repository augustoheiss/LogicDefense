# Diagnostic Report: Spreadsheet Loading and Rendering Failure Analysis

**Date:** July 26, 2026  
**Application:** `Assistente-Moeda-App`  
**Status:** DIAGNOSIS COMPLETE — NO CODE ALTERED  

---

## 1. Executive Summary

Following recent enhancements to dynamic header metadata parsing (`goal_*` keys), defensive CSV tokenization, and import modal sequence unblocking, a regression emerged where spreadsheets fail to open, switch, or display transaction rows on screen.

While unit tests (`legacyImport`, `productionImport`, `stressImport`, `appRoundtrip`, `quotedCSVImport`, `noGoalsImport`, `runtimeImportFlow`, `contextImport`, `emptyDescriptionImport`) pass cleanly in isolation, full end-to-end execution in the React Native / Expo Web app encounters state mismatches and render-blocking side effects.

This diagnostic report provides a comprehensive root cause analysis, outlines all identified failure modes and edge cases, and presents a step-by-step remediation plan for approval prior to code implementation.

---

## 2. Technical Root Cause Analysis

Our investigation identified **five distinct root causes** acting individually or in combination during spreadsheet opening, switching, and importing:

```
+---------------------------------------------------------------------------------------------------+
|                                 SPREADSHEET LOADING PIPELINE                                      |
+---------------------------------------------------------------------------------------------------+
|                                                                                                   |
|  [CSV / Disk Load]                                                                                |
|          │                                                                                        |
|          ▼                                                                                        |
|  [1. Index Mismatch] ────► TableSwitcherModal passes index in `tables`, but `activeTable`        |
|                            indexes into `activeTables` (filtered `isDeleted`). Indices diverge!  |
|          │                                                                                        |
|          ▼                                                                                        |
|  [2. Background Sync] ───► `persist()` triggers async `fullSync()`. If remote pull fails/merges   |
|                            stale data, `loadDB()` overwrites local state and wipes rows!         |
|          │                                                                                        |
|          ▼                                                                                        |
|  [3. Filter Hiding] ─────► `filteredRows` matches `selectedMonth` (e.g. 2026-07). Historical     |
|                            5-Year or legacy data (2021-2025) results in [] (empty screen).       |
|          │                                                                                        |
|          ▼                                                                                        |
|  [4. Goals Deref Crash] ─► Uncaught TypeError when computing metrics from partial/undefined       |
|                            `yearlyGoals[year]` objects during render.                            |
|          │                                                                                        |
|          ▼                                                                                        |
|  [5. Table Rename vs Add] ► Importing named spreadsheet overwrites active table rows in-place     |
|                            instead of switching selection to newly created table.                |
|                                                                                                   |
+---------------------------------------------------------------------------------------------------+
```

---

## 3. Detailed Failure Modes & Edge Cases

### Failure Mode 1: Table Index Divergence in `TableSwitcherModal`
* **Location:** `src/components/ui/TableSwitcherModal.tsx` & `src/hooks/useCoinDB.ts`
* **Mechanism:** 
  - `useCoinDB.ts` maintains `tables` (all loaded tables, including tombstoned `isDeleted: true` entries) and `activeTables` (`tables.filter(t => !t.isDeleted)`).
  - `activeTable` selector looks up `activeTables[activeTableIndex]`.
  - `TableSwitcherModal.tsx` receives `tables={db.tables}` (the **unfiltered** list) and calls `onSelect(index)` passing the raw loop index `index`.
* **Impact:** When any table in `db.tables` has `isDeleted: true`, the array indices in `tables` and `activeTables` diverge. Clicking spreadsheet #2 in `TableSwitcherModal` sets `activeTableIndex = 2`, but `activeTable` looks up index 2 in `activeTables` (which corresponds to spreadsheet #3 or goes out of bounds, falling back to spreadsheet #0).
* **Symptom:** Selecting a spreadsheet in the modal fails to open it or opens the wrong spreadsheet.

---

### Failure Mode 2: Async Cloud Reversion (`fullSync` Overwrite)
* **Location:** `src/hooks/useCoinDB.ts` (`persist` function) & `src/storage/supabaseSync.ts`
* **Mechanism:**
  - Calling `updateActiveTableRows` or `addRows` calls `persist(newTables)`.
  - `persist` synchronously executes `setTables(mainTables)` and saves to AsyncStorage (`saveDB`).
  - Next, if `auth.mode === 'authenticated'`, `persist` launches an asynchronous `fullSync(auth.user.id)` in the background.
  - When `fullSync` completes, its `.then()` callback executes `loadDB()` and calls `setTables(ensureActiveSectors(db.tables))`.
* **Impact:** If `fullSync` fails to push newly created goal fields (`goal_daily_YYYY`) or new rows to Supabase before pulling, `fullSync` returns the remote database snapshot and re-runs `loadDB()`, immediately overwriting React state and reverting local changes.
* **Symptom:** Imported or switched spreadsheets appear for a fraction of a second and then disappear/wipe back to an empty or stale state.

---

### Failure Mode 3: Date Filter Masking (`selectedMonth` Lockout)
* **Location:** `src/hooks/useCoinDB.ts` (`filteredRows` selector) & `src/app/(app)/(tabs)/index.tsx`
* **Mechanism:**
  - `CoinTable` in `index.tsx` renders `db.filteredRows`.
  - `filteredRows` filters rows by `selectedMonth` (`'all'` or `YYYY-MM`).
  - When a user imports a multi-year spreadsheet (e.g. 5-Year Stress Test `2021-2026` or historical 2024 dataset), `selectedMonth` state remains set to the current calendar month (e.g. `2026-07`).
* **Impact:** None of the imported transaction dates match `2026-07`, causing `filteredRows` to evaluate to `[]`.
* **Symptom:** The spreadsheet is correctly stored in state, but the screen renders an empty state (`Nenhuma entrada cadastrada`), making it appear as if loading failed.

---

### Failure Mode 4: Null Dereferencing on Partial Goal Objects
* **Location:** `src/hooks/useCoinDB.ts` (`updateGoals`), `src/core/computeMetrics.ts`, & UI widgets
* **Mechanism:**
  - Dynamic header goal parsing extracts `goal_daily_2021`, `goal_weekly_2021`, etc.
  - If a spreadsheet has missing or partial goal years (e.g. `yearlyGoals[2021]` has `dailyGoal` but `weeklyGoal` is `undefined`), computing progress metrics in `Header.tsx` or `GoalsAccordion.tsx` executes arithmetic on `undefined`.
* **Impact:** Uncaught `TypeError` in React render phase halts component rendering.
* **Symptom:** App UI freezes or crashes to a fallback screen when opening specific spreadsheets.

---

### Failure Mode 5: In-Place Overwrite vs. Active Table Creation
* **Location:** `src/components/CSVImporter.tsx` & `src/app/(app)/(tabs)/index.tsx`
* **Mechanism:**
  - Importing a CSV spreadsheet containing `name,Motorista` calls `updateActiveTableRows(rows)` and `updateActiveTableName('Motorista')`.
  - This mutates the *currently active* table in-place rather than creating a distinct new table and setting `activeTableIndex` to the new table.
* **Impact:** If the active table was null or an existing spreadsheet was open, the active spreadsheet's previous data is overwritten or lost.

---

## 4. Proposed Fix & Action Plan

To resolve all identified failure modes without breaking backward compatibility, we propose the following sequential fixes:

### Step 1: Align Table Indexing in `TableSwitcherModal.tsx` & `useCoinDB.ts`
- Pass `tables={db.activeTables}` to `TableSwitcherModal` (filtering out deleted tables) OR map table IDs explicitly (`onSelectTableId(id)`) instead of raw array indices.

### Step 2: Protect Local State from Asynchronous Cloud Reversion
- Update `persist` in `useCoinDB.ts` so background `fullSync` merges remote data without blindly overwriting pending local state.

### Step 3: Auto-Reset `selectedMonth` to `'all'` on Spreadsheet Switch / Import
- When a user opens or imports a spreadsheet, automatically update `setSelectedMonth('all')` so all imported rows display immediately.

### Step 4: Add Defensive Defaults to `TableGoals` Metric Calculations
- Ensure `yearlyGoals[year]` always defaults `dailyGoal`, `weeklyGoal`, and `annualCost` to `0` if undefined.

### Step 5: Support Explicit New Spreadsheet Creation on Named CSV Import
- Add option in import handler to choose between overwriting the active table or creating a new named spreadsheet.

---

## 5. Verification Plan

Upon approval of this diagnostic report:
1. Execute the proposed fixes across `useCoinDB.ts`, `TableSwitcherModal.tsx`, `CSVImporter.tsx`, and `index.tsx`.
2. Run `npx tsc --noEmit` to confirm zero TypeScript compilation errors.
3. Run unit test suite (`npm test`) covering all import and table switching scenarios.
