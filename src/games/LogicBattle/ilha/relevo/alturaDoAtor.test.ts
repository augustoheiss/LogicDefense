import { CAMERA_IMPERIO, posicaoCameraImperio, type CameraImperioState } from '../cameraImperio'
import { PARTIDA } from '../partidaPolicies'
import { Y_SOLO_VISUAL } from '../visual/suporteFundacao'
import { alturaEm, LADO_RELEVO, MEIA_RELEVO, type CampoRelevo } from './campoRelevo'
import { gerarRelevo } from './geradorRelevo'
import { cameraDoImperio, desnivelDoAtor, posicaoDaCamera1p, posicaoDaCamera3p } from './alturaDoAtor'

function assert(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem)
}

/** Gerador fixo (mulberry32): os pontos «aleatórios» do teste são REPRODUTÍVEIS. */
function semente(valor: number): () => number {
  let t = valor >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

/** Um campo cuja altura é uma FUNÇÃO CONHECIDA dos nós (gx, gz): o teste calcula o esperado À MÃO, sem passar pelo código sob teste. A interpolação bilinear é exata para funções lineares nos nós. */
function campoDe(altura: (gx: number, gz: number) => number): CampoRelevo {
  const alturas = new Float32Array(LADO_RELEVO * LADO_RELEVO)
  for (let gz = -MEIA_RELEVO; gz <= MEIA_RELEVO; gz += 1) {
    for (let gx = -MEIA_RELEVO; gx <= MEIA_RELEVO; gx += 1) alturas[(gz + MEIA_RELEVO) * LADO_RELEVO + (gx + MEIA_RELEVO)] = altura(gx, gz)
  }
  return { i: 0, j: 0, alturas, nivelAgua: -0.4, versao: 1 }
}

const PLANO = campoDe(() => 0)
/** Rampa em x, declive 0,5 (m por m): em x = 10 a altura é 5; em x = −4, −2. Múltiplos de 0,5 cabem no Float32 sem erro. A rampa só depende de x. */
const RAMPA = campoDe((gx) => 0.5 * gx)
/** Planalto de 3 m a leste de x = 11 (entre x = 10 e 11 a malha SOBE de 0 a 3: um declive de 3, como o do pior ponto do relevo real). */
const PLANALTO = campoDe((gx) => (gx >= 11 ? 3 : 0))
/** Um paredão de 100 m (declive 100): o ÚNICO jeito de ter um salto grande em 0,05 m numa grade de 1 m. Serve de controle positivo do medidor de salto. */
const PAREDAO = campoDe((gx) => (gx >= 11 ? 100 : 0))
/** O centro do quadrado é ALTO (2 m em todo ponto): onde `alturaEm` prende NaN e infinito. Uma posição corrompida não pode aparecer elevada. */
const CENTRO_ALTO = campoDe(() => 2)

type V3 = { x: number; y: number; z: number }

/** A câmera de 3ª pessoa de HOJE, escrita por extenso (copiada de `IlhaRua.tsx`, sem relevo): a referência bit a bit. NÃO chama o código sob teste. */
function camera3pDeHoje(ator: V3, olhar: V3, yaw: number, dist: number): { pos: V3; alvo: V3 } {
  const ombro = Math.min(0.8, dist * 0.14)
  const direitaX = -Math.cos(yaw)
  const direitaZ = -Math.sin(yaw)
  const camX = ator.x - olhar.x * dist + direitaX * ombro
  const camY = PARTIDA.eyeY + ator.y - olhar.y * dist
  const camZ = ator.z - olhar.z * dist + direitaZ * ombro
  return { pos: { x: camX, y: camY, z: camZ }, alvo: { x: camX + olhar.x, y: camY + olhar.y, z: camZ + olhar.z } }
}

function olharDe(yaw: number, pitch: number): V3 {
  return { x: -Math.sin(yaw) * Math.cos(pitch), y: Math.sin(pitch), z: Math.cos(yaw) * Math.cos(pitch) }
}

function iguais(a: V3, b: V3): boolean {
  return Object.is(a.x, b.x) && Object.is(a.y, b.y) && Object.is(a.z, b.z)
}

/**
 * O ATOR E A CÂMERA SOBRE O RELEVO (F2, Task 5 + 7, 25/11/2026). Lógica PURA, testada no Node.
 *
 * O herói, os heróis secundários, as tropas, o dragão e a câmera são DESENHADOS no plano de hoje (`y = 0,9 + heroi.y`) e atravessam o morro. A regra do desenho é `y_novo = y_de_hoje + desnivel(x, z)`, com
 * desnível 0 sem campo (I1). A SIMULAÇÃO NÃO muda (I2): `heroi.y` segue «altura sobre o chão local»; só o desenho soma o terreno (a colisão no relevo é a F3, com o «ok» do usuário).
 *
 * Duas decisões MEDIDAS no gerador real (169 quadrados, `medir-heroi-na-agua-e-declive.mjs`): (1) o ator segue o CHÃO, NÃO a lâmina d'água (seguir a lâmina dá um degrau mediano de 0,96 m, até 2,04 m, na
 * margem de 100 % das lagoas e a câmera teleportaria); (2) no SUBSOLO (`y < −0,9`) o desnível é 0, porque a galeria da mina é desenhada em altura ABSOLUTA e não lê o campo.
 */
export function run(): void {
  const rng = semente(20261125)

  // ── (1) I1: SEM CAMPO o desnível é +0 EXATO, para qualquer entrada, até a corrompida ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  for (const [x, z, y] of [[0, 0, 0], [12.5, -7.25, 0], [-55.9, 55.9, 1.2], [3, 4, -3.2], [Number.NaN, 0, 0], [0, Number.POSITIVE_INFINITY, 0], [0, 0, Number.NaN]] as const) {
    assert(Object.is(desnivelDoAtor(undefined, x, z, y), 0), `sem campo o desnível do ator é +0 exato em (${x}, ${z}, y=${y})`)
  }

  // ── (2) COM campo, em terra e no ar: a altura do campo no ponto (a MESMA que o terreno desenhado usa), calculada à mão ─────────────────────────────────────────────────────────────────────────────────────
  assert(desnivelDoAtor(RAMPA, 10, 0, 0) === 5, 'rampa 0,5: em x = 10 o ator sobe 5 m')
  assert(desnivelDoAtor(RAMPA, -4, 7, 0) === -2, 'rampa 0,5: em x = −4 (vale) o ator DESCE 2 m')
  assert(Math.abs(desnivelDoAtor(RAMPA, 10.5, 3, 0) - 5.25) < 1e-6, 'a interpolação entre nós vale: x = 10,5 dá 5,25')
  assert(desnivelDoAtor(RAMPA, 10, 0, 2.5) === 5, 'no AR (y = 2,5, num pulo) o ator ainda soma o terreno do ponto onde está')
  assert(desnivelDoAtor(PLANO, 10, 0, 0) === 0, 'campo plano: 0')
  assert(desnivelDoAtor(RAMPA, 0, 10, 0) === 0, 'a rampa depende de x, não de z: (0, 10) dá 0 (x e z não estão trocados)')

  // ── (3) SUBSOLO: y < −0,9 (ESTRITO, a regra do jogo) → desnível 0 em QUALQUER campo ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  assert(desnivelDoAtor(RAMPA, 10, 0, -3.2) === 0, 'na mina (y = pisoY −3,2) o desnível é 0: a galeria é desenhada em altura absoluta')
  assert(desnivelDoAtor(RAMPA, 10, 0, -0.9000001) === 0, 'y = −0,9000001 já é subsolo')
  assert(desnivelDoAtor(RAMPA, 10, 0, -0.9) === 5, 'y = −0,9 EXATO NÃO é subsolo (a regra do jogo é estritamente menor): segue o terreno')
  assert(desnivelDoAtor(RAMPA, 10, 0, Number.NaN) === 5, 'y = NaN não é subsolo (a comparação com NaN é falsa): segue o terreno, como `alturaDeReferencia`')

  // ── (4) POSIÇÃO NÃO FINITA com campo: 0 (o plano de hoje), NÃO a altura do centro do quadrado ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
  for (const [x, z] of [[Number.NaN, 0], [0, Number.NaN], [Number.POSITIVE_INFINITY, 1], [1, Number.NEGATIVE_INFINITY]] as const) {
    assert(desnivelDoAtor(CENTRO_ALTO, x, z, 0) === 0, `posição não finita (${x}, ${z}) devolve 0, não a altura do centro do quadrado (2)`)
  }
  assert(desnivelDoAtor(CENTRO_ALTO, 1, 1, 0) === 2, 'controle POSITIVO: no mesmo campo, um ponto finito sobe 2 m (o teste acima enxerga a diferença)')

  // ── (5) CÂMERA DE 1ª PESSOA: posição e alvo sobem JUNTOS; sem campo é a fórmula de hoje, bit a bit ─────────────────────────────────────────────────────────────────────────────────────────────────────────
  {
    const olhar = { x: 0.3, y: -0.2, z: 0.9 }
    const hoje = posicaoDaCamera1p(undefined, { x: 3, y: 0.5, z: 4 }, olhar)
    assert(Object.is(hoje.pos.x, 3) && Object.is(hoje.pos.y, PARTIDA.eyeY + 0.5) && Object.is(hoje.pos.z, 4), 'sem campo a posição da 1ª pessoa é (atorX, eyeY + atorY, atorZ)')
    assert(Object.is(hoje.alvo.x, 3 + 0.3) && Object.is(hoje.alvo.y, PARTIDA.eyeY + 0.5 + -0.2) && Object.is(hoje.alvo.z, 4 + 0.9), 'sem campo o alvo da 1ª pessoa é a posição somada ao olhar, como hoje')
    const naRampa = posicaoDaCamera1p(RAMPA, { x: 10, y: 0, z: 0 }, olhar)
    assert(naRampa.pos.y === PARTIDA.eyeY + 5, 'na rampa (x = 10) o olho sobe 5 m com o terreno')
    assert(Math.abs(naRampa.alvo.y - (PARTIDA.eyeY + 5 + -0.2)) < 1e-12, 'e o alvo sobe os MESMOS 5 m')
    assert(Math.abs(naRampa.alvo.y - naRampa.pos.y - olhar.y) < 1e-12, 'a inclinação do olhar (alvo − posição) é a mesma com e sem relevo')
    assert(naRampa.pos.x === 10 && naRampa.pos.z === 0, 'o relevo só mexe na altura')
    const naMina = posicaoDaCamera1p(RAMPA, { x: 10, y: -3.2, z: 0 }, olhar)
    const naMinaHoje = posicaoDaCamera1p(undefined, { x: 10, y: -3.2, z: 0 }, olhar)
    assert(iguais(naMina.pos, naMinaHoje.pos) && iguais(naMina.alvo, naMinaHoje.alvo), 'na mina a câmera de 1ª pessoa é a de hoje, bit a bit, mesmo com campo')
  }

  // ── (6) CÂMERA DE 3ª PESSOA ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  // (6a) I1: SEM CAMPO é EXATAMENTE a fórmula de hoje (300 casos, igualdade bit a bit; 1 caso em 5 no subsolo)
  for (let n = 0; n < 300; n += 1) {
    const yaw = (rng() - 0.5) * 7
    const pitch = (rng() - 0.5) * 1.2
    const ator = { x: (rng() - 0.5) * 100, y: n % 5 === 0 ? -3.2 : rng() * 3, z: (rng() - 0.5) * 100 }
    const dist = 1.15 + rng() * 5.35
    const olhar = olharDe(yaw, pitch)
    const r = posicaoDaCamera3p(undefined, ator, olhar, yaw, dist)
    const h = camera3pDeHoje(ator, olhar, yaw, dist)
    assert(iguais(r.pos, h.pos), `3ª pessoa sem campo (caso ${n}): posição IDÊNTICA à de hoje, bit a bit`)
    assert(iguais(r.alvo, h.alvo), `3ª pessoa sem campo (caso ${n}): alvo IDÊNTICO ao de hoje, bit a bit`)
  }
  // (6b) o ator numa rampa: a câmera sobe com a altura do chão do ATOR (não a do chão sob a câmera) e o enquadramento não muda
  {
    const olhar = { x: 0, y: 0, z: 1 }
    const ator = { x: 10, y: 0, z: 0 }
    const r = posicaoDaCamera3p(RAMPA, ator, olhar, 0, 6.5)
    const h = camera3pDeHoje(ator, olhar, 0, 6.5)
    assert(Math.abs(r.pos.y - (h.pos.y + 5)) < 1e-9, `rampa: a câmera sobe 5 m, o chão do ATOR (esperado ${h.pos.y + 5}, veio ${r.pos.y}); o chão sob a câmera (4,6 m) NÃO decide`)
    assert(Math.abs(r.alvo.y - r.pos.y - (h.alvo.y - h.pos.y)) < 1e-12, 'rampa: o enquadramento (alvo − posição) é o de hoje')
    assert(r.pos.x === h.pos.x && r.pos.z === h.pos.z, 'o relevo só mexe na altura da câmera')
  }
  // (6c) O PISO. O ator está em x = 8, olhando para −x (yaw = π/2): a câmera fica 6,5 m ATRÁS, em x ≈ 14,5, sobre o planalto de 3 m (chão em −0,45 + 3 = 2,55). Hoje ela ficaria em 1,6: DENTRO do planalto.
  {
    const yaw = Math.PI / 2
    const olhar = olharDe(yaw, 0)
    const ator = { x: 8, y: 0, z: 0 }
    const r = posicaoDaCamera3p(PLANALTO, ator, olhar, yaw, 6.5)
    const chaoSobACamera = Y_SOLO_VISUAL + alturaEm(PLANALTO, r.pos.x, r.pos.z)
    assert(r.pos.x > 13 && Math.abs(chaoSobACamera - (Y_SOLO_VISUAL + 3)) < 1e-9, `o teste monta o caso certo: a câmera cai sobre o planalto (x = ${r.pos.x.toFixed(2)}, chão ${chaoSobACamera.toFixed(3)})`)
    assert(camera3pDeHoje(ator, olhar, yaw, 6.5).pos.y < chaoSobACamera, 'controle POSITIVO: sem o piso a câmera ficaria DENTRO do planalto (1,6 < 2,55): o teste enxerga o defeito')
    assert(r.pos.y >= chaoSobACamera + 0.6 - 1e-9, `a câmera NÃO fura o chão: y = ${r.pos.y.toFixed(3)} ≥ chão + 0,6 = ${(chaoSobACamera + 0.6).toFixed(3)}`)
    assert(Math.abs(r.pos.y - (chaoSobACamera + 0.6)) < 1e-9, `e fica EXATAMENTE no piso (não flutua acima dele): y = ${r.pos.y.toFixed(3)}`)
    assert(Math.abs(r.alvo.y - r.pos.y - olhar.y) < 1e-12 && Math.abs(r.alvo.x - r.pos.x - olhar.x) < 1e-12, 'o piso empurra a câmera para cima, mas a DIREÇÃO do olhar é a mesma (alvo = posição + olhar)')
  }
  // (6d) o piso não é um «sempre sobe»: em campo plano, com o ator no solo, a câmera fica onde a fórmula de hoje a põe
  {
    const r = posicaoDaCamera3p(PLANO, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, 0, 6.5)
    assert(r.pos.y === PARTIDA.eyeY, `campo PLANO: a câmera fica em eyeY (${PARTIDA.eyeY}), sem piso a empurrar`)
  }
  // (6e) o piso em 1000 posições e olhares aleatórios de um relevo REAL (a tundra, o mais forte, amplitude 5,1 m): nunca a menos de 0,6 m do chão
  const tundra = gerarRelevo(-1, -3)
  {
    let piorFolga = Infinity
    for (let n = 0; n < 1000; n += 1) {
      const yaw = (rng() - 0.5) * 6.4
      const ator = { x: (rng() - 0.5) * 100, y: rng() < 0.3 ? rng() * 2.5 : 0, z: (rng() - 0.5) * 100 }
      const r = posicaoDaCamera3p(tundra, ator, olharDe(yaw, (rng() - 0.5) * 1.3), yaw, 1.15 + rng() * 5.35)
      const folga = r.pos.y - (Y_SOLO_VISUAL + alturaEm(tundra, r.pos.x, r.pos.z))
      if (folga < piorFolga) piorFolga = folga
    }
    assert(piorFolga >= 0.6 - 1e-9, `na tundra (relevo real) a câmera nunca fica a menos de 0,6 m do chão: pior folga = ${piorFolga.toFixed(4)}`)
  }
  // (6f) SEM AMPLIFICAR: andar 0,05 m move a câmera NO MÁXIMO o quanto o chão se move entre os 4 pontos envolvidos (o ator e a câmera, antes e depois). A câmera é a maior de duas funções do chão, e o salto
  //      de um máximo nunca passa do maior salto das duas. Um atraso ou um ganho aplicado ao relevo violaria isto.
  {
    let maiorExcesso = -Infinity
    for (let n = 0; n < 4000; n += 1) {
      const yaw = (rng() - 0.5) * 6.4
      const olhar = olharDe(yaw, (rng() - 0.5) * 1.3)
      const x0 = (rng() - 0.5) * 100
      const z0 = (rng() - 0.5) * 100
      const a0 = { x: x0, y: 0, z: z0 }
      const a1 = { x: x0 + 0.05 * Math.cos(yaw), y: 0, z: z0 + 0.05 * Math.sin(yaw) }
      const c0 = posicaoDaCamera3p(tundra, a0, olhar, yaw, 6.5)
      const c1 = posicaoDaCamera3p(tundra, a1, olhar, yaw, 6.5)
      const chao = [alturaEm(tundra, a0.x, a0.z), alturaEm(tundra, a1.x, a1.z), alturaEm(tundra, c0.pos.x, c0.pos.z), alturaEm(tundra, c1.pos.x, c1.pos.z)]
      const amplitude = Math.max(...chao) - Math.min(...chao)
      const excesso = Math.abs(c1.pos.y - c0.pos.y) - amplitude
      if (excesso > maiorExcesso) maiorExcesso = excesso
    }
    assert(maiorExcesso <= 1e-9, `a câmera NUNCA salta mais que o desnível do trecho (pior excesso ${maiorExcesso.toExponential(2)})`)
    // controle POSITIVO: num paredão de 100 m o piso SALTA 5 m em 0,05 m de caminhada, e o MESMO medidor o vê (o instrumento não é cego)
    const olhar = olharDe(Math.PI / 2, 0)
    const antes = posicaoDaCamera3p(PAREDAO, { x: 4.4, y: 0, z: 0 }, olhar, Math.PI / 2, 6.5)
    const depois = posicaoDaCamera3p(PAREDAO, { x: 4.35, y: 0, z: 0 }, olhar, Math.PI / 2, 6.5)
    assert(Math.abs(depois.pos.y - antes.pos.y) > 4.9, `controle POSITIVO: no paredão, andar 0,05 m move a câmera ${Math.abs(depois.pos.y - antes.pos.y).toFixed(2)} m (esperado ~5)`)
  }
  // (6g) ENTRADA CORROMPIDA: com um campo cujo CENTRO é alto (onde `alturaEm` prende NaN e infinito) a câmera é IDÊNTICA à de hoje, componente por componente (NaN onde hoje é NaN): o relevo não fabrica altura nem NaN
  for (const [ator, olhar, dist] of [
    [{ x: Number.NaN, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, 6.5],
    [{ x: 0, y: Number.NaN, z: 0 }, { x: 0, y: 0, z: 1 }, 6.5],
    [{ x: 0, y: 0, z: Number.POSITIVE_INFINITY }, { x: 0, y: 0, z: 1 }, 6.5],
    [{ x: 5, y: 0, z: 5 }, { x: 0, y: 0, z: 1 }, Number.NaN],
  ] as const) {
    const hoje = posicaoDaCamera3p(undefined, ator, olhar, 0, dist)
    const rel = posicaoDaCamera3p(CENTRO_ALTO, ator, olhar, 0, dist)
    assert(iguais(rel.pos, hoje.pos) && iguais(rel.alvo, hoje.alvo), `entrada corrompida (${ator.x}, ${ator.y}, ${ator.z}, dist ${dist}): a câmera com relevo é a de hoje, componente por componente`)
  }
  // (6h) NO SUBSOLO a câmera é a de hoje, bit a bit, mesmo com campo: a caverna é desenhada em altura absoluta e um piso de relevo a arrancaria dela (num campo cujo chão passa de 5 m)
  for (const dist of [2.25, 4]) {
    const ator = { x: 10, y: -3.2, z: 0 }
    const olhar = olharDe(0.4, 0.1)
    const r = posicaoDaCamera3p(RAMPA, ator, olhar, 0.4, dist)
    const h = camera3pDeHoje(ator, olhar, 0.4, dist)
    assert(iguais(r.pos, h.pos) && iguais(r.alvo, h.alvo), `no subsolo (dist ${dist}) a câmera com relevo é a de hoje, bit a bit`)
  }
  // (6i) A FRONTEIRA do subsolo vale TAMBÉM para o piso, e é a mesma de `desnivelDoAtor` (estritamente menor): em y = −0,9 EXATO o ator está na SUPERFÍCIE, então o piso age; em −0,9000001 está no subsolo e não age.
  //      Mesmo campo e mesma pose: a única diferença é o `y`. Fechou o mutante C11 (`<=` no piso), que sobreviveu na 1ª rodada: nenhum teste olhava a câmera exatamente na fronteira.
  {
    const yaw = Math.PI / 2
    const olhar = olharDe(yaw, 0)
    const naFronteira = posicaoDaCamera3p(PLANALTO, { x: 8, y: -0.9, z: 0 }, olhar, yaw, 6.5)
    const chaoSob = Y_SOLO_VISUAL + alturaEm(PLANALTO, naFronteira.pos.x, naFronteira.pos.z)
    assert(Math.abs(naFronteira.pos.y - (chaoSob + 0.6)) < 1e-9, `y = −0,9 EXATO é superfície: o piso age (câmera em ${naFronteira.pos.y.toFixed(3)}, piso ${(chaoSob + 0.6).toFixed(3)})`)
    const dentro = posicaoDaCamera3p(PLANALTO, { x: 8, y: -0.9000001, z: 0 }, olhar, yaw, 6.5)
    const hDentro = camera3pDeHoje({ x: 8, y: -0.9000001, z: 0 }, olhar, yaw, 6.5)
    assert(iguais(dentro.pos, hDentro.pos), 'y = −0,9000001 já é subsolo: a câmera é a de hoje, sem piso (a caverna é absoluta)')
  }

  // ── (7) CÂMERA DO IMPÉRIO: a câmera INTEIRA (posição e alvo) sobe com o chão sob o alvo, e o ângulo e a escala não mudam. Sem campo é a de hoje, bit a bit ──────────────────────────────────────────────────
  for (let n = 0; n < 100; n += 1) {
    const cam: CameraImperioState = { x: (rng() - 0.5) * 100, z: (rng() - 0.5) * 100, yaw: (rng() - 0.5) * 6.4, zoom: n % 2 === 0 ? CAMERA_IMPERIO.zoomMin + rng() * 1.2 : undefined }
    const v = cameraDoImperio(undefined, cam)
    const hoje = posicaoCameraImperio(cam)
    assert(iguais(v.pos, hoje), `Império sem campo (caso ${n}): a posição é a de hoje, bit a bit`)
    assert(Object.is(v.alvo.x, cam.x) && Object.is(v.alvo.y, 0) && Object.is(v.alvo.z, cam.z), `Império sem campo (caso ${n}): o alvo é (cam.x, +0, cam.z), como o \`lookAt\` de hoje`)
  }
  {
    const cam: CameraImperioState = { x: 10, z: 0, yaw: 0.7, zoom: 1.3 }
    const v = cameraDoImperio(RAMPA, cam)
    const hoje = posicaoCameraImperio(cam)
    assert(v.alvo.y === 5 && v.alvo.x === 10 && v.alvo.z === 0, 'na rampa (x = 10) o Império olha o chão a 5 m')
    assert(Math.abs(v.pos.y - (hoje.y + 5)) < 1e-9 && v.pos.x === hoje.x && v.pos.z === hoje.z, 'e a câmera sobe os MESMOS 5 m (rígida): só a altura muda')
    assert(Math.abs(v.pos.y - v.alvo.y - hoje.y) < 1e-9, 'o ângulo e a distância são os de hoje (a altura da câmera sobre o alvo não muda): o morro não «respira» a imagem')
    const vale = cameraDoImperio(RAMPA, { x: -4, z: 3, yaw: 0 })
    assert(vale.alvo.y === -2 && Math.abs(vale.pos.y - (posicaoCameraImperio({ x: -4, z: 3, yaw: 0 }).y - 2)) < 1e-9, 'num vale de 2 m a câmera inteira DESCE 2 m')
    const corrompida = cameraDoImperio(CENTRO_ALTO, { x: Number.NaN, z: 3, yaw: 0 })
    assert(corrompida.alvo.y === 0, 'cam.x NaN: o Império olha o plano (0), não o centro do quadrado (2)')
  }
}
