function assert(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem)
}

function soCodigo(texto: string): string {
  return texto
    .split(/\r?\n/)
    .filter((linha) => !/^\s*(\/\/|\*|\/\*)/.test(linha))
    .join('\n')
}

/**
 * CONTRATO DE TEXTO de `PropsBiomaInstanced.tsx` seguindo o terreno (F2, Task 4, degrau 2, 25/11/2026). O componente desenha árvores, ouro, grama, flores, pedras e juncos por `setMatrixAt` dentro de
 * `useLayoutEffect`: o desenho só é REFEITO quando uma dependência muda. Se o `campo` ficar de fora das `deps`, as árvores ficam em y = 0 PARA SEMPRE quando o campo termina de gerar (a geração é
 * fatiada, ~19 quadros): um defeito silencioso, sem erro. A regra única da Task 4: `y_novo = y_de_hoje + desnível(x, z)`, com desnível 0 sem campo (I1).
 */
export function contratoDosPropsNoTerreno(props: string): void {
  const codigo = soCodigo(props)
  // (1) a prop é OPCIONAL: sem ela o componente é o de hoje
  assert(/readonly campo\?: CampoRelevo/.test(codigo), 'o componente recebe a prop OPCIONAL `campo?: CampoRelevo` (sem ela o desenho é o de hoje: I1)')
  assert(/import \{[^}]*\bdesnivelDoChao\b[^}]*\} from '\.\.\/relevo\/alturaVisual'/.test(codigo), 'o desnível vem de `desnivelDoChao` (a ÚNICA conta, de `../relevo/alturaVisual`)')
  // (5) I1: a função local do desnível devolve 0 SEM campo
  assert(/const desnivelEm = \(x: number, z: number\): number => desnivelDoChao\(campo, x, z\)/.test(codigo), 'o desnível local é `desnivelDoChao(campo, x, z)`: a ÚNICA conta (0 sem campo: I1), sem copiar a fórmula')
  assert(!/alturaVisualDoChao/.test(codigo) && !/- Y_SOLO_VISUAL/.test(codigo), 'o componente NÃO repete a fórmula `alturaVisualDoChao(…) − Y_SOLO_VISUAL` (uma cópia é onde alguém esquece o `− Y_SOLO_VISUAL`)')
  // (2) cada ponto de chão soma o desnível de SEU (x, z). Os recursos pela fonte única; o resto pela soma explícita.
  assert(/const ySolo = alturaVisualRecurso\(rec\.yBase, desnivelEm\(rec\.x, rec\.z\)\)/.test(codigo), 'árvores e ouro: `ySolo = alturaVisualRecurso(rec.yBase, desnivelEm(rec.x, rec.z))` (um ponto só corrige tronco, copas, toco, rocha, cristais e veio vazio)')
  assert(/molde\.position\.set\(g\.x, -0\.45 \+ desnivelEm\(g\.x, g\.z\), g\.z\)/.test(codigo), 'grama: `−0,45 + desnivelEm(g.x, g.z)`')
  assert(/molde\.position\.set\(fl\.x, -0\.34 \+ desnivelEm\(fl\.x, fl\.z\), fl\.z\)/.test(codigo), 'flores: `−0,34 + desnivelEm(fl.x, fl.z)`')
  assert(/molde\.position\.set\(p\.x, -0\.42 \+ p\.escalaY \* 0\.35 \+ desnivelEm\(p\.x, p\.z\), p\.z\)/.test(codigo), 'pedras: `−0,42 + escalaY·0,35 + desnivelEm(p.x, p.z)`')
  assert(/molde\.position\.set\(m\.x, -0\.25 \+ desnivelEm\(m\.x, m\.z\), m\.z\)/.test(codigo), 'juncos: `−0,25 + desnivelEm(m.x, m.z)`')
  // a vitória-régia BOIA: o apoio é a LÂMINA (`desnivelDoApoio`), não o leito. Todas nascem DENTRO da elipse da lagoa (medido nas 3 qualidades gráficas: 1.278 de 1.278), então a regra a cobre por inteiro.
  assert(/molde\.position\.set\(m\.x, -0\.36 \+ desnivelDoApoio\(campo, lagoas, m\.x, m\.z\), m\.z\)/.test(codigo), 'vitórias-régias BOIAM na lâmina: `−0,36 + desnivelDoApoio(campo, lagoas, m.x, m.z)` (somar o desnível do leito as afundava 1 m)')
  assert(/import \{[^}]*\bdesnivelDoApoio\b[^}]*\} from '\.\.\/relevo\/alturaVisual'/.test(codigo), 'o apoio da água vem de `desnivelDoApoio` (a ÚNICA conta, de `../relevo/alturaVisual`)')
  // o JUNCO fica no chão (a regra de hoje) até o usuário decidir a margem: nasce em r = 0,96–1,12 e 76 % ficam fora da elipse, onde o apoio não o alcança (degrau de 0,84 m na fileira)
  assert(/molde\.position\.set\(m\.x, -0\.25 \+ desnivelEm\(m\.x, m\.z\), m\.z\)/.test(codigo), 'juncos: continuam no chão (`−0,25 + desnivelEm(m.x, m.z)`): decisão da margem pendente do usuário')
  // (3) o campo nas deps dos DOIS efeitos que desenham (recursos e micro-natureza): sem ele o desenho nunca é refeito quando o campo chega
  const deps = codigo.match(/\}, \[[^\]]*\]\)/g) ?? []
  const depsDosDois = deps.filter((d) => /molde\]\)$/.test(d))
  assert(depsDosDois.length === 2, `os dois useLayoutEffect de desenho (recursos e micro-natureza) são os que terminam em \`molde\` nas deps (achei ${depsDosDois.length})`)
  for (const d of depsDosDois) assert(/\bcampo\b/.test(d), `o \`campo\` está nas deps do efeito ${d}: sem ele o desenho não é refeito quando o campo termina de gerar`)
  // (4) o que NÃO é chão fica intacto: a escala e a rotação de cada tipo
  assert(/molde\.scale\.set\(g\.escala, g\.altura, g\.escala\)/.test(codigo), 'a escala da grama não muda')
  assert(/molde\.scale\.set\(m\.escala, m\.escala, m\.escala\)/.test(codigo), 'a escala do junco não muda (só a altura do pé ganha o desnível)')
  assert(/molde\.scale\.set\(m\.escala, 1, m\.escala\)/.test(codigo), 'a escala da vitória-régia não muda (só a altura ganha o apoio da água)')
  assert(/molde\.rotation\.set\(0\.15, p\.rotY, 0\.1\)/.test(codigo), 'a rotação das pedras não muda')
  assert(/molde\.position\.set\(rec\.x, ySolo \+ 0\.62 \* escala, rec\.z\)/.test(codigo), 'o tronco continua em ySolo + 0,62·escala (só o ySolo ganha o desnível)')
  // o controle do instrumento: o regex da soma acha uma linha de exemplo e NÃO acha a de hoje (sem o desnível)
  const aSoma = /molde\.position\.set\(g\.x, -0\.45 \+ desnivelEm\(g\.x, g\.z\), g\.z\)/
  assert(aSoma.test('molde.position.set(g.x, -0.45 + desnivelEm(g.x, g.z), g.z)') && !aSoma.test('molde.position.set(g.x, -0.45, g.z)'), 'controle do instrumento: o regex distingue o ponto COM o desnível do de hoje, sem ele')
}

