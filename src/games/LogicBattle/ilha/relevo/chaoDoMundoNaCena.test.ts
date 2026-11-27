function assert(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem)
}

function soCodigo(texto: string): string {
  return texto
    .split(/\r?\n/)
    .filter((linha) => !/^\s*(\/\/|\*|\/\*)/.test(linha))
    .join('\n')
}

function ocorrencias(texto: string, padrao: RegExp): number {
  return (texto.match(padrao) ?? []).length
}

/**
 * CONTRATO DE TEXTO dos PONTOS DE CHÃO DO MUNDO que `IlhaRua.tsx` ainda desenhava no plano (F2, Task 4, resto, 26/11/2026): o ponto de reunião de um quartel, os dois discos e a linha da patrulha, e o rótulo
 * de projeção (`projetarNdcRef`). Cada um soma o desnível do chão no SEU ponto (`desnivelDoChao`: não são coisas que repousam na água, são marcas no chão), pela ÚNICA conta de `relevo/alturaVisual`.
 *
 * A fonte do campo é, como no ator e no clique, a REF `ultimoCampoDoRelevo.current` (chave desligada ⇒ `undefined` ⇒ +0 exato, I1) para o que roda em função de evento (`projetarNdcRef` é atribuída a cada render e
 * chamada fora do ciclo) e o ESTADO `campoDoRelevo` com a MESMA condição do chão (`PARTIDA.relevo.visual ? campoDoRelevo : undefined`) para o que é atributo JSX avaliado no render e que ANDA pouco (marcas).
 *
 * A LINHA DA PATRULHA: uma caixa horizontal, ou uma reta inclinada de A a B, ERRAM (medido em `medir-linha-da-patrulha.mjs`, 6 biomas: 0,25 m a 1,3 m de erro mediano, a inclinada quase igual à horizontal,
 * porque o terreno entre os dois pontos tem cristas e vales que uma reta não segue): a linha vira uma FILEIRA de segmentos curtos, cada um no desnível do SEU ponto médio.
 */
