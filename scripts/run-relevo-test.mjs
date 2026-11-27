import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

// Runner PRÓPRIO do relevo e do visual AoE (24/11/2026). Não edita o `run-ilha-rua-test.mjs`, que a outra frente (estudo/ENEM) altera.
// Cada módulo de teste exporta `run()` (síncrono ou assíncrono) e é carregado pelo Vite em modo SSR, como os outros runners da ilha.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const server = await createServer({
  root,
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  logLevel: 'error',
})

const MODULOS = [
  '/src/games/LogicBattle/ilha/relevo/relevo.test.ts',
  '/src/games/LogicBattle/ilha/visual/nevoaDeGuerra.test.ts',
  '/src/games/LogicBattle/ilha/visual/decisaoPosProcessamento.test.ts',
  '/src/games/LogicBattle/ilha/visual/ceuEIbl.test.ts',
  '/src/games/LogicBattle/ilha/visual/flagstone.test.ts',
  '/src/games/LogicBattle/ilha/visual/cicloDePacote.test.ts',
  '/src/games/LogicBattle/ilha/visual/tarefaFatiada.test.ts',
  '/src/games/LogicBattle/ilha/visual/campoDoSolo.test.ts',
  '/src/games/LogicBattle/ilha/relevo/relevoVisual.test.ts',
  '/src/games/LogicBattle/ilha/relevo/relevoNoEstado.test.ts',
  '/src/games/LogicBattle/ilha/relevo/geometriaDoTerreno.test.ts',
  '/src/games/LogicBattle/ilha/relevo/misturaDoTerreno.test.ts',
  '/src/games/LogicBattle/ilha/relevo/materialTerrenoRelevo.test.ts',
  '/src/games/LogicBattle/ilha/relevo/terrenoRelevoCena.test.ts',
  '/src/games/LogicBattle/ilha/visual/glslDaNevoa.test.ts',
  '/src/games/LogicBattle/ilha/relevo/nevoaNoTerreno.test.ts',
  '/src/games/LogicBattle/ilha/sandboxViva.test.ts',
  '/src/games/LogicBattle/ilha/visual/biomaVisual.test.ts',
  '/src/games/LogicBattle/ilha/relevo/propsNoTerreno.test.ts',
  '/src/games/LogicBattle/ilha/relevo/obrasNoTerreno.test.ts',
  '/src/games/LogicBattle/ilha/relevo/apoioNaAgua.test.ts',
  '/src/games/LogicBattle/ilha/relevo/alturaDoAtor.test.ts',
  '/src/games/LogicBattle/ilha/relevo/ligacaoDoAtor.test.ts',
  '/src/games/LogicBattle/ilha/relevo/raioTerreno.test.ts',
  '/src/games/LogicBattle/ilha/relevo/irParaMapa.test.ts',
  '/src/games/LogicBattle/ilha/relevo/segmentosDaPatrulha.test.ts',
  '/src/games/LogicBattle/ilha/relevo/chaoDoMundoNaCena.test.ts',
  '/src/games/LogicBattle/ilha/relevo/chaoDaMalha.test.ts',
  '/src/games/LogicBattle/ilha/relevo/aguaDoMundo.test.ts',
  '/src/games/LogicBattle/ilha/relevo/aguaNoGerador.test.ts',
  '/src/games/LogicBattle/ilha/relevo/geometriaDaAgua.test.ts',
  '/src/games/LogicBattle/ilha/visual/fitaDoRio.test.ts',
  '/src/games/LogicBattle/ilha/relevo/geometriaDoHorizonte.test.ts',
  '/src/games/LogicBattle/ilha/relevo/sondaDeAlturas.test.ts',
  '/src/games/LogicBattle/ilha/visual/efeitosAmbiente.test.ts',
  '/src/games/LogicBattle/ilha/visual/nuvensFbm.test.ts',
  '/src/games/LogicBattle/ilha/visual/ventoVegetacao.test.ts',
  '/src/games/LogicBattle/ilha/visual/efeitosAmbienteCena.test.ts',
  '/src/games/LogicBattle/ilha/visual/respostasDoMundo.test.ts',
  '/src/games/LogicBattle/ilha/visual/minimapaRelevo.test.ts',
]

