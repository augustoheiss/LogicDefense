import { biomaDoQuadrado, type BiomaId } from '../biomaRecursos'
import { lugarDaBaseInimiga } from '../partidaSim'
import { RIOS_DE_REFERENCIA } from './aguaDoMundo.referencia'
import { arestaBloqueada, celulasDaGradeDaAgua, chaveDaCelula, entradasOrfasDaGrade, escavacaDoRio, escavacaDoRioComBase, limparMemoriaDaAgua, nivelDaAguaEm, PARAMETROS_DA_AGUA, riosDoQuadrado, tamanhoDaMemoriaDaAgua, type Rio } from './aguaDoMundo'

function assert(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem)
}

/** Gerador fixo (mulberry32): os pontos «aleatórios» do teste são REPRODUTÍVEIS. */
function semente(valor: number): () => number {
  let t = valor >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

const LADO = 112
const R = 6

/** Os rios DISTINTOS dos 169 quadrados de −6 a 6, pelo `id` (o mesmo rio aparece em até 4 quadrados). */
function riosDoMundo(): Map<string, Rio> {
  const todos = new Map<string, Rio>()
  for (let i = -R; i <= R; i += 1) for (let j = -R; j <= R; j += 1) for (const r of riosDoQuadrado(i, j, alturaBase)) todos.set(r.id, r)
  return todos
}

/** Uma altura de base SUAVE e CONHECIDA (uma rampa de 2 % com uma ondulação): o módulo recebe a altura por PARÂMETRO e o teste não pretende replicar o gerador (a réplica errada que eu tinha usava um bioma por quadrado em vez da mistura de 4). */
function alturaBase(X: number, Z: number): number {
  return 0.02 * X + 0.01 * Z + 0.4 * Math.sin(X / 17) * Math.cos(Z / 23)
}

/**
 * A ÁGUA DO MUNDO (F2, 26/11/2026): os RIOS (valetas escavadas com água dentro, só desenho). O módulo é a PORTA do protótipo medido (`.superpowers/agua/agua-modelo.mjs`); os contratos abaixo são os números que
 * o protótipo mediu no gerador REAL, e `aguaDoMundo.referencia.ts` guarda a lista dos 13 rios dele para o teste provar que a porta é FIEL. Tudo é função do PONTO GLOBAL `(X, Z) = (112·i + x, 112·j + z)`, como a altura do
 * relevo, então os dois quadrados de uma emenda amostram a MESMA função no MESMO ponto.
 */
export function run(): void {
  limparMemoriaDaAgua()

  // (1) DETERMINISMO: o mesmo quadrado devolve o mesmo rio, e o quadrado vizinho que toca o mesmo rio devolve o MESMO objeto (a identidade importa: a cena o guarda por referência)
  const a = riosDoQuadrado(-1, 0, alturaBase)
  const b = riosDoQuadrado(-1, 0, alturaBase)
  assert(a.length === b.length && a.every((r, k) => r === b[k]), 'riosDoQuadrado(−1, 0, alturaBase) duas vezes devolve os MESMOS rios (mesmos objetos)')
  const vizinhoA = riosDoQuadrado(-1, -1, alturaBase)
  const comum = a.filter((r) => vizinhoA.includes(r))
  assert(comum.length >= 1, 'os quadrados (−1, 0) e (−1, −1) têm o rio V-1:-1:-2 em comum e ele é o MESMO objeto nos dois')

  // (2) FIDELIDADE À PORTA: os 13 rios do protótipo medido, com as mesmas arestas, o mesmo número de pontos e os mesmos extremos (o TRAÇADO; os níveis dependem da altura de base e a Task 3 os compara com a altura do gerador real)
  const rios = riosDoMundo()
  assert(rios.size === RIOS_DE_REFERENCIA.length, `o mundo de −6 a 6 tem ${RIOS_DE_REFERENCIA.length} rios como o protótipo (veio ${rios.size})`)
  for (const ref of RIOS_DE_REFERENCIA) {
    const r = rios.get(ref.id)
    assert(r !== undefined, `o rio ${ref.id} do protótipo existe no módulo`)
    assert(r.pontos.length === ref.n, `${ref.id}: ${ref.n} pontos (veio ${r.pontos.length})`)
    assert(Math.hypot(r.pontos[0].X - ref.p0[0], r.pontos[0].Z - ref.p0[1]) < 1e-5, `${ref.id}: o primeiro ponto é (${ref.p0}) (veio ${r.pontos[0].X}, ${r.pontos[0].Z})`)
    const u = r.pontos[r.pontos.length - 1]
    assert(Math.hypot(u.X - ref.pN[0], u.Z - ref.pN[1]) < 1e-5, `${ref.id}: o último ponto é (${ref.pN}) (veio ${u.X}, ${u.Z})`)
  }

  // (3) SECOS: serra e basalto NUNCA têm rio, e o quadrado (0, 0) também não; achados entre 80 quadrados de cada bioma seco
  let secos = 0
  for (let i = -9; i <= 9 && secos < 160; i += 1) {
    for (let j = -9; j <= 9; j += 1) {
      const bioma: BiomaId = biomaDoQuadrado(i, j)
      if (bioma === 'serra_ouro' || bioma === 'basalto_brasa') {
        assert(riosDoQuadrado(i, j, alturaBase).length === 0, `o quadrado seco (${i}, ${j}) (${bioma}) não tem rio`)
        secos += 1
      }
    }
  }
  assert(secos >= 80, `o teste olhou pelo menos 80 quadrados secos (olhou ${secos}): o controle de que o filtro não ficou vazio`)
  assert(riosDoQuadrado(0, 0, alturaBase).length === 0, 'o quadrado de nascimento (0, 0) não tem rio')

  // (4) DENSIDADE nos 169 quadrados: a fração com algum rio fica entre 15 % e 26 % (o pedido da auditoria: 17–25 %; o protótipo mediu 19 %); a ribeira tem mais que a clareira
  const porBioma = new Map<BiomaId, { q: number; c: number }>()
  let comRio = 0
  for (let i = -R; i <= R; i += 1) {
    for (let j = -R; j <= R; j += 1) {
      const bioma = biomaDoQuadrado(i, j)
      const v = porBioma.get(bioma) ?? { q: 0, c: 0 }
      v.q += 1
      if (riosDoQuadrado(i, j, alturaBase).length > 0) {
        v.c += 1
        comRio += 1
      }
      porBioma.set(bioma, v)
    }
  }
  const fracao = comRio / ((2 * R + 1) ** 2)
  assert(fracao >= 0.15 && fracao <= 0.26, `a fração dos quadrados com rio fica entre 15 % e 26 % (veio ${(fracao * 100).toFixed(1)} %)`)
  const frac = (b: BiomaId): number => (porBioma.get(b)?.c ?? 0) / Math.max(1, porBioma.get(b)?.q ?? 1)
  assert(frac('ribeira') > frac('clareira'), `a ribeira (${(frac('ribeira') * 100).toFixed(0)} %) tem mais rios que a clareira (${(frac('clareira') * 100).toFixed(0)} %)`)

  // (5) VAUS (I4): toda travessia de aresta passa por ±14 ou ±42 m do MEIO da aresta (o centro de uma janela de passagem plana). A aresta é o plano `eixo = ±56 (mod 112)`; o ponto de cruzamento é interpolado entre as
  // duas amostras vizinhas, e o deslocamento é medido em relação ao meio da aresta (a coordenada transversal, mod 112, centrada em 0). A tolerância é de 0,05 m: o meandro SOME nas pontas (sin²), então só sobra o erro de interpolação.
  let travessias = 0
  let pioresVaus = 0
  for (const r of rios.values()) {
    for (let k = 1; k < r.pontos.length; k += 1) {
      const p = r.pontos[k - 1]
      const q = r.pontos[k]
      for (const eixo of ['X', 'Z'] as const) {
        const u0 = (p[eixo] + 56) / LADO
        const u1 = (q[eixo] + 56) / LADO
        if (Math.floor(u0) === Math.floor(u1)) continue
        const t = (Math.max(Math.floor(u0), Math.floor(u1)) - u0) / (u1 - u0)
        const outro = eixo === 'X' ? 'Z' : 'X'
        const ao = p[outro] + (q[outro] - p[outro]) * t
        const centrado = ((((ao % LADO) + LADO) % LADO) + 56) % LADO - 56 // −56..56, 0 é o MEIO da aresta (a coordenada transversal mod 112)
        const desloc = Math.abs(centrado)
        const erro = Math.min(Math.abs(desloc - 14), Math.abs(desloc - 42))
        pioresVaus = Math.max(pioresVaus, erro)
        travessias += 1
      }
    }
  }
  assert(travessias >= 26, `o teste viu pelo menos 26 travessias de aresta (viu ${travessias}): o controle de que a varredura não ficou vazia`)
  assert(pioresVaus <= 0.05, `toda travessia de aresta fica a ±14 ou ±42 m do meio da aresta (pior desvio ${pioresVaus.toFixed(4)} m)`)
  // CONTROLE POSITIVO do instrumento: um cruzamento sintético a 20 m do meio (nem 14 nem 42) é acusado pela MESMA conta
  const fora = Math.min(Math.abs(20 - 14), Math.abs(20 - 42))
  assert(fora > 0.05, `CONTROLE POSITIVO: uma travessia a 20 m do meio é acusada como fora do vau (desvio ${fora})`)

  // (6) CONTINUIDADE: o maior passo entre pontos vizinhos da poligonal é ≤ 1,5 m
  let maiorPasso = 0
  for (const r of rios.values()) for (let k = 1; k < r.pontos.length; k += 1) maiorPasso = Math.max(maiorPasso, Math.hypot(r.pontos[k].X - r.pontos[k - 1].X, r.pontos[k].Z - r.pontos[k - 1].Z))
  assert(maiorPasso <= 1.5, `o maior passo da poligonal é ≤ 1,5 m (veio ${maiorPasso.toFixed(3)})`)

  // (7) ZONAS: a distância mínima de todo ponto de rio ao nascimento ≥ 12, à pedra ≥ 18 e ao centro de QUALQUER base dos 9 quadrados em volta ≥ 28. O controle positivo: um ponto sintético a 3 m do nascimento é acusado.
  const acusaZona = (X: number, Z: number): { nasc: number; pedra: number; base: number } => {
    let nasc = Infinity
    let pedra = Infinity
    let base = Infinity
    const i0 = Math.round(X / LADO)
    const j0 = Math.round(Z / LADO)
    for (let di = -1; di <= 1; di += 1) {
      for (let dj = -1; dj <= 1; dj += 1) {
        const i = i0 + di
        const j = j0 + dj
        const x = X - LADO * i
        const z = Z - LADO * j
        nasc = Math.min(nasc, Math.hypot(x, z))
        pedra = Math.min(pedra, Math.hypot(x + 8, z - 10))
        const bs = lugarDaBaseInimiga(i, j)
        base = Math.min(base, Math.hypot(x - bs.x, z - bs.z))
      }
    }
    return { nasc, pedra, base }
  }
  const sintetico = acusaZona(3, 0)
  assert(sintetico.nasc < PARAMETROS_DA_AGUA.zonaProibida.claro, `CONTROLE POSITIVO: um ponto a 3 m do nascimento é acusado (${sintetico.nasc.toFixed(1)} m < ${PARAMETROS_DA_AGUA.zonaProibida.claro})`)
  let dNasc = Infinity
  let dPedra = Infinity
  let dBase = Infinity
  for (const r of rios.values()) {
    for (const p of r.pontos) {
      const z = acusaZona(p.X, p.Z)
      dNasc = Math.min(dNasc, z.nasc)
      dPedra = Math.min(dPedra, z.pedra)
      dBase = Math.min(dBase, z.base)
    }
  }
  assert(dNasc >= 12, `o rio nunca chega a menos de 12 m do nascimento (mínimo ${dNasc.toFixed(1)})`)
  assert(dPedra >= 18, `o rio nunca chega a menos de 18 m da pedra (mínimo ${dPedra.toFixed(1)})`)
  assert(dBase >= 28, `o rio nunca chega a menos de 28 m do centro de uma base inimiga, contando as bases dos 9 quadrados em volta (mínimo ${dBase.toFixed(2)}; o caso medido era 25,2 m: o rio do quadrado (−1, 0) a 25,2 m da base do (0, 0))`)

  // (8) NENHUM CRUZAMENTO: a menor distância entre dois rios distintos > 12 m
  const lista = [...rios.values()]
  let dEntre = Infinity
  for (let x = 0; x < lista.length; x += 1) {
    for (let y = x + 1; y < lista.length; y += 1) {
      for (let k = 0; k < lista[x].pontos.length; k += 3) for (let m = 0; m < lista[y].pontos.length; m += 3) dEntre = Math.min(dEntre, Math.hypot(lista[x].pontos[k].X - lista[y].pontos[m].X, lista[x].pontos[k].Z - lista[y].pontos[m].Z))
    }
  }
  assert(dEntre > 12, `dois rios distintos nunca ficam a menos de 12 m um do outro (mínimo ${dEntre.toFixed(1)})`)

  // (9) O NÍVEL NUNCA SOBE rio abaixo (um rio plano, com o mesmo nível nas pontas, é aceito: V-5:-2:-7). As duas etapas de «mínimo corrente» (`B − 0,2` e a suavização) se protegem MUTUAMENTE: tirar UMA só
  // nunca faz o nível subir (N3 sozinho é EQUIVALENTE PROVADO: a média de uma sequência que só desce só desce; medido 0,00e+0), e tirar as DUAS faz (a rampa já o pega em H0:-2:-8, mas NÃO em V-1:-1:-2, onde só um
  // VALE seguido de um MORRO o separa: 75 pontos, pior 5,07 cm, até +0,486 contra −0,200). Por isso o contrato roda com os dois chãos.
  const comValeEMorro = (rio: Rio): ((X: number, Z: number) => number) => {
    const p1 = rio.pontos[Math.floor(rio.pontos.length * 0.25)]
    const p2 = rio.pontos[Math.floor(rio.pontos.length * 0.65)]
    const gauss = (X: number, Z: number, c: { X: number; Z: number }, sg: number): number => Math.exp(-(((X - c.X) ** 2 + (Z - c.Z) ** 2) / (2 * sg * sg)))
    return (X, Z) => -2 * gauss(X, Z, p1, 4) + 3 * gauss(X, Z, p2, 4)
  }
  for (const r of lista) {
    for (let k = 1; k < r.niveis.length; k += 1) assert(r.niveis[k] <= r.niveis[k - 1] + 1e-9, `${r.id}: o nível não sobe rio abaixo (rampa, ponto ${k}: ${r.niveis[k - 1]} → ${r.niveis[k]})`)
  }
  // o rio de referência com o vale e o morro: V-1:-1:-2 (3 travessias, 257 pontos)
  const ref = lista.find((r) => r.id === 'V-1:-1:-2')
  assert(ref !== undefined, 'o rio V-1:-1:-2 existe (o de 3 travessias)')
  const comVale = riosDoQuadrado(-1, 0, comValeEMorro(ref)).find((r) => r.id === 'V-1:-1:-2')
  assert(comVale !== undefined, 'o rio V-1:-1:-2 existe com a altura de vale e morro')
  let subidas = 0
  for (let k = 1; k < comVale.niveis.length; k += 1) if (comVale.niveis[k] > comVale.niveis[k - 1] + 1e-9) subidas += 1
  assert(subidas === 0, `com um VALE seguido de um MORRO sobre o rio o nível NÃO sobe (subiu em ${subidas} pontos): protege o mutante duplo «sem nenhum dos dois mínimos correntes» (medido: 75 pontos, até +0,486)`)
  assert(Math.min(...comVale.niveis) < -0.5 && Math.max(...comVale.niveis) <= -0.19, `CONTROLE: o vale desce o nível (mínimo ${Math.min(...comVale.niveis).toFixed(3)} < −0,5) e o morro não o devolve (máximo ${Math.max(...comVale.niveis).toFixed(3)} ≤ −0,19): o instrumento tem vale e morro de verdade`)
  // OS VALORES, não só «não sobe»: o mínimo corrente do 1º estágio (`B − 0,2`) muda o nível em até 1,3 cm depois do vale (N2) e o sinal do `0,2` o muda em 0,4 m (N4), sem que o nível jamais SUBA. Os 12 valores abaixo
  // foram conferidos contra uma réplica INDEPENDENTE da conta (anel de 9 pontos a 8 m, amostra a cada 4, `B − 0,2`, mínimo corrente, janela de 13, mínimo corrente): diferença máxima 0,0.
  const GOLDEN_DO_NIVEL: ReadonlyArray<readonly [number, number]> = [
    [30, -0.20000000321940353], [40, -0.20066480092773914], [48, -0.2539293210427634], [52, -0.3638327958446388],
    [56, -0.5008543591008755], [60, -0.6127089121800863], [64, -0.6600789944610325], [68, -0.6667996846897093],
    [72, -0.6669038444643998], [76, -0.666955924351745], [80, -0.666955924351745], [84, -0.666955924351745],
  ]
  assert(comVale.niveis.length === 257, `o rio V-1:-1:-2 tem 257 pontos (veio ${comVale.niveis.length})`)
  for (const [k, esperado] of GOLDEN_DO_NIVEL) assert(Math.abs(comVale.niveis[k] - esperado) < 1e-9, `nível do ponto ${k} com vale e morro: ${esperado} (veio ${comVale.niveis[k]}, diferença ${Math.abs(comVale.niveis[k] - esperado).toExponential(2)})`)
  assert(Math.abs(comVale.niveis[0] + 0.2) < 1e-9, `o primeiro ponto do rio está em −0,2 (o chão em volta menos 0,2 m; veio ${comVale.niveis[0]})`)
  limparMemoriaDaAgua()
  // CONTROLE do instrumento: com a altura de base PLANA o nível é −0,2 em TODO o rio (a conta é analítica: anel de 9 pontos de altura 0, menos 0,2)
  const plano = riosDoQuadrado(-1, 0, () => 0).find((r) => r.id === 'V-1:-1:-2')
  assert(plano !== undefined && plano.niveis.every((v) => Math.abs(v + 0.2) < 1e-12), 'com a altura de base plana o nível é −0,2 em todo o rio')
  limparMemoriaDaAgua()

  // (10) O NÍVEL É CONTÍNUO NO PONTO (a lição do 1,7 mm): 200 pontos a até 16 m de algum rio, `nivelDaAguaEm(X ± 1e-6, Z)` difere ≤ 1e-4. O caso medido: o quadrado (3, 0), t = −56, dois pontos do rio a 14,000000 m com níveis −0,2288 e −0,2541
  const sorteio = semente(2612)
  const zona = (X: number, Z: number): number => 0 * X * Z // o teste de continuidade não usa zona plana: o que importa é o NÍVEL
  let maiorSalto = 0
  let testados = 0
  for (let k = 0; k < 4000 && testados < 200; k += 1) {
    const r = lista[Math.floor(sorteio() * lista.length)]
    const p = r.pontos[Math.floor(sorteio() * r.pontos.length)]
    const X = p.X + (sorteio() - 0.5) * 32
    const Z = p.Z + (sorteio() - 0.5) * 32
    const n0 = nivelDaAguaEm(X - 1e-6, Z, alturaBase, zona)
    const n1 = nivelDaAguaEm(X + 1e-6, Z, alturaBase, zona)
    if (n0 === null || n1 === null) continue
    maiorSalto = Math.max(maiorSalto, Math.abs(n0 - n1))
    testados += 1
  }
  assert(testados >= 100, `o teste de continuidade avaliou pelo menos 100 pontos com água (avaliou ${testados})`)
  assert(maiorSalto <= 1e-4, `o nível d'água é contínuo no ponto: maior salto ${maiorSalto.toExponential(2)} (≤ 1e-4)`)

  // (10b) O EMPATE REAL, medido na ALTURA. Além de 6,5 m do rio o `nivel` é `null`, então o teste acima nunca vê o salto onde ele acontece (o caso medido de 1,7 mm estava a 14 m do rio): o que o nível «do ponto mais perto»
  // estraga é a ALTURA do terreno (a margem fica em `nível + 0,18`). O lugar onde isso é GRANDE não é o empate entre dois rios distintos (a 13,8 m a escavação já pesa pouco: o mutante abre só 9,6e-9 ali) e sim o
  // empate entre dois TRECHOS DO MESMO RIO, onde ele faz a curva: o rio H-3:-2:-4 junto da aresta X = −392, de Z = −387,5 a −381,5, onde o «nível do ponto mais perto» abre degraus de ATÉ 1,16 m (medido varrendo o mundo
  // inteiro; a média suave dá ≤ 2e-5 m ali).
  {
    const e = 1e-3
    let pior = 0
    let consultas = 0
    for (let Zc = -387.5; Zc <= -381.5; Zc += 1.5) {
      for (let Xc = -392 - 1.5; Xc <= -392 + 1.5; Xc += 0.5) {
        const d = Math.abs(escavacaDoRio(Xc - e, Zc, alturaBase, zona).altura - escavacaDoRio(Xc + e, Zc, alturaBase, zona).altura)
        pior = Math.max(pior, d)
        consultas += 1
      }
    }
    assert(consultas >= 30, `o teste do empate olhou ${consultas} pontos (≥ 30)`)
    assert(pior <= 1e-4, `a ALTURA é contínua onde dois trechos do mesmo rio empatam em distância (o rio H-3:-2:-4 junto da aresta X = −392): maior degrau em 2e-3 m ${pior.toExponential(2)} m (o nível do ponto mais perto abre até 1,16 m)`)
    // CONTROLE POSITIVO do instrumento: o rio EXISTE ali (a poucos metros) e a escavação NÃO é nula (cai 0,32 m abaixo da base), então o ponto não é uma região vazia onde qualquer fórmula daria degrau 0
    const dentro = escavacaDoRio(-392, -384.5, alturaBase, zona)
    assert(alturaBase(-392, -384.5) - dentro.altura > 0.1, `CONTROLE: a escavação em (−392, −384,5) pesa de verdade (medido 0,32 m abaixo da base, na margem do rio; veio ${(alturaBase(-392, -384.5) - dentro.altura).toFixed(2)} m)`)
  }

  // (11) A MEMÓRIA tem LIMITE e NÃO muda o resultado: depois de descartar tudo e consultar de novo, os 13 rios são os mesmos (mesmos pontos); e a memória nunca passa de 512 entradas
  const antes = new Map([...rios].map(([id, r]) => [id, `${r.pontos.length}:${r.pontos[0].X}:${r.pontos[r.pontos.length - 1].Z}:${r.niveis[0]}`]))
  limparMemoriaDaAgua()
  for (let i = -30; i <= 30; i += 1) for (let j = -30; j <= 30; j += 1) riosDoQuadrado(i, j, alturaBase)
  const mem = tamanhoDaMemoriaDaAgua()
  assert(mem.corridas <= 512, `a memória das CORRIDAS fica em até 512 entradas depois de 3.721 quadrados (ficou ${mem.corridas})`)
  assert(mem.rios <= 512, `a memória dos RIOS fica em até 512 entradas depois de 3.721 quadrados (ficou ${mem.rios})`)
  // a GRADE de 10 m não pode vazar: ela guarda só células de rios que AINDA estão na memória (o defeito medido: ficou 649 > 512 porque a grade só crescia). Cada rio ocupa no máximo ~60 células de 10 m.
  assert(celulasDaGradeDaAgua() <= 512 * 60, `a grade de rios acompanha a memória: ${celulasDaGradeDaAgua()} células (limite ${512 * 60})`)
  // CONTROLE POSITIVO do instrumento: a memória NÃO é vazia (o teste olhou algo): depois de 3.721 quadrados há corridas guardadas
  assert(mem.corridas > 0 && mem.rios >= 0, 'CONTROLE: a memória das corridas não está vazia depois de consultar 3.721 quadrados')
  const depois = riosDoMundo()
  assert(depois.size === antes.size, `depois de limpar e estourar a memória o mundo de −6 a 6 tem os mesmos ${antes.size} rios (veio ${depois.size})`)
  for (const [id, r] of depois) assert(antes.get(id) === `${r.pontos.length}:${r.pontos[0].X}:${r.pontos[r.pontos.length - 1].Z}:${r.niveis[0]}`, `${id}: o rio recalculado depois de a memória descartá-lo é IDÊNTICO`)

  // (12) TROCAR a função de altura NÃO deixa rastro da anterior (defeito achado na Task 2, 26/11): o rio calculado com a altura A ficava na grade quando a memória o trocava pelo calculado com a altura B, e o nível virava a
  // MÉDIA dos dois (medido: −7,41 de memória limpa contra −5,72 depois de usar A, 1,69 m de diferença). A mesma função de altura é a regra (o gerador passa sempre a mesma), mas o módulo não pode depender disso para estar certo.
  {
    const A = alturaBase
    const B = (X: number, Z: number): number => alturaBase(X, Z) - 3 + 0.5 * Math.cos(X / 11)
    limparMemoriaDaAgua()
    const rioA = riosDoQuadrado(-1, 0, A).find((r) => r.id === 'V-1:-1:-2')
    assert(rioA !== undefined, 'o rio V-1:-1:-2 existe (a troca de função é medida sobre ele)')
    const ponto = rioA.pontos[120]
    const PX = ponto.X + 2
    const PZ = ponto.Z
    limparMemoriaDaAgua()
    const limpoB = nivelDaAguaEm(PX, PZ, B, zona)
    limparMemoriaDaAgua()
    const comA = nivelDaAguaEm(PX, PZ, A, zona) // registra na grade os rios calculados com A
    const sujoB = nivelDaAguaEm(PX, PZ, B, zona) // a memória troca cada rio pelo calculado com B: o de A não pode sobrar
    assert(limpoB !== null && sujoB !== null && comA !== null, 'o ponto a 2 m do rio tem água nas três consultas')
    assert(Math.abs(comA - limpoB) > 1, `CONTROLE: as duas funções de altura dão níveis bem diferentes no ponto (A ${comA.toFixed(3)} contra B ${limpoB.toFixed(3)}): o instrumento separa`)
    assert(Math.abs(sujoB - limpoB) < 1e-9, `o nível com a função B depois de ter usado a A é IDÊNTICO ao da memória limpa (limpo ${limpoB}, depois de A ${sujoB}, diferença ${Math.abs(sujoB - limpoB).toExponential(2)})`)
    limparMemoriaDaAgua()
  }

  // (13) O PERFIL DA ESCAVAÇÃO com a altura de base PLANA e sem zona: as contas são analíticas. O braço final do rio V-1:-1:-2 é uma reta vertical (X = −98): o ponto a `d` metros dele, 4 m antes do fim, está a EXATAMENTE `d`
  // do rio. Com o nível −0,2: margem = −0,02; altura = margem·q − 0,68·p, q = 1 − sm((d − 5)/11), p = 1 − sm((d − 1)/2,6). O fundo vale −0,7 até d = 1 m, a margem −0,02 entre 3,6 e 5 m, e 0 a partir de 16 m.
  {
    limparMemoriaDaAgua()
    const plana = (): number => 0
    const rioPlano = riosDoQuadrado(-1, 0, plana).find((r) => r.id === 'V-1:-1:-2')
    assert(rioPlano !== undefined, 'o rio V-1:-1:-2 existe para o perfil da escavação')
    const fim2 = rioPlano.pontos[rioPlano.pontos.length - 1]
    const ant2 = rioPlano.pontos[rioPlano.pontos.length - 8]
    assert(fim2.X === ant2.X && fim2.X === -98, `o braço final do rio é uma reta vertical em X = −98 (veio ${ant2.X} → ${fim2.X}): a distância ao rio é conhecida`)
    const Zc = fim2.Z - 4
    const esperadoDe = (d: number, zonaPeso = 0): number => {
      const sm = (x: number): number => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))
      const wz = 1 - zonaPeso
      const q = (1 - sm((d - 5) / 11)) * wz
      const p = (1 - sm((d - 1) / 2.6)) * wz
      return -0.02 * q - 0.68 * p
    }
    for (const d of [0, 0.5, 1, 2, 3.6, 5, 8, 10.5, 16, 17, 30]) {
      const e = escavacaDoRio(fim2.X + d, Zc, plana, () => 0)
      assert(Math.abs(e.altura - esperadoDe(d)) < 1e-12, `perfil da escavação a ${d} m do rio: altura ${esperadoDe(d)} (veio ${e.altura})`)
    }
    assert(Math.abs(escavacaDoRio(fim2.X, Zc, plana, () => 0).altura + 0.7) < 1e-12, 'o fundo do canal fica em −0,7 (nível −0,2 − 0,5)')
    assert(Math.abs(escavacaDoRio(fim2.X + 4, Zc, plana, () => 0).altura + 0.02) < 1e-12, 'a margem fica em −0,02 (nível + 0,18) entre 3,6 e 5 m do rio')
    assert(escavacaDoRio(fim2.X + 16, Zc, plana, () => 0).altura === 0 && escavacaDoRio(fim2.X + 30, Zc, plana, () => 0).altura === 0, 'a 16 m do rio o chão é o de base (a escavação acabou)')
    // o NÍVEL só existe dentro de 6,5 m do rio (e é −0,2 ali)
    const dentro649 = escavacaDoRio(fim2.X + 6.49, Zc, plana, () => 0).nivel
    assert(dentro649 !== null && Math.abs(dentro649 + 0.2) < 1e-12, `a 6,49 m do rio há água a −0,2 (o nível é uma média ponderada: tolerância 1e-12; veio ${dentro649})`)
    assert(escavacaDoRio(fim2.X + 6.51, Zc, plana, () => 0).nivel === null && escavacaDoRio(fim2.X - 6.6, Zc, plana, () => 0).nivel === null, 'a 6,51 m do rio (dos dois lados) não há água: o nível é null')
    assert(escavacaDoRio(fim2.X + 30, Zc, plana, () => 0).nivel === null, 'longe do rio não há água')
    // a ZONA PLANA pesa a escavação linearmente (ela cede: o rio nunca invade a base)
    for (const zz of [0.25, 0.5, 1]) {
      const e = escavacaDoRio(fim2.X + 0.5, Zc, plana, () => zz)
      assert(Math.abs(e.altura - esperadoDe(0.5, zz)) < 1e-12, `com a zona plana ${zz} a escavação pesa ${1 - zz} (altura ${esperadoDe(0.5, zz)}, veio ${e.altura})`)
    }
    limparMemoriaDaAgua()
  }

  // (14) A GRADE acompanha a memória: depois de uma varredura que vê MAIS de 512 rios (o caminho de descarte RODA) toda célula da grade aponta para um rio que ainda está na memória (medido: 141 × 141 quadrados veem 676
  // rios). Sem o descarte a grade guardaria referências a rios mortos e vazaria num mundo ilimitado.
  {
    limparMemoriaDaAgua()
    const vistos = new Set<string>()
    for (let i = -70; i <= 70; i += 1) {
      for (let j = -70; j <= 70; j += 1) {
        for (const r of riosDoQuadrado(i, j, alturaBase)) vistos.add(r.id)
        escavacaDoRio(LADO * i, LADO * j, alturaBase, zona)
      }
    }
    assert(vistos.size > 512, `CONTROLE: a varredura viu ${vistos.size} rios (> 512): o caminho de descarte da memória rodou`)
    const m2 = tamanhoDaMemoriaDaAgua()
    assert(m2.rios === 512 && m2.corridas === 512, `as duas memórias estão no limite depois de ver ${vistos.size} rios (rios ${m2.rios}, corridas ${m2.corridas})`)
    assert(entradasOrfasDaGrade() === 0, `nenhuma entrada da grade aponta para um rio já descartado da memória (${entradasOrfasDaGrade()} órfãs)`)
    assert(celulasDaGradeDaAgua() > 0 && celulasDaGradeDaAgua() <= 512 * 60, `a grade tem células (${celulasDaGradeDaAgua()}) e não passa de 512 rios × ~60 células`)
    limparMemoriaDaAgua()
    assert(celulasDaGradeDaAgua() === 0 && tamanhoDaMemoriaDaAgua().rios === 0 && tamanhoDaMemoriaDaAgua().corridas === 0, 'limparMemoriaDaAgua esvazia a memória e a grade')
  }

  // (15) A REGRA «sem rio em (0, 0)», exercida DIRETO: o mundo medido não a exerce (a corrida H0 s = −1 sai vazia com e sem ela, medido). As 4 arestas incidentes no quadrado (0, 0) são bloqueadas; uma aresta
  // longe, entre biomas não secos, não.
  assert(arestaBloqueada('H', 0, -1) && arestaBloqueada('H', 0, 0) && arestaBloqueada('V', 0, -1) && arestaBloqueada('V', 0, 0), 'as 4 arestas incidentes no quadrado (0, 0) são bloqueadas')
  assert(!arestaBloqueada('H', 0, -3), 'CONTROLE: a aresta H0 k = −3 (entre (−3, 0) e (−2, 0), biomas não secos) NÃO é bloqueada: a regra não bloqueia tudo')

  // (16) O CACHE DO ÚLTIMO QUADRADO (`garantirOsRiosEmVolta` só refaz os 9 `riosDoQuadrado` quando o quadrado, a função de altura ou a memória mudam) não pode mudar o resultado. Três entradas, uma por chave do cache:
  // (a) DESCARTE: depois que a memória descarta o rio, o ponto volta a ver o rio RECALCULADO (sem o carimbo o cache pula o registro e o rio SOME: medido −1,474 sem água em vez de −4,461 com água). O descarte é PROVADO:
  // a varredura pula os 5 × 9 quadrados que o rio toca (uma leitura o renovaria na ordem LRU e ele nunca sairia: foi o primeiro roteiro, vazio) e o teste confere que o rio é OUTRO objeto depois.
  {
    limparMemoriaDaAgua()
    const antes = escavacaDoRio(-97, 68, alturaBase, zona)
    const rioAntes = riosDoQuadrado(-1, 0, alturaBase).find((r) => r.id === 'V-1:-1:-2')
    for (let i = -70; i <= 70; i += 1) {
      for (let j = -70; j <= 70; j += 1) {
        if (Math.abs(i + 1) <= 2 && j >= -5 && j <= 3) continue
        riosDoQuadrado(i, j, alturaBase)
      }
    }
    const perto1 = escavacaDoRio(-96.5, 68, alturaBase, zona)
    const perto2 = escavacaDoRio(-94, 65, alturaBase, zona)
    const rioDepois = riosDoQuadrado(-1, 0, alturaBase).find((r) => r.id === 'V-1:-1:-2')
    assert(rioAntes !== undefined && rioDepois !== undefined && rioAntes !== rioDepois, 'CONTROLE: o rio V-1:-1:-2 foi DESCARTADO da memória e recalculado (outro objeto): sem isso o teste do cache não separa nada')
    assert(antes.nivel !== null && perto1.nivel !== null && perto2.nivel !== null, `depois do descarte o ponto perto do rio AINDA vê o rio (nível ${perto1.nivel}, ${perto2.nivel}; sem o carimbo do cache ele via só o chão de base)`)
    assert(Math.abs(perto1.altura - escavacaDoRio(-96.5, 68, alturaBase, zona).altura) < 1e-12, 'a consulta repetida dá a mesma altura')
    limparMemoriaDaAgua()
    const limpo1 = escavacaDoRio(-96.5, 68, alturaBase, zona)
    const limpo2 = escavacaDoRio(-94, 65, alturaBase, zona)
    assert(perto1.altura === limpo1.altura && perto1.nivel === limpo1.nivel && perto2.altura === limpo2.altura && perto2.nivel === limpo2.nivel, `o resultado depois do descarte é IDÊNTICO ao de uma memória limpa (${perto1.altura} contra ${limpo1.altura})`)
  }
  // (b) O `j`: o cache lembra (i, j). Com o mesmo `i` e outro `j` (dois quadrados abaixo, onde os 9 em volta não se sobrepõem) os rios de um não bastam para o outro: i = −6, j −2 → 0.
  {
    const pts = (): Array<readonly [number, number]> => {
      const out: Array<readonly [number, number]> = []
      for (let x = -50; x <= 50; x += 10) for (let z = -50; z <= 50; z += 10) out.push([LADO * -6 + x, LADO * 0 + z])
      return out
    }
    limparMemoriaDaAgua()
    escavacaDoRio(LADO * -6 + 1, LADO * -2 + 1, alturaBase, zona) // o cache fica em (−6, −2)
    const emSequencia = pts().map(([X, Z]) => escavacaDoRio(X, Z, alturaBase, zona))
    limparMemoriaDaAgua()
    const limpos = pts().map(([X, Z]) => escavacaDoRio(X, Z, alturaBase, zona))
    let diferem = 0
    for (let k = 0; k < limpos.length; k += 1) if (emSequencia[k].altura !== limpos[k].altura || emSequencia[k].nivel !== limpos[k].nivel) diferem += 1
    assert(diferem === 0, `os 121 pontos do quadrado (−6, 0) dão o MESMO resultado depois de o cache ter ficado em (−6, −2) e com a memória limpa (${diferem} diferem: o cache ignorava o j)`)
    assert(limpos.some((e) => e.nivel !== null), 'CONTROLE: o quadrado (−6, 0) tem água em algum dos 121 pontos (senão o teste não separa)')
    limparMemoriaDaAgua()
  }

  // (17) A CHAVE DA CÉLULA é INJETIVA: duas células distintas nunca compartilham a chave. Uma colisão juntaria numa lista pontos de lugares diferentes; o RESULTADO não muda (os candidatos longe são filtrados pela distância)
  // mas o custo da busca volta a crescer: os mutantes «chave módulo 256» e «chave sem o cz» SOBREVIVIAM a todo o resto do teste justamente porque só mudam o custo (medido em 26/11).
  {
    const vistas = new Set<number>()
    for (let cx = -600; cx <= 600; cx += 1) for (let cz = -600; cz <= 600; cz += 1) vistas.add(chaveDaCelula(cx, cz))
    assert(vistas.size === 1201 * 1201, `a chave da célula é injetiva em 1.201 × 1.201 células de 10 m (${vistas.size} chaves distintas de ${1201 * 1201})`)
  }

  // (18) O ÍNDICE ESPACIAL contra a FORÇA BRUTA. `escavacaDoRio` procura o rio mais perto numa grade de células de 10 m (±2 células em volta do ponto); aqui a MESMA conta é feita SEM índice, varrendo todos os pontos e
  // segmentos dos 13 rios, em 400 pontos a até 22 m de algum rio e dos DOIS lados. Pega o que o perfil de um braço só não pega: uma busca de ±1 célula perde o rio a 10–16 m quando a célula do ponto está encostada do lado curto
  // (o mutante K3 sobrevivia: o perfil só olhava um lado do braço e o alinhamento das células escondia o erro).
  {
    limparMemoriaDaAgua()
    const sm = (x: number): number => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))
    const distSeg = (px: number, pz: number, ax: number, az: number, bx: number, bz: number): number => {
      const dx = bx - ax
      const dz = bz - az
      const L2 = dx * dx + dz * dz
      const u = L2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / L2)) : 0
      return Math.hypot(px - (ax + u * dx), pz - (az + u * dz))
    }
    const forcaBruta = (X: number, Z: number): { altura: number; nivel: number | null; dm: number } => {
      let dm = Infinity
      for (const r of lista) {
        for (let k = 0; k < r.pontos.length; k += 1) {
          dm = Math.min(dm, Math.hypot(r.pontos[k].X - X, r.pontos[k].Z - Z))
          if (k > 0) dm = Math.min(dm, distSeg(X, Z, r.pontos[k - 1].X, r.pontos[k - 1].Z, r.pontos[k].X, r.pontos[k].Z))
        }
      }
      const h0 = alturaBase(X, Z)
      if (dm > PARAMETROS_DA_AGUA.margemPlana + PARAMETROS_DA_AGUA.retorno) return { altura: h0, nivel: null, dm }
      let peso = 0
      let soma = 0
      for (const r of lista) {
        for (let k = 0; k < r.pontos.length; k += 1) {
          const w = 1 - sm((Math.hypot(r.pontos[k].X - X, r.pontos[k].Z - Z) - dm) / 3)
          if (w > 0) {
            peso += w
            soma += w * r.niveis[k]
          }
        }
      }
      const lv = soma / peso
      const margem = lv + 0.18
      const q = 1 - sm((dm - 5) / 11)
      const p = 1 - sm((dm - 1) / 2.6)
      return { altura: h0 + (margem - h0) * q - (margem - (lv - 0.5)) * p, nivel: dm < 6.5 ? lv : null, dm }
    }
    const sorteio2 = semente(4242)
    let amostras = 0
    let comAgua = 0
    let entre10e16 = 0
    let maiorDif = 0
    for (let n = 0; n < 20000 && amostras < 400; n += 1) {
      const r = lista[Math.floor(sorteio2() * lista.length)]
      const p = r.pontos[Math.floor(sorteio2() * r.pontos.length)]
      const X = p.X + (sorteio2() - 0.5) * 44
      const Z = p.Z + (sorteio2() - 0.5) * 44
      if (Math.abs(X) > 5.5 * LADO || Math.abs(Z) > 5.5 * LADO) continue // dentro do mundo dos 13 rios (um rio vizinho de fora não está na lista)
      const esperado = forcaBruta(X, Z)
      const obtido = escavacaDoRio(X, Z, alturaBase, zona)
      maiorDif = Math.max(maiorDif, Math.abs(obtido.altura - esperado.altura))
      assert((obtido.nivel === null) === (esperado.nivel === null), `a água em (${X.toFixed(2)}, ${Z.toFixed(2)}) concorda com a força bruta (índice ${obtido.nivel}, força bruta ${esperado.nivel})`)
      if (obtido.nivel !== null && esperado.nivel !== null) assert(Math.abs(obtido.nivel - esperado.nivel) < 1e-9, `o nível em (${X.toFixed(2)}, ${Z.toFixed(2)}) concorda com a força bruta (${obtido.nivel} contra ${esperado.nivel})`)
      assert(Math.abs(obtido.altura - esperado.altura) < 1e-9, `a altura em (${X.toFixed(2)}, ${Z.toFixed(2)}) concorda com a força bruta (índice ${obtido.altura}, força bruta ${esperado.altura}, distância ao rio ${esperado.dm.toFixed(2)} m)`)
      amostras += 1
      if (esperado.nivel !== null) comAgua += 1
      if (esperado.dm >= 10 && esperado.dm <= 16) entre10e16 += 1
    }
    assert(amostras === 400, `o teste da força bruta avaliou 400 pontos (avaliou ${amostras})`)
    assert(comAgua >= 40 && entre10e16 >= 30, `CONTROLE: a amostra tem pontos com água (${comAgua} ≥ 40) e pontos a 10–16 m do rio (${entre10e16} ≥ 30), onde uma busca curta erra`)
    limparMemoriaDaAgua()
  }

  // (19) O `h0` PRONTO. O gerador já calcula `alturaGlobal · (1 − máscara)` em cada ponto; recalculá-la dentro da escavação custava 185 ms por quadrado (235 % do gerador, medido com a altura de base real). A sobrecarga
  // `escavacaDoRioComBase(X, Z, h0, alturaBase, zonaPlana)` recebe o `h0` e NÃO chama `alturaBase` por ponto (só por rio, uma vez, quando o rio é calculado). (a) o resultado é IDÊNTICO ao da assinatura antiga; (b) depois
  // de aquecer a memória, uma varredura de 12.769 pontos chama `alturaBase` ZERO vezes, e a assinatura antiga a chama uma vez por ponto (CONTROLE: o contador enxerga).
  {
    limparMemoriaDaAgua()
    let chamadas = 0
    const contada = (X: number, Z: number): number => {
      chamadas += 1
      return alturaBase(X, Z)
    }
    const pontos: Array<readonly [number, number]> = []
    for (let x = -56; x <= 56; x += 1) for (let z = -56; z <= 56; z += 1) pontos.push([LADO * -1 + x, z])
    // aquece: calcula os rios e os guarda (a MESMA função `contada` para o cache de rios reconhecer)
    for (const [X, Z] of pontos) escavacaDoRioComBase(X, Z, alturaBase(X, Z), contada, zona)
    chamadas = 0
    let diferem = 0
    for (const [X, Z] of pontos) {
      const novo = escavacaDoRioComBase(X, Z, alturaBase(X, Z), contada, zona)
      const velho = escavacaDoRio(X, Z, contada, zona)
      if (novo.altura !== velho.altura || novo.nivel !== velho.nivel) diferem += 1
    }
    // a assinatura antiga chamou `contada` 1 vez por ponto (12.769); a nova, ZERO: o total medido só pode ser os 12.769 da antiga
    assert(diferem === 0, `com o h0 pronto o resultado é IDÊNTICO ao da assinatura antiga nos 12.769 pontos (${diferem} diferem)`)
    assert(chamadas === pontos.length, `CONTROLE: a assinatura antiga chama alturaBase uma vez por ponto (${chamadas} de ${pontos.length}) e a nova NENHUMA (as ${pontos.length} chamadas são todas da antiga)`)
    limparMemoriaDaAgua()
  }
}
