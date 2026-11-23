function assert(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem)
}

/**
 * CONTRATO DAS 3 CORES DO MINIMAPA (M4, pedido do usuário 22/11): quem domina cada mapa aparece no minimapa. A REGRA (`donoDoMapa`) tem teste de comportamento em `atlas.test.ts`; este arquivo
 * guarda a LIGAÇÃO entre a regra e a tela, que nenhum teste de Node enxerga e que falhava em silêncio:
 *  - o dono precisa entrar na ASSINATURA que decide se a tela se redesenha (`onQuadro`); sem ele, um mapa que muda de mãos (conquista, fundação) só mudaria de cor quando outro evento
 *    forçasse o redesenho: a cor ficaria velha sem nenhum erro;
 *  - o quadrado leva a classe `ilha-dono-<dono>` e o `data-dono` (a sonda de navegador lê o `data-dono`);
 *  - o CSS tem as 3 cores, e elas vêm ANTES das regras de alerta: no CSS vence a regra mais tarde de mesma especificidade, e o alerta (urgente) tem de vencer o dono no fundo;
 *  - `TEXTO_DO_DONO` é `Record<Dono, string>` (um dono novo sem texto não compila).
 * NÃO garante o comportamento no navegador (isso é das sondas `m4-tres-cores`, `m4-alerta-css` e `m4-alerta-real`, que nada no CI roda).
 */
