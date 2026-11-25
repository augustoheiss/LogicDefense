/**
 * O campo de altura de UM quadrado do mundo (24/11/2026): uma grade 113×113, de 1 m, a MESMA do `chaoVisto` e do A* (`MEIA_CHAO = 56`, `LADO_CHAO = 113`). Alinhar as três grades
 * faz a névoa, o caminho e o terreno falarem do mesmo ponto sem conversão.
 *
 * Convenção da altura: metros acima do nível da rua (que é 0). Valores negativos são vales e bacias. O campo ausente (`undefined`) significa «chão plano» e devolve 0 em tudo:
 * é o invariante I1 («relevo desligado = o jogo de hoje»). Nenhuma função daqui lê `Math.random` ou `Date`.
 */

/** Células por lado: 2·56 + 1 = 113, de −56 a +56 inclusive (as bordas dos quadrados vizinhos coincidem, I3). */
export const LADO_RELEVO = 113
export const MEIA_RELEVO = 56

export interface CampoRelevo {
  readonly i: number
  readonly j: number
  /** `(gz + 56) · 113 + (gx + 56)`, em metros acima da rua. */
  readonly alturas: Float32Array
  /** Altura da superfície da água nas lagoas deste quadrado (o leito fica 0,5–0,9 m abaixo). */
  readonly nivelAgua: number
  /** Sobe a cada mudança do campo (plataformas, em F3); chave de cache das grades derivadas. */
  readonly versao: number
}

/**
 * As regras do relevo que o usuário aprovou em 24/11 (D4, D8, D15). `declMax*` são declives (subida/avanço, 0,75 ≈ 37°). Em F0/F1/F2 NADA do jogo lê estes limiares: eles só entram
 * na simulação em F3, com o «ok» separado do usuário.
 */
export const RELEVO_REGRAS = {
  declMaxAndar: 0.75,
  declMaxObra: 0.35,
  declMaxBloco: 0.18,
  /** Largura (m) da janela de passagem plana nas arestas, para a tropa (que só cruza com x ≥ 54,6) e o herói sempre terem por onde atravessar. */
  janelaPassagem: 14,
  /** Distância (m) entre janelas ao longo de uma aresta. */
  passoJanela: 28,
  /** Raio (m) do disco plano em volta da base inimiga (a base cresce sem teto hoje; ver D15). */
  raioBaseInimiga: 14,
  /** Raio (m) do claro plano em (0, 0), onde o herói nasce (`heroiInicial`). Sem a praça da rua (que saiu em 25/11) é o menor chão plano que cobre o corpo (raio 0,35) com folga. Decisão minha; o usuário veta. */
  claroDeNascimento: 3.5,
} as const

function dentro(valor: number): number {
  if (!Number.isFinite(valor)) return 0
  return valor < -MEIA_RELEVO ? -MEIA_RELEVO : valor > MEIA_RELEVO ? MEIA_RELEVO : valor
}

function no(campo: CampoRelevo, gx: number, gz: number): number {
  return campo.alturas[(gz + MEIA_RELEVO) * LADO_RELEVO + (gx + MEIA_RELEVO)]
}

/** Altura em `(x, z)` por interpolação bilinear. Sem campo, 0. Fora do quadrado ou NaN, prende na borda (nunca lê fora do array). */
export function alturaEm(campo: CampoRelevo | undefined, x: number, z: number): number {
  if (!campo) return 0
  const px = dentro(x)
  const pz = dentro(z)
  const gx = Math.min(MEIA_RELEVO - 1, Math.floor(px))
  const gz = Math.min(MEIA_RELEVO - 1, Math.floor(pz))
  const fx = px - gx
  const fz = pz - gz
  const a = no(campo, gx, gz) * (1 - fx) + no(campo, gx + 1, gz) * fx
  const b = no(campo, gx, gz + 1) * (1 - fx) + no(campo, gx + 1, gz + 1) * fx
  return a * (1 - fz) + b * fz
}

/** Declive local `|∇h|` (metro de subida por metro andado), por diferença central de 1 m. Sem campo, 0. */
export function inclinacaoEm(campo: CampoRelevo | undefined, x: number, z: number): number {
  if (!campo) return 0
  const dx = (alturaEm(campo, x + 0.5, z) - alturaEm(campo, x - 0.5, z)) / 1
  const dz = (alturaEm(campo, x, z + 0.5) - alturaEm(campo, x, z - 0.5)) / 1
  return Math.hypot(dx, dz)
}

/** Normal unitária da superfície `(nx, ny, nz)`. Sem campo, `(0, 1, 0)`. */
export function normalEm(campo: CampoRelevo | undefined, x: number, z: number): [number, number, number] {
  if (!campo) return [0, 1, 0]
  const dx = alturaEm(campo, x + 0.5, z) - alturaEm(campo, x - 0.5, z)
  const dz = alturaEm(campo, x, z + 0.5) - alturaEm(campo, x, z - 0.5)
  const m = Math.hypot(dx, 1, dz)
  return [-dx / m, 1 / m, -dz / m]
}

/** Dá para andar aqui? `declive ≤ declMax` (padrão `declMaxAndar`). Sem campo, sempre verdadeiro (I1). */
export function transitavelEm(
  campo: CampoRelevo | undefined,
  x: number,
  z: number,
  declMax: number = RELEVO_REGRAS.declMaxAndar,
): boolean {
  if (!campo) return true
  return inclinacaoEm(campo, x, z) <= declMax
}
