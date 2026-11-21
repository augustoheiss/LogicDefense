function assert(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem)
}

/**
 * CONTRATO DO HUD: todo elemento do HUD que RECEBE ponteiro e não é um `<button>` precisa estar na lista de exclusão do `onPointerDown`
 * da `.ilha-shell` (`target.closest('button, .ilha-modal, ...')`). Fora da lista, o clique nele SOBE até a shell e é tratado como clique
 * no MUNDO: atira, arrasta a câmera, abre o joystick ou edita um bloco.
 *
 * Origem (rodada 4 do T2, DEF-L51B-1): o selo de vida era texto com `pointer-events: none` (o clique atravessava, sem efeito). Ao torná-lo
 * interativo (legenda em hover/toque) ele passou a capturar o clique e a shell o tratou como mundo: clicar no coração atirava. Cada elemento
 * novo que receber `pointer-events: auto` repete o risco; este teste faz o esquecimento deixar de ser silencioso.
 */
export function run(jsx: string, css: string) {
  // O texto do IlhaRua.tsx e do ilha.css chega PRONTO do runner (scripts/run-ilha-rua-test.mjs, que ja le o IlhaRua.tsx): este arquivo fica
  // PURO (sem `node:fs`) e compila no `tsc -b` do projeto, cujo tsconfig e de NAVEGADOR (sem tipos de Node). I/O mora no .mjs.

  // 1) a lista de exclusão, lida do próprio código (não copiada para o teste)
  const m = jsx.match(/onPointerDown=\{\(event\) => \{[\s\S]*?target\.closest\(\s*'([^']+)'/)
  assert(m, 'contrato: não achei o `target.closest(...)` do onPointerDown da shell (o teste precisa ser atualizado, não ignorado)')
  const excluidos = new Set(m[1].split(',').map((s: string) => s.trim()))
  assert(excluidos.has('button'), 'contrato: a lista de exclusão perdeu o `button`')

  // 2) todo seletor que recebe `pointer-events: auto` no CSS (regra de nível raiz ou dentro de @media): o seletor é o texto antes de `{`
  // O leitor aceita QUALQUER valor de `pointer-events` que faça o elemento receber ponteiro (`auto`, `all`, `visiblePainted`, `fill`, `initial`…), em qualquer
  // caixa e com espaços antes dos dois pontos; só `none`/`inherit`/`unset`/`revert`/`revert-layer` NÃO contam (ou desligam, ou herdam o `none` do `.ilha-hud`).
  // `initial` CONTA: o valor inicial da propriedade é `auto` (medido no Chromium: filho de pai `none` com `initial` recebe o ponteiro, computado `auto`).
  // Antes o regex exigia `pointer-events:\s*auto` minúsculo e o resto passava em VERDE (rodada de revisão independente: 9 variantes reproduzidas); a 1ª correção
  // ainda excluía `initial` por engano (medido depois).
  const comPonteiro = new Set<string>()
  const semComentarios = css.replace(/\/\*[\s\S]*?\*\//g, '')
  for (const bloco of semComentarios.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const recebe = /pointer-events\s*:\s*(?!none\b|inherit\b|unset\b|revert)[a-z-]+/i.test(bloco[2])
    if (!recebe) continue
    for (const sel of bloco[1].split(',')) {
      const limpo = sel.trim().replace(/^\.ilha-celular\s+/, '').replace(/^\.ilha-hud\s+/, '')
      if (limpo) comPonteiro.add(limpo)
    }
  }
  assert(comPonteiro.size >= 8, `contrato: achei só ${comPonteiro.size} seletores com pointer-events:auto: o leitor de CSS quebrou (esperava >= 8)`)
  // controle positivo: o selo de vida TEM de aparecer (senão o leitor não está lendo o que importa)
  assert(comPonteiro.has('.ilha-army'), 'contrato: o leitor de CSS não viu `.ilha-army { pointer-events: auto }` (instrumento cego)')

  // 3) TODA classe `.ilha-*` que aparece num seletor com ponteiro é candidata, qualquer que seja o resto do seletor (pseudo `:hover`, filho, descendente,
  // dígito, sublinhado, maiúscula). Antes o filtro `^\.ilha-[a-z-]+$` DESCARTAVA EM SILÊNCIO o que não fosse simples: `.ilha-novo2`, `.ilha_novo`, `.ilha-novo:hover`
  // passavam em verde. Mais candidatas só deixa o teste mais exigente (conservador); `button`/`strong` e seletores sem classe `ilha-*` não são do HUD.
  const candidatos = new Set<string>()
  for (const sel of comPonteiro) for (const m2 of sel.matchAll(/\.ilha[-_][A-Za-z0-9_-]*/g)) candidatos.add(m2[0])
  const botoes = new Set(['.ilha-continuar', '.ilha-conta', '.ilha-atirar', '.ilha-pular', '.ilha-fechar', '.ilha-chip', '.ilha-icone-btn', '.ilha-mini-btn', '.ilha-mini-quadrado'])
  // Pré-existente, ACUSADO e NÃO corrigido aqui (fora do escopo da L5.1): `.ilha-selecao-barra` é um <div> com pointer-events:auto fora da lista
  // desde antes da L5.1; só os botões dentro dela são seguros. Sai desta lista quando alguém a incluir no closest.
  const preExistentes = new Set(['.ilha-selecao-barra'])
  const faltando = [...candidatos].filter((s) => !botoes.has(s) && !excluidos.has(s) && !preExistentes.has(s))
  assert(faltando.length === 0, `contrato: elementos do HUD que recebem ponteiro e NÃO estão na exclusão do onPointerDown da shell (o clique neles vira clique no mundo): ${faltando.join(', ')}`)

  // 4) o inverso: a lista de exceções não pode esconder um defeito que já foi corrigido
  for (const s of preExistentes) assert(!excluidos.has(s), `contrato: ${s} já está na exclusão: tire-o de \`preExistentes\` neste teste`)
}

/**
 * O QUE ESTE TESTE NÃO GARANTE (declarado, para ninguém achar que ele prova o comportamento): ele lê o TEXTO da lista de exclusão e o CSS. Não executa o
 * `onPointerDown`. Continuam passando em verde: remover o `return` depois do `closest`, ou trocar `target` por `document.body` (o clique volta a atirar com a
 * lista intacta). Esse comportamento é coberto por `l51-clique-no-selo.mjs` (sonda de navegador: clicar no MUNDO atira, clicar no SELO não atira, com
 * controle), que NÃO roda sozinha e que nada no CI executa. Quem mexer no `onPointerDown` da shell deve rodar essa sonda.
 *
 * `rodarContraAdulteracoes` prova que o LEITOR DE CSS pega as variantes que antes passavam em verde (achadas pelo revisor independente e reproduzidas
 * aqui): maiúscula, espaço antes dos dois pontos, `all`/`visiblePainted`, seletor com `:hover`, dígito ou sublinhado. Cada uma acrescenta um elemento de HUD
 * novo, FORA da lista, ao CSS real, e o `run` TEM de falhar; um controle (seletor simples) também. Sem isto o teste voltaria a ser frouxo sem ninguém ver.
 */
export function rodarContraAdulteracoes(jsx: string, css: string): void {
  // devolve a MENSAGEM do erro (ou null se o `run` passou): os controles abaixo conferem o MOTIVO, não só o fato de falhar (falhar por outro motivo não prova nada)
  const quebra = (j: string, c: string): string | null => {
    try {
      run(j, c)
      return null
    } catch (e) {
      return e instanceof Error ? e.message : String(e)
    }
  }
  const falha = (j: string, c: string): boolean => quebra(j, c) !== null
  assert(!falha(jsx, css), 'adulteracoes: a base real tem de passar (senão o resto nada prova)')
  const novo = (decl: string, sel = '.ilha-elemento-novo'): string => `${css}\n${sel} {\n  ${decl};\n}\n`
  // Valores de `pointer-events` MEDIDOS no Chromium (sonda `pointer-events-valores.mjs`, com controles): quais fazem um FILHO de um pai `pointer-events: none`
  // (o `.ilha-hud`) RECEBER o ponteiro. `initial` RECEBE (o valor inicial da propriedade é `auto`, computado `auto`): a 1ª versão deste teste o tratava como
  // «não recebe», um falso verde meu que a medição pegou. `inherit`/`unset`/`revert`/`revert-layer` herdam o `none` do pai.
  const recebem = ['auto', 'all', 'initial', 'visible', 'visiblePainted', 'painted', 'fill', 'stroke', 'bounding-box', 'auto !important']
  const naoRecebem = [...['none', 'inherit', 'unset', 'revert', 'revert-layer', 'none !important', 'NONE'].map((v) => `pointer-events: ${v}`), 'POINTER-EVENTS: NONE']
  // Regra NOVA dentro de um `@media` (como as `@media (hover…)` e `(max-width…)` que o CSS da ilha já usa): o leitor tem de enxergar o bloco aninhado.
  const dentroDeMedia = (decl: string, sel = '.ilha-elemento-novo'): string => `${css}\n@media (min-width: 601px) {\n  ${sel} {\n    ${decl};\n  }\n}\n`
  const casos: Array<[string, string, string?]> = [
    ['controle: seletor simples e minúsculo', 'pointer-events: auto'],
    ['maiúscula', 'POINTER-EVENTS: AUTO'],
    ['espaço antes dos dois pontos', 'pointer-events : auto'],
    ['seletor com :hover', 'pointer-events: auto', '.ilha-novo:hover'],
    ['seletor descendente', 'pointer-events: auto', '.ilha-hud .ilha-novo'],
    // A 1ª classe do seletor JÁ está na exclusão (ou é limpa pelo leitor) e a 2ª não: o leitor tem de olhar TODAS as classes, não só a primeira.
    // (`.ilha-hud .ilha-novo` NÃO discrimina isto: o `.ilha-hud` é limpo antes, então a 1ª classe já seria a nova.) `closest` só sobe pelos ANCESTRAIS: filho,
    // irmão e descendente de uma classe excluída não são cobertos por ela se o próprio elemento não está na lista.
    ['filho de uma classe excluída (.ilha-army > .ilha-novo)', 'pointer-events: auto', '.ilha-army > .ilha-novo'],
    ['irmão de uma classe excluída (.ilha-army ~ .ilha-novo)', 'pointer-events: auto', '.ilha-army ~ .ilha-novo'],
    ['classe composta (.ilha-army.ilha-novo)', 'pointer-events: auto', '.ilha-army.ilha-novo'],
    ['seletor com dígito', 'pointer-events: auto', '.ilha-novo2'],
    ['seletor com sublinhado', 'pointer-events: auto', '.ilha_novo'],
    // sufixo colado numa classe que JÁ está na exclusão: o prefixo igual não pode esconder a classe nova (`closest('.ilha-army')` não casa `.ilha-army2`)
    ['dígito colado numa classe excluída (.ilha-army2)', 'pointer-events: auto', '.ilha-army2'],
    ['sublinhado colado numa classe excluída (.ilha-army_b)', 'pointer-events: auto', '.ilha-army_b'],
    ['maiúscula colada numa classe excluída (.ilha-armyB)', 'pointer-events: auto', '.ilha-armyB'],
    ...recebem.map((v): [string, string] => [`valor ${v}`, `pointer-events: ${v}`]),
  ]
  for (const [nome, decl, sel] of casos) assert(falha(jsx, novo(decl, sel)), `adulteracoes: «${nome}» passou em VERDE (um elemento de HUD novo, fora da exclusão, escapou do contrato)`)
  assert(falha(jsx, dentroDeMedia('pointer-events: auto')), 'adulteracoes: «regra dentro de @media» passou em VERDE (o leitor perdeu os blocos aninhados)')
  assert(!falha(jsx, dentroDeMedia('pointer-events: none')), 'adulteracoes: «@media com pointer-events: none» não recebe ponteiro e NÃO pode acusar')
  // Leitor PARCIALMENTE cego: acha o `.ilha-army` mas perde o resto (o piso `>= 8` existe para isto: o controle do `.ilha-army` sozinho não o pega).
  // Fica só o bloco do selo de vida (o resto do CSS some): o `run` tem de acusar o leitor quebrado, e pelo MOTIVO certo (o piso), não por outra coisa.
  const soSelo = `.ilha-army {\n  pointer-events: auto;\n}\n`
  const parcial = quebra(jsx, soSelo)
  assert(parcial !== null && parcial.includes('o leitor de CSS quebrou'), `adulteracoes: um CSS que só tem o \`.ilha-army\` tem de acusar «o leitor de CSS quebrou» (o piso de seletores) (veio: ${parcial})`)
  // valores que NÃO recebem ponteiro continuam sem acusar (senão o teste vira alarme falso)
  for (const decl of naoRecebem) assert(!falha(jsx, novo(decl)), `adulteracoes: «${decl}» não recebe ponteiro e NÃO pode acusar`)
  // o leitor CEGO (o CSS perdeu o `.ilha-army`, mudando de nome) tem de ser acusado como instrumento cego, e não passar
  const cego = quebra(jsx, css.split('.ilha-army').join('.ilha-armyx'))
  assert(cego !== null && cego.includes('instrumento cego'), `adulteracoes: sem o \`.ilha-army\` no CSS o leitor tem de acusar «instrumento cego» (veio: ${cego})`)
  // o selo de vida sem a exclusão TEM de falhar, e pelo MOTIVO certo: `.ilha-army` aparece entre as classes faltando (o caso original da L5.1)
  const semSelo = jsx.replace(', .ilha-army', '')
  assert(semSelo !== jsx, 'adulteracoes: a âncora `, .ilha-army` sumiu do JSX (o teste precisa ser atualizado, não ignorado)')
  const faltou = quebra(semSelo, css)
  assert(faltou !== null && faltou.includes('.ilha-army'), `adulteracoes: tirar \`.ilha-army\` da lista tem de falhar apontando \`.ilha-army\` (o defeito DEF-L51B-1); veio: ${faltou}`)
}
