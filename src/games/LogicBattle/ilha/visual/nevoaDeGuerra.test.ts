import { PARTIDA } from '../partidaPolicies'
import { CELULAS_DO_DISCO, chaoRevelado, cobertoAgora, createPartida, marcarChao, type PartidaState } from '../partidaSim'
import { dadosDaNevoa, LADO_NEVOA, misturarNevoa, NEVOA } from './nevoaDeGuerra'

function assert(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem)
}

/** Gerador fixo (mulberry32): os estados «aleatórios» do teste são REPRODUTÍVEIS. */
function semente(valor: number): () => number {
  let t = valor >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

/** Um estado com o herói e algumas tropas e obras em lugares sorteados, e com o chão já visto de acordo (`chaoVisto` acumula o que o herói e as tropas viram). */
function estadoSorteado(rnd: () => number, semCorpo: boolean): PartidaState {
  const base = createPartida(0, 0, semCorpo)
  const heroi = { ...base.heroi, x: Math.round((rnd() * 2 - 1) * 50), z: Math.round((rnd() * 2 - 1) * 50) }
  const nTropas = Math.floor(rnd() * 7)
  const unidades = [...base.unidades]
  for (let k = 0; k < nTropas; k += 1) {
    unidades.push({
      id: 900 + k,
      lado: 'aliado',
      papel: 'tropa',
      x: Math.round((rnd() * 2 - 1) * 54),
      z: Math.round((rnd() * 2 - 1) * 54),
      hp: 12,
      postura: 'vigia',
      ordem: null,
      cooldown: 0,
      segmentos: [],
      alerta: false,
    })
  }
  const nObras = Math.floor(rnd() * 4)
  const obras = [...base.obras]
  for (let k = 0; k < nObras; k += 1) {
    obras.push({
      id: 800 + k,
      lado: 'nosso',
      tipo: k === 0 ? 'torre' : 'quartel',
      x: Math.round((rnd() * 2 - 1) * 50),
      z: Math.round((rnd() * 2 - 1) * 50),
      nivel: 1,
      hp: 40,
      maxHp: 40,
      gateApplied: false,
      cooldown: 0,
    })
  }
  return { ...base, heroi, unidades, obras }
}

/**
 * CONTRATO do FOG e do FUNDO da atmosfera (24/11). Descoberto medindo a cena viva: `<fog attach="fog">` e `<color attach="background">` da `AtmosferaBioma` ficavam num `Group`
 * (`cena-bioma-visual`) e o R3F os anexa ao PAI IMEDIATO, que é um Group, não a `Scene`. `Group.fog` e `Group.background` não são lidos por ninguém: `scene.fog` e `scene.background` eram `null`
 * desde o commit `1fbc372`, e os números `fogNearCorpo/fogFarCorpo` (34 m e 98 m) do catálogo nunca tiveram efeito. O conserto grava na CENA (`useThree().scene`), atrás da chave `nevoaPintada`
 * (com ela desligada o jogo é o de hoje, I1). Este contrato guarda as duas coisas: que o código escreve na `scene`, e que isso só vale com a chave.
 */
export function contratoDoFogDaAtmosfera(atmosfera: string): void {
  assert(/const \{ camera, scene \} = useThree\(\)/.test(atmosfera), 'a AtmosferaBioma lê a `scene` do useThree (o fog/fundo têm de ir para a CENA, não para o Group pai)')
  // O que é GRAVADO, não só que o texto exista: o fog com a cor e as distâncias do catálogo, e o fundo com a cor do horizonte do bioma. (O mutante «fundo não vai para a cena» sobreviveu a uma
  // regex frouxa, porque `scene.background = null` do cleanup também casava.)
  assert(/scene\.fog = new Fog\(cat\.fogCor, fogNear, fogFar\)/.test(atmosfera), 'o fog gravado na cena usa a cor e as distâncias (perto/longe por olhar) do catálogo do bioma')
  assert(/scene\.background = new Color\(cat\.ceuHorizonte\)/.test(atmosfera), 'o fundo gravado na cena é a cor do horizonte do bioma')
  assert(/if \(!PARTIDA\.nevoaPintada\) return undefined/.test(atmosfera), 'o fog novo só vale com a chave `nevoaPintada` (chave desligada = o jogo de hoje, I1)')
  // o cleanup devolve a null as DUAS coisas (nada vaza para o próximo bioma nem para a chave desligada); cada atribuição de null aparece exatamente uma vez
  assert((atmosfera.match(/scene\.fog = null/g) ?? []).length === 1, 'o cleanup devolve `scene.fog` a null (exatamente uma vez)')
  assert((atmosfera.match(/scene\.background = null/g) ?? []).length === 1, 'o cleanup devolve `scene.background` a null (exatamente uma vez)')
  // o desenho antigo, que gravava no Group e nunca teve efeito, NÃO voltou. Procura-se SÓ no código: o comentário que explica o bug cita `<fog attach="fog">` entre crases e uma regex sobre o
  // arquivo inteiro o acharia (foi o que aconteceu em 24/11: o teste ficou vermelho no código REAL e dois mutantes «morreram» sem provar nada).
  const soCodigo = atmosfera.split(/\r?\n/).filter((linha) => !/^\s*(\/\/|\*|\/\*)/.test(linha)).join('\n')
  assert(!/<fog attach=/.test(soCodigo) && !/<color attach="background"/.test(soCodigo), 'o `<fog attach>` e o `<color attach="background">` (que gravavam no Group pai, sem efeito) não voltaram')
  // o efeito reage ao OLHAR: perto/longe mudam do corpo para o Império (34/98 contra 72/165), então `fogNear` e `fogFar` estão nas dependências
  assert(/\[scene, cat\.fogCor, cat\.ceuHorizonte, fogNear, fogFar\]/.test(atmosfera), 'o efeito depende de fogNear e fogFar: trocar de olhar (corpo ↔ Império) recria o fog')
}

/**
 * CONTRATO de `NevoaPintada.tsx` (24/11): o componente recebe a REF do estado (`sim`, como `TropasCena`) e lê `.current` DENTRO do `useFrame`. `sim.current` é reescrita pelo laço do jogo a
 * CADA passo, mas `Cena` só re-renderiza quando o React decide: um componente que guarda o valor recebido no render (`state={sim.current}`) lê um estado VELHO sempre que `Cena` não renderiza, e a
 * névoa congela sem erro nenhum. Funcionou nas fotos de 24/11 só porque `Cena` re-renderiza com frequência: sorte de implementação, não contrato.
 */
export function contratoDoComponenteNevoa(componente: string, cena: string): void {
  assert(/readonly sim: React\.MutableRefObject<PartidaState>/.test(componente), '<NevoaPintada/> recebe a REF `sim` (MutableRefObject<PartidaState>), não o estado por valor')
  assert(!/readonly state: PartidaState/.test(componente), '<NevoaPintada/> não recebe mais `state` por valor (ficaria velho quando Cena não re-renderiza)')
  assert(/const s = sim\.current/.test(componente), 'o useFrame lê `sim.current` a cada quadro')
  assert(!/estadoRef/.test(componente), 'não há mais uma ref do estado copiada no render (o defeito)')
  // F2 (25/11): a névoa precisa saber se o RELEVO está cobrindo o quadrado (aí o plano é recortado e o chão cuida da névoa). Isso NÃO está em `sim` (vive no `RelevoDoMundo` de `Cena`), então entra por
  // UMA SEGUNDA REF, `relevoCobre`, lida DENTRO do `useFrame` como `sim`: a regra «só refs, nunca um valor guardado no render» continua valendo (o defeito da prop velha de 24/11 era um VALOR).
  // F2 (25/11, passo (a4)): a TERCEIRA ref é a SAÍDA: a névoa PUBLICA as suas uniforms para o chão com relevo (um irmão em `Cena`) as COPIAR a cada quadro. `CenaBiomaVisual` monta ANTES da
  // `NevoaPintada`, então o terreno nunca pode depender de a ref já estar cheia no 1º compile (o estado seguro dele é «tudo coberto»); aqui só se prova que a névoa a preenche.
  assert(/<NevoaPintada\s+sim=\{props\.sim\}\s+relevoCobre=\{relevoCobreRef\}\s+uniformsPublicas=\{nevoaUniformsRef\}\s*\/>/.test(cena), 'a cena monta `<NevoaPintada sim={props.sim} relevoCobre={relevoCobreRef} uniformsPublicas={nevoaUniformsRef} />`: TRÊS refs, nenhum valor')
  assert(!/<NevoaPintada\s+state=/.test(cena), 'a cena não passa mais `state=` ao <NevoaPintada/>')
  assert(/readonly relevoCobre: React\.MutableRefObject<boolean>/.test(componente), '<NevoaPintada/> recebe `relevoCobre` como REF (MutableRefObject<boolean>), não como valor')
  assert(!/readonly relevoCobre: boolean/.test(componente), '<NevoaPintada/> não recebe `relevoCobre` por valor (ficaria velho quando Cena não re-renderiza: o defeito de 24/11)')
  assert(/relevoCobre\.current/.test(componente), 'o `useFrame` lê `relevoCobre.current` a cada quadro')
  assert(/readonly uniformsPublicas\?: React\.MutableRefObject<Record<string, \{ value: unknown \}> \| null>/.test(componente), '<NevoaPintada/> recebe `uniformsPublicas` como REF OPCIONAL (a saída: as uniforms para o chão copiar); opcional para a cena de antes (sem relevo) não mudar')
  assert(/uniformsPublicas\.current = material\.uniforms/.test(componente), 'a névoa PUBLICA `material.uniforms` na ref (o MESMO objeto: o chão lê o que ela atualiza a cada quadro, sem cópia)')
  assert(/uniformsPublicas\.current = null/.test(componente), 'e LIMPA a ref ao sair (o chão não pode ficar copiando uniforms de um material já descartado)')
  // O RECORTE do plano (F2, 25/11; sem a pegada da rua desde 25/11, decisão do usuário): com o relevo cobrindo, o plano descarta o fragmento DENTRO do quadrado INTEIRO (o chão com relevo tem a
  // névoa dele); FORA do quadrado o plano continua inteiro (a câmera do Império vê além da borda e, sem ele, o céu apareceria nos cantos: o plano é de ~678 m de propósito). Com o relevo
  // DESLIGADO (`uRelevoCobre = 0`) o shader é idêntico ao de hoje (I1). `codigo` é o componente SEM comentários, declarado UMA vez aqui (antes do primeiro uso) e reaproveitado abaixo.
  const codigo = componente.split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')
  assert(/uniform float uRelevoCobre;/.test(codigo), 'o fragmento declara `uniform float uRelevoCobre` (0 = o plano de hoje, 1 = o relevo cobre o quadrado)')
  assert(/uRelevoCobre: \{ value: 0 \}/.test(codigo), '`uRelevoCobre` NASCE em 0 (chave desligada = o jogo de hoje)')
  assert(!/PegadaDaRua|pegadaDaRua|PEGADA_DA_RUA/.test(codigo), 'o plano da névoa não conhece mais a pegada da rua: a rua saiu do cenário e o recorte é o quadrado inteiro')
  assert(/if \(uRelevoCobre > 0\.5 && vUv\.x >= 0\.0 && vUv\.x <= 1\.0 && vUv\.y >= 0\.0 && vUv\.y <= 1\.0\) discard;/.test(codigo), 'o recorte é `uRelevoCobre > 0,5` E dentro do quadrado inteiro (UV em [0, 1]²): só então descarta')
  assert(/u\.uRelevoCobre\.value = relevoCobre\.current \? 1 : 0/.test(codigo), 'o `useFrame` copia a ref para o uniform: `uRelevoCobre = relevoCobre.current ? 1 : 0`')
  // `olhar` e a cor da bruma também vinham do render (`props.sim.current.olhar`): ficariam velhos pelo mesmo motivo. O componente os deriva de `sim.current` DENTRO do frame.
  assert(!/readonly olhar: Olhar/.test(componente) && !/readonly corBruma: string/.test(componente), '<NevoaPintada/> não recebe `olhar` nem `corBruma` por prop (derivam de sim.current no frame)')
  assert(/s\.semCorpo \? 'imperio' : s\.olhar/.test(componente), 'o olhar de desenho é derivado de `s.semCorpo ? \'imperio\' : s.olhar` dentro do frame')
  assert(/BIOMA_VISUAL_CATALOG\[s\.bioma\]\.ceuHorizonte/.test(componente), 'a cor da bruma é o `ceuHorizonte` do bioma ATUAL (`s.bioma`), lido no frame')
  // O GLSL da névoa é UM SÓ (F2, 25/11): o plano e o chão com relevo incluem `DECLARACOES_DA_NEVOA` de `glslDaNevoa.ts`. Se o plano guardasse a sua própria cópia de `hash`/`ruido`/patamares, a
  // costura a 56 m do centro apareceria no dia em que alguém afinasse só um dos dois.
  assert(/import \{[^}]*\bDECLARACOES_DA_NEVOA\b[^}]*\} from '\.\/glslDaNevoa'/.test(codigo), '<NevoaPintada/> importa `DECLARACOES_DA_NEVOA` de `./glslDaNevoa` (o GLSL compartilhado)')
  assert(/\$\{DECLARACOES_DA_NEVOA\}/.test(codigo), 'o fragmento do plano INCLUI as declarações compartilhadas (`${DECLARACOES_DA_NEVOA}`)')
  assert(!/float hash\(vec2 p\)/.test(codigo) && !/float ruido\(vec2 p\)/.test(codigo), 'o plano NÃO tem mais a sua própria cópia de `hash`/`ruido` (só o módulo compartilhado)')
  assert(!/smoothstep\(0\.02, 0\.5, m\)/.test(codigo) && !/smoothstep\(0\.5, 0\.98, m\)/.test(codigo), 'o plano NÃO repete os patamares da névoa (0,02 / 0,5 / 0,98): vivem só no módulo')
  assert(/corDaNevoa\(vUv\)/.test(codigo), 'o fragmento do plano chama `corDaNevoa(vUv)`')
  // A LINHA exata: `OPACIDADE_MINIMA_DA_NEVOA` e `discard` já aparecem em OUTROS lugares (o import e o recorte do relevo), então testar cada um solto passava mesmo sem esta linha (o mutante V15 de
  // 25/11 a apagou e sobreviveu). Sem ela, onde a opacidade é quase nula o plano pintaria um fio de cor sobre o chão que deveria estar limpo.
  assert(/if \(nevoa\.a < \$\{OPACIDADE_MINIMA_DA_NEVOA\}\) discard;\s+gl_FragColor = nevoa;/.test(codigo), 'o plano DESCARTA abaixo de `OPACIDADE_MINIMA_DA_NEVOA` e só então pinta: `if (nevoa.a < …) discard; gl_FragColor = nevoa;` (o chão à vista aparece limpo)')
}

