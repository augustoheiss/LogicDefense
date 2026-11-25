import { LIMIAR_ROCHA_COMECA, LIMIAR_ROCHA_TOTAL } from './misturaDoTerreno'

/**
 * A INJEÇÃO DE SHADER DO TERRENO (F2, Task 3, 25/11/2026). Função PURA sobre strings (sem `three`): recebe o código GLSL do vértice e do fragmento do `MeshStandardMaterial` (o que o `onBeforeCompile`
 * entrega) e devolve os dois com a MISTURA DE ROCHA. Testada no Node em `materialTerrenoRelevo.test.ts`.
 *
 * POR QUE NÃO COR POR VÉRTICE (medido em 25/11): a cor de vértice só MULTIPLICA (máximo 1,0), e a razão rocha/solo passa de 1 no canal azul da clareira (1,96), do bosque (1,72), da ribeira (1,39) e da
 * serra do ouro (1,32): a «rocha» sairia como um verde mais escuro, não como pedra cinza-azulada. Daí o `onBeforeCompile`, o risco 11 do plano («frágil, quebra em atualização do `three`»).
 *
 * A FRAGILIDADE REAL é a âncora que SOME: se o `three` renomear um chunk, o `replace` não casa e o terreno fica sem rocha, SEM ERRO. Por isso cada âncora é conferida e a injeção LANÇA se faltar,
 * e o teste lê o `three` instalado e confirma que as âncoras existem (atualizar o `three` e perder uma falha NO TESTE, não na foto).
 */

export const PEDACOS_DO_SHADER = {
  /** No vértice: depois dele `objectNormal` existe (a normal LOCAL; o terreno não tem rotação, então `objectNormal.y` é o `ny` do mundo). */
  ancoraVertice: '#include <beginnormal_vertex>',
  /** No fragmento: depois dele `diffuseColor` já tem a cor do solo (`map`), e a rocha entra por cima. */
  ancoraFragmento: '#include <map_fragment>',
  /** Marca de «já injetado»: o `three` chama `onBeforeCompile` de novo ao recompilar, e um `varying` declarado duas vezes é erro de compilação. */
  marca: '// terreno-relevo',
} as const

/** Repetições da rocha por metro-quadrado do quadrado (a textura da rocha ladrilha mais fino que a do solo). Número de ARTE: a foto decide. */
export const ESCALA_DA_ROCHA = 24

// 9 casas: o GLSL `float` guarda ~7 dígitos, e com 6 casas o limiar do COMEÇA (0,9438583…) saía 0,943858 e o peso diferia até 2,6e-6 do exato (calculado em 25/11). 9 casas o elimina na origem.
const f9 = (n: number): string => n.toFixed(9)

/**
 * Injeta a mistura de rocha. `peso = smootherstep((ny_comeca − ny) / (ny_comeca − ny_total))` (a MESMA curva de `pesoDaRocha`), calculado por vértice e interpolado; no fragmento a cor do solo
 * vira `mix(solo, rocha, peso)`. Lança se uma âncora faltar no lado que ainda precisa ser injetado. IDEMPOTENTE POR LADO: cada shader decide sozinho se já tem a marca. Com a guarda dos dois
 * juntos (a primeira versão), um vértice já injetado e um fragmento virgem faziam o vértice ser injetado de novo e o `varying` sair DUPLICADO (erro de compilação de GLSL); o teste do caso
 * parcial achou isso em 25/11. O `three` entrega os dois juntos, então não disparava hoje, mas a idempotência declarada tem de valer em qualquer combinação.
 */
export function injetarMisturaDeRocha(vertice: string, fragmento: string): { vertice: string; fragmento: string } {
  const { ancoraVertice, ancoraFragmento, marca } = PEDACOS_DO_SHADER
  const verticePronto = vertice.includes(marca)
  const fragmentoPronto = fragmento.includes(marca)
  if (verticePronto && fragmentoPronto) return { vertice, fragmento }
  if (!verticePronto && !vertice.includes(ancoraVertice)) throw new Error(`o shader do vértice não tem a âncora ${ancoraVertice}: o three mudou? A rocha do terreno não seria injetada`)
  if (!fragmentoPronto && !fragmento.includes(ancoraFragmento)) throw new Error(`o shader do fragmento não tem a âncora ${ancoraFragmento}: o three mudou? A rocha do terreno não seria injetada`)

  const pesoNoVertice = `${ancoraVertice}
${marca}
{
  float t = clamp((${f9(LIMIAR_ROCHA_COMECA)} - objectNormal.y) / (${f9(LIMIAR_ROCHA_COMECA)} - ${f9(LIMIAR_ROCHA_TOTAL)}), 0.0, 1.0);
  vPesoRocha = t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}`
  const misturaNoFragmento = `${ancoraFragmento}
${marca}
#ifdef USE_MAP
  diffuseColor.rgb = mix(diffuseColor.rgb, texture2D(uRochaMap, vMapUv * uRochaEscala).rgb, vPesoRocha);
#endif`

  return {
    vertice: verticePronto ? vertice : `${marca}\nvarying float vPesoRocha;\n${vertice.replace(ancoraVertice, pesoNoVertice)}`,
    fragmento: fragmentoPronto ? fragmento : `${marca}\nvarying float vPesoRocha;\nuniform sampler2D uRochaMap;\nuniform float uRochaEscala;\n${fragmento.replace(ancoraFragmento, misturaNoFragmento)}`,
  }
}
