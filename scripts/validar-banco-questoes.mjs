import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkMath from 'remark-math'
import { createServer } from 'vite'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const publicDir = path.join(root, 'public')
const questoesDir = path.join(publicDir, 'questoes')
const indicePath = path.join(questoesDir, 'indice.json')

const MAX_INDICE_BYTES = 512 * 1024
const MAX_CHUNK_BYTES = 256 * 1024
const MAX_FIGURAS_BYTES = 35 * 1024 * 1024

function assert(cond, msg) {
  if (!cond) throw new Error(`validar-banco-questoes: ${msg}`)
}

function somaBytesRecursivo(dir) {
  if (!existsSync(dir)) return 0
  let total = 0
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    total += entry.isDirectory() ? somaBytesRecursivo(full) : statSync(full).size
  }
  return total
}

function listarArquivosJson(dir) {
  const out = []
  for (const sub of ['enem', 'senai', 'etec']) {
    const pasta = path.join(dir, sub)
    if (!existsSync(pasta)) continue
    for (const f of readdirSync(pasta)) {
      if (f.endsWith('.json')) out.push(path.join(pasta, f))
    }
  }
  return out.sort()
}

assert(existsSync(indicePath), 'public/questoes/indice.json não existe; rode scripts/questoes/05_compilar_acervo.mjs')
const indiceBytes = statSync(indicePath).size
assert(indiceBytes <= MAX_INDICE_BYTES, `indice.json excedeu ${Math.round(MAX_INDICE_BYTES / 1024)} KB (${indiceBytes} B)`)

const indice = JSON.parse(readFileSync(indicePath, 'utf8'))
assert(indice && indice.versao === 1 && Array.isArray(indice.entradas), 'estrutura de indice.json inválida')
assert(indice.entradas.length > 0, 'indice.json sem entradas')

const chunkUrlsEsperadas = new Set()
const entradasPorId = new Map()
for (const e of indice.entradas) {
  assert(e.id && e.assinatura && e.chunkUrl, `entrada incompleta no índice: ${JSON.stringify(e)}`)
  assert(!entradasPorId.has(e.id), `id duplicado no índice: ${e.id}`)
  entradasPorId.set(e.id, e)
  chunkUrlsEsperadas.add(e.chunkUrl)
}

const chunksEmDisco = listarArquivosJson(questoesDir)
const urlsEmDisco = new Set(
  chunksEmDisco.map((abs) => '/' + path.relative(publicDir, abs).replaceAll('\\', '/')),
)
for (const url of chunkUrlsEsperadas) {
  assert(urlsEmDisco.has(url), `chunk referenciado no índice não existe em disco: ${url}`)
}
for (const url of urlsEmDisco) {
  assert(chunkUrlsEsperadas.has(url), `chunk órfão em disco (fora de indice.json): ${url}`)
}

const figurasBytes =
  somaBytesRecursivo(path.join(publicDir, 'enem')) +
  somaBytesRecursivo(path.join(publicDir, 'senai')) +
  somaBytesRecursivo(path.join(publicDir, 'etec'))
assert(
  figurasBytes <= MAX_FIGURAS_BYTES,
  `public/{enem,senai,etec} excedeu 35 MB (${(figurasBytes / (1024 * 1024)).toFixed(2)} MB)`,
)

const server = await createServer({
  root,
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
})

