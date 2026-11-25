import type { BiomaId } from '../biomaRecursos'
import { BIOMA_VISUAL_CATALOG } from './biomaVisualCatalog'
import { ambienteDoBioma, ambienteDeveExistir, chaveDoAmbiente, DESLIZE_DO_SOL_GRAUS, direcaoDoSol, fatorDeReflexo, PERIODO_DO_SOL_SEG, posicaoDoSol } from './ceuEIbl'
import { SPEC_QUALIDADE } from './qualidadeGrafica'

function assert(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem)
}

const BIOMAS: readonly BiomaId[] = ['clareira', 'bosque', 'serra_ouro', 'ribeira', 'tundra_cristal', 'basalto_brasa']
const PARA_GRAUS = 180 / Math.PI

/** Elevação (graus acima do horizonte) e azimute (graus, 0 = +Z, 90 = +X) de um vetor de direção. */
function elevacaoEAzimute(v: readonly [number, number, number]): { elevacao: number; azimute: number } {
  const horizontal = Math.hypot(v[0], v[2])
  return { elevacao: Math.atan2(v[1], horizontal) * PARA_GRAUS, azimute: (Math.atan2(v[0], v[2]) * PARA_GRAUS + 360) % 360 }
}

/** Menor diferença entre dois azimutes, em graus (0..180). */
function difAzimute(a: number, b: number): number {
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}

function norma(v: readonly [number, number, number]): number {
  return Math.hypot(v[0], v[1], v[2])
}

/** O texto SEM as linhas de comentário (uma regex sobre o arquivo inteiro também casa o comentário que explica o assunto). */
function soCodigo(texto: string): string {
  return texto
    .split(/\r?\n/)
    .filter((linha) => !/^\s*(\/\/|\*|\/\*)/.test(linha))
    .join('\n')
}

/**
 * CONTRATO do SOL no desenho da atmosfera (24/11/2026). Medido na cena viva: o disco do sol que o SHADER DO CÉU desenha apontava SEMPRE para a mesma direção fixa (`vec3(0.45, 0.62, 0.32)`),
 * enquanto a luz que ilumina e projeta sombra usa `posicaoSol` do catálogo, DIFERENTE em cada bioma. Só a clareira coincidia: nos outros cinco o sol do céu e o sol do chão estavam em lados
 * opostos (na serra do ouro, 110° de diferença no azimute). A direção do disco e a posição da luz saem agora da MESMA função (`direcaoDoSol`), então não podem mais divergir.
 */
