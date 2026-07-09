const { chromium } = require('playwright');

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:8081/welcome');
  await page.waitForTimeout(2000);
  
  // Enter guest mode to trigger storage writes if any
  const pularBtn = page.locator('text=Pular');
  if (await pularBtn.count() > 0) await pularBtn.first().click();
  await page.waitForTimeout(1000);
  
  const continuarnocuentaBtn = page.locator('text=Continuar sem conta');
  if (await continuarnocuentaBtn.count() > 0) await continuarnocuentaBtn.first().click();
  await page.waitForTimeout(1000);

  const keys = await page.evaluate(() => {
    return Object.keys(localStorage);
  });
  console.log('LocalStorage Keys:', keys);
  
  const sessionStorageKeys = await page.evaluate(() => {
    return Object.keys(sessionStorage);
  });
  console.log('SessionStorage Keys:', sessionStorageKeys);

  await browser.close();
}

run();
