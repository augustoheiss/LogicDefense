import { custoDeEvoluir } from './evolucaoObra'
import { PARTIDA } from './partidaPolicies'
import {
  calcularReembolsoVenda,
  chaoRevelado,
  createPartida,
  criarTropa,
  evoluir,
  fundar,
  iniciarObra,
  moverObra,
  Obra,
  PartidaState,
  podeMoverObraEm,
  podeVenderObra,
  venderObra,
} from './partidaSim'

function assert(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem)
}

export function run(): void {
  const campoLimpo = (): PartidaState => {
    const base = createPartida()
    return {
      ...base,
      heroiPostura: 'calado',
      unidades: [],
      obras: [],
      blocosMapa: {},
      credito: 0,
      madeira: 0,
      ouro: 0,
    }
  }

  const comBase = (credito = 0, madeira = 50, ouro = 50): PartidaState => ({
    ...fundar(campoLimpo(), 'nucleo', 0, 30),
    credito,
    madeira,
    ouro,
  })

  // 1) Reembolso anti-exploit: 1a torre gratis Nv. 1 vende por 0/0; 2a torre (2 mad) vende por 1/0; loop nao lucra
  {
    let s = comBase(0, 20, 10)
    s = fundar(s, 'torre', 8, 30, { cobrarRecursos: true })
    assert(s.madeira === 20, 'reembolso: 1a torre nao cobra madeira')
    const torre1 = s.obras.find((o) => o.lado === 'nosso' && o.tipo === 'torre')!
    const r1 = calcularReembolsoVenda(s, torre1.id)
    assert(r1.madeira === 0 && r1.ouro === 0, `reembolso: 1a torre Nv.1 deve devolver 0/0, veio ${r1.madeira}/${r1.ouro}`)

    s = fundar(s, 'torre', 14, 30, { cobrarRecursos: true })
    assert(s.madeira === 18, `reembolso: 2a torre cobra 2 madeiras (restou ${s.madeira})`)
    const torre2 = s.obras.find((o) => o.lado === 'nosso' && o.tipo === 'torre' && o.id !== torre1.id)!
    const r2 = calcularReembolsoVenda(s, torre2.id)
    assert(r2.madeira === 1 && r2.ouro === 0, `reembolso: 2a torre Nv.1 deve devolver 1 mad / 0 ouro, veio ${r2.madeira}/${r2.ouro}`)

    const antesMad = s.madeira
    const versaoAntes = s.versaoSolidos
    s = venderObra(s, torre2.id)
    assert(s.madeira === antesMad + 1, 'venderObra: soma 1 madeira do reembolso')
    assert(s.versaoSolidos === versaoAntes + 1, 'venderObra: incrementa versaoSolidos')
    assert(!s.obras.some((o) => o.id === torre2.id), 'venderObra: remove a obra vendida')

    // Vender a 1a torre depois da 2a ainda usa custoBaseMadeiraPago = 0 (sem exploit)
    const r1Depois = calcularReembolsoVenda(s, torre1.id)
    assert(r1Depois.madeira === 0 && r1Depois.ouro === 0, 'venderObra: 1a torre continua com reembolso 0/0 mesmo apos vender a 2a')

    // Loop construir -> vender nunca aumenta recursos
    const sLoop = venderObra(fundar(s, 'torre', 14, 30, { cobrarRecursos: true }), s.nextId)
    assert(sLoop.madeira <= s.madeira && sLoop.ouro <= s.ouro, 'anti-exploit: construir e vender nao aumenta recursos')
  }

  // 2) Torre evoluida (Nv. 2, Nv. 3 e Nv. 5) devolve 50% do total investido (base + evolucoes)
  {
    let s = comBase(0, 100, 100)
    // 1a torre tem base 0; vamos usar 2a torre que custa 2 de madeira de base
    s = fundar(s, 'torre', 8, 30, { cobrarRecursos: true })
    s = fundar(s, 'torre', 18, 30, { cobrarRecursos: true })
    const torres = s.obras.filter((o) => o.lado === 'nosso' && o.tipo === 'torre')
    const t2Id = torres[1].id

    const c1 = custoDeEvoluir(1)!
    const c2 = custoDeEvoluir(2)!
    const c3 = custoDeEvoluir(3)!
    const c4 = custoDeEvoluir(4)!

    s = evoluir(s, t2Id) // Nv 2
    const rNv2 = calcularReembolsoVenda(s, t2Id)
    assert(
      rNv2.madeira === Math.floor((2 + c1.madeira) * 0.5) && rNv2.ouro === Math.floor(c1.ouro * 0.5),
      `Nv2: reembolso esperado ${Math.floor((2 + c1.madeira) * 0.5)}/${Math.floor(c1.ouro * 0.5)}, veio ${rNv2.madeira}/${rNv2.ouro}`,
    )

    s = evoluir(s, t2Id) // Nv 3
    const rNv3 = calcularReembolsoVenda(s, t2Id)
    assert(
      rNv3.madeira === Math.floor((2 + c1.madeira + c2.madeira) * 0.5) &&
        rNv3.ouro === Math.floor((c1.ouro + c2.ouro) * 0.5),
      'Nv3: reembolso confere com 50% do investido',
    )

    s = evoluir(s, t2Id) // Nv 4
    s = evoluir(s, t2Id) // Nv 5
    const rNv5 = calcularReembolsoVenda(s, t2Id)
    const expMad = Math.floor((2 + c1.madeira + c2.madeira + c3.madeira + c4.madeira) * 0.5)
    const expOuro = Math.floor((c1.ouro + c2.ouro + c3.ouro + c4.ouro) * 0.5)
    assert(rNv5.madeira === expMad && rNv5.ouro === expOuro, `Nv5: reembolso esperado ${expMad}/${expOuro}, veio ${rNv5.madeira}/${rNv5.ouro}`)
    const depoisVenda = venderObra(s, t2Id)
    assert(depoisVenda.madeira === s.madeira + expMad && depoisVenda.ouro === s.ouro + expOuro, 'Nv5: venda aplica reembolso exato')
  }

  // 3) Recusas de venda e movimento
  {
    let s = comBase(0, 30, 30)
    const nucleo = s.obras.find((o) => o.lado === 'nosso' && o.tipo === 'nucleo')!
    assert(!podeVenderObra(s, nucleo.id).ok, 'recusa: nucleo nao pode ser vendido')
    assert(!podeMoverObraEm(s, nucleo.id, 10, 30).ok, 'recusa: nucleo nao pode ser movido')

    const inimigo: Obra = {
      id: 9001,
      lado: 'inimigo',
      tipo: 'torre',
      x: -10,
      z: -10,
      nivel: 1,
      hp: 50,
      maxHp: 50,
      gateApplied: false,
      cooldown: 0,
    }
    s = { ...s, obras: [...s.obras, inimigo] }
    assert(!podeVenderObra(s, inimigo.id).ok, 'recusa: obra inimiga nao pode ser vendida')
    assert(!podeMoverObraEm(s, inimigo.id, -12, -10).ok, 'recusa: obra inimiga nao pode ser movida')
    assert(!podeVenderObra(s, 99999).ok, 'recusa: obra inexistente nao pode ser vendida')
    assert(!podeMoverObraEm(s, 99999, 10, 30).ok, 'recusa: obra inexistente nao pode ser movida')

    s = iniciarObra(s, 'torre', 8, 30)
    const emObra = s.obras.find((o) => o.lado === 'nosso' && o.tipo === 'torre')!
    assert(!podeMoverObraEm(s, emObra.id, 12, 30).ok, 'recusa: obra em construcao nao pode ser movida')

    // Derrota
    const derrotado = { ...s, derrota: true }
    assert(!podeVenderObra(derrotado, emObra.id).ok, 'recusa: partida em derrota nao permite vender')
    assert(!podeMoverObraEm(derrotado, emObra.id, 12, 30).ok, 'recusa: partida em derrota nao permite mover')
  }

  // 4) Limpeza de ordem atacarObra ao vender e invalidacao de rota ao mover
  {
    let s = comBase(0, 30, 30)
    const nucleo = s.obras.find((o) => o.lado === 'nosso' && o.tipo === 'nucleo')!
    s = fundar(s, 'torre', 8, 30, { cobrarRecursos: true })
    const torre = s.obras.find((o) => o.lado === 'nosso' && o.tipo === 'torre')!
    s = criarTropa(s, nucleo.id)
    assert(s.unidades.length === 1, 'pre-condicao: criarTropa cria unidade no nucleo')
    s = {
      ...s,
      unidades: s.unidades.map((u) => ({
        ...u,
        x: -4,
        z: 30,
        ordem: { tipo: 'atacarObra', obraId: torre.id },
        rota: { marcos: [{ x: 8, z: 30 }], renovarEm: 2, semCaminho: false, versao: 1, modo: 'vivo' },
      })),
      heroiOrdem: { tipo: 'atacarObra', obraId: torre.id, rota: null },
    }
    const movido = moverObra(s, torre.id, 12, 30)
    assert(movido.unidades[0].rota === null, 'moverObra: invalida rota de quem mirava a obra movida')
    const vendido = venderObra(s, torre.id)
    assert(vendido.unidades[0].ordem === null && vendido.unidades[0].rota === null, 'venderObra: limpa ordem e rota ao vender')
    assert(vendido.heroiOrdem === null, 'venderObra: limpa heroiOrdem se apontava para a obra vendida')
  }

  // 5) moverObra Nv1, Nv5 (blocosNv5), ajuste fino perto da posicao atual, bloqueios e +0 madeira em arvore
  {
    let s = comBase(20, 30, 30)
    const nucleo = s.obras.find((o) => o.lado === 'nosso' && o.tipo === 'nucleo')!
    s = fundar(s, 'torre', 8, 30, { cobrarRecursos: true })
    const torre = s.obras.find((o) => o.lado === 'nosso' && o.tipo === 'torre')!

    // Ajuste fino de 0.5m ignorando a propria obra funciona
    assert(podeMoverObraEm(s, torre.id, 8.5, 30).ok, 'moverObra: ajuste fino proximo a propria posicao e permitido')
    const sFino = moverObra(s, torre.id, 8.5, 30)
    const tFino = sFino.obras.find((o) => o.id === torre.id)!
    assert(tFino.x === 8.5 && tFino.z === 30, 'moverObra: atualiza x e z no ajuste fino')

    // Evoluir ate Nv 5 e mover com blocosNv5 preservados
    let s5 = sFino
    for (let i = 0; i < 4; i += 1) s5 = evoluir(s5, torre.id)
    const t5Antes = s5.obras.find((o) => o.id === torre.id)!
    assert(t5Antes.nivel === 5 && Boolean(t5Antes.blocosNv5), 'pre-condicao: torre Nv5 tem blocosNv5')
    assert(podeMoverObraEm(s5, torre.id, -16, 20).ok, 'moverObra: torre Nv5 pode mover para area livre')
    const s5Mov = moverObra(s5, torre.id, -16, 20)
    const t5Mov = s5Mov.obras.find((o) => o.id === torre.id)!
    assert(t5Mov.x === -16 && t5Mov.z === 20 && t5Mov.nivel === 5 && t5Mov.blocosNv5 === t5Antes.blocosNv5, 'moverObra: Nv5 preserva nivel e blocosNv5')

    // Nv5 bloqueada se outra obra estiver dentro da pegada de 6m no destino
    assert(!podeMoverObraEm(s5Mov, torre.id, 1.5, 30).ok, 'moverObra: Nv5 recusa destino que colide com o nucleo')

    // Bloqueio por heroi, unidade, outra obra, fora do mapa e neblina
    const comHeroiPerto = { ...s, heroi: { ...s.heroi, x: 14, z: 22, y: 0 }, semCorpo: false }
    assert(!podeMoverObraEm(comHeroiPerto, torre.id, 14.5, 22).ok, 'moverObra: recusa quando heroi esta no destino')

    const comBaseUnidade = criarTropa(s, nucleo.id)
    const comUnidade: PartidaState = {
      ...comBaseUnidade,
      unidades: comBaseUnidade.unidades.map((u) => ({ ...u, x: 14, z: 22 })),
    }
    assert(!podeMoverObraEm(comUnidade, torre.id, 14.5, 22).ok, 'moverObra: recusa quando unidade esta no destino')
    assert(!podeMoverObraEm(s, torre.id, 0, 30).ok, 'moverObra: recusa colisao com outra obra')
    assert(!podeMoverObraEm(s, torre.id, 999, 999).ok, 'moverObra: recusa fora dos limites do mapa')

    if (PARTIDA.nuvem) {
      const semVisao = { ...s, semCorpo: true, chaoVisto: new Uint8Array(s.chaoVisto.length) }
      if (!chaoRevelado(semVisao, -20, -20)) {
        assert(!podeMoverObraEm(semVisao, torre.id, -20, -20, { exigirRevelado: true }).ok, 'moverObra: recusa mover para neblina')
      }
    }

    // Limpeza de arvore no destino da movimentacao concede +0 madeira
    const sArvore: PartidaState = {
      ...s,
      madeira: 12,
      recursos: [
        {
          id: 7777,
          tipo: 'arvore',
          x: 15,
          z: 22,
          yBase: 0,
          hp: 10,
          maxHp: 10,
          regeneraEm: 0,
        },
      ],
    }
    const sPosArvore = moverObra(sArvore, torre.id, 15, 22)
    assert(sPosArvore.madeira === 12, `anti-exploit arvore: mover torre nao da madeira extra (veio ${sPosArvore.madeira})`)
    assert(sPosArvore.recursos[0].hp === 0, 'moverObra: derruba arvore no local de destino')
  }

  // 6) moverObra com blocosLivres translada blocos mantendo alinhamento
  {
    let s = comBase(0, 30, 30)
    const obraLivre: Obra = {
      id: 8801,
      lado: 'nosso',
      tipo: 'torre',
      x: 10,
      z: 20,
      nivel: 1,
      hp: 50,
      maxHp: 50,
      gateApplied: false,
      cooldown: 0,
      blocosLivres: [
        { x: 10, y: 0, z: 20, material: 'madeira', hp: 18, maxHp: 18, lado: 'nosso' },
        { x: 10, y: 1, z: 20, material: 'pedra', hp: 42, maxHp: 42, lado: 'nosso' },
      ],
    }
    s = { ...s, obras: [...s.obras, obraLivre] }
    assert(podeMoverObraEm(s, obraLivre.id, 14, 23).ok, 'blocosLivres: destino livre permite mover')
    const mov = moverObra(s, obraLivre.id, 14, 23)
    const depois = mov.obras.find((o) => o.id === obraLivre.id)!
    assert(depois.x === 14 && depois.z === 23, 'blocosLivres: atualiza centro da obra')
    assert(
      depois.blocosLivres?.[0].x === 14 &&
        depois.blocosLivres?.[0].z === 23 &&
        depois.blocosLivres?.[1].x === 14 &&
        depois.blocosLivres?.[1].y === 1 &&
        depois.blocosLivres?.[1].z === 23,
      'blocosLivres: translada coordenadas dos blocos corretamente',
    )
  }
}
