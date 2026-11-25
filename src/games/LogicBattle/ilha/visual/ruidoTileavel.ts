/**
 * O RUÍDO PERIÓDICO das texturas procedurais (movido de `texturasPbrProcedural.ts` em 24/11/2026, SEM mudar uma linha da lógica): o campo do solo (`campoDoSolo.ts`) precisa do MESMO ruído, e copiá-lo
 * faria os dois divergirem. `hash2d` embrulha as coordenadas em `periodo` (o ladrilho se repete sem emenda); `fbmTileable` soma oitavas de `noiseTileable`.
 */

export function hash2d(ix: number, iy: number, periodo: number, seed: number): number {
  const px = ((ix % periodo) + periodo) % periodo
  const py = ((iy % periodo) + periodo) % periodo
  let h = Math.imul(px ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(py ^ 0xc2b2ae35, 0x27d4eb2f) ^ seed
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

export function noiseTileable(u: number, v: number, freq: number, seed: number): number {
  const fx = u * freq
  const fy = v * freq
  const x0 = Math.floor(fx)
  const y0 = Math.floor(fy)
  const tx = fx - x0
  const ty = fy - y0
  const sx = tx * tx * (3 - 2 * tx)
  const sy = ty * ty * (3 - 2 * ty)
  const n00 = hash2d(x0, y0, freq, seed)
  const n10 = hash2d(x0 + 1, y0, freq, seed)
  const n01 = hash2d(x0, y0 + 1, freq, seed)
  const n11 = hash2d(x0 + 1, y0 + 1, freq, seed)
  const nx0 = n00 + (n10 - n00) * sx
  const nx1 = n01 + (n11 - n01) * sx
  return nx0 + (nx1 - nx0) * sy
}

export function fbmTileable(u: number, v: number, baseFreq: number, oitavas: number, seed: number): number {
  let soma = 0
  let amp = 0.5
  let norm = 0
  let freq = baseFreq
  for (let o = 0; o < oitavas; o += 1) {
    soma += noiseTileable(u, v, freq, seed + o * 101) * amp
    norm += amp
    amp *= 0.5
    freq *= 2
  }
  return soma / norm
}
