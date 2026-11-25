import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const outDir = path.join(root, 'public', 'questoes')
const aprovadosDir = path.join(root, 'scripts', 'questoes', '.staging', 'aprovados')

const SUBPASTA_POR_ORIGEM = {
  enem_oficial: 'enem',
  etec_oficial: 'etec',
  senai_oficial: 'senai',
}

function resolverProvaCodigo(item) {
  const ref = item.referenciaOficial
  if (item.origem === 'enem_oficial') {
    const ano = ref?.ano ?? 0
    return ref?.aplicacao === 'ppl_reaplicacao' ? `${ano}-ppl` : String(ano)
  }
  if (item.origem === 'etec_oficial') {
    if (typeof item.chaveFigura === 'string') {
      const m = item.chaveFigura.match(/^etec:(\d{4}):(\d+):/)
      if (m) return `${m[1]}-${m[2]}`
    }
    if (typeof ref?.citacaoCurta === 'string') {
      const m = ref.citacaoCurta.match(/ETEC\s+(\d{4})\s*·\s*(\d+)/i)
      if (m) return `${m[1]}-${m[2]}`
    }
    const mId = String(item.id).match(/etec_(\d{4})_(\d+)/i)
    if (mId) return `${mId[1]}-${mId[2]}`
    return String(ref?.ano ?? 'geral')
  }
  if (item.origem === 'senai_oficial') {
    if (typeof item.chaveFigura === 'string') {
      const m = item.chaveFigura.match(/^senai:(\d{4}):(\d+):/)
      if (m) return `${m[1]}-${m[2]}`
    }
    if (typeof ref?.citacaoCurta === 'string') {
      const m = ref.citacaoCurta.match(/SENAI\s+(\d{4})\s*·\s*CGE\s*(\d+)/i)
      if (m) return `${m[1]}-${m[2]}`
    }
    const mId = String(item.id).match(/senai_(\d{4})_(\d+)/i)
    if (mId) return `${mId[1]}-${mId[2]}`
    return String(ref?.ano ?? 'geral')
  }
  throw new Error(`Origem inesperada no compilador: ${item.origem}`)
}

function resolverFigurasItem(item, manifestos) {
  if (Array.isArray(item.figuras)) return item.figuras
  if (typeof item.chaveFigura === 'string') {
    const k = item.chaveFigura
    if (k.startsWith('etec:')) return manifestos.etec[k] ?? []
    if (k.startsWith('senai:')) return manifestos.senai[k] ?? []
    return manifestos.enem[k] ?? []
  }
  if (item.origem === 'enem_oficial' && item.referenciaOficial) {
    const k = `${item.referenciaOficial.ano}:${item.referenciaOficial.questao}`
    return manifestos.enem[k] ?? []
  }
  return []
}

function coletarExtrasAprovados() {
  if (!existsSync(aprovadosDir)) return []
  const extras = []
  const arquivos = readdirSync(aprovadosDir).filter((f) => f.endsWith('.json')).sort()
  for (const arq of arquivos) {
    const bruto = JSON.parse(readFileSync(path.join(aprovadosDir, arq), 'utf8'))
    const lista = Array.isArray(bruto) ? bruto : Array.isArray(bruto?.itens) ? bruto.itens : []
    for (const item of lista) extras.push(item)
  }
  return extras
}

const server = await createServer({
  root,
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
})

