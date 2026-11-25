import { DECLARACOES_DA_NEVOA, OPACIDADE_MINIMA_DA_NEVOA } from '../visual/glslDaNevoa'

/**
 * A NÉVOA INJETADA NO TERRENO (F2, passo (a3), 25/11/2026): a decisão do usuário («dentro do shader do chão»). Função PURA sobre strings (sem `three`), testada no Node em `nevoaNoTerreno.test.ts`,
 * com o mesmo padrão provado da rocha (`injetarMisturaDeRocha`): a âncora é conferida e a injeção LANÇA se ela sumir, é idempotente POR LADO, e a marca é a PRÓPRIA (diferente da da rocha: com a
 * mesma, a segunda injeção se acharia já feita e não rodaria).
 *
 * POR QUE `fog_fragment` (medido no `three` r184, `.superpowers/mut/ordem-do-fragmento.mjs`): a névoa do plano é um `ShaderMaterial` que escreve `gl_FragColor` direto, SEM luz e SEM tone mapping. Para o
 * terreno (um `MeshStandardMaterial`, que passa por luz, `tonemapping_fragment` Neutral e `colorspace_fragment`) parecer o plano, a névoa tem de entrar NO FIM da cadeia: depois de `colorspace_fragment`
 * e antes só do `dithering_fragment`. Aplicada antes da luz (em `map_fragment`) a luz do sol a multiplicaria e a névoa do terreno ficaria mais escura/clara que a do plano: uma costura a 56 m.
 *
 * A UV da névoa NÃO é a UV do solo: a do solo tem `v = 1 − (z+56)/112` (medido contra o `PlaneGeometry` do three) e a da névoa tem `v = (z+56)/112` (`vUv.y = z/112 + 0,5`). Usar a do solo inverteria
 * a névoa de norte para sul. Ela vem da POSIÇÃO LOCAL do vértice, igual ao vertex shader do plano.
 */

export const PEDACOS_DA_NEVOA_NO_TERRENO = {
  /** No vértice: depois dele `transformed` existe e `position` (local) está disponível. */
  ancoraVertice: '#include <begin_vertex>',
  /** No fragmento: o FIM da cadeia (depois de luz, tone mapping e conversão de cor). */
  ancoraFragmento: '#include <fog_fragment>',
  /** A marca da névoa, DIFERENTE da da rocha (`// terreno-relevo`). */
  marca: '// terreno-nevoa',
} as const

/**
 * Injeta a névoa no terreno. Lança se uma âncora faltar no lado que ainda precisa ser injetado. IDEMPOTENTE POR LADO (o `three` chama `onBeforeCompile` ao recompilar, e a rocha pode ter rodado antes).
 */
export function injetarNevoaNoTerreno(vertice: string, fragmento: string): { vertice: string; fragmento: string } {
  const { ancoraVertice, ancoraFragmento, marca } = PEDACOS_DA_NEVOA_NO_TERRENO
  const verticePronto = vertice.includes(marca)
  const fragmentoPronto = fragmento.includes(marca)
  if (verticePronto && fragmentoPronto) return { vertice, fragmento }
  if (!verticePronto && !vertice.includes(ancoraVertice)) throw new Error(`o shader do vértice não tem a âncora ${ancoraVertice}: o three mudou? A névoa do terreno não seria injetada e o chão vazaria o que o jogador não viu`)
  if (!fragmentoPronto && !fragmento.includes(ancoraFragmento)) throw new Error(`o shader do fragmento não tem a âncora ${ancoraFragmento}: o three mudou? A névoa do terreno não seria injetada e o chão vazaria o que o jogador não viu`)

  const uvNoVertice = `${ancoraVertice}
${marca}
vUvNevoa = vec2(position.x / 112.0 + 0.5, position.z / 112.0 + 0.5);`
  const nevoaNoFragmento = `${ancoraFragmento}
${marca}
{
  vec4 nevoaDoTerreno = corDaNevoa(vUvNevoa);
  if (nevoaDoTerreno.a > ${OPACIDADE_MINIMA_DA_NEVOA.toFixed(3)}) {
    gl_FragColor.rgb = mix(gl_FragColor.rgb, nevoaDoTerreno.rgb, nevoaDoTerreno.a);
  }
}`

  return {
    vertice: verticePronto ? vertice : `${marca}\nvarying vec2 vUvNevoa;\n${vertice.replace(ancoraVertice, uvNoVertice)}`,
    fragmento: fragmentoPronto ? fragmento : `${marca}\nvarying vec2 vUvNevoa;\n${DECLARACOES_DA_NEVOA}\n${fragmento.replace(ancoraFragmento, nevoaNoFragmento)}`,
  }
}
