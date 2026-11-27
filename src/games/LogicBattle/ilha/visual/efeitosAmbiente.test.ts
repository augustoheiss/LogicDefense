import type { BiomaId } from '../biomaRecursos'
import { type CampoRelevo, LADO_RELEVO } from '../relevo/campoRelevo'
import { PARTIDA } from '../partidaPolicies'
import { createPartida } from '../partidaSim'
import { SPEC_QUALIDADE } from './qualidadeGrafica'
import { Y_SOLO_VISUAL } from './suporteFundacao'
import {
  configEfeitosAmbiente,
  gerarBandoPassaros,
  gerarParticulasBioma,
  perfilParticulaBioma,
  posicoesTochasObras,
} from './efeitosAmbiente'

function assert(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem)
}

const BIOMAS: readonly BiomaId[] = ['clareira', 'bosque', 'serra_ouro', 'ribeira', 'tundra_cristal', 'basalto_brasa']

export async function run(): Promise<void> {
  // Decisão do usuário em 27/11/2026: efeitos visuais de F4/F5 ligados por padrão
  assert(PARTIDA.efeitos.ativo === true && PARTIDA.efeitos.respostas === true, 'PARTIDA.efeitos.ativo e respostas iniciam ligados (decisão de 27/11/2026)')

  const todasSubchavesLigadas = {
    nuvens: true,
    particulas: true,
    passaros: true,
    ventoArvores: true,
    tochasObras: true,
    respostas: true,
  } as const

  // 1. Chave desligada, Leve ou subsolo zeram todos os efeitos
  for (const ctx of [
    { ativo: false, movimentoReduzido: false, noSubsolo: false, olhar: 'terceira' as const, subchaves: todasSubchavesLigadas },
    { ativo: true, movimentoReduzido: false, noSubsolo: true, olhar: 'terceira' as const, subchaves: todasSubchavesLigadas },
  ]) {
    for (const q of [SPEC_QUALIDADE.leve, SPEC_QUALIDADE.bonito, SPEC_QUALIDADE.ultra]) {
      const cfg = configEfeitosAmbiente(q, ctx)
      assert(
        !cfg.nuvens &&
          cfg.maxParticulas === 0 &&
          cfg.maxPassaros === 0 &&
          !cfg.ventoArvores &&
          !cfg.tochasObras &&
          !cfg.respostas &&
          cfg.velocidadeTempo === 0,
        `F4/F5 deve ficar 100% desligada quando ativo=${ctx.ativo}, subsolo=${ctx.noSubsolo}, qualidade=${q.efetiva}`,
      )
    }
  }

  const cfgLeve = configEfeitosAmbiente(SPEC_QUALIDADE.leve, {
    ativo: true,
    movimentoReduzido: false,
    noSubsolo: false,
    olhar: 'terceira',
    subchaves: todasSubchavesLigadas,
  })
  assert(
    !cfgLeve.nuvens &&
      cfgLeve.maxParticulas === 0 &&
      cfgLeve.maxPassaros === 0 &&
      !cfgLeve.ventoArvores &&
      !cfgLeve.tochasObras &&
      !cfgLeve.respostas &&
      cfgLeve.velocidadeTempo === 0,
    'Qualidade Leve nunca liga efeitos F4/F5 (D10/D13)',
  )

  // 2. Bonito e Ultra respeitam olhar, subchaves e orçamento
  const cfgBonito = configEfeitosAmbiente(SPEC_QUALIDADE.bonito, {
    ativo: true,
    movimentoReduzido: false,
    noSubsolo: false,
    olhar: 'terceira',
    subchaves: todasSubchavesLigadas,
  })
  assert(
    cfgBonito.nuvens &&
      cfgBonito.maxParticulas === 160 &&
      cfgBonito.maxPassaros === 6 &&
      cfgBonito.ventoArvores &&
      cfgBonito.tochasObras &&
      cfgBonito.velocidadeTempo === 1,
    'Bonito 3ª pessoa liga F4 dentro do orçamento',
  )

  const cfgUltra = configEfeitosAmbiente(SPEC_QUALIDADE.ultra, {
    ativo: true,
    movimentoReduzido: false,
    noSubsolo: false,
    olhar: 'primeira',
    subchaves: todasSubchavesLigadas,
  })
  assert(
    cfgUltra.nuvens &&
      cfgUltra.maxParticulas === 360 &&
      cfgUltra.maxPassaros === 10 &&
      cfgUltra.ventoArvores &&
      cfgUltra.tochasObras &&
      cfgUltra.velocidadeTempo === 1,
    'Ultra 1ª pessoa liga F4 com orçamento maior',
  )

  // Modo Império não desenha nuvens na frente do tabuleiro tático
  const cfgImperio = configEfeitosAmbiente(SPEC_QUALIDADE.ultra, {
    ativo: true,
    movimentoReduzido: false,
    noSubsolo: false,
    olhar: 'imperio',
    subchaves: todasSubchavesLigadas,
  })
  assert(!cfgImperio.nuvens && cfgImperio.maxParticulas === 360, 'Modo Império desliga camada de nuvens sobre a câmera tática')

  // prefers-reduced-motion: reduce desliga animações/partículas/pássaros/vento e congela tempo
  const cfgReduzido = configEfeitosAmbiente(SPEC_QUALIDADE.ultra, {
    ativo: true,
    movimentoReduzido: true,
    noSubsolo: false,
    olhar: 'terceira',
    subchaves: todasSubchavesLigadas,
  })
  assert(
    cfgReduzido.maxParticulas === 0 &&
      cfgReduzido.maxPassaros === 0 &&
      !cfgReduzido.ventoArvores &&
      cfgReduzido.velocidadeTempo === 0 &&
      cfgReduzido.tochasObras,
    'prefers-reduced-motion zera partículas, pássaros, vento e velocidadeTempo',
  )

  // Subchaves individuais desligam somente o respectivo recurso
  const cfgSoTocha = configEfeitosAmbiente(SPEC_QUALIDADE.bonito, {
    ativo: true,
    movimentoReduzido: false,
    noSubsolo: false,
    olhar: 'terceira',
    subchaves: { nuvens: false, particulas: false, passaros: false, ventoArvores: false, tochasObras: true, respostas: false },
  })
  assert(
    !cfgSoTocha.nuvens &&
      cfgSoTocha.maxParticulas === 0 &&
      cfgSoTocha.maxPassaros === 0 &&
      !cfgSoTocha.ventoArvores &&
      cfgSoTocha.tochasObras &&
      !cfgSoTocha.respostas,
    'subchaves controlam cada recurso isoladamente',
  )

  // 3. Perfis e geradores determinísticos para todos os 6 biomas
  for (const bioma of BIOMAS) {
    const p = perfilParticulaBioma(bioma)
    assert(p.corPrimaria.startsWith('#') && p.corSecundaria.startsWith('#'), `perfilParticulaBioma válido para ${bioma}`)
    assert(p.tamanhoBase > 0 && p.alturaMax > p.alturaMin && p.alturaMin >= 0, `faixas válidas de partícula em ${bioma}`)

    const listaA = gerarParticulasBioma(1, -2, bioma, 40)
    const listaB = gerarParticulasBioma(1, -2, bioma, 40)
    assert(listaA.length === 40 && JSON.stringify(listaA) === JSON.stringify(listaB), `partículas determinísticas em ${bioma}`)
    for (const item of listaA) {
      assert(Math.abs(item.x) <= 52 && Math.abs(item.z) <= 52, `partícula dentro de [-52, 52] em ${bioma}`)
      assert(item.y >= p.alturaMin && item.y <= p.alturaMax, `altura dentro da faixa em ${bioma}`)
      assert(item.escala > 0 && Number.isFinite(item.fase), `escala e fase finitas em ${bioma}`)
    }
  }
  assert(gerarParticulasBioma(0, 0, 'clareira', 0).length === 0, 'quantidade 0 gera 0 partículas')

  const bandoA = gerarBandoPassaros(-3, 2, 8)
  const bandoB = gerarBandoPassaros(-3, 2, 8)
  assert(bandoA.length === 8 && JSON.stringify(bandoA) === JSON.stringify(bandoB), 'bando de pássaros determinístico')
  for (const ave of bandoA) {
    assert(ave.raioOrbita >= 14 && ave.raioOrbita <= 32, `raio de órbita válido: ${ave.raioOrbita}`)
    assert(ave.altitude >= 14 && ave.altitude <= 22, `altitude válida: ${ave.altitude}`)
    assert(ave.velocidadeAngular !== 0 && ave.escala > 0, 'velocidade angular e escala válidas')
  }
  assert(gerarBandoPassaros(0, 0, 0).length === 0, 'quantidade 0 gera 0 pássaros')

  // 4. Tochas em obras: I1 (campo undefined = plano) e acompanhamento de relevo elevado
  const partida = createPartida(0, 0)
  const obrasTeste = [
    { ...partida.obras[0], id: 101, lado: 'nosso' as const, tipo: 'torre' as const, nivel: 1, hp: 50, x: 4, z: 4, construindoRestante: 0 },
    { ...partida.obras[0], id: 102, lado: 'nosso' as const, tipo: 'torre' as const, nivel: 3, hp: 100, x: 10, z: -8, construindoRestante: 0 },
    { ...partida.obras[0], id: 103, lado: 'nosso' as const, tipo: 'quartel' as const, nivel: 4, hp: 0, x: 12, z: -12, construindoRestante: 0 },
    { ...partida.obras[0], id: 104, lado: 'nosso' as const, tipo: 'nucleo' as const, nivel: 5, hp: 200, x: -10, z: 6, construindoRestante: 5 },
    { ...partida.obras[0], id: 105, lado: 'inimigo' as const, tipo: 'nucleo' as const, nivel: 1, hp: 300, x: -24, z: -24, construindoRestante: 0 },
  ]

  const tochasSemCampo = posicoesTochasObras(obrasTeste, undefined, [])
  assert(
    tochasSemCampo.length === 4 &&
      tochasSemCampo.filter((t) => t.ehInimiga).length === 2 &&
      tochasSemCampo.filter((t) => !t.ehInimiga).length === 2,
    `apenas obra aliada Nv>=3 ativa/construída e obra inimiga ativa recebem 2 tochas cada (recebeu ${tochasSemCampo.length})`,
  )
  const campoPlano: CampoRelevo = {
    i: 0,
    j: 0,
    alturas: new Float32Array(LADO_RELEVO * LADO_RELEVO),
    nivelAgua: -0.075,
    versao: 1,
  }
  const tochasPlano = posicoesTochasObras(obrasTeste, campoPlano, [])
  assert(
    JSON.stringify(tochasSemCampo) === JSON.stringify(tochasPlano),
    'I1: tochas com campo plano são idênticas às sem campo',
  )

  // Campo elevado artificial (+2,5 m em toda a grade) desloca y exatamente em +2,5 m
  const campoAlto: CampoRelevo = { ...campoPlano, alturas: new Float32Array(campoPlano.alturas.length).fill(2.5) }
  const tochasAltas = posicoesTochasObras(obrasTeste, campoAlto, [])
  for (let k = 0; k < tochasSemCampo.length; k += 1) {
    assert(
      Math.abs(tochasAltas[k].y - (tochasSemCampo[k].y + 2.5)) < 1e-6,
      `tocha acompanha altura do terreno (${tochasAltas[k].y} vs ${tochasSemCampo[k].y + 2.5})`,
    )
    assert(tochasSemCampo[k].y > Y_SOLO_VISUAL, 'tocha fica acima do nível do solo visual')
  }
}
