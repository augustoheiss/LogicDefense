import { amostrarFlagstone, amostrarMosaicoRadial, campoDoLadrilho, centrosDeLaje, limparCacheDoLadrilho, REPETICAO_DO_LADRILHO, LAJES_POR_LADO } from './flagstone'
import { fbmTileable } from './ruidoTileavel'
import { pisoDeLajesSample } from './texturasPbrProcedural'
import { Y_SOLO_VISUAL } from './suporteFundacao'

function assert(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem)
}

/** A laje a que o ponto (u, v) pertence: o centro mais próximo no toro. Devolve o índice na lista `centrosDeLaje` e a distância. */
function lajeDoPonto(centros: ReadonlyArray<readonly [number, number]>, u: number, v: number): { indice: number; distancia: number } {
  let indice = 0
  let menor = Infinity
  for (let i = 0; i < centros.length; i += 1) {
    const dx = Math.min(Math.abs(u - centros[i][0]), 1 - Math.abs(u - centros[i][0]))
    const dy = Math.min(Math.abs(v - centros[i][1]), 1 - Math.abs(v - centros[i][1]))
    const d = Math.hypot(dx, dy)
    if (d < menor) { menor = d; indice = i }
  }
  return { indice, distancia: menor }
}

/**
 * A FORMA de cada laje: a razão entre o raio CIRCUNSCRITO (o ponto mais distante do centro dentro da laje) e o INSCRITO (a menor distância do centro à borda). Uma laje quase quadrada mede ~1,4;
 * uma LASCA (comprida e fina) mede 3 ou mais. Amostra o ladrilho numa grade de 360 × 360 e usa só a API pública do módulo (o instrumento fica no teste, não na produção).
 */
function razoesDeForma(seed: number): number[] {
  const centros = centrosDeLaje(seed)
  const R = 360
  const circ = new Array<number>(centros.length).fill(0)
  const insc = new Array<number>(centros.length).fill(Infinity)
  for (let y = 0; y < R; y += 1) {
    for (let x = 0; x < R; x += 1) {
      const u = (x + 0.5) / R
      const v = (y + 0.5) / R
      const { indice, distancia } = lajeDoPonto(centros, u, v)
      circ[indice] = Math.max(circ[indice], distancia)
      // a junta marca a borda: um pixel em cima da junta fixa o raio inscrito da laje mais próxima
      if (amostrarFlagstone(u, v, seed).juntaDistancia < 0.004) insc[indice] = Math.min(insc[indice], distancia)
    }
  }
  const razoes: number[] = []
  for (let i = 0; i < centros.length; i += 1) if (Number.isFinite(insc[i]) && insc[i] > 0) razoes.push(circ[i] / insc[i])
  return razoes
}

/** O controle positivo do instrumento de forma: uma GRADE REGULAR de lajes quadradas (a razão teórica é √2 ≈ 1,41; a discretização dá ~1,44). */
function razoesDeFormaDaGrade(): number {
  const n = LAJES_POR_LADO
  const lado = 1 / n
  // o centro de uma laje quadrada a 0 do jitter: raio inscrito = lado/2, circunscrito = lado·√2/2 (o canto); a razão é √2. Amostrada como o instrumento real amostra, com a mesma resolução.
  const R = 360
  let circ = 0
  let insc = Infinity
  for (let y = 0; y < R; y += 1) {
    for (let x = 0; x < R; x += 1) {
      const u = ((x + 0.5) / R) % lado
      const v = ((y + 0.5) / R) % lado
      if (Math.floor(((x + 0.5) / R) * n) !== 0 || Math.floor(((y + 0.5) / R) * n) !== 0) continue
      const d = Math.hypot(u - lado / 2, v - lado / 2)
      circ = Math.max(circ, d)
      const dBorda = Math.min(u, lado - u, v, lado - v)
      if (dBorda < 0.004) insc = Math.min(insc, d)
    }
  }
  return circ / insc
}

/** A largura da junta ao longo de cortes que atravessam as fronteiras: de cada ponto de junta (a altura < 0,5), caminha em 8 direções até a altura voltar a 0,5 e guarda a MENOR travessia. */
function largurasDeJunta(seed: number): number[] {
  const larguras: number[] = []
  const passo = 0.0008
  for (let i = 0; i < 24; i += 1) {
    for (let j = 0; j < 24; j += 1) {
      const u = (i + 0.37) / 24
      const v = (j + 0.61) / 24
      const s = amostrarFlagstone(u, v, seed)
      if (s.altura >= 0.5 || s.juntaDistancia < 0.0005) continue
      let menor = Infinity
      for (let a = 0; a < 8; a += 1) {
        const ang = (a * Math.PI) / 4 + 0.3
        let dist = 0
        while (dist < 0.1 && amostrarFlagstone(u + Math.cos(ang) * dist, v + Math.sin(ang) * dist, seed).altura < 0.5) dist += passo
        let dist2 = 0
        while (dist2 < 0.1 && amostrarFlagstone(u - Math.cos(ang) * dist2, v - Math.sin(ang) * dist2, seed).altura < 0.5) dist2 += passo
        menor = Math.min(menor, dist + dist2)
      }
      if (Number.isFinite(menor) && menor < 0.1) larguras.push(menor)
    }
  }
  return larguras
}

/**
 * O PISO DE LAJES IRREGULARES (24/11/2026, F1 Task 9): lógica PURA, testada no Node. A estrada era `pedraLavradaSample` com 4 colunas × 6 fileiras de lajes RETANGULARES do mesmo tamanho (aparelho de
 * tijolo), repetida 3 × 14 vezes numa caixa de 8 × 42 m: cada laje media ~0,67 × 0,5 m e o padrão de 24 lajes voltava a cada ~3 m. É o «xadrez» que se vê nas fotos. Aqui as lajes saem de um
 * diagrama de Voronoi com jitter (tamanhos e formas diferentes) e a junta é a distância `F2 − F1` (a diferença entre o vizinho mais próximo e o segundo mais próximo: zero na fronteira entre duas lajes).
 */
/**
 * CONTRATO da INTEGRAÇÃO do piso em `texturasPbrProcedural.ts` (24/11/2026). Lê o TEXTO do arquivo (o gerador de textura precisa de um canvas e roda no navegador, não no Node): garante que a
 * estrada deixou de ser o aparelho de tijolo (`pedraLavradaSample`, 4 × 6 lajes iguais, repetido 3 × 14) e usa o Voronoi com a repetição de `REPETICAO_DO_LADRILHO`.
 */