export function contratoDoCeu(atmosfera: string): void {
  const codigo = soCodigo(atmosfera)
  assert(!/vec3\(0\.45, 0\.62, 0\.32\)/.test(codigo), 'o shader do céu NÃO tem mais a direção do sol fixa: ela vem de um uniform, igual para a luz e para o disco')
  assert(/uniform vec3 uSolDir;/.test(codigo), 'o shader do céu recebe a direção do sol por um uniform `uSolDir`')
  assert(/uSolDir: \{ value: new Vector3\(\) \}/.test(codigo), 'o material do céu declara `uSolDir` como um Vector3')
  assert(/\bposicaoDoSol\(/.test(codigo) && /\bdirecaoDoSol\(/.test(codigo), 'a atmosfera usa `posicaoDoSol` para a luz e `direcaoDoSol` para o disco: uma fonte só')
  // O que é GRAVADO, não só que a função apareça no texto (o mutante «a luz volta a ler `cat.posicaoSol`» sobreviveu a um teste que só procurava o nome da função, 24/11): a posição da luz
  // direcional vem de `posicaoDoSol(...)` no quadro E no estado inicial do JSX, e `cat.posicaoSol` não é mais lido em lugar nenhum do código. É a divergência céu × luz que o contrato impede.
  assert(/const p = posicaoDoSol\(bioma, state\.clock\.elapsedTime\)/.test(codigo) && /luz\.position\.set\(cx \+ p\[0\], p\[1\], cz \+ p\[2\]\)/.test(codigo), 'a luz segue `posicaoDoSol(bioma, tempo)` no quadro (o alvo só soma o centro do foco)')
  assert(/position=\{posicaoDoSol\(bioma, 0\)\}/.test(codigo), 'o estado inicial da luz (e o do Leve, que não roda o laço das sombras) também sai de `posicaoDoSol`')
  assert(!/cat\.posicaoSol/.test(codigo), '`cat.posicaoSol` não é mais lido pela atmosfera: o sol do chão e o do céu não podem divergir')
  assert(/direcaoDoSol\(bioma, state\.clock\.elapsedTime\)/.test(codigo) && /uSolDir\.value\.set\(d\[0\], d\[1\], d\[2\]\)/.test(codigo), 'o disco do céu recebe `direcaoDoSol(bioma, tempo)` a cada quadro, ANTES do retorno das sombras (o céu não depende delas)')
  // o céu é uma esfera centrada na ORIGEM e não segue a câmera: a direção de um pixel do céu é a posição no mundo menos a posição da câmera (senão o sol «anda» com o jogador)
  assert(/normalize\(vWorldPos - cameraPosition\)/.test(codigo), 'a direção de cada pixel do céu é `vWorldPos - cameraPosition` (a esfera não segue a câmera)')
}

/**
 * CONTRATO da INTEGRAÇÃO do ambiente em `CenaBiomaVisual.tsx` (24/11/2026). O ambiente é um recurso de GPU: se não for descartado vaza memória a cada troca de bioma, e se a geração falhar sem
 * proteção derruba a cena. Lê o TEXTO do arquivo (o desenho vive no React; o runner roda no Node, sem GPU). Garante: (1) vive num `BiomeGpuAssetPool` de capacidade 2 (o descarte já testado
 * em `biomaVisual.test.ts`); (2) a geração está dentro de `try/catch` e a falha não derruba nada; (3) `scene.environment` só é gravado quando `ambienteDeveExistir`; (4) a intensidade vem
 * do catálogo e `scene.environment` é devolvido a null ao sair; (5) o pool é descartado ao desmontar.
 */
export function contratoDoAmbiente(cenaBioma: string): void {
  const codigo = soCodigo(cenaBioma)
  assert(/import \{[^}]*\bgerarAmbientePmrem\b[^}]*\} from '\.\/ambientePmrem'/.test(codigo), 'a cena importa `gerarAmbientePmrem`')
  assert(/new BiomeGpuAssetPool<AmbienteGpu>\(2\)/.test(codigo), 'os ambientes vivem num `BiomeGpuAssetPool` de capacidade 2 (a troca de bioma descarta o mais antigo com `dispose()`)')
  // O contexto perdido NÃO entra por prop: `aplicarContextLost` força o preset Leve, e o spec do Leve tem `ambiente: false` (provado em 24/11 para auto, bonito e ultra, e para a tentativa de subir
  // de novo depois da perda). Um `contextoPerdido` por prop seria um 2º caminho para a mesma regra, que poderia divergir do primeiro.
  assert(/ambienteDeveExistir\(spec, \{ chaveLigada: PARTIDA\.ambienteIbl, contextoPerdido: false \}\)/.test(codigo), 'a decisão de ter ambiente é `ambienteDeveExistir(spec, { chaveLigada: PARTIDA.ambienteIbl, contextoPerdido: false })`: o contexto perdido já força o Leve, que não tem ambiente')
  assert(/try \{[\s\S]*gerarAmbientePmrem\(gl, state\.bioma\)[\s\S]*\} catch/.test(codigo), 'a geração do ambiente está dentro de try/catch (a falha da GPU nunca derruba a cena)')
  assert(/scene\.environment = [a-zA-Z.]+\.textura/.test(codigo) && /scene\.environmentIntensity = [a-zA-Z.]+\.intensidade/.test(codigo), '`scene.environment` e `scene.environmentIntensity` recebem a textura e a intensidade do ambiente')
  assert((codigo.match(/scene\.environment = null/g) ?? []).length === 1, 'ao sair o efeito devolve `scene.environment` a null (exatamente uma vez)')
  assert(/ambientesRef\.current\?\.descartarTudo\(\)/.test(codigo), 'o pool de ambientes é descartado ao desmontar a cena')
}

