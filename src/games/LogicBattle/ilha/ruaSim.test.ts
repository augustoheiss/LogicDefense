import { generateInfiniteChallenge } from '../domain/infiniteMathEngine'
import { RIGHT_CORRIDOR_TIER_BUFF_POLICIES } from '../run/bridge3d/bridge3dPolicies'
import {
  aimRua,
  applyTierPower,
  COMBAT,
  createRua,
  OBSTACLES,
  pointerToTurn,
  restartLoop,
  RUA,
  shoot,
  stepRua,
} from './ruaSim'

function assert(condition: boolean, name: string): void {
  if (!condition) {
    throw new Error(name)
  }
}

export function run(): void {
  const start = createRua()
  assert(start.army === 10 && start.z === 0 && start.finished === false, 'inicio')
  assert(start.enemiesAlive === 20, 'vinte inimigos')

  let crossed = start
  for (let i = 0; i < 40 && !crossed.gateApplied; i++) {
    crossed = stepRua(crossed, { forward: true, back: false, strafe: 0 }, 0.1)
  }
  assert(
    crossed.gateApplied === true && crossed.army === 20 && crossed.finished === false,
    'arco soma 10',
  )

  let back = crossed
  for (let i = 0; i < 40; i++) {
    back = stepRua(back, { forward: false, back: true, strafe: 0 }, 0.1)
  }
  assert(back.z < RUA.gateZ - RUA.gateDepth, 'voltou antes do arco')
  for (let i = 0; i < 40; i++) {
    back = stepRua(back, { forward: true, back: false, strafe: 0 }, 0.1)
  }
  assert(back.army === 20 && back.gateApplied === true, 'segunda passagem não soma')

  const jumped = stepRua(createRua(), { forward: true, back: false, strafe: 0 }, 3)
  assert(jumped.gateApplied === true && jumped.army === 20, 'passo longo aplica uma vez')

  let edge = createRua()
  for (let i = 0; i < 30; i++) {
    edge = stepRua(edge, { forward: false, back: false, strafe: -1 }, 0.1)
  }
  assert(edge.x >= -RUA.halfWidth && edge.x <= RUA.halfWidth && edge.yaw === 0, 'andar de lado não gira a mira')

  let done = createRua()
  done = {
    ...done,
    enemiesAlive: 0,
    enemies: done.enemies.map((enemy) => ({ ...enemy, alive: false })),
  }
  for (let i = 0; i < 80; i++) {
    done = stepRua(done, { forward: true, back: false, strafe: 0 }, 0.1)
  }
  assert(
    done.finished === true && done.gateApplied === true && done.army === 20 && done.z >= RUA.endZ,
    'o fim só existe depois do arco',
  )
  const frozen = stepRua(done, { forward: true, back: false, strafe: 1 }, 1)
  assert(frozen.z === done.z && frozen.yaw === done.yaw && frozen.army === done.army, 'no fim a rua espera a escolha')

  const again = restartLoop(done)
  assert(
    again.army === done.army &&
      again.z === 0 &&
      again.x === 0 &&
      again.finished === false &&
      again.gateApplied === false &&
      again.enemiesAlive === 20,
    'a volta seguinte guarda o exército',
  )
  const early = stepRua(createRua(), { forward: true, back: false, strafe: 0 }, 0.5)
  const kept = restartLoop(early)
  assert(kept.z === early.z && kept.army === early.army, 'sem chegar no fim a volta não recomeça')

  let second = again
  for (let i = 0; i < 40 && !second.gateApplied; i++) {
    second = stepRua(second, { forward: true, back: false, strafe: 0 }, 0.1)
  }
  assert(
    second.gateApplied === true && second.army === again.army + 10 && second.finished === false,
    'o arco soma de novo na volta seguinte',
  )

  const idle = { forward: false, back: false, strafe: 0 as const }
  let waiting = createRua()
  waiting = { ...waiting, z: 36, aggro: true, army: 20, gateApplied: true }
  for (let i = 0; i < 80 && waiting.army === 20; i++) {
    waiting = stepRua(waiting, idle, 0.1)
  }
  assert(waiting.army < 20 && waiting.enemiesAlive < 20, 'os inimigos atacam quem espera')

  let left = createRua()
  for (let i = 0; i < 8; i++) {
    left = stepRua(left, { forward: true, back: false, strafe: -1 }, 0.1)
  }
  assert(left.x > 0.4 && left.yaw === 0, 'esquerda vai para a esquerda sem girar a mira')
  const looked = aimRua(createRua(), 0.6)
  assert(looked.yaw === 0.6 && looked.x === 0 && looked.z === 0, 'o olhar gira sem andar')
  const alongLook = stepRua(looked, { forward: true, back: false, strafe: 0 }, 0.3)
  assert(alongLook.yaw === 0.6 && alongLook.x < 0, 'andar segue a mira e não a muda')

  const crate = OBSTACLES[0]
  const blocked = stepRua(
    { ...createRua(), x: crate.x, z: crate.z - crate.hz - COMBAT.body - 0.15 },
    { forward: true, back: false, strafe: 0 },
    0.2,
  )
  assert(blocked.z < crate.z - crate.hz, 'obstáculo segura o passo')

  const touching = createRua()
  const hit = stepRua(
    {
      ...touching,
      x: 0,
      z: 30,
      enemies: touching.enemies.map((enemy, index) =>
        index === 0 ? { ...enemy, x: 0, z: 30, alive: true } : enemy,
      ),
    },
    idle,
    0.05,
  )
  assert(hit.army === 10 - COMBAT.hitDamage, 'inimigo tira soldados')
  assert(hit.enemiesAlive === 19, 'o choque derruba o inimigo')

  const chasing = { ...createRua(), x: 0, z: COMBAT.aggroZ, aggro: true }
  const full = stepRua(chasing, idle, 1, 1)
  const slow = stepRua(chasing, idle, 1, COMBAT.slowScale)
  const travel = (before: { enemies: { x: number; z: number }[] }, after: { enemies: { x: number; z: number }[] }) => {
    const from = before.enemies[0]
    const to = after.enemies[0]
    return Math.hypot(to.x - from.x, to.z - from.z)
  }
  assert(travel(chasing, slow) > 0, 'na conta o inimigo ainda anda')
  assert(
    Math.abs(travel(chasing, slow) - travel(chasing, full) * COMBAT.slowScale) < 0.05,
    'na conta a velocidade fica em 10%',
  )

  const aimed = { ...createRua(), x: 0, z: 30, yaw: 0 }
  const shot = shoot(aimed)
  assert(shot.enemiesAlive === 19, 'tiro derruba um inimigo à frente')
  assert(shoot(shot).enemiesAlive === 19, 'recarga segura o segundo tiro')
  const reloaded = shoot(stepRua(shot, idle, COMBAT.shootCooldown, 1))
  assert(reloaded.enemiesAlive === 18, 'depois da recarga atira de novo')

  assert(pointerToTurn(10, 100) === -1, 'toque nas metades esquerda')
  assert(pointerToTurn(80, 100) === 1, 'toque nas metades direita')
  assert(pointerToTurn(0, 0) === 0, 'toque sem largura')

  const easy = RIGHT_CORRIDOR_TIER_BUFF_POLICIES[1]
  const powered = applyTierPower(createRua(), 1)
  const wiped = Math.max(1, Math.round(20 * easy.enemyWipeRatio))
  const bonus = Math.max(Math.floor(10 * easy.armyBonusRatio), easy.minFlatSoldiers)
  assert(powered.enemiesAlive === 20 - wiped, 'grau 1 abate 35%')
  assert(powered.army === 10 + bonus, 'grau 1 soma o bônus da tabela')

  const wipedAll = applyTierPower(createRua(), 4)
  assert(wipedAll.enemiesAlive === 0, 'grau 4 abate todos')

  const challenge = generateInfiniteChallenge({ tier: 1, seed: 42 })
  assert(
    challenge.choices.filter((choice) => choice.isCorrect).length === 1,
    'a conta tem uma resposta certa',
  )
}
