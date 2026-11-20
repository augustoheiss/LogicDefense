import path from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const scene = readFileSync(path.join(root, 'src/games/LogicBattle/ilha/IlhaRua.tsx'), 'utf8')
const page = readFileSync(path.join(root, 'src/pages/LogicBattlePage.tsx'), 'utf8')
const sceneDirty =
  scene.includes('LogicBattleGame') ||
  scene.includes('RunCanvas') ||
  scene.includes('useNavigate') ||
  scene.includes('SandboxVoxel')
const pageDirty = !page.includes('IlhaRua') || page.includes('LogicBattleGame')
if (sceneDirty || pageDirty) {
  throw new Error('a cena não puxa o jogo velho')
}
const server = await createServer({
  root,
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
})

try {
  const mod = await server.ssrLoadModule('/src/games/LogicBattle/ilha/ruaSim.test.ts')
  mod.run()
  if (!scene.includes('rotation.y = -state.yaw')) {
    throw new Error('esquerda vira para a direita')
  }
  if (!scene.includes('Atirar')) {
    throw new Error('falta o botão de atirar')
  }
  if (!scene.includes('Continuar na rua') || scene.includes('useNavigate')) {
    throw new Error('falta a escolha de continuar na rua')
  }
  const proibido = ['LogicFriction', 'LogicDefense', 'LogicAscension', 'LogicInvaders', 'LogicTetris', '@react-three/rapier', 'SerpentCanvas', 'ArcadeEnginesCanvas']
  const vazou = proibido.find((nome) => scene.includes(nome))
  if (vazou) throw new Error(`a cena puxa ${vazou}`)
  const partida = await server.ssrLoadModule('/src/games/LogicBattle/ilha/partidaSim.test.ts')
  partida.run()
  const caminho = await server.ssrLoadModule('/src/games/LogicBattle/ilha/caminho.test.ts')
  caminho.run()
  const atlas = await server.ssrLoadModule('/src/games/LogicBattle/ilha/atlas.test.ts')
  atlas.run()
  const sandboxViva = await server.ssrLoadModule('/src/games/LogicBattle/ilha/sandboxViva.test.ts')
  sandboxViva.run()
  const blocosMundo = await server.ssrLoadModule('/src/games/LogicBattle/ilha/blocosMundo.test.ts')
  blocosMundo.run()
  const blocosNv5 = await server.ssrLoadModule('/src/games/LogicBattle/ilha/blocosNv5Blueprints.test.ts')
  blocosNv5.run()
  const alvoBloco = await server.ssrLoadModule('/src/games/LogicBattle/ilha/alvoBlocoUnificado.test.ts')
  alvoBloco.run()
  const obraLivre = await server.ssrLoadModule('/src/games/LogicBattle/ilha/obraBlocosLivres.test.ts')
  obraLivre.run()
  const atalhos = await server.ssrLoadModule('/src/games/LogicBattle/ilha/atalhosIlha.test.ts')
  atalhos.run()
  const raycast = await server.ssrLoadModule('/src/games/LogicBattle/ilha/raycastCena.test.ts')
  raycast.run()
  console.log('ilha-rua: ok')
} finally {
  await server.close()
}
