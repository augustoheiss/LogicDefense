import { FATOR_POR_NIVEL } from './evolucaoObra'
import { FIGURAS_ENEM } from './estudo/bancos/figurasEnem.manifest'
import { META_INTENCOES } from './ilhaIcones'
import { generateInfiniteChallenge } from './infiniteMathEngine'
import {
  custoUpgradeEra,
  fatorDanoForja,
  fatorHpAlvenaria,
  fatorVelBotas,
  multiplicadorTrianguloAoE,
  PARTIDA,
} from './partidaPolicies'
import {
  comprarUpgradeEra,
  createPartida,
  danoContatoInimigosNoHeroi,
  definirFormacao,
  evoluirInimigo,
  fundar,
  pontosFormacaoTropa,
  stepPartida,
  type PartidaState,
} from './partidaSim'
import { carregarPackExternoUltra } from './visual/texturasPbrProcedural'

function assert(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem)
}

const VAZIO = { forward: false, back: false, strafe: 0 as const }

function mediaDistanciasEntre(pts: readonly { x: number; z: number }[]): number {
  let soma = 0
  let contagem = 0
  for (let i = 0; i < pts.length; i += 1) {
    for (let j = i + 1; j < pts.length; j += 1) {
      soma += Math.hypot(pts[i].x - pts[j].x, pts[i].z - pts[j].z)
      contagem += 1
    }
  }
  return contagem > 0 ? soma / contagem : 0
}

