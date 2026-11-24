import { limiteHeroisPorNivelNucleo, PARTIDA, SPEC_HEROI, SPEC_TROPA_ALIADA } from './partidaPolicies'
import {
  atirar,
  cancelarItemFila,
  createPartida,
  definirRallyPoint,
  encontrarConstrutorOcioso,
  enfileirarHeroi,
  enfileirarTropa,
  fundar,
  INPUT_PARADO,
  listarHerois,
  ordenar,
  ordenarConstrutorColetar,
  ordenarConstrutorReparar,
  ordenarHeroi,
  selecionarHeroiAtivo,
  stepPartida,
  type PartidaState,
} from './partidaSim'

function assert(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem)
}

export function run(): void {
  // 1) Limite de heróis por nível do Núcleo: 1 (Nv1-2) -> 2 (Nv3-4) -> 3 (Nv5)
  assert(limiteHeroisPorNivelNucleo(1) === 1 && limiteHeroisPorNivelNucleo(2) === 1, 'herois: Nv1-2 permite 1')
  assert(limiteHeroisPorNivelNucleo(3) === 2 && limiteHeroisPorNivelNucleo(4) === 2, 'herois: Nv3-4 permite 2')
  assert(limiteHeroisPorNivelNucleo(5) === 3, 'herois: Nv5 permite 3')

  // 2) Fila de produção do Quartel respeita cooldown, marcha ao Rally Point e reembolsa 100% ao cancelar
  {
    let s = fundar({ ...createPartida(0, 0), unidades: [], credito: 10, ouro: 10, madeira: 10 }, 'nucleo', -12, -12)
    s = fundar(s, 'quartel', -8, -12)
    const quartel = s.obras.find((o) => o.tipo === 'quartel' && o.lado === 'nosso')!
    s = definirRallyPoint(s, quartel.id, 10, 10)

    const credAntes = s.credito
    s = enfileirarTropa(s, quartel.id, 'soldado')
    assert(s.credito === credAntes - 1, 'fila: cobra custo na entrada da fila')
    assert(s.unidades.filter((u) => u.lado === 'aliado').length === 0, 'fila: tropa não spawna instantaneamente')
    const q1 = s.obras.find((o) => o.id === quartel.id)!
    assert(q1.filaProducao?.length === 1, 'fila: item adicionado à fila do Quartel')

    // Enfileira 2º item e cancela com reembolso 100%
    s = enfileirarTropa(s, quartel.id, 'arqueiro')
    const q2 = s.obras.find((o) => o.id === quartel.id)!
    const item2 = q2.filaProducao![1]
    const credApos2 = s.credito
    s = cancelarItemFila(s, quartel.id, item2.id)
    assert(s.credito === credApos2 + item2.custoPago.credito, 'fila: cancelar devolve 100% do crédito pago')
    assert(s.obras.find((o) => o.id === quartel.id)!.filaProducao?.length === 1, 'fila: item cancelado removido')

    // Avança 4.5s para concluir treino do soldado
    for (let k = 0; k < 90; k += 1) {
      s = stepPartida(s, INPUT_PARADO, 0.05)
    }
    const tropas = s.unidades.filter((u) => u.lado === 'aliado' && u.hp > 0)
    assert(tropas.length === 1, 'fila: soldado nasce após concluir cooldown')
    assert(tropas[0].ordem?.tipo === 'mover' && Math.round(tropas[0].ordem.x) === 10, 'rally: tropa recém-nascida marcha ao Rally Point')
  }

  // 3) Treinamento dos 3 Heróis no Núcleo Nv5 + redução de dano do Tanque + coleta/reparo do Construtor
  {
    let s = fundar({ ...createPartida(0, 0), unidades: [], credito: 20, ouro: 20, madeira: 20 }, 'nucleo', -14, -14)
    const nuc = s.obras.find((o) => o.tipo === 'nucleo' && o.lado === 'nosso')!

    // No Nv1, tentar enfileirar 2º herói é recusado
    const recusadoNv1 = enfileirarHeroi(s, nuc.id, 'tanque')
    assert(recusadoNv1 === s, 'herois: Nv1 recusa treinar 2º herói')

    // Sobe Núcleo para Nv3 -> permite treinar Tanque (2º herói)
    s = {
      ...s,
      obras: s.obras.map((o) => (o.id === nuc.id ? { ...o, nivel: 3 } : o)),
    }
    s = enfileirarHeroi(s, nuc.id, 'tanque')
    assert(s.obras.find((o) => o.id === nuc.id)!.filaProducao?.length === 1, 'herois: Nv3 aceita treinar Tanque')
    // No Nv3, 3º herói ainda é recusado
    assert(enfileirarHeroi(s, nuc.id, 'construtor') === s, 'herois: Nv3 recusa 3º herói')

    // Avança 10.5s para Tanque nascer
    for (let k = 0; k < 210; k += 1) {
      s = stepPartida(s, INPUT_PARADO, 0.05)
    }
    const heroisNv3 = listarHerois(s).filter((h) => h.vivo)
    assert(heroisNv3.length === 2, 'herois: Tanque nasceu e totaliza 2 heróis')
    const tanque = heroisNv3.find((h) => h.classe === 'tanque')!
    assert(tanque.army === SPEC_HEROI.tanque.hpBase, 'herois: Tanque nasce com HP base 30')

    // Sobe Núcleo para Nv5 -> permite treinar Construtor (3º herói)
    s = {
      ...s,
      obras: s.obras.map((o) => (o.id === nuc.id ? { ...o, nivel: 5 } : o)),
    }
    s = enfileirarHeroi(s, nuc.id, 'construtor')
    for (let k = 0; k < 160; k += 1) {
      s = stepPartida(s, INPUT_PARADO, 0.05)
    }
    const heroisNv5 = listarHerois(s).filter((h) => h.vivo)
    assert(heroisNv5.length === 3, 'herois: Nv5 suporta os 3 heróis simultâneos (Ataque, Tanque, Construtor)')

    // Testa redução de dano do Tanque (toma 55% do dano da horda -> ceil(3 * 0.55) = 2 em vez de 3)
    const tanqueAtivo = selecionarHeroiAtivo(s, tanque.id)
    const hpAntes = tanqueAtivo.heroi.army
    const comHorda = {
      ...tanqueAtivo,
      unidades: [
        {
          id: 9500,
          lado: 'inimigo' as const,
          papel: 'horda' as const,
          x: tanqueAtivo.heroi.x + 0.1,
          z: tanqueAtivo.heroi.z,
          hp: 12,
          postura: 'automatico' as const,
          ordem: null,
          cooldown: 0,
          segmentos: [],
          alerta: true,
        },
      ],
    }
    const aposHit = stepPartida(comHorda, INPUT_PARADO, 0.05)
    const danoTomado = hpAntes - aposHit.heroi.army
    assert(danoTomado < PARTIDA.hitDamage && danoTomado === 2, `tanque: tomou ${danoTomado} de dano reduzido em vez de ${PARTIDA.hitDamage}`)

    // Testa Construtor ocioso + coletando árvore + reparando obra danificada
    const construtor = encontrarConstrutorOcioso(s)
    assert(construtor !== null && construtor.classe === 'construtor', 'construtor: encontrado ocioso')
    const arvore = s.recursos.find((r) => r.hp > 0 && r.tipo === 'arvore')!
    const madAntes = s.madeira
    s = {
      ...s,
      herois: listarHerois(s).map((h) => (h.id === construtor.id ? { ...h, x: arvore.x + 0.5, z: arvore.z } : h)),
    }
    s = ordenarConstrutorColetar(s, construtor.id, arvore.id)
    s = stepPartida(s, INPUT_PARADO, 0.1)
    assert(s.madeira > madAntes, 'construtor: derruba/coleta árvore aumentando madeira')

    // Danifica o núcleo e manda o construtor reparar
    const nucDanificado = s.obras.find((o) => o.id === nuc.id)!
    s = {
      ...s,
      madeira: 10,
      obras: s.obras.map((o) => (o.id === nuc.id ? { ...o, hp: Math.max(10, o.maxHp - 30) } : o)),
    }
    const hpDanif = s.obras.find((o) => o.id === nuc.id)!.hp
    s = {
      ...s,
      herois: listarHerois(s).map((h) => (h.id === construtor.id ? { ...h, x: nucDanificado.x + 4.0, z: nucDanificado.z } : h)),
    }
    s = ordenarConstrutorReparar(s, construtor.id, nuc.id)
    for (let k = 0; k < 40; k += 1) {
      s = stepPartida(s, INPUT_PARADO, 0.05)
    }
    assert(s.obras.find((o) => o.id === nuc.id)!.hp > hpDanif, 'construtor: repara obra danificada')

    // 4) Bloqueio 1: Ordem de Construtor limpa heroiOrdem, e WASD / ordenarHeroi cancela tarefaConstrutor
    const constrAtivo = selecionarHeroiAtivo(s, construtor.id)
    const comOrdem = ordenarHeroi(constrAtivo, { tipo: 'mover', x: -20, z: -20 })
    assert(comOrdem.heroiOrdem?.tipo === 'mover', 'construtor: heroiOrdem inicialmente definida')
    const comColeta = ordenarConstrutorColetar(comOrdem, construtor.id, arvore.id)
    assert(comColeta.heroiOrdem === null, 'construtor: ordenarConstrutorColetar limpa heroiOrdem do ativo')
    const canceladoPorOrdem = ordenarHeroi(comColeta, { tipo: 'mover', x: -18, z: -18 })
    assert(
      listarHerois(canceladoPorOrdem).find((h) => h.id === construtor.id)?.tarefaConstrutor === null,
      'construtor: ordenarHeroi cancela tarefaConstrutor',
    )
    const recoleta = ordenarConstrutorColetar(canceladoPorOrdem, construtor.id, arvore.id)
    const canceladoWasd = stepPartida(recoleta, { ...INPUT_PARADO, forward: true }, 0.05)
    assert(
      listarHerois(canceladoWasd).find((h) => h.id === construtor.id)?.tarefaConstrutor === null,
      'construtor: movimento manual WASD cancela tarefaConstrutor',
    )

    // 5) Troca via selecionarHeroiAtivo preserva posição/HP entre os heróis
    const trocado = selecionarHeroiAtivo(s, tanque.id)
    assert(trocado.heroiAtivoId === tanque.id && trocado.heroi.classe === 'tanque', 'herois: troca para Tanque')
    const voltouAtaque = selecionarHeroiAtivo(trocado, listarHerois(trocado).find((h) => h.classe === 'ataque')!.id)
    assert(
      voltouAtaque.heroi.classe === 'ataque' &&
        listarHerois(voltouAtaque).find((h) => h.id === tanque.id)?.army === trocado.heroi.army,
      'herois: selecionarHeroiAtivo preserva estado anterior',
    )
  }

  // 6) Teto de fila = 5 itens + redução de 45% do Tanque contra torre inimiga + diferença Ataque vs Tanque
  {
    let s = fundar({ ...createPartida(0, 0), unidades: [], credito: 20, ouro: 20, madeira: 20 }, 'nucleo', -14, -14)
    s = fundar(s, 'quartel', -8, -12)
    const q = s.obras.find((o) => o.tipo === 'quartel' && o.lado === 'nosso')!
    for (let i = 0; i < PARTIDA.maxFilaProducao; i += 1) {
      s = enfileirarTropa(s, q.id, 'soldado')
    }
    assert(s.obras.find((o) => o.id === q.id)!.filaProducao?.length === 5, 'fila: aceita ate 5 itens')
    const credAntes6 = s.credito
    const recusado6 = enfileirarTropa(s, q.id, 'soldado')
    assert(recusado6 === s && recusado6.credito === credAntes6, 'fila: 6o item recusado sem cobrar')

    // Diferença de dano/alcance Ataque (12 dano, 18m) vs Tanque (5 dano, 10m)
    const nuc = s.obras.find((o) => o.tipo === 'nucleo' && o.lado === 'nosso')!
    s = {
      ...s,
      obras: s.obras.map((o) => (o.id === nuc.id ? { ...o, nivel: 3 } : o)),
    }
    s = enfileirarHeroi(s, nuc.id, 'tanque')
    for (let k = 0; k < 210; k += 1) s = stepPartida(s, INPUT_PARADO, 0.05)
    const tanque = listarHerois(s).find((h) => h.classe === 'tanque')!

    const alvoPos = { x: s.heroi.x, z: s.heroi.z + 12 }
    const cenaAtaque = {
      ...s,
      heroi: { ...s.heroi, yaw: 0, pitch: 0, shootCooldown: 0 },
      unidades: [
        {
          id: 9600,
          lado: 'inimigo' as const,
          papel: 'horda' as const,
          x: alvoPos.x,
          z: alvoPos.z,
          hp: 50,
          postura: 'calado' as const,
          ordem: null,
          cooldown: 0,
          segmentos: [],
          alerta: false,
        },
      ],
    }
    const aposTiroAtaque = atirar(cenaAtaque)
    assert(
      50 - aposTiroAtaque.unidades.find((u) => u.id === 9600)!.hp === SPEC_HEROI.ataque.danoTiro,
      'herois: classe Ataque atinge a 12m com dano 12',
    )
    const comTanque = selecionarHeroiAtivo(cenaAtaque, tanque.id)
    const tanqueAtirouLonge = atirar({
      ...comTanque,
      heroi: { ...comTanque.heroi, x: s.heroi.x, z: s.heroi.z, yaw: 0, pitch: 0, shootCooldown: 0 },
    })
    assert(tanqueAtirouLonge.unidades.find((u) => u.id === 9600)!.hp === 50, 'herois: Tanque tem alcance 10m (<12m)')

    // Redução de 45% do Tanque contra torre inimiga
    const torreBase = {
      id: 9601,
      tipo: 'torre' as const,
      lado: 'inimigo' as const,
      x: comTanque.heroi.x + 2,
      z: comTanque.heroi.z,
      hp: 80,
      maxHp: 80,
      nivel: 1,
      faltam: 0,
      cooldown: 0,
      recursosRestantes: 0,
      progresso: 1,
      pilha: [],
      alerta: true,
      gateApplied: false,
    }
    const baseComTorre = {
      ...comTanque,
      unidades: [],
      heroi: { ...comTanque.heroi, invulneravelRestante: 0 },
      obras: [...comTanque.obras, torreBase],
    }
    const hpAntesTorre = baseComTorre.heroi.army
    const aposTorre = stepPartida(baseComTorre, INPUT_PARADO, 0.05)
    const danoTorre = hpAntesTorre - aposTorre.heroi.army
    // Torre Nv1 = 6 dano -> com 45% de redução: ceil(6 * 0.55) = 4 (< 6)
    assert(danoTorre > 0 && danoTorre < 6 && danoTorre === 4, `tanque: torre causou ${danoTorre} em vez de 6`)
  }

  // 7) Bloqueio 2: Arqueiro atira de longe (alcance 10m) sem encostar no corpo a corpo, Lanceiro causa mais dano e anda rápido
  {
    const base = {
      ...createPartida(0, 0),
      obras: [],
      recursos: [],
      lagoas: [],
    }
    const arqPos = base.heroi.x - 8
    const iniPos = arqPos + 7.5 // distância 7.5m: dentro do alcance 10m do Arqueiro, bem fora de PARTIDA.melee (1.15m)
    let cena: PartidaState = {
      ...base,
      heroi: { ...base.heroi, x: 0, z: -20 },
      unidades: [
        {
          id: 9701,
          lado: 'aliado' as const,
          papel: 'tropa' as const,
          tipoTropa: 'arqueiro' as const,
          x: arqPos,
          z: 0,
          hp: 20,
          postura: 'vigia' as const,
          posturaBase: 'vigia' as const,
          ordem: null,
          ancora: null,
          cooldown: 0,
          segmentos: [],
          alerta: false,
        },
        {
          id: 9702,
          lado: 'inimigo' as const,
          papel: 'horda' as const,
          x: iniPos,
          z: 0,
          hp: 30,
          postura: 'calado' as const,
          ordem: null,
          cooldown: 0,
          segmentos: [],
          alerta: false,
        },
      ],
    }
    cena = stepPartida(cena, INPUT_PARADO, 0.05)
    const arq = cena.unidades.find((u) => u.id === 9701)!
    const ini = cena.unidades.find((u) => u.id === 9702)!
    assert(
      Math.abs(30 - ini.hp - SPEC_TROPA_ALIADA.arqueiro.danoBase * 1.3) < 0.01,
      `arqueiro: causou ${30 - ini.hp} de dano à distância de 7.5m (esperado ${SPEC_TROPA_ALIADA.arqueiro.danoBase * 1.3} com +30% Triângulo AoE vs horda)`,
    )
    assert(
      Math.hypot(arq.x - ini.x, arq.z - ini.z) > 6.0,
      'arqueiro: não avançou para o corpo a corpo ao atirar de longe',
    )

    // Lanceiro sob ordem causar danoOrdem = 12
    const cenaLanceiro = ordenar(
      {
        ...base,
        heroi: { ...base.heroi, x: 0, z: -20 },
        unidades: [
          {
            id: 9801,
            lado: 'aliado' as const,
            papel: 'tropa' as const,
            tipoTropa: 'lanceiro' as const,
            x: 0,
            z: 0,
            hp: 30,
            postura: 'vigia' as const,
            ordem: null,
            cooldown: 0,
            segmentos: [],
            alerta: false,
          },
          {
            id: 9802,
            lado: 'inimigo' as const,
            papel: 'horda' as const,
            x: 1.3, // dentro de alcance 1.45 do lanceiro, fora do melee 1.15 do soldado
            z: 0,
            hp: 30,
            postura: 'calado' as const,
            ordem: null,
            cooldown: 0,
            segmentos: [],
            alerta: false,
          },
        ],
      },
      [9801],
      { tipo: 'atacar', alvoId: 9802 },
    )
    const aposLanc = stepPartida(cenaLanceiro, INPUT_PARADO, 0.05)
    assert(
      30 - aposLanc.unidades.find((u) => u.id === 9802)!.hp === SPEC_TROPA_ALIADA.lanceiro.danoOrdem,
      'lanceiro: atinge a 1.3m causando danoOrdem 12',
    )
  }
}