export function run(jsx: string, css: string): void {
  // 1) a assinatura de redesenho inclui o dono
  const assinatura = jsx.match(/\.map\(\(ficha\) => `\$\{ficha\.i\},\$\{ficha\.j\},[^`]*`\)/)
  assert(assinatura, 'minimapa: não achei a assinatura de redesenho (`.map((ficha) => `${ficha.i},${ficha.j},...`)`): o teste precisa ser atualizado, não ignorado')
  assert(assinatura[0].includes('${ficha.dono}'), 'minimapa: o DONO saiu da assinatura de redesenho: um mapa que muda de mãos não repinta até outro evento forçar')
  for (const campo of ['alerta', 'ritmo', 'cena', 'corpo']) assert(assinatura[0].includes('ficha.' + campo), `minimapa: a assinatura perdeu o campo \`${campo}\` (o dono foi ACRESCENTADO, não trocado)`)

  // 2) o quadrado leva a classe do dono e o `data-dono`
  assert(/ficha \? `ilha-dono-\$\{ficha\.dono\}` : 'ilha-mapa-vazio'/.test(jsx), 'minimapa: o quadrado perdeu a classe `ilha-dono-<dono>` (ou o `ilha-mapa-vazio` do quadrado que não existe)')
  assert(/data-dono=\{ficha\?\.dono\}/.test(jsx), 'minimapa: o quadrado perdeu o `data-dono`')

  // 3) o texto de cada dono existe, tipado
  assert(/const TEXTO_DO_DONO: Record<Dono, string> = \{/.test(jsx), 'minimapa: `TEXTO_DO_DONO` perdeu o tipo `Record<Dono, string>`')
  for (const dono of ['nosso', 'inimigo', 'selvagem']) assert(new RegExp(`\\b${dono}: '[^']+'`).test(jsx), `minimapa: falta o texto do dono \`${dono}\``)

  // 4) o CSS: as 3 cores, só com `background`, e ANTES dos alertas
  const semComentarios = css.replace(/\r\n/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '')
  const posicao = (seletor: string): number => semComentarios.indexOf(seletor + ' {')
  for (const dono of ['selvagem', 'inimigo', 'nosso']) {
    const sel = `.ilha-minimapa .ilha-dono-${dono}`
    const i = posicao(sel)
    assert(i >= 0, `minimapa: o CSS perdeu a cor do dono \`${dono}\``)
    const bloco = semComentarios.slice(i, semComentarios.indexOf('}', i))
    assert(/background:\s*#[0-9a-f]{6}/i.test(bloco), `minimapa: a regra do dono \`${dono}\` não define \`background\``)
    assert(!/box-shadow/.test(bloco), `minimapa: a regra do dono \`${dono}\` usa \`box-shadow\`: sobrescreveria o anel do corpo e o realce do passo cheio (medido)`)
    for (const alerta of ['.ilha-minimapa .ilha-alerta-verde', '.ilha-minimapa .ilha-alerta-vermelho']) {
      const ia = posicao(alerta)
      assert(ia >= 0, `minimapa: o CSS perdeu a regra \`${alerta}\``)
      assert(i < ia, `minimapa: a cor do dono \`${dono}\` vem DEPOIS de \`${alerta}\`: venceria o alerta no fundo (o urgente tem de aparecer)`)
    }
  }
  // 5) o dono vem DEPOIS da regra base do quadrado e do vazio (senão o cinza base vence a cor do dono)
  const base = posicao('.ilha-minimapa .ilha-mini-quadrado')
  assert(base >= 0 && base < posicao('.ilha-minimapa .ilha-dono-nosso'), 'minimapa: a regra base `.ilha-mini-quadrado` tem de vir ANTES das cores do dono')
}

/**
 * Prova que o leitor PEGA cada adulteração (sem isto o teste voltaria a ser frouxo sem ninguém ver): cada uma estraga UM ponto do contrato e o `run` TEM de falhar PELO MOTIVO certo; o
 * original e um comentário neutro NÃO podem falhar.
 */
export function rodarContraAdulteracoes(jsx: string, cssBruto: string): void {
  // O CSS chega do disco com o fim de linha que o git ou o editor deram: LF quando escrevi o teste (22/11), CRLF depois do PR #12 (o `git` converteu). As âncoras abaixo usam `\n`: normalizar UMA vez em vez de
  // depender do formato do arquivo (23/11: o gate quebrou com «a âncora aparece 0 vez(es)» sem nada do contrato ter mudado).
  const css = cssBruto.replace(/\r\n/g, '\n')
  const quebra = (j: string, c: string): string | null => {
    try {
      run(j, c)
      return null
    } catch (e) {
      return e instanceof Error ? e.message : String(e)
    }
  }
  const troca = (texto: string, de: string | RegExp, para: string, nome: string): string => {
    const certo = typeof de === 'string' ? texto.split(de).length - 1 : (texto.match(new RegExp(de.source, de.flags + (de.flags.includes('g') ? '' : 'g'))) ?? []).length
    assert(certo === 1, `adulteração "${nome}": a âncora aparece ${certo} vez(es), esperava exatamente 1 (o teste de adulteração precisa ser atualizado)`)
    return texto.replace(de, () => para)
  }
  assert(quebra(jsx, css) === null, 'adulteração: o original NÃO pode falhar')
  assert(quebra(jsx + '\n// comentário neutro\n', css + '\n/* neutro */\n') === null, 'adulteração: um comentário neutro NÃO pode falhar')
  const casos: Array<[string, string, string, string]> = [
    ['dono fora da assinatura', troca(jsx, '${ficha.corpo ? 1 : 0},${ficha.dono}`', '${ficha.corpo ? 1 : 0}`', 'dono fora da assinatura'), css, 'saiu da assinatura'],
    ['classe do dono removida', troca(jsx, 'ficha ? `ilha-dono-${ficha.dono}` : \'ilha-mapa-vazio\'', "ficha ? '' : 'ilha-mapa-vazio'", 'classe do dono removida'), css, 'perdeu a classe'],
    ['data-dono removido', troca(jsx, 'data-dono={ficha?.dono}', '', 'data-dono removido'), css, 'perdeu o `data-dono`'],
    ['texto do dono sem tipo', troca(jsx, 'const TEXTO_DO_DONO: Record<Dono, string> = {', 'const TEXTO_DO_DONO = {', 'texto do dono sem tipo'), css, 'perdeu o tipo'],
    ['cor do dono removida do CSS', jsx, troca(css, '.ilha-minimapa .ilha-dono-selvagem {', '.ilha-minimapa .ilha-dono-outro {', 'cor do dono removida do CSS'), 'perdeu a cor do dono `selvagem`'],
    ['cor do dono com box-shadow', jsx, troca(css, '.ilha-minimapa .ilha-dono-inimigo {\n  background: #5b2a6e;', '.ilha-minimapa .ilha-dono-inimigo {\n  background: #5b2a6e;\n  box-shadow: inset 0 0 0 2px #fff;', 'cor do dono com box-shadow'), 'usa `box-shadow`'],
    ['cor do dono depois do alerta', jsx, css.replace(/\.ilha-minimapa \.ilha-dono-nosso \{\n  background: #1e5a8a;\n\}\n/, '') + '\n.ilha-minimapa .ilha-dono-nosso {\n  background: #1e5a8a;\n}\n', 'vem DEPOIS de'],
    ['cor do dono sem background', jsx, troca(css, '.ilha-minimapa .ilha-dono-nosso {\n  background: #1e5a8a;', '.ilha-minimapa .ilha-dono-nosso {\n  color: #1e5a8a;', 'cor do dono sem background'), 'não define `background`'],
  ]
  for (const [nome, j, c, motivo] of casos) {
    const msg = quebra(j, c)
    assert(msg !== null, `adulteração "${nome}": o \`run\` PASSOU em verde com o contrato quebrado (o leitor está cego para este defeito)`)
    assert(msg.includes(motivo), `adulteração "${nome}": falhou por OUTRO motivo (esperava "${motivo}"; veio "${msg.slice(0, 140)}")`)
  }
}
