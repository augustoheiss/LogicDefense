function assert(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem)
}

/**
 * CONTRATO DO PAINEL DE CONSTRUÇÕES COM A TELA (23/11). A LÓGICA do painel (que linhas, preço, o que cada nível dá) tem teste de comportamento em `listaDeConstrucoes.test.ts`. Este arquivo guarda a LIGAÇÃO, que nenhum teste de Node
 * enxergava e que a mutação (`mutar-painel.mjs`, 23/11) mostrou ser cega: tirar `.ilha-construcoes` das listas de exclusão do clique, ou nem desenhar o painel, passava em verde em TODOS os gates.
 *  - o painel é DESENHADO no `IlhaRua` (`<PainelDeConstrucoes`), com as obras, os recursos, o resumo e o `aoEvoluir` que chama `evoluir` (o mesmo caminho do painel da obra: o preço cobrado e as recusas são os de sempre);
 *  - TODA lista de elementos do HUD que não recebem o clique do chão (`SELETOR_HUD_SEM_BORDA` da câmera e a lista do `closest(...)` do clique) contém `.ilha-construcoes`: sem isso o clique no painel «atravessa» para o chão e manda o herói
 *    andar ou a tropa se mover (o defeito DEF-L51B-1, que o contrato do HUD guarda para o `ilha.css` e NÃO enxerga o CSS próprio do painel);
 *  - o contêiner do painel tem a classe \`ilha-construcoes\` (a mesma das listas) e o CSS próprio declara \`pointer-events: auto\` nela (o painel recebe o ponteiro por vontade própria);
 *  - o painel NÃO está dentro de \`.ilha-hud\` com \`pointer-events: none\` (o botão tem de ser clicável).
 * NÃO garante o desenho no navegador (isso é da sonda \`painel-construcoes\`, que nada no CI roda).
 */
export function run(painelBruto: string, ilhaBruta: string, cssBruto: string): void {
  const semComentarios = (t: string): string =>
    t
      .replace(/\r\n/g, '\n')
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
  const painel = semComentarios(painelBruto)
  const ilha = semComentarios(ilhaBruta)
  const css = semComentarios(cssBruto)

  // 1) o painel é desenhado e recebe o que precisa
  const uso = ilha.match(/<PainelDeConstrucoes([\s\S]*?)\n {8}\/>/)
  assert(uso, 'painel: não achei `<PainelDeConstrucoes ... />` no IlhaRua (o painel nem é desenhado, ou o teste precisa ser atualizado, não ignorado)')
  // O painel é filho DIRETO do HUD, sem condição na frente: `{false && <PainelDeConstrucoes ...` ou `{x ? <Painel...` ainda «aparecem» no texto mas NUNCA (ou só às vezes) desenham. A mutação mostrou que um `&&` colado passava em verde.
  // O painel não depende de modo nenhum (aparece no Império, na 1ª e na 3ª pessoa): o que vem antes do `<` é só espaço de indentação.
  const indice = ilha.indexOf('<PainelDeConstrucoes')
  const antes = ilha.slice(ilha.lastIndexOf('\n', indice) + 1, indice)
  assert(/^\s*$/.test(antes), `painel: algo vem ANTES de \`<PainelDeConstrucoes\` na mesma linha (\`${antes.trim().slice(0, 40)}\`): uma condição (\`&&\`, \`?\`) o esconderia, e o painel tem de aparecer sempre`)
  assert(/obras=\{hud\.obras\}/.test(uso[1]), 'painel: o painel perdeu `obras={hud.obras}` (a lista sairia vazia ou de outra fonte)')
  assert(/recursos=\{\{[^}]*credito: hud\.credito[^}]*madeira: hud\.madeira[^}]*ouro: hud\.ouro[^}]*\}\}/.test(uso[1]), 'painel: o painel perdeu os recursos reais (`credito`, `madeira`, `ouro` do `hud`): o botão Evoluir decidiria sem saber o que o jogador tem')
  assert(/aoEvoluir=\{[\s\S]*?evoluir\(sim\.current, id\)/.test(uso[1]), 'painel: o `aoEvoluir` do painel não chama `evoluir(sim.current, id)` (o botão não evoluiria, ou evoluiria por outro caminho que não cobra o preço da tabela)')
  assert(/publicar\(prox\)/.test(uso[1]), 'painel: o `aoEvoluir` não `publicar`ia o estado novo (a tela não veria a obra evoluída)')
  assert(/import \{ PainelDeConstrucoes \} from '\.\/PainelDeConstrucoes'/.test(ilha), 'painel: falta o import de `PainelDeConstrucoes` no IlhaRua')

  // 2) toda lista de exclusão do HUD que cita `.ilha-base` também cita `.ilha-construcoes` (a classe do painel)
  const listas = ilha.match(/'[^'\n]*\.ilha-base[^'\n]*'/g) ?? []
  // Quantas listas há DEPENDE do que o `IlhaRua` tem: uma (a do `closest` do clique) ou mais (a da câmera 360° da outra frente, 23/11). O contrato vale para TODAS, sejam quantas forem, mas tem de achar ao menos uma.
  assert(listas.length >= 1, `painel: não achei nenhuma lista de exclusão do HUD com \`.ilha-base\`: o teste precisa ser atualizado, não ignorado`)
  for (const lista of listas) assert(/\.ilha-construcoes\b/.test(lista), `painel: uma lista de exclusão do HUD ficou SEM \`.ilha-construcoes\`: o clique no painel atravessa para o chão (${lista.slice(0, 90)}...)`)

  // 3) o contêiner do painel tem a classe e o CSS próprio a faz receber o ponteiro
  assert(/className="ilha-construcoes"/.test(painel), 'painel: o contêiner do painel perdeu a classe `ilha-construcoes` (as listas de exclusão não o reconheceriam)')
  const regra = css.match(/\.ilha-construcoes\s*\{([^}]*)\}/)
  assert(regra, 'painel: o CSS do painel perdeu a regra `.ilha-construcoes { ... }`')
  assert(/pointer-events:\s*auto/.test(regra[1]), 'painel: o contêiner `.ilha-construcoes` perdeu `pointer-events: auto` (dentro do HUD, que ignora o ponteiro, o botão não clicaria)')
  assert(/position:\s*absolute/.test(regra[1]), 'painel: o contêiner `.ilha-construcoes` perdeu `position: absolute` (voltaria ao fluxo e empurraria o HUD)')
  // o CSS próprio é importado pelo componente (senão a classe existiria sem estilo nenhum)
  assert(/import '\.\/painelDeConstrucoes\.css'/.test(painel), 'painel: o componente não importa o CSS próprio `painelDeConstrucoes.css`')

  // 4) o botão e a lista têm os testids que a sonda e o jogador usam
  for (const id of ['ilha-construcoes', 'ilha-construcoes-abrir', 'ilha-construcoes-lista']) assert(painel.includes(`data-testid="${id}"`), `painel: perdeu o \`data-testid="${id}"\``)
  assert(/aria-expanded=\{aberto\}/.test(painel), 'painel: o botão perdeu `aria-expanded` (o leitor de tela não sabe se a lista está aberta)')
}