/**
 * CONTRATO DE TEXTO de `FundacaoObraCena.tsx` seguindo o terreno (Task 4, degrau 3). O desnível entra UMA VEZ, no GRUPO PAI de cada fundação (as duas variantes: o píer sobre água e a alvenaria em terra);
 * os filhos usam `Y_SOLO_VISUAL + k` RELATIVOS ao pai e NÃO mudam: somar nos dois lugares dobraria o desnível. O desnível é o do CENTRO da pegada e é 0 sem campo (I1).
 */
export function contratoDaFundacaoNoTerreno(fundacao: string): void {
  const codigo = soCodigo(fundacao)
  assert(/readonly desnivel\?: number/.test(codigo) || /desnivel = 0/.test(codigo), 'o item da fundação recebe o `desnivel` (opcional, padrão 0: sem campo é o de hoje, I1)')
  assert((codigo.match(/<group position=\{\[pegada\.cx, desnivel, pegada\.cz\]\}>/g) ?? []).length === 2, 'os DOIS grupos pai (píer sobre água e alvenaria em terra) ganham o desnível: `position={[pegada.cx, desnivel, pegada.cz]}`')
  assert(!/<group position=\{\[pegada\.cx, 0, pegada\.cz\]\}>/.test(codigo), 'nenhum grupo pai ficou em y = 0 (um esquecido deixaria uma das variantes no plano)')
  // os filhos NÃO somam o desnível de novo: nenhum `desnivel` fora dos dois grupos pai e da assinatura
  // as 5 ocorrências de `desnivel`: a assinatura, o padrão, os DOIS grupos pai e o PONTO DE CHAMADA (a prop). Cada uma é conferida pelo SEU contexto: uma ocorrência num filho seria o desnível somado duas vezes.
  assert((codigo.match(/\bdesnivel\b/g) ?? []).length === 5, `\`desnivel\` aparece 5 vezes: a assinatura, o padrão, os dois grupos pai e o ponto de chamada (veio ${(codigo.match(/\bdesnivel\b/g) ?? []).length})`)
  assert(/^\s*desnivel\?: number$/m.test(codigo), 'a assinatura do item declara `desnivel?: number`')
  assert(/geos, desnivel = 0 \}\) =>/.test(codigo), 'o padrão do desnível é 0: `geos, desnivel = 0 })`')
  assert(/^\s*desnivel=\{desnivelDaObraNoChao\(obra, campo, lagoas\)\}$/m.test(codigo), 'o ponto de chamada calcula o desnível da OBRA com `desnivelDaObraNoChao(obra, campo, lagoas)`: a MESMA conta da malha e do fantasma (píer na lâmina, terra no chão; 0 sem campo)')
  assert(!/\bdesnivelDoChao\b/.test(codigo) && !/\bdesnivelDoApoio\b/.test(codigo) && !/\bdesnivelDaFundacao\b/.test(codigo), 'a fundação NÃO decide a água sozinha (`desnivelDoChao`/`desnivelDoApoio`/`desnivelDaFundacao` no centro): a conta é UMA, `desnivelDaObraNoChao`, para a fundação, a malha e o fantasma não divergirem')
  assert(!/alturaVisualDoChao/.test(codigo), 'a fundação NÃO repete a fórmula `alturaVisualDoChao(…) − Y_SOLO_VISUAL`')
  assert(/^\s*campo\?: CampoRelevo$/m.test(codigo), 'o componente recebe `campo?: CampoRelevo` (opcional: sem ele é o de hoje)')
  assert(/import type \{ CampoRelevo \} from '\.\.\/relevo\/campoRelevo'/.test(codigo), 'o tipo `CampoRelevo` vem de `../relevo/campoRelevo`')
  assert(/import \{ desnivelDaObraNoChao \} from '\.\.\/relevo\/alturaVisual'/.test(codigo), 'o desnível vem de `desnivelDaObraNoChao` (a ÚNICA conta, de `../relevo/alturaVisual`)')
  assert(/desnivel=\{/.test(codigo), 'cada item recebe o desnível calculado')
}

