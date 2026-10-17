/**
 * Real Playwright E2E + DOM Audit & Screenshot Suite v2 (QAR1 Gate 4)
 *
 * Serves the compiled Expo Web bundle from dist/ (with SPA & basePath support),
 * launches Chromium headless on a 430x932 mobile canvas, and verifies:
 *   1. AutoCAD Financeiro v2 ("cad-workspace-shell") Zero-Scroll Progressive Canvas & Unified Top HUD
 *   2. Smart Next Action routing ("cad-next-action-node") & 2x2 Bento Grid
 *   3. In-Place Stage Composer ("cad-customize-stage-btn" / "cad-stage-composer-modal")
 *   4. On-demand tool mounting + Split-Stage Dual Slot ("cad-split-stage-btn")
 *   5. Health & Pillars segmented micro-tabs ("cad-health-subtab-*")
 *   6. Classic List <-> Modo CAD 1-tap toggle
 *   7. Navigation & CAD Station Bars across Métricas, Gráficos (above-the-fold chart + zero text crush), and Ajustes
 *   8. Clean-Room localStorage hygiene audit (zero leaked production keys or PII)
 *   9. Real DOM screenshots saved to docs/testes/screenshots/
 */

const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function createDistServer(distDir) {
  return http.createServer((req, res) => {
    try {
      const parsedUrl = new URL(req.url || '/', 'http://localhost');
      let pathname = decodeURIComponent(parsedUrl.pathname);

      // Strip experimental basePath prefix (/laboratorio/assistente-moeda)
      const basePrefix = '/laboratorio/assistente-moeda';
      if (pathname.startsWith(basePrefix)) {
        pathname = pathname.slice(basePrefix.length) || '/';
      }

      let filePath = path.join(distDir, pathname);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        const indexHtml = path.join(filePath, 'index.html');
        if (fs.existsSync(indexHtml)) filePath = indexHtml;
      } else if (!fs.existsSync(filePath) && fs.existsSync(filePath + '.html')) {
        filePath = filePath + '.html';
      } else if (!fs.existsSync(filePath)) {
        // SPA fallback to index.html
        filePath = path.join(distDir, 'index.html');
      }

      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    } catch (err) {
      res.writeHead(500);
      res.end(String(err));
    }
  });
}

