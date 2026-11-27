import { PARTIDA } from './partidaPolicies'

export interface Bloqueio {
  x: number
  z: number
  hx: number
  hz: number
}

export interface Marco {
  x: number
  z: number
}

const DIRECOES: ReadonlyArray<[number, number]> = [
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
]

export let contagemBuscas = 0
export let visitasUltima = 0

export function zerarBuscas(): void {
  contagemBuscas = 0
  visitasUltima = 0
}

function chave(gx: number, gz: number): string {
  return `${gx},${gz}`
}

function limite(): number {
  return Math.ceil(PARTIDA.radius)
}

function centro(gx: number, gz: number): Marco {
  return { x: gx * PARTIDA.celula, z: gz * PARTIDA.celula }
}

interface GradeBloqueios {
  lim: number
  lado: number
  celulas: Uint8Array
}

function construirGradeBloqueios(
  bloqueios: readonly Bloqueio[],
  bloqueadoExtra?: (x: number, z: number) => boolean,
): GradeBloqueios {
  const lim = limite()
  const lado = lim * 2 + 1
  const celulas = new Uint8Array(lado * lado)
  const borda = PARTIDA.radius - PARTIDA.body
  const celula = PARTIDA.celula
  for (let gz = -lim; gz <= lim; gz += 1) {
    const pz = gz * celula
    const row = (gz + lim) * lado
    for (let gx = -lim; gx <= lim; gx += 1) {
      const px = gx * celula
      if (PARTIDA.atlas === 'grade') {
        if (Math.abs(px) > borda || Math.abs(pz) > borda) celulas[row + gx + lim] = 1
      } else if (Math.hypot(px, pz) > borda) {
        celulas[row + gx + lim] = 1
      }
      if (bloqueadoExtra && celulas[row + gx + lim] === 0 && bloqueadoExtra(px, pz)) {
        celulas[row + gx + lim] = 1
      }
    }
  }
  const body = PARTIDA.body
  for (const caixa of bloqueios) {
    const rx = caixa.hx + body
    const rz = caixa.hz + body
    const minGx = Math.max(-lim, Math.ceil((caixa.x - rx) / celula))
    const maxGx = Math.min(lim, Math.floor((caixa.x + rx) / celula))
    const minGz = Math.max(-lim, Math.ceil((caixa.z - rz) / celula))
    const maxGz = Math.min(lim, Math.floor((caixa.z + rz) / celula))
    for (let gz = minGz; gz <= maxGz; gz += 1) {
      if (Math.abs(gz * celula - caixa.z) > rz) continue
      const row = (gz + lim) * lado
      for (let gx = minGx; gx <= maxGx; gx += 1) {
        if (Math.abs(gx * celula - caixa.x) <= rx) {
          celulas[row + gx + lim] = 1
        }
      }
    }
  }
  return { lim, lado, celulas }
}

function bloqueiaGrade(gx: number, gz: number, grade: GradeBloqueios): boolean {
  if (gx < -grade.lim || gz < -grade.lim || gx > grade.lim || gz > grade.lim) return true
  return grade.celulas[(gz + grade.lim) * grade.lado + (gx + grade.lim)] === 1
}

function bloqueia(gx: number, gz: number, bloqueios: readonly Bloqueio[], grade?: GradeBloqueios): boolean {
  if (grade) return bloqueiaGrade(gx, gz, grade)
  if (gx < -limite() || gz < -limite() || gx > limite() || gz > limite()) return true
  const ponto = centro(gx, gz)
  const borda = PARTIDA.radius - PARTIDA.body
  if (PARTIDA.atlas === 'grade') {
    if (Math.abs(ponto.x) > borda || Math.abs(ponto.z) > borda) return true
  } else if (Math.hypot(ponto.x, ponto.z) > borda) return true
  return bloqueios.some(
    (caixa) =>
      Math.abs(ponto.x - caixa.x) <= caixa.hx + PARTIDA.body &&
      Math.abs(ponto.z - caixa.z) <= caixa.hz + PARTIDA.body,
  )
}

function livre(gx: number, gz: number, bloqueios: readonly Bloqueio[], grade?: GradeBloqueios): boolean {
  return !bloqueia(gx, gz, bloqueios, grade)
}