export function run(atmosfera?: string, cenaBioma?: string): void {
  if (atmosfera !== undefined) contratoDoCeu(atmosfera)
  if (cenaBioma !== undefined) contratoDoAmbiente(cenaBioma)

  // ── o catálogo tem os campos novos, em faixas que dão LUZ DE FIM DE TARDE sem escurecer o chão ──────────────────────────────────────────────────────────────────────────────────────────
  for (const b of BIOMAS) {
    const cat = BIOMA_VISUAL_CATALOG[b]
    assert(cat.elevacaoSolGraus >= 28 && cat.elevacaoSolGraus <= 40, `${b}: a elevação do sol fica entre 28° e 40° (veio ${cat.elevacaoSolGraus}): abaixo escurece o chão plano (medido: 22° tira 14% da luz da grama), acima volta ao meio-dia chapado`)
    assert(cat.intensidadeAmbiente >= 0.4 && cat.intensidadeAmbiente <= 1, `${b}: a intensidade do ambiente (IBL) fica entre 0,4 e 1 (veio ${cat.intensidadeAmbiente})`)
  }

  // ── A DIREÇÃO é unitária, e a posição da luz fica na MESMA direção, só mais longe ───────────────────────────────────────────────────────────────────────────────────────────────────────
  for (const b of BIOMAS) {
    for (const t of [0, 100, 600, 1234.5]) {
      const d = direcaoDoSol(b, t)
      assert(Math.abs(norma(d) - 1) < 1e-9, `${b} t=${t}: a direção do sol é unitária (veio ${norma(d)})`)
      const p = posicaoDoSol(b, t)
      const n = norma(p)
      assert(n > 30 && n < 80, `${b} t=${t}: a luz fica a uma distância razoável do alvo (veio ${n.toFixed(1)}), longe o bastante para as sombras e perto o bastante para o frustum`)
      for (let i = 0; i < 3; i += 1) assert(Math.abs(p[i] / n - d[i]) < 1e-9, `${b} t=${t}: a posição da luz e a direção do disco apontam para o MESMO lado (eixo ${i})`)
    }
  }

  // ── a ELEVAÇÃO do sol é a do catálogo (a luz do bioma), e o AZIMUTE continua o de hoje (o sol não pula de lado) ──────────────────────────────────────────────────────────────────────
  for (const b of BIOMAS) {
    const cat = BIOMA_VISUAL_CATALOG[b]
    const { elevacao, azimute } = elevacaoEAzimute(direcaoDoSol(b, 0))
    assert(Math.abs(elevacao - cat.elevacaoSolGraus) < 1e-6, `${b}: a elevação do sol em t=0 é a do catálogo (${cat.elevacaoSolGraus}°); veio ${elevacao.toFixed(3)}°`)
    const azimuteDeHoje = elevacaoEAzimute([cat.posicaoSol[0], cat.posicaoSol[1], cat.posicaoSol[2]]).azimute
    assert(difAzimute(azimute, azimuteDeHoje) < 1e-6, `${b}: o azimute em t=0 é o de HOJE (${azimuteDeHoje.toFixed(2)}°): o sol não muda de lado; veio ${azimute.toFixed(2)}°`)
  }

  // ── o DESLIZE: o sol anda ±DESLIZE em PERIODO segundos; só o azimute, a elevação fica; é periódico e finito ───────────────────────────────────────────────────────────────────────────
  assert(DESLIZE_DO_SOL_GRAUS === 6 && PERIODO_DO_SOL_SEG === 600, 'o plano aprovado: ±6° em 10 minutos (600 s)')
  for (const b of BIOMAS) {
    const a0 = elevacaoEAzimute(direcaoDoSol(b, 0))
    // ao longo de um período inteiro, o azimute varre exatamente ±6° ao redor do de t=0 (mínimo e máximo); a elevação não muda nunca
    let menor = Infinity
    let maior = -Infinity
    let maiorDeElevacao = 0
    for (let t = 0; t <= PERIODO_DO_SOL_SEG; t += 5) {
      const { elevacao, azimute } = elevacaoEAzimute(direcaoDoSol(b, t))
      let d = azimute - a0.azimute
      if (d > 180) d -= 360
      if (d < -180) d += 360
      menor = Math.min(menor, d)
      maior = Math.max(maior, d)
      maiorDeElevacao = Math.max(maiorDeElevacao, Math.abs(elevacao - a0.elevacao))
    }
    assert(maior > 5.9 && maior <= 6.0001 && menor < -5.9 && menor >= -6.0001, `${b}: o azimute desliza ±6° (veio de ${menor.toFixed(2)}° a ${maior.toFixed(2)}°)`)
    assert(maiorDeElevacao < 1e-6, `${b}: a elevação não muda com o deslize (variou ${maiorDeElevacao})`)
    // entre t = 0 e t = 600 (um período) o sol volta ao mesmo lugar; e o deslize anda DE VERDADE (meio período, em t = 150, está a ~6° do início)
    const volta = direcaoDoSol(b, PERIODO_DO_SOL_SEG)
    const inicio = direcaoDoSol(b, 0)
    for (let i = 0; i < 3; i += 1) assert(Math.abs(volta[i] - inicio[i]) < 1e-9, `${b}: é periódico: em t=${PERIODO_DO_SOL_SEG} o sol volta ao de t=0`)
    const quarto = elevacaoEAzimute(direcaoDoSol(b, PERIODO_DO_SOL_SEG / 4))
    assert(difAzimute(quarto.azimute, a0.azimute) > 5.9, `${b}: um quarto de período depois o sol está ~6° do início (o deslize não ficou parado; veio ${difAzimute(quarto.azimute, a0.azimute).toFixed(2)}°)`)
  }

  // ── ENTRADA RUIM nunca quebra: NaN, negativo, infinito e valor enorme caem em algo finito e unitário ─────────────────────────────────────────────────────────────────────────────────────
  for (const b of BIOMAS) {
    for (const t of [Number.NaN, -1, -1e9, Infinity, -Infinity, 1e15, 0]) {
      const d = direcaoDoSol(b, t)
      assert(d.every((x) => Number.isFinite(x)) && Math.abs(norma(d) - 1) < 1e-9, `${b} t=${String(t)}: a direção continua finita e unitária com entrada ruim`)
      assert(posicaoDoSol(b, t).every((x) => Number.isFinite(x)), `${b} t=${String(t)}: a posição da luz continua finita com entrada ruim`)
    }
    // NaN, negativo e infinito valem t = 0 (o plano: NaN→0; um relógio que anda para trás faria o sol voltar). O seno de t = -1 NÃO é o de t = 0 (−0,0105), então só o corte as iguala: o mutante «o
    // negativo não vira 0» sobreviveu a um teste que só exigia finitude (24/11).
    const zero = direcaoDoSol(b, 0)
    for (const ruim of [Number.NaN, -1, -1e9, Infinity, -Infinity]) {
      const d = direcaoDoSol(b, ruim)
      for (let i = 0; i < 3; i += 1) assert(Math.abs(d[i] - zero[i]) < 1e-12, `${b}: t = ${String(ruim)} vale t = 0 (eixo ${i}: ${d[i]} contra ${zero[i]})`)
    }
  }

  // ── o AMBIENTE (IBL): a cor vem do CÉU do bioma, e nunca é mais forte que o catálogo manda ─────────────────────────────────────────────────────────────────────────────────────────────
  for (const b of BIOMAS) {
    const cat = BIOMA_VISUAL_CATALOG[b]
    const amb = ambienteDoBioma(b)
    assert(amb.intensidade === cat.intensidadeAmbiente, `${b}: a intensidade do ambiente é a do catálogo`)
    assert(amb.topo === cat.ceuTopo && amb.horizonte === cat.ceuHorizonte && amb.solo === cat.luzChao, `${b}: o ambiente é feito das cores do CÉU e do SOLO do bioma (a tundra roxa e o basalto em brasa mantêm a identidade)`)
    assert(amb.corSol === cat.corSol, `${b}: o ambiente usa a cor do sol do bioma`)
  }
  // biomas diferentes têm ambientes diferentes (o IBL não é um cinza único)
  const topos = new Set(BIOMAS.map((b) => ambienteDoBioma(b).topo))
  assert(topos.size === BIOMAS.length, 'cada bioma tem o seu céu de ambiente (6 diferentes)')

  // ── QUANDO o ambiente existe: só com a chave ligada, só no Bonito e no Ultra, e nunca com o contexto WebGL perdido ────────────────────────────────────────────────────────────────────────
  const livre = { chaveLigada: true, contextoPerdido: false }
  assert(ambienteDeveExistir(SPEC_QUALIDADE.bonito, livre) === true, 'o Bonito tem ambiente (chave ligada)')
  assert(ambienteDeveExistir(SPEC_QUALIDADE.ultra, livre) === true, 'o Ultra tem ambiente (chave ligada)')
  assert(ambienteDeveExistir(SPEC_QUALIDADE.leve, livre) === false, 'o Leve NUNCA gera ambiente: é a rede de segurança de máquina fraca e não paga por reflexo que o chão rugoso quase não mostra')
  // O ambiente tem o SEU campo no spec (`ambiente`), independente do composer (`posProcessamento`): a regra «o Leve nunca» não pode depender de uma flag de OUTRA coisa. Um spec fabricado com o
  // composer ligado e o ambiente desligado (e o contrário) separa as duas regras: o mutante «ambiente segue o composer» sobreviveria a um teste que só olha os 3 níveis reais.
  const soComposer = { ...SPEC_QUALIDADE.bonito, ambiente: false }
  const soAmbiente = { ...SPEC_QUALIDADE.leve, ambiente: true }
  assert(ambienteDeveExistir(soComposer, livre) === false, 'um nível com composer e SEM o campo `ambiente` não gera ambiente (as duas regras são independentes)')
  assert(ambienteDeveExistir(soAmbiente, livre) === true, 'um nível SEM composer e com o campo `ambiente` gera ambiente (o ambiente não depende do composer)')
  assert(SPEC_QUALIDADE.leve.ambiente === false && SPEC_QUALIDADE.bonito.ambiente === true && SPEC_QUALIDADE.ultra.ambiente === true, 'o spec: Leve sem ambiente, Bonito e Ultra com')
  for (const q of [SPEC_QUALIDADE.leve, SPEC_QUALIDADE.bonito, SPEC_QUALIDADE.ultra]) {
    assert(ambienteDeveExistir(q, { chaveLigada: false, contextoPerdido: false }) === false, `${q.efetiva}: com a chave desligada não há ambiente (chave desligada = o jogo de antes)`)
    assert(ambienteDeveExistir(q, { chaveLigada: true, contextoPerdido: true }) === false, `${q.efetiva}: com o contexto WebGL perdido não se gera nada (os alvos de render morreram com ele)`)
  }

  // ── o REFLEXO por material: o ambiente é de quem REFLETE (metal e liso), não de quem só difunde (chão, estrada, pedra comum) ───────────────────────────────────────────────────────────────
  // Medido em 24/11 (mesma sessão, só o ambiente alternado): a 0,55 o ambiente somava +44% de luz à estrada e +40% à grama, e esfriava tudo (a estrada: azul/vermelho 1,47 → 2,04; a grama
  // amarelada virava azul-esverdeada). O ambiente difuso soma-se à hemisférica que o jogo JÁ tem. O inventário da cena: 22 materiais metálicos, 8 lisos, 16 médios, 24 rugosos.
  // Valores da cena real: ouro (m0,72 r0,22), obra de metal (m0,68 r0,28), cristal (m0,42 r0,36), pedra (m0 r0,88), chão (m0,04 r1), copa (m0 r0,78).
  const ouro = fatorDeReflexo(0.72, 0.22)
  const obraMetal = fatorDeReflexo(0.68, 0.28)
  const cristal = fatorDeReflexo(0.42, 0.36)
  const copa = fatorDeReflexo(0, 0.78)
  const pedra = fatorDeReflexo(0, 0.88)
  const chao = fatorDeReflexo(0.04, 1)
  // O que importa é a SEPARAÇÃO entre quem reflete (> 0,8) e quem só difunde (< 0,1), não um décimo a mais ou a menos. O limiar da obra de metal nasceu como 0,85 (um número que escrevi sem
  // calcular) e o valor exato é 0,841: o teste ficou vermelho pelo número arbitrário, não pela fórmula. Valores exatos da cena: ouro 0,940 · obra 0,841 · cristal 0,550 · copa 0,024 · chão 0,028.
  assert(ouro > 0.9 && obraMetal > 0.8, `o metal liso reflete quase tudo (ouro ${ouro.toFixed(2)}, obra de metal ${obraMetal.toFixed(2)})`)
  assert(cristal > 0.3 && cristal < ouro, `o cristal reflete menos que o ouro e mais que a pedra (${cristal.toFixed(2)})`)
  assert(chao < 0.05 && pedra < 0.1, `o chão e a pedra rugosa NÃO recebem ambiente (chão ${chao.toFixed(3)}, pedra ${pedra.toFixed(3)}): é por eles que a cena azulava`)
  assert(copa < 0.15, `a copa difusa (m0, r0,78) recebe pouco ambiente (${copa.toFixed(3)})`)
  // O MEIO da curva (onde a lisura ao QUADRADO faz diferença; nos extremos linear e quadrática dão quase o mesmo e o mutante «sem o quadrado» sobreviveu a testes só de extremo, 24/11):
  // não-metal de rugosidade média reflete POUCO. Quadrado: gelo liso (r0,3) 0,245 e pedra molhada (r0,5) 0,125; linear daria 0,35 e 0,25 (o dobro, e a pedra molhada passaria a brilhar como metal).
  const geloLiso = fatorDeReflexo(0, 0.3)
  const pedraMolhada = fatorDeReflexo(0, 0.5)
  assert(geloLiso > 0.2 && geloLiso < 0.3, `gelo liso (m0, r0,3) reflete ~0,245 (veio ${geloLiso.toFixed(3)}): a lisura entra ao quadrado`)
  assert(pedraMolhada > 0.1 && pedraMolhada < 0.15, `pedra molhada (m0, r0,5) reflete ~0,125 (veio ${pedraMolhada.toFixed(3)}): meia rugosidade reflete pouco`)
  const obraRugosa = fatorDeReflexo(0.55, 0.74)
  assert(obraRugosa > 0.38 && obraRugosa < 0.5, `obra rugosa (m0,55, r0,74) reflete ~0,43 (veio ${obraRugosa.toFixed(3)}): o metal rugoso reflete menos que o liso`)
  // monotonia: mais metálico = mais reflexo; mais rugoso = menos reflexo
  assert(fatorDeReflexo(0.9, 0.3) > fatorDeReflexo(0.5, 0.3), 'mais metálico, mais reflexo')
  assert(fatorDeReflexo(0.5, 0.2) > fatorDeReflexo(0.5, 0.8), 'mais rugoso, menos reflexo')
  // sempre em [0, 1] e finito, mesmo com entrada fora de faixa (um material mal configurado não pode estourar nem dar NaN)
  for (const [m, r] of [[-1, -1], [2, 2], [Number.NaN, 0.5], [0.5, Number.NaN], [Infinity, 0], [0, Infinity], [1, 0], [0, 1]] as const) {
    const f = fatorDeReflexo(m, r)
    assert(Number.isFinite(f) && f >= 0 && f <= 1, `fatorDeReflexo(${String(m)}, ${String(r)}) fica em [0,1] e finito (veio ${String(f)})`)
  }
  assert(fatorDeReflexo(1, 0) === 1, 'o espelho perfeito (metal 1, rugosidade 0) reflete tudo')

  // ── a CHAVE do pool: o bioma E o nível (a resolução do ambiente não muda entre Bonito e Ultra, mas o pool não pode servir um ambiente de outro bioma) ─────────────────────────────────────────
  const chaves = new Set(BIOMAS.map((b) => chaveDoAmbiente(b)))
  assert(chaves.size === BIOMAS.length, 'cada bioma tem uma chave de pool diferente (senão o pool serviria o céu de outro bioma)')
  assert(chaveDoAmbiente('clareira') === chaveDoAmbiente('clareira'), 'a chave é estável para o mesmo bioma (o pool acerta o cache)')
}