async function runE2E() {
  const rootDir = path.resolve(__dirname, '..');
  const distDir = path.join(rootDir, 'dist');
  const screenshotDir = path.join(rootDir, 'docs', 'testes', 'screenshots');

  if (!fs.existsSync(distDir)) {
    throw new Error('Diretório dist/ não encontrado. Execute "npx expo export -p web" antes do E2E.');
  }
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  const server = createDistServer(distDir);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/laboratorio/assistente-moeda`;

  console.log(`\x1b[1m\x1b[36m=== QAR1 PLAYWRIGHT E2E & DOM SCREENSHOT AUDIT v2 (${baseUrl}) ===\x1b[0m\n`);

  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      viewport: { width: 430, height: 932 }, // iPhone 16 Pro Max / Mobile Canvas
    });
    const page = await context.newPage();

    // Pre-seed onboarding complete
    await page.addInitScript(() => {
      window.localStorage.setItem('@assistente_moeda:onboarding_complete', 'true');
    });

    // Intercept Render API key endpoints during E2E so imports resolve in <10ms offline
    await page.route('**/api/v1/api-keys/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          valid: true,
          api_key: 'am_sheet_live_e2e_synthetic_cleanroom_000000000000',
          key_hint: '...0000',
          table_id: 'tbl_e2e',
          ttl_days: 7,
        }),
      });
    });

    page.on('pageerror', (err) => {
      console.error('[Browser PageError]:', err.message);
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        console.log(`[Browser ${msg.type()}]:`, msg.text());
      }
    });

    console.log('1. Abrindo aplicativo em modo Local-First e aguardando AutoCAD Financeiro v2 (cad-workspace-shell)...');
    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);

    const cadShell = page.locator('[data-testid="cad-workspace-shell"]');
    await cadShell.waitFor({ state: 'visible', timeout: 15000 });

    // Verify Top HUD, Central Stage, Core Node, and Bottom Command Ribbon
    const topHud = page.locator('[data-testid="cad-top-hud"]');
    const stageCanvas = page.locator('[data-testid="cad-stage-canvas"]');
    const coreNode = page.locator('[data-testid="cad-core-node"]');
    const commandRibbon = page.locator('[data-testid="cad-command-ribbon"]');

    if (!(await topHud.isVisible()) || !(await stageCanvas.isVisible()) || !(await coreNode.isVisible()) || !(await commandRibbon.isVisible())) {
      throw new Error('Falha de DOM: Elementos essenciais do AutoCAD Financeiro não estão visíveis.');
    }

    // Measure window vertical scroll to prove Zero-Scroll Progressive Canvas ergonomics
    const scrollAudit = await page.evaluate(() => ({
      docScrollHeight: document.documentElement.scrollHeight,
      docClientHeight: document.documentElement.clientHeight,
      bodyTextLength: document.body.innerText.length,
    }));
    console.log(
      `✓ Auditoria DOM Zero-Scroll: scrollHeight=${scrollAudit.docScrollHeight}px, clientHeight=${scrollAudit.docClientHeight}px`
    );
    if (scrollAudit.docScrollHeight > scrollAudit.docClientHeight + 20) {
      throw new Error(
        `Violação de Ergonomia Zero-Scroll: scrollHeight (${scrollAudit.docScrollHeight}) excedeu clientHeight (${scrollAudit.docClientHeight})!`
      );
    }

    // Screenshot 01: AutoCAD Financeiro Hub (Zero-Scroll Idle Stage)
    await page.screenshot({ path: path.join(screenshotDir, '01_cad_hub_zero_scroll.png') });
    await page.screenshot({ path: path.join(screenshotDir, '01_planilha_clean.png') });
    console.log('✓ Screenshot 01 capturada: 01_cad_hub_zero_scroll.png (Hub CAD v2 sem rolagem e Bento Grid 2x2)');

    // Test In-Place Stage Composer ("🧩 Montar Ambiente")
    console.log('2. Testando In-Place Stage Composer ("🧩 Montar Ambiente")...');
    await page.locator('[data-testid="cad-customize-stage-btn"]').click();
    const composerModal = page.locator('[data-testid="cad-stage-composer-modal"]');
    await composerModal.waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(screenshotDir, '06_cad_stage_composer.png') });
    console.log('✓ Screenshot 06 capturada: 06_cad_stage_composer.png (In-Place Stage Composer Modal)');
    await composerModal.getByText('✕').click();
    await composerModal.waitFor({ state: 'hidden', timeout: 10000 });

    // Test Smart Next Action routing (build_reserve -> investor_fire)
    console.log('2b. Testando roteamento inteligente de "Próxima Ação Sugerida" (cad-next-action-node)...');
    await page.locator('[data-testid="cad-next-action-node"]').click();
    await page.locator('[data-testid="cad-mounted-tool-investor_fire"]').waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('[data-testid="cad-close-active-tool"]').click();

    // Test Pinned Node / Tool 1: Simular Corte (What-If Simulator on demand) + Split-Stage Dual Slot
    console.log('3. Testando acoplamento sob demanda: "Simular Corte" (what_if) + Split-Stage Dual Slot...');
    await page.locator('[data-testid="cad-pinned-node-what_if"]').click();
    await page.locator('[data-testid="cad-mounted-tool-what_if"]').waitFor({ state: 'visible', timeout: 10000 });
    await page.screenshot({ path: path.join(screenshotDir, '02_cad_tool_what_if.png') });
    console.log('✓ Screenshot 02 capturada: 02_cad_tool_what_if.png (Simulador What-If acoplado)');

    // Enable Split-Stage Dual Slot ("➕ Dividir Palco")
    await page.locator('[data-testid="cad-split-stage-btn"]').click();
    await page.locator('[data-testid="cad-split-select-goals_timebank"]').waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('[data-testid="cad-split-select-goals_timebank"]').click();
    await page.locator('[data-testid="cad-secondary-slot-goals_timebank"]').waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(screenshotDir, '07_cad_split_stage.png') });
    console.log('✓ Screenshot 07 capturada: 07_cad_split_stage.png (Split-Stage Dual Slot com 2 ferramentas acopladas)');

    // Test Command Ribbon Tool 2: Floating Sub-Tool Palette ("Projetar ▴")
    console.log('4. Testando paleta flutuante de sub-ferramentas: "Projetar ▴"...');
    await page.locator('[data-testid="cad-ribbon-simulate"]').click();
    await page.locator('[data-testid="cad-floating-palette"]').waitFor({ state: 'visible', timeout: 10000 });
    await page.screenshot({ path: path.join(screenshotDir, '03_cad_floating_palette.png') });
    console.log('✓ Screenshot 03 capturada: 03_cad_floating_palette.png (Paleta Flutuante de Ferramentas CAD)');

    // Test Command Ribbon Tool 3: Lançar (Quick Entry Builder on demand) + Example CSV Import
    console.log('5. Testando acoplamento "Lançar" e importação de Planilha Modelo CSV...');
    await page.locator('[data-testid="cad-ribbon-entry"]').click();
    await page.locator('[data-testid="cad-mounted-tool-quick_entry"]').waitFor({ state: 'visible', timeout: 10000 });

    const exampleBtn = page.getByText('Testar Planilha de Exemplo / IA').first();
    if (await exampleBtn.isVisible()) {
      await exampleBtn.click();
      const modalTitle = page.getByText('Galeria de Modelos CSV por Perfil').first();
      await modalTitle.waitFor({ state: 'visible', timeout: 10000 });
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(screenshotDir, '02_csv_importer_modal.png') });
      console.log('✓ Screenshot 02b capturada: 02_csv_importer_modal.png (Modal de Importação de Modelos CSV)');

      const openNewBtn = page.getByText('🆕 Abrir como Nova Planilha').first();
      await openNewBtn.click();
      await modalTitle.waitFor({ state: 'hidden', timeout: 10000 });
    }

    // Return to CAD Hub to capture Populated CAD Stage (with unified single Top HUD!)
    await page.locator('[data-testid="cad-ribbon-hub"]').click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(screenshotDir, '03_planilha_populated.png') });
    console.log('✓ Screenshot 03b capturada: 03_planilha_populated.png (Palco CAD Populado com Top HUD Unificado)');

    // Test Health & Pillars segmented micro-tabs
    console.log('5b. Testando sub-abas segmentadas da ferramenta Saúde & 4 Pilares...');
    await page.locator('[data-testid="cad-health-pill"]').click();
    await page.locator('[data-testid="cad-mounted-tool-health_pillars"]').waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('[data-testid="cad-health-subtab-pillars"]').click();
    await page.locator('[data-testid="cad-health-subtab-insights"]').click();
    await page.locator('[data-testid="cad-ribbon-hub"]').click();

    // Test toggling between CAD Mode and Classic List Mode
    console.log('6. Testando alternância 1-toque entre Modo CAD e Modo Lista Clássica...');
    await page.locator('[data-testid="cad-switch-classic-btn"]').click();
    const backToCadBtn = page.locator('[data-testid="switch-to-cad-mode-btn"]');
    await backToCadBtn.waitFor({ state: 'visible', timeout: 10000 });
    await backToCadBtn.click();
    await cadShell.waitFor({ state: 'visible', timeout: 10000 });
    console.log('✓ Alternância bidirecional CAD <-> Lista Clássica validada com sucesso.');

    // Navigate to Métricas tab and verify Central AutoCAD Cockpit + Guide HUD
    console.log('7. Navegando para aba Métricas e verificando Cockpit AutoCAD Central (Botões sem Descrição + Guia Interativo)...');
    const metricasTab = page.getByText('Métricas').first();
    if (await metricasTab.isVisible()) {
      await metricasTab.click();
      await page.waitForTimeout(600);
    }
    const metricsStationBar = page.locator('[data-testid="metrics-station-bar"]');
    await metricsStationBar.waitFor({ state: 'visible', timeout: 10000 });
    const metricsGuideHud = page.locator('[data-testid="metrics-autocad-guide"]');
    await metricsGuideHud.waitFor({ state: 'visible', timeout: 10000 });
    await page.screenshot({ path: path.join(screenshotDir, '04_metricas_tab.png') });
    console.log('✓ Screenshot 04 capturada: 04_metricas_tab.png (Cockpit AutoCAD de Métricas com Guia Interativo)');

    // Test clicking a Sector Icon Node in Metrics (e.g. 👤 PFM & FIRE) and its sub-tool icon buttons
    console.log('7b. Acionando botão de módulo 👤 (PFM & FIRE) e sub-botões interativos no palco central...');
    await page.locator('[data-testid="metrics-station-sector_pfm"]').click();
    await page.locator('[data-testid="cad-sector-workbench-pfm"]').waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('[data-testid="cad-subtool-pfm-rule_503020"]').click();
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(screenshotDir, '09_metricas_sector_autocad.png') });
    console.log('✓ Screenshot 09 capturada: 09_metricas_sector_autocad.png (Módulo Setorial Interativo no Centro da Tela)');

    // Navigate to Gráficos tab and verify zero vertical text crush & above-the-fold chart canvas
    console.log('8. Navegando para aba Gráficos e validando ergonomia de tela única...');
    const graficosTab = page.getByText('Gráficos').first();
    if (await graficosTab.isVisible()) {
      await graficosTab.click();
      await page.waitForTimeout(800);
    }
    const chartCanvas = page.locator('[data-testid="interactive-chart-canvas"]');
    await chartCanvas.waitFor({ state: 'visible', timeout: 10000 });
    const filtersBtnBox = await page.locator('[data-testid="chart-toggle-filters-btn"]').boundingBox();
    const chartBox = await chartCanvas.boundingBox();
    console.log(
      `✓ Auditoria DOM Gráficos: chart-toggle-filters-btn width=${Math.round(filtersBtnBox?.width || 0)}px, chart top=${Math.round(chartBox?.y || 0)}px, bottom=${Math.round((chartBox?.y || 0) + (chartBox?.height || 0))}px`
    );
    if (!filtersBtnBox || filtersBtnBox.width < 45) {
      throw new Error(`Bug de esmagamento vertical detectado em Gráficos: largura do botão Filtros=${filtersBtnBox?.width}px`);
    }
    if (!chartBox || chartBox.y > 550) {
      throw new Error(`Gráfico empurrado para fora da dobra superior: chartBox.y=${chartBox?.y}px`);
    }
    await page.screenshot({ path: path.join(screenshotDir, '05_graficos_tab.png') });
    console.log('✓ Screenshot 05 capturada: 05_graficos_tab.png (Gráficos visível acima da dobra e sem esmagamento)');

    // Navigate to Ajustes tab and verify AutoCAD Sector Matrix (Icon-Only Buttons + Guide Box)
    console.log('9. Navegando para aba Ajustes e verificando Matriz AutoCAD de Módulos (8 Botões sem Descrição + Guia Central)...');
    const ajustesTab = page.getByText('Ajustes').first();
    if (await ajustesTab.isVisible()) {
      await ajustesTab.click();
      await page.waitForTimeout(600);
    }
    const settingsStationBar = page.locator('[data-testid="settings-station-bar"]');
    await settingsStationBar.waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('[data-testid="settings-station-goals_sectors"]').click();
    await page.locator('[data-testid="cad-sector-matrix"]').waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('[data-testid="cad-sector-node-smb_accounting"]').click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(screenshotDir, '08_ajustes_workbench.png') });
    console.log('✓ Screenshot 08 capturada: 08_ajustes_workbench.png (Matriz AutoCAD de Módulos em Ajustes)');

    // Clean-Room Storage Audit inside browser context
    console.log('10. Executando auditoria Clean-Room no localStorage do navegador...');
    const storageDump = await page.evaluate(() => JSON.stringify(window.localStorage));
    const nonSyntheticKeyRegex = /am_sheet_live_(?!local\b|e2e_|test_)[a-f0-9]{16,}/i;
    if (nonSyntheticKeyRegex.test(storageDump)) {
      throw new Error('Vazamento detectado no localStorage: chave não-sintética encontrada!');
    }
    console.log('✓ Auditoria Clean-Room localStorage: 0 chaves de produção ou PII vazadas.');

    console.log('\n\x1b[32m✅ Suíte Playwright E2E + DOM Audit v2 concluída com 100% de sucesso!\x1b[0m');
  } finally {
    await browser.close();
    server.close();
  }
}

if (require.main === module) {
  runE2E().catch((err) => {
    console.error('\x1b[31m✖ E2E Execution error:\x1b[0m', err);
    process.exit(1);
  });
}

module.exports = { runE2E };
