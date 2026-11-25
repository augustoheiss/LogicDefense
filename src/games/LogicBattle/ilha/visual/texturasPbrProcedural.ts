import {
  CanvasTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
} from 'three'
import type { BiomaId } from '../biomaRecursos'
import { SPEC_QUALIDADE, type QualidadeEfetiva } from './qualidadeGrafica'
import type { QualidadeGraficaPreset } from '../partidaPolicies'
import { BIOMA_VISUAL_CATALOG } from './biomaVisualCatalog'
import { campoDoSoloRapido } from './campoDoSolo'
import { fbmTileable, hash2d } from './ruidoTileavel'
import { campoDoLadrilho, REPETICAO_DO_LADRILHO } from './flagstone'
import type { RecursoDescartavel } from './recursoGpuPool'

export interface TrioPbrTextura extends RecursoDescartavel {
  readonly map: CanvasTexture
  readonly normalMap: CanvasTexture
  readonly roughnessMap: CanvasTexture
}

export interface ParPbrTextura extends RecursoDescartavel {
  readonly map: CanvasTexture
  readonly normalMap: CanvasTexture
}

export interface PacoteTexturasBioma extends RecursoDescartavel {
  readonly bioma: BiomaId
  readonly resolucao: number
  readonly solo: TrioPbrTextura
  readonly estrada: TrioPbrTextura
  readonly margem: ParPbrTextura
  readonly tronco: ParPbrTextura
  readonly copa: ParPbrTextura
  readonly rocha: ParPbrTextura
}

export interface PacoteTexturasBlocos extends RecursoDescartavel {
  readonly resolucao: number
  readonly madeira: TrioPbrTextura
  readonly pedra: TrioPbrTextura
  readonly ouro: TrioPbrTextura
  readonly canteiro: TrioPbrTextura
  readonly fundacaoPedra: TrioPbrTextura
  readonly madeiraPier: TrioPbrTextura
}

export interface BiomaTextureProvider {
  gerarBioma(bioma: BiomaId, resolucao: 256 | 512 | 1024): PacoteTexturasBioma | null
  gerarBlocos(resolucao: 256 | 512 | 1024): PacoteTexturasBlocos | null
}

function hexParaRgb(hex: string): [number, number, number] {
  const limpo = hex.replace('#', '')
  const num = parseInt(limpo.length === 3 ? limpo.split('').map((c) => c + c).join('') : limpo, 16)
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255]
}

function clampByte(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v | 0
}

function mixCor(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  t: number,
): [number, number, number] {
  const f = Math.max(0, Math.min(1, t))
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]
}

function criarCanvas(res: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = res
  canvas.height = res
  return canvas
}

function finalizarTextura(
  canvas: HTMLCanvasElement,
  repeatX: number,
  repeatY: number,
  srgb: boolean,
): CanvasTexture {
  const tex = new CanvasTexture(canvas)
  tex.wrapS = RepeatWrapping
  tex.wrapT = RepeatWrapping
  tex.repeat.set(repeatX, repeatY)
  tex.colorSpace = srgb ? SRGBColorSpace : tex.colorSpace
  tex.minFilter = LinearMipmapLinearFilter
  tex.magFilter = LinearFilter
  tex.generateMipmaps = true
  tex.needsUpdate = true
  return tex
}

