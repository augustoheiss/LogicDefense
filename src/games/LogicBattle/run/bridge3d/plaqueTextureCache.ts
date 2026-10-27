// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/run/bridge3d/plaqueTextureCache.ts
// Cache compartilhado de texturas Canvas 2D -> THREE.CanvasTexture para placas 3D
// 100% WebGL (zero nós DOM <Html> por frame, zero layout thrashing a 60 FPS).
// ──────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three'

const MAX_CACHED_PLAQUE_TEXTURES = 320
const plaqueTextureCache = new Map<string, THREE.CanvasTexture>()

export function getPlaqueTexture(
  text: string,
  bgHex: string,
  borderHex: string,
  textHex = '#ffffff',
  subText = '',
): THREE.CanvasTexture {
  const key = `${text}|${bgHex}|${borderHex}|${textHex}|${subText}`
  const cached = plaqueTextureCache.get(key)
  if (cached) return cached

  if (plaqueTextureCache.size >= MAX_CACHED_PLAQUE_TEXTURES) {
    const oldestKey = plaqueTextureCache.keys().next().value
    if (oldestKey !== undefined) {
      const oldTex = plaqueTextureCache.get(oldestKey)
      oldTex?.dispose()
      plaqueTextureCache.delete(oldestKey)
    }
  }

  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, 256, 128)
    // Fundo arredondado com borda brilhante
    ctx.fillStyle = bgHex
    ctx.strokeStyle = borderHex
    ctx.lineWidth = 10
    ctx.beginPath()
    ctx.roundRect(8, 8, 240, 112, 22)
    ctx.fill()
    ctx.stroke()

    // Brilho superior sutil
    const grad = ctx.createLinearGradient(0, 8, 0, 64)
    grad.addColorStop(0, 'rgba(255,255,255,0.28)')
    grad.addColorStop(1, 'rgba(255,255,255,0.0)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.roundRect(14, 14, 228, 50, 16)
    ctx.fill()

    // Texto principal (com maxWidth = 216 para nunca vazar da borda arredondada)
    ctx.fillStyle = textHex
    ctx.strokeStyle = '#0f172a'
    ctx.lineWidth = 8
    ctx.lineJoin = 'round'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const fontSize =
      text.length > 9 ? 36 : text.length > 7 ? 42 : text.length > 4 ? 52 : 62
    ctx.font = `900 ${fontSize}px "Inter", system-ui, sans-serif`
    const mainY = subText ? 52 : 66
    ctx.strokeText(text, 128, mainY, 216)
    ctx.fillText(text, 128, mainY, 216)

    if (subText) {
      const subFontSize =
        subText.length > 18 ? 17 : subText.length > 13 ? 20 : 23
      ctx.font = `800 ${subFontSize}px "Inter", system-ui, sans-serif`
      ctx.fillStyle = '#fde047'
      ctx.lineWidth = 5
      ctx.strokeText(subText, 128, 97, 216)
      ctx.fillText(subText, 128, 97, 216)
    }
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  plaqueTextureCache.set(key, texture)
  return texture
}