// Os contratos de TEXTO (como `contratoDoHud`) recebem o fonte da cena e das políticas: o desenho vive no React e o runner roda no Node, sem GPU.
const cena = readFileSync(path.join(root, 'src/games/LogicBattle/ilha/IlhaRua.tsx'), 'utf8')
const politicas = readFileSync(path.join(root, 'src/games/LogicBattle/ilha/partidaPolicies.ts'), 'utf8')
const componenteNevoa = readFileSync(path.join(root, 'src/games/LogicBattle/ilha/visual/NevoaPintada.tsx'), 'utf8')
const atmosfera = readFileSync(path.join(root, 'src/games/LogicBattle/ilha/visual/AtmosferaBioma.tsx'), 'utf8')
const cenaBioma = readFileSync(path.join(root, 'src/games/LogicBattle/ilha/visual/CenaBiomaVisual.tsx'), 'utf8')
const texturas = readFileSync(path.join(root, 'src/games/LogicBattle/ilha/visual/texturasPbrProcedural.ts'), 'utf8')
const terreno = readFileSync(path.join(root, 'src/games/LogicBattle/ilha/visual/TerrenoBiomaCena.tsx'), 'utf8')
const propsBioma = readFileSync(path.join(root, 'src/games/LogicBattle/ilha/visual/PropsBiomaInstanced.tsx'), 'utf8')
const fundacaoObra = readFileSync(path.join(root, 'src/games/LogicBattle/ilha/visual/FundacaoObraCena.tsx'), 'utf8')
const sandboxCena = readFileSync(path.join(root, 'src/games/LogicBattle/ilha/MundoSandboxCena.tsx'), 'utf8')
const obrasCena = readFileSync(path.join(root, 'src/games/LogicBattle/ilha/ObrasArquiteturaCena.tsx'), 'utf8')
const horizonteRelevo = existsSync(path.join(root, 'src/games/LogicBattle/ilha/visual/HorizonteRelevo.tsx')) ? readFileSync(path.join(root, 'src/games/LogicBattle/ilha/visual/HorizonteRelevo.tsx'), 'utf8') : ''
const aguaBioma = readFileSync(path.join(root, 'src/games/LogicBattle/ilha/visual/AguaBiomaShader.tsx'), 'utf8')
const fitaDoRio = existsSync(path.join(root, 'src/games/LogicBattle/ilha/visual/FitaDoRio.tsx')) ? readFileSync(path.join(root, 'src/games/LogicBattle/ilha/visual/FitaDoRio.tsx'), 'utf8') : ''
const tropasCena = readFileSync(path.join(root, 'src/games/LogicBattle/ilha/TropasCena.tsx'), 'utf8')
const terrenoRelevo = existsSync(path.join(root, 'src/games/LogicBattle/ilha/visual/TerrenoRelevoCena.tsx')) ? readFileSync(path.join(root, 'src/games/LogicBattle/ilha/visual/TerrenoRelevoCena.tsx'), 'utf8') : ''
const nuvensBioma = existsSync(path.join(root, 'src/games/LogicBattle/ilha/visual/NuvensBioma.tsx')) ? readFileSync(path.join(root, 'src/games/LogicBattle/ilha/visual/NuvensBioma.tsx'), 'utf8') : ''
const particulasBioma = existsSync(path.join(root, 'src/games/LogicBattle/ilha/visual/ParticulasBioma.tsx')) ? readFileSync(path.join(root, 'src/games/LogicBattle/ilha/visual/ParticulasBioma.tsx'), 'utf8') : ''
const passarosBioma = existsSync(path.join(root, 'src/games/LogicBattle/ilha/visual/PassarosBioma.tsx')) ? readFileSync(path.join(root, 'src/games/LogicBattle/ilha/visual/PassarosBioma.tsx'), 'utf8') : ''
const tochasObras = existsSync(path.join(root, 'src/games/LogicBattle/ilha/visual/TochasEFumacaObras.tsx')) ? readFileSync(path.join(root, 'src/games/LogicBattle/ilha/visual/TochasEFumacaObras.tsx'), 'utf8') : ''
const efeitosJogo = existsSync(path.join(root, 'src/games/LogicBattle/ilha/visual/EfeitosDeJogo.tsx')) ? readFileSync(path.join(root, 'src/games/LogicBattle/ilha/visual/EfeitosDeJogo.tsx'), 'utf8') : ''
const ilhaCss = readFileSync(path.join(root, 'src/games/LogicBattle/ilha/ilha.css'), 'utf8')