function gerarNormalDeAltura(
  altura: Float32Array,
  res: number,
  forca: number,
  repeatX: number,
  repeatY: number,
): CanvasTexture | null {
  const canvas = criarCanvas(res)
  if (!canvas) return null
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const img = ctx.createImageData(res, res)
  const data = img.data
  const at = (x: number, y: number): number => {
    const wx = ((x % res) + res) % res
    const wy = ((y % res) + res) % res
    return altura[wy * res + wx]
  }
  for (let y = 0; y < res; y += 1) {
    for (let x = 0; x < res; x += 1) {
      const tl = at(x - 1, y - 1)
      const t = at(x, y - 1)
      const tr = at(x + 1, y - 1)
      const l = at(x - 1, y)
      const r = at(x + 1, y)
      const bl = at(x - 1, y + 1)
      const b = at(x, y + 1)
      const br = at(x + 1, y + 1)
      const dx = (tr + 2 * r + br - (tl + 2 * l + bl)) * forca
      const dy = (bl + 2 * b + br - (tl + 2 * t + tr)) * forca
      const nx = -dx
      const ny = -dy
      const nz = 1
      const inv = 1 / Math.hypot(nx, ny, nz)
      const idx = (y * res + x) * 4
      data[idx] = clampByte((nx * inv * 0.5 + 0.5) * 255)
      data[idx + 1] = clampByte((ny * inv * 0.5 + 0.5) * 255)
      data[idx + 2] = clampByte((nz * inv * 0.5 + 0.5) * 255)
      data[idx + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return finalizarTextura(canvas, repeatX, repeatY, false)
}

function construirTrioPbr(
  res: number,
  repeatX: number,
  repeatY: number,
  forcaNormal: number,
  amostrador: (u: number, v: number) => { rgb: [number, number, number]; h: number; rough: number },
): TrioPbrTextura | null {
  const cMap = criarCanvas(res)
  const cRough = criarCanvas(res)
  if (!cMap || !cRough) return null
  const ctxMap = cMap.getContext('2d')
  const ctxRough = cRough.getContext('2d')
  if (!ctxMap || !ctxRough) return null

  const imgMap = ctxMap.createImageData(res, res)
  const imgRough = ctxRough.createImageData(res, res)
  const altura = new Float32Array(res * res)
  const dMap = imgMap.data
  const dRough = imgRough.data

  for (let y = 0; y < res; y += 1) {
    const v = y / res
    for (let x = 0; x < res; x += 1) {
      const u = x / res
      const s = amostrador(u, v)
      const px = y * res + x
      altura[px] = s.h
      const i4 = px * 4
      dMap[i4] = clampByte(s.rgb[0])
      dMap[i4 + 1] = clampByte(s.rgb[1])
      dMap[i4 + 2] = clampByte(s.rgb[2])
      dMap[i4 + 3] = 255
      const rByte = clampByte(s.rough * 255)
      dRough[i4] = rByte
      dRough[i4 + 1] = rByte
      dRough[i4 + 2] = rByte
      dRough[i4 + 3] = 255
    }
  }

  ctxMap.putImageData(imgMap, 0, 0)
  ctxRough.putImageData(imgRough, 0, 0)
  const normalMap = gerarNormalDeAltura(altura, res, forcaNormal, repeatX, repeatY)
  if (!normalMap) return null
  const map = finalizarTextura(cMap, repeatX, repeatY, true)
  const roughnessMap = finalizarTextura(cRough, repeatX, repeatY, false)
  return {
    map,
    normalMap,
    roughnessMap,
    dispose() {
      map.dispose()
      normalMap.dispose()
      roughnessMap.dispose()
    },
  }
}

function construirParPbr(
  res: number,
  repeatX: number,
  repeatY: number,
  forcaNormal: number,
  amostrador: (u: number, v: number) => { rgb: [number, number, number]; h: number },
): ParPbrTextura | null {
  const cMap = criarCanvas(res)
  if (!cMap) return null
  const ctxMap = cMap.getContext('2d')
  if (!ctxMap) return null
  const imgMap = ctxMap.createImageData(res, res)
  const altura = new Float32Array(res * res)
  const dMap = imgMap.data
  for (let y = 0; y < res; y += 1) {
    const v = y / res
    for (let x = 0; x < res; x += 1) {
      const u = x / res
      const s = amostrador(u, v)
      const px = y * res + x
      altura[px] = s.h
      const i4 = px * 4
      dMap[i4] = clampByte(s.rgb[0])
      dMap[i4 + 1] = clampByte(s.rgb[1])
      dMap[i4 + 2] = clampByte(s.rgb[2])
      dMap[i4 + 3] = 255
    }
  }
  ctxMap.putImageData(imgMap, 0, 0)
  const normalMap = gerarNormalDeAltura(altura, res, forcaNormal, repeatX, repeatY)
  if (!normalMap) return null
  const map = finalizarTextura(cMap, repeatX, repeatY, true)
  return {
    map,
    normalMap,
    dispose() {
      map.dispose()
      normalMap.dispose()
    },
  }
}

function pedraLavradaSample(
  u: number,
  v: number,
  corPedra: readonly [number, number, number],
  corRejunte: readonly [number, number, number],
  cols: number,
  rows: number,
  seed: number,
): { rgb: [number, number, number]; h: number; rough: number } {
  const fy = v * rows
  const row = Math.floor(fy)
  const offset = (row % 2) * 0.5
  const fx = u * cols + offset
  const col = Math.floor(fx)
  const lx = fx - col
  const ly = fy - row
  const distBorda = Math.min(lx, 1 - lx, ly, 1 - ly)
  const rejunte = distBorda < 0.08 ? 0 : Math.min(1, (distBorda - 0.08) / 0.09)
  const varBloco = hash2d(col, row, 64, seed) * 0.24 - 0.12
  const grao = fbmTileable(u, v, 16, 3, seed + 17)
  const base = [
    corPedra[0] * (1 + varBloco + (grao - 0.5) * 0.22),
    corPedra[1] * (1 + varBloco + (grao - 0.5) * 0.22),
    corPedra[2] * (1 + varBloco + (grao - 0.5) * 0.22),
  ] as const
  const rgb = mixCor(corRejunte, base, rejunte)
  const h = rejunte * (0.55 + grao * 0.45)
  const rough = rejunte < 0.5 ? 0.96 : 0.68 + grao * 0.2
  return { rgb, h, rough }
}

/**
 * A estrada e a praça de lajes irregulares (F1 Task 9): a laje de Voronoi de `flagstone.ts` vira cor, altura e rugosidade. Cada laje tem o seu tom (±18% da cor base do bioma), a junta recebe a
 * cor do rejunte, e a rugosidade sobe na junta (lama e musgo, sem brilho) e cai um pouco no topo da laje (a pedra gasta pelo uso). O grão fino vem de um ruído em escala MENOR que a laje.
 */
export function pisoDeLajesSample(
  u: number,
  v: number,
  res: number,
  corPedra: readonly [number, number, number],
  corRejunte: readonly [number, number, number],
  seed: number,
): { rgb: [number, number, number]; h: number; rough: number } {
  // O desenho das lajes (altura e tom por pixel) NÃO depende do bioma: sai do campo calculado UMA vez e guardado em cache (`campoDoLadrilho`); só a cor muda por bioma. `construirTrioPbr` chama o
  // amostrador com `u = x / res`, então o pixel volta exato por `Math.round(u * res)`. Recalcular o Voronoi por pixel a cada troca de bioma custava ~121 ms a 512 px.
  const campo = campoDoLadrilho(res, seed)
  const px = Math.min(campo.res - 1, Math.round(u * campo.res))
  const py = Math.min(campo.res - 1, Math.round(v * campo.res))
  const laje = { altura: campo.altura[py * campo.res + px], tom: campo.tom[py * campo.res + px] }
  // O GRÃO também sai do campo (era a maior fatia que sobrou do pacote do bioma: 33 ms a 512 px, o fBm de 3 oitavas por pixel): só depende de (u, v, semente), nunca do bioma. Mesma função, sem aproximação.
  const grao = campo.grao[py * campo.res + px]
  const fatorTom = 0.82 + laje.tom * 0.36 + (grao - 0.5) * 0.14
  const base: [number, number, number] = [corPedra[0] * fatorTom, corPedra[1] * fatorTom, corPedra[2] * fatorTom]
  const rgb = mixCor(corRejunte, base, Math.min(1, laje.altura * 1.15))
  return { rgb, h: laje.altura * (0.7 + grao * 0.3), rough: 0.96 - laje.altura * 0.26 + grao * 0.06 }
}

export class ProceduralBiomaTextureProvider implements BiomaTextureProvider {
  gerarBioma(bioma: BiomaId, resolucao: 256 | 512 | 1024): PacoteTexturasBioma | null {
    const cat = BIOMA_VISUAL_CATALOG[bioma]
    const resChao = resolucao
    const resDetalhe = Math.min(512, resolucao)

    const soloA = hexParaRgb(cat.soloCorBase)
    const soloB = hexParaRgb(cat.soloCorDetalhe)
    // O campo SUAVE do solo (`macro`, `micro` e a mistura) vem da grade grossa de `campoDoSolo.ts`: eram 50% das chamadas de ruído do pacote (fBm de 6 oitavas por pixel, medido em 24/11).
    // As RACHADURAS e os VEIOS (limiar duro) abaixo seguem por pixel EXATO: interpolá-los borraria a borda. `construirTrioPbr` chama o amostrador com `u = x / res`: o pixel volta exato.
    const campoSolo = campoDoSoloRapido(bioma, resChao)
    const solo = construirTrioPbr(resChao, 18, 18, 2.2, (u, v) => {
      const pxSolo = Math.min(campoSolo.res - 1, Math.round(u * campoSolo.res))
      const pySolo = Math.min(campoSolo.res - 1, Math.round(v * campoSolo.res))
      const iSolo = pySolo * campoSolo.res + pxSolo
      const macro = campoSolo.macro[iSolo]
      const micro = campoSolo.micro[iSolo]
      let mistura = campoSolo.mistura[iSolo]
      let h = mistura
      let rough = 0.88 - macro * 0.12
      if (bioma === 'serra_ouro') {
        const rachadura = Math.abs(fbmTileable(u, v, 8, 3, 213) - 0.5) * 2
        if (rachadura < 0.09) {
          mistura = 0.08
          h = 0.1
        }
        rough = 0.78 + micro * 0.16
      } else if (bioma === 'tundra_cristal') {
        rough = 0.35 + macro * 0.28
      } else if (bioma === 'basalto_brasa') {
        const veio = Math.abs(fbmTileable(u, v, 8, 3, 409) - 0.5) * 2
        if (veio < 0.07) {
          return { rgb: [249, 115, 22], h: 0.15, rough: 0.35 }
        }
        rough = 0.72 + micro * 0.2
      }
      const rgb = mixCor(soloB, soloA, mistura)
      return { rgb, h, rough }
    })
    if (!solo) return null

    const estBase = hexParaRgb(cat.estradaCorBase)
    const estRej = hexParaRgb(cat.estradaCorRejunte)
    const estrada = construirTrioPbr(resDetalhe, REPETICAO_DO_LADRILHO.largura, REPETICAO_DO_LADRILHO.comprimento, 2.8, (u, v) =>
      pisoDeLajesSample(u, v, resDetalhe, estBase, estRej, 303),
    )
    if (!estrada) {
      solo.dispose()
      return null
    }

    const marBase = hexParaRgb(cat.margemCorBase)
    const marEsc = mixCor(marBase, [40, 32, 24], 0.28)
    const margem = construirParPbr(Math.min(256, resolucao), 6, 6, 1.8, (u, v) => {
      const n = fbmTileable(u, v, 12, 3, 555)
      return { rgb: mixCor(marEsc, marBase, n), h: n }
    })
    if (!margem) {
      solo.dispose()
      estrada.dispose()
      return null
    }

    const trBase = hexParaRgb(cat.troncoCor)
    const trEsc = mixCor(trBase, [15, 10, 8], 0.42)
    const tronco = construirParPbr(Math.min(256, resolucao), 2, 2, 2.5, (u, v) => {
      const veios = fbmTileable(u * 2.5, v * 0.5, 8, 3, 701)
      return { rgb: mixCor(trEsc, trBase, veios), h: veios }
    })
    if (!tronco) {
      solo.dispose()
      estrada.dispose()
      margem.dispose()
      return null
    }

    const cpA = hexParaRgb(cat.copaCorPrimaria)
    const cpB = hexParaRgb(cat.copaCorSecundaria)
    const copa = construirParPbr(Math.min(256, resolucao), 2, 2, 2.0, (u, v) => {
      const folha = fbmTileable(u, v, 10, 3, 811)
      return { rgb: mixCor(cpA, cpB, folha), h: folha }
    })
    if (!copa) {
      solo.dispose()
      estrada.dispose()
      margem.dispose()
      tronco.dispose()
      return null
    }

    const rcBase = hexParaRgb(cat.rochaCor)
    const rcEsc = mixCor(rcBase, [12, 12, 16], 0.45)
    const rocha = construirParPbr(Math.min(256, resolucao), 2, 2, 2.8, (u, v) => {
      const f = fbmTileable(u, v, 8, 3, 919)
      return { rgb: mixCor(rcEsc, rcBase, f), h: f }
    })
    if (!rocha) {
      solo.dispose()
      estrada.dispose()
      margem.dispose()
      tronco.dispose()
      copa.dispose()
      return null
    }

    return {
      bioma,
      resolucao,
      solo,
      estrada,
      margem,
      tronco,
      copa,
      rocha,
      dispose() {
        solo.dispose()
        estrada.dispose()
        margem.dispose()
        tronco.dispose()
        copa.dispose()
        rocha.dispose()
      },
    }
  }

  gerarBlocos(resolucao: 256 | 512 | 1024): PacoteTexturasBlocos | null {
    const res = Math.min(512, resolucao)
    const madeira = construirTrioPbr(res, 1, 1, 2.4, (u, v) => {
      const tabua = Math.floor(v * 4)
      const seam = Math.abs(v * 4 - Math.round(v * 4)) < 0.045
      const fibra = fbmTileable(u * 0.5, v * 3.0, 8, 3, 1201 + tabua * 17)
      const base = mixCor([135, 68, 18], [202, 122, 46], fibra)
      if (seam) return { rgb: [72, 34, 8], h: 0.12, rough: 0.94 }
      return { rgb: base, h: 0.5 + fibra * 0.5, rough: 0.72 + fibra * 0.16 }
    })
    if (!madeira) return null

    const pedra = construirTrioPbr(res, 1, 1, 2.8, (u, v) =>
      pedraLavradaSample(u, v, [138, 152, 168], [62, 72, 86], 2, 3, 1409),
    )
    if (!pedra) {
      madeira.dispose()
      return null
    }

    const ouro = construirTrioPbr(res, 1, 1, 2.0, (u, v) => {
      const borda = Math.min(u, 1 - u, v, 1 - v) < 0.09
      const brilho = fbmTileable(u, v, 8, 3, 1607)
      if (borda) return { rgb: [161, 98, 7], h: 0.35, rough: 0.42 }
      return {
        rgb: mixCor([217, 155, 16], [254, 224, 92], brilho),
        h: 0.65 + brilho * 0.35,
        rough: 0.18 + brilho * 0.18,
      }
    })
    if (!ouro) {
      madeira.dispose()
      pedra.dispose()
      return null
    }

    const resFund = Math.min(256, resolucao)
    const canteiro = construirTrioPbr(resFund, 2, 2, 2.6, (u, v) => {
      const borda = Math.min(u, 1 - u, v, 1 - v) < 0.08
      const terra = fbmTileable(u, v, 8, 3, 1811)
      const brita = fbmTileable(u, v, 24, 2, 1877)
      const sulco = Math.abs(Math.sin((u + v * 0.25) * Math.PI * 6)) < 0.14
      if (borda) {
        return pedraLavradaSample(u, v, [120, 113, 108], [68, 64, 60], 4, 4, 1901)
      }
      const rgb = sulco
        ? mixCor([92, 68, 44], [128, 96, 64], terra)
        : mixCor([114, 88, 58], [166, 144, 112], terra * 0.65 + brita * 0.35)
      return {
        rgb,
        h: 0.35 + (sulco ? 0.1 : terra * 0.38 + brita * 0.22),
        rough: 0.86 + brita * 0.11,
      }
    })
    if (!canteiro) {
      madeira.dispose()
      pedra.dispose()
      ouro.dispose()
      return null
    }

    const fundacaoPedra = construirTrioPbr(resFund, 2, 1, 3.0, (u, v) =>
      pedraLavradaSample(u, v, [116, 126, 138], [52, 58, 68], 3, 2, 2029),
    )
    if (!fundacaoPedra) {
      madeira.dispose()
      pedra.dispose()
      ouro.dispose()
      canteiro.dispose()
      return null
    }

    const madeiraPier = construirTrioPbr(resFund, 2, 2, 2.5, (u, v) => {
      const tabua = Math.floor(v * 6)
      const fresta = Math.abs(v * 6 - Math.round(v * 6)) < 0.06
      const umidade = fbmTileable(u * 0.6, v * 2.5, 8, 3, 2113 + tabua * 23)
      if (fresta) return { rgb: [38, 24, 14], h: 0.1, rough: 0.88 }
      return {
        rgb: mixCor([76, 48, 26], [122, 82, 46], umidade),
        h: 0.45 + umidade * 0.55,
        rough: 0.46 + umidade * 0.26,
      }
    })
    if (!madeiraPier) {
      madeira.dispose()
      pedra.dispose()
      ouro.dispose()
      canteiro.dispose()
      fundacaoPedra.dispose()
      return null
    }

    return {
      resolucao,
      madeira,
      pedra,
      ouro,
      canteiro,
      fundacaoPedra,
      madeiraPier,
      dispose() {
        madeira.dispose()
        pedra.dispose()
        ouro.dispose()
        canteiro.dispose()
        fundacaoPedra.dispose()
        madeiraPier.dispose()
      },
    }
  }
}

export const defaultBiomaTextureProvider: BiomaTextureProvider = new ProceduralBiomaTextureProvider()

export interface OpcoesPackExternoUltra {
  readonly baseUrl?: string
  readonly timeoutMs?: number
}

export interface PackExternoUltraSolo extends RecursoDescartavel {
  readonly bioma: BiomaId
  readonly resolucao: 1024
  readonly map: Texture
  readonly normalMap: Texture
  readonly roughnessMap: Texture
}

/**
 * Loader opcional sob demanda para texturas 1024px (.webp) externas em modo Ultra.
 * Retorna null com fallback silencioso quando o preset não suporta Ultra, em ambiente headless/Node
 * ou quando os arquivos opcionais não estiverem hospedados.
 */
export async function carregarPackExternoUltra(
  bioma: BiomaId,
  preset: QualidadeGraficaPreset | QualidadeEfetiva,
  opcoes?: OpcoesPackExternoUltra,
): Promise<PackExternoUltraSolo | null> {
  if (preset === 'auto' || !SPEC_QUALIDADE[preset].suportaPackExternoUltra) return null
  if (typeof window === 'undefined' || typeof fetch !== 'function' || typeof Image === 'undefined') {
    return null
  }
  const baseUrl = (opcoes?.baseUrl ?? '/textures/ultra').replace(/\/+$/, '')
  const timeoutMs = opcoes?.timeoutMs ?? 2500
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null
  try {
    const urls = {
      albedo: `${baseUrl}/${bioma}/albedo.webp`,
      normal: `${baseUrl}/${bioma}/normal.webp`,
      roughness: `${baseUrl}/${bioma}/roughness.webp`,
    }
    const resp = await fetch(urls.albedo, {
      method: 'HEAD',
      ...(controller ? { signal: controller.signal } : {}),
    })
    if (!resp.ok) return null
    const carregadas = await Promise.all([
      carregarTexturaWeb(urls.albedo, true),
      carregarTexturaWeb(urls.normal, false),
      carregarTexturaWeb(urls.roughness, false),
    ])
    const [albedo, normalMap, roughnessMap] = carregadas
    if (!albedo || !normalMap || !roughnessMap) {
      albedo?.dispose()
      normalMap?.dispose()
      roughnessMap?.dispose()
      return null
    }
    return {
      bioma,
      resolucao: 1024,
      map: albedo,
      normalMap,
      roughnessMap,
      dispose: () => {
        albedo.dispose()
        normalMap.dispose()
        roughnessMap.dispose()
      },
    }
  } catch {
    return null
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function carregarTexturaWeb(url: string, srgb: boolean): Promise<Texture | null> {
  return new Promise((resolve) => {
    try {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        const tex = new Texture(img)
        tex.wrapS = RepeatWrapping
        tex.wrapT = RepeatWrapping
        tex.colorSpace = srgb ? SRGBColorSpace : NoColorSpace
        tex.anisotropy = 4
        tex.needsUpdate = true
        resolve(tex)
      }
      img.onerror = () => resolve(null)
      img.src = url
    } catch {
      resolve(null)
    }
  })
}
