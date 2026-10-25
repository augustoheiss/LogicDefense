import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import {
  resolveRouteMeta,
  getCanonicalUrl,
  getAbsoluteOgImageUrl,
  buildRouteJsonLd,
} from '../seo/routeRegistry'

function upsertMetaTag(attrName: 'name' | 'property', attrValue: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attrName}="${attrValue}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attrName, attrValue)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function upsertLinkTag(rel: string, href: string, type?: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
  if (type) {
    el.setAttribute('type', type)
  }
}

export function RouteSeoHead() {
  const location = useLocation()

  useEffect(() => {
    const meta = resolveRouteMeta(location.pathname)
    const canonicalUrl = getCanonicalUrl(meta)
    const ogImageUrl = getAbsoluteOgImageUrl(meta)

    // 1. Document Title
    document.title = meta.title

    // 2. Standard SEO Meta Tags
    upsertMetaTag('name', 'description', meta.description)
    upsertMetaTag('name', 'keywords', meta.keywords)

    // 3. Canonical & Specific Page Icon
    upsertLinkTag('canonical', canonicalUrl)
    upsertLinkTag('icon', meta.iconPath, 'image/png')
    upsertLinkTag('apple-touch-icon', meta.iconPath)

    // 4. Open Graph (WhatsApp, LinkedIn, Facebook, Discord, Telegram)
    upsertMetaTag('property', 'og:type', meta.ogType)
    upsertMetaTag('property', 'og:url', canonicalUrl)
    upsertMetaTag('property', 'og:title', meta.title)
    upsertMetaTag('property', 'og:description', meta.description)
    upsertMetaTag('property', 'og:image', ogImageUrl)
    upsertMetaTag('property', 'og:image:width', '1200')
    upsertMetaTag('property', 'og:image:height', '630')
    upsertMetaTag('property', 'og:image:alt', meta.title)

    // 5. Twitter / X Card
    upsertMetaTag('name', 'twitter:card', 'summary_large_image')
    upsertMetaTag('name', 'twitter:title', meta.title)
    upsertMetaTag('name', 'twitter:description', meta.description)
    upsertMetaTag('name', 'twitter:image', ogImageUrl)

    // 6. Route-Specific Schema.org JSON-LD
    let scriptEl = document.head.querySelector<HTMLScriptElement>('script#route-schema-jsonld')
    if (!scriptEl) {
      scriptEl = document.createElement('script')
      scriptEl.id = 'route-schema-jsonld'
      scriptEl.type = 'application/ld+json'
      document.head.appendChild(scriptEl)
    }
    scriptEl.textContent = JSON.stringify(buildRouteJsonLd(meta))
  }, [location.pathname])

  return null
}
