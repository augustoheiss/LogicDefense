function assert(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem)
}

function soCodigo(texto: string): string {
  return texto
    .split(/\r?\n/)
    .filter((linha) => !/^\s*(\/\/|\*|\/\*)/.test(linha))
    .join('\n')
}

/** O texto de UM componente exportado: de `export const Nome` até o próximo `export const` (ou o fim). Cada componente tem as suas próprias regras. */
function componente(codigo: string, nome: string): string {
  const ini = codigo.indexOf(`export const ${nome}`)
  if (ini < 0) return ''
  const prox = codigo.indexOf('export const ', ini + 10)
  return codigo.slice(ini, prox < 0 ? undefined : prox)
}

/** O corpo de UMA interface exportada: de `export interface Nome {` até a primeira linha que é só `}` na COLUNA 0 (o `}` de um tipo literal no meio de uma linha, como o de `centro`, não conta). Vazio se não existe. */
function corpoDaInterface(codigo: string, nome: string): string {
  const ini = codigo.indexOf(`export interface ${nome} {`)
  if (ini < 0) return ''
  const fim = codigo.indexOf('\n}', ini)
  return fim < 0 ? '' : codigo.slice(ini, fim)
}

/**
 * CONTRATO DE TEXTO de `ObrasArquiteturaCena.tsx` seguindo o terreno (F2, Task 4, obras, 25/11/2026). Mesma mecânica dos props (`setMatrixAt` em `useLayoutEffect`): o campo vai por PROP DE VALOR e
 * está nas `deps` de cada efeito, senão o desenho nunca é refeito quando o campo chega. O desnível entra SÓ na MATRIZ DESENHADA (`molde.position`): o `centro` do índice (`userData.*Indices`) é DADO que
 * o clique e a edição leem (a regra, I2) e NÃO muda. Blocos: o desnível do PRÓPRIO bloco; prédio Nv5: o do CENTRO da obra, UM por obra num Map local (um corpo rígido não pode deformar).
 */