export function contratoDoChaoDoMundoNaCena(cena: string): void {
  const ilha = soCodigo(cena)
  assert(/import \{[^}]*\bdesnivelDoChao\b[^}]*\} from '\.\/relevo\/alturaVisual'/.test(ilha), '`IlhaRua` importa `desnivelDoChao` de `./relevo/alturaVisual` (a ÚNICA conta do chão)')

  // (1) o ponto de reunião: o grupo da bandeira
  const reuniao = /<group position=\{\[obraRallyVisivel\.rallyPoint\.x, ([^\]]*), obraRallyVisivel\.rallyPoint\.z\]\}>/.exec(ilha)?.[1] ?? ''
  assert(reuniao.length > 0, 'controle do instrumento: o recorte achou o grupo do PONTO DE REUNIÃO')
  assert(/^-0\.42 \+ desnivelDoChao\(PARTIDA\.relevo\.visual \? chaoDaMalhaDoDesenho : undefined, obraRallyVisivel\.rallyPoint\.x, obraRallyVisivel\.rallyPoint\.z\)$/.test(reuniao), `o ponto de reunião fica em \`-0.42 + desnivelDoChao(PARTIDA.relevo.visual ? chaoDaMalhaDoDesenho : undefined, rally.x, rally.z)\`: a MALHA que o GPU desenha (veio: ${reuniao})`)

  // o ANEL do ponto de reunião sobe a elevação do anel (a MESMA coroa horizontal dos discos da patrulha: 91 % ficavam com uma parte enterrada); o POSTE e a BANDEIRA NÃO sobem (só o anel é horizontal)
  const blocoDaReuniao = /<group position=\{\[obraRallyVisivel\.rallyPoint\.x[\s\S]*?<\/group>/.exec(ilha)?.[0] ?? ''
  assert(/<mesh position=\{\[0, elevacaoDoAnel\(PARTIDA\.relevo\.visual \? chaoDaMalhaDoDesenho : undefined\), 0\]\} rotation=\{\[-Math\.PI \/ 2, 0, 0\]\} raycast=\{semRaycast\}>\s*<ringGeometry args=\{\[0\.4, 0\.56, 20\]\} \/>/.test(blocoDaReuniao), 'o ANEL do ponto de reunião sobe `elevacaoDoAnel(PARTIDA.relevo.visual ? chaoDaMalhaDoDesenho : undefined)` DENTRO do grupo (o `<mesh>` do anel tem `position={[0, elevacao, 0]}`)')
  assert(/<mesh position=\{\[0, 0\.7, 0\]\} raycast=\{semRaycast\}>\s*<cylinderGeometry/.test(blocoDaReuniao) && /<mesh position=\{\[0\.22, 1\.25, 0\]\} raycast=\{semRaycast\}>\s*<boxGeometry/.test(blocoDaReuniao), 'o POSTE (0,7) e a BANDEIRA (1,25) do ponto de reunião NÃO mudaram: só o anel é horizontal')
  // (2) a patrulha: o bloco inteiro do `.map` da patrulha
  const patrulha = /u\.ordem\?\.tipo === 'patrulhar'\)\s*\.slice\(0, 4\)\s*\.map\(\(u\) => \{([\s\S]*?)\n        \}\)\}/.exec(ilha)?.[1] ?? ''
  assert(patrulha.length > 0, 'controle do instrumento: o recorte achou o `.map` da PATRULHA (até o `})}` da indentação dele)')
  // O CHÃO DA PATRULHA É A MALHA QUE O GPU DESENHA (F2, 26/11, decisão do usuário, achado na FOTO 02: a linha tinha um buraco de 1,3 m porque o campo bilinear `alturaEm` NÃO é a malha de 2 m/4 m entre os vértices).
  // `chaoDaMalhaDoDesenho` é derivado no `Cena` de `campoDoRelevo` e do passo da qualidade em uso; a MESMA condição do chão (chave LIGADA E campo pronto): sem campo é `undefined` e tudo é +0 exato (I1).
  assert(/const campoDaPatrulha = PARTIDA\.relevo\.visual \? chaoDaMalhaDoDesenho : undefined/.test(patrulha), 'a patrulha lê o chão UMA vez (const campoDaPatrulha = PARTIDA.relevo.visual ? chaoDaMalhaDoDesenho : undefined): a MESMA condição do chão, agora a MALHA')
  assert(!/campoDoRelevo/.test(patrulha), 'a patrulha NÃO lê mais o campo CRU campoDoRelevo (a linha posta pelo campo bilinear ficava enterrada pela malha: o buraco da foto 02)')
  assert(/const chaoDaMalhaDoDesenho = chaoDaMalha\(PARTIDA\.relevo\.visual \? campoDoRelevo : undefined, passoDaMalha\(props\.specQualidade\.efetiva\)\)/.test(ilha), 'Cena deriva chaoDaMalhaDoDesenho = chaoDaMalha(PARTIDA.relevo.visual ? campoDoRelevo : undefined, passoDaMalha(props.specQualidade.efetiva)): o campo e o passo da qualidade EM USO (quando o preset muda a Cena re-renderiza e a malha é reconstruída no MESMO quadro)')
  assert(/import \{ chaoDaMalha \} from '\.\/relevo\/chaoDaMalha'/.test(ilha) && /import \{[^}]*\bpassoDaMalha\b[^}]*\} from '\.\/relevo\/geometriaDoTerreno'/.test(ilha), 'IlhaRua importa chaoDaMalha (o chão que o GPU desenha) e passoDaMalha (o passo da qualidade): a conta provada contra o three REAL, não uma cópia')
  assert(/<mesh position=\{\[ax, -0\.42 \+ desnivelDoChao\(campoDaPatrulha, ax, az\) \+ elevacaoDoAnel\(campoDaPatrulha\), az\]\}/.test(patrulha), 'o disco A sobe no desnível do SEU ponto MAIS a elevação do anel: `-0.42 + desnivelDoChao(campoDaPatrulha, ax, az) + elevacaoDoAnel(campoDaPatrulha)` (91 % dos anéis horizontais ficavam com uma parte enterrada; sem campo a elevação é +0)')
  assert(/<mesh position=\{\[bx, -0\.42 \+ desnivelDoChao\(campoDaPatrulha, bx, bz\) \+ elevacaoDoAnel\(campoDaPatrulha\), bz\]\}/.test(patrulha), 'o disco B sobe no desnível do SEU ponto MAIS a elevação do anel: `-0.42 + desnivelDoChao(campoDaPatrulha, bx, bz) + elevacaoDoAnel(campoDaPatrulha)`')
  // A LINHA: COM campo é a fileira de segmentos; SEM campo continua UMA caixa, a de hoje, bit a bit (I1). A caixa horizontal só pode existir no ramo SEM campo (depois do `: (` do ternário): fora dele ela
  // erraria 0,25–1,3 m no terreno real. (A 1ª versão deste contrato dizia «a caixa NÃO existe mais», contradizendo a decisão de preservar I1: o código estava certo e o contrato errado.)
  const ternario = /\{campoDaPatrulha \? \(([\s\S]*?)\) : \(([\s\S]*?)\)\}/.exec(patrulha)
  assert(ternario !== null, 'a linha é um ternário `campoDaPatrulha ? (fileira) : (caixa de hoje)`')
  const comCampo = ternario?.[1] ?? ''
  const semCampo = ternario?.[2] ?? ''
  assert(/segmentosDaPatrulha\(ax, az, bx, bz\)\.map\(/.test(comCampo), 'COM campo a linha é a fileira de segmentos: `segmentosDaPatrulha(ax, az, bx, bz).map(…)`')
  // CADA SEGMENTO É INCLINADO pelo desnível das SUAS DUAS PONTAS (a FOTO `medicoes/F2/30` mostrou LACUNAS na linha: medido, 59 % dos segmentos horizontais tinham uma ponta enterrada). Os 3 valores vêm de
  // `inclinarSegmento` (provados com o three REAL, 6 direções, erro 0,0000 m): a altura é a MÉDIA das pontas, o giro em x é NEGATIVO, a caixa é a DIAGONAL, e a ordem de Euler tem de ser `YXZ` (com a `XYZ` padrão a
  // inclinação é no eixo do MUNDO e erra até 0,9 m).
  assert(/const inclinado = inclinarSegmento\(s, \(x, z\) => desnivelDoChao\(campoDaPatrulha, x, z\)\)/.test(comCampo), 'cada segmento é inclinado por `inclinarSegmento(s, (x, z) => desnivelDoChao(campoDaPatrulha, x, z))`: a altura vem do CHÃO DAS DUAS PONTAS, não do ponto médio')
  assert(/position=\{\[s\.x, -0\.41 \+ inclinado\.y \+ elevacaoDaLinha\(campoDaPatrulha\), s\.z\]\}/.test(comCampo), 'o centro do segmento fica em `-0.41 + inclinado.y + elevacaoDaLinha(campoDaPatrulha)` (a média das pontas, mais 0,10 m: leva o meio enterrado de 2,2 % a 0,0 %; a auditoria da foto 31)')
  assert(/rotation=\{\[inclinado\.inclinacao, s\.ang, 0, 'YXZ'\]\}/.test(comCampo), "o segmento gira `[inclinado.inclinacao, s.ang, 0, 'YXZ']`: a ordem 'YXZ' é a que põe as duas pontas no lugar (a 'XYZ' padrão erra até 0,9 m)")
  assert(/<boxGeometry args=\{\[0\.09, 0\.03, inclinado\.comprimento\]\} \/>/.test(comCampo), 'a caixa tem o comprimento da DIAGONAL: `boxGeometry args={[0.09, 0.03, inclinado.comprimento]}` (com o `comp` horizontal as pontas ficam 0,5 m para dentro)')
  assert(!/s\.comp/.test(comCampo) && !/comp(?!\w)/.test(comCampo), 'COM campo nem `s.comp` nem o `comp` total da patrulha desenham a caixa: só `inclinado.comprimento`')
  assert(/key=\{k\}/.test(comCampo), 'cada segmento tem `key` (uma lista de malhas sem chave perde e recria as 64 a cada quadro)')
  assert(/<mesh position=\{\[mx, -0\.41, mz\]\} rotation=\{\[0, ang, 0\]\}/.test(semCampo) && /<boxGeometry args=\{\[0\.09, 0\.03, comp\]\} \/>/.test(semCampo), 'SEM campo a linha é a caixa de HOJE, bit a bit: `[mx, -0.41, mz]`, giro `ang`, `boxGeometry [0.09, 0.03, comp]` (I1)')
  assert(!/desnivelDoChao/.test(semCampo), 'e SEM campo ela não soma nada (o ramo é o jogo de hoje)')
  assert(ocorrencias(patrulha, /elevacaoDoAnel\(/g) === 2 && ocorrencias(patrulha, /elevacaoDaLinha\(/g) === 1, '`elevacaoDoAnel(` aparece 2 vezes (os 2 discos) e `elevacaoDaLinha(` 1 vez (o segmento) na patrulha: nenhuma elevação solta')
  assert(ocorrencias(patrulha, /desnivelDoChao\(/g) === 3, '`desnivelDoChao(` aparece 3 vezes na patrulha (disco A, disco B, segmento): nenhum outro ponto somou o terreno')

  // (3) o rótulo: a projeção a 0,8 m sobe com o chão do ponto; o campo vem da REF (a função é atribuída a cada render e chamada fora do ciclo)
  // o rótulo projeta o CORPO da tropa, que agora está na MALHA: o campo da REF `ultimoChaoDaMalha` (a função é atribuída a cada render e chamada fora do ciclo, então lê a REF no momento da chamada)
  assert(/const v = new Vector3\(x, 0\.8 \+ desnivelDoChao\(ultimoChaoDaMalha\.current, x, z\), z\)\.project\(camera\)/.test(ilha), 'o rótulo projeta `0.8 + desnivelDoChao(ultimoChaoDaMalha.current, x, z)`: a MALHA da REF, a mesma que posiciona o corpo da tropa (chave desligada ⇒ `undefined` ⇒ +0 exato)')

  // (4) a ÚNICA fonte da fileira de segmentos mora num módulo testado, e é importada
  assert(/import \{[^}]*\bsegmentosDaPatrulha\b[^}]*\} from '\.\/relevo\/segmentosDaPatrulha'/.test(ilha), '`IlhaRua` importa `segmentosDaPatrulha` de `./relevo/segmentosDaPatrulha` (a conta provada no Node, não uma cópia)')
}

export function run(cena?: string): void {
  if (cena !== undefined) contratoDoChaoDoMundoNaCena(cena)
}
