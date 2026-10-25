// ──────────────────────────────────────────────────────────────────────────────
// scripts/generate-og-assets.mjs
// Gera cartões Open Graph 1200x630 (public/og/*.png) e ícones 128x128 (public/icons/*.png)
// para todas as páginas, jogos, ferramentas do laboratório e aulas do repositório.
// ──────────────────────────────────────────────────────────────────────────────
import fs from 'fs'
import path from 'path'
import { loadAllRoutesMeta } from './seo-routes-loader.mjs'

const rootDir = process.cwd()
const publicDir = path.join(rootDir, 'public')
const ogDir = path.join(publicDir, 'og')
const iconsDir = path.join(publicDir, 'icons')
const forceRegen = process.argv.includes('--force')

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildCardHtml(meta, logoDataUri) {
  const headline = meta.title.split('|')[0].split('·')[0].trim()
  const displayUrl = meta.path === '/' ? 'heisslab.com.br' : `heisslab.com.br${meta.canonicalPath ?? meta.path}`
  const bulletsHtml = (meta.highlights || [])
    .slice(0, 3)
    .map(
      (item) => `
      <div class="bullet">
        <span class="bullet-dot" style="background:${meta.accentColor};box-shadow:0 0 10px ${meta.accentColor}"></span>
        <span>${escapeHtml(item)}</span>
      </div>`
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1200px;
    height: 630px;
    overflow: hidden;
    background: #060813;
    font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
    color: #f8fafc;
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 46px 56px;
  }
  .bg-grid {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(to right, rgba(255,255,255,0.035) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(255,255,255,0.035) 1px, transparent 1px);
    background-size: 40px 40px;
    z-index: 0;
  }
  .glow-1 {
    position: absolute;
    width: 560px;
    height: 560px;
    border-radius: 50%;
    background: radial-gradient(circle, ${meta.accentColor}38 0%, transparent 70%);
    top: -160px;
    right: -100px;
    z-index: 0;
  }
  .glow-2 {
    position: absolute;
    width: 520px;
    height: 520px;
    border-radius: 50%;
    background: radial-gradient(circle, ${meta.secondaryColor}30 0%, transparent 70%);
    bottom: -180px;
    left: -100px;
    z-index: 0;
  }
  .frame {
    position: absolute;
    inset: 18px;
    border-radius: 26px;
    border: 1.5px solid ${meta.accentColor}55;
    box-shadow: inset 0 0 40px rgba(0,0,0,0.6);
    pointer-events: none;
    z-index: 1;
  }
  .top-bar {
    position: relative;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 8px 18px;
    border-radius: 999px;
    background: rgba(15, 23, 42, 0.85);
    border: 1.5px solid ${meta.accentColor}88;
    color: ${meta.accentColor};
    font-size: 15px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 12px;
    background: rgba(15, 23, 42, 0.78);
    border: 1px solid rgba(255,255,255,0.12);
    padding: 8px 18px;
    border-radius: 999px;
  }
  .brand img {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    object-fit: contain;
  }
  .brand-text {
    font-size: 16px;
    font-weight: 700;
    color: #e2e8f0;
    letter-spacing: 0.02em;
  }
  .main {
    position: relative;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 40px;
    margin: auto 0;
  }
  .content-col {
    flex: 1;
    max-width: 830px;
  }
  .headline {
    font-size: ${headline.length > 44 ? '44px' : headline.length > 32 ? '50px' : '56px'};
    font-weight: 900;
    line-height: 1.1;
    letter-spacing: -0.02em;
    color: #ffffff;
    margin-bottom: 14px;
    text-shadow: 0 4px 24px rgba(0,0,0,0.5);
  }
  .subtitle {
    font-size: 22px;
    font-weight: 600;
    line-height: 1.35;
    color: #cbd5e1;
    margin-bottom: 24px;
  }
  .bullets {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .bullet {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 18px;
    font-weight: 500;
    color: #94a3b8;
  }
  .bullet-dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .icon-orb {
    width: 210px;
    height: 210px;
    border-radius: 44px;
    background: linear-gradient(135deg, rgba(15,23,42,0.92), rgba(30,41,59,0.75));
    border: 2px solid ${meta.accentColor}99;
    box-shadow: 0 20px 55px ${meta.accentColor}33, inset 0 0 30px ${meta.secondaryColor}33;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 104px;
    flex-shrink: 0;
  }
  .footer {
    position: relative;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 18px;
    border-top: 1px solid rgba(255,255,255,0.09);
  }
  .url-pill {
    font-family: Consolas, 'Courier New', monospace;
    font-size: 18px;
    font-weight: 700;
    color: ${meta.accentColor};
    background: rgba(15, 23, 42, 0.9);
    border: 1px solid ${meta.accentColor}55;
    padding: 7px 16px;
    border-radius: 10px;
  }
  .author {
    font-size: 16px;
    font-weight: 600;
    color: #94a3b8;
  }
</style>
</head>
<body>
  <div class="bg-grid"></div>
  <div class="glow-1"></div>
  <div class="glow-2"></div>
  <div class="frame"></div>

  <div class="top-bar">
    <div class="badge">
      <span>${meta.emoji}</span>
      <span>${escapeHtml(meta.badge)}</span>
    </div>
    <div class="brand">
      ${logoDataUri ? `<img src="${logoDataUri}" alt="Logo" />` : ''}
      <span class="brand-text">HEISS-LAB · MATEMÁTICA SOBERANA &amp; IA</span>
    </div>
  </div>

  <div class="main">
    <div class="content-col">
      <h1 class="headline">${escapeHtml(headline)}</h1>
      <p class="subtitle">${escapeHtml(meta.cardSubtitle)}</p>
      <div class="bullets">
        ${bulletsHtml}
      </div>
    </div>
    <div class="icon-orb">
      <span>${meta.emoji}</span>
    </div>
  </div>

  <div class="footer">
    <div class="url-pill">🔗 ${escapeHtml(displayUrl)}</div>
    <div class="author">Prof. Augusto Heiss · Acesso 100% Gratuito no Navegador</div>
  </div>
</body>
</html>`
}

function buildIconHtml(meta) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 128px;
    height: 128px;
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif;
  }
  .tile {
    width: 120px;
    height: 120px;
    border-radius: 28px;
    background: linear-gradient(135deg, #090d1a 0%, #151c33 100%);
    border: 4px solid ${meta.accentColor};
    box-shadow: inset 0 0 22px ${meta.secondaryColor}66;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 68px;
  }
</style>
</head>
<body>
  <div class="tile">${meta.emoji}</div>
</body>
</html>`
}

async function main() {
  fs.mkdirSync(ogDir, { recursive: true })
  fs.mkdirSync(iconsDir, { recursive: true })

  const { allRoutes } = loadAllRoutesMeta(rootDir)

  // Determina quais imagens e ícones ainda não existem (ou --force)
  const missingCards = []
  const seenOgPaths = new Set()
  for (const meta of allRoutes) {
    if (seenOgPaths.has(meta.ogImagePath)) continue
    seenOgPaths.add(meta.ogImagePath)
    const targetFile = path.join(publicDir, meta.ogImagePath.replace(/^\//, ''))
    if (forceRegen || !fs.existsSync(targetFile) || fs.statSync(targetFile).size < 1000) {
      missingCards.push({ meta, targetFile })
    }
  }

  const missingIcons = []
  const seenIconPaths = new Set()
  for (const meta of allRoutes) {
    if (meta.iconPath === '/favicon.png') continue
    if (seenIconPaths.has(meta.iconPath)) continue
    seenIconPaths.add(meta.iconPath)
    const targetFile = path.join(publicDir, meta.iconPath.replace(/^\//, ''))
    if (forceRegen || !fs.existsSync(targetFile) || fs.statSync(targetFile).size < 200) {
      missingIcons.push({ meta, targetFile })
    }
  }

  if (missingCards.length === 0 && missingIcons.length === 0) {
    console.log(
      `✅ [OG Assets] Todos os ${seenOgPaths.size} cards Open Graph (1200x630) e ${seenIconPaths.size} ícones já estão prontos em public/og e public/icons.`
    )
    return
  }

  console.log(
    `🎨 [OG Assets] Gerando ${missingCards.length} cards Open Graph (1200x630) e ${missingIcons.length} ícones personalizados...`
  )

  let logoDataUri = ''
  const logoPath = path.join(publicDir, 'logo-heisslab.png')
  if (fs.existsSync(logoPath)) {
    const b64 = fs.readFileSync(logoPath).toString('base64')
    logoDataUri = `data:image/png;base64,${b64}`
  }

  try {
    const { chromium } = await import('playwright')
    const browser = await chromium.launch({ headless: true })

    if (missingCards.length > 0) {
      const cardPage = await browser.newPage({
        viewport: { width: 1200, height: 630 },
        deviceScaleFactor: 1,
      })
      for (const { meta, targetFile } of missingCards) {
        fs.mkdirSync(path.dirname(targetFile), { recursive: true })
        await cardPage.setContent(buildCardHtml(meta, logoDataUri), { waitUntil: 'load' })
        await cardPage.screenshot({ path: targetFile, type: 'png' })
      }
      await cardPage.close()
    }

    if (missingIcons.length > 0) {
      const iconPage = await browser.newPage({
        viewport: { width: 128, height: 128 },
        deviceScaleFactor: 1,
      })
      for (const { meta, targetFile } of missingIcons) {
        fs.mkdirSync(path.dirname(targetFile), { recursive: true })
        await iconPage.setContent(buildIconHtml(meta), { waitUntil: 'load' })
        await iconPage.screenshot({ path: targetFile, type: 'png', omitBackground: true })
      }
      await iconPage.close()
    }

    await browser.close()
    console.log(
      `✅ [OG Assets] Gerados com sucesso: ${missingCards.length} cards (1200x630) em public/og/ e ${missingIcons.length} ícones (128x128) em public/icons/!`
    )
  } catch (err) {
    console.warn('⚠️ [OG Assets] Playwright indisponível no ambiente atual; aplicando fallback seguro a partir de logo-heisslab.png:', err.message)
    const fallbackLogo = path.join(publicDir, 'logo-heisslab.png')
    const fallbackIcon = path.join(publicDir, 'favicon.png')
    for (const { targetFile } of missingCards) {
      fs.mkdirSync(path.dirname(targetFile), { recursive: true })
      if (fs.existsSync(fallbackLogo)) fs.copyFileSync(fallbackLogo, targetFile)
    }
    for (const { targetFile } of missingIcons) {
      fs.mkdirSync(path.dirname(targetFile), { recursive: true })
      if (fs.existsSync(fallbackIcon)) fs.copyFileSync(fallbackIcon, targetFile)
    }
  }
}

main()