export function contratoDaTextura(texturas: string): void {
  const codigo = texturas
    .split(/\r?\n/)
    .filter((linha) => !/^\s*(\/\/|\*|\/\*)/.test(linha))
    .join('\n')
  // A estrada lê o CAMPO calculado uma vez (`campoDoLadrilho`), não `amostrarFlagstone` por pixel: o desenho das lajes não depende do bioma, e recalculá-lo a cada troca custava ~121 ms a 512 px.
  assert(/import \{[^}]*\bcampoDoLadrilho\b[^}]*\} from '\.\/flagstone'/.test(codigo), 'o gerador de texturas importa `campoDoLadrilho` (o desenho das lajes é calculado UMA vez, não uma por bioma)')
  assert(/campoDoLadrilho\(res, seed\)/.test(codigo), 'o amostrador da estrada lê o campo do ladrilho na resolução da textura')
  assert(!/amostrarFlagstone\(u, v, /.test(codigo), 'a estrada NÃO amostra `amostrarFlagstone` por pixel (era o caminho caro: 139 ms a 512 px por bioma)')
  // O GRÃO da estrada também sai do campo (24/11): era a maior fatia que sobrou do pacote do bioma (33 ms a 512 px, 25% das chamadas de ruído) e NÃO depende do bioma.
  assert(/campo\.grao\[/.test(codigo), 'o grão da estrada é lido do campo (calculado uma vez para os 6 biomas)')
  assert(!/const grao = fbmTileable\(u, v, 24, 3, seed \+ 17\)/.test(codigo), 'a estrada NÃO recalcula o grão por pixel (fBm de 3 oitavas × 262.144 pixels a cada troca de bioma)')
  assert(!/pedraLavradaSample\(u, v, estBase, estRej, 4, 6, 303\)/.test(codigo), 'a estrada NÃO usa mais o aparelho de tijolo 4 × 6 (o xadrez)')
  assert(/REPETICAO_DO_LADRILHO\.largura, REPETICAO_DO_LADRILHO\.comprimento/.test(codigo), 'a repetição da textura da estrada vem de `REPETICAO_DO_LADRILHO` (uma fonte só)')
  assert(!/construirTrioPbr\(resDetalhe, 3, 14,/.test(codigo), 'a repetição antiga 3 × 14 (o padrão que voltava a cada ~3 m) saiu')
}

/**
 * CONTRATO «SEM RUA» em `TerrenoBiomaCena.tsx` e `CenaBiomaVisual.tsx` (25/11/2026, decisão do usuário: «essa rua não era pra existir, ela fazia parte de um outro jogo… tem que ser diferente cada
 * minimapa, e não com essa rua em todos»). A estrada de lajes (caixa 8 × 42 m), os dois meios-fios e a praça circular vinham do corredor de portões do LogicDefense e se repetiam IDÊNTICOS em todo quadrado.
 * O terreno de um quadrado é o CHÃO (o plano de hoje ou o relevo) e os marcos de fronteira, nada mais: o que torna um minimapa diferente do outro é o bioma, o relevo, as lagoas e os recursos.
 * Trava por INVENTÁRIO (as geometrias que o terreno desenha) e não só por ausência de nomes: quem acrescentar uma peça fixa que se repete em todo quadrado faz este teste falhar e precisa decidir de propósito.
 */
export function contratoSemRua(terreno: string, cenaBioma?: string): void {
  const codigo = terreno
    .split(/\r?\n/)
    .filter((linha) => !/^\s*(\/\/|\*|\/\*)/.test(linha))
    .join('\n')
  // o inventário exato: o plano principal, o pilar do marco e o octaedro do marco (UMA declaração de cada, o `.map` dos 8 marcos as repete)
  const geometrias = (codigo.match(/<[a-zA-Z]+Geometry\b/g) ?? []).map((g) => g.slice(1)).sort()
  assert(
    JSON.stringify(geometrias) === JSON.stringify(['boxGeometry', 'octahedronGeometry', 'planeGeometry']),
    `o terreno desenha SÓ o plano do chão e os marcos de fronteira (planeGeometry + boxGeometry + octahedronGeometry); veio ${JSON.stringify(geometrias)}: uma peça fixa a mais se repetiria em TODO quadrado (a rua era isso)`,
  )
  // o pilar do marco é a ÚNICA caixa: 0,42 × 0,9 × 0,42 (a estrada era 8 × 0,2 × 42 e o meio-fio 0,28 × 0,28 × 42,2)
  assert(/<boxGeometry args=\{\[0\.42, 0\.9, 0\.42\]\} \/>/.test(codigo), 'a única caixa do terreno é o pilar do marco (0,42 × 0,9 × 0,42)')
  assert(!/mostrarEstrada/.test(codigo), 'o terreno não tem mais a prop `mostrarEstrada`: a rua saiu do cenário')
  assert(!/texturaDaPraca|estradaCor|texturas\?\.estrada/.test(codigo), 'o terreno não usa mais a textura nem as cores da estrada e da praça')
  assert(!/useMemo|useEffect/.test(codigo), 'sem o clone da textura da praça o terreno não precisa de `useMemo`/`useEffect`')
  assert((codigo.match(/<planeGeometry/g) ?? []).length === 1 && /MARCOS_FRONTEIRA\.map/.test(codigo), 'o plano do chão e os marcos de fronteira continuam no terreno')
  if (cenaBioma !== undefined) {
    const cena = cenaBioma
      .split(/\r?\n/)
      .filter((linha) => !/^\s*(\/\/|\*|\/\*)/.test(linha))
      .join('\n')
    assert(!/mostrarEstrada/.test(cena), '`CenaBiomaVisual` não passa mais `mostrarEstrada` ao terreno')
  }
}

/**
 * CONTRATO da ALTURA DO PLANO DA NÉVOA (24/11/2026, reescrito em 25/11 sem a rua). O plano de névoa pintada fica a `Y_SOLO_VISUAL + ALTURA_DO_PLANO` e tem de ficar ABAIXO do pé de quem anda (o herói e as
 * tropas, em y = 0 no mundo, que a névoa nunca pode cortar). Antes havia uma 2ª fronteira, por BAIXO: o plano tinha de cobrir o topo do cenário raso (a estrada e os MEIOS-FIOS, que atravessavam a névoa e
 * desenhavam duas linhas claras nas bordas da estrada «nunca vista»: o plano estava em −0,22, o topo do meio-fio em −0,17). A rua saiu do cenário (decisão do usuário, 25/11) e com ela essa fronteira:
 * o terreno não tem mais NENHUMA peça rasa (as únicas caixas são os pilares dos marcos, de 0,9 m, que o plano esconde de propósito). O teste LÊ isso do código: peça rasa nova volta a pedir a fronteira.
 */
export function contratoDaAlturaDaNevoa(terreno: string, nevoa: string): void {
  const sem = (t: string) => t.split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')
  const tCodigo = sem(terreno)
  const nCodigo = sem(nevoa)
  const alturaDoPlano = Number((nCodigo.match(/const ALTURA_DO_PLANO = ([0-9.]+)/) ?? [])[1])
  assert(Number.isFinite(alturaDoPlano), 'o código da névoa declara `const ALTURA_DO_PLANO = <número>`')
  const yPlano = Y_SOLO_VISUAL + alturaDoPlano
  // as peças RASAS do terreno, LIDAS do código (`<mesh position={[x, y, z]}>` seguido de `<boxGeometry args={[l, ALTURA, c]} />` ou `<cylinderGeometry args={[r1, r2, ALTURA, n]} />`): centro Y entre o chão
  // (−0,45) e 0 E menos de 0,5 m de altura. Sem a rua NÃO HÁ nenhuma: o pilar do marco tem 0,9 m e fica dentro de um `<group position={[bx, −0,45, bz]}>`, não casa. O INSTRUMENTO tem controle
  // positivo logo abaixo (o mesmo regex acha o meio-fio num texto de exemplo), senão «0 peças» podia ser um regex que não acha nada.
  const lerTopos = (texto: string): Array<{ nome: string; topo: number }> => {
    const achados: Array<{ nome: string; topo: number }> = []
    const re = /position=\{\[([^\]]+)\]\}[^>]*>\s*<(boxGeometry|cylinderGeometry) args=\{\[([^\]]+)\]\}/g
    let m: RegExpExecArray | null
    while ((m = re.exec(texto)) !== null) {
      const pos = m[1].split(',').map((s) => Number(s.trim()))
      const args = m[3].split(',').map((s) => Number(s.trim()))
      const altura = m[2] === 'boxGeometry' ? args[1] : args[2]
      if (Number.isFinite(pos[1]) && Number.isFinite(altura) && pos[1] > Y_SOLO_VISUAL && pos[1] < 0 && altura < 0.5) achados.push({ nome: `${m[2]} y=${pos[1]} h=${altura}`, topo: pos[1] + altura / 2 })
    }
    return achados
  }
  const exemploComMeioFio = '<mesh position={[4.12, -0.31, 20]} receiveShadow={s} raycast={r}>\n<boxGeometry args={[0.28, 0.28, 42.2]} />'
  const controle = lerTopos(exemploComMeioFio)
  assert(controle.length === 1 && Math.abs(controle[0].topo - -0.17) < 1e-9, `o controle do instrumento: um meio-fio de exemplo (y −0,31, h 0,28) é lido como peça rasa com topo em −0,17 (veio ${JSON.stringify(controle)})`)
  const topos = lerTopos(tCodigo)
  assert(topos.length === 0, `o terreno não tem peça RASA (a rua saiu): o teste leu ${topos.length} (${topos.map((t) => t.nome).join('; ')}). Uma peça rasa nova pede de volta a fronteira «o plano da névoa fica ACIMA dela»`)
  assert(yPlano < -0.05, `o plano da névoa (y = ${yPlano.toFixed(3)}) fica ABAIXO de −0,05: o pé do herói e das tropas está em y = 0 e a névoa não pode cortá-los`)
  assert(yPlano > Y_SOLO_VISUAL, `o plano da névoa (y = ${yPlano.toFixed(3)}) fica ACIMA do chão (${Y_SOLO_VISUAL}): abaixo dele a névoa sumiria sob o terreno`)
}

