import { criarAtlas, escreverCena, estadoCorpo, fichaEm, nucleosVivosNoAtlas, stepAtlas } from './atlas'
import { PARTIDA } from './partidaPolicies'
import { createPartida, fundar, INPUT_PARADO, stepPartida } from './partidaSim'
import {
  bonusVidaPorGrauConta,
  calcularCooldownRessurreicao,
  escolherNucleoRessurreicao,
  ressuscitarHeroiNoNucleo,
} from './ressurreicaoHeroi'

function assert(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem)
}

export function run(): void {
  // 1) Bônus base 2 por grau (1..7 -> 4..256)
  assert(bonusVidaPorGrauConta(1) === 4, 'ressurreicao: grau 1 dá +4 HP')
  assert(bonusVidaPorGrauConta(5) === 64, 'ressurreicao: grau 5 dá +64 HP')
  assert(bonusVidaPorGrauConta(7) === 256, 'ressurreicao: grau 7 dá +256 HP')
  assert(calcularCooldownRessurreicao(0) === 15, 'ressurreicao: cooldown inicial 15s')
  assert(calcularCooldownRessurreicao(2) === 25, 'ressurreicao: cooldown escala +5s por morte')

  // 2) Herói cai em (0,0) sem núcleo local mas com núcleo vivo em (1,0): NÃO dá derrota
  {
    const casa = { ...createPartida(0, 0), unidades: [] }
    let atlas = escreverCena(criarAtlas(), casa)
    const viz = fundar({ ...createPartida(1, 0), semCorpo: true, unidades: [] }, 'nucleo', -10, -10)
    atlas = {
      ...atlas,
      fichas: [
        ...atlas.fichas,
        {
          i: 1,
          j: 0,
          state: viz,
          ritmo: 'cheio',
          alerta: 'nenhum',
          relogio: 0,
          hpNosso: 100,
          hpInimigo: 100,
          corpo: false,
        },
      ],
    }
    const vivos = nucleosVivosNoAtlas(atlas)
    assert(vivos.length === 1 && vivos[0].mapaI === 1 && vivos[0].mapaJ === 0, 'ressurreicao: lista núcleo vivo em (1,0)')

    // Derruba herói em (0,0)
    const comHeroiMorto = {
      ...estadoCorpo(atlas),
      heroi: { ...estadoCorpo(atlas).heroi, army: 0 },
    }
    atlas = escreverCena(atlas, comHeroiMorto)
    atlas = stepAtlas(atlas, INPUT_PARADO, 0.05)

    assert(estadoCorpo(atlas).derrota === false, 'ressurreicao: herói cair em (0,0) com núcleo em (1,0) NÃO encerra o jogo')
    assert(atlas.ressurreicao?.aguardando === true, 'ressurreicao: entra em espera de ressurreição')
    assert(
      atlas.ressurreicao?.nucleoDestino?.mapaI === 1 && atlas.ressurreicao?.nucleoDestino?.mapaJ === 0,
      'ressurreicao: seleciona núcleo vivo em (1,0) por padrão',
    )

    // Escolhe explicitamente e renasce via Conta Grau 5 (+64 HP)
    atlas = escolherNucleoRessurreicao(atlas, 1, 0, vivos[0].obraId)
    atlas = ressuscitarHeroiNoNucleo(atlas, { viaConta: { grau: 5, erros: 0 } })

    assert(atlas.heroiI === 1 && atlas.heroiJ === 0, 'ressurreicao: herói renasce no mapa (1,0) escolhido')
    assert(atlas.ressurreicao === null, 'ressurreicao: limpa estado de espera após renascer')
    const corpoDepois = estadoCorpo(atlas)
    assert(
      corpoDepois.heroi.army === PARTIDA.ressurreicaoVidaBase + 64,
      `ressurreicao: renasce com vida base + 64 = 74 (veio ${corpoDepois.heroi.army})`,
    )
    assert(
      (corpoDepois.heroi.invulneravelRestante ?? 0) === PARTIDA.invulnerabilidadeRessurreicaoSeg,
      'ressurreicao: ganha 3s de invulnerabilidade ao nascer',
    )

    // 3) Durante invulnerabilidade, horda colada não tira vida do herói
    const comHordaColada = {
      ...corpoDepois,
      unidades: [
        {
          id: 8888,
          lado: 'inimigo' as const,
          papel: 'horda' as const,
          x: corpoDepois.heroi.x + 0.1,
          z: corpoDepois.heroi.z,
          hp: 12,
          postura: 'automatico' as const,
          ordem: null,
          cooldown: 0,
          segmentos: [],
          alerta: true,
        },
      ],
    }
    const aposHit = stepPartida(comHordaColada, INPUT_PARADO, 0.05)
    assert(aposHit.heroi.army === corpoDepois.heroi.army, 'ressurreicao: escudo de 3s bloqueia dano de spawn-kill')
  }

  // 4) Aguardar cooldown passivo renasce automaticamente com vida padrão
  {
    const base = fundar({ ...createPartida(0, 0), unidades: [] }, 'nucleo', -12, -12)
    let atlas = escreverCena(criarAtlas(), { ...base, heroi: { ...base.heroi, army: 0 } })
    atlas = stepAtlas(atlas, INPUT_PARADO, 0.05)
    assert(atlas.ressurreicao?.aguardando === true, 'ressurreicao: cooldown passivo inicia')
    for (let k = 0; k < 20 && atlas.ressurreicao?.aguardando; k += 1) {
      atlas = stepAtlas(atlas, INPUT_PARADO, 1.0)
    }
    assert(atlas.ressurreicao === null, 'ressurreicao: cooldown passivo concluiu em <= 20s')
    assert(estadoCorpo(atlas).heroi.army === PARTIDA.ressurreicaoVidaBase, 'ressurreicao: renasce com vida base ao aguardar cooldown')
    assert((estadoCorpo(atlas).heroi.invulneravelRestante ?? 0) > 0, 'ressurreicao: cooldown passivo também dá escudo ao nascer')
  }

  // 5) Sem nenhum núcleo vivo em todo o Atlas, morte do herói decreta derrota
  {
    const semNucleo = { ...createPartida(0, 0), unidades: [] }
    let atlas = escreverCena(criarAtlas(), { ...semNucleo, heroi: { ...semNucleo.heroi, army: 0 } })
    atlas = stepAtlas(atlas, INPUT_PARADO, 0.05)
    assert(estadoCorpo(atlas).derrota === true, 'ressurreicao: sem nenhum núcleo vivo no Atlas, morte do herói decreta derrota')
    assert(fichaEm(atlas, 0, 0)?.state.derrota === true, 'ressurreicao: ficha do corpo marcada com derrota')
  }

  // 6) Queda do núcleo escolhido durante a espera faz fallback para outro núcleo vivo; queda do último decreta derrota
  {
    const casa = fundar({ ...createPartida(0, 0), unidades: [] }, 'nucleo', -12, -12)
    let atlas = escreverCena(criarAtlas(), casa)
    const viz = fundar({ ...createPartida(1, 0), semCorpo: true, unidades: [] }, 'nucleo', -12, -12)
    atlas = {
      ...atlas,
      fichas: [
        ...atlas.fichas,
        { i: 1, j: 0, state: viz, ritmo: 'cheio', alerta: 'nenhum', relogio: 0, hpNosso: 100, hpInimigo: 100, corpo: false },
      ],
    }
    const nucCasa = estadoCorpo(atlas).obras.find((o) => o.lado === 'nosso' && o.tipo === 'nucleo')!
    atlas = escreverCena(atlas, { ...estadoCorpo(atlas), heroi: { ...estadoCorpo(atlas).heroi, army: 0 } })
    atlas = stepAtlas(atlas, INPUT_PARADO, 0.05)
    assert(atlas.ressurreicao?.nucleoDestino?.mapaI === 0, 'ressurreicao: destino inicial é o núcleo local (0,0)')

    // Destrói o núcleo local (0,0) durante a espera
    atlas = escreverCena(atlas, {
      ...estadoCorpo(atlas),
      obras: estadoCorpo(atlas).obras.map((o) => (o.id === nucCasa.id ? { ...o, hp: 0 } : o)),
    })
    atlas = stepAtlas(atlas, INPUT_PARADO, 0.05)
    assert(estadoCorpo(atlas).derrota === false, 'ressurreicao: cair o núcleo escolhido com outro vivo em (1,0) não derrota')
    assert(atlas.ressurreicao?.nucleoDestino?.mapaI === 1, 'ressurreicao: faz fallback automático para o núcleo vivo em (1,0)')

    // Destrói também o último núcleo vivo em (1,0)
    const fViz = fichaEm(atlas, 1, 0)!
    atlas = {
      ...atlas,
      fichas: atlas.fichas.map((f) =>
        f.i === 1 && f.j === 0
          ? { ...f, state: { ...f.state, obras: f.state.obras.map((o) => (o.lado === 'nosso' ? { ...o, hp: 0 } : o)) } }
          : f,
      ),
    }
    assert(fViz.i === 1, 'controle ficha vizinha')
    atlas = stepAtlas(atlas, INPUT_PARADO, 0.05)
    assert(estadoCorpo(atlas).derrota === true, 'ressurreicao: cair o último núcleo durante a espera decreta derrota')
  }

  // 7) Bônus via conta com erro (erros: 1 -> metade) e propagação de mortesHeroi entre mapas (2ª morte = 20s)
  {
    const casa = { ...createPartida(0, 0), unidades: [] }
    let atlas = escreverCena(criarAtlas(), { ...casa, heroi: { ...casa.heroi, army: 0 } })
    const viz = fundar({ ...createPartida(1, 0), semCorpo: true, unidades: [] }, 'nucleo', -12, -12)
    atlas = {
      ...atlas,
      fichas: [
        ...atlas.fichas,
        { i: 1, j: 0, state: viz, ritmo: 'cheio', alerta: 'nenhum', relogio: 0, hpNosso: 100, hpInimigo: 100, corpo: false },
      ],
    }
    atlas = stepAtlas(atlas, INPUT_PARADO, 0.05)
    assert(atlas.ressurreicao?.cooldownTotalSeg === 15, 'ressurreicao: 1ª morte cooldown 15s')
    atlas = ressuscitarHeroiNoNucleo(atlas, { viaConta: { grau: 5, erros: 1 } })
    assert(estadoCorpo(atlas).heroi.army === PARTIDA.ressurreicaoVidaBase + 32, 'ressurreicao: 1 erro reduz bônus Grau 5 de +64 para +32')

    // 2ª morte no mapa (1,0) deve escalar cooldown para 20s
    atlas = escreverCena(atlas, { ...estadoCorpo(atlas), heroi: { ...estadoCorpo(atlas).heroi, army: 0 } })
    atlas = stepAtlas(atlas, INPUT_PARADO, 0.05)
    assert(
      atlas.ressurreicao?.cooldownTotalSeg === 20,
      `ressurreicao: 2ª morte após trocar de mapa escala cooldown para 20s (veio ${atlas.ressurreicao?.cooldownTotalSeg})`,
    )
  }

  // 8) Torre inimiga não fere o herói durante invulneravelRestante > 0
  {
    const base = fundar({ ...createPartida(0, 0), unidades: [] }, 'nucleo', -12, -12)
    const comTorreInimiga = {
      ...base,
      heroi: { ...base.heroi, x: 0, z: 0, army: 25, invulneravelRestante: 3 },
      obras: [
        ...base.obras,
        { id: 9950, lado: 'inimigo' as const, tipo: 'torre' as const, x: 0, z: 10, nivel: 1, hp: 50, maxHp: 50, gateApplied: false, cooldown: 0 },
      ],
    }
    const depois = stepPartida(comTorreInimiga, INPUT_PARADO, 0.2)
    assert(depois.heroi.army === 25, 'ressurreicao: escudo de 3s também bloqueia tiro de torre inimiga')
  }
}
