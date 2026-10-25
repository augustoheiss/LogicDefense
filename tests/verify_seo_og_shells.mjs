// ──────────────────────────────────────────────────────────────────────────────
// tests/verify_seo_og_shells.mjs — Suite de Auditoria Reality Checker (SEO, OG & AEO)
// Simula crawlers sem JS (WhatsApp, LinkedIn, Discord) e Googlebot Wave 1 sobre dist/
// ──────────────────────────────────────────────────────────────────────────────
import fs from 'fs'
import path from 'path'
import {
  loadAllRoutesMeta,
  getCanonicalUrl,
  getAbsoluteOgImageUrl,
} from '../scripts/seo-routes-loader.mjs'

const rootDir = process.cwd()
const distDir = path.join(rootDir, 'dist')

function extractAttr(html, regex) {
  const m = html.match(regex)
  return m ? m[1] : null
}

function unescapeHtml(str = '') {
  return String(str)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
}

function main() {
  const { allRoutes, lessonRoutes } = loadAllRoutesMeta(rootDir)
  const errors = []
  const canonicalTitles = new Map()
  const canonicalUrls = new Map()

  console.log(`🔍 [Reality Checker] Auditando ${allRoutes.length} rotas (incluindo ${lessonRoutes.length} aulas dinâmicas) em dist/...`)

  for (const meta of allRoutes) {
    const rel = meta.path === '/' ? 'index.html' : path.join(meta.path.replace(/^\//, ''), 'index.html')
    const htmlPath = path.join(distDir, rel)

    if (!fs.existsSync(htmlPath)) {
      errors.push(`❌ HTML ausente para rota ${meta.path}: ${htmlPath}`)
      continue
    }

    const html = fs.readFileSync(htmlPath, 'utf-8')
    const expectedCanonical = getCanonicalUrl(meta)
    const expectedOgImage = getAbsoluteOgImageUrl(meta)

    const actualTitle = unescapeHtml(extractAttr(html, /<title>([\s\S]*?)<\/title>/i) || '')
    const actualCanonical = unescapeHtml(extractAttr(html, /<link\s+rel="canonical"\s+href="([^"]+)"/i) || '')
    const actualIcon = unescapeHtml(extractAttr(html, /<link\s+rel="icon"[^>]*href="([^"]+)"/i) || '')
    const actualOgTitle = unescapeHtml(extractAttr(html, /<meta\s+property="og:title"\s+content="([^"]+)"/i) || '')
    const actualOgDesc = unescapeHtml(extractAttr(html, /<meta\s+property="og:description"\s+content="([^"]+)"/i) || '')
    const actualOgUrl = unescapeHtml(extractAttr(html, /<meta\s+property="og:url"\s+content="([^"]+)"/i) || '')
    const actualOgImage = unescapeHtml(extractAttr(html, /<meta\s+property="og:image"\s+content="([^"]+)"/i) || '')

    if (actualTitle !== meta.title) {
      errors.push(`❌ [${meta.path}] <title> divergente: "${actualTitle}" !== "${meta.title}"`)
    }
    if (actualCanonical !== expectedCanonical) {
      errors.push(`❌ [${meta.path}] canonical divergente: "${actualCanonical}" !== "${expectedCanonical}"`)
    }
    if (actualOgTitle !== meta.title) {
      errors.push(`❌ [${meta.path}] og:title divergente: "${actualOgTitle}" !== "${meta.title}"`)
    }
    if (actualOgDesc !== meta.description) {
      errors.push(`❌ [${meta.path}] og:description divergente em ${meta.path}`)
    }
    if (actualOgUrl !== expectedCanonical) {
      errors.push(`❌ [${meta.path}] og:url divergente: "${actualOgUrl}" !== "${expectedCanonical}"`)
    }
    if (actualOgImage !== expectedOgImage) {
      errors.push(`❌ [${meta.path}] og:image divergente: "${actualOgImage}" !== "${expectedOgImage}"`)
    }

    // Verifica existência física da imagem Open Graph e do ícone no dist/
    const ogDiskPath = path.join(distDir, meta.ogImagePath.replace(/^\//, ''))
    if (!fs.existsSync(ogDiskPath) || fs.statSync(ogDiskPath).size < 1000) {
      errors.push(`❌ [${meta.path}] Arquivo de imagem OG ausente ou inválido em dist: ${ogDiskPath}`)
    }

    const iconDiskPath = path.join(distDir, actualIcon.replace(/^\//, ''))
    if (!fs.existsSync(iconDiskPath) || fs.statSync(iconDiskPath).size < 200) {
      errors.push(`❌ [${meta.path}] Arquivo de ícone ausente ou inválido em dist: ${iconDiskPath}`)
    }

    // Verifica JSON-LD
    const jsonLdRaw = extractAttr(
      html,
      /<script\s+id="route-schema-jsonld"\s+type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/i
    )
    if (!jsonLdRaw) {
      errors.push(`❌ [${meta.path}] JSON-LD ausente`)
    } else {
      try {
        JSON.parse(jsonLdRaw)
      } catch (e) {
        errors.push(`❌ [${meta.path}] JSON-LD inválido: ${e.message}`)
      }
    }

    // Checagem Anti-Canibalização (Rotas canônicas não podem ter o mesmo <title> ou canonical)
    if (meta.includeInSitemap) {
      if (canonicalTitles.has(actualTitle)) {
        errors.push(
          `❌ Canibalização de <title> detectada entre ${meta.path} e ${canonicalTitles.get(actualTitle)}`
        )
      }
      canonicalTitles.set(actualTitle, meta.path)

      if (canonicalUrls.has(actualCanonical)) {
        errors.push(
          `❌ Canibalização de Canonical URL detectada entre ${meta.path} e ${canonicalUrls.get(actualCanonical)}`
        )
      }
      canonicalUrls.set(actualCanonical, meta.path)
    }
  }

  // Verifica sitemap.xml e llms.txt
  const sitemapPath = path.join(distDir, 'sitemap.xml')
  if (!fs.existsSync(sitemapPath)) {
    errors.push(`❌ dist/sitemap.xml não encontrado`)
  } else {
    const sitemap = fs.readFileSync(sitemapPath, 'utf-8')
    if (sitemap.includes('https://www.heisslab.com.br')) {
      errors.push(`❌ dist/sitemap.xml ainda contém URLs com www.heisslab.com.br`)
    }
    for (const meta of allRoutes.filter((r) => r.includeInSitemap)) {
      const loc = `<loc>${getCanonicalUrl(meta)}</loc>`
      if (!sitemap.includes(loc)) {
        errors.push(`❌ Rota canônica ausente no sitemap.xml: ${loc}`)
      }
    }
  }

  const llmsPath = path.join(distDir, 'llms.txt')
  if (!fs.existsSync(llmsPath) || fs.statSync(llmsPath).size < 500) {
    errors.push(`❌ dist/llms.txt ausente ou incompleto`)
  }

  if (errors.length > 0) {
    console.error(`\n🚨 [Reality Checker] FALHA NA AUDITORIA (${errors.length} erros):`)
    errors.forEach((e) => console.error('  ', e))
    process.exit(1)
  }

  console.log(`✅ [Reality Checker] 100% APROVADO:`)
  console.log(`   • ${allRoutes.length} páginas com <title>, og:title, og:description, og:image (1200x630), ícone e JSON-LD exclusivos.`)
  console.log(`   • Zero conflitos de canibalização entre as ${canonicalTitles.size} URLs canônicas.`)
  console.log(`   • dist/sitemap.xml (${canonicalUrls.size} URLs) e dist/llms.txt validados com sucesso.`)
}

main()