/**
 * CONTRATO do `semPlano` em `TerrenoBiomaCena.tsx` (F2, 25/11/2026). Com o relevo ligado o chão é a malha do `TerrenoRelevoCena`, e a estrada, a praça e os marcos continuam vindo do
 * `TerrenoBiomaCena`: duplicar 80 linhas (e os contratos acima, que leem este arquivo por regex) seria pior. A prop é OPCIONAL e o padrão é `false` (I1: sem ela o terreno é o de hoje, com o plano
 * principal), e SÓ o `<mesh>` do `planeGeometry` fica atrás dela: a estrada, a praça e os marcos não podem sumir com o relevo ligado.
 */
export function contratoDoSemPlano(terreno: string): void {
  const codigo = terreno
    .split(/\r?\n/)
    .filter((linha) => !/^\s*(\/\/|\*|\/\*)/.test(linha))
    .join('\n')
  assert(/readonly semPlano\?: boolean/.test(codigo), 'a prop `semPlano` é OPCIONAL (`semPlano?: boolean`): sem ela o terreno é o de hoje (I1)')
  assert(/\bsemPlano = false\b/.test(codigo), 'o padrão de `semPlano` é `false`: o plano principal continua existindo para quem não passa a prop')
  // o plano principal é o ÚNICO `<mesh>` com `planeGeometry`, e só ele fica atrás de `!semPlano`
  assert((codigo.match(/<planeGeometry/g) ?? []).length === 1, 'o terreno tem um único plano principal (`planeGeometry`)')
  assert(/\{!semPlano && \(\s*<mesh[\s\S]*?<planeGeometry[\s\S]*?<\/mesh>\s*\)\}/.test(codigo), 'o plano principal (e só ele) fica atrás de `{!semPlano && (…)}`')
  // os marcos NÃO dependem de `semPlano` (continuam aparecendo com o relevo ligado)
  assert((codigo.match(/semPlano/g) ?? []).length === 3, '`semPlano` aparece exatamente 3 vezes (o tipo, o padrão e a guarda do plano): nenhuma outra peça depende dele')
  assert(/MARCOS_FRONTEIRA\.map/.test(codigo), 'os marcos de fronteira continuam no terreno, FORA da guarda do plano')
  assert(!/\{!semPlano && \([\s\S]*?MARCOS_FRONTEIRA[\s\S]*?<\/mesh>\s*\)\}/.test(codigo), 'os marcos não ficam DENTRO da guarda do plano (sumiriam com o relevo ligado)')
}

