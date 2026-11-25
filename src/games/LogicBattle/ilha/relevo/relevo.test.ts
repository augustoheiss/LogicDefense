import { biomaDoQuadrado, gerarPaisagemBioma } from '../biomaRecursos'
import { lugarDaBaseInimiga } from '../partidaSim'
import {
  alturaEm,
  inclinacaoEm,
  LADO_RELEVO,
  MEIA_RELEVO,
  normalEm,
  RELEVO_REGRAS,
  transitavelEm,
  type CampoRelevo,
} from './campoRelevo'
import { alturaBrutaDoBioma, gerarRelevo, gerarRelevoFatiado, limparCacheRelevo, mascaraPlana } from './geradorRelevo'
import { codificarPng, hillshade, montarJanela, pintarQuadrado } from './laboratorio'
import { fbm, hash2, ridged, ruidoGradiente, suave } from './ruidoRelevo'

function assert(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem)
}

/** Gerador de números fixo (mulberry32): os testes de propriedade usam pontos «aleatórios» REPRODUTÍVEIS, nunca `Math.random`. */
function semente(valor: number): () => number {
  let t = valor >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

export function run(): void {
  testarRuido()
  testarCampo()
  testarLaboratorio()
  testarGeracaoFatiada()
  testarGerador()
}

/** O laboratório (Task 4): sombreado de relevo e PNG. Puro e sem dependência, para o preview rodar no Node sem pacote novo. */
function testarLaboratorio(): void {
  const lado = LADO_RELEVO
  const luzDoPlano = (altitude: number) => Math.round(255 * Math.sin((altitude * Math.PI) / 180))

  // campo plano: sombreado constante = sen(altitude do sol) · 255, em QUALQUER azimute (o plano não tem lado voltado para o sol)
  const plano = campoFabricado(() => 0)
  assert(hillshade(plano, 315, 45).length === lado * lado, 'hillshade devolve 113×113 valores')
  for (const azimute of [0, 90, 180, 270, 315]) {
    const sPlano = hillshade(plano, azimute, 45)
    const esperado = luzDoPlano(45)
    assert(sPlano.every((v) => Math.abs(v - esperado) <= 1), `campo plano deve sombrear constante ≈ ${esperado} no azimute ${azimute}° (veio ${sPlano[0]})`)
  }

  // A face voltada para a luz fica MAIS CLARA e a oposta mais escura. A normal de h = a·x é (−a, 1, 0): uma rampa que SOBE para o leste (a > 0) tem a normal apontando para o OESTE, ou seja,
  // está virada para um sol no oeste (azimute 270°) e recebe a luz; a que sobe para o oeste (a < 0) olha para o leste e fica na sombra.
  const sobeParaOLeste = campoFabricado((gx) => gx * 0.4)
  const sobeParaOOeste = campoFabricado((gx) => -gx * 0.4)
  const claro = hillshade(sobeParaOLeste, 270, 40)[(0 + 56) * lado + (0 + 56)]
  const escuro = hillshade(sobeParaOOeste, 270, 40)[(0 + 56) * lado + (0 + 56)]
  assert(claro > escuro + 20, `a face virada para o sol (oeste, azimute 270°) deve ser bem mais clara que a oposta (veio ${claro} × ${escuro})`)
  // o azimute importa: virar o sol de oeste (270°) para leste (90°) INVERTE quem é claro e quem é escuro
  const claroLeste = hillshade(sobeParaOOeste, 90, 40)[(0 + 56) * lado + (0 + 56)]
  assert(claroLeste > escuro + 20, 'virar o azimute do sol para leste ilumina a rampa que antes ficava escura')
  // ORIENTAÇÃO de um quadrado ISOLADO, contra uma referência independente (o mutante «linha da imagem não invertida» sobreviveu, porque o teste da janela compara `pintarQuadrado` consigo
  // mesmo): uma rampa que SOBE PARA O NORTE (+z) com o sol vindo do norte (azimute 0°) deixa a parte NORTE mais clara, e o norte tem de estar em CIMA da imagem.
  const sobeParaONorte = campoFabricado((_gx, gz) => gz * 0.1)
  const img = pintarQuadrado(sobeParaONorte, 'clareira', 180, 35) // sol no SUL (180°): ilumina a face virada para o sul, ou seja, onde a rampa sobe para o norte
  const lumi = (linha: number) => {
    const o = (linha * LADO_RELEVO + (LADO_RELEVO >> 1)) * 4
    return img[o] + img[o + 1] + img[o + 2]
  }
  assert(lumi(5) > lumi(LADO_RELEVO - 6) + 30, `com z crescendo para o norte, a altura (e a cor hipsométrica) maior deve aparecer em CIMA da imagem (cima ${lumi(5)}, baixo ${lumi(LADO_RELEVO - 6)})`)

  // todos os valores em 0..255, mesmo com declive enorme (parede quase vertical)
  const parede = hillshade(campoFabricado((gx) => gx * 30), 315, 45)
  assert(parede.every((v) => v >= 0 && v <= 255), 'hillshade fica em 0..255 mesmo numa parede')

  // PNG: assinatura, IHDR com a largura/altura certas e fim IEND; sem dependência externa
  const rgba = new Uint8Array(4 * 3 * 2)
  rgba.set([255, 0, 0, 255], 0)
  const png = codificarPng(3, 2, rgba)
  const assinatura = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  assert(assinatura.every((b, k) => png[k] === b), 'PNG começa com a assinatura de 8 bytes')
  const dv = new DataView(png.buffer, png.byteOffset, png.byteLength)
  assert(dv.getUint32(16) === 3 && dv.getUint32(20) === 2, `IHDR deve ter largura 3 e altura 2 (veio ${dv.getUint32(16)}×${dv.getUint32(20)})`)
  const fim = Array.from(png.slice(png.length - 8, png.length - 4)).map((b) => String.fromCharCode(b)).join('')
  assert(fim === 'IEND', `o PNG termina no chunk IEND (veio ${fim})`)
  let lancou = false
  try {
    codificarPng(3, 2, new Uint8Array(5))
  } catch {
    lancou = true
  }
  assert(lancou, 'codificarPng deve recusar um buffer do tamanho errado')

  // O CRC de CADA chunk é conferido com uma implementação INDEPENDENTE (bit a bit, sem tabela): um PNG com CRC errado é recusado por muitos leitores, e eu acharia que a foto sumiu por causa do
  // relevo. O mutante «CRC sem o xor final» sobreviveu ao teste só da assinatura/IHDR/IEND (24/11).
  const crcLento = (bytes: Uint8Array): number => {
    let c = 0xffffffff
    for (const b of bytes) {
      c ^= b
      for (let k = 0; k < 8; k += 1) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1
    }
    return (c ^ 0xffffffff) >>> 0
  }
  let pos = 8
  const tipos: string[] = []
  while (pos < png.length) {
    const tamanho = dv.getUint32(pos)
    const tipo = String.fromCharCode(png[pos + 4], png[pos + 5], png[pos + 6], png[pos + 7])
    const crcGravado = dv.getUint32(pos + 8 + tamanho)
    const crcCalculado = crcLento(png.subarray(pos + 4, pos + 8 + tamanho))
    assert(crcGravado === crcCalculado, `o CRC do chunk ${tipo} está errado (gravado ${crcGravado.toString(16)}, esperado ${crcCalculado.toString(16)})`)
    tipos.push(tipo)
    pos += 12 + tamanho
  }
  assert(tipos.join(',') === 'IHDR,IDAT,IEND', `a ordem dos chunks deve ser IHDR,IDAT,IEND (veio ${tipos.join(',')})`)
  assert(pos === png.length, 'o PNG não tem bytes sobrando depois do IEND')

  // O ADLER-32 do fluxo zlib (dentro do IDAT) também é conferido: um adler errado faz alguns leitores recusarem a imagem (o mutante «% 65520» sobreviveu, 24/11). Desmonto os blocos
  // «stored» à mão, recomponho os bytes crus e recalculo o adler com uma implementação própria.
  let ip = 8
  while (String.fromCharCode(png[ip + 4], png[ip + 5], png[ip + 6], png[ip + 7]) !== 'IDAT') ip += 12 + dv.getUint32(ip)
  const idatLen = dv.getUint32(ip)
  const z = png.subarray(ip + 8, ip + 8 + idatLen)
  assert(z[0] === 0x78 && z[1] === 0x01, 'o fluxo zlib começa com 78 01')
  const cruMontado: number[] = []
  let zp = 2
  for (;;) {
    const ultimo = z[zp] & 1
    const len = z[zp + 1] | (z[zp + 2] << 8)
    assert((~len & 0xffff) === (z[zp + 3] | (z[zp + 4] << 8)), 'o complemento do tamanho do bloco «stored» confere')
    for (let b = 0; b < len; b += 1) cruMontado.push(z[zp + 5 + b])
    zp += 5 + len
    if (ultimo) break
  }
  let adA = 1
  let adB = 0
  for (const b of cruMontado) {
    adA = (adA + b) % 65521
    adB = (adB + adA) % 65521
  }
  const adlerGravado = new DataView(z.buffer, z.byteOffset + zp, 4).getUint32(0)
  assert(adlerGravado === ((adB * 65536 + adA) >>> 0), `o Adler-32 do zlib está errado (gravado ${adlerGravado.toString(16)}, esperado ${((adB * 65536 + adA) >>> 0).toString(16)})`)
  assert(cruMontado.length === 2 * (1 + 3 * 4), 'os bytes crus têm (1 filtro + 3 pixels·4) por linha, em 2 linhas')
  assert(cruMontado[1] === 255 && cruMontado[2] === 0, 'o primeiro pixel (255,0,0,255) está no lugar certo do fluxo cru')

  // O PNG de 26 bytes acima NÃO distingue `% 65521` de `% 65520`: as somas ficam abaixo de 65520 e os dois módulos dão o MESMO adler ([511, 12011], provado por enumeração em 24/11), então o
  // mutante é equivalente para essa entrada. Uma imagem cheia de 0xFF diverge já a partir de 23 bytes: aqui uso 32×32 pixels brancos (4.128 bytes) e confiro o adler gravado.
  const branco = new Uint8Array(32 * 32 * 4).fill(255)
  const pngBranco = codificarPng(32, 32, branco)
  const dvB = new DataView(pngBranco.buffer, pngBranco.byteOffset, pngBranco.byteLength)
  let ipB = 8
  while (String.fromCharCode(pngBranco[ipB + 4], pngBranco[ipB + 5], pngBranco[ipB + 6], pngBranco[ipB + 7]) !== 'IDAT') ipB += 12 + dvB.getUint32(ipB)
  const zB = pngBranco.subarray(ipB + 8, ipB + 8 + dvB.getUint32(ipB))
  const crusB: number[] = []
  let zpB = 2
  for (;;) {
    const ult = zB[zpB] & 1
    const l = zB[zpB + 1] | (zB[zpB + 2] << 8)
    for (let b = 0; b < l; b += 1) crusB.push(zB[zpB + 5 + b])
    zpB += 5 + l
    if (ult) break
  }
  let aB = 1
  let bB = 0
  for (const x of crusB) {
    aB = (aB + x) % 65521
    bB = (bB + aB) % 65521
  }
  const gravadoB = new DataView(zB.buffer, zB.byteOffset + zpB, 4).getUint32(0)
  assert(gravadoB === ((bB * 65536 + aB) >>> 0), `o Adler-32 de uma imagem grande e clara está errado (gravado ${gravadoB.toString(16)}, esperado ${((bB * 65536 + aB) >>> 0).toString(16)})`)
  // controle do próprio teste: com módulo 65520 este mesmo conteúdo daria OUTRO adler (senão o teste não distinguiria o mutante)
  let aM = 1
  let bM = 0
  for (const x of crusB) {
    aM = (aM + x) % 65520
    bM = (bM + aM) % 65520
  }
  assert(((bM * 65536 + aM) >>> 0) !== gravadoB, 'controle: o módulo errado (65520) daria um Adler-32 diferente nesta imagem; sem isso o teste seria cego')

  // a janela monta (i1−i0+1)×113 por (j1−j0+1)×113 pixels, com as arestas dos vizinhos coladas (sem frestas)
  const j = montarJanela(-1, -1, 1, 1)
  assert(j.largura === 3 * LADO_RELEVO && j.altura === 3 * LADO_RELEVO && j.rgba.length === 4 * j.largura * j.altura, 'montarJanela(-1,-1,1,1) tem 3·113 por 3·113')
  assert(j.rgba.every((v) => v >= 0 && v <= 255), 'montarJanela só tem bytes válidos')
  let opacos = 0
  for (let k = 3; k < j.rgba.length; k += 4) if (j.rgba[k] === 255) opacos += 1
  assert(opacos === j.largura * j.altura, 'a janela é totalmente opaca (nenhum pixel transparente entre quadrados)')

  // ORIENTAÇÃO: o norte do jogo (j maior, +z) fica EM CIMA da imagem, e o leste (i maior, +x) à DIREITA. Sem este teste uma imagem espelhada passava (o mutante «j invertido» sobreviveu, 24/11)
  // e eu leria as fotos de cabeça para baixo. O quadrado (0,0) é a clareira, e a rua plana só existe nele: ela cruza o quadrado de z = −8 a 49 (parte de CIMA do (0,0), pois z cresce para o norte).
  // Compara BLOCO A BLOCO: o recorte de cada quadrado dentro da janela tem de ser IDÊNTICO ao quadrado montado sozinho (assim um quadrado trocado de lugar ou espelhado não passa).
  const recorte = (jan: { largura: number; rgba: Uint8Array }, x0: number, y0: number): string => {
    const partes: number[] = []
    for (let y = 0; y < LADO_RELEVO; y += 7) for (let x = 0; x < LADO_RELEVO; x += 7) {
      const o = ((y0 + y) * jan.largura + (x0 + x)) * 4
      partes.push(jan.rgba[o], jan.rgba[o + 1], jan.rgba[o + 2])
    }
    return partes.join(',')
  }
  const pilha = montarJanela(0, -1, 0, 1) // 3 quadrados empilhados: j=1 (norte) em CIMA, j=-1 (sul) EMBAIXO
  for (const jj of [1, 0, -1]) {
    const sozinho = montarJanela(0, jj, 0, jj)
    assert(recorte(pilha, 0, (1 - jj) * LADO_RELEVO) === recorte(sozinho, 0, 0), `o quadrado j=${jj} deve estar na linha ${1 - jj} da pilha (norte em cima)`)
  }
  const fila = montarJanela(0, 0, 2, 0) // 3 quadrados lado a lado: i=0 (oeste) à ESQUERDA, i=2 (leste) à DIREITA
  for (const ii of [0, 1, 2]) {
    const sozinho = montarJanela(ii, 0, ii, 0)
    assert(recorte(fila, ii * LADO_RELEVO, 0) === recorte(sozinho, 0, 0), `o quadrado i=${ii} deve estar na coluna ${ii} da fila (leste à direita)`)
  }
  // e os 3 quadrados são MESMO diferentes entre si (senão o teste acima passaria com a janela repetindo o mesmo quadrado)
  assert(new Set([1, 0, -1].map((jj) => recorte(montarJanela(0, jj, 0, jj), 0, 0))).size === 3, 'os quadrados (0,1), (0,0) e (0,-1) têm imagens diferentes')
}

/**
 * Gerar um quadrado custa ≈ 82 ms (medido em 24/11): inaceitável num quadro de 16,7 ms. A geração FATIADA faz o mesmo trabalho em passos de poucos ms entre quadros, e o resultado tem de ser
 * IDÊNTICO, byte a byte, ao da geração síncrona (um relevo diferente conforme o ritmo do computador quebraria I6).
 */
function testarGeracaoFatiada(): void {
  limparCacheRelevo()
  const sincrono = gerarRelevo(3, -4)
  limparCacheRelevo()
  // orçamento 0 ms = sempre 1 fatia mínima por passo: o pior caso de fatiamento (muitas fatias), e o resultado não pode depender disso
  const tarefa = gerarRelevoFatiado(3, -4)
  let passos = 0
  while (!tarefa.terminou()) {
    tarefa.passo(0)
    passos += 1
    if (passos > 200_000) throw new Error('a geração fatiada não termina')
  }
  const fatiado = tarefa.resultado()
  assert(passos > 20, `com orçamento 0 a geração deve levar vários passos (levou ${passos})`)
  assert(fatiado.alturas.length === sincrono.alturas.length && fatiado.i === 3 && fatiado.j === -4, 'o campo fatiado tem o mesmo formato')
  for (let k = 0; k < sincrono.alturas.length; k += 1) {
    if (fatiado.alturas[k] !== sincrono.alturas[k]) throw new Error(`I6: fatiado ≠ síncrono no índice ${k}: ${fatiado.alturas[k]} ≠ ${sincrono.alturas[k]}`)
  }
  // orçamento enorme = termina em 1 passo e dá o MESMO campo
  const tarefaGrande = gerarRelevoFatiado(3, -4)
  tarefaGrande.passo(1e9)
  assert(tarefaGrande.terminou(), 'com orçamento enorme termina em um passo')
  assert(tarefaGrande.resultado().alturas.every((v, k) => v === sincrono.alturas[k]), 'orçamento grande dá o mesmo campo')
  // pedir o resultado antes de terminar é erro explícito (nunca devolver um campo pela metade)
  const incompleta = gerarRelevoFatiado(3, -4)
  incompleta.passo(0)
  let lancou = false
  try {
    incompleta.resultado()
  } catch {
    lancou = true
  }
  assert(lancou, 'resultado() antes de terminar deve lançar erro (nunca devolver um campo incompleto)')
  // passo(NaN) e passo(negativo) não travam nem pulam trabalho
  const suja = gerarRelevoFatiado(3, -4)
  suja.passo(Number.NaN)
  suja.passo(-5)
  assert(!suja.terminou() || suja.resultado().alturas.length === sincrono.alturas.length, 'orçamento inválido não corrompe a geração')
}

/** Um campo fabricado à mão (113×113): `f(x, z)` dá a altura em cada nó. Serve para testar `alturaEm` sem depender do gerador. */
function campoFabricado(f: (x: number, z: number) => number): CampoRelevo {
  const alturas = new Float32Array(LADO_RELEVO * LADO_RELEVO)
  for (let gz = -MEIA_RELEVO; gz <= MEIA_RELEVO; gz += 1) {
    for (let gx = -MEIA_RELEVO; gx <= MEIA_RELEVO; gx += 1) alturas[(gz + MEIA_RELEVO) * LADO_RELEVO + (gx + MEIA_RELEVO)] = f(gx, gz)
  }
  return { i: 0, j: 0, alturas, nivelAgua: -0.4, versao: 1 }
}

function testarCampo(): void {
  // I1: sem campo = plano = o jogo de hoje
  assert(alturaEm(undefined, 3, 4) === 0 && alturaEm(undefined, -55, 55) === 0, 'sem campo a altura é 0 (I1)')
  assert(inclinacaoEm(undefined, 3, 4) === 0, 'sem campo a inclinação é 0 (I1)')
  const n0 = normalEm(undefined, 1, 1)
  assert(n0[0] === 0 && n0[1] === 1 && n0[2] === 0, 'sem campo a normal é (0,1,0)')
  assert(transitavelEm(undefined, 10, 10) === true, 'sem campo tudo é transitável (I1)')
  assert(LADO_RELEVO === 113 && MEIA_RELEVO === 56, 'a grade do relevo é a do chaoVisto: 113 = 2·56+1')

  // bilinear: exata nos nós e linear entre eles (rampa z = 0,5·x)
  const rampa = campoFabricado((gx) => gx * 0.5)
  assert(Math.abs(alturaEm(rampa, 10, 3) - 5) < 1e-5, 'alturaEm exata no nó (10,3)')
  assert(Math.abs(alturaEm(rampa, 10.5, 3) - 5.25) < 1e-5, 'alturaEm linear entre nós (10,5)')
  assert(Math.abs(alturaEm(rampa, -20.25, -7.75) - -10.125) < 1e-5, 'alturaEm bilinear em ponto qualquer')
  assert(Math.abs(inclinacaoEm(rampa, 5.3, 2.2) - 0.5) < 1e-3, `inclinação da rampa 0,5 (veio ${inclinacaoEm(rampa, 5.3, 2.2)})`)
  // O declive é a norma do gradiente nos DOIS eixos: uma rampa só em x não distingue `hypot(dx, dz)` de `|dx|` (o mutante «só o eixo x» sobreviveu, 24/11). Rampa em z, e diagonal 0,3/0,4 → 0,5.
  const rampaZ = campoFabricado((_gx, gz) => gz * 0.5)
  assert(Math.abs(inclinacaoEm(rampaZ, 5.3, 2.2) - 0.5) < 1e-3, `inclinação de uma rampa só em z deve ser 0,5 (veio ${inclinacaoEm(rampaZ, 5.3, 2.2)})`)
  const diagonal = campoFabricado((gx, gz) => gx * 0.3 + gz * 0.4)
  assert(Math.abs(inclinacaoEm(diagonal, -9.1, 14.6) - 0.5) < 1e-3, `a inclinação diagonal (0,3; 0,4) deve ser 0,5 (veio ${inclinacaoEm(diagonal, -9.1, 14.6)})`)
  assert(transitavelEm(rampaZ, 0, 0, 0.75) === true && transitavelEm(rampaZ, 0, 0, 0.4) === false, 'transitavelEm também enxerga o declive em z')
  // fora da grade: prende na borda (nunca NaN, nunca lê fora do array)
  assert(Number.isFinite(alturaEm(rampa, 1e9, -1e9)) && Number.isFinite(alturaEm(rampa, NaN, 0)), 'alturaEm fora/NaN continua finita')
  // transitável: o limiar é o declive
  assert(transitavelEm(rampa, 0, 0, 0.75) === true && transitavelEm(rampa, 0, 0, 0.4) === false, 'transitavelEm compara o declive com o limite')
  const normal = normalEm(rampa, 0, 0)
  assert(Math.abs(Math.hypot(normal[0], normal[1], normal[2]) - 1) < 1e-6 && normal[0] < 0, 'normal é unitária e inclina contra a subida')
  assert(RELEVO_REGRAS.declMaxAndar === 0.75 && RELEVO_REGRAS.declMaxObra === 0.35 && RELEVO_REGRAS.declMaxBloco === 0.18, 'limiares de declive aprovados (D4)')
  assert(RELEVO_REGRAS.janelaPassagem === 14 && RELEVO_REGRAS.passoJanela === 28 && RELEVO_REGRAS.raioBaseInimiga === 14, 'janelas e raio da base aprovados (D8, D15)')
}

/** Flood-fill 8-conexo sobre as células transitáveis do campo, a partir de `(x0, z0)`. Devolve o conjunto de índices alcançados. */
function alcancaveis(campo: CampoRelevo, x0: number, z0: number): Set<number> {
  const idx = (gx: number, gz: number) => (gz + MEIA_RELEVO) * LADO_RELEVO + (gx + MEIA_RELEVO)
  const visto = new Set<number>()
  if (!transitavelEm(campo, x0, z0)) return visto
  const fila: Array<[number, number]> = [[Math.round(x0), Math.round(z0)]]
  visto.add(idx(fila[0][0], fila[0][1]))
  while (fila.length > 0) {
    const [gx, gz] = fila.pop()!
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dz = -1; dz <= 1; dz += 1) {
        if (dx === 0 && dz === 0) continue
        const nx = gx + dx
        const nz = gz + dz
        if (Math.abs(nx) > MEIA_RELEVO || Math.abs(nz) > MEIA_RELEVO) continue
        const k = idx(nx, nz)
        if (visto.has(k) || !transitavelEm(campo, nx, nz)) continue
        visto.add(k)
        fila.push([nx, nz])
      }
    }
  }
  return visto
}

