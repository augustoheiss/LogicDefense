import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

// Laboratório do relevo (24/11/2026): escreve PNGs do terreno SEM tocar no jogo. Uso:
//   node scripts/relevo-preview.mjs [pastaDeSaida]
// Escreve `mapa-janela-6.png` (13×13 quadrados, de −6 a +6) e uma amostra por bioma `bioma-<id>.png` (3×3 quadrados com o bioma no centro).
// Cores: azul = água, vermelho = penhasco (declive > 0,75, onde as regras de F3 vão morder), o resto é a cor hipsométrica do bioma sombreada com o sol a noroeste.
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const saida = path.resolve(process.argv[2] ?? path.join(raiz, 'src/games/LogicBattle/master-plan/relevo-aoe/medicoes/F0'))
mkdirSync(saida, { recursive: true })

const server = await createServer({ root: raiz, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
try {
  const lab = await server.ssrLoadModule('/src/games/LogicBattle/ilha/relevo/laboratorio.ts')
  const rec = await server.ssrLoadModule('/src/games/LogicBattle/ilha/biomaRecursos.ts')

  const gravar = (nome, janela) => {
    const png = lab.codificarPng(janela.largura, janela.altura, janela.rgba)
    const arquivo = path.join(saida, nome)
    writeFileSync(arquivo, png)
    console.log(`${nome}: ${janela.largura}x${janela.altura} px, ${(png.length / 1024).toFixed(0)} KB`)
  }

  const t0 = Date.now()
  gravar('mapa-janela-6.png', lab.montarJanela(-6, -6, 6, 6))

  // uma amostra por bioma: o primeiro quadrado de cada bioma achado no mundo, com a vizinhança 3×3 em volta (a emenda também aparece)
  const achado = new Map()
  for (let i = -8; i <= 8 && achado.size < 6; i += 1) {
    for (let j = -8; j <= 8 && achado.size < 6; j += 1) {
      const b = rec.biomaDoQuadrado(i, j)
      if (!achado.has(b)) achado.set(b, [i, j])
    }
  }
  for (const [bioma, [i, j]] of achado) gravar(`bioma-${bioma}.png`, lab.montarJanela(i - 1, j - 1, i + 1, j + 1))
  console.log(`biomas amostrados: ${[...achado].map(([b, [i, j]]) => `${b}@(${i},${j})`).join('  ')}`)
  console.log(`pronto em ${((Date.now() - t0) / 1000).toFixed(1)} s, saída: ${saida}`)
} finally {
  await server.close()
}
