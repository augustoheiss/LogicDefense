function assert(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem)
}

/**
 * CONTRATO DO MURO DA BORDA (M5, 23/11). A GEOMETRIA do muro tem teste de comportamento em `destinoDoClique.test.ts` (o que se vê pintado é onde o clique manda atravessar). Este arquivo guarda o que
 * nenhum teste de Node enxerga e que falhou em silêncio na primeira versão:
 *  - o muro é desenhado POR CIMA da nuvem de visão (`depthTest={false}` + `renderOrder`): a nuvem é uma coluna de 4 m com `depthWrite` e um muro de 1,5 m fica inteiro dentro dela; com o teste de
 *    profundidade ligado o muro sumia (medido no jogo real: 36 pixels de diferença, contra 32 do controle). Quem «limpar» o `depthTest={false}` como se fosse gambiarra traz o defeito de volta SEM erro nenhum;
 *  - o muro NUNCA captura o clique (`raycast={semRaycast}`): o clique tem de continuar chegando ao chão, que é o que `destinoDoClique` lê;
 *  - o muro sai do gesto da câmera e da edição: o `IlhaRua` só o liga com o Império, sem modo de bloco/linha/consagrar e com tropa NOSSA VIVA selecionada;
 *  - o muro usa as caixas de `caixasDaBorda` (a mesma região da regra do clique), não números soltos.
 * NÃO garante o desenho no navegador (isso é da sonda `m5-muro-visivel`, que nada no CI roda).
 */