/**
 * Prova que o leitor PEGA cada adulteração: cada uma estraga UM ponto do contrato e o `run` TEM de falhar PELO MOTIVO certo; o original e um comentário neutro NÃO podem falhar.
 */
export function rodarContraAdulteracoes(painelBruto: string, ilhaBruta: string, cssBruto: string): void {
  const n = (t: string) => t.replace(/\r\n/g, '\n')
  const p = n(painelBruto)
  const i = n(ilhaBruta)
  const c = n(cssBruto)
  const quebra = (pp: string, ii: string, cc: string): string | null => {
    try {
      run(pp, ii, cc)
      return null
    } catch (e) {
      return e instanceof Error ? e.message : String(e)
    }
  }
  // `minimo` é o MENOR número de ocorrências aceito: a âncora das LISTAS aparece 1 vez (só a do clique) ou 2 (com a da câmera da outra frente) e a adulteração tira a classe de TODAS (uma lista que ficasse com ela mascararia o teste).
  const troca = (texto: string, de: string, para: string, nome: string, minimo = 1, maximo = minimo): string => {
    const certo = texto.split(de).length - 1
    assert(certo >= minimo && certo <= maximo, `adulteração "${nome}": a âncora aparece ${certo} vez(es), esperava de ${minimo} a ${maximo} (o teste de adulteração precisa ser atualizado)`)
    return texto.split(de).join(para)
  }
  assert(quebra(p, i, c) === null, 'adulteração: o original NÃO pode falhar')
  assert(quebra(p + '\n// neutro\n', i + '\n// neutro\n', c + '\n/* neutro */\n') === null, 'adulteração: um comentário neutro NÃO pode falhar')
  const casos: Array<[string, string, string, string, string]> = [
    ['painel não desenhado', p, troca(i, '<PainelDeConstrucoes\n', '<PainelFantasma\n', 'painel não desenhado'), c, 'não achei `<PainelDeConstrucoes'],
    ['painel escondido por uma condição', p, troca(i, '        <PainelDeConstrucoes\n', '        {false && <PainelDeConstrucoes\n', 'painel escondido por uma condição').replace('          }}\n        />\n        <div className="ilha-enemies"', '          }}\n        />}\n        <div className="ilha-enemies"'), c, 'algo vem ANTES de `<PainelDeConstrucoes`'],
    ['sem as obras', p, troca(i, 'obras={hud.obras}\n          recursos', 'obras={[]}\n          recursos', 'sem as obras'), c, 'perdeu `obras={hud.obras}`'],
    ['sem os recursos', p, troca(i, 'recursos={{ credito: hud.credito, madeira: hud.madeira, ouro: hud.ouro }}', 'recursos={{ credito: 99, madeira: 99, ouro: 99 }}', 'sem os recursos'), c, 'perdeu os recursos reais'],
    ['aoEvoluir não evolui', p, troca(i, 'const prox = evoluir(sim.current, id)\n            publicar(prox)\n            const depois = prox.obras.find((obra) => obra.id === id)\n            if (antes && depois && depois.nivel > antes.nivel) {\n              setFerramenta(`${META_INTENCOES[depois.tipo].titulo} (Nv. ${depois.nivel})`)\n              setPower(`${META_INTENCOES[depois.tipo].titulo} evoluiu para Nv. ${depois.nivel}!`)\n            } else {\n              setPower(motivoDeNaoEvoluir(sim.current, id))\n            }\n          }}\n        />', 'const prox = sim.current\n            publicar(prox)\n            const depois = prox.obras.find((obra) => obra.id === id)\n            if (antes && depois) setPower(motivoDeNaoEvoluir(sim.current, id))\n          }}\n        />', 'aoEvoluir não evolui'), c, 'não chama `evoluir(sim.current, id)`'],
    ['sem import', p, troca(i, "import { PainelDeConstrucoes } from './PainelDeConstrucoes'\n", '', 'sem import'), c, 'falta o import'],
    ['uma lista sem a classe', p, troca(i, '.ilha-base, .ilha-construcoes, .ilha-ferramentas,', '.ilha-base, .ilha-ferramentas,', 'as listas sem a classe', 1, 2), c, 'ficou SEM `.ilha-construcoes`'],
    // só a ÚLTIMA lista sem a classe (a do clique, que existe em qualquer versão): o contrato tem de pegar até uma lista isolada
    ['só a lista do clique sem a classe', p, i.slice(0, i.lastIndexOf('.ilha-base, .ilha-construcoes, .ilha-ferramentas,')) + '.ilha-base, .ilha-ferramentas,' + i.slice(i.lastIndexOf('.ilha-base, .ilha-construcoes, .ilha-ferramentas,') + '.ilha-base, .ilha-construcoes, .ilha-ferramentas,'.length), c, 'ficou SEM `.ilha-construcoes`'],
    ['contêiner sem a classe', troca(p, 'className="ilha-construcoes"', 'className="outra-coisa"', 'contêiner sem a classe'), i, c, 'perdeu a classe `ilha-construcoes`'],
    // a regra aparece 2 vezes no CSS (a do contêiner e a do `@media` de tela estreita): a adulteração tira as DUAS
    ['css sem a regra', p, i, troca(c, '.ilha-construcoes {', '.ilha-outra {', 'css sem a regra', 1, 2), 'perdeu a regra `.ilha-construcoes'],
    ['css sem pointer-events', p, i, troca(c, '  pointer-events: auto;\n  font-size: 14px;', '  font-size: 14px;', 'css sem pointer-events'), 'perdeu `pointer-events: auto`'],
    ['css sem position', p, i, troca(c, '.ilha-construcoes {\n  position: absolute;', '.ilha-construcoes {\n  position: relative;', 'css sem position'), 'perdeu `position: absolute`'],
    ['sem importar o css', troca(p, "import './painelDeConstrucoes.css'\n", '', 'sem importar o css'), i, c, 'não importa o CSS próprio'],
    ['botão sem testid', troca(p, 'data-testid="ilha-construcoes-abrir"', 'data-testid="x"', 'botão sem testid'), i, c, 'perdeu o `data-testid="ilha-construcoes-abrir"`'],
    ['botão sem aria-expanded', troca(p, 'aria-expanded={aberto}', '', 'botão sem aria-expanded'), i, c, 'perdeu `aria-expanded`'],
  ]
  for (const [nome, pp, ii, cc, motivo] of casos) {
    const msg = quebra(pp, ii, cc)
    assert(msg !== null, `adulteração "${nome}": o \`run\` PASSOU em verde com o contrato quebrado (o leitor está cego para este defeito)`)
    assert(msg.includes(motivo), `adulteração "${nome}": falhou por OUTRO motivo (esperava "${motivo}"; veio "${msg.slice(0, 140)}")`)
  }
}
