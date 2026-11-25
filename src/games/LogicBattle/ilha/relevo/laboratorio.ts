import { biomaDoQuadrado, type BiomaId } from '../biomaRecursos'
import { alturaEm, inclinacaoEm, LADO_RELEVO, MEIA_RELEVO, normalEm, RELEVO_REGRAS, type CampoRelevo } from './campoRelevo'
import { gerarRelevo } from './geradorRelevo'

/**
 * O laboratório do relevo (24/11/2026): olhar o terreno ANTES de ligá-lo ao jogo. Tudo PURO e sem dependência (o PNG é escrito aqui mesmo, com deflate em blocos «stored»), para o script de
 * preview rodar no Node sem pacote novo e para os testes poderem conferir o que sai.
 *
 * Por que existe: o desenho aprovado diz «o relevo só se liga ao jogo depois de eu ver as fotos de cada bioma». Sem um instrumento que mostre o terreno, a decisão de amplitude seria um palpite.
 */

/** Sombreado de relevo (hillshade, de Lambert) de um campo: 0 = sombra total, 255 = face de frente para o sol. `azimute` em graus a partir do norte (+z), no sentido horário (0 = +z, 90 = +x, 270 = −x). */
export function hillshade(campo: CampoRelevo, azimuteGraus = 315, altitudeGraus = 45): Uint8Array {
  const saida = new Uint8Array(LADO_RELEVO * LADO_RELEVO)
  const az = (azimuteGraus * Math.PI) / 180
  const alt = (altitudeGraus * Math.PI) / 180
  // vetor PARA o sol (unitário): horizontal (sen az, cos az) escalado por cos(alt), vertical sen(alt)
  const lx = Math.sin(az) * Math.cos(alt)
  const lz = Math.cos(az) * Math.cos(alt)
  const ly = Math.sin(alt)
  for (let gz = -MEIA_RELEVO; gz <= MEIA_RELEVO; gz += 1) {
    for (let gx = -MEIA_RELEVO; gx <= MEIA_RELEVO; gx += 1) {
      const [nx, ny, nz] = normalEm(campo, gx, gz)
      const lambert = nx * lx + ny * ly + nz * lz
      const v = Math.round(255 * Math.max(0, Math.min(1, lambert)))
      saida[(gz + MEIA_RELEVO) * LADO_RELEVO + (gx + MEIA_RELEVO)] = v
    }
  }
  return saida
}

/** Cor hipsométrica de um bioma (RGB 0..255) para a altura `h` (m): o fundo, o plano e o alto de cada bioma, para a foto ter a cara do lugar. */
const PALETA: Readonly<Record<BiomaId, readonly [readonly [number, number, number], readonly [number, number, number], readonly [number, number, number]]>> = {
  clareira: [[96, 150, 96], [150, 178, 96], [214, 196, 118]],
  bosque: [[44, 92, 70], [70, 120, 74], [128, 150, 96]],
  serra_ouro: [[140, 108, 70], [182, 148, 96], [226, 196, 140]],
  ribeira: [[64, 132, 140], [110, 160, 118], [170, 190, 130]],
  tundra_cristal: [[116, 150, 190], [200, 218, 232], [248, 250, 255]],
  basalto_brasa: [[52, 46, 54], [92, 84, 90], [156, 108, 84]],
}

function misturaCor(a: readonly number[], b: readonly number[], t: number): [number, number, number] {
  const f = Math.max(0, Math.min(1, t))
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]
}

/** Pinta um quadrado: cor do bioma por altura × sombreado, com a água em azul e o PENHASCO (declive > 0,75, onde as regras de F3 vão morder) em vermelho. Devolve 113×113 pixels RGBA. */
export function pintarQuadrado(campo: CampoRelevo, bioma: BiomaId, azimute = 315, altitude = 45): Uint8Array {
  const sombra = hillshade(campo, azimute, altitude)
  const paleta = PALETA[bioma]
  const rgba = new Uint8Array(LADO_RELEVO * LADO_RELEVO * 4)
  // a pintura SEMPRE cobre ±(escala vertical do bioma) para o plano ficar no meio da paleta; −4…+7 m cobre todos os arquétipos
  for (let gz = -MEIA_RELEVO; gz <= MEIA_RELEVO; gz += 1) {
    for (let gx = -MEIA_RELEVO; gx <= MEIA_RELEVO; gx += 1) {
      const k = (gz + MEIA_RELEVO) * LADO_RELEVO + (gx + MEIA_RELEVO)
      const h = alturaEm(campo, gx, gz)
      let cor: [number, number, number] = h < 0 ? misturaCor(paleta[1], paleta[0], -h / 4) : misturaCor(paleta[1], paleta[2], h / 7)
      const sob = sombra[k] / 255
      // sombreado entre 0,45 e 1,15: o relevo aparece sem escurecer o chão plano (sombra = sen 45° ≈ 0,71 no plano)
      const f = 0.45 + sob * 0.7
      cor = [cor[0] * f, cor[1] * f, cor[2] * f]
      if (h < campo.nivelAgua - 0.02) cor = misturaCor(cor, [40, 120, 200], 0.55)
      if (inclinacaoEm(campo, gx, gz) > RELEVO_REGRAS.declMaxAndar) cor = misturaCor(cor, [220, 40, 40], 0.7)
      // z cresce para o NORTE do jogo, e uma imagem cresce para BAIXO: inverte a linha para o norte ficar em cima
      const linhaImagem = LADO_RELEVO - 1 - (gz + MEIA_RELEVO)
      const o = (linhaImagem * LADO_RELEVO + (gx + MEIA_RELEVO)) * 4
      rgba[o] = Math.max(0, Math.min(255, Math.round(cor[0])))
      rgba[o + 1] = Math.max(0, Math.min(255, Math.round(cor[1])))
      rgba[o + 2] = Math.max(0, Math.min(255, Math.round(cor[2])))
      rgba[o + 3] = 255
    }
  }
  return rgba
}

