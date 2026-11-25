/**
 * Ruído determinístico do relevo (24/11/2026). PURO: nenhuma função usa `Math.random`, `Date` ou estado global, então o mesmo `(x, z, sal)` devolve sempre o mesmo número,
 * em qualquer máquina e a qualquer momento. É a base da regra «o relevo de um quadrado é função de (i, j) e de nada mais» (I6): o mundo é ilimitado e um quadrado
 * descartado do cache tem de renascer IGUAL.
 *
 * O hash é o mesmo estilo de `hashInt` de `biomaRecursos.ts` (multiplicações inteiras de 32 bits com `Math.imul`), para o projeto ter uma só família de hashes.
 */

/** Hash de um par de inteiros e um sal, normalizado para `[0, 1)`. Aceita qualquer inteiro (negativo, zero, grande): os bits altos são descartados por `|0`. */
export function hash2(ix: number, iz: number, sal: number): number {
  let h = Math.imul(ix | 0, 0x85ebca6b) ^ Math.imul(iz | 0, 0xc2b2ae35) ^ Math.imul(sal | 0, 0x27d4eb2f)
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

/** Smootherstep (6t⁵ − 15t⁴ + 10t³) em `[0, 1]`, preso fora do intervalo: tem derivada zero nas pontas, então emendas de blocos de ruído não mostram quina. */
export function suave(t: number): number {
  if (!(t > 0)) return 0
  if (t >= 1) return 1
  return t * t * t * (t * (t * 6 - 15) + 10)
}

/** Gradiente unitário do nó `(ix, iz)`: um ângulo vindo do hash. */
function gradienteDoNo(ix: number, iz: number, sal: number): [number, number] {
  const angulo = hash2(ix, iz, sal) * Math.PI * 2
  return [Math.cos(angulo), Math.sin(angulo)]
}

/**
 * Ruído de gradiente 2D (estilo Perlin), contínuo, em `[-1, 1]`, valendo 0 nos nós inteiros. Para `|x|` ou `|z|` muito grandes (±1e6) a parte fracionária
 * é calculada por `x − floor(x)`, que continua exata em dupla precisão até ~1e15: o mundo ilimitado não degrada o ruído nos limites do jogo.
 */
export function ruidoGradiente(x: number, z: number, sal: number): number {
  const x0 = Math.floor(x)
  const z0 = Math.floor(z)
  const fx = x - x0
  const fz = z - z0
  const produto = (ox: number, oz: number): number => {
    const [gx, gz] = gradienteDoNo(x0 + ox, z0 + oz, sal)
    return gx * (fx - ox) + gz * (fz - oz)
  }
  const u = suave(fx)
  const v = suave(fz)
  const a = produto(0, 0) + (produto(1, 0) - produto(0, 0)) * u
  const b = produto(0, 1) + (produto(1, 1) - produto(0, 1)) * u
  // O valor bruto do ruído de gradiente 2D fica em ±√2/2; o fator √2 o leva a ≈ ±1, e o `clamp` garante o contrato.
  const bruto = (a + (b - a) * v) * Math.SQRT2
  return bruto < -1 ? -1 : bruto > 1 ? 1 : bruto
}

/** Movimento browniano fractal: soma de `oitavas` ruídos com frequência × `lacunaridade` e amplitude × `ganho`. Normalizado a `[-1, 1]`. */
export function fbm(
  x: number,
  z: number,
  sal: number,
  oitavas: number,
  lacunaridade = 2,
  ganho = 0.5,
): number {
  let soma = 0
  let amplitude = 1
  let norma = 0
  let freq = 1
  const n = Math.max(1, Math.floor(oitavas))
  for (let o = 0; o < n; o += 1) {
    soma += ruidoGradiente(x * freq, z * freq, sal + o * 101) * amplitude
    norma += amplitude
    amplitude *= ganho
    freq *= lacunaridade
  }
  const v = soma / norma
  return v < -1 ? -1 : v > 1 ? 1 : v
}

/** Ruído «ridged» (cristas afiadas): `1 − |ruído|` elevado ao quadrado e somado em oitavas. Em `[0, 1]`; é o que dá serras e paredões à `serra_ouro` e à `tundra_cristal`. */
export function ridged(x: number, z: number, sal: number, oitavas: number): number {
  let soma = 0
  let amplitude = 1
  let norma = 0
  let freq = 1
  const n = Math.max(1, Math.floor(oitavas))
  for (let o = 0; o < n; o += 1) {
    const crista = 1 - Math.abs(ruidoGradiente(x * freq, z * freq, sal + o * 131))
    soma += crista * crista * amplitude
    norma += amplitude
    amplitude *= 0.5
    freq *= 2
  }
  const v = soma / norma
  return v < 0 ? 0 : v > 1 ? 1 : v
}
