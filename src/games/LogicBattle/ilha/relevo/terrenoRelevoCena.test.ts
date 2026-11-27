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
 * CONTRATO DE TEXTO do terreno com relevo (F2, Task 3, 25/11/2026). O componente vive no React e o runner roda no Node, sem GPU: o que o Node pode travar é a FORMA (as ligações que, se faltarem, o
 * jogador só descobre na foto). Cada linha abaixo é uma ligação cuja ausência é um defeito conhecido:
 *  - o clique no chão TEM de chegar na malha (sem `onPointerDown`/`onClick` o jogo para de mover tropas);
 *  - a geometria é DESCARTADA ao sair/trocar (o vazamento de geometrias de ontem teve a mesma forma);
 *  - a injeção do shader fica em try/catch: se o `three` renomear um chunk o terreno cai no material SEM rocha e avisa, em vez de derrubar o jogo (a âncora que some é o risco 11);
 *  - a altura da malha é `alturaEm`, e o grupo fica em `Y_SOLO_VISUAL`: campo plano ⇒ chão em −0,45 EXATOS (I1);
 *  - desligada a chave, ou antes de o campo chegar, o chão é o PLANO de hoje: nunca um buraco.
 */
export function contratoDoTerrenoRelevo(terreno: string): void {
  const codigo = soCodigo(terreno)
  assert(/export const TerrenoRelevoCena: React\.FC<TerrenoRelevoCenaProps>/.test(codigo), 'o componente `TerrenoRelevoCena` é exportado com o tipo das suas props')
  assert(/readonly campo: CampoRelevo/.test(codigo) && /readonly texturas: PacoteTexturasBioma \| null/.test(codigo) && /readonly spec: SpecQualidadeGrafica/.test(codigo), 'as props trazem o campo, as texturas do bioma e a spec de qualidade')
  assert(/readonly onPointerDown:/.test(codigo) && /readonly onClick:/.test(codigo), 'as props trazem os dois eventos do chão (`onPointerDown`, `onClick`), os mesmos do TerrenoBiomaCena')
  assert(/onPointerDown=\{onPointerDown\}/.test(codigo) && /onClick=\{onClick\}/.test(codigo), 'a malha REPASSA o clique e o arrasto: sem isso o jogador não move mais as tropas')
  assert(/receiveShadow=\{sombrasAtivas\}|receiveShadow=\{spec\.sombrasAtivas\}/.test(codigo), 'a malha recebe sombra conforme a qualidade')
  // a geometria vem das funções puras testadas, e por `useMemo` (uma geometria nova a cada quadro seria um vazamento por quadro)
  assert(/geometriaDoTerreno\(campo, passoDaMalha\(spec\.efetiva\)\)/.test(codigo), 'a geometria vem de `geometriaDoTerreno(campo, passoDaMalha(spec.efetiva))` (as funções puras provadas), não de uma cópia')
  assert(/const geometria = useMemo\(/.test(codigo), 'a geometria é criada num `useMemo` (estável entre renders)')
  assert(/geometria\.dispose\(\)/.test(codigo) && /useEffect\(\(\) => \{[\s\S]*?return \(\) => \{[\s\S]*?geometria\.dispose\(\)/.test(codigo), 'a geometria é DESCARTADA no cleanup de um efeito (trocar de qualidade ou de quadrado sem isso vaza geometrias)')
  assert(/new BufferGeometry\(\)/.test(codigo) && /setAttribute\('position'/.test(codigo) && /setAttribute\('normal'/.test(codigo) && /setAttribute\('uv'/.test(codigo) && /setIndex\(/.test(codigo), 'a geometria recebe posição, normal, UV e índices')
  // o grupo fica em Y_SOLO_VISUAL: a malha guarda a altura acima da rua; o chão plano é −0,45 exatos
  assert(/position=\{\[0, Y_SOLO_VISUAL, 0\]\}/.test(codigo) && /import \{[^}]*\bY_SOLO_VISUAL\b[^}]*\} from '\.\/suporteFundacao'/.test(codigo), 'o terreno fica em `Y_SOLO_VISUAL` (campo plano ⇒ chão em −0,45 exatos, I1)')
  // ── As 3 lacunas que a MUTACAO TOTAL achou em 26/11 (Task 9): `terreno-relevo-cena` T6, T8 e T15 SOBREVIVIAM porque cada contrato abaixo era «a ocorrencia de QUALQUER lugar do arquivo» e o arquivo tem
  // DUAS malhas (o terreno e a saia): a outra satisfazia o regex. Cada asserção agora isola o BLOCO CERTO, como `blocoDaSaia` já fazia para a saia.
  // T6 (a posicao do terreno em `[0, 0, 0]`, o chao do relevo 0,45 m acima do certo): o `<mesh name="terreno-relevo">` tem de estar em `Y_SOLO_VISUAL`.
  const blocoDoTerreno = /<mesh\s+name="terreno-relevo"\s([\s\S]*?)\/>/.exec(codigo)?.[1] ?? ''
  assert(blocoDoTerreno.length > 0, 'achei o bloco `<mesh name="terreno-relevo" ... />` (o terreno, NAO a saia)')
  assert(/position=\{\[0, Y_SOLO_VISUAL, 0\]\}/.test(blocoDoTerreno), 'o TERRENO (e nao so a saia) fica em `Y_SOLO_VISUAL`: sem isso o chao do relevo sobe 0,45 m (campo plano ⇒ chao em −0,45 exatos, I1)')
  assert(/geometry=\{geometria\}/.test(blocoDoTerreno) && /material=\{material\}/.test(blocoDoTerreno), 'o terreno usa a geometria e o material DELE (nao os da saia)')
  // T15 (sem os indices da malha do terreno: o chao some, 0 triangulos): o `setIndex` tem de estar dentro do `useMemo` da GEOMETRIA DO TERRENO, nao so no da saia.
  const construcaoDoTerreno = codigo.slice(codigo.indexOf('const geometria = useMemo('), codigo.indexOf('}, [campo, spec.efetiva])', codigo.indexOf('const geometria = useMemo(')))
  assert(construcaoDoTerreno.length > 40 && !/saiaDoTerreno/.test(construcaoDoTerreno), 'isolei a construcao da geometria do TERRENO (nao a da saia)')
  assert(/setIndex\(new Uint32BufferAttribute\(g\.indices, 1\)\)/.test(construcaoDoTerreno), 'a malha do TERRENO recebe os indices (`g.indices`): sem eles o chao nao tem triangulos e some')
  // T8 (o `console.warn` da rocha calado): o RISCO 11 («a ancora que o three renomeou») so e visivel se a falha AVISAR. As DUAS injecoes (rocha e nevoa) tem de ter o aviso, cada uma no SEU catch.
  const catchDaRocha = /try \{\s*const injetado = injetarMisturaDeRocha[\s\S]*?\} catch \(erro\) \{([\s\S]*?)\}\s*\}/.exec(codigo)?.[1] ?? ''
  assert(/console\.warn\(/.test(catchDaRocha) && /rocha/.test(catchDaRocha), 'a falha da injecao da ROCHA AVISA na console (`console.warn` no catch dela): silencio seria o risco 11')
  const catchDaNevoa = /try \{\s*const injetado = injetarNevoaNoTerreno[\s\S]*?\} catch \(erro\) \{([\s\S]*?)\}\s*\}/.exec(codigo)?.[1] ?? ''
  assert(/console\.warn\(/.test(catchDaNevoa) && /névoa/.test(catchDaNevoa), 'a falha da injecao da NEVOA AVISA na console (`console.warn` no catch dela)')
  // a injeção do shader: em try/catch, com a rocha do bioma
  assert(/onBeforeCompile/.test(codigo) && /injetarMisturaDeRocha\(/.test(codigo), 'o material injeta a rocha por `onBeforeCompile` com `injetarMisturaDeRocha`')
  assert(/try \{[\s\S]*?injetarMisturaDeRocha\([\s\S]*?\} catch/.test(codigo), 'a injeção está num try/catch: âncora perdida NÃO derruba o jogo (o terreno fica sem rocha e avisa)')
  assert(/console\.warn\(/.test(codigo), 'e o catch AVISA na console (silêncio seria o defeito do risco 11)')
  assert(/uRochaMap/.test(codigo) && /texturas\?\.rocha\.map/.test(codigo), 'a rocha vem de `texturas.rocha.map` (a textura que o pool já gera)')
  assert(/uRochaEscala/.test(codigo) && /ESCALA_DA_ROCHA/.test(codigo), 'a escala da rocha vem de `ESCALA_DA_ROCHA` (número de arte, fixado pela foto)')
  // A NÉVOA NO CHÃO (F2, passo (a3)/(a4), 25/11): a decisão do usuário. A névoa injetada ENTRA no mesmo `onBeforeCompile` da rocha, em try/catch PRÓPRIO (se uma falhar a outra continua: a rocha sem
  // névoa e a névoa sem rocha são aceitáveis; as duas caladas, não). As uniforms da névoa são objetos `{ value }` do PRÓPRIO terreno, copiados das uniforms da `NevoaPintada` a cada quadro (a
  // `CenaBiomaVisual` monta ANTES da `NevoaPintada` em `Cena`, então no 1º compile a névoa ainda não existe: o terreno não pode depender da ordem de montagem). O ESTADO SEGURO inicial é «tudo coberto»
  // (a opacidade de «nunca visto» em 0,94, não 0): por um quadro o erro é escurecer demais, nunca revelar o que o jogador não viu.
  assert(/injetarNevoaNoTerreno\(/.test(codigo) && /from '\.\.\/relevo\/nevoaNoTerreno'/.test(codigo), 'o material injeta a névoa com `injetarNevoaNoTerreno` (de `../relevo/nevoaNoTerreno`)')
  assert((codigo.match(/try \{/g) ?? []).length >= 2 && (codigo.match(/\} catch \(/g) ?? []).length >= 2, 'a rocha e a névoa têm cada uma o seu try/catch (uma falhar não derruba a outra)')
  assert(/console\.warn\([^)]*névoa/.test(codigo), 'o catch da NÉVOA também AVISA na console (silêncio seria o risco 11, e aqui o chão inteiro vazaria o que não foi visto)')
  assert(/uOpNunca: \{ value: 0\.94 \}/.test(codigo), 'o estado inicial da névoa é «tudo coberto» (`uOpNunca` 0,94): um erro por 1 quadro escurece demais, nunca revela')
  assert(/shader\.uniforms\.uMapa = /.test(codigo) && /shader\.uniforms\.uTempo = /.test(codigo) && /shader\.uniforms\.uCorNunca = /.test(codigo) && /shader\.uniforms\.uOpNunca = /.test(codigo) && /shader\.uniforms\.uCorJa = /.test(codigo) && /shader\.uniforms\.uOpJa = /.test(codigo), 'o shader recebe as SEIS uniforms da névoa (`uMapa`, `uTempo`, `uCorNunca`, `uOpNunca`, `uCorJa`, `uOpJa`), com os MESMOS nomes do plano')
  assert(/nevoaUniforms/.test(codigo) && /useFrame\(/.test(codigo), 'o terreno COPIA as uniforms da névoa a cada quadro (`useFrame` + `nevoaUniforms`): a `NevoaPintada` é quem as atualiza')
  // a chave do material: trocar de bioma/qualidade recompila (o three guarda o programa pela chave)
  assert(/customProgramCacheKey/.test(codigo), 'o material declara `customProgramCacheKey`: sem ele o three reutiliza o programa de um material SEM a injeção')
  assert(/customProgramCacheKey = \(\) => 'terreno-relevo-nevoa-v1'/.test(codigo), 'a chave do programa mudou para `terreno-relevo-nevoa-v1`: o shader agora tem a névoa, e a chave `terreno-relevo-v1` (sem ela) não pode ser reaproveitada por um cache velho')
  // Lacunas que a mutação de 25/11 achou (T16, T17): a injeção só vale COM a textura da rocha (`if (rocha)`: invertida, ela injetaria sem sampler e deixaria o declive PRETO) e o MATERIAL também é
  // descartado ao sair (só a geometria era conferida, e cada troca de bioma/textura vazaria um material na GPU).
  // A forma mudou com a névoa (25/11): a rocha ficou DENTRO do `onBeforeCompile` (que agora existe sempre, porque a névoa não depende das texturas), então o `if (rocha)` envolve só a injeção da rocha.
  // O requisito é o mesmo: sem a textura da rocha o sampler ficaria vazio e o declive, PRETO; e a injeção da rocha tem de estar DENTRO desse `if`, e a da névoa FORA dele.
  assert(/const rocha = texturas\?\.rocha\.map/.test(codigo), 'a rocha vem de `const rocha = texturas?.rocha.map`')
  assert(/if \(rocha\) \{\s*try \{\s*const injetado = injetarMisturaDeRocha\(/.test(codigo), 'a injeção da ROCHA só acontece COM a textura dela: `if (rocha) { try { … injetarMisturaDeRocha(` (sem textura o sampler ficaria vazio e o declive, preto)')
  assert(codigo.indexOf('injetarNevoaNoTerreno(shader') > codigo.indexOf('injetarMisturaDeRocha(shader'), 'a névoa é injetada DEPOIS da rocha, em try/catch próprio, FORA do `if (rocha)` (não depende das texturas)')
  assert(!/if \(rocha\) \{[^}]*injetarNevoaNoTerreno/.test(codigo.replace(/\s+/g, ' ')), 'a névoa NÃO fica dentro do `if (rocha)`: sem as texturas o chão ainda não pode vazar o que o jogador não viu')
  assert(/useEffect\(\(\) => \{[\s\S]*?return \(\) => \{\s*material\.dispose\(\)\s*\}\s*\}, \[material\]\)/.test(codigo), 'o MATERIAL também é descartado no cleanup do seu efeito (`material.dispose()` com a dependência `[material]`)')
  assert(/useEffect\(\(\) => \{\s*return \(\) => \{\s*geometria\.dispose\(\)\s*\}\s*\}, \[geometria\]\)/.test(codigo), 'a geometria é descartada num efeito CUJA dependência é a própria geometria (`[geometria]`): trocar de qualidade descarta a antiga')
  // A SAIA que fecha o «fio azul» (25/11): uma parede em cada aresta, da quina até o plano da névoa. Medido com a câmera real: sem ela, 7/7/8 px de fio; com ela, 0/0/0; curta (até −0,30), 4/4/5.
  // O TOPO é a altura do plano da névoa (`ALTURA_DO_PLANO`, a MESMA constante que posiciona o plano), nunca um número solto: mexer na altura do plano sem a saia traria o fio de volta, sem erro.
  assert(/import \{[^}]*\bsaiaDoTerreno\b[^}]*\} from '\.\.\/relevo\/geometriaDoTerreno'/.test(codigo), 'o terreno importa `saiaDoTerreno` (a função pura provada em geometriaDoTerreno.test)')
  assert(/import \{[^}]*\bALTURA_DO_PLANO\b[^}]*\} from '\.\/NevoaPintada'/.test(codigo), 'o terreno importa `ALTURA_DO_PLANO` de `./NevoaPintada` (a MESMA constante que posiciona o plano da névoa)')
  assert(/saiaDoTerreno\(campo, passoDaMalha\(spec\.efetiva\), ALTURA_DO_PLANO\)/.test(codigo), 'a saia é montada com o MESMO passo da malha e o topo `ALTURA_DO_PLANO`: nenhum número solto')
  // o topo NÃO é um literal: o regex olha o ÚLTIMO argumento, depois do `)` do `passoDaMalha(...)`. CONTROLE POSITIVO do instrumento (senão `[^)]*` parando no 1º `)` o tornaria cego): ele acha o literal num texto de exemplo.
  const ultimoArgumentoLiteral = /saiaDoTerreno\(campo, passoDaMalha\([^)]*\),\s*-?[0-9.]+\s*\)/
  assert(ultimoArgumentoLiteral.test('saiaDoTerreno(campo, passoDaMalha(spec.efetiva), 0.33)'), 'controle do instrumento: o regex acha um topo literal num exemplo')
  assert(!ultimoArgumentoLiteral.test(codigo), 'o topo da saia não é um literal numérico')
  assert(/const geometriaDaSaia = useMemo\(/.test(codigo), 'a geometria da saia é criada num `useMemo` (estável entre renders)')
  assert(/useEffect\(\(\) => \{\s*return \(\) => \{\s*geometriaDaSaia\.dispose\(\)\s*\}\s*\}, \[geometriaDaSaia\]\)/.test(codigo), 'a geometria da saia é DESCARTADA no cleanup do seu efeito (sem isso cada troca de qualidade ou de quadrado vazaria uma geometria)')
  assert(/name="terreno-relevo-saia"/.test(codigo) && /geometry=\{geometriaDaSaia\}/.test(codigo), 'a saia é um `<mesh name="terreno-relevo-saia">` com a geometria dela')
  // a saia usa o MESMO material do terreno (com a névoa e a rocha injetadas): um material próprio não teria a névoa e o fio voltaria como uma faixa SEM névoa
  const blocoDaSaia = /<mesh\s+name="terreno-relevo-saia"([\s\S]*?)\/>/.exec(codigo)?.[1] ?? ''
  assert(/material=\{material\}/.test(blocoDaSaia), 'a saia usa o MESMO `material` do terreno (com a névoa injetada)')
  assert(/raycast=\{semRaycast\}/.test(blocoDaSaia), 'a saia NUNCA captura o clique (`raycast={semRaycast}`): o clique segue para o chão')
  assert(/position=\{\[0, Y_SOLO_VISUAL, 0\]\}/.test(blocoDaSaia), 'a saia fica em `Y_SOLO_VISUAL`, como o terreno (as duas usam as mesmas coordenadas locais)')
  assert(!/onClick=|onPointerDown=/.test(blocoDaSaia), 'a saia não tem `onClick` nem `onPointerDown`')
  assert(/malha\.computeVertexNormals\(\)/.test(codigo.slice(codigo.indexOf('const geometriaDaSaia'), codigo.indexOf('}, [campo, spec.efetiva])', codigo.indexOf('const geometriaDaSaia')))), 'a geometria da saia calcula as normais (`computeVertexNormals`): sem elas o `MeshStandardMaterial` sombreia a parede de forma indefinida')
}

/**
 * CONTRATO DE TEXTO da INTEGRAÇÃO em `CenaBiomaVisual.tsx` (F2, Task 3). A regra que o jogador sente: com a chave desligada, ou antes de o campo chegar (a geração fatiada leva ~19 quadros), o chão é
 * o PLANO de hoje; só quando a malha existe o plano some (`semPlano`). Um `semPlano` calculado só pela chave deixaria o jogador sem chão por ~19 quadros a cada quadrado novo.
 */
export function contratoDaIntegracaoDoRelevo(cenaBioma: string): void {
  const codigo = soCodigo(cenaBioma)
  assert(/PARTIDA\.relevo\.visual/.test(codigo), 'a cena lê a chave `PARTIDA.relevo.visual`')
  assert(/<TerrenoRelevoCena/.test(codigo), 'a cena monta o `TerrenoRelevoCena`')
  assert(/campoDoRelevo/.test(codigo), 'a cena recebe o campo do quadrado por uma prop `campoDoRelevo` (o `RelevoDoMundo` mora em `Cena`, não aqui)')
  assert(/const relevoVisivel = PARTIDA\.relevo\.visual && campoDoRelevo !== undefined/.test(codigo), 'o relevo só aparece com a chave LIGADA E o campo PRONTO: `const relevoVisivel = PARTIDA.relevo.visual && campoDoRelevo !== undefined`')
  assert(/semPlano=\{relevoVisivel\}/.test(codigo), 'o plano do chão só some quando o relevo está VISÍVEL (`semPlano={relevoVisivel}`): antes do campo chegar o plano de hoje fica, nunca um buraco')
  assert(/\{relevoVisivel && campoDoRelevo && \(\s*<TerrenoRelevoCena/.test(codigo), 'a malha só é montada com o relevo visível e o campo presente (e a checagem do campo estreita o tipo)')
  assert((codigo.match(/<TerrenoBiomaCena/g) ?? []).length === 1, 'o `TerrenoBiomaCena` continua montado UMA vez, sempre (a estrada, a praça e os marcos não dependem do relevo)')
  assert((codigo.match(/<TerrenoRelevoCena/g) ?? []).length === 1, 'o `TerrenoRelevoCena` é montado uma vez')
  // Lacunas que a mutação de 25/11 achou (C8, C9, C11). Cada uma é um defeito que NÃO derruba o jogo e só aparece na foto: a estrada e a praça SUMINDO com o relevo ligado (C9: o `TerrenoBiomaCena`
  // atrás de `!relevoVisivel`), a malha desenhando o campo ERRADO (C8: o `as never` engana o `tsc`) e o clique no morro MORTO (C11: um `onClick` vazio).
  // SOLTO: na linha do `<TerrenoBiomaCena` só há espaço antes dele (nada de `&&`, `?`, `{` ou `(` na frente: ali ele estaria atrás de uma condição)
  const linhaDoTerreno = codigo.split('\n').find((l) => l.includes('<TerrenoBiomaCena')) ?? ''
  assert(/^\s*<TerrenoBiomaCena\s*$/.test(linhaDoTerreno.replace(/\r/g, '')), `o \`<TerrenoBiomaCena\` está SOLTO no JSX, sozinho na linha e sem condição na frente (a estrada, a praça e os marcos aparecem SEMPRE; só o plano dele some, por \`semPlano\`). Veio: «${linhaDoTerreno.trim()}»`)
  const bloco = /<TerrenoRelevoCena([\s\S]*?)\/>/.exec(codigo)?.[1] ?? ''
  assert(/campo=\{campoDoRelevo\}/.test(bloco), 'a malha recebe EXATAMENTE o campo da cena: `campo={campoDoRelevo}` (um `as never` ou outro campo desenharia o relevo errado e o `tsc` não veria)')
  assert(/onPointerDown=\{onPointerDownGround\}/.test(bloco) && /onClick=\{onClickGround\}/.test(bloco), 'a malha recebe o clique e o arrasto do CHÃO (`onPointerDownGround`, `onClickGround`): um `onClick` vazio mataria o clique no morro')
  assert(/texturas=\{texturasBioma\}/.test(bloco) && /spec=\{spec\}/.test(bloco) && /bioma=\{state\.bioma\}/.test(bloco), 'a malha recebe as texturas, a spec e o bioma da cena')
  assert(/readonly nevoaUniforms\?: React\.MutableRefObject<Record<string, \{ value: unknown \}> \| null>/.test(codigo), '`CenaBiomaVisual` recebe `nevoaUniforms` como REF opcional (a cena de antes, sem relevo, não passa e nada muda)')
  assert(/nevoaUniforms=\{nevoaUniforms\}/.test(bloco), 'a malha recebe `nevoaUniforms={nevoaUniforms}` (a MESMA ref, adiante)')
  // OS PROPS SEGUEM O MESMO CHÃO (Task 4, 25/11): `PropsBiomaInstanced` recebe `campo` com a MESMA condição do chão (`relevoVisivel`): se o chão ainda é o plano (campo não chegou, ou a chave está desligada)
  // os props ficam no plano, nunca flutuam nem afundam em relação a ele. Uma prop opcional ESQUECIDA compila, passa o teste do componente e o jogo ignora o relevo: sem este contrato ninguém veria.
  const blocoDosProps = /<PropsBiomaInstanced([\s\S]*?)\/>/.exec(codigo)?.[1] ?? ''
  assert((codigo.match(/<PropsBiomaInstanced/g) ?? []).length === 1, 'os props de bioma são montados UMA vez')
  // OS PROPS PISAM A MALHA (F2, 26/11, decisão do usuário): a cena DERIVA o chão da malha do campo e do passo da qualidade em uso (`spec.efetiva`) e o entrega aos props; o terreno continua com o campo CRU (a malha é construída dele).
  assert(/const chaoDaMalhaDaCena = chaoDaMalha\(relevoVisivel \? campoDoRelevo : undefined, passoDaMalha\(spec\.efetiva\)\)/.test(codigo), 'a cena deriva `chaoDaMalhaDaCena = chaoDaMalha(relevoVisivel ? campoDoRelevo : undefined, passoDaMalha(spec.efetiva))`: a MESMA condição do chão e o passo da qualidade EM USO (um passo fixo enterraria os props no Leve)')
  assert(/campo=\{chaoDaMalhaDaCena\}/.test(blocoDosProps), 'os props recebem `campo={chaoDaMalhaDaCena}`: o chão da MALHA que o GPU desenha (a condição do chão já está dentro dele: sem campo é `undefined`)')
  assert(!/passoDaMalha\(\s*['"`\d]/.test(codigo), '`passoDaMalha` nunca recebe um literal: o passo é o da qualidade')
  assert(!/campo=\{campoDoRelevo\}/.test(blocoDosProps) && !/campo=\{relevoVisivel \? campoDoRelevo : undefined\}/.test(blocoDosProps), 'os props NÃO recebem o campo cru (`campo={campoDoRelevo}` nem `relevoVisivel ? campoDoRelevo : undefined`): ficariam no campo bilinear e enterrados pela malha no Leve')
}

/**
 * CONTRATO DE TEXTO da ÁGUA na cena (F2, Task 5, 26/11/2026). A guarda tem 3 RAMOS e o plano insiste em que a condição seja `agua && relevoVisivel`, a MESMA `relevoVisivel` que decide o chão do relevo: nunca só
 * `PARTIDA.relevo.agua`, senão, com `visual` desligada ou nos ~19 quadros em que o campo fatiado ainda gera, a fita seria desenhada sobre o plano de hoje, SEM valeta, flutuando. Os 3 ramos: (1) `agua` desligada →
 * `undefined`; (2) `agua` ligada e `visual` desligada → `undefined`; (3) as duas ligadas MAS o campo ainda não chegou → `undefined`. Como `relevoVisivel` já é `visual && campo !== undefined`, a guarda `agua && relevoVisivel`
 * cobre os três. O mutante que a auditoria previu é a guarda reduzida a `PARTIDA.relevo.agua`.
 */
export function contratoDaAguaNaCena(cenaBioma: string): void {
  const codigo = soCodigo(cenaBioma)
  assert(/PARTIDA\.relevo\.agua/.test(codigo), 'a cena lê a chave `PARTIDA.relevo.agua`')
  assert(/riosDoQuadrado\(/.test(codigo) && /from '\.\.\/relevo\/aguaDoMundo'/.test(codigo), 'a cena obtém os rios de `riosDoQuadrado` (de `../relevo/aguaDoMundo`)')
  // a guarda: `agua && relevoVisivel ? riosDoQuadrado(mapaI, mapaJ, alturaDeBaseDoMundo) : undefined`, e NADA mais barato (nunca só a chave)
  assert(/PARTIDA\.relevo\.agua && relevoVisivel \? riosDoQuadrado\(mapaI, mapaJ, alturaDeBaseDoMundo\) : undefined/.test(codigo), 'a guarda é `PARTIDA.relevo.agua && relevoVisivel ? riosDoQuadrado(mapaI, mapaJ, alturaDeBaseDoMundo) : undefined`: os 3 ramos (chave desligada, relevo não visível, campo ainda não chegou) dão `undefined`')
  assert(!/PARTIDA\.relevo\.agua \? riosDoQuadrado/.test(codigo), 'a guarda NUNCA é só a chave da água (desenharia a fita sobre o plano de hoje, sem valeta, flutuando)')
  assert(/import \{[^}]*\balturaDeBaseDoMundo\b[^}]*\} from '\.\.\/relevo\/geradorRelevo'/.test(codigo), '`alturaDeBaseDoMundo` vem do gerador (a MESMA referência em todo lugar: a memória dos rios só reaproveita um rio calculado com a mesma função)')
  // as props do `AguaBiomaShader`
  const blocoDaAgua = /<AguaBiomaShader([\s\S]*?)\/>/.exec(codigo)?.[1] ?? ''
  assert((codigo.match(/<AguaBiomaShader/g) ?? []).length === 1, 'o `AguaBiomaShader` é montado UMA vez')
  assert(/rios=\{rios\}/.test(blocoDaAgua), 'o `AguaBiomaShader` recebe `rios={rios}` (a variável da guarda)')
  assert(/quadrado=\{\{ i: mapaI, j: mapaJ \}\}/.test(blocoDaAgua), 'o `AguaBiomaShader` recebe `quadrado={{ i: mapaI, j: mapaJ }}` (as coordenadas da fita são LOCAIS ao quadrado dos rios)')
  assert(/nevoaUniforms=\{nevoaUniforms\}/.test(blocoDaAgua), 'o `AguaBiomaShader` recebe `nevoaUniforms={nevoaUniforms}`: a MESMA ref que o terreno lê (sem ela a fita brilharia sobre a área preta)')
  // a variável `rios` é calculada com a guarda (e NÃO é recalculada a cada quadro sem memória: `useMemo`)
  assert(/const rios = useMemo\(/.test(codigo), '`rios` é calculada num `useMemo` (uma nova lista a cada render recriaria as fitas a cada quadro)')
}

/**
 * CONTRATO DE TEXTO do HORIZONTE na cena (F2, Task 8, 26/11/2026). O anel de terra em volta do quadrado só é desenhado quando o RELEVO está visível (`relevoVisivel`: a chave `visual` ligada E o campo do quadrado já chegou): com a chave
 * desligada, ou nos ~19 quadros em que o campo fatiado ainda gera, o chão é o PLANO de hoje e um anel de morros ao redor de um plano flutuaria sobre o vazio (I1: com a chave desligada o jogo é o de hoje). O anel segue o passo da MALHA
 * da qualidade em uso (é com ele que a emenda com o terreno fecha) e NÃO recebe clique.
 */
export function contratoDoHorizonteNaCena(cenaBioma: string, horizonte: string): void {
  const codigo = soCodigo(cenaBioma)
  const h = soCodigo(horizonte)
  assert(/<HorizonteRelevo/.test(codigo) && (codigo.match(/<HorizonteRelevo/g) ?? []).length === 1, 'a cena monta o `HorizonteRelevo` UMA vez')
  // F2, decisão do usuário (26/11): o horizonte NÃO é montado no Império nem no subsolo. MEDIDO (com e sem o mesh na mesma página, controle de ruído 0 e positivo 960/960): na serra (3,0) sem o mesh há 0 px de terra fora da ilha e com ele ~293–298
  // (duas cunhas nos cantos superiores, iguais nas 3 qualidades); nos outros 6 quadrados o anel já estava coberto (0–2 px). Esconder custa 0 px e poupa 1 chamada e ~1,1 mil triângulos. A guarda é a do chão E fora do subsolo E fora do Império.
  assert(/\{relevoVisivel && !noSubsolo && olharEfetivo !== 'imperio' && \(\s*<HorizonteRelevo/.test(codigo), 'o horizonte só é montado com `relevoVisivel` (a MESMA guarda do chão) E fora do subsolo E fora do Império: `{relevoVisivel && !noSubsolo && olharEfetivo !== \'imperio\' && (<HorizonteRelevo …/>)}` (no Império o anel furava o preto da névoa na serra (3,0))')
  assert(/const olharEfetivo = state\.semCorpo \? 'imperio' : state\.olhar/.test(codigo), 'o `olharEfetivo` que a guarda lê é o MESMO que a névoa usa (`semCorpo` conta como Império): senão o herói sem corpo veria o anel')
  assert(/const noSubsolo = !state\.semCorpo && state\.heroi\.y < -0\.9/.test(codigo), 'o `noSubsolo` que a guarda lê é o MESMO que a água usa (`!state.semCorpo && state.heroi.y < -0.9`): no subsolo o horizonte não é montado')
  const bloco = /<HorizonteRelevo([\s\S]*?)\/>/.exec(codigo)?.[1] ?? ''
  assert(/bioma=\{state\.bioma\}/.test(bloco) && /i=\{mapaI\}/.test(bloco) && /j=\{mapaJ\}/.test(bloco) && /spec=\{spec\}/.test(bloco), 'o horizonte recebe o bioma, o quadrado (`i={mapaI} j={mapaJ}`, NESSA ordem) e a spec da cena')
  assert(/from '\.\/HorizonteRelevo'/.test(codigo), 'a cena importa o `HorizonteRelevo`')
  // o componente
  assert(/export const HorizonteRelevo: React\.FC<HorizonteRelevoProps>/.test(h), 'o componente `HorizonteRelevo` é exportado com o tipo das suas props')
  assert(/geometriaDoHorizonte\(alturaDeBaseDoMundo, \{ i, j \}, passo\)/.test(h) && /const passo = passoDaMalha\(spec\.efetiva\)/.test(h), 'a geometria vem de `geometriaDoHorizonte(alturaDeBaseDoMundo, { i, j }, passo)` com o `passo = passoDaMalha(spec.efetiva)`: o passo da primeira fileira é o da MALHA em uso (com outro, a emenda abre 5–15 cm)')
  assert(/\[i, j, passo\]/.test(h), 'a geometria é refeita quando o quadrado OU o passo mudam (`[i, j, passo]`): trocar a qualidade troca a malha')
  assert(/raycast=\{semRaycast\}/.test(h) && /import \{ semRaycast \} from '\.\.\/raycastCena'/.test(h), 'o horizonte NÃO recebe o clique (`raycast={semRaycast}`): o clique vai para o chão')
  assert(/position=\{\[0, Y_SOLO_VISUAL, 0\]\}/.test(h) && /import \{ Y_SOLO_VISUAL \} from '\.\/suporteFundacao'/.test(h) && !/Y_AGUA_VISUAL/.test(h), 'o anel fica em `Y_SOLO_VISUAL`, como o terreno (as duas alturas são «acima da rua»)')
  assert(/geometria\.dispose\(\)/.test(h) && /material\.dispose\(\)/.test(h), 'a geometria e o material são DESCARTADOS no cleanup')
  assert(/useEffect\(\(\) => \{\s*return \(\) => \{\s*geometria\.dispose\(\)\s*\}\s*\}, \[geometria\]\)/.test(h) && /useEffect\(\(\) => \{\s*return \(\) => \{\s*material\.dispose\(\)\s*\}\s*\}, \[material\]\)/.test(h), 'cada um tem o seu efeito com a sua dependência (`[geometria]` e `[material]`)')
  assert(/computeVertexNormals\(\)/.test(h), 'a geometria calcula as normais (a luz do sol dá a forma do morro)')
  assert(/corDoChaoBioma\(bioma\)/.test(h) && /new MeshStandardMaterial\(/.test(h), 'o material é um `MeshStandardMaterial` com a cor do chão do bioma: o `scene.fog` do `AtmosferaBioma` o desbota sozinho (a perspectiva atmosférica)')
  assert(!/castShadow/.test(h) && !/receiveShadow/.test(h), 'o horizonte NÃO projeta nem recebe sombra (fica fora da caixa de sombra do sol: só desenho de longe)')
}

/**
 * CONTRATO DE TEXTO da LIGAÇÃO em `IlhaRua.tsx` (F2, Task 3): o `RelevoDoMundo` mora em `Cena` (um `useRef` por sessão, NÃO um singleton de módulo, que vazaria entre testes e partidas), é alimentado pelo
 * `useFrame`, e entrega o campo à `CenaBiomaVisual`. O ponto que mais importa: com a chave DESLIGADA o jogo é o de hoje, o que inclui NÃO GASTAR CPU. Gerar relevo com a chave desligada custaria 4 ms por
 * quadro durante ~19 quadros por quadrado novo, e ninguém veria: o jogo ficaria mais lento «de graça». Por isso o `useFrame` só pede e só roda o passo DENTRO de `if (PARTIDA.relevo.visual)`.
 * Quando o campo termina (o `useFrame` roda fora do ciclo do React) a `Cena` precisa re-renderizar para entregar a prop nova: um `useState` de VERSÃO, incrementado só quando um campo termina (no máximo
 * uma vez por quadrado novo), em vez de ler `campoDe` direto no JSX (que dependeria de um re-render por outro motivo e faria o relevo nunca aparecer, sem erro).
 */
export function contratoDaLigacaoNaCena(cena: string): void {
  const codigo = soCodigo(cena)
  // O CAMPO CHEGA AO SANDBOX (Task 4, 25/11): `Cena` o passa ao `MundoSandboxCena` com a MESMA condição do chão e dos props (chave ligada E campo pronto); o sandbox o repassa à fundação. Uma
  // prop opcional ESQUECIDA compila, passa o teste do componente e o jogo ignora o relevo, sem erro nenhum.
  const blocoDoSandbox = /<MundoSandboxCena([\s\S]*?)\/>/.exec(codigo)?.[1] ?? ''
  assert((codigo.match(/<MundoSandboxCena/g) ?? []).length === 1, 'o sandbox é montado UMA vez')
  assert(/campo=\{PARTIDA\.relevo\.visual \? chaoDaMalhaDoDesenho : undefined\}/.test(blocoDoSandbox), 'o sandbox recebe `campo={PARTIDA.relevo.visual ? chaoDaMalhaDoDesenho : undefined}`: a mesma condição do chão, agora a MALHA (plano até o campo chegar)')
  // A MALHA DA OBRA (`ObraArquiteturaMesh`, as obras pequenas) mora em `Cena` e NÃO no sandbox: recebe o MESMO `campo` com a MESMA condição e as MESMAS lagoas que o sandbox (a água é a mesma). Uma das duas esquecida
  // deixa a obra no plano (ou o píer no leito) sem erro nenhum, porque as duas props são opcionais.
  const blocoDaMalha = /<ObraArquiteturaMesh([\s\S]*?)\n          \/>/.exec(codigo)?.[1] ?? ''
  assert((codigo.match(/<ObraArquiteturaMesh/g) ?? []).length === 1, 'a malha da obra é montada UMA vez')
  assert(blocoDaMalha.length > 0, 'controle do instrumento: o recorte da malha da obra achou o elemento (até o `/>` da indentação dele)')
  assert(/campo=\{PARTIDA\.relevo\.visual \? chaoDaMalhaDoDesenho : undefined\}/.test(blocoDaMalha), 'a malha da obra recebe `campo={PARTIDA.relevo.visual ? chaoDaMalhaDoDesenho : undefined}`: a mesma condição do sandbox, a MALHA')
  assert(/lagoas=\{props\.sim\.current\.lagoas\}/.test(blocoDaMalha), 'a malha da obra recebe as MESMAS lagoas do sandbox (`lagoas={props.sim.current.lagoas}`)')
  assert(/lagoas=\{props\.sim\.current\.lagoas\}/.test(blocoDoSandbox), 'controle: o sandbox recebe `lagoas={props.sim.current.lagoas}` (a fonte que a malha da obra também usa)')
  assert(/import \{[^}]*\bcriarRelevoDoMundo\b[^}]*\} from '\.\/relevo\/relevoNoEstado'/.test(codigo), '`IlhaRua` importa `criarRelevoDoMundo` de `./relevo/relevoNoEstado`')
  // `useRef(criarRelevoDoMundo())` está PROIBIDO: o argumento é avaliado a CADA render e descartado (cria um relevo inteiro a cada render, só o primeiro serve). O padrão certo é o `useRef(null)` com a
  // criação preguiçosa `if (!ref.current) ref.current = criarRelevoDoMundo()`, que cria UMA vez.
  assert(/const relevoDoMundo = useRef<RelevoDoMundo \| null>\(null\)\s+if \(!relevoDoMundo\.current\) relevoDoMundo\.current = criarRelevoDoMundo\(\)/.test(codigo), 'o `RelevoDoMundo` mora num `useRef(null)` de `Cena` com criação PREGUIÇOSA (`if (!ref.current) ref.current = criarRelevoDoMundo()`): `useRef(criarRelevoDoMundo())` criaria um relevo novo a cada render')
  assert(!/useRef\(criarRelevoDoMundo\(\)\)/.test(codigo), '`useRef(criarRelevoDoMundo())` é PROIBIDO (o argumento é avaliado a cada render)')
  assert(!/^(const|let) \w+ = criarRelevoDoMundo\(\)/m.test(codigo), 'NENHUM `RelevoDoMundo` criado no escopo do módulo (um singleton vazaria entre partidas e testes)')
  // o BLOCO do `if`: do `if (PARTIDA.relevo.visual && …) {` até o `}` que o fecha na MESMA indentação (4 espaços, o `useFrame` da Cena). `passo` e `pedir` têm de estar DENTRO dele, e FORA dele não pode haver outro.
  const bloco = /\n    if \(PARTIDA\.relevo\.visual && relevoDoMundo\.current\) \{\n([\s\S]*?)\n    \}\n/.exec(codigo)?.[1] ?? ''
  assert(bloco.length > 0, 'o `useFrame` tem o bloco `if (PARTIDA.relevo.visual && relevoDoMundo.current) { … }` (com a chave desligada nada dele roda)')
  assert(/relevoDoMundo\.current\.pedir\(props\.atlas\.current\.cenaI, props\.atlas\.current\.cenaJ\)/.test(bloco), 'DENTRO do bloco: PEDE o quadrado da cena (`cenaI`, `cenaJ`; `pedir` de um quadrado já conhecido não faz nada, então todo quadro é barato)')
  assert(/relevoDoMundo\.current\.passo\(ORCAMENTO_POR_QUADRO_MS\)/.test(bloco), 'DENTRO do bloco: roda `passo(ORCAMENTO_POR_QUADRO_MS)` (4 ms, o mesmo do `gerarRelevoFatiado`, não um número solto)')
  assert((codigo.match(/relevoDoMundo\.current\.passo\(/g) ?? []).length === 1 && (codigo.match(/relevoDoMundo\.current\.pedir\(/g) ?? []).length === 1, '`passo` e `pedir` aparecem UMA vez cada, e as duas estão no bloco: nenhuma chamada fora da guarda da chave')
  assert(/const campoAgora = relevoDoMundo\.current\.campoDe\(props\.atlas\.current\.cenaI, props\.atlas\.current\.cenaJ\)/.test(bloco), 'DENTRO do bloco: lê o campo PRONTO do quadrado da cena')
  assert(/const \[campoDoRelevo, setCampoDoRelevo\] = useState<CampoRelevo \| undefined>\(undefined\)/.test(codigo), 'a `Cena` guarda o campo PRONTO em `useState`, para re-renderizar quando um campo termina (o `useFrame` roda fora do ciclo do React)')
  assert(/if \(campoAgora !== ultimoCampoDoRelevo\.current\) \{\s+ultimoCampoDoRelevo\.current = campoAgora\s+setCampoDoRelevo\(campoAgora\)\s+\}/.test(bloco), 'o estado só muda quando a IDENTIDADE do campo muda (`!==` contra o último entregue): um `setState` por quadro re-renderizaria a `Cena` inteira 60 vezes por segundo')
  assert(/campoDoRelevo=\{PARTIDA\.relevo\.visual \? campoDoRelevo : undefined\}/.test(codigo), 'a `Cena` passa `campoDoRelevo` à `CenaBiomaVisual` e é `undefined` com a chave desligada: `campoDoRelevo={PARTIDA.relevo.visual ? campoDoRelevo : undefined}`')
  // A NÉVOA (F2, passo (a2), 25/11): o plano da `NevoaPintada` só é recortado quando o relevo está VISÍVEL (a mesma condição de `CenaBiomaVisual`: chave ligada E campo pronto). A ref nasce `false`
  // (o plano de hoje, I1), só o bloco da chave a escreve, e escreve a CONDIÇÃO (`campoAgora !== undefined`), a cada quadro: ligar a chave sem campo NÃO recorta (senão o jogador ficaria sem névoa
  // por ~19 quadros a cada quadrado novo, o mesmo defeito do buraco no chão).
  assert(/const relevoCobreRef = useRef\(false\)/.test(codigo), 'a `Cena` tem `relevoCobreRef = useRef(false)`: NASCE false (o plano de hoje, I1)')
  assert(/relevoCobreRef\.current = campoAgora !== undefined/.test(bloco), 'DENTRO do bloco da chave: `relevoCobreRef.current = campoAgora !== undefined` (o plano só é recortado com o campo PRONTO)')
  assert((codigo.match(/relevoCobreRef\.current =/g) ?? []).length === 1, 'só UM lugar escreve `relevoCobreRef.current` (o bloco da chave): fora dele a ref ficaria em estado velho')
  assert(/<NevoaPintada sim=\{props\.sim\} relevoCobre=\{relevoCobreRef\} uniformsPublicas=\{nevoaUniformsRef\} \/>/.test(codigo), 'a névoa recebe `relevoCobre={relevoCobreRef}` e `uniformsPublicas={nevoaUniformsRef}` (REFS, não valores)')
  // O CANAL das uniforms da névoa até o chão (passo (a4)): UMA ref criada em `Cena`, que a `NevoaPintada` PREENCHE e a `CenaBiomaVisual` entrega ao `TerrenoRelevoCena`, que a lê a cada quadro.
  assert(/const nevoaUniformsRef = useRef<Record<string, \{ value: unknown \}> \| null>\(null\)/.test(codigo), 'a `Cena` cria `nevoaUniformsRef` (nasce null: a névoa a preenche ao montar)')
  assert(/nevoaUniforms=\{nevoaUniformsRef\}/.test(codigo), 'a `Cena` passa `nevoaUniforms={nevoaUniformsRef}` à `CenaBiomaVisual`')
  // 3 usos em `IlhaRua`: a criação, a saída para a `NevoaPintada` (`uniformsPublicas`) e a entrada para a `CenaBiomaVisual` (`nevoaUniforms`). A LEITURA é no `TerrenoRelevoCena` (outro arquivo): na
  // 1ª versão deste contrato escrevi 4 contando uma «leitura» que não existe aqui, e o teste acusou (a contagem se conta lendo, não de cabeça).
  assert((codigo.match(/nevoaUniformsRef/g) ?? []).length === 3, '`nevoaUniformsRef` aparece 3 vezes em `IlhaRua` (a criação, a saída para a névoa e a entrada para a cena de bioma): nenhum uso solto')
  // o quadrado atual E os vizinhos que o horizonte pedirá: o do jogador primeiro (a fila é FIFO)
  assert(/cenaI/.test(codigo) && /cenaJ/.test(codigo), 'o quadrado pedido é o da cena (`cenaI`, `cenaJ`)')
}

/**
 * CONTRATO da CONSTANTE COMPARTILHADA (25/11): o terreno monta a saia com `ALTURA_DO_PLANO`, e quem a DECLARA é `NevoaPintada` (a MESMA que posiciona o plano). Se ela deixar de ser exportada o terreno
 * não importa mais (o `tsc` acusaria, mas o runner de Node não compila), e se alguém a copiar para o terreno o plano e a saia divergem em silêncio e o fio azul volta.
 */
export function contratoDaAlturaCompartilhada(nevoa: string): void {
  const codigo = soCodigo(nevoa)
  assert(/^export const ALTURA_DO_PLANO = [0-9.]+$/m.test(codigo), '`NevoaPintada` EXPORTA `ALTURA_DO_PLANO` (a constante que o terreno importa para o topo da saia)')
  assert((codigo.match(/ALTURA_DO_PLANO/g) ?? []).length === 2, '`ALTURA_DO_PLANO` aparece 2 vezes na névoa (a declaração e o `position` do plano): uma segunda cópia do número divergiria')
  assert(/position=\{\[0, Y_SOLO_VISUAL \+ ALTURA_DO_PLANO, 0\]\}/.test(codigo), 'o plano da névoa é posicionado POR `ALTURA_DO_PLANO` (a saia fecha até onde o plano está)')
}

export function run(terreno?: string, cenaBioma?: string, cena?: string, nevoa?: string, horizonte?: string): void {
  if (terreno !== undefined) contratoDoTerrenoRelevo(terreno)
  if (nevoa !== undefined) contratoDaAlturaCompartilhada(nevoa)
  if (cenaBioma !== undefined) contratoDaIntegracaoDoRelevo(cenaBioma)
  if (cenaBioma !== undefined) contratoDaAguaNaCena(cenaBioma)
  if (cenaBioma !== undefined && horizonte !== undefined) contratoDoHorizonteNaCena(cenaBioma, horizonte)
  if (cena !== undefined) contratoDaLigacaoNaCena(cena)
}