function testarGerador(): void {
  limparCacheRelevo()
  // O LRU do jogo guarda 64 quadrados, e este teste visita 169 + 200 em várias passadas: com o cache do jogo o mesmo quadrado era gerado ~5 vezes (93 s no total). A tabela local gera cada um UMA vez.
  const tabela = new Map<string, CampoRelevo>()
  const gerarUmaVez = (i: number, j: number): CampoRelevo => {
    const k = `${i},${j}`
    let c = tabela.get(k)
    if (!c) {
      c = gerarRelevo(i, j)
      tabela.set(k, c)
    }
    return c
  }
  const sorteio = semente(0xbe11a)
  const idx = (gx: number, gz: number) => (gz + MEIA_RELEVO) * LADO_RELEVO + (gx + MEIA_RELEVO)

  // I6: puro e determinístico; (2,-3) ≠ (-3,2)
  const a = gerarRelevo(2, -3)
  limparCacheRelevo()
  const b = gerarRelevo(2, -3)
  assert(a !== b && a.alturas.length === LADO_RELEVO * LADO_RELEVO, 'o cache foi limpo e a grade tem 113×113')
  for (let k = 0; k < a.alturas.length; k += 1) {
    if (a.alturas[k] !== b.alturas[k]) throw new Error(`I6: gerarRelevo(2,-3) mudou no índice ${k}`)
  }
  const c = gerarRelevo(-3, 2)
  let difere = 0
  for (let k = 0; k < a.alturas.length; k += 1) if (a.alturas[k] !== c.alturas[k]) difere += 1
  assert(difere > 1000, `(2,-3) e (-3,2) devem ter relevos diferentes (diferem em ${difere} células)`)
  assert(gerarRelevo(2, -3) === gerarRelevo(2, -3), 'o cache devolve o mesmo objeto')

  // Review Focus 1: finito em qualquer (i, j), inclusive negativo, zero e grande (mundo ilimitado)
  for (const [i, j] of [[-1000, -1000], [0, 0], [1000, 1000], [-7, 13], [123456, -98765]] as const) {
    const campo = gerarUmaVez(i, j)
    for (let k = 0; k < campo.alturas.length; k += 1) {
      if (!Number.isFinite(campo.alturas[k])) throw new Error(`altura não finita em (${i},${j}) índice ${k}`)
    }
  }

  // I3: emenda. A coluna x=+56 de (i,j) é igual à x=-56 de (i+1,j); idem em z
  for (let i = -6; i <= 6; i += 1) {
    for (let j = -6; j <= 6; j += 1) {
      const aqui = gerarUmaVez(i, j)
      const leste = gerarUmaVez(i + 1, j)
      const norte = gerarUmaVez(i, j + 1)
      for (let g = -MEIA_RELEVO; g <= MEIA_RELEVO; g += 1) {
        const dx = Math.abs(aqui.alturas[idx(MEIA_RELEVO, g)] - leste.alturas[idx(-MEIA_RELEVO, g)])
        const dz = Math.abs(aqui.alturas[idx(g, MEIA_RELEVO)] - norte.alturas[idx(g, -MEIA_RELEVO)])
        if (dx > 1e-4) throw new Error(`I3: emenda leste de (${i},${j}) quebrada em z=${g}: ${dx}`)
        if (dz > 1e-4) throw new Error(`I3: emenda norte de (${i},${j}) quebrada em x=${g}: ${dz}`)
      }
    }
  }

  // O RELEVO ESTÁ CENTRADO (25/11, decisão do usuário de 25/11 02h: «centrar o relevo»). MEDIDO (`medir-media-final.mjs`, 4 estimadores que concordam a < 0,011 m): ANTES de centrar a média da altura
  // PURA do arquétipo era +1,000 (clareira), +1,165 (bosque), +1,855 (serra), +0,750 (ribeira), +1,702 (tundra) e +2,139 m (basalto), e 90 a 99 % do chão ficava ACIMA de +0,33 m (o plano da
  // névoa) com 0 % abaixo de −0,2 m: nenhum vale, um platô de morros. Centrado, a média de cada bioma é ~0 e há vales DE VERDADE. O oráculo é a MÉDIA e a FRAÇÃO medidas, não a constante do código.
  // A AMOSTRA usa passo 13 (primo): uma grade de 4, 8 ou 16 m ALIASA com a escala 1/32 de bosque, tundra e basalto e dava médias erradas em até 0,9 m (2,324 / 2,574 / 3,048 contra 2,139).
  const BIOMAS_DO_RELEVO = ['clareira', 'bosque', 'serra_ouro', 'ribeira', 'tundra_cristal', 'basalto_brasa'] as const
  const amostrarBioma = (bioma: (typeof BIOMAS_DO_RELEVO)[number], passo: number): { media: number; abaixo: number; acima: number } => {
    let soma = 0
    let n = 0
    let abaixo = 0
    let acima = 0
    for (let X = -1200; X < 1200; X += passo) {
      for (let Z = -1200; Z < 1200; Z += passo) {
        const h = alturaBrutaDoBioma(bioma, X, Z)
        soma += h
        n += 1
        if (h < -0.2) abaixo += 1
        if (h > 0.33) acima += 1
      }
    }
    return { media: soma / n, abaixo: abaixo / n, acima: acima / n }
  }
  for (const bioma of BIOMAS_DO_RELEVO) {
    const a = amostrarBioma(bioma, 13)
    const b = amostrarBioma(bioma, 11)
    // os dois estimadores primos CONCORDAM (se discordarem, a amostra está aliasando e nenhum oráculo vale)
    assert(Math.abs(a.media - b.media) < 0.02, `os estimadores de passo 13 e 11 concordam para ${bioma} (${a.media.toFixed(3)} e ${b.media.toFixed(3)}): senão a amostra aliasa com a escala do ruído`)
    assert(Math.abs(a.media) < 0.05, `o relevo de ${bioma} está CENTRADO: a média da altura pura é ${a.media.toFixed(3)} m (antes de centrar: +0,75 a +2,14); precisa ficar a menos de 5 cm de 0`)
    // VALES de verdade e nada de platô. Previsto sem tocar no código (`prever-centrado.mjs`): 27 a 42 % abaixo de −0,2 m e 16 a 48 % acima de +0,33 m. Antes: 0 % abaixo, 90 a 99 % acima.
    assert(a.abaixo >= 0.2, `${bioma} tem vales: ao menos 20 % do chão abaixo de −0,2 m (veio ${(a.abaixo * 100).toFixed(1)} %; antes de centrar: 0 %)`)
    assert(a.acima <= 0.55, `${bioma} não é um platô: no máximo 55 % do chão acima de +0,33 m, o plano da névoa (veio ${(a.acima * 100).toFixed(1)} %; antes de centrar: 90 a 99 %)`)
  }

  // `alturaBrutaDoBioma` está AMARRADA ao campo real (fecha o mutante C12 de 25/11: a função de teste ignorando o arquétipo e medindo sempre a clareira dava média ~0 nos seis biomas e passava). O oráculo
  // é a MISTURA do gerador reescrita aqui, independente: a altura em (X, Z) é a média dos 4 cantos da célula que contém o ponto, com o peso `suave(fração)` em cada eixo, cada canto com a altura PURA do
  // SEU bioma. Em pontos sem máscara plana e longe das lagoas o campo é essa mistura (a diferença é só o `Float32Array`: medido 5,9e-8 m). Os biomas são sorteados por hash: o teste CONTA quantos
  // biomas distintos cobriu e exige os 6 (senão um bioma nunca amarrado poderia estar errado).
  {
    const biomasAmarrados = new Set<string>()
    let pontosAmarrados = 0
    let maiorDiferenca = 0
    for (let qi = -6; qi <= 6; qi += 1) {
      for (let qj = -6; qj <= 6; qj += 1) {
        const campoQ = gerarUmaVez(qi, qj)
        const lagoasQ = gerarPaisagemBioma(qi, qj, 5000).lagoas
        for (let gz = -40; gz <= 40; gz += 8) {
          for (let gx = -40; gx <= 40; gx += 8) {
            const X = 112 * qi + gx
            const Z = 112 * qj + gz
            if (mascaraPlana(X, Z) > 0) continue
            if (lagoasQ.some((l) => Math.hypot((gx - l.x) / (l.rx + 2), (gz - l.z) / (l.rz + 2)) < 1.5)) continue
            // a mistura do gerador, reescrita: a célula que contém o ponto e o peso suave em cada eixo
            const fi = X / 112
            const fj = Z / 112
            const i0 = Math.floor(fi)
            const j0 = Math.floor(fj)
            const tx = suave(fi - i0)
            const tz = suave(fj - j0)
            const cantos = [
              [biomaDoQuadrado(i0, j0), (1 - tx) * (1 - tz)],
              [biomaDoQuadrado(i0 + 1, j0), tx * (1 - tz)],
              [biomaDoQuadrado(i0, j0 + 1), (1 - tx) * tz],
              [biomaDoQuadrado(i0 + 1, j0 + 1), tx * tz],
            ] as const
            let esperado = 0
            for (const [bioma, peso] of cantos) {
              if (peso === 0) continue
              esperado += alturaBrutaDoBioma(bioma, X, Z) * peso
              biomasAmarrados.add(bioma)
            }
            maiorDiferenca = Math.max(maiorDiferenca, Math.abs(alturaEm(campoQ, gx, gz) - esperado))
            pontosAmarrados += 1
          }
        }
      }
    }
    assert(pontosAmarrados > 500, `a amarração tem pontos de verdade (${pontosAmarrados})`)
    assert(biomasAmarrados.size === 6, `a amarração cobre os 6 biomas (cobriu ${biomasAmarrados.size}: ${[...biomasAmarrados].join(', ')}): um bioma nunca amarrado poderia ter a altura errada em silêncio`)
    assert(maiorDiferenca < 1e-4, `o campo real é a MISTURA das alturas puras dos 4 biomas dos cantos (maior diferença ${maiorDiferenca.toExponential(2)} m; só o Float32Array explica algo): \`alturaBrutaDoBioma\` está amarrada ao gerador`)
  }

  // Planicidade obrigatória (sem a rua, 25/11): o CLARO DE NASCIMENTO em (0,0) onde o herói nasce; a pedra; o disco de 14 m da base inimiga de CADA quadrado.
  const origem = gerarUmaVez(0, 0)
  for (let ang = 0; ang < 360; ang += 15) {
    for (const r of [0, 1.5, RELEVO_REGRAS.claroDeNascimento]) {
      const x = Math.cos((ang * Math.PI) / 180) * r
      const z = Math.sin((ang * Math.PI) / 180) * r
      assert(Math.abs(alturaEm(origem, x, z)) <= 0.01, `o claro de nascimento (raio ${RELEVO_REGRAS.claroDeNascimento}) deve ser plano a ${ang}°, ${r} m: ${alturaEm(origem, x, z)}`)
    }
  }
  assert(Math.abs(alturaEm(origem, -8, 10)) <= 0.01, 'a pedra de 35 kg (−8, 10) fica em chão plano')
  // CONTROLE NEGATIVO da rua: o corredor (|x| ≤ 7, z de 12 a 49) e o anel da praça (raio 6 a 8,5) JÁ FORAM planos; sem a rua o relevo é livre ali. Se este teste cair, a rua voltou a achatar o quadrado.
  let maiorNoCorredor = 0
  for (let z = 14; z <= 46; z += 1) for (let x = -7; x <= 7; x += 1) maiorNoCorredor = Math.max(maiorNoCorredor, Math.abs(alturaEm(origem, x, z)))
  assert(maiorNoCorredor > 0.3, `sem a rua o corredor (|x| ≤ 7, z de 14 a 46) tem relevo de verdade em (0,0) (maior altura ${maiorNoCorredor.toFixed(3)} m): a rua não pode voltar a achatá-lo`)

  // O CLARO DE NASCIMENTO e a PEDRA existem EM TODO QUADRADO (25/11: a rua, a praça e as 3 caixas SAÍRAM do cenário por decisão do usuário; antes este bloco os exigia planos). O medidor
  // `desnivelNaZona` (abaixo) mede o desnível do campo dentro de uma zona. Ele tem CONTROLE POSITIVO e NEGATIVO logo depois: sem eles um medidor que devolve sempre 0 passaria («teste que não pode
  // falhar é teatro»).
  const desnivelNaZona = (campo: CampoRelevo, dentro: (x: number, z: number) => boolean): { desnivel: number; pontos: number } => {
    let mn = Number.POSITIVE_INFINITY
    let mx = Number.NEGATIVE_INFINITY
    let pontos = 0
    for (let z = -MEIA_RELEVO; z <= MEIA_RELEVO; z += 1) {
      for (let x = -MEIA_RELEVO; x <= MEIA_RELEVO; x += 1) {
        if (!dentro(x, z)) continue
        const h = alturaEm(campo, x, z)
        if (h < mn) mn = h
        if (h > mx) mx = h
        pontos += 1
      }
    }
    return { desnivel: pontos === 0 ? 0 : mx - mn, pontos }
  }
  const noClaro = (x: number, z: number): boolean => Math.hypot(x, z) <= RELEVO_REGRAS.claroDeNascimento
  const naPedra = (x: number, z: number): boolean => Math.hypot(x + 8, z - 10) <= 4.5
  // controle NEGATIVO do medidor: uma zona que ele não deveria achatar (um canto livre) tem desnível de verdade; e uma zona vazia devolve 0 pontos (não «0 m» por engano)
  assert(desnivelNaZona(origem, (x, z) => Math.abs(x) >= 30 && Math.abs(z) >= 30).desnivel > 0.3, 'controle do medidor: um canto livre do (0,0) tem de ter relevo (senão o gerador está morto)')
  assert(desnivelNaZona(origem, () => false).pontos === 0, 'controle do medidor: uma zona vazia mede 0 pontos')
  assert(desnivelNaZona(origem, noClaro).pontos > 30 && desnivelNaZona(origem, naPedra).pontos > 50, 'controle do medidor: o claro e a pedra têm pontos de verdade')
  // O CLARO DE NASCIMENTO e a PEDRA (a máscara, não o campo; sem a rua desde 25/11). O relevo bruto é tão áspero (declives de 1,7 m/m) que NENHUMA medida estatística do campo separa «com rampa» de «sem
  // rampa» (medido em 25/11), então a rampa só se prova na MÁSCARA, e o valor esperado é calculado AQUI com a fórmula do desenho (o SMOOTHERSTEP `6t⁵ − 15t⁴ + 10t³`, o `suave` de `ruidoRelevo.ts`),
  // escrita de forma explícita e independente do import: trocar `suave` por um smoothstep `3t² − 2t³` (que muda o valor em até 0,053) tem de acusar. (Na 1ª versão do teste da praça escrevi o
  // smoothstep de cabeça e ele falhou contra o gerador CERTO: um oráculo «independente» escrito sem ler a fórmula do código é palpite; estes valores foram MEDIDOS, `medir-mascara-nova.mjs`.)
  const suaveDoDesenho = (t: number): number => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * t * (t * (t * 6 - 15) + 10))
  const rampaDoDesenho = (dist: number, plano: number, rampa: number): number => (dist <= plano ? 1 : dist >= plano + rampa ? 0 : 1 - suaveDoDesenho((dist - plano) / rampa))
  const claro = RELEVO_REGRAS.claroDeNascimento
  assert(claro === 3.5, 'o claro de nascimento mede 3,5 m (o corpo do herói tem 0,35 m)')
  // (a) ao longo de +x, z = 0, só o claro manda (a pedra está a 12,8 m e vale ≤ 0,18 aqui; a base a ≥ 36 m): valores MEDIDOS em 25/11
  const MEDIDOS_DO_CLARO: ReadonlyArray<readonly [number, number]> = [[0, 1], [2, 1], [3.5, 1], [4, 0.994912], [5, 0.896484], [6, 0.653381], [8, 0.103516], [9.5, 0], [12, 0], [20, 0]]
  for (const [x, medido] of MEDIDOS_DO_CLARO) {
    const esperada = Math.max(rampaDoDesenho(Math.abs(x), claro, 6), rampaDoDesenho(Math.hypot(x + 8, -10), 4.5, 12))
    assert(Math.abs(esperada - medido) <= 1e-6, `(controle do oráculo) a fórmula do desenho em x=${x} dá ${esperada.toFixed(6)} e o valor medido foi ${medido}`)
    assert(Math.abs(mascaraPlana(x, 0) - esperada) <= 1e-9, `a máscara a ${x} m do centro (X=${x}, Z=0) deve ser ${esperada.toFixed(6)} (veio ${mascaraPlana(x, 0).toFixed(6)})`)
  }
  // a rampa está NO MEIO da faixa onde a rampa de 6 m e a de 12 m diferem muito (senão o mutante «rampa 12 em vez de 6» sobrevivia, como o da praça sobreviveu em 25/11)
  assert(rampaDoDesenho(6, claro, 6) > 0.5 && rampaDoDesenho(6, claro, 6) < 0.7 && rampaDoDesenho(6, claro, 12) > 0.9, '(controle do teste) a 6 m do centro a rampa de 6 m está no meio e a de 12 m ainda está quase plana')
  // (b) a PEDRA sozinha, a oeste dela ao longo de z = 10 (o claro está a ≥ 12,8 m): raio plano 4,5 m e rampa de 12 m
  for (const [x, medido] of [[-8, 1], [-12.5, 1], [-14, 0.983948], [-16, 0.847769], [-18, 0.577764], [-20, 0.275208], [-24, 0.000679]] as const) {
    const esperada = Math.max(rampaDoDesenho(Math.abs(x + 8), 4.5, 12), rampaDoDesenho(Math.hypot(x, 10), claro, 6))
    assert(Math.abs(esperada - medido) <= 1e-6, `(controle do oráculo) a fórmula da pedra em x=${x} dá ${esperada.toFixed(6)} e o valor medido foi ${medido}`)
    assert(Math.abs(mascaraPlana(x, 10) - esperada) <= 1e-9, `a máscara a oeste da pedra (X=${x}, Z=10) deve ser ${esperada.toFixed(6)} (veio ${mascaraPlana(x, 10).toFixed(6)})`)
  }
  // (c) A RUA SAIU: nenhum ponto do corredor antigo (|x| ≤ 7,5, z de 14 a 46) é achatado, em QUALQUER quadrado (a máscara é função do ponto global). Antes valia 1 em todos.
  for (const [i, j] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [2, -3], [-4, 5], [7, 7]] as const) {
    for (const [x, z] of [[0, 30], [5, 20], [-5, 40], [7, 45], [0, 46]] as const) {
      assert(mascaraPlana(112 * i + x, 112 * j + z) < 0.5, `o corredor da rua em (${i},${j}) a (${x}, ${z}) não é mais achatado (máscara ${mascaraPlana(112 * i + x, 112 * j + z).toFixed(4)})`)
    }
  }
  // (d) o claro e a pedra existem em TODO quadrado (a base inimiga de um vizinho só pode SOMAR) e o chão sob eles é PLANO. O medidor `desnivelNaZona` e a zona da pedra vêm do preâmbulo acima.
  for (const [i, j] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [2, -3], [-3, 2], [5, 4], [-4, -6], [7, -7], [-2, 1], [3, 3]] as const) {
    const campo = gerarUmaVez(i, j)
    const sobClaro = desnivelNaZona(campo, noClaro).desnivel
    const sobPedra = desnivelNaZona(campo, naPedra).desnivel
    assert(sobClaro <= 0.01, `o claro de nascimento de (${i},${j}) deve ser plano (desnível ${sobClaro.toFixed(3)} m)`)
    assert(sobPedra <= 0.01, `a pedra de (${i},${j}) deve ficar em chão plano (desnível ${sobPedra.toFixed(3)} m)`)
  }
  for (let i = -6; i <= 6; i += 1) {
    for (let j = -6; j <= 6; j += 1) {
      const campo = gerarUmaVez(i, j)
      const base = lugarDaBaseInimiga(i, j)
      for (let ang = 0; ang < 360; ang += 30) {
        const x = Math.max(-MEIA_RELEVO, Math.min(MEIA_RELEVO, base.x + Math.cos((ang * Math.PI) / 180) * (RELEVO_REGRAS.raioBaseInimiga - 1)))
        const z = Math.max(-MEIA_RELEVO, Math.min(MEIA_RELEVO, base.z + Math.sin((ang * Math.PI) / 180) * (RELEVO_REGRAS.raioBaseInimiga - 1)))
        assert(Math.abs(alturaEm(campo, x, z)) <= 0.01, `a base inimiga de (${i},${j}) deve ficar em chão plano (${x.toFixed(1)},${z.toFixed(1)}): ${alturaEm(campo, x, z)}`)
      }
    }
  }

  // Janelas de passagem: em cada aresta, a cada 28 m, uma janela transitável e CONECTADA ao centro do quadrado
  const janelas: Array<[number, number]> = []
  for (let t = -42; t <= 42; t += RELEVO_REGRAS.passoJanela) {
    janelas.push([MEIA_RELEVO, t], [-MEIA_RELEVO, t], [t, MEIA_RELEVO], [t, -MEIA_RELEVO])
  }
  // A janela de passagem é PLANA (altura ≈ 0 ao longo de todos os seus 14 m), não apenas «transitável»: um relevo suave também é transitável, e um teste só de transitabilidade deixava passar
  // as janelas no lugar errado (o mutante «centro em 28·k» sobreviveu: 266 de 565 pontos da aresta diferiam e nenhum teste notava). Medido em 24/11.
  for (const [i, j] of [[0, 0], [2, 3], [-3, 1], [5, -4], [-1, -6], [7, 7], [-8, 2]] as const) {
    const campo = gerarUmaVez(i, j)
    for (let centro = -42; centro <= 42; centro += RELEVO_REGRAS.passoJanela) {
      for (let desloc = -RELEVO_REGRAS.janelaPassagem / 2; desloc <= RELEVO_REGRAS.janelaPassagem / 2; desloc += 1) {
        for (const [x, z] of [[MEIA_RELEVO, centro + desloc], [-MEIA_RELEVO, centro + desloc], [centro + desloc, MEIA_RELEVO], [centro + desloc, -MEIA_RELEVO]] as const) {
          assert(Math.abs(alturaEm(campo, x, z)) <= 0.01, `a janela de passagem de (${i},${j}) deve ser plana em (${x},${z}): ${alturaEm(campo, x, z)}`)
        }
      }
    }
  }

  // I4: nascimento, base, janelas e recursos na MESMA componente, em −6…+6 e em 200 pares pseudoaleatórios de até ±1000
  const pares: Array<[number, number]> = []
  for (let i = -6; i <= 6; i += 1) for (let j = -6; j <= 6; j += 1) pares.push([i, j])
  for (let k = 0; k < 200; k += 1) pares.push([Math.floor(sorteio() * 2001) - 1000, Math.floor(sorteio() * 2001) - 1000])
  let somaTransitavel = 0
  let menorTransitavel = 1
  let maiorTransitavel = 0
  let maisPresos = 0
  for (const [i, j] of pares) {
    const campo = gerarUmaVez(i, j)
    const base = lugarDaBaseInimiga(i, j)
    const centro = alcancaveis(campo, base.x, base.z)
    assert(centro.size > 0, `a base inimiga de (${i},${j}) deve ser transitável`)
    for (const [jx, jz] of janelas) {
      assert(centro.has(idx(Math.round(jx), Math.round(jz))), `I4: a janela (${jx},${jz}) de (${i},${j}) não se conecta à base`)
    }
    // Recursos: `gerarPaisagemBioma` ainda não conhece o relevo e pode pôr um recurso num penhasco (F2 o move para o ponto transitável mais próximo). Em F0 a garantia é «no máximo 2 presos por
    // quadrado»: medido em 24/11 (369 quadrados) 337 não prendem nenhum, 27 prendem 1 e 5 prendem 2; 3 ou mais significariam relevo agressivo demais. A base, as 16 janelas e a fração
    // transitável NUNCA falham, e continuam rígidas aqui.
    const paisagem = gerarPaisagemBioma(i, j, 5000)
    let presos = 0
    for (const r of paisagem.recursos) if (!centro.has(idx(Math.round(r.x), Math.round(r.z)))) presos += 1
    maisPresos = Math.max(maisPresos, presos)
    assert(presos <= 2, `I4: ${presos} recursos de (${i},${j}) ficaram presos fora da componente da base (máximo tolerado em F0: 2)`)
    if (i === 0 && j === 0) assert(centro.has(idx(0, 0)), 'I4: o nascimento (0,0) está na componente da base')
    const fracao = centro.size / (LADO_RELEVO * LADO_RELEVO)
    somaTransitavel += fracao
    menorTransitavel = Math.min(menorTransitavel, fracao)
    maiorTransitavel = Math.max(maiorTransitavel, fracao)
  }
  // fração transitável. DUAS garantias distintas, não um intervalo único:
  //  (1) JOGABILIDADE, por quadrado: nenhum quadrado pode ter menos de 60 % do chão alcançável (senão o jogador fica sem onde jogar);
  //  (2) VIDA do relevo, no CONJUNTO: um quadrado liso é legítimo (a clareira é de colinas suaves), mas o gerador inteiro não pode ser plano. Em algum lugar tem de haver penhasco de verdade
  //      (declive > 0,75): é o controle que impede um gerador morto de passar «tudo transitável» como se fosse sucesso.
  // Medido em 24/11: 96,4 % a 100 % por quadrado; a AMPLITUDE final do relevo se decide em F2, olhando as fotos e depois de a colocação dos recursos respeitar o terreno.
  assert(menorTransitavel >= 0.6, `nenhum quadrado pode ter menos de 60 % do chão transitável (o pior veio com ${menorTransitavel.toFixed(3)})`)
  assert(maiorTransitavel <= 1, 'a fração transitável não passa de 100 %')
  let celulasDePenhasco = 0
  for (const [i, j] of pares.slice(0, 169)) {
    const campo = gerarUmaVez(i, j)
    for (let gz = -50; gz <= 50; gz += 2) for (let gx = -50; gx <= 50; gx += 2) if (!transitavelEm(campo, gx, gz)) celulasDePenhasco += 1
  }
  assert(celulasDePenhasco > 200, `o relevo deve ter penhascos de verdade em algum lugar (declive > ${RELEVO_REGRAS.declMaxAndar}); achei só ${celulasDePenhasco} células em 169 quadrados`)

  // Lagoas: o leito fica entre 0,5 e 0,9 m ABAIXO da água, em todo quadrado que tem lagoa (serra_ouro não tem nenhuma)
  // A bacia CEDE à base inimiga (a base cresce em anéis sem teto e peça inimiga não nasce n'água): uma lagoa cujo centro cai a menos de 14 m + 12 m de rampa de uma base fica sem leito.
  // Essas são contadas à parte (F2 as desenha como brejo ou as omite); todas as OUTRAS têm de ter o leito entre 0,5 e 0,9 m abaixo da água.
  // O CLARO de nascimento e a PEDRA (em TODO quadrado) tiram a bacia da mesma forma que a base: a máscara plana no centro da lagoa passa de 0,5 e o leito não é escavado. A RUA e a PRAÇA saíram em
  // 25/11 (decisão do usuário) e levaram quase todas as invasoras: MEDIDO em 169 quadrados (`medir-lagoas-semrua.mjs`), das 146 lagoas fora da base só 1 fica sem leito (as outras 145 têm o leito
  // cheio, 0,5–0,9 m abaixo da água, e NENHUMA parcial). Antes eram 16 invasoras da rua e 130 livres. O limiar de 6 m separa os dois grupos com folga (o centro da lagoa invasora fica a ≤ 5,80 m das
  // zonas planas e as livres a ≥ 6,06 m, medido em 25/11 em 289 quadrados). `gerarPaisagemBioma` (de outra frente, não muda) ainda descarta lagoa na avenida antiga (`|lx| < 10 && −10 < lz < 48`).
  const distanciaAsZonasPlanas = (x: number, z: number): number =>
    Math.min(Math.max(0, Math.hypot(x, z) - RELEVO_REGRAS.claroDeNascimento), Math.max(0, Math.hypot(x + 8, z - 10) - 4.5))
  let lagoasVistas = 0
  let lagoasComLeito = 0
  let lagoasNoLeitoNormal = 0
  let lagoasEmVale = 0
  let lagoaMaisFunda = 0
  let lagoasInvasoras = 0
  let lagoasInvasorasDasZonas = 0
  for (const [i, j] of pares.slice(0, 169)) {
    const campo = gerarUmaVez(i, j)
    const base = lugarDaBaseInimiga(i, j)
    for (const lagoa of gerarPaisagemBioma(i, j, 5000).lagoas) {
      lagoasVistas += 1
      const fundo = alturaEm(campo, lagoa.x, lagoa.z)
      const invadeBase = Math.hypot(lagoa.x - base.x, lagoa.z - base.z) < RELEVO_REGRAS.raioBaseInimiga + 12
      if (invadeBase) {
        lagoasInvasoras += 1
        continue
      }
      if (distanciaAsZonasPlanas(lagoa.x, lagoa.z) < 6) {
        // a invasora da RUA fica SEM leito (a rua plana vence a bacia): F2 a desenha como brejo ou a omite. Medido em 25/11: das 35 em 289 quadrados, as 35 ficam sem leito (fundo ≥ água),
        // nenhuma parcial. O que este teste proíbe é o PIOR caso visual, um leito PARCIAL (um buraco raso de 0 a 0,5 m, nem lagoa nem chão): a regra é tudo-ou-nada.
        lagoasInvasorasDasZonas += 1
        assert(
          campo.nivelAgua - fundo <= 0 || campo.nivelAgua - fundo >= 0.5 - 1e-3,
          `a lagoa invasora do claro/pedra de (${i},${j}) não pode ter leito PARCIAL (tem ${(campo.nivelAgua - fundo).toFixed(2)} m abaixo da água): ou tem o leito cheio ou fica sem leito`,
        )
        continue
      }
      lagoasComLeito += 1
      // COM O RELEVO CENTRADO (25/11) o terreno tem vales: uma lagoa cujo centro cai num vale natural fica MAIS FUNDA que o leito escavado (a bacia faz `min(h, leito)`). O leito normal é 0,5–0,9 m;
      // o que NUNCA pode é ser rasa (< 0,5 m: nem lagoa nem chão) nem um poço (> 2,0 m). Medido: 147 de 150 em 0,90 m exatos; as outras 3 em 0,97, 1,35 e 1,71 m.
      const profundidade = campo.nivelAgua - fundo
      assert(profundidade >= 0.5 - 1e-3 && profundidade <= 2.0, `lagoa de (${i},${j}) tem de ter entre 0,5 e 2,0 m de água (veio ${profundidade.toFixed(2)}): rasa demais não é lagoa, funda demais é poço`)
      if (profundidade <= 0.9 + 1e-3) lagoasNoLeitoNormal += 1
      else lagoasEmVale += 1
      lagoaMaisFunda = Math.max(lagoaMaisFunda, profundidade)
    }
  }
  assert(lagoasVistas > 100, `o teste das lagoas deve ter visto lagoas de verdade (viu ${lagoasVistas})`)
  // Medido em 25/11 nos 169 quadrados SEM A RUA: 145 lagoas livres, 16 invasoras da base e 1 invasora do claro/pedra (antes, com a rua: 130 livres e 16 invasoras da rua). Das 130 livres de ANTES, 35 ficam entre 6 e 12 m das zonas planas: um limiar de invasora mais largo (12 m,
  // o mutante L2 de 25/11) as engoliria e a checagem do leito cairia a 95, que o antigo `> 90` aceitava em silêncio. `>= 125` separa 130 (limiar certo) de 95 (limiar largo demais).
  // A MAIORIA fica no leito normal (0,5–0,9 m) e algumas caem em vales (controle POSITIVO: sem lagoa em vale o ramo novo seria letra morta). Medido: 147 no leito normal, 3 em vale, a mais funda 1,71 m.
  assert(lagoasNoLeitoNormal / lagoasComLeito >= 0.95, `ao menos 95 % das lagoas ficam no leito normal de 0,5–0,9 m (${lagoasNoLeitoNormal} de ${lagoasComLeito}; medido em 25/11: 147 de 150)`)
  assert(lagoasEmVale >= 1 && lagoasEmVale <= 8, `o relevo com vales põe ALGUMAS lagoas em vales (${lagoasEmVale}; medido: 3): sem nenhuma a asserção de profundidade máxima nunca executaria, com muitas o leito deixou de ser o normal`)
  assert(lagoaMaisFunda > 1.0 && lagoaMaisFunda < 2.0, `a lagoa mais funda tem de ser maior que 1,0 m (vale de verdade) e menor que 2,0 m (veio ${lagoaMaisFunda.toFixed(2)}; medido: 1,71)`)
  assert(lagoasComLeito >= 140, `o teste das lagoas livres deve ter checado quase todas as lagoas livres (checou ${lagoasComLeito}, esperado 145; invasoras da base ${lagoasInvasoras}, da rua ${lagoasInvasorasDasZonas})`)
  // controle do ramo novo: sem invasoras da rua na amostra a asserção de «leito parcial» nunca executaria (teste que não pode falhar). Em 169 quadrados há 16 (medido em 25/11; fora elas, 16 da base e 130 livres).
  assert(lagoasInvasorasDasZonas >= 1, `o teste deve ter visto lagoas invasoras do claro/pedra (viu ${lagoasInvasorasDasZonas}); sem elas a regra do leito parcial é letra morta`)
  assert(somaTransitavel > 0, 'o somatório de transitável foi calculado')
  // controle do próprio teste: o relevo TEM de prender algum recurso em algum quadrado, senão «presos ≤ 1» passaria com um relevo morto (plano)
  assert(maisPresos >= 1, 'o relevo deve ser forte o bastante para prender ao menos 1 recurso em algum quadrado (senão o teste de recursos é vazio)')
}