export function encaixarLivre(
  gx: number,
  gz: number,
  bloqueios: readonly Bloqueio[],
  grade?: GradeBloqueios,
): [number, number] | null {
  if (livre(gx, gz, bloqueios, grade)) return [gx, gz]
  let melhor: [number, number] | null = null
  let melhorDist = Number.POSITIVE_INFINITY
  for (let raio = 1; raio <= PARTIDA.espiral; raio++) {
    for (let dx = -raio; dx <= raio; dx++) {
      for (let dz = -raio; dz <= raio; dz++) {
        if (Math.abs(dx) !== raio && Math.abs(dz) !== raio) continue
        const cx = gx + dx
        const cz = gz + dz
        if (!livre(cx, cz, bloqueios, grade)) continue
        const dist = dx * dx + dz * dz
        if (dist < melhorDist) {
          melhorDist = dist
          melhor = [cx, cz]
        }
      }
    }
    if (melhor) return melhor
  }
  return null
}

class Heap {
  private dados: { gx: number; gz: number; f: number }[] = []
  get tamanho(): number {
    return this.dados.length
  }
  por(no: { gx: number; gz: number; f: number }) {
    this.dados.push(no)
    let i = this.dados.length - 1
    while (i > 0) {
      const pai = (i - 1) >> 1
      if (this.dados[pai].f <= no.f) break
      this.dados[i] = this.dados[pai]
      i = pai
    }
    this.dados[i] = no
  }
  tira(): { gx: number; gz: number; f: number } | undefined {
    const topo = this.dados[0]
    const ultimo = this.dados.pop()
    if (this.dados.length > 0 && ultimo) {
      this.dados[0] = ultimo
      let i = 0
      while (true) {
        const esq = i * 2 + 1
        const dir = i * 2 + 2
        let menor = i
        if (esq < this.dados.length && this.dados[esq].f < this.dados[menor].f) menor = esq
        if (dir < this.dados.length && this.dados[dir].f < this.dados[menor].f) menor = dir
        if (menor === i) break
        const troca = this.dados[i]
        this.dados[i] = this.dados[menor]
        this.dados[menor] = troca
        i = menor
      }
    }
    return topo
  }
}

function segmentoLivre(
  a: Marco,
  b: Marco,
  bloqueios: readonly Bloqueio[],
  custoExtra?: (x: number, z: number) => number,
  grade?: GradeBloqueios,
  bloqueadoExtra?: (x: number, z: number) => boolean,
): boolean {
  for (let t = 0; t <= 8; t++) {
    const p = t / 8
    const x = a.x + (b.x - a.x) * p
    const z = a.z + (b.z - a.z) * p
    if (!livre(Math.round(x / PARTIDA.celula), Math.round(z / PARTIDA.celula), bloqueios, grade)) return false
    if (bloqueadoExtra && bloqueadoExtra(x, z)) return false
    if (custoExtra && custoExtra(x, z) > 1.01) return false
  }
  return true
}

function limitaAlvo(ponto: Marco): Marco {
  if (PARTIDA.atlas !== 'grade') return dentroDoDisco(ponto)
  const limite = PARTIDA.radius - PARTIDA.body
  return {
    x: Math.min(limite, Math.max(-limite, ponto.x)),
    z: Math.min(limite, Math.max(-limite, ponto.z)),
  }
}

function dentroDoDisco(ponto: Marco): Marco {
  const dist = Math.hypot(ponto.x, ponto.z)
  const limite = PARTIDA.radius - PARTIDA.body
  if (dist <= limite || dist === 0) return ponto
  const escala = limite / dist
  return { x: ponto.x * escala, z: ponto.z * escala }
}
function reconstruir(
  veio: Map<string, string>,
  fim: string,
  inicioGx: number,
  inicioGz: number,
  bloqueios: readonly Bloqueio[],
  custoExtra?: (x: number, z: number) => number,
  grade?: GradeBloqueios,
  bloqueadoExtra?: (x: number, z: number) => boolean,
): Marco[] {
  const bruto: [number, number][] = []
  let atual: string | undefined = fim
  while (atual) {
    const [gx, gz] = atual.split(',').map(Number)
    bruto.push([gx, gz])
    atual = veio.get(atual)
  }
  bruto.reverse()
  if (bruto.length > 0 && bruto[0][0] === inicioGx && bruto[0][1] === inicioGz) bruto.shift()
  const cheio = bruto.map(([gx, gz]) => centro(gx, gz))
  if (cheio.length <= 1) return cheio
  const liso: Marco[] = [cheio[0]]
  for (let i = 1; i < cheio.length - 1; i++) {
    const prev = liso[liso.length - 1]
    const cur = cheio[i]
    const prox = cheio[i + 1]
    const gx = Math.round(cur.x / PARTIDA.celula)
    const gz = Math.round(cur.z / PARTIDA.celula)
    const pg = Math.round(prev.x / PARTIDA.celula)
    const pzg = Math.round(prev.z / PARTIDA.celula)
    const ng = Math.round(prox.x / PARTIDA.celula)
    const nz = Math.round(prox.z / PARTIDA.celula)
    if (gx - pg !== ng - gx || gz - pzg !== nz - gz) liso.push(cur)
  }
  liso.push(cheio[cheio.length - 1])
  const origem = centro(inicioGx, inicioGz)
  const pontos = [origem, ...liso]
  for (let i = 1; i < pontos.length; i++) {
    if (!segmentoLivre(pontos[i - 1], pontos[i], bloqueios, custoExtra, grade, bloqueadoExtra)) return cheio
  }
  return liso
}