try {
  const [l1, l2, l3, l4, l5, et1, sn1, figEnem, figEtec, figSenai] = await Promise.all([
    server.ssrLoadModule('/src/games/LogicBattle/ilha/estudo/bancos/enemMatematicaLote1.ts'),
    server.ssrLoadModule('/src/games/LogicBattle/ilha/estudo/bancos/enemMatematicaLote2.ts'),
    server.ssrLoadModule('/src/games/LogicBattle/ilha/estudo/bancos/enemMatematicaLote3.ts'),
    server.ssrLoadModule('/src/games/LogicBattle/ilha/estudo/bancos/enemMatematicaLote4.ts'),
    server.ssrLoadModule('/src/games/LogicBattle/ilha/estudo/bancos/enemMatematicaLote5.ts'),
    server.ssrLoadModule('/src/games/LogicBattle/ilha/estudo/bancos/etecMatematicaLote1.ts'),
    server.ssrLoadModule('/src/games/LogicBattle/ilha/estudo/bancos/senaiMatematicaLote1.ts'),
    server.ssrLoadModule('/src/games/LogicBattle/ilha/estudo/bancos/figurasEnem.manifest.ts'),
    server.ssrLoadModule('/src/games/LogicBattle/ilha/estudo/bancos/figurasEtec.manifest.ts'),
    server.ssrLoadModule('/src/games/LogicBattle/ilha/estudo/bancos/figurasSenai.manifest.ts'),
  ])

  const manifestos = {
    enem: figEnem.FIGURAS_ENEM,
    etec: figEtec.FIGURAS,
    senai: figSenai.FIGURAS,
  }

  const legados = [
    ...l1.ENEM_MATEMATICA_LOTE1,
    ...l2.ENEM_MATEMATICA_LOTE2,
    ...l3.ENEM_MATEMATICA_LOTE3,
    ...l4.ENEM_MATEMATICA_LOTE4,
    ...l5.ENEM_MATEMATICA_LOTE5,
    ...et1.ETEC_MATEMATICA_LOTE1,
    ...sn1.SENAI_MATEMATICA_LOTE1,
  ]

  const porId = new Map()
  for (const raw of [...legados, ...coletarExtrasAprovados()]) {
    if (porId.has(raw.id)) continue
    const figs = resolverFigurasItem(raw, manifestos)
    const { figuras: origFiguras, ...rawSemFiguras } = raw
    const normalizado = {
      ...rawSemFiguras,
      nivelCuradoria: raw.nivelCuradoria ?? 'completa',
      ...(figs.length > 0 || Array.isArray(origFiguras) ? { figuras: figs } : {}),
    }
    porId.set(normalizado.id, normalizado)
  }

  rmSync(outDir, { recursive: true, force: true })
  mkdirSync(outDir, { recursive: true })

  const grupos = new Map()
  const entradas = []
  const totaisPorOrigem = { enem_oficial: 0, senai_oficial: 0, etec_oficial: 0 }

  for (const item of porId.values()) {
    const sub = SUBPASTA_POR_ORIGEM[item.origem]
    if (!sub) throw new Error(`Origem inválida em ${item.id}: ${item.origem}`)
    const provaCodigo = resolverProvaCodigo(item)
    const chunkUrl = `/questoes/${sub}/${provaCodigo}.json`
    const chaveGrupo = `${sub}::${provaCodigo}`
    let g = grupos.get(chaveGrupo)
    if (!g) {
      g = { sub, origem: item.origem, provaCodigo, itens: [] }
      grupos.set(chaveGrupo, g)
    }
    g.itens.push(item)

    const ano = item.referenciaOficial?.ano ?? 0
    const questao = item.referenciaOficial?.questao ?? 0
    totaisPorOrigem[item.origem]++
    entradas.push({
      id: item.id,
      assinatura: item.assinatura,
      origem: item.origem,
      grau: item.grau,
      temaId: item.temaId,
      arquetipoOuItemId: item.arquetipoOuItemId,
      ano,
      questao,
      provaCodigo,
      chunkUrl,
      temFigura: Boolean(item.figuras && item.figuras.length > 0),
      nivelCuradoria: item.nivelCuradoria,
    })
  }

  for (const g of grupos.values()) {
    g.itens.sort((a, b) => {
      const qa = a.referenciaOficial?.questao ?? 0
      const qb = b.referenciaOficial?.questao ?? 0
      return qa !== qb ? qa - qb : a.id.localeCompare(b.id)
    })
    const dirDestino = path.join(outDir, g.sub)
    mkdirSync(dirDestino, { recursive: true })
    const arquivo = path.join(dirDestino, `${g.provaCodigo}.json`)
    writeFileSync(
      arquivo,
      JSON.stringify({ versao: 1, origem: g.origem, provaCodigo: g.provaCodigo, itens: g.itens }),
      'utf8',
    )
  }

  entradas.sort((a, b) =>
    a.origem.localeCompare(b.origem) ||
    a.ano - b.ano ||
    a.provaCodigo.localeCompare(b.provaCodigo) ||
    a.questao - b.questao ||
    a.id.localeCompare(b.id),
  )

  const indice = {
    versao: 1,
    geradoEmIso: new Date().toISOString(),
    totaisPorOrigem,
    entradas,
  }
  writeFileSync(path.join(outDir, 'indice.json'), JSON.stringify(indice), 'utf8')

  console.log(
    `compilador-acervo: ${entradas.length} questoes em ${grupos.size} pacotes JSON (ENEM=${totaisPorOrigem.enem_oficial}, SENAI=${totaisPorOrigem.senai_oficial}, ETEC=${totaisPorOrigem.etec_oficial})`,
  )
} finally {
  await server.close()
}
