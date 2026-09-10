/**
 * Utilitários de Álgebra e Teoria das Cores para o Motor de Documentos CV Maker
 */

export interface RGB {
  r: number
  g: number
  b: number
}

export interface HSL {
  h: number // 0 - 360
  s: number // 0 - 100
  l: number // 0 - 100
}

/**
 * Converte HEX (#rgb ou #rrggbb) para RGB
 */
export function hexToRgb(hex: string): RGB | null {
  const cleanHex = hex.replace('#', '').trim()
  if (cleanHex.length === 3) {
    const r = parseInt(cleanHex[0] + cleanHex[0], 16)
    const g = parseInt(cleanHex[1] + cleanHex[1], 16)
    const b = parseInt(cleanHex[2] + cleanHex[2], 16)
    return isNaN(r) || isNaN(g) || isNaN(b) ? null : { r, g, b }
  }
  if (cleanHex.length === 6) {
    const r = parseInt(cleanHex.slice(0, 2), 16)
    const g = parseInt(cleanHex.slice(2, 4), 16)
    const b = parseInt(cleanHex.slice(4, 6), 16)
    return isNaN(r) || isNaN(g) || isNaN(b) ? null : { r, g, b }
  }
  return null
}

/**
 * Converte RGB para HEX (#rrggbb)
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (c: number) => {
    const clamped = Math.max(0, Math.min(255, Math.round(c)))
    return clamped.toString(16).padStart(2, '0')
  }
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/**
 * Converte RGB para HSL
 */
export function rgbToHsl(r: number, g: number, b: number): HSL {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0)
        break
      case g:
        h = (b - r) / d + 2
        break
      case b:
        h = (r - g) / d + 4
        break
    }
    h /= 6
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  }
}

/**
 * Converte HSL para RGB
 */
export function hslToRgb(h: number, s: number, l: number): RGB {
  h /= 360
  s /= 100
  l /= 100

  let r: number, g: number, b: number

  if (s === 0) {
    r = g = b = l
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1
      if (t > 1) t -= 1
      if (t < 1 / 6) return p + (q - p) * 6 * t
      if (t < 1 / 2) return q
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
      return p
    }

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1 / 3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1 / 3)
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255)
  }
}

/**
 * Deriva uma Cor Secundária harmoniosa e elegante a partir da Cor Primária.
 * Mantém o mesmo Matiz (Hue), ajustando a Luminosidade para criar um tom nobre
 * e de alto contraste ideal para subtítulos, empresas, instituições e cargos.
 */
export function deriveHarmoniousSecondary(primaryHex: string): string {
  const rgb = hexToRgb(primaryHex)
  if (!rgb) return '#0369a1'

  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b)

  // Se a cor for muito escura (l < 30), clareia um pouco para criar contraste
  // Se a cor for clara ou média (l >= 30), escurece ~18% para dar sobriedade e legibilidade em folha A4
  let targetL: number
  if (hsl.l < 30) {
    targetL = Math.min(60, hsl.l + 18)
  } else {
    targetL = Math.max(18, hsl.l - 16)
  }

  // Aumenta ligeiramente a saturação para não ficar acinzentado
  const targetS = Math.min(100, Math.max(20, hsl.s + 5))

  const newRgb = hslToRgb(hsl.h, targetS, targetL)
  return rgbToHex(newRgb.r, newRgb.g, newRgb.b)
}
