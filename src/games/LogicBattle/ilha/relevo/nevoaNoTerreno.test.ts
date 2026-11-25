import { ShaderChunk, ShaderLib } from 'three'
import { DECLARACOES_DA_NEVOA, OPACIDADE_MINIMA_DA_NEVOA } from '../visual/glslDaNevoa'
import { injetarMisturaDeRocha, PEDACOS_DO_SHADER } from './materialTerrenoRelevo'
import { injetarNevoaNoTerreno, PEDACOS_DA_NEVOA_NO_TERRENO } from './nevoaNoTerreno'

function assert(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem)
}

/**
 * A NÉVOA INJETADA NO TERRENO (F2, passo (a3), 25/11/2026): a decisão do usuário («dentro do shader do chão»). O chão com relevo é o `MeshStandardMaterial` do `TerrenoRelevoCena`; a névoa pintada
 * entra nele por `onBeforeCompile`, com a MESMA função `corDaNevoa` do plano (`DECLARACOES_DA_NEVOA`), para as duas regiões (dentro do quadrado: o terreno; fora: o plano) parecerem UMA, sem costura.
 *
 * É a SEGUNDA injeção de shader (a primeira é a rocha): o risco 11 do plano. A mitigação é a mesma, provada: (1) a âncora é conferida contra o `three` INSTALADO e a injeção LANÇA se ela sumir;
 * (2) idempotente por lado; (3) o que o GLSL faz é LIDO do texto. A UV da névoa NÃO é a UV do solo (a do solo tem `v` espelhado em relação à da névoa, medido no three real em 25/11): vem da POSIÇÃO
 * LOCAL do vértice, `(x/112 + 0,5, z/112 + 0,5)`, igual ao vertex shader do plano.
 */
