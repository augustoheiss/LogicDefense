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
 * CONTRATO DE TEXTO da LIGAÇÃO do relevo ao ator e à câmera (F2, Task 5 + 7, 25/11/2026). A lógica está provada no Node (`alturaDoAtor.test.ts`); o desenho vive no React e o runner roda sem GPU, então
 * o que o Node pode travar é a FORMA: as ligações que, se faltarem, o jogador só descobre numa foto (o herói atravessando o morro, a câmera dentro do chão). Cada linha é uma ligação cuja ausência é
 * um defeito conhecido, e todas as propriedades opcionais são o risco: uma prop ESQUECIDA compila, passa os testes do componente e o jogo ignora o relevo, sem erro nenhum.
 *
 * A FONTE DO CAMPO DO ATOR é a REF `ultimoCampoDoRelevo` que `Cena` já mantém (escrita SÓ dentro do bloco `if (PARTIDA.relevo.visual && …)`): com a chave desligada ela fica `undefined` para sempre, e
 * `desnivelDoAtor(undefined, …)` é +0 exato (I1). Não existe uma segunda condição para esquecer. O ator ANDA, então o campo vai por REF e é lido no `useFrame`, não por prop de valor.
 */
export function contratoDaLigacaoDoAtor(cena: string, tropas: string): void {
  const ilha = soCodigo(cena)
  const trp = soCodigo(tropas)

  // ── A) `Cena` (IlhaRua.tsx) ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  assert(/import \{[^}]*\bdesnivelDoAtor\b[^}]*\bcameraDoImperio\b[^}]*\} from '\.\/relevo\/alturaDoAtor'|import \{[^}]*\bcameraDoImperio\b[^}]*\bdesnivelDoAtor\b[^}]*\} from '\.\/relevo\/alturaDoAtor'/.test(ilha), '`IlhaRua` importa `desnivelDoAtor` e `cameraDoImperio` de `./relevo/alturaDoAtor` (a ÚNICA conta do ator e da câmera)')
  assert(/\bposicaoDaCamera1p\b/.test(ilha) && /\bposicaoDaCamera3p\b/.test(ilha), '`IlhaRua` importa as câmeras de 1ª e 3ª pessoa')
  // o `useFrame` da Cena lê o campo da REF (não do estado `campoDoRelevo`, que fica velho dentro do `useFrame`: o `useFrame` não re-captura o render)
  // O CHÃO QUE O ATOR PISA É A MALHA QUE O GPU DESENHA (F2, 26/11, decisão do usuário): `campoDoAtor` vem da REF `ultimoChaoDaMalha`, escrita no RENDER (a qualidade muda por prop e só o render a vê) com a MESMA condição do chão.
  assert(/const campoDoAtor = ultimoChaoDaMalha\.current/.test(ilha), 'o `useFrame` lê o chão do ator DA REF: `const campoDoAtor = ultimoChaoDaMalha.current` (a malha que o GPU desenha, não o campo bilinear)')
  assert(/const ultimoChaoDaMalha = useRef<ChaoDaMalha \| undefined>\(undefined\)/.test(ilha), '`Cena` declara a REF `ultimoChaoDaMalha = useRef<ChaoDaMalha | undefined>(undefined)`')
  assert(/ultimoChaoDaMalha\.current = chaoDaMalhaDoDesenho/.test(ilha) && ocorrencias(ilha, /ultimoChaoDaMalha\.current =/g) === 1, 'a REF é escrita UMA vez, no RENDER, com `chaoDaMalhaDoDesenho` (a MESMA condição do chão: chave ligada E campo pronto E o passo da qualidade em uso)')
  assert(/const chaoDaMalhaDoDesenho = chaoDaMalha\([^\n]*\)\s+const ultimoChaoDaMalha = useRef<ChaoDaMalha \| undefined>\(undefined\)\s+ultimoChaoDaMalha\.current = chaoDaMalhaDoDesenho/.test(ilha), 'no corpo do `Cena` a ordem é: DERIVAR `chaoDaMalhaDoDesenho`, DECLARAR a REF e ESCREVER a REF, nessa sequência e no render: quando o preset muda ela muda no mesmo quadro que a malha do terreno (a escrita na REF antes de derivar leria o chão do quadro anterior)')
  // O PASSO é o da QUALIDADE EM USO (`props.specQualidade.efetiva`): um passo fixo (`'ultra'`, ou um número) faria o ator pisar SEMPRE a malha de 1 m, e no Leve/Bonito (que desenham 4 m / 2 m) voltaria a ficar enterrado (o mutante A6 sobreviveu na 1ª rodada: nenhum contrato olhava a ORIGEM do passo neste arquivo).
  assert(/passoDaMalha\(props\.specQualidade\.efetiva\)/.test(ilha) && ocorrencias(ilha, /passoDaMalha\(/g) === 1, 'o passo da malha do ator vem de `props.specQualidade.efetiva` (a qualidade EM USO) e `passoDaMalha(` aparece UMA vez em `IlhaRua`: nenhum passo fixo')
  assert(!/passoDaMalha\(\s*['"`\d]/.test(ilha), '`passoDaMalha` nunca recebe um literal (`passoDaMalha(\'ultra\')`, `passoDaMalha(4)`): o passo é o da qualidade')
  assert(ocorrencias(ilha, /const campoDoAtor =/g) === 1, '`campoDoAtor` é definido UMA vez (uma segunda leitura poderia divergir da primeira no mesmo quadro)')
  assert(!/ultimoCampoDoRelevo\.current =/.test(ilha.replace(/ultimoCampoDoRelevo\.current = campoAgora/, '')), 'ninguém além do bloco da chave escreve `ultimoCampoDoRelevo.current` (a garantia de I1: chave desligada ⇒ `undefined`)')
  // o campo CRU `ultimoCampoDoRelevo.current` só serve ao que NÃO depende do preset gráfico (o clique, o alcance de edição, o rótulo): o ator, as câmeras e as tropas leem o chão da malha
  assert(!/desnivelDoAtor\(ultimoCampoDoRelevo\.current/.test(ilha.replace(/const heroiEye = [^\n]*/, '')), 'nenhum `desnivelDoAtor` lê o campo CRU (o ator pisa a malha): a única exceção é o `heroiEye` do alcance de edição, que fica no campo (o alcance é regra, não desenho)')

  // o herói principal: o desnível sobe o corpo; o `0,9 + heroi.y` de hoje continua sendo a base
  assert(/avatar\.current\.position\.set\(state\.heroi\.x, 0\.9 \+ state\.heroi\.y \+ desnivelDoAtor\(campoDoAtor, state\.heroi\.x, state\.heroi\.z, state\.heroi\.y\), state\.heroi\.z\)/.test(ilha), 'o herói é desenhado em `0,9 + heroi.y + desnivelDoAtor(campoDoAtor, heroi.x, heroi.z, heroi.y)`')
  // o grupo pai da tropa/dragão: o desnível entra UMA vez, aqui, e `TropasCena:433` NÃO muda (somar nos dois dobraria a altura do dragão)
  assert(/const yDaUnidade = possuidaAgora && state\.posse \? state\.posse\.y : 0\s+group\.position\.set\(unidade\.x, yDaUnidade \+ desnivelDoAtor\(campoDoAtor, unidade\.x, unidade\.z, yDaUnidade\), unidade\.z\)/.test(ilha), 'o grupo pai da unidade (dragão e possuída) soma `desnivelDoAtor(campoDoAtor, unidade.x, unidade.z, yDaUnidade)` UMA vez, sobre o `y` da posse (0 sem posse)')
  // os segmentos do dragão: posição ABSOLUTA do mundo (filhos de `Cena`, não do grupo da unidade) → o desnível é do ponto de CADA segmento, não do dragão
  assert(/segmento\.position\.set\(\s*ponto\.x,\s*\(esticado \? 0\.25 : 0\.95 \+ indice \* 0\.36\) \+ desnivelDoAtor\(campoDoAtor, ponto\.x, ponto\.z, 0\),\s*ponto\.z,?\s*\)/.test(ilha), 'cada segmento do dragão soma o desnível do SEU ponto: `desnivelDoAtor(campoDoAtor, ponto.x, ponto.z, 0)`')
  // os heróis secundários: atributo JSX avaliado no render; o campo é o ESTADO `campoDoRelevo` (a `Cena` re-renderiza quando ele muda, e o secundário não anda)
  assert(/position=\{\[hSec\.x, 0\.9 \+ hSec\.y \+ desnivelDoAtor\(PARTIDA\.relevo\.visual \? chaoDaMalhaDoDesenho : undefined, hSec\.x, hSec\.z, hSec\.y\), hSec\.z\]\}/.test(ilha), 'o herói secundário soma `desnivelDoAtor(PARTIDA.relevo.visual ? chaoDaMalhaDoDesenho : undefined, hSec.x, hSec.z, hSec.y)` (a mesma condição do chão, agora a MALHA)')

  // as três câmeras
  assert(/const vista = olharDesenho === 'imperio' \? cameraDoImperio\(campoDoAtor, props\.cam\.current\)/.test(ilha) || /cameraDoImperio\(campoDoAtor, props\.cam\.current\)/.test(ilha), 'o Império usa `cameraDoImperio(campoDoAtor, props.cam.current)`')
  assert(/posicaoDaCamera1p\(campoDoAtor, \{ x: atorX, y: atorY, z: atorZ \}, olhar\)/.test(ilha), 'a 1ª pessoa usa `posicaoDaCamera1p(campoDoAtor, { x: atorX, y: atorY, z: atorZ }, olhar)`')
  assert(/posicaoDaCamera3p\(campoDoAtor, \{ x: atorX, y: atorY, z: atorZ \}, olhar, yaw, dist\)/.test(ilha), 'a 3ª pessoa usa `posicaoDaCamera3p(campoDoAtor, { x: atorX, y: atorY, z: atorZ }, olhar, yaw, dist)`')
  assert(!/camera\.lookAt\(props\.cam\.current\.x, 0, props\.cam\.current\.z\)/.test(ilha), 'o `lookAt(cam.x, 0, cam.z)` fixo do Império SAIU (o alvo acompanha o chão)')
  // As 3 câmeras posicionam E apontam pela MESMA `vista`: se o `lookAt` voltasse a um valor fixo (0, ou `eyeY`), a câmera subiria com o morro e continuaria olhando para o plano, e o ângulo da
  // imagem mudaria a cada encosta, sem erro nenhum (o mutante I1 sobreviveu na 1ª rodada: nenhum teste olhava o `lookAt`).
  assert(ocorrencias(ilha, /camera\.position\.set\(vista\.pos\.x, vista\.pos\.y, vista\.pos\.z\)\s+camera\.lookAt\(vista\.alvo\.x, vista\.alvo\.y, vista\.alvo\.z\)/g) === 3, 'as 3 câmeras (Império, 1ª e 3ª pessoa) fazem `position.set(vista.pos…)` e `lookAt(vista.alvo…)` JUNTOS: nenhuma aponta para um valor fixo')
  assert(ocorrencias(ilha, /camera\.lookAt\(/g) === 3, 'só existem 3 `camera.lookAt(` em `IlhaRua` (as 3 câmeras): um quarto, fixo, quebraria o enquadramento')
  assert(!/PARTIDA\.eyeY \+ atorY/.test(ilha), 'a conta `eyeY + atorY` da câmera SAIU de `IlhaRua` (mora em `alturaDoAtor`: uma cópia aqui divergiria da testada)')
  // as botas, o flash, o anel e a sombra do herói são offsets LOCAIS do corpo (categoria C) e NÃO mudam: somar o terreno ali afundaria o herói
  assert(/<mesh position=\{\[0, -1\.335, 0\]\} rotation=\{\[-Math\.PI \/ 2, 0, 0\]\} raycast=\{semRaycast\}>/.test(ilha), 'a SOMBRA do herói (offset local −1,335) NÃO mudou')
  assert(/<mesh position=\{\[0, -1\.16, 0\]\} raycast=\{raycastCondicional\(Boolean\(props\.modoBloco\)\)\}>/.test(ilha), 'as BOTAS do herói (offset local −1,16) NÃO mudaram')
  assert(/<mesh position=\{\[0, -1\.325, 0\]\} rotation=\{\[-Math\.PI \/ 2, 0, 0\]\} raycast=\{semRaycast\}>/.test(ilha), 'o ANEL do herói (offset local −1,325) NÃO mudou')
  // `TropasCena` recebe o campo por REF OPCIONAL: sem ela é o jogo de hoje
  const blocoTropas = /<TropasCena([\s\S]*?)\n      \/>/.exec(ilha)?.[1] ?? ''
  assert(blocoTropas.length > 0, 'controle do instrumento: o recorte do `<TropasCena …/>` achou o elemento')
  assert(ocorrencias(ilha, /<TropasCena/g) === 1, '`TropasCena` é montada UMA vez')
  assert(/campoRef=\{ultimoChaoDaMalha\}/.test(blocoTropas), '`TropasCena` recebe `campoRef={ultimoChaoDaMalha}` (a MESMA ref que o herói e a câmera leem: uma segunda ref poderia divergir)')

  // ── B) `TropasCena.tsx` (a edição MÍNIMA autorizada: SÓ a linha do `baseY`) ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  assert(/\bcampoRef\?: React\.MutableRefObject<ChaoDoDesenho \| undefined>/.test(trp), '`TropasCena` declara `campoRef?: React.MutableRefObject<ChaoDoDesenho | undefined>` (OPCIONAL: sem ela é o jogo de hoje; aceita o campo cru e a malha)')
  assert(/import type \{ ChaoDoDesenho \} from '\.\/relevo\/alturaVisual'/.test(trp) && /import \{ desnivelDoAtor \} from '\.\/relevo\/alturaDoAtor'/.test(trp), '`TropasCena` importa o tipo `ChaoDoDesenho` e `desnivelDoAtor`')
  assert(ocorrencias(trp, /const baseY =/g) === 1, 'existe UM `baseY` (todo o posicionamento vertical da tropa passa por ele: 5 usos)')
  assert(/const chaoDaTropa = campoRef\?\.current\s+const baseY = Y_SOLO_VISUAL \+ \(possuidaAgora && state\.posse \? state\.posse\.y : 0\) \+ desnivelDoAtor\(chaoDaTropa, unidade\.x, unidade\.z, possuidaAgora && state\.posse \? state\.posse\.y : 0\)/.test(trp), '`baseY` = Y_SOLO_VISUAL + y da posse + desnivelDoAtor(chaoDaTropa, unidade.x, unidade.z, …), com `const chaoDaTropa = campoRef?.current` na linha de cima (o chão lido UMA vez por tropa por quadro)')
  assert(ocorrencias(trp, /campoRef\?\.current/g) === 1, '`campoRef?.current` é lido UMA vez, DENTRO do `useFrame` (não no render: a ref não dispara render): o chão da tropa vai numa constante `chaoDaTropa` que o `baseY` e as duas elevações dos discos usam')
  // OS DOIS DISCOS HORIZONTAIS (F2, 26/11, o usuário autorizou): a SOMBRA DE CONTATO (`CircleGeometry(0,46)`, `baseY + 0,015`) e o ANEL DE SELEÇÃO (`RingGeometry(0,44; 0,62)`, `baseY + 0,025`) ficavam RENTES ao chão e a inclinação sob um disco de 1,2 m os cortava:
  // medido em 3.000 tropas por preset contra a malha REAL do three, 60-65 % dos anéis e 65-69 % das sombras com parte enterrada. Sobem a MESMA elevação da patrulha (`elevacaoDoAnel` +0,20 m, `elevacaoDaLinha` +0,10 m), SÓ com relevo (+0 EXATO sem: I1).
  assert(/dummy\.position\.set\(unidade\.x, baseY \+ 0\.015 \+ elevacaoDaLinha\(chaoDaTropa\), unidade\.z\)/.test(trp), 'a SOMBRA de contato sobe `elevacaoDaLinha(chaoDaTropa)` (+0,10 m só com relevo): `baseY + 0.015 + elevacaoDaLinha(chaoDaTropa)`')
  assert(/dummy\.position\.set\(unidade\.x, baseY \+ 0\.025 \+ elevacaoDoAnel\(chaoDaTropa\), unidade\.z\)/.test(trp), 'o ANEL de seleção sobe `elevacaoDoAnel(chaoDaTropa)` (+0,20 m só com relevo): `baseY + 0.025 + elevacaoDoAnel(chaoDaTropa)`')
  assert(/import \{ elevacaoDaLinha, elevacaoDoAnel \} from '\.\/relevo\/segmentosDaPatrulha'/.test(trp), '`TropasCena` importa `elevacaoDoAnel` e `elevacaoDaLinha` de `./relevo/segmentosDaPatrulha` (as MESMAS funções provadas da patrulha, não uma cópia)')
  assert(ocorrencias(trp, /elevacaoDoAnel\(/g) === 1 && ocorrencias(trp, /elevacaoDaLinha\(/g) === 1, '`elevacaoDoAnel(` e `elevacaoDaLinha(` aparecem UMA vez cada em `TropasCena`: nenhum outro ponto subiu (as botas, o corpo, o halo e o rótulo NÃO sobem: só os dois discos horizontais)')
  assert(/dummy\.position\.set\(unidade\.x, baseY, unidade\.z\)/.test(trp) && /dummy\.position\.set\(unidade\.x, baseY \+ 0\.9, unidade\.z\)/.test(trp), 'o HALO do inimigo (`baseY`) e o ponto de 0,9 m (`baseY + 0.9`) NÃO mudaram: só os dois discos horizontais ganham elevação')
  // o DRAGÃO (linha 433 de hoje) NÃO muda: o grupo pai já recebe o desnível em `IlhaRua`; somar aqui dobraria a altura (a AUDITORIA corrigiu o handoff, que dizia ser «o herói possuído»)
  assert(/<group position=\{\[0, Y_SOLO_VISUAL, 0\]\}>/.test(trp), 'o grupo do DRAGÃO (`position={[0, Y_SOLO_VISUAL, 0]}`) NÃO mudou: o desnível dele entra no grupo PAI, em `IlhaRua`')
  assert(ocorrencias(trp, /desnivelDoAtor/g) === 2, '`desnivelDoAtor` aparece 2 vezes em `TropasCena` (o import e o `baseY`): nenhum outro ponto somou o terreno')
  // A ORDEM DE DESENHO DO ANEL DE SELEÇÃO (F2, 26/11, o usuário autorizou «só com o relevo ligado»). FOTO `12-comparacao-anel.png`: com o relevo LIGADO o anel (opaco, `depthWrite={false}`) NUNCA aparecia, com ou sem a elevação, e no jogo de hoje aparece;
  // o experimento 2A (cópia temporária) mostrou que SÓ o `renderOrder={5}` (SEM `transparent`) o traz de volta. Fica atrás da chave: sem relevo o valor é 0, o de hoje (I1).
  const anel = /<instancedMesh ref=\{instAnelRef\}([^>]*)>/.exec(trp)?.[1] ?? ''
  assert(anel.length > 0, 'controle do instrumento: o recorte do `<instancedMesh ref={instAnelRef} …>` achou o elemento')
  assert(/renderOrder=\{PARTIDA\.relevo\.visual \? 5 : 0\}/.test(anel), 'o ANEL de seleção tem `renderOrder={PARTIDA.relevo.visual ? 5 : 0}`: com o relevo ligado é desenhado DEPOIS da névoa (que cobria o anel opaco), sem relevo é 0, o de hoje (I1)')
  assert(ocorrencias(trp, /renderOrder=/g) === 1, '`renderOrder` aparece UMA vez em `TropasCena` (só o anel de seleção): a sombra de contato é transparente e já aparecia, e as botas e o corpo NÃO mudam de ordem')
  assert(!/<meshBasicMaterial color="#facc15"[^>]*transparent/.test(trp), 'o material do anel NÃO ganhou `transparent` (o experimento 2A mostrou que só o `renderOrder` basta, e `transparent` muda a mistura de cores do anel)')
}

/**
 * CONTRATO DE TEXTO da LIGAÇÃO do CLIQUE contra o terreno (F2, Task 6, 25/11/2026). `soloNoNdc` (plano 0) e `soloNoChao` (plano −0,45) viviam como interseção com um plano; agora chamam `raioContraTerreno`,
 * provado no Node (`raioTerreno.test.ts`). O que o Node não vê é a LIGAÇÃO, e há duas armadilhas conhecidas, cada uma silenciosa:
 *  1. `soloNoChao` é guardada em `callbacksCenaRef = useRef({ …, soloNoChao })` e CAPTURA a função do PRIMEIRO render: se ela lesse o ESTADO `campoDoRelevo`, leria `undefined` para sempre (o clique ignoraria o
 *     relevo sem erro nenhum). Por isso as duas leem a REF `ultimoCampoDoRelevo.current` (a mesma do ator), que o `useFrame` mantém.
 *  2. Os DOIS planos de hoje (0 e −0,45) convergem para o mesmo ponto COM campo: cada chamada tem de continuar passando o SEU plano para a função (a chave desligada não pode mudar um bit).
 */
export function contratoDaLigacaoDoClique(cena: string): void {
  const ilha = soCodigo(cena)
  assert(/import \{[^}]*\braioContraTerreno\b[^}]*\} from '\.\/relevo\/raioTerreno'/.test(ilha), '`IlhaRua` importa `raioContraTerreno` de `./relevo/raioTerreno`')
  const ndc = /const soloNoNdc = \(ndcX: number, ndcY: number, planoY = 0\) => \{([\s\S]*?)\n  \}\n/.exec(ilha)?.[1] ?? ''
  const chao = /const soloNoChao = \(clientX: number, clientY: number\) => \{([\s\S]*?)\n  \}\n/.exec(ilha)?.[1] ?? ''
  assert(ndc.length > 0 && chao.length > 0, 'controle do instrumento: o recorte achou `soloNoNdc` e `soloNoChao` (cada uma até o `}` da indentação dela)')
  for (const [nome, corpo, plano] of [['soloNoNdc', ndc, 'planoY'], ['soloNoChao', chao, 'Y_SOLO_VISUAL']] as const) {
    assert(/raioContraTerreno\(ultimoCampoDoRelevo\.current, \{ origem: raycaster\.ray\.origin, direcao: raycaster\.ray\.direction \}, /.test(corpo), `${nome} chama \`raioContraTerreno(ultimoCampoDoRelevo.current, { origem, direcao }, …)\`: o campo vem da REF (a função é capturada no 1º render pelo \`callbacksCenaRef\`; o ESTADO ficaria velho)`)
    assert(new RegExp(`raioContraTerreno\\([^)]*\\}, ${plano}, `).test(corpo), `${nome} passa o SEU plano (\`${plano}\`): sem campo o resultado é o plano de hoje, bit a bit`)
    assert(!/campoDoRelevo/.test(corpo), `${nome} NÃO lê o ESTADO \`campoDoRelevo\` (fica \`undefined\` para sempre numa função capturada no 1º render)`)
    assert(!/\(planoY - raycaster|\(-0\.45 - raycaster/.test(corpo), `${nome} não repete a conta do plano (mora em \`raioTerreno.ts\`, testada)`)
  }
  assert(/return \{ x: acerto\.x, y: acerto\.y, z: acerto\.z, t: acerto\.t \}/.test(ndc), '`soloNoNdc` devolve `{ x, y, z, t }` (o editor de blocos lê `chao.t` e `chao.y`)')
  assert(/return \{ x: acerto\.x, z: acerto\.z \}/.test(chao), '`soloNoChao` devolve `{ x, z }` (a forma de hoje: nenhum chamador lê `t`)')
  assert(ocorrencias(ilha, /\(planoY - raycaster\.ray\.origin\.y\)/g) === 0, 'a interseção com o plano de `soloNoNdc` SAIU de `IlhaRua` (uma cópia divergiria da testada)')

  // O ALCANCE DE EDIÇÃO DE BLOCOS (medido em `medir-alcance-de-edicao.mjs`, 5 relevos reais, 15 000 cliques): com o relevo ligado a câmera e o clique sobem com o terreno, mas o olho do herói do editor
  // (`heroiEye`) e o `0` do chão do alcance não subiam: o alcance de 7 m errava em média 0,03–0,12 m (até 1,03 m) e DECIDIA ERRADO se o ponto estava ao alcance em 0,4–2,1 % dos cliques. O conserto é no
  // DESENHO e não muda a regra (`alcanceEdicaoBlocos` continua 7 m): o olho sobe com o desnível do herói e o chão do alcance passa a ser a altura do ponto clicado, os dois no referencial do desenho.
  assert(/const heroiEye = \{ x: state\.heroi\.x, y: PARTIDA\.eyeY \+ state\.heroi\.y \+ desnivelDoAtor\(ultimoCampoDoRelevo\.current, state\.heroi\.x, state\.heroi\.z, state\.heroi\.y\), z: state\.heroi\.z \}/.test(ilha), '`heroiEye` soma `desnivelDoAtor(ultimoCampoDoRelevo.current, …)`: o olho do editor está onde a câmera de 1ª pessoa está')
  assert(/Math\.hypot\(chao\.x - heroiEye\.x, chao\.y - heroiEye\.y, chao\.z - heroiEye\.z\) > PARTIDA\.alcanceEdicaoBlocos/.test(ilha), 'o alcance mede até a ALTURA do ponto clicado (`chao.y`), não até um `0` fixo')
  assert(!/0 - heroiEye\.y/.test(ilha), 'o `0 − heroiEye.y` do chão fixo SAIU do alcance de edição')
}

/**
 * CONTRATO DE TEXTO do GANCHO DE DEV `irPara` (F2, 25/11/2026, pedido do usuário). A lógica (`irParaMapa`) está provada no Node (`irParaMapa.test.ts`); o que o Node não vê é o GANCHO: ele só pode existir em
 * DESENVOLVIMENTO, senão o jogo PUBLICADO ganharia um teleporte (um risco de trapaça e de estado corrompido). A guarda `import.meta.env.DEV` do efeito inteiro já existe; este contrato trava que o `irPara` mora
 * DENTRO dela, usa a função testada (e não uma cópia), e atualiza o estado pelo MESMO caminho que `spawnarTropas` (`atlasRef`, `sim`, `setHud`), senão o jogo ficaria com o herói num quadrado e a tela em outro.
 */
export function contratoDoGanchoIrPara(cena: string): void {
  const ilha = soCodigo(cena)
  const bench = /useEffect\(\(\) => \{\s+if \(!import\.meta\.env\.DEV \|\| typeof window === 'undefined'\) return([\s\S]*?)delete w\.__ILHA_BENCH__/.exec(ilha)?.[1] ?? ''
  assert(bench.length > 0, 'controle do instrumento: o recorte achou o `useEffect` do `__ILHA_BENCH__` (a guarda `import.meta.env.DEV` até o `delete`)')
  assert(/import \{ irParaMapa \} from '\.\/relevo\/irParaMapa'/.test(ilha), '`IlhaRua` importa `irParaMapa` de `./relevo/irParaMapa` (a função provada no Node)')
  assert(ocorrencias(ilha, /irParaMapa\(/g) === 1, '`irParaMapa(` é chamada UMA vez em `IlhaRua`, e é dentro do gancho de DEV')
  assert(/irParaMapa\(/.test(bench), '`irParaMapa` é chamada DENTRO do `useEffect` guardado por `import.meta.env.DEV`: o jogo publicado NÃO ganha o teleporte')
  assert(/irPara: \(i: number, j: number, x = 0, z = 0\) => \{/.test(bench), 'o gancho se chama `irPara(i, j, x = 0, z = 0)`')
  assert(/atlasRef\.current = irParaMapa\(atlasRef\.current, i, j, x, z\)/.test(bench), 'o gancho escreve `atlasRef.current = irParaMapa(atlasRef.current, i, j, x, z)`')
  assert(/sim\.current = estadoCena\(atlasRef\.current\)/.test(bench), 'e relê a cena: `sim.current = estadoCena(atlasRef.current)` (senão a tela fica no quadrado antigo)')
  assert(/setHud\(sim\.current\)/.test(bench), 'e atualiza o HUD: `setHud(sim.current)` (como `spawnarTropas`)')
  assert(/irPara: \(i: number, j: number, x\?: number, z\?: number\) => \{ i: number; j: number; x: number; z: number \}/.test(bench) || /irPara: \(i: number, j: number, x\?: number, z\?: number\) => /.test(bench), 'o tipo do gancho está declarado no `__ILHA_BENCH__?:`')
  assert(/delete w\.__ILHA_BENCH__/.test(ilha), 'o gancho é REMOVIDO ao desmontar (nenhum vazamento entre partidas)')
}

export function run(cena?: string, tropas?: string): void {
  if (cena !== undefined && tropas !== undefined) contratoDaLigacaoDoAtor(cena, tropas)
  if (cena !== undefined) contratoDaLigacaoDoClique(cena)
  if (cena !== undefined) contratoDoGanchoIrPara(cena)
}