export function run(texturas?: string, terreno?: string, nevoa?: string, cenaBioma?: string): void {
  if (texturas !== undefined) contratoDaTextura(texturas)
  if (terreno !== undefined) contratoSemRua(terreno, cenaBioma)
  if (terreno !== undefined) contratoDoSemPlano(terreno)
  if (terreno !== undefined && nevoa !== undefined) contratoDaAlturaDaNevoa(terreno, nevoa)

  // ── (PRIMEIRO, antes dos testes que dependem da amostra, para não ser mascarado por uma falha anterior) A ESCALA DA LAJE: o tamanho de uma laje na estrada, em METROS. A 1ª versão (5 lajes por lado) dava ~1,6 m numa estrada de 8 m: mosaico de pedras gigantes, não uma estrada antiga (24/11).
  //    O mutante «5 lajes por lado» morria só por um efeito colateral (poucas juntas na amostra), e nada travava a densidade de fato. A estrada mede 8 m de largura e o ladrilho se repete
  //    `REPETICAO_DO_LADRILHO.largura` vezes nela: o lado de uma laje é 8 m / (LAJES_POR_LADO × repetição na largura). Laje de calçada de verdade: de 0,5 a 1,25 m. ───────────────────────────────
  {
    const larguraDaEstradaM = 8
    const ladoDaLajeM = larguraDaEstradaM / (LAJES_POR_LADO * REPETICAO_DO_LADRILHO.largura)
    assert(ladoDaLajeM >= 0.5 && ladoDaLajeM <= 1.25, `a laje da estrada mede ~${ladoDaLajeM.toFixed(2)} m de lado (precisa ficar entre 0,5 e 1,25 m: acima disso é mosaico de pedras gigantes; abaixo, o xadrez miúdo de volta)`)
    // o ladrilho se repete no comprimento, e o intervalo entre repetições é o que o olho reconhece como padrão: 42 m / repetição
    const periodoNoComprimentoM = 42 / REPETICAO_DO_LADRILHO.comprimento
    assert(periodoNoComprimentoM >= 5, `o desenho se repete a cada ${periodoNoComprimentoM.toFixed(1)} m ao longo da estrada (precisa de ao menos 5 m: o xadrez antigo repetia a cada ~3 m)`)
  }


  // ── SEM EMENDA: a textura se repete em ladrilhos, e uma emenda visível entre dois ladrilhos seria um defeito PIOR que o xadrez ──────────────────────────────────────────────────────────────────
  // O teste ANTIGO comparava `f(0, v)` com `f(1, v)`, mas `amostrarFlagstone` reduz `u` e `v` a [0, 1) antes de calcular, então `f(1, v)` é SEMPRE `f(0, v)`: era verdadeiro por construção e
  // NUNCA poderia falhar (24/11: a mutação mostrou que o código real TINHA emenda, em ~35% dos cortes de cada eixo, e o teste passava). A emenda se mede pela CONTINUIDADE: o que há logo antes
  // da borda (1 − ε) tem de ser quase igual ao que há logo depois dela (0 + ε), porque a distância entre os dois é 2ε. A junta também salta, então o controle é o corte INTERNO à mesma
  // distância 2ε: se o interno quase nunca salta, o salto na borda só pode ser emenda.
  const SEMENTES = [303, 17, 9001]
  const EPS = 1e-4
  for (const seed of SEMENTES) {
    let saltosBordaX = 0
    let saltosBordaY = 0
    let saltosInternos = 0
    const N = 800
    for (let k = 0; k < N; k += 1) {
      const t = (k + 0.5) / N
      if (Math.abs(amostrarFlagstone(1 - EPS, t, seed).altura - amostrarFlagstone(0 + EPS, t, seed).altura) > 0.05) saltosBordaX += 1
      if (Math.abs(amostrarFlagstone(t, 1 - EPS, seed).altura - amostrarFlagstone(t, 0 + EPS, seed).altura) > 0.05) saltosBordaY += 1
      if (Math.abs(amostrarFlagstone(0.5 - EPS, t, seed).altura - amostrarFlagstone(0.5 + EPS, t, seed).altura) > 0.05) saltosInternos += 1
    }
    // O controle positivo do próprio instrumento: um corte interno quase nunca salta (a junta é fina: ~3% da laje). Se o interno saltasse muito, o instrumento não distinguiria emenda de junta.
    assert(saltosInternos / N < 0.05, `seed ${seed}: o corte INTERNO quase nunca salta (${saltosInternos}/${N}): o instrumento distingue emenda de junta`)
    // Uma junta que cai EXATAMENTE em cima da borda do ladrilho não é emenda: o limite é o do interno (5%) com folga, e uma emenda de verdade passa de 30%.
    assert(saltosBordaX / N < 0.1, `seed ${seed}: sem emenda na borda x (${saltosBordaX}/${N} cortes saltam; uma emenda real passa de 30%)`)
    assert(saltosBordaY / N < 0.1, `seed ${seed}: sem emenda na borda y (${saltosBordaY}/${N} cortes saltam; uma emenda real passa de 30%)`)
  }
  // A periodicidade exata continua valendo (a função reduz ao ladrilho), e é barata de provar: f(p) = f(p + 1) em pontos internos. NÃO prova a ausência de emenda (era o erro do teste antigo).
  for (let i = 0; i < 200; i += 1) {
    const u = (i * 0.6180339887) % 1
    const v = (i * 0.7548776662) % 1
    assert(amostrarFlagstone(u, v, 303).altura === amostrarFlagstone(u + 1, v, 303).altura && amostrarFlagstone(u, v, 303).altura === amostrarFlagstone(u, v + 1, 303).altura, `f(p) = f(p + 1) em (${u}, ${v})`)
  }

  // ── DETERMINÍSTICO e FINITO, com os valores no intervalo que o gerador de textura espera ────────────────────────────────────────────────────────────────────────────────────────────────────
  const a = amostrarFlagstone(0.31, 0.77, 303)
  const b = amostrarFlagstone(0.31, 0.77, 303)
  assert(a.altura === b.altura && a.tom === b.tom && a.juntaDistancia === b.juntaDistancia, 'mesma entrada, mesma saída')
  assert(amostrarFlagstone(0.31, 0.77, 303).tom !== amostrarFlagstone(0.31, 0.77, 17).tom || amostrarFlagstone(0.31, 0.77, 303).altura !== amostrarFlagstone(0.31, 0.77, 17).altura, 'a semente muda o desenho (cada bioma tem o seu)')
  let minAlt = Infinity
  let maxAlt = -Infinity
  let minTom = Infinity
  let maxTom = -Infinity
  let minJ = Infinity
  for (let i = 0; i < 64; i += 1) {
    for (let j = 0; j < 64; j += 1) {
      const s = amostrarFlagstone(i / 64, j / 64, 303)
      assert(Number.isFinite(s.altura) && Number.isFinite(s.tom) && Number.isFinite(s.juntaDistancia), `valor finito em (${i},${j})`)
      minAlt = Math.min(minAlt, s.altura)
      maxAlt = Math.max(maxAlt, s.altura)
      minTom = Math.min(minTom, s.tom)
      maxTom = Math.max(maxTom, s.tom)
      minJ = Math.min(minJ, s.juntaDistancia)
    }
  }
  assert(minAlt >= 0 && maxAlt <= 1, `a altura fica em [0, 1] (veio ${minAlt.toFixed(3)}..${maxAlt.toFixed(3)})`)
  assert(minTom >= 0 && maxTom <= 1, `o tom fica em [0, 1] (veio ${minTom.toFixed(3)}..${maxTom.toFixed(3)})`)
  assert(minJ >= 0, 'a distância de junta nunca é negativa')
  // o desenho TEM juntas E lajes: se a altura fosse constante, a textura seria um bloco liso (o teste que vê as duas coisas)
  assert(maxAlt - minAlt > 0.5, `a altura varia de verdade (junta fundo, laje alto): amplitude ${(maxAlt - minAlt).toFixed(3)}`)
  assert(maxTom - minTom > 0.3, `o tom varia entre lajes: amplitude ${(maxTom - minTom).toFixed(3)} (lajes todas da mesma cor seriam o xadrez de volta)`)

  // ── O TOM É DA LAJE, NÃO DO PIXEL: dentro de uma laje o tom é CONSTANTE, e lajes vizinhas diferem. (O mutante «tom por pixel/por célula da grade» sobreviveu: o teste só via que o tom VARIA no
  //    ladrilho, e um tom por célula de grade também varia.) Para cada pixel de topo de laje (bem longe da junta) o tom tem de ser igual ao do centro da MESMA laje. ───────────────────────────────
  {
    const centros = centrosDeLaje(303)
    let comparados = 0
    let divergentes = 0
    const tonsPorLaje = new Map<number, Set<number>>()
    for (let y = 0; y < 200; y += 1) {
      for (let x = 0; x < 200; x += 1) {
        const u = (x + 0.5) / 200
        const v = (y + 0.5) / 200
        const s = amostrarFlagstone(u, v, 303)
        if (s.juntaDistancia < 0.02) continue // só o interior da laje
        const { indice } = lajeDoPonto(centros, u, v)
        const tons = tonsPorLaje.get(indice) ?? new Set<number>()
        tons.add(+s.tom.toFixed(9))
        tonsPorLaje.set(indice, tons)
        comparados += 1
      }
    }
    for (const tons of tonsPorLaje.values()) if (tons.size > 1) divergentes += 1
    assert(comparados > 5000, `o teste do tom comparou ${comparados} pixels de interior de laje (precisa de mais de 5000)`)
    assert(divergentes === 0, `cada laje tem UM tom só: ${divergentes} de ${tonsPorLaje.size} lajes têm mais de um tom dentro dela (tom por pixel viraria ruído)`)
    // e lajes diferentes têm tons diferentes em quantidade (senão todas teriam o mesmo tom, que é o xadrez de volta)
    const distintos = new Set([...tonsPorLaje.values()].map((t) => [...t][0]))
    assert(distintos.size > tonsPorLaje.size * 0.8, `lajes diferentes têm tons diferentes (${distintos.size} tons em ${tonsPorLaje.size} lajes)`)
  }

  // ── A JUNTA É A FRONTEIRA ENTRE LAJES: quanto menor `juntaDistancia`, mais perto da junta, e a altura cai lá ──────────────────────────────────────────────────────────────────────────────────
  let somaAltJunta = 0
  let nJunta = 0
  let somaAltLaje = 0
  let nLaje = 0
  for (let i = 0; i < 96; i += 1) {
    for (let j = 0; j < 96; j += 1) {
      const s = amostrarFlagstone(i / 96, j / 96, 303)
      // `juntaDistancia` é a distância EXATA à borda da laje (a laje de 8 por lado mede ~0,125 do ladrilho, então o ponto mais interno fica a ~0,06 da borda): «junta» é < 0,006, «laje» é > 0,03
      if (s.juntaDistancia < 0.006) { somaAltJunta += s.altura; nJunta += 1 }
      else if (s.juntaDistancia > 0.03) { somaAltLaje += s.altura; nLaje += 1 }
    }
  }
  assert(nJunta > 50 && nLaje > 500, `a amostra tem juntas (${nJunta}) e lajes (${nLaje}) em quantidade`)
  assert(somaAltJunta / nJunta < somaAltLaje / nLaje - 0.2, `a junta é mais BAIXA que a laje (junta ${(somaAltJunta / nJunta).toFixed(2)}, laje ${(somaAltLaje / nLaje).toFixed(2)})`)

  // ── NÃO É UMA GRADE: o desvio-padrão da distância entre centros de laje vizinhas passa de 15% da média (o contrário do xadrez) ────────────────────────────────────────────────────────────────
  for (const seed of SEMENTES) {
    const centros = centrosDeLaje(seed)
    assert(centros.length === LAJES_POR_LADO * LAJES_POR_LADO, `há ${LAJES_POR_LADO * LAJES_POR_LADO} lajes por ladrilho (veio ${centros.length})`)
    // para cada laje, a distância ao centro MAIS PRÓXIMO de outra laje (o vizinho), no toro (a textura é periódica)
    const dists: number[] = []
    for (let i = 0; i < centros.length; i += 1) {
      let menor = Infinity
      for (let j = 0; j < centros.length; j += 1) {
        if (i === j) continue
        let dx = Math.abs(centros[i][0] - centros[j][0])
        let dy = Math.abs(centros[i][1] - centros[j][1])
        dx = Math.min(dx, 1 - dx)
        dy = Math.min(dy, 1 - dy)
        menor = Math.min(menor, Math.hypot(dx, dy))
      }
      dists.push(menor)
    }
    const media = dists.reduce((s, x) => s + x, 0) / dists.length
    const desvio = Math.sqrt(dists.reduce((s, x) => s + (x - media) ** 2, 0) / dists.length)
    assert(desvio / media > 0.15, `seed ${seed}: as lajes NÃO formam uma grade (desvio/média = ${(desvio / media).toFixed(3)}, precisa passar de 0,15)`)
  }
  // controle positivo do próprio instrumento: uma GRADE de verdade tem desvio ~0, e a medida tem de enxergar isso (senão o teste acima não mede nada)
  const grade: Array<[number, number]> = []
  for (let i = 0; i < LAJES_POR_LADO; i += 1) for (let j = 0; j < LAJES_POR_LADO; j += 1) grade.push([(i + 0.5) / LAJES_POR_LADO, (j + 0.5) / LAJES_POR_LADO])
  const dg: number[] = grade.map((p, i) => {
    let menor = Infinity
    grade.forEach((q, j) => {
      if (i === j) return
      const dx = Math.min(Math.abs(p[0] - q[0]), 1 - Math.abs(p[0] - q[0]))
      const dy = Math.min(Math.abs(p[1] - q[1]), 1 - Math.abs(p[1] - q[1]))
      menor = Math.min(menor, Math.hypot(dx, dy))
    })
    return menor
  })
  const mg = dg.reduce((s, x) => s + x, 0) / dg.length
  const dvg = Math.sqrt(dg.reduce((s, x) => s + (x - mg) ** 2, 0) / dg.length)
  assert(dvg / mg < 0.001, `controle positivo: uma grade regular tem desvio/média ~0 (veio ${(dvg / mg).toExponential(2)}); o instrumento enxerga o xadrez`)

  // ── O CAMPO DO LADRILHO É CALCULADO UMA VEZ: o desenho das lajes (altura e tom por pixel) NÃO depende do bioma (a semente é a mesma, 303), só a COR muda. Medido em 24/11: amostrar 512 × 512 pixels
  //    custa ~139 ms (8× a estrada antiga) e a troca de bioma já custava ~156 ms; recalcular o mesmo desenho 6 vezes (uma por bioma) seria 120 ms jogados fora a cada troca. ────────────────────
  {
    limparCacheDoLadrilho()
    const res = 64
    const c1 = campoDoLadrilho(res, 303)
    const c2 = campoDoLadrilho(res, 303)
    assert(c1 === c2, 'a segunda chamada devolve o MESMO objeto (cache): o desenho das lajes é calculado uma vez, não uma por bioma')
    assert(c1.altura.length === res * res && c1.tom.length === res * res, `o campo tem ${res} × ${res} pixels`)
    // o campo é EXATAMENTE o que `amostrarFlagstone` daria no centro de cada pixel (a mesma convenção da textura: u = x / res, no canto do pixel)
    let maiorDif = 0
    for (let y = 0; y < res; y += 1) {
      for (let x = 0; x < res; x += 1) {
        const s = amostrarFlagstone(x / res, y / res, 303)
        maiorDif = Math.max(maiorDif, Math.abs(c1.altura[y * res + x] - s.altura), Math.abs(c1.tom[y * res + x] - s.tom))
      }
    }
    assert(maiorDif < 1e-6, `o campo coincide com a amostragem direta (maior diferença ${maiorDif.toExponential(2)}; Float32 tem ~1e-7)`)
    // O GRÃO da estrada (`fbmTileable(u, v, 24, 3, seed + 17)`) também é do campo: ele só depende de (u, v, semente), NUNCA do bioma, e custava 33 ms a 512 px (a maior fatia que sobrou do pacote do bioma)
    // a CADA troca de bioma. É a MESMA função, sem aproximação: o grão do campo tem de ser IDÊNTICO ao calculado direto (não é uma grade grossa: a frequência de 96 ciclos viola Nyquist).
    assert(c1.grao.length === res * res, `o campo tem o grão (${res} × ${res} pixels)`)
    let maiorGrao = 0
    for (let y = 0; y < res; y += 1) for (let x = 0; x < res; x += 1) maiorGrao = Math.max(maiorGrao, Math.abs(c1.grao[y * res + x] - fbmTileable(x / res, y / res, 24, 3, 303 + 17)))
    assert(maiorGrao < 1e-6, `o grão do campo é IDÊNTICO ao fBm direto (maior diferença ${maiorGrao.toExponential(2)}): sem aproximação, só calculado uma vez`)
    // semente diferente = grão diferente (o grão leva a semente: `seed + 17`)
    let difSemente = 0
    const c17 = campoDoLadrilho(res, 17)
    for (let i = 0; i < 500; i += 1) if (Math.abs(c17.grao[i * 7 % (res * res)] - c1.grao[i * 7 % (res * res)]) > 1e-3) difSemente += 1
    assert(difSemente > 250, `outra semente, outro grão (${difSemente} de 500 amostras diferem)`)
    // resolução ou semente diferentes NÃO podem servir o campo errado
    assert(campoDoLadrilho(res, 17) !== c1, 'outra semente, outro campo (o cache não serve o desenho de outro bioma)')
    assert(campoDoLadrilho(32, 303) !== c1 && campoDoLadrilho(32, 303).altura.length === 32 * 32, 'outra resolução, outro campo')
    // o cache NÃO cresce sem limite: o jogo tem 3 resoluções e 6 biomas, e quem guarda o campo de cada um seguraria memória à toa
    limparCacheDoLadrilho()
    for (let s = 0; s < 12; s += 1) campoDoLadrilho(16, 1000 + s)
    assert(limparCacheDoLadrilho() <= 4, 'o cache guarda no máximo 4 campos (os mais recentes): a memória não cresce com o número de sementes')
    // entrada ruim nunca quebra: resolução 0, negativa, NaN ou fracionária vira um campo válido (nunca um array de tamanho estranho)
    for (const ruim of [0, -5, Number.NaN, 1.7]) {
      const c = campoDoLadrilho(ruim, 303)
      assert(c.altura.length >= 1 && Number.isInteger(Math.sqrt(c.altura.length)), `resolução inválida (${String(ruim)}) vira um campo quadrado válido (${c.altura.length} pixels)`)
    }
  }

  // ── A COR DA ESTRADA É A MESMA DE ANTES, PIXEL A PIXEL. As otimizações (o desenho das lajes e o grão calculados UMA vez e guardados) só valem se o jogador vir a MESMA estrada. A fórmula ANTIGA está aqui,
  //    escrita como era (altura e tom do `amostrarFlagstone` direto, e o grão pelo `fbmTileable` direto, por pixel), e é comparada com `pisoDeLajesSample`, que lê tudo do campo em cache. O mutante «a estrada lê o
  //    grão do pixel errado (uma linha deslocada)» sobreviveu a um teste que só provava «o grão do campo bate com o fBm»: nada olhava a LEITURA do campo, que é onde um índice trocado se esconde (24/11). ────────
  {
    const res2 = 64
    const base: [number, number, number] = [148, 163, 184]
    const rejunte: [number, number, number] = [71, 85, 105]
    limparCacheDoLadrilho()
    let maiorDif = 0
    let canais = 0
    for (let y = 0; y < res2; y += 1) {
      for (let x = 0; x < res2; x += 1) {
        const u = x / res2
        const v = y / res2
        const nova = pisoDeLajesSample(u, v, res2, base, rejunte, 303)
        // a fórmula ANTIGA, por pixel
        const laje = amostrarFlagstone(u, v, 303)
        const grao = fbmTileable(u, v, 24, 3, 303 + 17)
        const fatorTom = 0.82 + laje.tom * 0.36 + (grao - 0.5) * 0.14
        const t = Math.min(1, laje.altura * 1.15)
        for (let c = 0; c < 3; c += 1) {
          const esperado = rejunte[c] + (base[c] * fatorTom - rejunte[c]) * t
          maiorDif = Math.max(maiorDif, Math.abs(nova.rgb[c] - esperado))
          canais += 1
        }
        maiorDif = Math.max(maiorDif, Math.abs(nova.h - laje.altura * (0.7 + grao * 0.3)) * 255, Math.abs(nova.rough - (0.96 - laje.altura * 0.26 + grao * 0.06)) * 255)
      }
    }
    assert(canais === res2 * res2 * 3, `o teste comparou ${canais} canais (esperava ${res2 * res2 * 3})`)
    // Float32 do campo tem ~1e-7: sobre uma cor de 0 a 255 isso é ~3e-5. Uma linha deslocada dá diferenças de ordem 1 a 20.
    assert(maiorDif < 0.01, `a estrada de hoje é IGUAL à de antes das otimizações em todos os pixels (maior diferença ${maiorDif.toFixed(5)} níveis; um índice trocado dá ordem 1 ou mais)`)
  }

  // ── A BORDA DA LAJE É SUAVE (smoothstep), não um degrau: a altura entra na junta com derivada ZERO, e o mapa normal (que vem da altura) não ganha uma quina. O mutante «altura linear» mudava 32%
  //    dos pontos (até 0,096) e sobreviveu: nenhum teste olhava a forma da transição. Em `t` pequeno o smoothstep vale ≈ 3t² (quase zero); o linear vale t. Mede-se a inclinação da altura em função
  //    da distância à borda, bem na entrada da borda: no smoothstep ela é ~0, no linear é 1/BORDA. ───────────────────────────────────────────────────────────────────────────────────────────────────
  {
    // acha pontos cuja distância à borda é pequena mas já fora da junta funda, e mede a inclinação local d(altura)/d(distância) por duas amostras próximas
    let inclinacoesNaEntrada = 0
    let n = 0
    for (let y = 0; y < 300; y += 1) {
      for (let x = 0; x < 300; x += 1) {
        const u = (x + 0.41) / 300
        const v = (y + 0.59) / 300
        const a = amostrarFlagstone(u, v, 303)
        // bem no começo da subida: logo acima da junta funda (junta ≈ 0,004 → altura ainda < 0,05)
        if (a.juntaDistancia > 0.0045 && a.juntaDistancia < 0.0055) {
          const b = amostrarFlagstone(u + 1e-5, v, 303)
          const dd = b.juntaDistancia - a.juntaDistancia
          if (Math.abs(dd) > 1e-7) {
            inclinacoesNaEntrada += Math.abs((b.altura - a.altura) / dd)
            n += 1
          }
        }
      }
    }
    assert(n > 20, `o teste da suavidade mediu ${n} pontos na entrada da borda (precisa de mais de 20)`)
    const inclinacaoMedia = inclinacoesNaEntrada / n
    // linear: 1/BORDA = 83. smoothstep na entrada (t ≈ 0,05): 6t(1−t)/BORDA ≈ 25. O limite 45 separa as duas com folga dos dois lados.
    assert(inclinacaoMedia < 45, `a altura entra na borda SUAVE (inclinação média ${inclinacaoMedia.toFixed(1)}; o linear daria ~83 e o smoothstep ~25): sem isso o mapa normal ganha uma quina`)
  }

  // ── A VIZINHANÇA 3 × 3 BASTA (com jitter 0,28 e 8 lajes por lado), e é isto que a protege de um jitter maior depois. O mutante «só 3 × 3» era EQUIVALENTE (0 de 187.500 pontos diferiam), e a
  //    textura é gerada pixel a pixel na troca de bioma, então 9 centros em vez de 25 por pixel corta ~64% do trabalho. A referência é uma busca EXAUSTIVA de 7 × 7 escrita aqui no teste, sem ler o módulo. ──
  {
    const N = LAJES_POR_LADO
    // reimplementação de referência: centro de cada célula do toro pela MESMA fórmula pública (centrosDeLaje), 7×7 vizinhos, borda por bisector
    const centros = centrosDeLaje(303)
    const ref = (u: number, v: number): { junta: number } => {
      const cx = Math.floor(u * N)
      const cy = Math.floor(v * N)
      const pts: Array<[number, number]> = []
      for (let dy = -3; dy <= 3; dy += 1) {
        for (let dx = -3; dx <= 3; dx += 1) {
          const ix = cx + dx
          const iy = cy + dy
          const c = centros[(((iy % N) + N) % N) * N + (((ix % N) + N) % N)]
          pts.push([c[0] + Math.floor(ix / N), c[1] + Math.floor(iy / N)])
        }
      }
      let melhor = pts[0]
      let d1 = Infinity
      for (const p of pts) { const d = Math.hypot(u - p[0], v - p[1]); if (d < d1) { d1 = d; melhor = p } }
      let borda = Infinity
      for (const p of pts) {
        if (p === melhor) continue
        const sep = Math.hypot(p[0] - melhor[0], p[1] - melhor[1])
        const dj = Math.hypot(u - p[0], v - p[1])
        borda = Math.min(borda, (dj * dj - d1 * d1) / (2 * sep))
      }
      return { junta: Math.max(0, borda) }
    }
    let maiorDif = 0
    for (let i = 0; i < 3000; i += 1) {
      const u = (i * 0.6180339887) % 1
      const v = (i * 0.7548776662) % 1
      maiorDif = Math.max(maiorDif, Math.abs(ref(u, v).junta - amostrarFlagstone(u, v, 303).juntaDistancia))
    }
    assert(maiorDif < 1e-9, `a busca de vizinhança do módulo coincide com a referência exaustiva de 7 × 7 (maior diferença ${maiorDif.toExponential(2)}): a vizinhança não pode ser menor que o necessário`)
  }

  // ── NENHUMA LASCA: a forma de cada laje. Medido em 24/11 com um jitter de 0,42: a pior laje era uma LASCA 4,67 vezes mais comprida que larga (raio circunscrito / inscrito), e a junta por
  //    `F2 − F1` engordava nos vértices agudos (manchas borradas em forma de fuso). Controle positivo: uma grade regular mede 1,44 (o instrumento tem de enxergar isso, senão não mede nada). ─────
  for (const seed of SEMENTES) {
    const forma = razoesDeForma(seed)
    forma.sort((x, y) => x - y)
    const mediana = forma[forma.length >> 1]
    const p90 = forma[Math.floor(forma.length * 0.9)]
    assert(p90 < 3, `seed ${seed}: 90% das lajes têm forma razoável (circunscrito/inscrito p90 = ${p90.toFixed(2)}, precisa ficar abaixo de 3: acima disso há lascas)`)
    assert(mediana > 1.6, `seed ${seed}: as lajes continuam IRREGULARES (mediana ${mediana.toFixed(2)} > 1,6; a grade regular mede 1,44): sem jitter o xadrez volta`)
  }
  assert(Math.abs(razoesDeFormaDaGrade() - 1.44) < 0.05, `controle positivo da forma: uma grade regular mede ~1,44 (veio ${razoesDeFormaDaGrade().toFixed(3)})`)

  // ── A JUNTA TEM LARGURA UNIFORME: a distância EXATA à borda da laje, não `F2 − F1` (que engorda nos vértices agudos e deixa manchas). Mede-se a largura da junta (o trecho da junta em que a
  //    altura ainda está abaixo de 0,5) ao longo de 400 cortes através das fronteiras: a mais larga não pode passar de 2,2× a mais fina. ───────────────────────────────────────────────────────
  const larguras = largurasDeJunta(303)
  assert(larguras.length > 100, `o teste mediu ${larguras.length} cortes de junta (precisa de mais de 100)`)
  larguras.sort((x, y) => x - y)
  const fina = larguras[Math.floor(larguras.length * 0.05)]
  const larga = larguras[Math.floor(larguras.length * 0.95)]
  assert(larga / fina < 2.2, `a junta tem largura uniforme (p95/p5 = ${(larga / fina).toFixed(2)}, precisa ficar abaixo de 2,2: acima disso há manchas gordas nos vértices)`)

  // ── A REPETIÇÃO: o ladrilho repete poucas vezes (a escala das lajes é a de uma laje de verdade, ~0,5–1 m) ─────────────────────────────────────────────────────────────────────────────────────
  assert(REPETICAO_DO_LADRILHO.largura >= 1 && REPETICAO_DO_LADRILHO.comprimento >= 1, 'o ladrilho repete pelo menos uma vez em cada eixo')
  assert(REPETICAO_DO_LADRILHO.comprimento <= 8, `a estrada de 42 m não repete o ladrilho mais de 8× (veio ${REPETICAO_DO_LADRILHO.comprimento}): foi a repetição 14× do ladrilho de 24 lajes que gerou o padrão`)

  // ── MOSAICO RADIAL (a praça): contínuo em ângulo 0 ≡ 2π, e o centro não explode ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
  for (const raio of [0.05, 0.3, 0.6, 0.95]) {
    const m0 = amostrarMosaicoRadial(raio, 0, 303)
    const m2pi = amostrarMosaicoRadial(raio, 2 * Math.PI, 303)
    assert(Math.abs(m0.altura - m2pi.altura) <= 1e-6 && Math.abs(m0.tom - m2pi.tom) <= 1e-6, `o mosaico radial é contínuo em 0 ≡ 2π (raio ${raio}): sem fresta radial na praça`)
    // um ângulo negativo, ou acima de 2π, e o equivalente em [0, 2π) dão o MESMO ponto (a praça gira em volta do centro sem emenda). Compara a ALTURA **e o TOM**: o mutante «sem reduzir o ângulo»
    // divergia só no TOM (até 0,80, em 12 de 24 pares) e a altura coincidia por acaso (1,000 nos dois em raio 0,05), então um teste que só olhava a altura nunca o pegava (24/11).
    const volta = 2 * Math.PI
    for (const ang of [-0.7, -3, -6.2, 7.5, 13, 100]) {
      const equivalente = ((ang % volta) + volta) % volta
      const a = amostrarMosaicoRadial(raio, ang, 303)
      const b = amostrarMosaicoRadial(raio, equivalente, 303)
      assert(Math.abs(a.altura - b.altura) <= 1e-6 && Math.abs(a.tom - b.tom) <= 1e-6, `o ângulo ${ang} e o seu equivalente ${equivalente.toFixed(3)} em [0, 2π) são o MESMO ponto (raio ${raio}): altura ${a.altura.toFixed(3)} × ${b.altura.toFixed(3)}, tom ${a.tom.toFixed(3)} × ${b.tom.toFixed(3)}`)
    }
  }
  for (const [r, ang] of [[0, 0], [0, 1], [1e-9, 5], [1, 0], [2, 3]] as const) {
    const m = amostrarMosaicoRadial(r, ang, 303)
    assert(Number.isFinite(m.altura) && Number.isFinite(m.tom) && m.altura >= 0 && m.altura <= 1 && m.tom >= 0 && m.tom <= 1, `o mosaico radial é finito e em [0,1] em (raio ${r}, ângulo ${ang}), inclusive no centro`)
  }
  assert(!Number.isNaN(amostrarMosaicoRadial(Number.NaN, 1, 303).altura) && !Number.isNaN(amostrarMosaicoRadial(0.5, Number.NaN, 303).altura), 'entrada NaN não vaza NaN para a textura (um NaN vira pixel preto)')
  // o mosaico tem ANÉIS (varia com o raio) e RAIOS (varia com o ângulo): senão é um disco liso
  const porRaio = new Set<number>()
  const porAngulo = new Set<number>()
  for (let i = 0; i < 40; i += 1) { porRaio.add(+amostrarMosaicoRadial(0.1 + i * 0.02, 0.5, 303).altura.toFixed(3)); porAngulo.add(+amostrarMosaicoRadial(0.5, i * 0.15, 303).altura.toFixed(3)) }
  assert(porRaio.size > 3 && porAngulo.size > 3, `o mosaico varia com o raio (${porRaio.size} valores) e com o ângulo (${porAngulo.size} valores)`)
}