// Os insumos do `aguaNoGerador.test.ts`: o projeto não tem `@types/node`, então QUEM lê os arquivos e calcula o SHA-1 é o runner (os hashes do gerador de ANTES da água e os 13 rios medidos no protótipo).
const insumosDoGerador = {
  hashes: readFileSync(path.join(root, 'src/games/LogicBattle/ilha/relevo/aguaNoGerador.hashes.json'), 'utf8'),
  prototipo: readFileSync(path.join(root, '.superpowers/agua/rios-do-prototipo.json'), 'utf8'),
  sha1: (a) => createHash('sha1').update(Buffer.from(a.buffer, a.byteOffset, a.byteLength)).digest('hex'),
}

// `RELEVO_SO=<trecho do nome>` roda SÓ os módulos que contêm o trecho (ciclo rápido de mutação: o `relevo.test.ts` sozinho leva ~100 s). Uma rodada parcial imprime OUTRA mensagem: só
// `relevo: ok` vale como portão.
const filtro = process.env.RELEVO_SO
const escolhidos = filtro ? MODULOS.filter((m) => m.includes(filtro)) : MODULOS
if (escolhidos.length === 0) throw new Error(`RELEVO_SO=${filtro} não casa com nenhum módulo`)

try {
  for (const modulo of escolhidos) {
    const mod = await server.ssrLoadModule(modulo)
    // cada módulo recebe só o que usa, por POSIÇÃO: `ceuEIbl.test.ts` lê só a atmosfera (1º argumento); os demais seguem a ordem de antes
    await (modulo.endsWith('aguaNoGerador.test.ts') ? mod.run(insumosDoGerador) : modulo.endsWith('efeitosAmbienteCena.test.ts') ? mod.run(politicas, cenaBioma, nuvensBioma, particulasBioma, passarosBioma, tochasObras, propsBioma, efeitosJogo) : modulo.endsWith('minimapaRelevo.test.ts') ? mod.run(cena, ilhaCss) : modulo.endsWith('fitaDoRio.test.ts') ? mod.run(fitaDoRio, aguaBioma) : modulo.endsWith('ceuEIbl.test.ts') ? mod.run(atmosfera, cenaBioma) : modulo.endsWith('flagstone.test.ts') ? mod.run(texturas, terreno, componenteNevoa, cenaBioma) : modulo.endsWith('cicloDePacote.test.ts') ? mod.run(cenaBioma) : modulo.endsWith('tarefaFatiada.test.ts') ? mod.run() : modulo.endsWith('campoDoSolo.test.ts') ? mod.run(texturas) : modulo.endsWith('terrenoRelevoCena.test.ts') ? mod.run(terrenoRelevo, cenaBioma, cena, componenteNevoa, horizonteRelevo) : modulo.endsWith('ligacaoDoAtor.test.ts') ? mod.run(cena, tropasCena) : modulo.endsWith('chaoDoMundoNaCena.test.ts') ? mod.run(cena) : modulo.endsWith('propsNoTerreno.test.ts') ? mod.run(propsBioma, fundacaoObra, sandboxCena) : modulo.endsWith('obrasNoTerreno.test.ts') ? mod.run(obrasCena) : modulo.endsWith('relevoVisual.test.ts') || modulo.endsWith('relevoNoEstado.test.ts') || modulo.endsWith('geometriaDoTerreno.test.ts') || modulo.endsWith('misturaDoTerreno.test.ts') || modulo.endsWith('materialTerrenoRelevo.test.ts') || modulo.endsWith('glslDaNevoa.test.ts') || modulo.endsWith('nevoaNoTerreno.test.ts') || modulo.endsWith('sandboxViva.test.ts') || modulo.endsWith('biomaVisual.test.ts') || modulo.endsWith('alturaDoAtor.test.ts') || modulo.endsWith('raioTerreno.test.ts') || modulo.endsWith('irParaMapa.test.ts') || modulo.endsWith('segmentosDaPatrulha.test.ts') || modulo.endsWith('chaoDaMalha.test.ts') || modulo.endsWith('aguaDoMundo.test.ts') || modulo.endsWith('efeitosAmbiente.test.ts') || modulo.endsWith('nuvensFbm.test.ts') || modulo.endsWith('ventoVegetacao.test.ts') || modulo.endsWith('respostasDoMundo.test.ts') ? mod.run() : mod.run(cena, politicas, componenteNevoa, atmosfera))
  }
  console.log(filtro ? `relevo (parcial: ${filtro}, ${escolhidos.length} de ${MODULOS.length} módulos): ok` : 'relevo: ok')
} finally {
  await server.close()
}