export function run(): void {
  const programaDoFragmento = ShaderLib.standard.fragmentShader
  const programaDoVertice = ShaderLib.standard.vertexShader
  const chunks = ShaderChunk as unknown as Record<string, string>

  // as âncoras existem no three INSTALADO
  for (const [ancora, programa] of [
    [PEDACOS_DA_NEVOA_NO_TERRENO.ancoraVertice, programaDoVertice],
    [PEDACOS_DA_NEVOA_NO_TERRENO.ancoraFragmento, programaDoFragmento],
  ] as const) {
    const nome = /#include <(\w+)>/.exec(ancora)?.[1]
    assert(nome !== undefined, `a âncora «${ancora}» tem de ser um #include <chunk>`)
    assert(programa.includes(ancora), `o programa do MeshStandardMaterial do three instalado NÃO contém ${ancora}: a névoa do terreno falharia em silêncio`)
    assert(typeof chunks[nome] === 'string', `o chunk ${nome} existe no three instalado`)
  }
  // a âncora do fragmento é DEPOIS da luz, do tone mapping e da conversão de cor (a névoa do plano é um ShaderMaterial que escreve gl_FragColor direto, sem luz nem tone mapping: para o terreno
  // parecer o plano, a névoa tem de entrar no FIM da cadeia)
  const ordem = [...programaDoFragmento.slice(programaDoFragmento.indexOf('void main()')).matchAll(/#include <(\w+)>/g)].map((m) => m[1])
  const nomeFrag = /#include <(\w+)>/.exec(PEDACOS_DA_NEVOA_NO_TERRENO.ancoraFragmento)?.[1] ?? ''
  for (const antes of ['lights_fragment_begin', 'lights_fragment_end', 'opaque_fragment', 'tonemapping_fragment', 'colorspace_fragment']) {
    assert(ordem.indexOf(antes) >= 0 && ordem.indexOf(nomeFrag) > ordem.indexOf(antes), `no three instalado a âncora ${nomeFrag} vem DEPOIS de ${antes}: a névoa do terreno é aplicada ao fim, como no plano (sem luz nem tone mapping por cima)`)
  }
  assert(ordem.indexOf(nomeFrag) >= 0, 'a âncora do fragmento está dentro de main()')

  const vertice = `void main() {\n  #include <begin_vertex>\n  #include <project_vertex>\n}`
  const fragmento = `void main() {\n  gl_FragColor = vec4( 1.0 );\n  #include <fog_fragment>\n  #include <dithering_fragment>\n}`
  const out = injetarNevoaNoTerreno(vertice, fragmento)
  assert(out.vertice !== vertice && out.fragmento !== fragmento, 'a injeção altera os dois shaders')
  const v = out.vertice
  const f = out.fragmento

  // o VÉRTICE: calcula a UV da névoa da POSIÇÃO LOCAL (não da UV do solo) e a passa ao fragmento
  assert(/varying vec2 vUvNevoa;/.test(v) && /varying vec2 vUvNevoa;/.test(f), 'o vértice e o fragmento declaram `varying vec2 vUvNevoa`')
  const uv = /vUvNevoa = vec2\(position\.x \/ ([\d.]+) \+ 0\.5, position\.z \/ ([\d.]+) \+ 0\.5\);/.exec(v)
  assert(uv !== null, 'a UV da névoa vem da POSIÇÃO LOCAL: `vUvNevoa = vec2(position.x / 112.0 + 0.5, position.z / 112.0 + 0.5)` (a UV do solo tem v espelhado: usá-la inverteria a névoa de norte para sul)')
  assert(Number(uv[1]) === 112 && Number(uv[2]) === 112, `o lado do quadrado é 112 nos dois eixos (veio ${uv[1]} e ${uv[2]})`)
  assert(!/vUvNevoa = vMapUv|vUvNevoa = uv/.test(v), 'a UV da névoa NÃO é a UV do solo (`vMapUv`/`uv`)')

  // o FRAGMENTO: as declarações compartilhadas entram UMA vez, e a névoa é MISTURADA à cor final (o terreno é opaco: não há `discard`)
  assert((f.match(/vec4 corDaNevoa\(/g) ?? []).length === 1, '`corDaNevoa` é definida UMA vez no fragmento do terreno (as declarações compartilhadas)')
  // as declarações compartilhadas INTEIRAS (uma só linha seria fraco: a injeção poderia trazer o primeiro uniform e esquecer o ruído e a função): cada peça tem de estar lá
  for (const peca of ['uniform sampler2D uMapa;', 'uniform float uTempo;', 'uniform vec3 uCorNunca;', 'uniform float uOpNunca;', 'uniform vec3 uCorJa;', 'uniform float uOpJa;', 'float hash(vec2 p)', 'float ruido(vec2 p)', 'vec4 corDaNevoa(vec2 uvDaNevoa)']) {
    assert(f.includes(peca) && DECLARACOES_DA_NEVOA.includes(peca), `o fragmento do terreno INCLUI ${peca} (as declarações compartilhadas do plano: o mesmo GLSL nos dois materiais)`)
  }
  assert(/vec4 nevoaDoTerreno = corDaNevoa\(vUvNevoa\);/.test(f), 'o fragmento chama `corDaNevoa(vUvNevoa)` com a UV própria')
  assert(/gl_FragColor\.rgb = mix\(gl_FragColor\.rgb, nevoaDoTerreno\.rgb, nevoaDoTerreno\.a\);/.test(f), 'a cor final é `mix(cor, névoa.rgb, névoa.a)`: opaco, sem discard (um buraco no terreno mostraria o céu)')
  assert(!/discard/.test(f.slice(f.indexOf('vec4 nevoaDoTerreno'))), 'o fragmento do terreno NÃO descarta (o chão é opaco)')
  // a opacidade mínima: abaixo dela a névoa nem mistura (evita um fio de cor onde o chão está à vista)
  assert(new RegExp(`if \\(nevoaDoTerreno\\.a > ${OPACIDADE_MINIMA_DA_NEVOA.toFixed(3)}\\)`).test(f), `só mistura acima de ${OPACIDADE_MINIMA_DA_NEVOA} de opacidade (o mesmo limite do plano)`)
  const iAncoraF = f.indexOf('#include <fog_fragment>')
  assert(iAncoraF >= 0 && f.indexOf('nevoaDoTerreno.rgb') > iAncoraF, 'a mistura vem DEPOIS de #include <fog_fragment> (no fim da cadeia, depois de luz, tone mapping e cor)')
  const iAncoraV = v.indexOf('#include <begin_vertex>')
  assert(iAncoraV >= 0 && v.indexOf('vUvNevoa =') > iAncoraV, 'a UV é calculada DEPOIS de #include <begin_vertex> (onde `transformed` nasce) e o `#include <begin_vertex>` continua lá')

  // âncora que SOME: lança (nunca devolve o terreno sem névoa como se estivesse certo: o chão apareceria inteiro, vazando o que não foi visto)
  for (const [nome, ver, frag] of [
    ['sem a âncora do vértice', 'void main() { #include <project_vertex> }', fragmento],
    ['sem a âncora do fragmento', vertice, 'void main() { #include <dithering_fragment> }'],
    ['âncora do vértice renomeada', vertice.replace('begin_vertex', 'comeco_vertex'), fragmento],
    ['âncora do fragmento renomeada', vertice, fragmento.replace('fog_fragment', 'neblina_fragment')],
  ] as const) {
    let lancou = false
    try {
      injetarNevoaNoTerreno(ver, frag)
    } catch {
      lancou = true
    }
    assert(lancou, `${nome}: a injeção tem de LANÇAR (o terreno sem névoa vazaria o que o jogador não viu)`)
  }
  // idempotente POR LADO (o three chama `onBeforeCompile` ao recompilar; e a injeção da rocha já pode ter rodado)
  const duas = injetarNevoaNoTerreno(out.vertice, out.fragmento)
  assert((duas.vertice.match(/varying vec2 vUvNevoa;/g) ?? []).length === 1 && (duas.fragmento.match(/vec4 nevoaDoTerreno =/g) ?? []).length === 1, 'injetar de novo não duplica nada')
  const soVertice = injetarNevoaNoTerreno(out.vertice, fragmento)
  assert((soVertice.fragmento.match(/vec4 nevoaDoTerreno =/g) ?? []).length === 1 && (soVertice.vertice.match(/varying vec2 vUvNevoa;/g) ?? []).length === 1, 'vértice já injetado e fragmento virgem: o fragmento recebe a névoa e o vértice não duplica')
  const soFragmento = injetarNevoaNoTerreno(vertice, out.fragmento)
  assert((soFragmento.vertice.match(/varying vec2 vUvNevoa;/g) ?? []).length === 1 && (soFragmento.fragmento.match(/vec4 nevoaDoTerreno =/g) ?? []).length === 1, 'fragmento já injetado e vértice virgem: o vértice recebe a UV e o fragmento não duplica')

  // COMPOSIÇÃO com a rocha: as duas injeções convivem no MESMO shader sem se pisar (declarações, marcas e ordem)
  // (a rocha usa `// terreno-relevo`; a névoa tem a SUA marca, senão uma acharia que a outra já rodou e não injetaria)
  // Comparo com a marca REAL da rocha (importada), não com um literal digitado: com `as const` o tipo de cada marca é o literal exato, e o TypeScript recusa comparar dois literais sem sobreposição
  // (`TS2367`): a asserção contra um literal digitado era VERDADEIRA POR CONSTRUÇÃO, ou seja, não podia falhar (teatro). Convertendo para `string` a comparação volta a poder falhar quando alguém iguala as duas.
  const marcaDaNevoa: string = PEDACOS_DA_NEVOA_NO_TERRENO.marca
  const marcaDaRocha: string = PEDACOS_DO_SHADER.marca
  assert(marcaDaNevoa !== marcaDaRocha, `a névoa tem a SUA marca (${marcaDaNevoa}), diferente da da rocha (${marcaDaRocha}): com a mesma, a segunda injeção se acharia já feita e não rodaria`)

  // Sobre o programa REAL do `MeshStandardMaterial` do three instalado (o que o `onBeforeCompile` recebe), aplico AS DUAS injeções, nas duas ordens. Um erro de GLSL NÃO vira exceção de JS no
  // `onBeforeCompile` (o `try/catch` do terreno só pega o que LANÇA): vira um programa que não linka e um chão ausente, com a mensagem só na console. O Node não tem GPU para compilar, então o que
  // ele PODE provar é a ausência de colisão textual: nenhum nome declarado duas vezes, as âncoras de uma não destruídas pela outra, e cada injeção presente UMA vez.
  const realV = ShaderLib.standard.vertexShader
  const realF = ShaderLib.standard.fragmentShader
  for (const ordemRochaPrimeiro of [true, false]) {
    let vv = realV
    let ff = realF
    const aplicarRocha = (): void => {
      const r = injetarMisturaDeRocha(vv, ff)
      vv = r.vertice
      ff = r.fragmento
    }
    const aplicarNevoa = (): void => {
      const n = injetarNevoaNoTerreno(vv, ff)
      vv = n.vertice
      ff = n.fragmento
    }
    if (ordemRochaPrimeiro) {
      aplicarRocha()
      aplicarNevoa()
    } else {
      aplicarNevoa()
      aplicarRocha()
    }
    const rotulo = ordemRochaPrimeiro ? 'rocha→névoa' : 'névoa→rocha'
    // cada nome GLSL declarado nas injeções aparece UMA vez como declaração (uma redeclaração é erro de compilação)
    const declaracoes: Array<[string, RegExp, string]> = [
      ['varying vPesoRocha (vértice)', /varying float vPesoRocha;/g, vv],
      ['varying vPesoRocha (fragmento)', /varying float vPesoRocha;/g, ff],
      ['varying vUvNevoa (vértice)', /varying vec2 vUvNevoa;/g, vv],
      ['varying vUvNevoa (fragmento)', /varying vec2 vUvNevoa;/g, ff],
      ['uniform uRochaMap', /uniform sampler2D uRochaMap;/g, ff],
      ['uniform uRochaEscala', /uniform float uRochaEscala;/g, ff],
      ['uniform uMapa', /uniform sampler2D uMapa;/g, ff],
      ['função corDaNevoa', /vec4 corDaNevoa\(/g, ff],
      ['função hash', /float hash\(vec2 p\)/g, ff],
      ['função ruido', /float ruido\(vec2 p\)/g, ff],
    ]
    for (const [nome, re, texto] of declaracoes) {
      assert((texto.match(re) ?? []).length === 1, `${rotulo}: ${nome} é declarada UMA vez no shader final (veio ${(texto.match(re) ?? []).length}); duas seriam erro de compilação`)
    }
    // as âncoras do three continuam lá (uma injeção não destrói a âncora da outra: o `replace` mantém a âncora dentro do texto novo)
    for (const ancora of ['#include <beginnormal_vertex>', '#include <begin_vertex>']) assert(vv.includes(ancora), `${rotulo}: o vértice final ainda tem ${ancora}`)
    for (const ancora of ['#include <map_fragment>', '#include <fog_fragment>']) assert(ff.includes(ancora), `${rotulo}: o fragmento final ainda tem ${ancora}`)
    // a ORDEM no fragmento é a do three e não muda: a rocha vem logo DEPOIS do mapa (cor do solo) e a névoa no FIM (depois de luz, tone mapping e cor), seja qual for a ordem em que se injetou
    assert(ff.indexOf('mix(diffuseColor.rgb') < ff.indexOf('mix(gl_FragColor.rgb'), `${rotulo}: a mistura de ROCHA (no diffuseColor) vem ANTES da névoa (em gl_FragColor), pela ordem do three`)
    assert(ff.indexOf('#include <lights_fragment_begin>') > ff.indexOf('mix(diffuseColor.rgb') && ff.indexOf('#include <lights_fragment_begin>') < ff.indexOf('mix(gl_FragColor.rgb'), `${rotulo}: a rocha entra ANTES das luzes e a névoa DEPOIS delas`)
    // uma segunda rodada completa (o three recompila) não muda nada
    const r2 = injetarNevoaNoTerreno(injetarMisturaDeRocha(vv, ff).vertice, injetarMisturaDeRocha(vv, ff).fragmento)
    assert(r2.vertice === vv && r2.fragmento === ff, `${rotulo}: injetar as duas de novo (o three recompila) não muda o shader`)
  }
}
