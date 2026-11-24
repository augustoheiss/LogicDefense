import { PARTIDA, SPEC_TROPA_ALIADA } from './partidaPolicies'
import {
  atirar,
  createPartida,
  definirOlhar,
  INPUT_PARADO,
  mira,
  ordenar,
  pular,
  stepPartida,
  type PartidaState,
} from './partidaSim'
import { alvoPossuidoVivo, entrarEmPosseTropa, sairDaPosse } from './posseDaTropa'

function assert(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem)
}

export function run(): void {
  // 1) Entra em posse (1ª/3ª pessoa), suspende IA autônoma da tropa e responde WASD / mira / pulo
  {
    let base: PartidaState = {
      ...createPartida(0, 0),
      obras: [],
      recursos: [],
      lagoas: [],
      heroi: { ...createPartida(0, 0).heroi, x: -25, z: -25, yaw: 0, pitch: 0 },
      unidades: [
        {
          id: 8101,
          lado: 'aliado',
          papel: 'tropa',
          tipoTropa: 'arqueiro',
          x: 0,
          z: 0,
          hp: 25,
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

    // Dá ordem prévia e entra em posse -> ordem é limpa e unidade é possuída em 1ª pessoa
    base = ordenar(base, [8101], { tipo: 'mover', x: 20, z: 20 })
    let s = entrarEmPosseTropa(base, 8101, 'primeira')
    assert(s.olhar === 'primeira' && s.posse?.unidadeId === 8101, 'posse: entra em 1ª pessoa')
    assert(s.unidades[0].ordem === null, 'posse: suspende/limpa ordem autônoma prévia')
    assert(alvoPossuidoVivo(s)?.id === 8101, 'posse: alvoPossuidoVivo encontra a tropa')

    // Move com W (forward): tropa avança ao longo de +Z (yaw=0), herói fica imóvel
    const heroiAntesX = s.heroi.x
    const heroiAntesZ = s.heroi.z
    s = pular(s)
    assert((s.posse?.vy ?? 0) > 0, 'posse: pular aplica vy na tropa possuída')
    for (let k = 0; k < 10; k += 1) {
      s = stepPartida(s, { ...INPUT_PARADO, forward: true }, 0.05)
    }
    const tropaMovida = s.unidades.find((u) => u.id === 8101)!
    assert(tropaMovida.z > 2.0, `posse: WASD move tropa possuída em +Z (z=${tropaMovida.z.toFixed(2)})`)
    assert(s.heroi.x === heroiAntesX && s.heroi.z === heroiAntesZ, 'posse: herói principal não anda com WASD da posse')

    // Mira e dispara com alcance e dano do Arqueiro possuído (alcance 10m, dano 9)
    const comAlvo: PartidaState = {
      ...s,
      posse: { ...s.posse!, yaw: 0, pitch: 0, shootCooldown: 0 },
      unidades: [
        ...s.unidades,
        {
          id: 8199,
          lado: 'inimigo',
          papel: 'horda',
          x: tropaMovida.x,
          z: tropaMovida.z + 7.5,
          hp: 30,
          postura: 'calado',
          ordem: null,
          cooldown: 0,
          segmentos: [],
          alerta: false,
        },
      ],
    }
    const aposTiro = atirar(mira(comAlvo, 0, 0))
    const iniApos = aposTiro.unidades.find((u) => u.id === 8199)!
    assert(
      Math.abs(30 - iniApos.hp - SPEC_TROPA_ALIADA.arqueiro.danoOrdem * 1.3) < 0.01,
      `posse: tiro da tropa possuída aplica danoOrdem * 1.3x AoE (${SPEC_TROPA_ALIADA.arqueiro.danoOrdem * 1.3}, causou ${30 - iniApos.hp})`,
    )
  }

  // 2) Morte da tropa possuída (abatida por torre inimiga) libera a posse automaticamente (sem Game Over!)
  {
    const base: PartidaState = {
      ...createPartida(0, 0),
      heroi: { ...createPartida(0, 0).heroi, x: -30, z: -30 },
      obras: [
        {
          id: 8299,
          tipo: 'torre',
          lado: 'inimigo',
          x: 3,
          z: 0,
          hp: 50,
          maxHp: 50,
          nivel: 1,
          gateApplied: false,
          cooldown: 0,
        },
      ],
      recursos: [],
      lagoas: [],
      unidades: [
        {
          id: 8201,
          lado: 'aliado',
          papel: 'tropa',
          tipoTropa: 'soldado',
          x: 0,
          z: 0,
          hp: 1,
          postura: 'vigia',
          ordem: null,
          cooldown: 0,
          segmentos: [],
          alerta: false,
        },
      ],
    }
    let s = entrarEmPosseTropa(base, 8201, 'terceira')
    assert(s.posse?.unidadeId === 8201, 'posse: iniciou em 3ª pessoa')
    s = stepPartida(s, INPUT_PARADO, 0.05)
    assert(s.posse === null, 'posse: morte da tropa possuída libera posse automaticamente')
    assert(s.olhar === 'imperio' && !s.derrota, 'posse: retorno seguro ao modo Império sem Game Over')
  }

  // 3) Saída manual via definirOlhar('imperio') ou sairDaPosse('terceira') limpa posse
  {
    const base: PartidaState = {
      ...createPartida(0, 0),
      unidades: [
        {
          id: 8301,
          lado: 'aliado',
          papel: 'tropa',
          tipoTropa: 'lanceiro',
          x: 0,
          z: 0,
          hp: PARTIDA.melee * 20,
          postura: 'vigia',
          ordem: null,
          cooldown: 0,
          segmentos: [],
          alerta: false,
        },
      ],
    }
    const p1 = entrarEmPosseTropa(base, 8301, 'primeira')
    const p2 = definirOlhar(p1, 'imperio')
    assert(p2.posse === null && p2.olhar === 'imperio', 'posse: ir para Império limpa posse')
    const p3 = entrarEmPosseTropa(base, 8301, 'terceira')
    const p4 = sairDaPosse(p3, 'terceira')
    assert(p4.posse === null && p4.olhar === 'terceira', 'posse: sairDaPosse retorna controle ao Herói')
  }
}
