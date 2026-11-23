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
  const camadaDoMapa = await server.ssrLoadModule('/src/games/LogicBattle/ilha/camadaDoMapa.test.ts')
  camadaDoMapa.run()
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
  const textosVida = await server.ssrLoadModule('/src/games/LogicBattle/ilha/textosVida.test.ts')
  textosVida.run()
  const memoriaDeContas = await server.ssrLoadModule('/src/games/LogicBattle/ilha/memoriaDeContas.test.ts')
  memoriaDeContas.run()
  const buffPorErro = await server.ssrLoadModule('/src/games/LogicBattle/ilha/buffPorErro.test.ts')
  buffPorErro.run()
  const cadernoDeEstudo = await server.ssrLoadModule('/src/games/LogicBattle/ilha/cadernoDeEstudo.test.ts')
  cadernoDeEstudo.run()
  const geradoresProblemas = await server.ssrLoadModule('/src/games/LogicBattle/ilha/geradoresProblemas.test.ts')
  geradoresProblemas.run()
  const diagnosticosSemGabarito = await server.ssrLoadModule('/src/games/LogicBattle/ilha/diagnosticosSemGabarito.test.ts')
  diagnosticosSemGabarito.run()
  const dicasSemGabarito = await server.ssrLoadModule('/src/games/LogicBattle/ilha/estudo/dicasSemGabarito.test.ts')
  const geradoresEnemMod = await server.ssrLoadModule('/src/games/LogicBattle/ilha/estudo/geradoresEnem.ts')
  const enemLote1Mod = await server.ssrLoadModule('/src/games/LogicBattle/ilha/estudo/bancos/enemMatematicaLote1.ts')
  dicasSemGabarito.run([
    ...enemLote1Mod.ENEM_MATEMATICA_LOTE1,
    ...geradoresEnemMod.GERADORES_ENEM_PARAMETRICOS.map((g) => g.reserva()),
  ])
  const repositorioEstudoTest = await server.ssrLoadModule('/src/games/LogicBattle/ilha/estudo/repositorioEstudo.test.ts')
  await repositorioEstudoTest.run()
  const diagnosticoEstudoTest = await server.ssrLoadModule('/src/games/LogicBattle/ilha/estudo/diagnosticoEstudo.test.ts')
  diagnosticoEstudoTest.run()
  const geradoresEnemTest = await server.ssrLoadModule('/src/games/LogicBattle/ilha/estudo/geradoresEnem.test.ts')
  geradoresEnemTest.run()
  const orquestradorQuestoesTest = await server.ssrLoadModule('/src/games/LogicBattle/ilha/estudo/orquestradorQuestoes.test.ts')
  await orquestradorQuestoesTest.run()
  const contratoDoHud = await server.ssrLoadModule('/src/games/LogicBattle/ilha/contratoDoHud.test.ts')
  const cssDaIlha = readFileSync(path.join(root, 'src/games/LogicBattle/ilha/ilha.css'), 'utf8')
  contratoDoHud.run(scene, cssDaIlha)
  contratoDoHud.rodarContraAdulteracoes(scene, cssDaIlha)
  const minimapaDono = await server.ssrLoadModule('/src/games/LogicBattle/ilha/minimapaDono.test.ts')
  minimapaDono.run(scene, cssDaIlha)
  minimapaDono.rodarContraAdulteracoes(scene, cssDaIlha)
  const haloInimigo = await server.ssrLoadModule('/src/games/LogicBattle/ilha/haloInimigo.test.ts')
  haloInimigo.run()
  const destinoDoClique = await server.ssrLoadModule('/src/games/LogicBattle/ilha/destinoDoClique.test.ts')
  destinoDoClique.run()
  const listaDeConstrucoes = await server.ssrLoadModule('/src/games/LogicBattle/ilha/listaDeConstrucoes.test.ts')
  listaDeConstrucoes.run()
  const baseInimigaEvolui = await server.ssrLoadModule('/src/games/LogicBattle/ilha/baseInimigaEvolui.test.ts')
  baseInimigaEvolui.run()
  const derrotaGlobal = await server.ssrLoadModule('/src/games/LogicBattle/ilha/derrotaGlobal.test.ts')
  derrotaGlobal.run()
  const evolucaoObra = await server.ssrLoadModule('/src/games/LogicBattle/ilha/evolucaoObra.test.ts')
  evolucaoObra.run()
  const evolucaoNaPartida = await server.ssrLoadModule('/src/games/LogicBattle/ilha/evolucaoNaPartida.test.ts')
  evolucaoNaPartida.run()
  const painelDeConstrucoesContrato = await server.ssrLoadModule('/src/games/LogicBattle/ilha/painelDeConstrucoesContrato.test.ts')
  const painelDeConstrucoes = readFileSync(path.join(root, 'src/games/LogicBattle/ilha/PainelDeConstrucoes.tsx'), 'utf8')
  const painelDeConstrucoesCss = readFileSync(path.join(root, 'src/games/LogicBattle/ilha/painelDeConstrucoes.css'), 'utf8')
  painelDeConstrucoesContrato.run(painelDeConstrucoes, scene, painelDeConstrucoesCss)
  painelDeConstrucoesContrato.rodarContraAdulteracoes(painelDeConstrucoes, scene, painelDeConstrucoesCss)
  const bordaDoMapaContrato = await server.ssrLoadModule('/src/games/LogicBattle/ilha/bordaDoMapaContrato.test.ts')
  const bordaDoMapa = readFileSync(path.join(root, 'src/games/LogicBattle/ilha/BordaDoMapa.tsx'), 'utf8')
  bordaDoMapaContrato.run(bordaDoMapa, scene)
  bordaDoMapaContrato.rodarContraAdulteracoes(bordaDoMapa, scene)
  const cameraImperio = await server.ssrLoadModule('/src/games/LogicBattle/ilha/cameraImperio.test.ts')
  cameraImperio.run()
  const gestaoObra = await server.ssrLoadModule('/src/games/LogicBattle/ilha/gestaoObra.test.ts')
  gestaoObra.run()
  const memoriaMinimapas = await server.ssrLoadModule('/src/games/LogicBattle/ilha/memoriaMinimapas.test.ts')
  memoriaMinimapas.run()
  const biomaVisual = await server.ssrLoadModule('/src/games/LogicBattle/ilha/visual/biomaVisual.test.ts')
  await biomaVisual.run()
  console.log('ilha-rua: ok')
} finally {
  await server.close()
}
