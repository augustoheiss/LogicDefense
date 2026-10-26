// ──────────────────────────────────────────────────────────────────────────────
// scripts/generate-seo-shells.mjs
// Pós-processador SSG de Shells de Rota, Sub-Apps Expo, Sitemap.xml e llms.txt
// ──────────────────────────────────────────────────────────────────────────────
import fs from 'fs'
import path from 'path'
import {
  SITE_ORIGIN,
  SITE_NAME,
  loadAllRoutesMeta,
  getCanonicalUrl,
  getAbsoluteOgImageUrl,
  buildRouteJsonLd,
} from './seo-routes-loader.mjs'

const rootDir = process.cwd()
const distDir = path.join(rootDir, 'dist')
const publicDir = path.join(rootDir, 'public')

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildHeadTagsBlock(meta) {
  const canonicalUrl = getCanonicalUrl(meta)
  const ogImageUrl = getAbsoluteOgImageUrl(meta)
  const jsonLd = JSON.stringify(buildRouteJsonLd(meta), null, 2)

  return `<!-- __HEISSLAB_SEO_HEAD_START__ -->
  <link rel="icon" type="image/png" href="${escapeHtml(meta.iconPath)}" />
  <link rel="apple-touch-icon" href="${escapeHtml(meta.iconPath)}" />
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />

  <title>${escapeHtml(meta.title)}</title>
  <meta name="description" content="${escapeHtml(meta.description)}" />
  <meta name="keywords" content="${escapeHtml(meta.keywords)}" />
  <meta name="author" content="Augusto Heiss" />
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />

  <!-- Open Graph / Facebook / WhatsApp / LinkedIn / Discord / Telegram -->
  <meta property="og:type" content="${escapeHtml(meta.ogType)}" />
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
  <meta property="og:site_name" content="${escapeHtml(SITE_NAME)}" />
  <meta property="og:locale" content="pt_BR" />
  <meta property="og:title" content="${escapeHtml(meta.title)}" />
  <meta property="og:description" content="${escapeHtml(meta.description)}" />
  <meta property="og:image" content="${escapeHtml(ogImageUrl)}" />
  <meta property="og:image:secure_url" content="${escapeHtml(ogImageUrl)}" />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="${escapeHtml(meta.title)}" />

  <!-- Twitter / X -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(meta.title)}" />
  <meta name="twitter:description" content="${escapeHtml(meta.description)}" />
  <meta name="twitter:image" content="${escapeHtml(ogImageUrl)}" />

  <!-- Structured Data: Schema.org JSON-LD -->
  <script id="route-schema-jsonld" type="application/ld+json">
${jsonLd}
  </script>
  <!-- __HEISSLAB_SEO_HEAD_END__ -->`
}

function buildSemanticPrerenderHtml(meta, allRoutes) {
  const headline = meta.title.split('|')[0].trim()
  const highlightsList = (meta.highlights || [])
    .map((h) => `<li>${escapeHtml(h)}</li>`)
    .join('')

  // Links internos estratégicos para Googlebot Wave 1 e crawlers sem JS
  const navLinks = allRoutes
    .filter((r) => r.includeInSitemap && r.path !== meta.path)
    .map((r) => {
      const shortTitle = r.title.split('·')[0].split('|')[0].trim()
      return `<li><a href="${escapeHtml(r.path)}">${escapeHtml(shortTitle)}</a></li>`
    })
    .join('')

  return `<article data-seo-prerender="true" style="max-width:920px;margin:0 auto;padding:40px 20px;color:#f8fafc;font-family:system-ui,-apple-system,sans-serif">
    <header>
      <p style="color:${escapeHtml(meta.accentColor)};font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase">${escapeHtml(meta.badge)}</p>
      <h1 style="font-size:32px;font-weight:800;margin:8px 0 12px">${escapeHtml(headline)}</h1>
      <p style="font-size:18px;color:#cbd5e1;line-height:1.5;margin-bottom:16px">${escapeHtml(meta.description)}</p>
    </header>
    <section>
      <h2 style="font-size:18px;margin-bottom:8px">Destaques</h2>
      <ul style="line-height:1.7;color:#94a3b8">${highlightsList}</ul>
    </section>
    <nav aria-label="Navegação Direta do Portal Heiss-Lab" style="margin-top:28px;border-top:1px solid rgba(255,255,255,0.1);padding-top:16px">
      <h2 style="font-size:15px;margin-bottom:8px">Índice do Portal Heiss-Lab</h2>
      <ul style="display:flex;flex-wrap:wrap;gap:10px;list-style:none;padding:0;font-size:13px">${navLinks}</ul>
    </nav>
  </article>`
}