export async function run() {
  // 1. Triângulo AoE
  assert(multiplicadorTrianguloAoE('arqueiro', 'horda') === 1.3, 'arqueiro +30% vs horda')
  assert(multiplicadorTrianguloAoE('lanceiro', 'sitiante') === 1.35, 'lanceiro +35% vs sitiante')
  assert(multiplicadorTrianguloAoE('lanceiro', 'dragao') === 1.35, 'lanceiro +35% vs dragao')
  assert(multiplicadorTrianguloAoE('torre', 'soldado') === 0.75, 'soldado -25% vs torre')
  assert(multiplicadorTrianguloAoE('arqueiro', 'soldado') === 0.75, 'soldado -25% vs arqueiro')
  assert(multiplicadorTrianguloAoE('inimigo_dragao', 'soldado') === 0.75, 'soldado -25% vs dragao')
  assert(multiplicadorTrianguloAoE('soldado', 'horda') === 1.0, 'soldado 1x vs horda')

  // Arqueiro em busca automática causa +30% contra horda em combate real via stepPartida
  {
    const base = createPartida(0, 0)
    const sArq: PartidaState = {
      ...base,
      obras: [],
      heroi: { ...base.heroi, x: -40, z: -40 },
      heroiPostura: 'calado',
      unidades: [
        { id: 801, lado: 'aliado', papel: 'tropa', tipoTropa: 'arqueiro', x: 0, z: 10, hp: 20, postura: 'automatico', ordem: null, cooldown: 0, segmentos: [], alerta: false },
        { id: 802, lado: 'inimigo', papel: 'horda', x: 0, z: 15, hp: 20, postura: 'calado', ordem: null, cooldown: 99, segmentos: [], alerta: false },
      ],
    }
    const depois = stepPartida(sArq, VAZIO, 0.05)
    const horda = depois.unidades.find((u) => u.id === 802)!
    // danoBase arqueiro = 5 * 1.3 (vs horda) = 6.5
    assert(Math.abs(horda.hp - 13.5) < 0.01, `esperava hp 13.5 com bônus +30% vs horda, veio ${horda.hp}`)
  }

  // 2. Formações de Tropa (linha, caixa, dispersa)
  {
    const caixa = pontosFormacaoTropa(0, 0, 9, [], [], undefined, 'caixa')
    const dispersa = pontosFormacaoTropa(0, 0, 9, [], [], undefined, 'dispersa')
    const linha = pontosFormacaoTropa(0, 0, 6, [], [], undefined, 'linha')
    assert(caixa.length === 9 && dispersa.length === 9 && linha.length === 6, 'tamanhos corretos de formação')
    const distCaixa = mediaDistanciasEntre(caixa)
    const distDispersa = mediaDistanciasEntre(dispersa)
    assert(distDispersa > distCaixa * 1.5, `formação dispersa (${distDispersa.toFixed(2)}) deveria ser bem maior que caixa (${distCaixa.toFixed(2)})`)
    const zMin = Math.min(...linha.map((p) => p.z))
    const zMax = Math.max(...linha.map((p) => p.z))
    assert(zMax - zMin < 0.1, 'formação linha com 6 tropas deve alinhar horizontalmente em Z')
  }

  // 3. Upgrades de Era (Forja, Alvenaria, Botas) + definirFormacao
  {
    let st = createPartida(0, 0)
    st = fundar(st, 'nucleo', 5, 0)
    const nucleoInicial = st.obras.find((o) => o.lado === 'nosso' && o.tipo === 'nucleo')!
    assert(nucleoInicial, 'núcleo aliado fundado em (5,0)')
    st = { ...st, ouro: 50, madeira: 50 }
    st = definirFormacao(st, 'dispersa')
    assert(st.formacao === 'dispersa', 'formação dispersa definida')

    const custoForja = custoUpgradeEra('forja', 0)
    st = comprarUpgradeEra(st, 'forja')
    assert(st.upgradesEra?.forja === 1, 'forja Nv.1')
    assert(st.ouro === 50 - custoForja.ouro && st.madeira === 50 - custoForja.madeira, 'custos forja descontados')
    assert(Math.abs(fatorDanoForja(st.upgradesEra) - 1.2) < 1e-6, 'fator forja 1.2')

    st = comprarUpgradeEra(st, 'alvenaria')
    const nucleoPos = st.obras.find((o) => o.id === nucleoInicial.id)!
    assert(Math.abs(fatorHpAlvenaria(st.upgradesEra) - 1.3) < 1e-6, 'fator alvenaria 1.3')
    assert(nucleoPos.maxHp === Math.round(nucleoInicial.maxHp * 1.3), 'HP máximo do núcleo escalado por Alvenaria')

    st = comprarUpgradeEra(st, 'botas')
    assert(Math.abs(fatorVelBotas(st.upgradesEra) - 1.15) < 1e-6, 'fator botas 1.15')

    st = comprarUpgradeEra(st, 'botas')
    st = comprarUpgradeEra(st, 'botas')
    const ouroNoMax = st.ouro
    st = comprarUpgradeEra(st, 'botas')
    assert(st.upgradesEra?.botas === 3 && st.ouro === ouroNoMax, 'respeita nível máximo 3')
  }

  // 4. Contato de Sitiante/Dragão no Herói + redução do Tanque e invulnerabilidade
  {
    const base = createPartida(0, 0)
    const stSitiante: PartidaState = {
      ...base,
      heroi: { ...base.heroi, x: 0, z: 0, army: 20, classe: 'ataque', invulneravelRestante: 0 },
      unidades: [
        { id: 901, lado: 'inimigo', papel: 'sitiante', x: 0.2, z: 0.2, hp: 30, postura: 'automatico', ordem: null, cooldown: 0, segmentos: [], alerta: true },
      ],
    }
    const aposContato = danoContatoInimigosNoHeroi(stSitiante, 0.1)
    assert(aposContato.heroi.army < 20, 'sitiante em contato deve ferir o herói')

    const stInvul: PartidaState = {
      ...stSitiante,
      heroi: { ...stSitiante.heroi, invulneravelRestante: 2 },
    }
    const aposInvul = danoContatoInimigosNoHeroi(stInvul, 0.1)
    assert(aposInvul.heroi.army === 20, 'invulnerável não recebe dano de contato')
  }

  // 5. Dragão escalado por camada (`fatorInimigo`) e pausa da 1ª leva enquanto núcleo está em andaime
  {
    const comNucleoConstruindo = fundar(createPartida(0, 0), 'nucleo', 5, 0, { emConstrucao: true })
    assert(comNucleoConstruindo.obras.some((o) => o.lado === 'nosso' && o.tipo === 'nucleo'), 'núcleo em andaime criado')
    const stAntes = { ...comNucleoConstruindo, ondaNumero: 0, ondaRelogio: PARTIDA.ondaPeriodo - 0.1 }
    const stPausada = stepPartida(stAntes, VAZIO, 0.5)
    assert(stPausada.ondaNumero === 0, '1ª leva aguarda conclusão do núcleo inicial em andaime')

    const mapaDistante = evoluirInimigo(createPartida(2, 0), 2, 1)
    assert(mapaDistante.fatorInimigo === 2, 'mapa camada 2 tem fatorInimigo 2')
  }

  // 6. Consistência dinâmica `evolucaoObra.ts` -> `ilhaIcones.tsx` + Manifesto `2019:143` + Pack Ultra fallback + Tier 1/2 variedade
  const fatorEsperado = `${FATOR_POR_NIVEL.toString().replace('.', ',')}×`
  assert(META_INTENCOES.evoluir.resumo.includes(fatorEsperado), 'resumo evoluir inclui fator')
  assert(META_INTENCOES.evoluir.detalhe.includes(fatorEsperado), 'detalhe evoluir inclui fator')
  assert(FIGURAS_ENEM['2019:143'][0]?.tipoVisual === 'tabela', '2019:143 corrigido para tabela')

  const ultraInexistente = await carregarPackExternoUltra('clareira', 'bonito')
  assert(ultraInexistente === null, 'pack ultra opcional em preset bonito retorna null')

  // Checa que gerar 60 desafios de Grau 1 e Grau 2 produz múltiplos arquétipos e alta unicidade
  const vistosG1 = new Set<string>()
  const vistosG2 = new Set<string>()
  for (let i = 0; i < 60; i += 1) {
    const c1 = generateInfiniteChallenge({ tier: 1, seed: 1000 + i })
    const c2 = generateInfiniteChallenge({ tier: 2, seed: 2000 + i })
    vistosG1.add(c1.expressionBadge ?? c1.questionPt)
    vistosG2.add(c2.expressionBadge ?? c2.questionPt)
  }
  assert(vistosG1.size >= 35, `esperava >=35 expressões distintas em 60 contas de Grau 1, veio ${vistosG1.size}`)
  assert(vistosG2.size >= 35, `esperava >=35 expressões distintas em 60 contas de Grau 2, veio ${vistosG2.size}`)

  console.log('combateAoE: ok')
}
