import { LADO_RELEVO, MEIA_RELEVO, RELEVO_REGRAS, type CampoRelevo } from './campoRelevo'
import {
  ajustarAoTransitavel,
  alcanceComAltura,
  bonusAlcanceAltura,
  custoDecliveCaminho,
  fatorAltura,
  pontoEmRio,
  terrenoBloqueiaLinha,
} from './regrasDoRelevo'
import { aplicarPlataforma, podeAplainarObra } from './plataformas'
import { temLinhaDeVisaoNoRelevo } from './visibilidadeRelevo'

function assert(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem)
}

function criarCampoPlano(altura = 0): CampoRelevo {
  return {
    i: 0,
    j: 0,
    alturas: new Float32Array(LADO_RELEVO * LADO_RELEVO).fill(altura),
    nivelAgua: -0.075,
    versao: 1,
  }
}

function criarCampo(fn: (gx: number, gz: number) => number): CampoRelevo {
  const alturas = new Float32Array(LADO_RELEVO * LADO_RELEVO)
  for (let gz = -MEIA_RELEVO; gz <= MEIA_RELEVO; gz += 1) {
    for (let gx = -MEIA_RELEVO; gx <= MEIA_RELEVO; gx += 1) {
      alturas[(gz + MEIA_RELEVO) * LADO_RELEVO + (gx + MEIA_RELEVO)] = fn(gx, gz)
    }
  }
  return { i: 0, j: 0, alturas, nivelAgua: -0.075, versao: 1 }
}

export async function run(): Promise<void> {
  // 1. D5/D14: fatorAltura e alcanceComAltura nos extremos e NaN
  assert(Math.abs(fatorAltura(0) - 1) < 1e-9, 'dh = 0 mantém dano 1.0×')
  assert(Math.abs(fatorAltura(2) - 1.25) < 1e-9 && Math.abs(fatorAltura(10) - 1.25) < 1e-9, 'teto de +25% a partir de +2 m')
  assert(Math.abs(fatorAltura(-2) - 0.75) < 1e-9 && Math.abs(fatorAltura(-10) - 0.75) < 1e-9, 'piso de -25% a partir de -2 m')
  assert(fatorAltura(Number.NaN) === 1, 'NaN em fatorAltura devolve 1')

  assert(Math.abs(bonusAlcanceAltura(4) - 2) < 1e-9, '+4m de vantagem dá +2m de alcance')
  assert(Math.abs(bonusAlcanceAltura(20) - 4) < 1e-9 && Math.abs(bonusAlcanceAltura(-20) + 4) < 1e-9, 'limite de ±4m no alcance')
  assert(bonusAlcanceAltura(Number.NaN) === 0, 'NaN em bonusAlcanceAltura devolve 0')
  assert(alcanceComAltura(18, 6, 0) === 21, 'herói 6m acima alcança 21m (+3m além de 18m)')
  assert(alcanceComAltura(2, 0, 10) === 1, 'alcance nunca cai abaixo de 1m')

  // 2. I1: campo undefined preserva plano total
  assert(!terrenoBloqueiaLinha(undefined, 0, 0, 1.6, 20, 0, 0.9), 'sem campo não bloqueia LoS')
  assert(temLinhaDeVisaoNoRelevo(undefined, 0, 0, 20, 0), 'sem campo sempre há visão')
  assert(custoDecliveCaminho(undefined, 5, 5) === 1, 'sem campo custo é 1')
  assert(podeAplainarObra(undefined, 5, 5).ok === true, 'sem campo pode sempre construir')
  const adjSem = ajustarAoTransitavel(undefined, 5, 5)
  assert(adjSem.x === 5 && adjSem.z === 5, 'sem campo não move ponto')

  // 3. Morro entre observador e alvo bloqueia LoS e visão; plano não bloqueia
  const campoPlano = criarCampoPlano(0)
  assert(!terrenoBloqueiaLinha(campoPlano, -10, 0, 1.6, 10, 0, 0.9), 'campo plano livre de bloqueio')
  assert(temLinhaDeVisaoNoRelevo(campoPlano, -10, 0, 10, 0), 'campo plano tem LoS')

  const campoMorro = criarCampo((gx, gz) => (Math.hypot(gx, gz) < 4 ? 4.5 - Math.hypot(gx, gz) * 0.5 : 0))
  assert(terrenoBloqueiaLinha(campoMorro, -10, 0, 1.6, 10, 0, 0.9), 'morro no caminho bloqueia linha')
  assert(!temLinhaDeVisaoNoRelevo(campoMorro, -10, 0, 10, 0), 'morro bloqueia visão do relevo')

  // 4. Penhasco (declive > 0.75), rampa moderada (> 0.45) e ajustarAoTransitavel
  const penhasco = criarCampo((gx) => (gx <= 0 ? 0 : Math.min(12, gx * 1.4)))
  assert(!Number.isFinite(custoDecliveCaminho(penhasco, 3, 0)), 'declive > 0.75 é infinito no A*')
  const rampaModerada = criarCampo((gx) => gx * 0.6)
  const custoMod = custoDecliveCaminho(rampaModerada, 5, 0)
  assert(Number.isFinite(custoMod) && custoMod > 1, `declive 0.6 encarece A* (veio ${custoMod})`)
  const ajustado = ajustarAoTransitavel(penhasco, 3, 0, 8)
  assert(ajustado.x <= 0.5, `ajustarAoTransitavel sai do penhasco para zona plana (veio x=${ajustado.x})`)

  // 5. Plataformas: recusa em encosta íngreme, aceita e nivela em plano/suave
  assert(!podeAplainarObra(penhasco, 4, 0).ok, 'encosta íngreme recusa obra')
  const suaveCampo = criarCampo((gx) => gx * 0.15)
  assert(podeAplainarObra(suaveCampo, 0, 0).ok, 'encosta suave <= 0.35 aceita obra')
  const nivelado = aplicarPlataforma(suaveCampo, 10, 0, 4.2, 2.0)
  assert(nivelado.versao === suaveCampo.versao + 1, 'aplicarPlataforma incrementa versão imutavelmente')
  const hCentro = nivelado.alturas[(0 + MEIA_RELEVO) * LADO_RELEVO + (10 + MEIA_RELEVO)]
  const hBorda = nivelado.alturas[(0 + MEIA_RELEVO) * LADO_RELEVO + (13 + MEIA_RELEVO)]
  assert(Math.abs(hCentro - hBorda) < 1e-4, `plataforma nivela área interna da obra (${hCentro} vs ${hBorda})`)
  // Original permanece imutável
  assert(Math.abs(suaveCampo.alturas[(0 + MEIA_RELEVO) * LADO_RELEVO + (13 + MEIA_RELEVO)] - 1.95) < 1e-4, 'campo original não foi mutado')

  // 6. pontoEmRio seguro quando fora de rio ou índices indefinidos
  assert(!pontoEmRio(undefined, undefined, 0, 0), 'pontoEmRio com índices undefined retorna false')
  assert(RELEVO_REGRAS.declMaxAndar === 0.75 && RELEVO_REGRAS.declMaxObra === 0.35, 'constantes D4 preservadas')
}
