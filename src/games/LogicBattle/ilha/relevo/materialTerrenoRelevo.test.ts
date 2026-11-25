import { ShaderChunk, ShaderLib } from 'three'
import { LIMIAR_ROCHA_COMECA, LIMIAR_ROCHA_TOTAL, pesoDaRocha } from './misturaDoTerreno'
import { injetarMisturaDeRocha, PEDACOS_DO_SHADER } from './materialTerrenoRelevo'

function assert(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem)
}

/**
 * A INJEÇÃO DE SHADER DO TERRENO (F2, Task 3, 25/11/2026): o risco 11 do plano («`onBeforeCompile` é frágil e quebra em atualização do `three`»). Decisão registrada: a cor por vértice NÃO
 * alcança a rocha (medido: a razão rocha/solo passa de 1 no canal azul de 4 dos 6 biomas, e a cor de vértice só multiplica, no máximo 1), então a mistura entra no fragmento.
 *
 * A fragilidade real não é o shader errado (a compilação acusa): é a âncora que SOME. Se uma versão nova do `three` renomear `map_fragment`, o `String.replace` não casa e o terreno fica SEM
 * rocha, em silêncio, sem erro nenhum. Por isso (1) a injeção LANÇA se uma âncora faltar, e (2) este teste importa o `three` REAL instalado (`ShaderLib`/`ShaderChunk`, o código que o jogo de fato
 * executa, sem ler arquivo: o projeto não tem `@types/node` e o `tsc -b` compila os testes) e confirma que as âncoras existem nos chunks e no programa do `MeshStandardMaterial` (`ShaderLib.standard`):
 * atualizar o `three` e perder uma âncora FALHA AQUI, não na foto.
 */