export function encontrarCaminho(
  x: number,
  z: number,
  alvoX: number,
  alvoZ: number,
  bloqueios: readonly Bloqueio[],
  custoExtra?: (x: number, z: number) => number,
  bloqueadoExtra?: (x: number, z: number) => boolean,
): Marco[] | null {
  if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(alvoX) || !Number.isFinite(alvoZ)) {
    return null
  }
  if ((bloqueios.length === 0 && !custoExtra && !bloqueadoExtra) || PARTIDA.caminho === 'reto') {
    return [limitaAlvo({ x: alvoX, z: alvoZ })]
  }

  contagemBuscas += 1
  const grade = construirGradeBloqueios(bloqueios, bloqueadoExtra)
  const celula = PARTIDA.celula
  let sgx = Math.round(x / celula)
  let sgz = Math.round(z / celula)
  let egx = Math.round(alvoX / celula)
  let egz = Math.round(alvoZ / celula)
  const saida = encaixarLivre(sgx, sgz, bloqueios, grade)
  const chegada = encaixarLivre(egx, egz, bloqueios, grade)
  if (!saida || !chegada) return null
  sgx = saida[0]
  sgz = saida[1]
  egx = chegada[0]
  egz = chegada[1]
  if (sgx === egx && sgz === egz) return [centro(egx, egz)]

  const gScore = new Map<string, number>()
  const veio = new Map<string, string>()
  const fechado = new Set<string>()
  const inicio = chave(sgx, sgz)
  const fim = chave(egx, egz)
  gScore.set(inicio, 0)
  const abertos = new Heap()
  abertos.por({ gx: sgx, gz: sgz, f: Math.hypot(sgx - egx, sgz - egz) })
  let visitas = 0
  while (abertos.tamanho > 0 && visitas < PARTIDA.maxVisitas) {
    visitas += 1
    const atual = abertos.tira()
    if (!atual) break
    const ck = chave(atual.gx, atual.gz)
    if (ck === fim) {
      visitasUltima = visitas
      return reconstruir(veio, ck, sgx, sgz, bloqueios, custoExtra, grade, bloqueadoExtra)
    }
    if (fechado.has(ck)) continue
    fechado.add(ck)
    const custo = gScore.get(ck) ?? 0
    for (const [dx, dz] of DIRECOES) {
      const nx = atual.gx + dx
      const nz = atual.gz + dz
      const nk = chave(nx, nz)
      if (fechado.has(nk) || !livre(nx, nz, bloqueios, grade)) continue
      if (dx !== 0 && dz !== 0) {
        if (!livre(atual.gx + dx, atual.gz, bloqueios, grade) || !livre(atual.gx, atual.gz + dz, bloqueios, grade)) continue
      }
      const pViz = centro(nx, nz)
      const pesoTerreno = custoExtra ? Math.max(1, custoExtra(pViz.x, pViz.z)) : 1
      const passo = (dx !== 0 && dz !== 0 ? Math.SQRT2 : 1) * pesoTerreno
      const novo = custo + passo
      const anterior = gScore.get(nk)
      if (anterior !== undefined && novo >= anterior) continue
      gScore.set(nk, novo)
      veio.set(nk, ck)
      abertos.por({ gx: nx, gz: nz, f: novo + Math.hypot(nx - egx, nz - egz) })
    }
  }
  visitasUltima = visitas
  return null
}