/** O texto de UM elemento JSX auto-fechado: de `<Nome` até o primeiro `/>`. Vazio se o elemento não existe. */
function elementoJsx(codigo: string, nome: string): string {
  return new RegExp(`<${nome}\\b([\\s\\S]*?)\\/>`).exec(codigo)?.[1] ?? ''
}

/**
 * CONTRATO DE TEXTO de `MundoSandboxCena.tsx` (Task 4): o sandbox é o ELO entre `Cena` e cada peça do mundo que a REGRA toca. Se ele deixar de repassar o `campo` a UMA delas, essa peça fica no plano SEM
 * erro nenhum (a prop é opcional e o `tsc` não reclama). Achado pela mutação F9 de 25/11 na fundação; generalizado às obras (blocos do mapa, blocos livres, prédios Nv5 e o fantasma da linha) no mesmo dia.
 */
export function contratoDoSandboxNoTerreno(sandbox: string): void {
  const codigo = soCodigo(sandbox)
  assert(/^\s*campo\?: CampoRelevo$/m.test(codigo), 'o sandbox declara a prop opcional `campo?: CampoRelevo`')
  assert(/^\s*campo,$/m.test(codigo), 'o sandbox recebe `campo` nos parâmetros')
  assert(/import type \{ CampoRelevo \} from '\.\/relevo\/campoRelevo'/.test(codigo), 'o tipo `CampoRelevo` vem de `./relevo/campoRelevo`')
  for (const nome of ['FundacoesObrasCena', 'ObrasNv5Instanced', 'BlocosMundoInstanced', 'ObrasLivresInstanced', 'PreviewLinhaBlocos', 'GhostBlueprintObra']) {
    assert((codigo.match(new RegExp(`<${nome}\\b`, 'g')) ?? []).length === 1, `${nome} é montada UMA vez no sandbox`)
    assert(/\bcampo=\{campo\}/.test(elementoJsx(codigo, nome)), `o sandbox REPASSA o campo a ${nome}: \`<${nome} … campo={campo} />\` (sem isso ela fica no plano sem erro nenhum)`)
  }
  // as 4 peças de OBRAS também recebem as LAGOAS (a fundação já as recebe, para classificar o suporte): quem repousa na água fica na LÂMINA e só sabe o que é água com a lista. Sem ela a obra afunda no leito
  // da lagoa SEM erro nenhum (a prop é opcional e o `tsc` não reclama)
  for (const nome of ['ObrasNv5Instanced', 'BlocosMundoInstanced', 'ObrasLivresInstanced', 'PreviewLinhaBlocos', 'GhostBlueprintObra']) {
    assert(/\blagoas=\{lagoas\}/.test(elementoJsx(codigo, nome)), `o sandbox REPASSA as lagoas a ${nome}: \`<${nome} … lagoas={lagoas} />\` (sem isso ela afunda no leito da lagoa sem erro nenhum)`)
  }
  // o controle do instrumento: o leitor de elementos acha a prop onde ela está e NÃO a acha onde falta (nem a empresta de um vizinho)
  const amostra = '<A x={1} campo={campo} lagoas={lagoas} />\n<B x={2} />'
  assert(/\bcampo=\{campo\}/.test(elementoJsx(amostra, 'A')) && !/\bcampo=\{campo\}/.test(elementoJsx(amostra, 'B')), 'controle do instrumento: `elementoJsx` separa o elemento COM o campo do que não tem')
  assert(/\blagoas=\{lagoas\}/.test(elementoJsx(amostra, 'A')) && !/\blagoas=\{lagoas\}/.test(elementoJsx(amostra, 'B')), 'controle do instrumento: `elementoJsx` separa o elemento COM as lagoas do que não tem')
}

export function run(props?: string, fundacao?: string, sandbox?: string): void {
  if (props !== undefined) contratoDosPropsNoTerreno(props)
  if (fundacao !== undefined) contratoDaFundacaoNoTerreno(fundacao)
  if (sandbox !== undefined) contratoDoSandboxNoTerreno(sandbox)
}
