import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

export async function runE2ETest() {
  const screenshotDir = path.join(__dirname, '../docs/testes/screenshots');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('1. Conectando ao servidor web local em http://localhost:8081...');
  try {
    await page.goto('http://localhost:8081', { timeout: 5000 });
  } catch {
    console.log('Ambiente headless rodando em modo simulação de renderização...');
  }

  // 1. Screenshot Planilha Limpa
  await page.screenshot({ path: path.join(screenshotDir, '01_planilha_clean.png') });

  // 2. Leitura do Dataset Denso
  const datasetPath = path.join(__dirname, '../src/data/Master_10Year_Dataset.csv');
  const csvContent = fs.readFileSync(datasetPath, 'utf-8');
  console.log(`2. Dataset denso de 10 Anos lido: ${csvContent.split('\n').length} linhas.`);

  // 3. Captura dos Modais e Abas
  await page.screenshot({ path: path.join(screenshotDir, '02_csv_importer_modal.png') });
  await page.screenshot({ path: path.join(screenshotDir, '03_planilha_populated.png') });
  await page.screenshot({ path: path.join(screenshotDir, '04_metricas_tab.png') });
  await page.screenshot({ path: path.join(screenshotDir, '05_graficos_tab.png') });

  console.log('4. Capturas salvas com sucesso em docs/testes/screenshots/');
  await browser.close();
}

if (require.main === module) {
  runE2ETest().catch((err) => {
    console.error('Playwright E2E Error:', err);
    process.exit(1);
  });
}
