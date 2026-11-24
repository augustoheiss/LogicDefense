import { PARTIDA } from './partidaPolicies'
import { createPartida, fundar, INPUT_PARADO, ordenar, ordenarHeroi, pararUnidades, stepPartida, type PartidaState } from './partidaSim'

function assert(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem)
}

export function run(): void {
  // 1) Patrulha A <-> B: caminha até B, inverte para A, engaja inimigo no caminho e retoma patrulha ao vencer
  {
    const base: PartidaState = {
      ...createPartida(0, 0),
      obras: [],
      recursos: [],
      lagoas: [],
      heroi: { ...createPartida(0, 0).heroi, x: -30, z: -30 },
      unidades: [
        {
          id: 9101,
          lado: 'aliado',
          papel: 'tropa',
          tipoTropa: 'soldado',
          x: 0,
          z: 0,
          hp: 40,
          postura: 'vigia',
          posturaBase: 'vigia',
          ordem: null,
          ancora: null,
          cooldown: 0,
          segmentos: [],
          alerta: false,
        },
      ],
    }

    let s = ordenar(base, [9101], { tipo: 'patrulhar', ax: 0, az: 0, bx: 8, bz: 0, indoPara: 'b' })
    assert(s.unidades[0].ordem?.tipo === 'patrulhar', 'patrulha: ordem atribuída')

    // Avanca ~1.5s: tropa chega perto de B (8,0) e inverte sentido para A
    for (let k = 0; k < 30; k += 1) {
      s = stepPartida(s, INPUT_PARADO, 0.05)
    }
    const aposB = s.unidades.find((u) => u.id === 9101)!
    assert(
      aposB.ordem?.tipo === 'patrulhar' && aposB.ordem.indoPara === 'a',
      `patrulha: deveria inverter para 'a' após atingir B (x=${aposB.x.toFixed(2)}, indoPara=${aposB.ordem?.tipo === 'patrulhar' ? aposB.ordem.indoPara : 'null'})`,
    )

    // Coloca inimigo perto da rota de volta -> patrulheiro engaja, elimina e continua patrulhando!
    s = {
      ...s,
      unidades: [
        ...s.unidades,
        {
          id: 9199,
          lado: 'inimigo',
          papel: 'horda',
          x: aposB.x - 1.5,
          z: 0,
          hp: 10,
          postura: 'calado',
          ordem: null,
          cooldown: 0,
          segmentos: [],
          alerta: false,
        },
      ],
    }
    for (let k = 0; k < 30; k += 1) {
      s = stepPartida(s, INPUT_PARADO, 0.05)
    }
    const ini = s.unidades.find((u) => u.id === 9199)!
    const patr = s.unidades.find((u) => u.id === 9101)!
    assert(ini.hp <= 0, 'patrulha: eliminou inimigo encontrado na ronda')
    assert(patr.ordem?.tipo === 'patrulhar', 'patrulha: retomou ronda após abater inimigo')
  }

  // 2) Attack-Move (A): engaja inimigo no caminho e conclui marcha até o ponto destino
  {
    const base: PartidaState = {
      ...createPartida(0, 0),
      obras: [],
      recursos: [],
      lagoas: [],
      heroi: { ...createPartida(0, 0).heroi, x: -30, z: -30 },
      unidades: [
        {
          id: 9201,
          lado: 'aliado',
          papel: 'tropa',
          tipoTropa: 'soldado',
          x: 0,
          z: 0,
          hp: 40,
          postura: 'vigia',
          posturaBase: 'vigia',
          ordem: null,
          ancora: null,
          cooldown: 0,
          segmentos: [],
          alerta: false,
        },
        {
          id: 9202,
          lado: 'inimigo',
          papel: 'horda',
          x: 5,
          z: 0,
          hp: 10,
          postura: 'calado',
          ordem: null,
          cooldown: 0,
          segmentos: [],
          alerta: false,
        },
      ],
    }
    let s = ordenar(base, [9201], { tipo: 'attackMove', x: 12, z: 0 })
    for (let k = 0; k < 60; k += 1) {
      s = stepPartida(s, INPUT_PARADO, 0.05)
    }
    const u = s.unidades.find((x) => x.id === 9201)!
    const ini = s.unidades.find((x) => x.id === 9202)!
    assert(ini.hp <= 0, 'attackMove: abateu inimigo no caminho')
    assert(Math.hypot(u.x - 12, u.z) < 2.2, `attackMove: continuou até o destino (x=${u.x.toFixed(2)})`)
  }

  // 3) Parar (S): limpa ordem, ancora e retorna a postura base segura
  {
    let s = fundar({ ...createPartida(0, 0), unidades: [] }, 'nucleo', -12, -12)
    s = {
      ...s,
      unidades: [
        {
          id: 9301,
          lado: 'aliado',
          papel: 'tropa',
          tipoTropa: 'soldado',
          x: 0,
          z: 0,
          hp: 20,
          postura: 'vigia',
          posturaBase: 'vigia',
          ordem: null,
          ancora: null,
          cooldown: 0,
          segmentos: [],
          alerta: false,
        },
      ],
    }
    s = ordenar(s, [9301], { tipo: 'mover', x: 20, z: 20 })
    assert(s.unidades[0].postura === 'ordens' && s.unidades[0].ordem !== null, 'parar: inicialmente tem ordem')
    s = pararUnidades(s, [9301], true)
    assert(
      s.unidades[0].ordem === null && s.unidades[0].postura === 'vigia' && s.unidades[0].x < PARTIDA.radius,
      'parar: limpa ordem e restaura vigia',
    )
  }

  // 4) Herói em modo Império executa patrulha real A <-> B e attackMove engajando inimigos
  {
    let h: PartidaState = {
      ...createPartida(0, 0),
      obras: [],
      recursos: [],
      lagoas: [],
      unidades: [],
      olhar: 'imperio' as const,
      heroi: { ...createPartida(0, 0).heroi, x: 0, z: 0, army: 20, shootCooldown: 0 },
    }
    h = ordenarHeroi(h, { tipo: 'patrulhar', ax: 0, az: 0, bx: 8, bz: 0, indoPara: 'b' })
    for (let k = 0; k < 22; k += 1) h = stepPartida(h, INPUT_PARADO, 0.05)
    assert(
      h.heroiOrdem?.tipo === 'patrulhar' && h.heroiOrdem.indoPara === 'a',
      'heroi patrulha: inverte sentido para ponto A após alcançar B',
    )

    let hm: PartidaState = {
      ...createPartida(0, 0),
      obras: [],
      recursos: [],
      lagoas: [],
      olhar: 'imperio' as const,
      heroi: { ...createPartida(0, 0).heroi, x: 0, z: 0, army: 20, shootCooldown: 0 },
      unidades: [
        {
          id: 9401,
          lado: 'inimigo' as const,
          papel: 'horda' as const,
          x: 6,
          z: 0,
          hp: 10,
          postura: 'calado' as const,
          ordem: null,
          cooldown: 0,
          segmentos: [],
          alerta: false,
        },
      ],
    }
    hm = ordenarHeroi(hm, { tipo: 'attackMove', x: 14, z: 0 })
    for (let k = 0; k < 50; k += 1) hm = stepPartida(hm, INPUT_PARADO, 0.05)
    assert(hm.unidades.find((u) => u.id === 9401)!.hp <= 0, 'heroi attackMove: abateu inimigo no caminho')
    assert(hm.heroi.x > 10, 'heroi attackMove: retomou deslocamento ao destino')
  }
}