export function run(bordaBruta: string, ilhaBruta: string): void {
  // O leitor olha só o CÓDIGO: a documentação do componente cita `raycast={semRaycast}`, `depthTest` etc. em texto, e uma regex que casasse num comentário deixaria o contrato verde com o código quebrado
  // (a 1ª versão deste teste tinha essa cegueira: tirar `raycast={semRaycast}` do JSX não o derrubava, e a adulteração "captura o clique" a revelou).
  const semComentarios = (texto: string): string =>
    texto
      .replace(/\r\n/g, '\n')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
  const borda = semComentarios(bordaBruta)
  const ilha = semComentarios(ilhaBruta)
  // 1) o muro é desenhado por cima da nuvem e da penumbra
  assert(/depthTest=\{false\}/.test(borda), 'borda: o muro perdeu `depthTest={false}`: a nuvem de visão (coluna de 4 m com depthWrite) o esconde por inteiro')
  assert(/renderOrder=\{ORDEM_DO_MURO\}/.test(borda), 'borda: o muro perdeu o `renderOrder`: sem ele a ordem de desenho entre o muro e a nuvem fica a critério do three.js')
  const ordem = borda.match(/export const ORDEM_DO_MURO = (\d+)/)
  assert(ordem && Number(ordem[1]) > 0, 'borda: `ORDEM_DO_MURO` tem de ser maior que 0 (a nuvem e a penumbra ficam em 0 e têm de ser desenhadas ANTES)')
  assert(/depthWrite=\{false\}/.test(borda), 'borda: o muro perdeu `depthWrite={false}`: um muro translúcido que escreve profundidade apaga o que fica atrás dele')
  assert(/\btransparent\b/.test(borda), 'borda: o muro perdeu `transparent`: ficaria opaco e taparia o chão da beira')

  // 2) o muro nunca captura o clique
  assert(/raycast=\{semRaycast\}/.test(borda), 'borda: o muro perdeu `raycast={semRaycast}`: capturaria o clique que `destinoDoClique` precisa receber no chão')

  // 3) a geometria vem de `caixasDaBorda`, não de números soltos
  assert(/caixasDaBorda\(\)\.map\(/.test(borda), 'borda: o muro não usa `caixasDaBorda()`: a região pintada pode se afastar da região do clique')
  assert(/import \{ caixasDaBorda \} from '\.\/destinoDoClique'/.test(borda), 'borda: falta o import de `caixasDaBorda` de `destinoDoClique`')

  // 4) o `IlhaRua` liga o muro só nas condições certas
  const uso = ilha.match(/<BordaDoMapa\s+visivel=\{([\s\S]*?)\}\s*\/>/)
  assert(uso, 'borda: não achei `<BordaDoMapa visivel={...} />` no IlhaRua: o teste precisa ser atualizado, não ignorado')
  const condicao = uso[1]
  assert(/olhar === 'imperio'/.test(condicao), 'borda: o muro deixou de exigir o olhar do Império (apareceria na 1ª e na 3ª pessoa, onde clicar na borda não manda ninguém)')
  assert(/modoBloco/.test(condicao) && /modoLinhaRef/.test(condicao) && /modoConsagrarRef/.test(condicao), 'borda: o muro deixou de se esconder nos modos de bloco, linha ou consagrar (o clique ali é outro gesto)')
  assert(/lado === 'aliado'/.test(condicao) && /hp > 0/.test(condicao) && /selectedIds/.test(condicao), 'borda: o muro deixou de exigir tropa NOSSA, VIVA e SELECIONADA (sem ela a faixa não faz nada e pintá-la engana)')
}

/**
 * Prova que o leitor PEGA cada adulteração: cada uma estraga UM ponto do contrato e o `run` TEM de falhar PELO MOTIVO certo; o original e um comentário neutro NÃO podem falhar.
 */
export function rodarContraAdulteracoes(borda: string, ilha: string): void {
  const normaliza = (t: string) => t.replace(/\r\n/g, '\n')
  const b = normaliza(borda)
  const i = normaliza(ilha)
  const quebra = (bb: string, ii: string): string | null => {
    try {
      run(bb, ii)
      return null
    } catch (e) {
      return e instanceof Error ? e.message : String(e)
    }
  }
  const troca = (texto: string, de: string, para: string, nome: string): string => {
    const certo = texto.split(de).length - 1
    assert(certo === 1, `adulteração "${nome}": a âncora aparece ${certo} vez(es), esperava exatamente 1 (o teste de adulteração precisa ser atualizado)`)
    return texto.replace(de, () => para)
  }
  assert(quebra(b, i) === null, 'adulteração: o original NÃO pode falhar')
  assert(quebra(b + '\n// comentário neutro\n', i + '\n// neutro\n') === null, 'adulteração: um comentário neutro NÃO pode falhar')
  const casos: Array<[string, string, string, string]> = [
    ['depthTest ligado', troca(b, ' depthTest={false}', '', 'depthTest ligado'), i, 'perdeu `depthTest={false}`'],
    ['sem renderOrder', troca(b, ' renderOrder={ORDEM_DO_MURO}', '', 'sem renderOrder'), i, 'perdeu o `renderOrder`'],
    ['ordem zero', troca(b, 'export const ORDEM_DO_MURO = 20', 'export const ORDEM_DO_MURO = 0', 'ordem zero'), i, '`ORDEM_DO_MURO` tem de ser maior que 0'],
    ['depthWrite ligado', troca(b, ' depthWrite={false}', '', 'depthWrite ligado'), i, 'perdeu `depthWrite={false}`'],
    ['opaco', troca(b, ' transparent ', ' ', 'opaco'), i, 'perdeu `transparent`'],
    ['captura o clique', troca(b, ' raycast={semRaycast}', '', 'captura o clique'), i, 'perdeu `raycast={semRaycast}`'],
    ['geometria solta', troca(b, 'caixasDaBorda().map(', '[].map(', 'geometria solta'), i, 'não usa `caixasDaBorda()`'],
    ['sem import das caixas', troca(b, "import { caixasDaBorda } from './destinoDoClique'", "import { caixasDaBorda as c2 } from './destinoDoClique'", 'sem import das caixas'), i, 'falta o import de `caixasDaBorda`'],
    ['sem exigir o Império', b, troca(i, "props.sim.current.olhar === 'imperio' &&\n          !props.modoBloco &&\n          !props.modoLinhaRef.current", '!props.modoBloco &&\n          !props.modoLinhaRef.current', 'sem exigir o Império'), 'deixou de exigir o olhar do Império'],
    ['sem esconder em modo de bloco', b, troca(i, "          !props.modoBloco &&\n          !props.modoLinhaRef.current &&\n          !props.modoConsagrarRef.current &&\n          props.selectedIds.some((id) => props.sim.current.unidades.some((u) => u.id === id && u.lado === 'aliado' && u.hp > 0))\n        }\n      />\n      <MundoSandboxCena", "          !props.modoLinhaRef.current &&\n          !props.modoConsagrarRef.current &&\n          props.selectedIds.some((id) => props.sim.current.unidades.some((u) => u.id === id && u.lado === 'aliado' && u.hp > 0))\n        }\n      />\n      <MundoSandboxCena", 'sem esconder em modo de bloco'), 'deixou de se esconder nos modos de bloco'],
    ['sem exigir tropa viva', b, troca(i, "u.id === id && u.lado === 'aliado' && u.hp > 0))\n        }\n      />\n      <MundoSandboxCena", "u.id === id && u.lado === 'aliado'))\n        }\n      />\n      <MundoSandboxCena", 'sem exigir tropa viva'), 'deixou de exigir tropa NOSSA, VIVA e SELECIONADA'],
  ]
  for (const [nome, bb, ii, motivo] of casos) {
    const msg = quebra(bb, ii)
    assert(msg !== null, `adulteração "${nome}": o \`run\` PASSOU em verde com o contrato quebrado (o leitor está cego para este defeito)`)
    assert(msg.includes(motivo), `adulteração "${nome}": falhou por OUTRO motivo (esperava "${motivo}"; veio "${msg.slice(0, 140)}")`)
  }
}