/**
 * CONTRATO de `IlhaRua.tsx` (I1: «chave desligada = o jogo de hoje»). Lê o TEXTO da cena, como `contratoDoHud` e `bordaDoMapaContrato` fazem, porque o desenho vive dentro do React e o runner
 * roda no Node, sem GPU. Garante que: (1) as colunas antigas CONTINUAM no código (a janela de rollback: o desenho de hoje não foi apagado); (2) o `<NevoaPintada/>` só monta atrás da chave;
 * (3) o cálculo das colunas é pulado com a chave ligada; (4) os obstáculos e o arco só passam a respeitar a névoa com a chave ligada (senão o jogo de hoje mudaria).
 * Recebe o texto de `IlhaRua.tsx` e de `partidaPolicies.ts` (o runner os lê com `readFileSync`).
 */
export function contratoDaNevoa(cena: string, politicas: string): void {
  // (1) o desenho antigo continua lá, inteiro
  assert(/ref=\{nuvem\}/.test(cena) && /ref=\{penumbra\}/.test(cena), 'as duas instancedMesh antigas (`nuvem` e `penumbra`) continuam na cena: é a janela de rollback')
  assert(/configVisualNuvem\(olharDesenho, state\.semCorpo\)/.test(cena), 'o cálculo antigo das colunas continua no código')
  // O MATERIAL das colunas também: o cálculo antigo pinta a cor/opacidade/depthWrite por `nuvemMatRef`. Sem o `ref`, o desenho de hoje mudaria em silêncio (o mutante «apagar as colunas
  // antigas» sobreviveu ao contrato que só olhava as duas instancedMesh, 24/11).
  assert(/<meshLambertMaterial ref=\{nuvemMatRef\} color="#d5e2ea" transparent opacity=\{0\.86\} depthWrite \/>/.test(cena), 'o material das colunas antigas (ref, cor, opacidade, depthWrite) continua intacto')
  assert(/<meshLambertMaterial color="#0b1220" transparent opacity=\{0\.48\} depthWrite=\{false\} \/>/.test(cena), 'o material da penumbra antiga continua intacto')
  // (2) o plano novo só monta atrás da chave E de PARTIDA.nuvem
  assert(/\{PARTIDA\.nevoaPintada && PARTIDA\.nuvem && \(\s*<NevoaPintada/.test(cena), '<NevoaPintada/> só monta com PARTIDA.nevoaPintada && PARTIDA.nuvem')
  assert((cena.match(/<NevoaPintada/g) ?? []).length === 1, 'há exatamente um <NevoaPintada/> na cena')
  // (3) com a chave ligada as colunas não são calculadas nem desenhadas
  assert(/if \(!PARTIDA\.nuvem \|\| PARTIDA\.nevoaPintada\) \{\s*(\/\/[^\n]*\n\s*)?malhaNuvem\.visible = false/.test(cena), 'com a névoa pintada ligada as colunas ficam invisíveis e sem cálculo')
  assert(/if \(penumbra\.current && PARTIDA\.nevoaPintada\) \{\s*penumbra\.current\.visible = false\s*\} else if \(penumbra\.current && PARTIDA\.nuvem\)/.test(cena), 'com a névoa pintada ligada a penumbra fica invisível')
  // (4) SEM caixas nem arco (25/11, decisão do usuário: a rua era de outro jogo). Antes este bloco exigia que as 3 caixas e o arco +10 só aparecessem com a névoa ligada; as peças saíram, e o que
  // vale agora é o inverso, com CONTROLE POSITIVO do instrumento (o mesmo regex acha a linha antiga num texto de exemplo, senão «não achou» podia ser regex quebrado).
  const linhaAntigaDasCaixas = '{OBSTACULOS.filter((caixa) => !PARTIDA.nevoaPintada || paisagemNaturalVisivel(props.sim.current, caixa.x, caixa.z)).map((caixa) => ('
  assert(/OBSTACULOS\.filter\(\(caixa\) =>/.test(linhaAntigaDasCaixas), "controle do instrumento: o regex das caixas acha a linha antiga")
  assert(!/OBSTACULOS/.test(cena), 'a cena não desenha mais as caixas fixas (nem importa OBSTACULOS)')
  assert(!/paisagemNaturalVisivel\(props\.sim\.current, 0, 20\)/.test(cena), 'a cena não desenha mais o arco +10 em (0, 20)')
  assert(!/ilha-plate/.test(cena) && !/@react-three\/drei/.test(cena.split('\n').filter((l) => /^import/.test(l)).join('\n')), 'sem o rótulo +10 a cena não importa o Html do drei')
  // a chave existe e é booleana
  assert(/nevoaPintada: (true|false) as boolean/.test(politicas), 'PARTIDA.nevoaPintada existe e é booleana')
}

export function run(cena?: string, politicas?: string, componente?: string, atmosfera?: string): void {
  if (cena !== undefined && politicas !== undefined) contratoDaNevoa(cena, politicas)
  if (cena !== undefined && componente !== undefined) contratoDoComponenteNevoa(componente, cena)
  if (atmosfera !== undefined) contratoDoFogDaAtmosfera(atmosfera)
  const rnd = semente(0x9e3779b1)
  const totais = { nunca: 0, ja: 0, agora: 0 }
  assert(LADO_NEVOA === 113, 'a máscara de névoa tem a grade do chão: 113×113')
  assert(NEVOA.nuncaVisto === 0 && NEVOA.jaVisto === 128 && NEVOA.visivelAgora === 255, 'os três estados da névoa valem 0, 128 e 255')

  // I8a: a máscara REPRODUZ a regra do jogo, célula a célula. `chaoVisto` é o que `marcarChao` acumulou; depois de andar, o que se vê agora é só o disco atual.
  for (let rodada = 0; rodada < 100; rodada += 1) {
    const base = estadoSorteado(rnd, rodada % 10 === 9)
    // «já viu»: acumula o chão do estado ANTERIOR (heroi em outro lugar) e depois anda: parte do que foi visto deixa de estar coberto agora
    const anterior = { ...base, heroi: { ...base.heroi, x: -base.heroi.x, z: -base.heroi.z } }
    const visto = marcarChao(anterior)
    const estado: PartidaState = { ...base, chaoVisto: visto.chaoVisto, versaoChao: visto.versaoChao }
    const dados = dadosDaNevoa(estado)
    assert(dados.length === LADO_NEVOA * LADO_NEVOA, 'a máscara tem 113×113 células')
    let nunca = 0
    let ja = 0
    let agora = 0
    for (const celula of CELULAS_DO_DISCO) {
      const esperado = cobertoAgora(estado, celula.x, celula.z) ? NEVOA.visivelAgora : chaoRevelado(estado, celula.x, celula.z) ? NEVOA.jaVisto : NEVOA.nuncaVisto
      assert(dados[celula.i] === esperado, `I8a: a célula (${celula.x},${celula.z}) deveria ser ${esperado} e veio ${dados[celula.i]} (rodada ${rodada})`)
      if (esperado === NEVOA.nuncaVisto) nunca += 1
      else if (esperado === NEVOA.jaVisto) ja += 1
      else agora += 1
    }
    assert(nunca + ja + agora === CELULAS_DO_DISCO.length, 'as três categorias cobrem todas as células')
    // controle do próprio teste: nos 100 estados o teste tem de ter visto os TRÊS estados, senão ele só confere um caso
    totais.nunca += nunca
    totais.ja += ja
    totais.agora += agora
  }
  assert(totais.nunca > 100_000 && totais.ja > 1000 && totais.agora > 10_000, `o teste deve ter visto os três estados em quantidade (nunca ${totais.nunca}, já ${totais.ja}, agora ${totais.agora})`)

  // um mapa recém-criado: só o disco do herói é visto agora, e NADA fica «já visto» por engano (Review Focus 3)
  const novo = createPartida()
  const dNovo = dadosDaNevoa(novo)
  let jaNovo = 0
  let agoraNovo = 0
  for (const celula of CELULAS_DO_DISCO) {
    if (dNovo[celula.i] === NEVOA.jaVisto) jaNovo += 1
    if (dNovo[celula.i] === NEVOA.visivelAgora) agoraNovo += 1
  }
  assert(jaNovo === 0, `um mapa recém-criado não pode ter chão «já visto» (veio ${jaNovo})`)
  assert(agoraNovo > 500 && agoraNovo < 2500, `o disco do herói (raio ${PARTIDA.visao.heroi}) tem ~1.000 células (veio ${agoraNovo})`)

  // sem névoa no jogo (PARTIDA.nuvem = false), tudo é visível agora; restaura a chave no fim, aconteça o que acontecer
  const mutavel = PARTIDA as unknown as { nuvem: boolean }
  const original = mutavel.nuvem
  try {
    mutavel.nuvem = false
    const aberto = dadosDaNevoa(novo)
    let diferente = 0
    for (const celula of CELULAS_DO_DISCO) if (aberto[celula.i] !== NEVOA.visivelAgora) diferente += 1
    assert(diferente === 0, `com PARTIDA.nuvem desligado todas as células devem estar visíveis (${diferente} não estão)`)
  } finally {
    mutavel.nuvem = original
  }
  assert(PARTIDA.nuvem === original, 'o teste restaurou PARTIDA.nuvem')

  testarMistura()
}

function testarMistura(): void {
  const alvo = new Uint8Array([0, 128, 255, 255])
  // A velocidade é a de uma transição COMPLETA (0 ↔ 255 em `tempoTransicao`), igual para qualquer alvo: com dt = 0,175 s e 0,35 s de transição o passo é 127,5 bytes. Então 0 → 255 chega à
  // METADE (127,5 ≈ 128), 0 → 128 chega ao alvo (128 está ao alcance do passo) e quem já está no alvo fica parado.
  const a = new Uint8Array([0, 0, 0, 255])
  const mudou = misturarNevoa(a, alvo, 0.175, 0.35)
  assert(mudou === true, 'misturarNevoa devolve true quando algo mudou')
  assert(a[0] === 0 && a[1] === 128 && Math.abs(a[2] - 127.5) <= 1 && a[3] === 255, `meia transição: esperava [0, 128, ≈128, 255], veio [${[...a]}]`)
  // a transição completa leva `tempoTransicao`: de 0 a 255, em passos de 1/20 do tempo, chega ao alvo em 20 passos (nem antes, nem depois)
  const subida = new Uint8Array([0])
  let passos = 0
  while (subida[0] !== 255 && passos < 100) {
    misturarNevoa(subida, new Uint8Array([255]), 0.35 / 20, 0.35)
    passos += 1
  }
  assert(passos >= 19 && passos <= 21, `a transição completa deve levar ~20 passos de 1/20 do tempo (levou ${passos})`)
  // passo minúsculo (menor que meio byte) NÃO pode deixar a névoa parada para sempre: acumula e chega (Review Focus 5: relógio com dt pequeno)
  const lenta = new Uint8Array([0])
  let tentativas = 0
  while (lenta[0] !== 255 && tentativas < 200_000) {
    misturarNevoa(lenta, new Uint8Array([255]), 0.0002, 0.35)
    tentativas += 1
  }
  assert(lenta[0] === 255, `com dt = 0,0002 s a névoa deve chegar ao alvo (parou em ${lenta[0]} após ${tentativas} passos)`)
  // dt enorme chega EXATAMENTE ao alvo, sem passar
  const b = new Uint8Array([0, 0, 0, 0])
  misturarNevoa(b, alvo, 10, 0.35)
  assert(b.every((v, k) => v === alvo[k]), `dt grande deve chegar exatamente ao alvo (veio [${[...b]}])`)
  // já no alvo: devolve false e não mexe
  const c = new Uint8Array(alvo)
  assert(misturarNevoa(c, alvo, 0.05, 0.35) === false && c.every((v, k) => v === alvo[k]), 'já no alvo: nada muda e devolve false')
  // dt inválido (NaN, negativo, zero) não altera nada (Review Focus 5: aba em segundo plano / relógio estranho)
  for (const dt of [Number.NaN, -1, 0, Number.POSITIVE_INFINITY * 0]) {
    const d = new Uint8Array([10, 20, 30, 40])
    const copia = new Uint8Array(d)
    assert(misturarNevoa(d, alvo, dt, 0.35) === false && d.every((v, k) => v === copia[k]), `dt inválido (${dt}) não deve alterar a máscara`)
  }
  // monotonia: a mistura aproxima do alvo, nunca se afasta nem oscila
  const e = new Uint8Array([0])
  let anterior = 0
  for (let k = 0; k < 20; k += 1) {
    misturarNevoa(e, new Uint8Array([200]), 0.03, 0.35)
    assert(e[0] >= anterior && e[0] <= 200, `a mistura deve subir monotonicamente até o alvo (passo ${k}: ${e[0]})`)
    anterior = e[0]
  }
  assert(e[0] === 200, 'a mistura chega ao alvo e para')
  // tamanhos diferentes: erro explícito, nunca leitura fora do vetor
  let lancou = false
  try {
    misturarNevoa(new Uint8Array(3), new Uint8Array(4), 0.1, 0.35)
  } catch {
    lancou = true
  }
  assert(lancou, 'tamanhos diferentes devem lançar erro')
}