export function contratoDasObrasNoTerreno(obras: string): void {
  const codigo = soCodigo(obras)
  assert(/import \{[^}]*\bdesnivelDoApoio\b[^}]*\} from '\.\/relevo\/alturaVisual'/.test(codigo), 'as obras usam `desnivelDoApoio` (a ÚNICA conta, de `./relevo/alturaVisual`: a água é a lâmina, não o leito)')
  assert(!/\bdesnivelDoChao\b/.test(codigo), 'as obras NÃO usam `desnivelDoChao` direto: quem repousa numa lagoa afundaria no leito (medido nos 169 quadrados)')
  assert(/import type \{ LagoaRasa \} from '\.\/biomaRecursos'/.test(codigo) || /LagoaRasa/.test(codigo), 'o tipo `LagoaRasa` vem de `./biomaRecursos`')
  assert(/import type \{ CampoRelevo \} from '\.\/relevo\/campoRelevo'/.test(codigo), 'o tipo `CampoRelevo` vem de `./relevo/campoRelevo`')
  assert(!/alturaVisualDoChao/.test(codigo), 'as obras NÃO repetem a fórmula `alturaVisualDoChao(…) − Y_SOLO_VISUAL`')

  for (const nome of ['BlocosMundoInstanced', 'ObrasLivresInstanced', 'ObrasNv5Instanced', 'PreviewLinhaBlocos']) {
    const c = componente(codigo, nome)
    assert(c.length > 0, `o componente ${nome} existe`)
    assert(/campo\?: CampoRelevo/.test(c), `${nome} recebe \`campo?: CampoRelevo\` (opcional: sem ele é o de hoje, I1)`)
    assert(/lagoas\?: readonly LagoaRasa\[\]/.test(c), `${nome} recebe \`lagoas?: readonly LagoaRasa[]\` (a água é a MESMA que a regra e o desenho usam: sem ela cada obra decidiria sozinha)`)
    assert(/\}> = \(\{[^}]*\blagoas\b[^}]*\}\) =>/.test(c), `${nome} LÊ a prop \`lagoas\` nos parâmetros`)
    // declarar o TIPO sem LER o valor nos parâmetros deixa o `campo` indefinido no corpo (o `tsc` também pega; o contrato não depende dele)
    assert(/\}> = \(\{[^}]*\bcampo\b[^}]*\}\) =>/.test(c), `${nome} LÊ a prop \`campo\` nos parâmetros (só declarar o tipo deixa o desnível sem valor)`)
    // O QUE NÃO É CHÃO NÃO MUDA: a F2 só muda a ALTURA, então toda escala desenhada continua 1 × 1 × 1 (um bloco esticado seria regressão visual sem erro nenhum)
    const escalas = c.match(/molde\.scale\.set\([^)]*\)/g) ?? []
    assert(escalas.length > 0, `${nome} desenha com \`molde.scale.set\` (o contrato da escala não pode ser vazio)`)
    assert(escalas.every((e) => e === 'molde.scale.set(1, 1, 1)'), `${nome}: a escala continua 1 × 1 × 1 (a F2 só muda a altura): ${escalas.join(' | ')}`)
    // o campo nas deps do (único) useLayoutEffect de desenho: sem isso o desenho não é refeito quando o campo termina de gerar
    const deps = c.match(/\}, \[[^\]]*\]\)/g) ?? []
    assert(deps.length === 1, `${nome} tem UM useLayoutEffect de desenho (achei ${deps.length})`)
    assert(/\bcampo\b/.test(deps[0]), `o \`campo\` está nas deps do efeito de ${nome}: ${deps[0]}`)
    assert(/\blagoas\b/.test(deps[0]), `as \`lagoas\` estão nas deps do efeito de ${nome}: ${deps[0]} (sem elas o desenho não é refeito quando a água muda)`)
  }

  // BLOCOS: o desnível é o do PRÓPRIO bloco, somado à MATRIZ; o `centro` do índice (DADO que o clique lê) fica INTACTO
  for (const nome of ['BlocosMundoInstanced', 'ObrasLivresInstanced']) {
    const c = componente(codigo, nome)
    assert(/molde\.position\.set\(c\.x, c\.y \+ desnivelDoApoio\(campo, lagoas, c\.x, c\.z\), c\.z\)/.test(c), `${nome}: o bloco sobe o apoio do PRÓPRIO bloco na matriz: \`c.y + desnivelDoApoio(campo, lagoas, c.x, c.z)\``)
    assert(/molde\.position\.set\(c\.x, sapata\.centroY \+ desnivelDoApoio\(campo, lagoas, c\.x, c\.z\), c\.z\)/.test(c), `${nome}: a sapata desce junto com o bloco \`gy = 0\`: \`sapata.centroY + desnivelDoApoio(campo, lagoas, c.x, c.z)\``)
    assert(/const centro = blocoMundoParaCentro\(b\.x, b\.y, b\.z\)\n/.test(c), `${nome}: o \`centro\` do índice (DADO que o clique lê) é \`blocoMundoParaCentro(b.x, b.y, b.z)\` INTACTO, sem o desnível`)
    // a linha do `centro` acima só vê a PRÓPRIA linha: `centro.y += desnivelDoChao(…)` escrito DEPOIS dela deslocaria o dado que o clique lê e passaria batido. O desnível entra em DOIS lugares só (a matriz do bloco e a da sapata).
    const usos = (c.match(/\bdesnivelDoApoio\(/g) ?? []).length
    assert(usos === 2, `${nome}: \`desnivelDoApoio\` aparece em DOIS lugares (a matriz do bloco e a da sapata), não ${usos}: um terceiro uso desloca o \`centro\` do índice, que o clique lê`)
  }

  // PRÉDIO Nv5: o desnível é UM por obra (o do CENTRO), calculado uma vez e guardado num Map LOCAL (o índice, que o clique lê, não ganha campo)
  const nv5 = componente(codigo, 'ObrasNv5Instanced')
  assert(/const desnivelDaObra = new Map<number, number>\(\)/.test(nv5), 'ObrasNv5Instanced: o desnível por obra vive num Map LOCAL (`desnivelDaObra`), não no índice que o clique lê')
  assert(/desnivelDaObra\.set\(obra\.id, desnivelDoApoio\(campo, lagoas, obra\.x, obra\.z\)\)/.test(nv5), 'ObrasNv5Instanced: o desnível é o do CENTRO da obra (`obra.x`, `obra.z`), calculado UMA vez por obra (um corpo rígido), pelo APOIO (a lâmina se a obra está na água)')
  assert(!/desnivelDoApoio\(campo, lagoas, c\.x, c\.z\)/.test(nv5), 'ObrasNv5Instanced: NÃO usa o desnível de cada voxel (deformaria o prédio: cada coluna subiria uma quantidade diferente)')
  assert(/molde\.position\.set\(c\.x, c\.y \+ \(desnivelDaObra\.get\(itens\[i\]\.obraId\) \?\? 0\), c\.z\)/.test(nv5), 'ObrasNv5Instanced: cada voxel sobe o desnível DA SUA OBRA (`desnivelDaObra.get(itens[i].obraId)`), igual para todos os voxels dela')
  // os ÍNDICES (o que o clique lê) não ganham `desnivel`. O corpo vai até o `}` na COLUNA 0: o `}` de `centro: { x: number; … }` está no MEIO da linha, e um recorte que parasse nele (`[^}]*`) deixaria
  // um campo novo escrito DEPOIS do `centro` fora da vista (achado pela mutação O14b de 25/11).
  for (const nome of ['IndiceVoxelNv5', 'IndiceBlocoMundo']) {
    const corpo = corpoDaInterface(codigo, nome)
    assert(/\bcentro: \{ x: number; y: number; z: number \}/.test(corpo), `controle do instrumento: o recorte de ${nome} vai ATÉ o fim da interface (passa do \`}\` do \`centro\`)`)
    assert(!/desnivel/.test(corpo), `o índice ${nome} (que o clique lê) NÃO ganha o campo \`desnivel\``)
  }

  // PREVIEW da linha de blocos: o mesmo desnível dos blocos de verdade, senão o fantasma aparece num lugar e o bloco real em outro
  const prev = componente(codigo, 'PreviewLinhaBlocos')
  assert(/molde\.position\.set\(c\.x, c\.y \+ desnivelDoApoio\(campo, lagoas, c\.x, c\.z\), c\.z\)/.test(prev), 'PreviewLinhaBlocos: o fantasma sobe o MESMO apoio do bloco de verdade')
  assert(/molde\.position\.set\(c\.x, Y_SOLO_VISUAL \+ 0\.225 \+ desnivelDoApoio\(campo, lagoas, c\.x, c\.z\), c\.z\)/.test(prev), 'PreviewLinhaBlocos: a base do fantasma também')

  // A OBRA INTEIRA (o fantasma `GhostBlueprintObra` e a malha `ObraArquiteturaMesh`) desenha o MESMO prédio que a fundação: a altura do GRUPO-PAI é a de `desnivelDaObraNoChao`, a ÚNICA conta (a pegada efetiva e o
  // suporte que a fundação já usa). O desnível entra UMA vez, no grupo pai: os filhos (silhueta, marcação do solo, caixa de fundação, andaimes) são RELATIVOS a ele e somar neles dobraria a altura.
  assert(/import \{ desnivelDaObraNoChao, desnivelDoApoio \} from '\.\/relevo\/alturaVisual'/.test(codigo), 'as obras importam `desnivelDaObraNoChao` junto de `desnivelDoApoio` (a conta única da obra inteira)')
  for (const nome of ['GhostBlueprintObra', 'ObraArquiteturaMesh']) {
    const c = componente(codigo, nome)
    assert(c.length > 0, `o componente ${nome} existe`)
    assert(/campo\?: CampoRelevo/.test(c), `${nome} recebe \`campo?: CampoRelevo\` (opcional: sem ele é o de hoje, I1)`)
    assert(/lagoas\?: readonly LagoaRasa\[\]/.test(c), `${nome} recebe \`lagoas?: readonly LagoaRasa[]\``)
    assert(/\}> = \(\{[^}]*\bcampo\b[^}]*\}\) =>/.test(c) && /\}> = \(\{[^}]*\blagoas\b[^}]*\}\) =>/.test(c), `${nome} LÊ \`campo\` e \`lagoas\` nos parâmetros`)
    // o desnível é UM `const` calculado uma vez e usado SÓ no(s) grupo(s) pai: contado por ocorrência de `desnivelDaObra` (a variável) para nenhum filho o somar de novo
    assert((c.match(/desnivelDaObraNoChao\(/g) ?? []).length === 1, `${nome}: \`desnivelDaObraNoChao(\` é chamado UMA vez (a variável serve a todos os grupos pai)`)
  }
  const fantasma = componente(codigo, 'GhostBlueprintObra')
  assert(/<group position=\{\[x, desnivel, z\]\} name="ghost-blueprint-obra">/.test(fantasma), 'GhostBlueprintObra: o grupo pai sobe o desnível: `position={[x, desnivel, z]}`')
  assert(!/<group position=\{\[x, 0, z\]\}/.test(fantasma), 'GhostBlueprintObra: nenhum grupo pai ficou em y = 0')
  assert(/desnivelDaObraNoChao\(\{ tipo, x, z, hp: 1, construindoRestante: 0 \}, campo, lagoas\)/.test(fantasma), 'GhostBlueprintObra: a obra do fantasma é `{ tipo, x, z, hp: 1, construindoRestante: 0 }` (a mesma pegada de uma obra pronta: o fantasma mostra onde ELA vai ficar)')
  const malha = componente(codigo, 'ObraArquiteturaMesh')
  // por `position={[obra.x, …, obra.z]}` e NÃO por `<group position=…` na mesma linha: o grupo da obra viva é MULTI-LINHA (`<group\n      position={…}\n      onPointerDown=…`), e uma regex que exige as duas
  // coisas juntas mede o FORMATO do JSX, não o comportamento (achado ao rodar o contrato contra o código certo, 25/11)
  assert((malha.match(/position=\{\[obra\.x, desnivel, obra\.z\]\}/g) ?? []).length === 2, 'ObraArquiteturaMesh: os DOIS grupos pai (a ruína e a obra) sobem o desnível: `position={[obra.x, desnivel, obra.z]}`')
  assert(!/position=\{\[obra\.x, 0, obra\.z\]\}/.test(malha), 'ObraArquiteturaMesh: nenhum grupo pai ficou em y = 0 (um esquecido deixaria a ruína ou a obra no plano)')
  // o controle do instrumento: a regex acha o grupo de UMA linha e o de VÁRIAS, e não acha o de y = 0
  const doGrupo = /position=\{\[obra\.x, desnivel, obra\.z\]\}/
  assert(doGrupo.test('<group position={[obra.x, desnivel, obra.z]}>') && doGrupo.test('<group\n      position={[obra.x, desnivel, obra.z]}\n      onClick={x}') && !doGrupo.test('<group position={[obra.x, 0, obra.z]}>'), 'controle do instrumento: a regex do grupo pai vê o JSX de uma linha e o de várias, e não o de y = 0')
  assert(/const desnivel = desnivelDaObraNoChao\(obra, campo, lagoas\)/.test(malha), 'ObraArquiteturaMesh: o desnível é o da OBRA (a mesma conta da fundação)')
  assert(!/desnivelDoChao|desnivelDoApoio|desnivelDaFundacao/.test(fantasma + malha), 'o fantasma e a malha NÃO decidem a água sozinhos: a conta é `desnivelDaObraNoChao`')
  // O desnível entra UMA vez, no(s) grupo(s) PAI: os filhos (a base de marcação do fantasma, os andaimes da malha, a silhueta) são RELATIVOS a ele. Um `desnivel` a mais num filho DOBRA a altura em encosta
  // (achado pela mutação Q2 e Q11 de 25/11: nenhuma asserção contava). Conta as ocorrências da VARIÁVEL `desnivel` (palavra inteira, sem o `desnivelDaObraNoChao`): o `const` e os grupos pai, e mais nenhuma.
  const usosDe = (texto: string): number => (texto.match(/\bdesnivel\b/g) ?? []).length
  assert(usosDe(fantasma) === 2, `GhostBlueprintObra: \`desnivel\` aparece 2 vezes (o \`const\` e o grupo pai), não ${usosDe(fantasma)}: uma a mais num filho dobra a altura`)
  assert(usosDe(malha) === 3, `ObraArquiteturaMesh: \`desnivel\` aparece 3 vezes (o \`const\` e os DOIS grupos pai), não ${usosDe(malha)}: uma a mais num filho (andaimes, silhueta) dobra a altura`)
  // o QUE NÃO É CHÃO NÃO MUDA: a escala do corpo da obra em construção (cresce pelo progresso) e a rotação da marcação do solo do fantasma
  assert(/<group scale=\{\[1, construindo \? progresso : 1, 1\]\}>/.test(malha), 'ObraArquiteturaMesh: a escala do corpo da obra em construção não muda (só a altura do grupo pai)')
  assert(/rotation=\{\[-Math\.PI \/ 2, 0, 0\]\}/.test(fantasma), 'GhostBlueprintObra: a marcação do solo continua deitada (a F2 só muda a altura)')
}

export function run(obras?: string): void {
  if (obras !== undefined) contratoDasObrasNoTerreno(obras)
}