function injectIntoExpoHtml(htmlContent, meta) {
  let updated = htmlContent
  // Corrige lang="en" para lang="pt-BR"
  updated = updated.replace(/<html\s+lang="en"/i, '<html lang="pt-BR"')

  // Remove <title data-rh="true"></title> vazio e <link rel="icon" ...> antigo
  updated = updated.replace(/<title[^>]*>[\s\S]*?<\/title>/gi, '')
  updated = updated.replace(/<link\s+rel="icon"[^>]*>/gi, '')
  updated = updated.replace(
    /<!-- __HEISSLAB_SEO_HEAD_START__ -->[\s\S]*?<!-- __HEISSLAB_SEO_HEAD_END__ -->/g,
    ''
  )

  const headBlock = buildHeadTagsBlock(meta)
  updated = updated.replace(/<\/head>/i, `${headBlock}\n</head>`)
  return updated
}

function buildSitemapXml(allRoutes) {
  const today = new Date().toISOString().split('T')[0]
  const urls = allRoutes
    .filter((r) => r.includeInSitemap)
    .map((r) => {
      const loc = getCanonicalUrl(r)
      return `  <url>
    <loc>${escapeHtml(loc)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.sitemapPriority.toFixed(1)}</priority>
  </url>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`
}

function buildLlmsTxt(staticRoutes, lessonRoutes) {
  const games = staticRoutes.filter((r) => r.path.startsWith('/jogos/'))
  const tools = staticRoutes.filter(
    (r) => r.path.startsWith('/laboratorio/') && r.includeInSitemap
  )

  return `# Heiss-Lab · Matemática Soberana, Jogos Cognitivos & Ferramentas Local-First

> Portal educacional aberto e laboratório de Inteligência Artificial criado pelo Prof. Augusto Heiss (${SITE_ORIGIN}). Reúne 6 jogos matemáticos interativos no navegador, 5 ferramentas SaaS soberanas (Local-First) e 18 apostilas didáticas em LaTeX/PDF com 40 vídeos educativos.

## Páginas Principais (Hubs)
- [Página Inicial](${SITE_ORIGIN}/): Portal Heiss-Lab & Logic Defense — Matemática Soberana, Filosofia e IA.
- [Menu de Jogos Cognitivos](${SITE_ORIGIN}/jogos): Suíte de 6 jogos matemáticos gratuitos no navegador (Zero Game Over).
- [Laboratório de IA & Ferramentas](${SITE_ORIGIN}/laboratorio): Ferramentas SaaS Local-First e vídeos de pesquisa.
- [Repositório Didático Aberto](${SITE_ORIGIN}/repositorio): 18 apostilas em LaTeX/PDF e 40 vídeos organizados em 9 trilhas temáticas.
- [Sobre o Heiss-Lab](${SITE_ORIGIN}/sobre): Manifesto pedagógico e arquitetural do Prof. Augusto Heiss.

## Ferramentas SaaS do Laboratório
${tools.map((t) => `- [${t.title.split('|')[0].trim()}](${SITE_ORIGIN}${t.path}): ${t.description}`).join('\n')}

## Jogos Educativos no Navegador
${games.map((g) => `- [${g.title.split('|')[0].trim()}](${SITE_ORIGIN}${g.path}): ${g.description}`).join('\n')}

## Apostilas e Aulas do Repositório Didático (LaTeX & PDF)
${lessonRoutes.map((l) => `- [${l.title.split('|')[0].trim()}](${SITE_ORIGIN}${l.path}): ${l.description}`).join('\n')}
`
}

function main() {
  if (!fs.existsSync(distDir)) {
    throw new Error(`[SEO Shells] Diretório dist/ não encontrado em ${distDir}. Execute vite build antes.`)
  }

  const baseIndexPath = path.join(distDir, 'index.html')
  if (!fs.existsSync(baseIndexPath)) {
    throw new Error(`[SEO Shells] Arquivo base dist/index.html não encontrado.`)
  }

  const baseHtml = fs.readFileSync(baseIndexPath, 'utf-8')
  const headRegex = /<!-- __HEISSLAB_SEO_HEAD_START__ -->[\s\S]*?<!-- __HEISSLAB_SEO_HEAD_END__ -->/
  if (!headRegex.test(baseHtml)) {
    throw new Error(
      `[SEO Shells] Marcadores __HEISSLAB_SEO_HEAD_START__ / END não encontrados em dist/index.html.`
    )
  }

  const { staticRoutes, lessonRoutes, allRoutes } = loadAllRoutesMeta(rootDir)
  let generatedShells = 0
  let patchedExpoFiles = 0

  for (const meta of allRoutes) {
    // Caso 1: Sub-aplicativos Expo Web (/laboratorio/sekundo e /laboratorio/assistente-moeda)
    if (meta.path === '/laboratorio/sekundo' || meta.path === '/laboratorio/assistente-moeda') {
      const subAppRel = meta.path.replace(/^\//, '')
      for (const baseFolder of [distDir, publicDir]) {
        const subAppFolder = path.join(baseFolder, subAppRel)
        if (!fs.existsSync(subAppFolder)) continue
        const htmlFiles = fs
          .readdirSync(subAppFolder)
          .filter((f) => f.endsWith('.html'))
        for (const htmlFile of htmlFiles) {
          const fullPath = path.join(subAppFolder, htmlFile)
          const rawExpo = fs.readFileSync(fullPath, 'utf-8')
          const enriched = injectIntoExpoHtml(rawExpo, meta)
          fs.writeFileSync(fullPath, enriched, 'utf-8')
          patchedExpoFiles++
        }
      }
      // Também grava o arquivo irmão dist/laboratorio/sekundo.html para suporte a cleanUrls sem barra final
      const siblingHtmlPath = path.join(distDir, `${subAppRel}.html`)
      const subAppIndexPath = path.join(distDir, subAppRel, 'index.html')
      if (fs.existsSync(subAppIndexPath)) {
        fs.copyFileSync(subAppIndexPath, siblingHtmlPath)
      }
      continue
    }

    // Caso 2: Rotas SPA do Portal Principal (Vite + React Router)
    const headBlock = buildHeadTagsBlock(meta)
    const prerenderBody = buildSemanticPrerenderHtml(meta, allRoutes)

    const routeHtml = baseHtml
      .replace(headRegex, headBlock)
      .replace('<div id="root"></div>', `<div id="root">${prerenderBody}</div>`)

    if (meta.path === '/') {
      fs.writeFileSync(baseIndexPath, routeHtml, 'utf-8')
      generatedShells++
    } else {
      const cleanRel = meta.path.replace(/^\//, '')
      const routeDir = path.join(distDir, cleanRel)
      fs.mkdirSync(routeDir, { recursive: true })
      fs.writeFileSync(path.join(routeDir, 'index.html'), routeHtml, 'utf-8')
      // Também cria dist/<rota>.html para compatibilidade total com cleanUrls: true
      fs.writeFileSync(path.join(distDir, `${cleanRel}.html`), routeHtml, 'utf-8')
      generatedShells++
    }
  }

  // 3. Gera sitemap.xml unificado (public/ e dist/)
  const sitemapXml = buildSitemapXml(allRoutes)
  fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), sitemapXml, 'utf-8')
  fs.writeFileSync(path.join(distDir, 'sitemap.xml'), sitemapXml, 'utf-8')

  // 4. Gera llms.txt para motores de IA (public/ e dist/)
  const llmsTxt = buildLlmsTxt(staticRoutes, lessonRoutes)
  fs.writeFileSync(path.join(publicDir, 'llms.txt'), llmsTxt, 'utf-8')
  fs.writeFileSync(path.join(distDir, 'llms.txt'), llmsTxt, 'utf-8')

  console.log(
    `✅ [SEO Shells] ${generatedShells} rotas pré-renderizadas em dist/, ${patchedExpoFiles} arquivos Expo enriquecidos, sitemap.xml (${allRoutes.filter((r) => r.includeInSitemap).length} URLs canônicas) e llms.txt atualizados!`
  )
}

main()