/** Monta uma janela de quadrados `(i0, j0)…(i1, j1)` numa só imagem RGBA, de `(i1−i0+1)·113` por `(j1−j0+1)·113` pixels. Os quadrados vizinhos compartilham a coluna de borda, então a emenda é a MESMA célula. */
export function montarJanela(i0: number, j0: number, i1: number, j1: number): { largura: number; altura: number; rgba: Uint8Array } {
  const nI = i1 - i0 + 1
  const nJ = j1 - j0 + 1
  const largura = nI * LADO_RELEVO
  const altura = nJ * LADO_RELEVO
  const rgba = new Uint8Array(largura * altura * 4)
  for (let j = j0; j <= j1; j += 1) {
    for (let i = i0; i <= i1; i += 1) {
      const quadrado = pintarQuadrado(gerarRelevo(i, j), biomaDoQuadrado(i, j))
      const colunaBase = (i - i0) * LADO_RELEVO
      // j maior fica em CIMA da imagem (norte)
      const linhaBase = (j1 - j) * LADO_RELEVO
      for (let y = 0; y < LADO_RELEVO; y += 1) {
        const destino = ((linhaBase + y) * largura + colunaBase) * 4
        rgba.set(quadrado.subarray(y * LADO_RELEVO * 4, (y + 1) * LADO_RELEVO * 4), destino)
      }
    }
  }
  return { largura, altura, rgba }
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// PNG sem dependência: assinatura + IHDR + IDAT (zlib com blocos «stored», sem compressão) + IEND. Maior que um PNG comprimido, mas válido, simples e verificável.
// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

let tabelaCrc: Uint32Array | null = null
function crc32(dados: Uint8Array): number {
  if (!tabelaCrc) {
    tabelaCrc = new Uint32Array(256)
    for (let n = 0; n < 256; n += 1) {
      let c = n
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      tabelaCrc[n] = c >>> 0
    }
  }
  let crc = 0xffffffff
  for (let i = 0; i < dados.length; i += 1) crc = tabelaCrc[(crc ^ dados[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function adler32(dados: Uint8Array): number {
  let a = 1
  let b = 0
  for (let i = 0; i < dados.length; i += 1) {
    a = (a + dados[i]) % 65521
    b = (b + a) % 65521
  }
  return ((b << 16) | a) >>> 0
}

function chunk(tipo: string, dados: Uint8Array): Uint8Array {
  const saida = new Uint8Array(12 + dados.length)
  const dv = new DataView(saida.buffer)
  dv.setUint32(0, dados.length)
  for (let i = 0; i < 4; i += 1) saida[4 + i] = tipo.charCodeAt(i)
  saida.set(dados, 8)
  dv.setUint32(8 + dados.length, crc32(saida.subarray(4, 8 + dados.length)))
  return saida
}

/** Codifica `rgba` (largura·altura·4 bytes) como PNG. Lança erro se o tamanho do buffer não bate: nunca escreve uma imagem torta. */
export function codificarPng(largura: number, altura: number, rgba: Uint8Array): Uint8Array {
  if (!Number.isInteger(largura) || !Number.isInteger(altura) || largura < 1 || altura < 1) throw new Error('codificarPng: largura e altura devem ser inteiros positivos')
  if (rgba.length !== largura * altura * 4) throw new Error(`codificarPng: esperava ${largura * altura * 4} bytes e recebi ${rgba.length}`)
  // cada linha ganha o byte de filtro 0 (sem filtro)
  const cru = new Uint8Array(altura * (1 + largura * 4))
  for (let y = 0; y < altura; y += 1) {
    cru[y * (1 + largura * 4)] = 0
    cru.set(rgba.subarray(y * largura * 4, (y + 1) * largura * 4), y * (1 + largura * 4) + 1)
  }
  // zlib: cabeçalho 78 01, blocos «stored» de até 65535 bytes, adler32
  const BLOCO = 65535
  const nBlocos = Math.max(1, Math.ceil(cru.length / BLOCO))
  const zlib = new Uint8Array(2 + cru.length + nBlocos * 5 + 4)
  zlib[0] = 0x78
  zlib[1] = 0x01
  let o = 2
  for (let b = 0; b < nBlocos; b += 1) {
    const ini = b * BLOCO
    const fim = Math.min(cru.length, ini + BLOCO)
    const len = fim - ini
    zlib[o++] = b === nBlocos - 1 ? 1 : 0
    zlib[o++] = len & 0xff
    zlib[o++] = (len >>> 8) & 0xff
    zlib[o++] = ~len & 0xff
    zlib[o++] = (~len >>> 8) & 0xff
    zlib.set(cru.subarray(ini, fim), o)
    o += len
  }
  new DataView(zlib.buffer).setUint32(o, adler32(cru))
  const ihdr = new Uint8Array(13)
  const dv = new DataView(ihdr.buffer)
  dv.setUint32(0, largura)
  dv.setUint32(4, altura)
  ihdr[8] = 8 // 8 bits por canal
  ihdr[9] = 6 // RGBA
  const partes = [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib), chunk('IEND', new Uint8Array(0))]
  const total = partes.reduce((s, p) => s + p.length, 0)
  const png = new Uint8Array(total)
  let p = 0
  for (const parte of partes) {
    png.set(parte, p)
    p += parte.length
  }
  return png
}