export function run(): void {
  const programaDoVertice = ShaderLib.standard.vertexShader
  const programaDoFragmento = ShaderLib.standard.fragmentShader

  // as âncoras existem no three INSTALADO: no programa do material padrão (o `MeshStandardMaterial` do terreno) e como chunk próprio
  const chunks = ShaderChunk as unknown as Record<string, string>
  for (const [ancora, programa] of [
    [PEDACOS_DO_SHADER.ancoraVertice, programaDoVertice],
    [PEDACOS_DO_SHADER.ancoraFragmento, programaDoFragmento],
  ] as const) {
    const nome = /#include <(\w+)>/.exec(ancora)?.[1]
    assert(nome !== undefined, `a âncora «${ancora}» tem de ser um #include <chunk>`)
    assert(programa.includes(ancora), `o programa do MeshStandardMaterial (ShaderLib.standard) do three instalado NÃO contém ${ancora}: a injeção do terreno falharia em silêncio`)
    assert(typeof chunks[nome] === 'string' && chunks[nome].length > 20, `o chunk ${nome} existe no three instalado`)
  }
  // o fragmento usa `vMapUv` (a UV do mapa): ele só existe com USE_MAP, e o `map_fragment` o lê. Se o three mudar o nome, a mistura amostraria a rocha com a UV errada.
  assert(chunks.map_fragment.includes('vMapUv'), 'o map_fragment do three instalado usa vMapUv (a UV que a rocha reutiliza)')
  // a âncora do vértice vem ANTES do uso da normal em `defaultnormal_vertex`: se o three reordenasse os chunks, `objectNormal` poderia ser lido antes de existir
  assert(programaDoVertice.indexOf(PEDACOS_DO_SHADER.ancoraVertice) >= 0 && programaDoVertice.indexOf(PEDACOS_DO_SHADER.ancoraVertice) < programaDoVertice.indexOf('#include <defaultnormal_vertex>'), 'no programa do three a âncora do vértice vem antes de defaultnormal_vertex (objectNormal ainda é a normal LOCAL)')

  // injetarMisturaDeRocha: devolve os dois shaders alterados; cada alteração aparece UMA vez e depois da âncora certa
  const vertice = `void main() {\n  #include <beginnormal_vertex>\n  #include <begin_vertex>\n}`
  const fragmento = `void main() {\n  vec4 diffuseColor = vec4( 1.0 );\n  #include <map_fragment>\n  #include <color_fragment>\n}`
  const out = injetarMisturaDeRocha(vertice, fragmento)
  assert(out.vertice !== vertice && out.fragmento !== fragmento, 'a injeção altera os dois shaders')
  const v = out.vertice
  const f = out.fragmento
  assert(v.includes('varying float vPesoRocha;'), 'o vértice declara o varying vPesoRocha')
  assert(f.includes('varying float vPesoRocha;') && f.includes('uniform sampler2D uRochaMap;'), 'o fragmento declara o varying e o mapa da rocha')
  // `indexOf` devolve −1 quando não acha, e `−1 < n` é VERDADEIRO: sem exigir que a âncora AINDA exista, o teste passava quando ela sumia (o mutante S16 de 25/11 sobreviveu por isso).
  const iAncoraV = v.indexOf('#include <beginnormal_vertex>')
  const iPesoV = v.indexOf('vPesoRocha =')
  assert(iAncoraV >= 0 && iPesoV >= 0, 'o vértice AINDA contém o #include <beginnormal_vertex> (o three o precisa para definir objectNormal) e o cálculo do peso')
  assert(iAncoraV < iPesoV, 'o peso é calculado DEPOIS de #include <beginnormal_vertex> (é ali que objectNormal nasce)')
  const iAncoraF = f.indexOf('#include <map_fragment>')
  const iMixF = f.indexOf('mix(')
  assert(iAncoraF >= 0 && iMixF >= 0, 'o fragmento AINDA contém o #include <map_fragment> (é ele que dá a cor do solo) e a mistura')
  assert(iAncoraF < iMixF, 'a mistura vem DEPOIS de #include <map_fragment> (é ali que diffuseColor recebe a cor do solo)')

  // O GLSL AVALIADO: extraio do shader a linha `float t = clamp(...)` e a polinomial do peso, e as calculo em JS com a mesma expressão, para 41 valores de `ny` (incluindo fora de [0, 1]). Compara com
  // `pesoDaRocha`, que já está provada. Isso prova a ORDEM dos limiares (o mutante S11 os trocava e a rocha entrava de baixo para cima), o `clamp` (sem ele o polinômio extrapola fora da faixa:
  // S13), e que a variável lida é `objectNormal.y` e não `.x` (S14).
  const linhaT = /float t = clamp\(\(([\d.]+) - objectNormal\.y\) \/ \(([\d.]+) - ([\d.]+)\), 0\.0, 1\.0\);/.exec(v)
  assert(linhaT !== null, 'o shader tem a linha `float t = clamp((COMEÇA - objectNormal.y) / (COMEÇA - TOTAL), 0.0, 1.0);` (a leitura é de objectNormal.y, a normal VERTICAL, e o resultado é preso a [0, 1])')
  const [numComeca, denComeca, denTotal] = [Number(linhaT[1]), Number(linhaT[2]), Number(linhaT[3])]
  assert(numComeca === denComeca, 'o mesmo limiar COMEÇA aparece no numerador e no denominador')
  assert(Math.abs(numComeca - LIMIAR_ROCHA_COMECA) < 1e-6 && Math.abs(denTotal - LIMIAR_ROCHA_TOTAL) < 1e-6, `o shader tem COMEÇA = ${numComeca} e TOTAL = ${denTotal}, e os de misturaDoTerreno são ${LIMIAR_ROCHA_COMECA.toFixed(9)} e ${LIMIAR_ROCHA_TOTAL.toFixed(9)}: a ORDEM (o primeiro é o mais plano) importa`)
  assert(numComeca > denTotal, 'COMEÇA (a normal MAIS vertical, o chão quase plano) é MAIOR que TOTAL (a encosta íngreme): trocados, a rocha entraria de baixo para cima')
  const avaliarShader = (ny: number): number => {
    const t = Math.min(1, Math.max(0, (numComeca - ny) / (denComeca - denTotal)))
    return t * t * t * (t * (t * 6 - 15) + 10)
  }
  for (let k = 0; k <= 40; k += 1) {
    const ny = -0.2 + k * 0.035 // de −0,2 a 1,2: dentro e FORA da faixa, e fora de [0, 1]
    assert(Math.abs(avaliarShader(ny) - pesoDaRocha(ny)) <= 1e-6, `o GLSL avaliado em ny=${ny.toFixed(3)} dá ${avaliarShader(ny)} e pesoDaRocha dá ${pesoDaRocha(ny)}`)
  }
  assert(avaliarShader(1.5) === 0 && avaliarShader(-0.5) === 1, 'fora da faixa o peso é 0 (chão) e 1 (penhasco): é o `clamp` que garante isso (sem ele o polinômio extrapola)')
  assert((v.match(/vPesoRocha =/g) ?? []).length === 1 && (f.match(/mix\(/g) ?? []).length === 1, 'cada injeção aparece uma vez')
  // os limiares do shader são OS DO TS TESTADO (`LIMIAR_ROCHA_*`), não números copiados à mão
  assert(v.includes(LIMIAR_ROCHA_COMECA.toFixed(9)) && v.includes(LIMIAR_ROCHA_TOTAL.toFixed(9)), `o shader usa os limiares de misturaDoTerreno.ts (${LIMIAR_ROCHA_COMECA.toFixed(9)} e ${LIMIAR_ROCHA_TOTAL.toFixed(9)})`)
  // e o smootherstep do shader é o MESMO do TS: o GLSL é `t*t*t*(t*(t*6.0-15.0)+10.0)`; avalio a MESMA expressão em JS nos pontos de controle e comparo com `pesoDaRocha`
  const ehSmootherstep = /t\s*\*\s*t\s*\*\s*t\s*\*\s*\(\s*t\s*\*\s*\(\s*t\s*\*\s*6\.0\s*-\s*15\.0\s*\)\s*\+\s*10\.0\s*\)/.test(v)
  assert(ehSmootherstep, 'o shader usa o smootherstep 6t⁵−15t⁴+10t³ (o mesmo do TS e do contrato «derivada zero nas pontas»)')
  for (const ny of [1, 0.95, LIMIAR_ROCHA_COMECA, 0.9, 0.85, (LIMIAR_ROCHA_COMECA + LIMIAR_ROCHA_TOTAL) / 2, LIMIAR_ROCHA_TOTAL, 0.7, 0.3]) {
    const t = Math.min(1, Math.max(0, (LIMIAR_ROCHA_COMECA - ny) / (LIMIAR_ROCHA_COMECA - LIMIAR_ROCHA_TOTAL)))
    const doShader = t * t * t * (t * (t * 6 - 15) + 10)
    assert(Math.abs(doShader - pesoDaRocha(ny)) <= 1e-12, `o smootherstep do shader difere de pesoDaRocha em ny=${ny}: ${doShader} contra ${pesoDaRocha(ny)}`)
  }

  // âncora que SOME: a injeção LANÇA (nunca devolve o shader intacto como se tivesse dado certo)
  for (const [nome, ver, frag] of [
    ['sem a âncora do vértice', 'void main() { #include <begin_vertex> }', fragmento],
    ['sem a âncora do fragmento', vertice, 'void main() { #include <color_fragment> }'],
    ['âncora do vértice renomeada pelo three', vertice.replace('beginnormal_vertex', 'begin_normal_vertex'), fragmento],
    ['âncora do fragmento renomeada pelo three', vertice, fragmento.replace('map_fragment', 'mapa_fragment')],
  ] as const) {
    let lancou = false
    try {
      injetarMisturaDeRocha(ver, frag)
    } catch {
      lancou = true
    }
    assert(lancou, `${nome}: a injeção tem de LANÇAR, não devolver o shader sem a rocha`)
  }
  // injetar duas vezes sobre o mesmo shader (o three chama `onBeforeCompile` de novo ao recompilar) NÃO duplica declarações (um `varying` repetido é erro de compilação)
  // Os DOIS lados, separadamente: um shader PARCIALMENTE injetado (o vértice já tem a marca e o fragmento não, ou o contrário) tem de ter o lado que falta injetado. Se a idempotência olhasse só um
  // lado, o outro ficaria sem rocha (ou com a declaração duplicada), em silêncio: o mutante S7 de 25/11 olhava só o vértice e sobreviveu.
  const soVerticePronto = injetarMisturaDeRocha(out.vertice, fragmento)
  assert((soVerticePronto.fragmento.match(/mix\(/g) ?? []).length === 1 && soVerticePronto.fragmento.includes('uniform sampler2D uRochaMap;'), 'vértice já injetado e fragmento virgem: o fragmento TEM de receber a mistura (senão fica sem rocha, em silêncio)')
  assert((soVerticePronto.vertice.match(/varying float vPesoRocha;/g) ?? []).length === 1, 'vértice já injetado e fragmento virgem: o vértice não duplica o varying')
  const soFragmentoPronto = injetarMisturaDeRocha(vertice, out.fragmento)
  assert((soFragmentoPronto.vertice.match(/varying float vPesoRocha;/g) ?? []).length === 1 && soFragmentoPronto.vertice.includes('vPesoRocha ='), 'fragmento já injetado e vértice virgem: o vértice TEM de receber o peso')
  assert((soFragmentoPronto.fragmento.match(/mix\(/g) ?? []).length === 1, 'fragmento já injetado e vértice virgem: o fragmento não duplica a mistura')
  const duas = injetarMisturaDeRocha(out.vertice, out.fragmento)
  assert((duas.vertice.match(/varying float vPesoRocha;/g) ?? []).length === 1, 'injetar de novo não duplica o varying do vértice')
  assert((duas.fragmento.match(/uniform sampler2D uRochaMap;/g) ?? []).length === 1, 'injetar de novo não duplica o uniform do fragmento')
  assert((duas.fragmento.match(/mix\(/g) ?? []).length === 1, 'injetar de novo não duplica a mistura')
}