function testarRuido(): void {
  const sorteio = semente(0xa11ce)

  // hash2: determinístico, em [0, 1) e sensível à entrada
  for (let k = 0; k < 10_000; k += 1) {
    const ix = Math.floor(sorteio() * 4000) - 2000
    const iz = Math.floor(sorteio() * 4000) - 2000
    const v = hash2(ix, iz, 7)
    assert(v >= 0 && v < 1, `hash2 fora de [0,1): ${v} em (${ix},${iz})`)
    assert(v === hash2(ix, iz, 7), 'hash2 não é determinístico')
  }
  assert(hash2(1, 2, 7) !== hash2(2, 1, 7), 'hash2 deve distinguir (1,2) de (2,1)')
  assert(hash2(1, 2, 7) !== hash2(1, 2, 8), 'hash2 deve depender do sal')

  // ruidoGradiente: contínuo e nulo nos nós inteiros
  let piorSalto = 0
  for (let k = 0; k < 2000; k += 1) {
    const x = sorteio() * 400 - 200
    const z = sorteio() * 400 - 200
    const a = ruidoGradiente(x, z, 3)
    const b = ruidoGradiente(x + 1e-3, z, 3)
    piorSalto = Math.max(piorSalto, Math.abs(a - b))
    assert(a >= -1 && a <= 1, `ruidoGradiente fora de [-1,1]: ${a}`)
  }
  assert(piorSalto < 0.01, `ruidoGradiente não é contínuo (pior salto ${piorSalto})`)
  for (const [nx, nz] of [[0, 0], [3, -7], [-12, 40]] as const) {
    assert(Math.abs(ruidoGradiente(nx, nz, 3)) < 1e-9, `ruidoGradiente deve valer 0 no nó (${nx},${nz})`)
  }

  // fbm e ridged: nos seus intervalos e determinísticos
  for (let k = 0; k < 500; k += 1) {
    const x = sorteio() * 300 - 150
    const z = sorteio() * 300 - 150
    const f = fbm(x, z, 5, 5)
    const r = ridged(x, z, 5, 4)
    assert(f >= -1 && f <= 1, `fbm fora de [-1,1]: ${f}`)
    assert(r >= 0 && r <= 1, `ridged fora de [0,1]: ${r}`)
    assert(f === fbm(x, z, 5, 5) && r === ridged(x, z, 5, 4), 'fbm/ridged não determinísticos')
  }

  // Review Focus 1: finitas em qualquer coordenada real, inclusive ±1e6 (o mundo é ilimitado)
  for (const x of [-1e6, -1000, 0, 0.5, 1000, 1e6]) {
    for (const z of [-1e6, -1000, 0, 0.5, 1000, 1e6]) {
      for (const valor of [ruidoGradiente(x, z, 1), fbm(x, z, 1, 4), ridged(x, z, 1, 4)]) {
        assert(Number.isFinite(valor), `ruído não finito em (${x},${z})`)
      }
    }
  }

  // A AMPLITUDE do ruído é o que o contrato promete (≈ ±1), não só «cabe em [-1,1]»: sem o fator √2 ele ficaria em ≈ ±0,7 e as montanhas sairiam 30 % mais baixas sem aviso.
  let maiorAmplitude = 0
  for (let x = -40; x < 40; x += 0.173) {
    for (let z = -40; z < 40; z += 0.211) maiorAmplitude = Math.max(maiorAmplitude, Math.abs(ruidoGradiente(x, z, 3)))
  }
  assert(maiorAmplitude > 0.85 && maiorAmplitude <= 1, `ruidoGradiente deve chegar perto de ±1 (veio ${maiorAmplitude.toFixed(3)})`)

  // suave: smootherstep, extremos fixos e monótona
  assert(suave(0) === 0 && suave(1) === 1 && Math.abs(suave(0.5) - 0.5) < 1e-12, 'suave: extremos e meio')
  // O que JUSTIFICA o smootherstep: derivada ZERO nas pontas (a emenda entre blocos de ruído não mostra quina) e 1,875 no meio. Um `suave(t) = t` passaria em tudo acima.
  const passo = 1e-4
  const derivadaEm0 = (suave(passo) - suave(0)) / passo
  const derivadaEm1 = (suave(1) - suave(1 - passo)) / passo
  const derivadaNoMeio = (suave(0.5 + passo) - suave(0.5 - passo)) / (2 * passo)
  assert(Math.abs(derivadaEm0) < 1e-3 && Math.abs(derivadaEm1) < 1e-3, `suave deve ter derivada 0 nas pontas (veio ${derivadaEm0}, ${derivadaEm1})`)
  assert(Math.abs(derivadaNoMeio - 1.875) < 1e-3, `suave deve ter derivada 1,875 no meio (veio ${derivadaNoMeio})`)
  assert(suave(-5) === 0 && suave(5) === 1, 'suave deve prender fora de [0,1]')
  let anterior = -1
  for (let t = 0; t <= 1.0001; t += 0.01) {
    const s = suave(t)
    assert(s >= anterior, 'suave deve ser monótona')
    anterior = s
  }
}