try {
  const [validadorMod, gabaritosMod, contratosMod] = await Promise.all([
    server.ssrLoadModule('/src/games/LogicBattle/ilha/estudo/validadorDicas.ts'),
    server.ssrLoadModule('/src/games/LogicBattle/ilha/estudo/bancos/gabaritosMatematicaEnem.ts'),
    server.ssrLoadModule('/src/games/LogicBattle/ilha/estudo/contratosEstudo.ts'),
  ])

  const renderMd = (texto, inline = false) =>
    renderToStaticMarkup(
      React.createElement(
        ReactMarkdown,
        {
          remarkPlugins: [remarkMath],
          rehypePlugins: [rehypeKatex],
          ...(inline ? { components: { p: ({ children }) => React.createElement(React.Fragment, null, children) } } : {}),
        },
        inline ? contratosMod.protegerMarkdownInline(texto) : contratosMod.protegerCifraoMoeda(texto),
      ),
    )

  const checarKatex = (ctx, texto, inline = false) => {
    const html = renderMd(texto, inline)
    assert(!html.includes('katex-error'), `${ctx}: erro de sintaxe KaTeX -> ${html}`)
    if (inline) {
      assert(!/<(ol|ul|li|blockquote|hr|h[1-6])\b/i.test(html), `${ctx}: virou bloco Markdown -> ${html}`)
      const visivel = html.replace(/<[^>]+>/g, '').trim()
      assert(visivel.length > 0, `${ctx}: texto inline vazio -> ${html}`)
    }
  }

  const idsVistos = new Set()
  const assinaturasVistas = new Set()
  const contagemOrigem = { enem_oficial: 0, senai_oficial: 0, etec_oficial: 0 }
  const erros = []

  for (const absChunk of chunksEmDisco) {
    const size = statSync(absChunk).size
    const relChunk = path.relative(root, absChunk)
    if (size > MAX_CHUNK_BYTES) {
      erros.push(`${relChunk}: tamanho ${size} B excede ${Math.round(MAX_CHUNK_BYTES / 1024)} KB`)
    }
    const pacote = JSON.parse(readFileSync(absChunk, 'utf8'))
    assert(pacote && pacote.versao === 1 && Array.isArray(pacote.itens), `${relChunk}: formato de pacote inválido`)

    for (const q of pacote.itens) {
      try {
        assert(!idsVistos.has(q.id), `${q.id}: id duplicado entre pacotes`)
        assert(!assinaturasVistas.has(q.assinatura), `${q.id}: assinatura duplicada (${q.assinatura})`)
        idsVistos.add(q.id)
        assinaturasVistas.add(q.assinatura)

        const ent = entradasPorId.get(q.id)
        assert(ent !== undefined, `${q.id}: ausente em indice.json`)
        assert(ent.grau === q.grau && ent.temaId === q.temaId && ent.origem === q.origem, `${q.id}: divergência com indice.json`)

        assert(['enem_oficial', 'senai_oficial', 'etec_oficial'].includes(q.origem), `${q.id}: origem inválida`)
        assert([5, 6, 7].includes(q.grau), `${q.id}: grau inválido (${q.grau})`)
        contagemOrigem[q.origem]++

        assert(Array.isArray(q.alternativas) && q.alternativas.length === 5, `${q.id}: esperava 5 alternativas`)
        const corretas = q.alternativas.filter((a) => a.correta)
        assert(corretas.length === 1, `${q.id}: esperava exatamente 1 correta`)
        const correta = corretas[0]

        if (q.origem === 'enem_oficial') {
          const ref = q.referenciaOficial
          assert(ref && ref.ano && ref.questao, `${q.id}: sem referenciaOficial completa`)
          const gab = gabaritosMod.letraDoGabarito(ref.ano, ref.questao)
          assert(gab !== null, `${q.id}: sem gabarito oficial em gabaritosMatematicaEnem.ts (${ref.ano}:${ref.questao})`)
          assert(gab !== 'anulada', `${q.id}: questão oficialmente anulada (${ref.ano}:${ref.questao})`)
          assert(gab === correta.letra, `${q.id}: gabarito oficial é ${gab}, marcada ${correta.letra}`)
        }

        const zeroSpoiler = validadorMod.validarDesafioZeroSpoiler(q)
        assert(zeroSpoiler.ok, `${q.id}: violou Zero-Spoiler -> ${zeroSpoiler.violacoes.join(' | ')}`)

        checarKatex(`${q.id}.enunciado`, q.enunciadoMarkdown, false)
        for (const alt of q.alternativas) {
          checarKatex(`${q.id}.alt[${alt.letra}]`, alt.rotulo, true)
          if (alt.diagnosticoPt) {
            checarKatex(`${q.id}.diag[${alt.letra}]`, alt.diagnosticoPt, false)
          }
        }
        for (const d of q.dicas) {
          checarKatex(`${q.id}.dica[${d.nivel}]`, d.textoPt, false)
        }
        checarKatex(`${q.id}.solucao`, q.posAcerto?.solucaoCompletaPt ?? '', false)
        for (const met of q.posAcerto?.metodos ?? []) {
          checarKatex(`${q.id}.metodo(${met.selo})`, met.resumo ?? '', false)
        }

        for (const fig of q.figuras ?? []) {
          const absFig = path.join(publicDir, fig.src.replace(/^\/+/, ''))
          assert(existsSync(absFig), `${q.id}: figura ausente em disco -> ${absFig}`)
          assert(statSync(absFig).size > 100, `${q.id}: figura vazia/corrompida -> ${absFig}`)
        }
      } catch (e) {
        erros.push(e instanceof Error ? e.message : String(e))
      }
    }
  }

  assert(
    idsVistos.size === indice.entradas.length,
    `contagem divergente: indice=${indice.entradas.length}, pacotes=${idsVistos.size}`,
  )
  for (const org of ['enem_oficial', 'senai_oficial', 'etec_oficial']) {
    assert(
      indice.totaisPorOrigem?.[org] === contagemOrigem[org],
      `totaisPorOrigem[${org}] divergente: indice=${indice.totaisPorOrigem?.[org]}, real=${contagemOrigem[org]}`,
    )
  }

  if (erros.length > 0) {
    throw new Error(`${erros.length} erro(s) no acervo:\n  - ${erros.slice(0, 20).join('\n  - ')}`)
  }

  console.log(
    `validar-banco-questoes: OK (${idsVistos.size} questoes, ${chunksEmDisco.length} chunks, indice=${(indiceBytes / 1024).toFixed(1)} KB, figuras=${(figurasBytes / (1024 * 1024)).toFixed(2)} MB)`,
  )
} finally {
  await server.close()
}
