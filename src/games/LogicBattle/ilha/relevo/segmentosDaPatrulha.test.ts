import { ELEVACAO_DO_ANEL, ELEVACAO_DA_LINHA, elevacaoDoAnel, elevacaoDaLinha, inclinarSegmento, segmentosDaPatrulha } from './segmentosDaPatrulha'
import type { CampoRelevo } from './campoRelevo'

function assert(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem)
}

/**
 * A FILEIRA DE SEGMENTOS da linha da patrulha (F2, Task 4, resto, 26/11/2026). Uma caixa horizontal (ou uma reta inclinada de A a B) erra 0,25–1,3 m no terreno real (medido); a linha vira uma fileira de segmentos
 * curtos, cada um no desnível do SEU ponto médio. Esta função só calcula ONDE ficam os segmentos e COMO estão virados (puro, sem GPU, sem campo): a altura de cada um quem soma é o chamador (`desnivelDoChao`).
 *
 * O que ela promete: (1) os segmentos COBREM A→B sem vão nem sobreposição (a soma dos comprimentos é o comprimento da patrulha); (2) o primeiro começa em A e o último termina em B; (3) cada um está virado
 * para B (o ângulo de hoje, `atan2(bx − ax, bz − az)`); (4) nunca mais que `MAX_SEGMENTOS` (uma patrulha de 110 m não vira milhares de caixas); (5) entrada degenerada (A = B, NaN) devolve UM segmento mínimo
 * ou nenhum, nunca NaN: a linha de hoje já tinha `Math.max(0.2, …)`.
 */
export function run(): void {
  // ── (1)–(3) uma patrulha reta ao longo de x: A = (0, 0), B = (10, 0): ângulo atan2(10, 0) = π/2, comprimento 10 ──────────────────────────────────────────────────────────────────────────────────────────────
  {
    const s = segmentosDaPatrulha(0, 0, 10, 0)
    const total = s.reduce((acc, seg) => acc + seg.comp, 0)
    assert(Math.abs(total - 10) < 1e-9, `a soma dos comprimentos é o comprimento da patrulha (10): veio ${total}`)
    assert(s.length === 20 && s.every((seg) => Math.abs(seg.comp - 0.5) < 1e-9), `uma patrulha de 10 m vira EXATAMENTE 20 segmentos de 0,5 m (⌈10 / 0,5⌉ = 20; um passo de 0,6 daria 17): veio ${s.length} de ${s.map((x) => x.comp.toFixed(2)).join('/')}`)
    assert(Math.abs(s[0].x - (s[0].comp / 2)) < 1e-9 && s[0].z === 0, `o 1º segmento começa em A: o centro dele é metade do seu comprimento (${s[0].comp / 2}), veio x = ${s[0].x}`)
    const ultimo = s[s.length - 1]
    assert(Math.abs(ultimo.x + ultimo.comp / 2 - 10) < 1e-9, `o último segmento TERMINA em B (x = 10): veio ${ultimo.x + ultimo.comp / 2}`)
    for (const seg of s) assert(Math.abs(seg.ang - Math.PI / 2) < 1e-12, `cada segmento está virado para B (atan2(10, 0) = π/2): veio ${seg.ang}`)
    // sem vão e sem sobreposição: o fim de um é o começo do próximo
    for (let k = 1; k < s.length; k += 1) {
      const fimAnterior = s[k - 1].x + s[k - 1].comp / 2
      const inicio = s[k].x - s[k].comp / 2
      assert(Math.abs(fimAnterior - inicio) < 1e-9, `sem vão nem sobreposição entre os segmentos ${k - 1} e ${k}: ${fimAnterior} vs ${inicio}`)
    }
  }
  // ── a mesma patrulha na DIAGONAL e com B antes de A (os sinais e os eixos) ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  {
    const s = segmentosDaPatrulha(3, 4, 3 + 6, 4 + 8) // 3-4-5 ×2: comprimento 10
    const total = s.reduce((acc, seg) => acc + seg.comp, 0)
    assert(Math.abs(total - 10) < 1e-9, 'na diagonal 6×8 o comprimento é 10')
    const esperadoAng = Math.atan2(6, 8)
    for (const seg of s) assert(Math.abs(seg.ang - esperadoAng) < 1e-12, `o ângulo na diagonal é atan2(Δx, Δz) = ${esperadoAng} (x e z NÃO trocados): veio ${seg.ang}`)
    assert(Math.abs(s[0].x - (3 + 6 * (s[0].comp / 2) / 10)) < 1e-9 && Math.abs(s[0].z - (4 + 8 * (s[0].comp / 2) / 10)) < 1e-9, 'o 1º segmento começa em A = (3, 4) e anda para B')
    const inv = segmentosDaPatrulha(9, 12, 3, 4) // B → A
    assert(Math.abs(inv[0].x - (9 - 6 * (inv[0].comp / 2) / 10)) < 1e-9, 'com B antes de A o 1º segmento está perto de A = (9, 12) e anda para B = (3, 4) (o sinal de Δx)')
    assert(Math.abs(inv[0].ang - Math.atan2(-6, -8)) < 1e-12, 'e o ângulo muda de sinal (atan2(−6, −8))')
  }

  // ── (4) NUNCA mais que `MAX_SEGMENTOS`: uma patrulha de 110 m não vira 55 caixas por patrulha ×4 sem teto ─────────────────────────────────────────────────────────────────────────────────────────────
  {
    const s = segmentosDaPatrulha(-55, -55, 55, 55) // ~155 m
    assert(s.length === 64, `uma patrulha de ~155 m usa EXATAMENTE o teto de 64 segmentos (⌈155,56 / 0,5⌉ = 312 > 64; veio ${s.length})`)
    const total = s.reduce((acc, seg) => acc + seg.comp, 0)
    assert(Math.abs(total - Math.hypot(110, 110)) < 1e-6, `mas CONTINUA cobrindo A→B inteira (comprimento ${Math.hypot(110, 110).toFixed(3)}): veio ${total}`)
    // uma patrulha curta NÃO é limitada pelo teto: 20 m são 40 segmentos de 0,5 m (o teto só aperta acima de 32 m)
    assert(segmentosDaPatrulha(0, 0, 20, 0).length === 40, 'uma patrulha de 20 m são 40 segmentos de 0,5 m (abaixo do teto de 64)')
    assert(segmentosDaPatrulha(0, 0, 32, 0).length === 64 && segmentosDaPatrulha(0, 0, 32.01, 0).length === 64, 'o teto de 64 aperta a partir de 32 m (⌈32 / 0,5⌉ = 64)')
  }

  // ── (5) entrada degenerada ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  {
    const pontual = segmentosDaPatrulha(5, 5, 5, 5) // A = B: a linha de hoje tinha `Math.max(0.2, hypot)`
    assert(pontual.length === 1 && Math.abs(pontual[0].comp - 0.2) < 1e-12, `A = B devolve UM segmento mínimo de 0,2 m (a linha de hoje: Math.max(0.2, …)), veio ${pontual.length} de ${pontual[0]?.comp}`)
    assert(Number.isFinite(pontual[0].x) && Number.isFinite(pontual[0].z) && Number.isFinite(pontual[0].ang), 'e todos os campos são finitos')
    // `Infinity` em A com B finito é a entrada que SEPARA «valida só B» de «valida os 4»: um `NaN` em A zera o laço por acaso (`comp` vira NaN e `k < NaN` nunca roda), mas `Infinity` em A dá `comp = Infinity`,
    // `n = MAX_SEGMENTOS` e 64 segmentos com `x = -Infinity`: a lição do bug do `tMax = Infinity` (26/11) é construir a entrada que separa antes de chamar um sobrevivente de «equivalente por acaso».
    for (const [ax, az, bx, bz] of [[Number.NaN, 0, 1, 1], [0, 0, Number.POSITIVE_INFINITY, 1], [0, 0, 1, Number.NaN], [Number.POSITIVE_INFINITY, 0, 1, 1], [0, Number.NEGATIVE_INFINITY, 1, 1]] as const) {
      const s = segmentosDaPatrulha(ax, az, bx, bz)
      assert(s.length === 0, `entrada não finita (${ax}, ${az}, ${bx}, ${bz}) não desenha NADA (nenhum NaN vira posição de objeto 3D)`)
    }
  }

  // ── a FILEIRA acompanha o passo de 2 m: uma patrulha curta (0,5 m) é UM segmento do tamanho dela, e uma de 2,01 m são 2 ──────────────────────────────────────────────────────────────────────────────────
  {
    const curta = segmentosDaPatrulha(0, 0, 0.5, 0)
    assert(curta.length === 1 && Math.abs(curta[0].comp - 0.5) < 1e-12, `uma patrulha de 0,5 m é UM segmento de 0,5 m: veio ${curta.length} de ${curta[0]?.comp}`)
    // os EXTREMOS de cada segmento (o chamador inclina o segmento pelo desnível das duas pontas): o 1º começa em A, o último termina em B, e cada um tem as pontas a ±comp/2 do centro ao longo da direção
    {
      const s = segmentosDaPatrulha(1, 2, 1 + 3, 2 + 4) // 3-4-5: comprimento 5, 10 segmentos de 0,5
      assert(s.length === 10, `3-4-5 são 10 segmentos de 0,5 m (veio ${s.length})`)
      assert(Math.abs(s[0].x0 - 1) < 1e-9 && Math.abs(s[0].z0 - 2) < 1e-9, `o 1º segmento COMEÇA em A = (1, 2): veio (${s[0].x0}, ${s[0].z0})`)
      const u = s[s.length - 1]
      assert(Math.abs(u.x1 - 4) < 1e-9 && Math.abs(u.z1 - 6) < 1e-9, `o último segmento TERMINA em B = (4, 6): veio (${u.x1}, ${u.z1})`)
      for (let k = 0; k < s.length; k += 1) {
        assert(Math.abs((s[k].x0 + s[k].x1) / 2 - s[k].x) < 1e-9 && Math.abs((s[k].z0 + s[k].z1) / 2 - s[k].z) < 1e-9, `o centro do segmento ${k} é o ponto médio das suas pontas`)
        assert(Math.abs(Math.hypot(s[k].x1 - s[k].x0, s[k].z1 - s[k].z0) - s[k].comp) < 1e-9, `a distância entre as pontas do segmento ${k} é o seu comprimento`)
        if (k > 0) assert(Math.abs(s[k].x0 - s[k - 1].x1) < 1e-9 && Math.abs(s[k].z0 - s[k - 1].z1) < 1e-9, `a ponta de trás do segmento ${k} É a da frente do anterior (sem vão)`)
      }
    }
    const cinco = segmentosDaPatrulha(0, 0, 2.01, 0)
    assert(cinco.length === 5, `uma patrulha de 2,01 m são 5 segmentos (⌈2,01 / 0,5⌉ = 5): veio ${cinco.length}`)
    const quatro = segmentosDaPatrulha(0, 0, 2, 0)
    assert(quatro.length === 4, `e uma de 2 m são 4 (⌈2 / 0,5⌉ = 4; o teto da fronteira): veio ${quatro.length}`)
  }

  // ── A INCLINAÇÃO DO SEGMENTO (a FOTO 30 mostrou LACUNAS; 59 % dos segmentos horizontais tinham uma ponta enterrada). `inclinarSegmento(s, alturaEm)` devolve a altura do CENTRO (a média das pontas), o giro em x
  //    e o comprimento da CAIXA. Os 3 valores foram PROVADOS com o three real (`provar-rotacao-do-segmento.mjs`, 6 direções, erro das pontas 0,0000 m): (1) a ordem de Euler tem de ser YXZ e o sinal do giro em x é
  //    NEGATIVO (a ponta da frente sobe com rx < 0); (2) a caixa tem o comprimento da DIAGONAL `hypot(comp, Δh)`, não o `comp` horizontal (a inclinação alonga a caixa; com `comp` as pontas ficam 0,5 m para dentro). ──
  {
    // a rampa: a altura é `0,5 · x`; o segmento de (0, 0) a (2, 0) sobe 1 m em 2 m (comp horizontal 2, Δh = 1)
    const rampa = (x: number): number => 0.5 * x
    const s = segmentosDaPatrulha(0, 0, 2, 0)[0] // o 1º de 4 segmentos de 0,5 m: de x = 0 a 0,5
    const i = inclinarSegmento(s, (x) => rampa(x))
    assert(Math.abs(i.y - 0.125) < 1e-12, `o centro fica na MÉDIA das duas pontas: (0 + 0,25) / 2 = 0,125 (veio ${i.y})`)
    assert(Math.abs(i.inclinacao - -Math.atan2(0.25, 0.5)) < 1e-12, `o giro em x é NEGATIVO e vale −atan2(Δh = 0,25; comp = 0,5) = ${-Math.atan2(0.25, 0.5)} (veio ${i.inclinacao})`)
    assert(Math.abs(i.comprimento - Math.hypot(0.5, 0.25)) < 1e-12, `a caixa tem o comprimento da DIAGONAL hypot(0,5; 0,25) = ${Math.hypot(0.5, 0.25)} (veio ${i.comprimento})`)
    // descendo: o sinal inverte (a ponta da frente fica MAIS BAIXA: giro em x POSITIVO)
    const desce = inclinarSegmento(s, (x) => -rampa(x))
    assert(desce.inclinacao > 0 && Math.abs(desce.inclinacao - Math.atan2(0.25, 0.5)) < 1e-12, `descendo, o giro em x é POSITIVO (+atan2(0,25; 0,5)) (veio ${desce.inclinacao})`)
    assert(Math.abs(desce.y - -0.125) < 1e-12 && Math.abs(desce.comprimento - i.comprimento) < 1e-12, 'descendo, o centro é −0,125 e a diagonal é a mesma')
    // chão plano: nenhuma inclinação, e a caixa tem exatamente o comprimento horizontal (a linha de hoje, pedaço a pedaço)
    const plano = inclinarSegmento(s, () => 0)
    // (o giro é «zero»; `−atan2(0, comp)` é −0 e um −0 não gira nada: afirmar o SINAL do zero testaria o formato, não o comportamento)
    assert(plano.y === 0 && Math.abs(plano.inclinacao) === 0 && plano.comprimento === s.comp, `no plano: y = 0, giro 0, comprimento = o horizontal (${s.comp}): veio ${plano.y}/${plano.inclinacao}/${plano.comprimento}`)
    // a altura é lida nas PONTAS e não no centro: num chão em V (alto nas pontas, baixo no meio) o centro fica na MÉDIA DAS PONTAS (1), não no fundo (0)
    const v = inclinarSegmento({ ...s, x: 0, z: 0, x0: -1, z0: 0, x1: 1, z1: 0, comp: 2 }, (x) => Math.abs(x))
    assert(Math.abs(v.y - 1) < 1e-12, `num V o centro é a média das pontas (1), não o chão do meio (0): veio ${v.y}`)
    // a ordem das pontas importa: x0 é a de trás, x1 a da frente (a frente MAIS ALTA dá giro NEGATIVO)
    const fim = inclinarSegmento({ ...s, x0: 0, z0: 0, x1: 1, z1: 0, comp: 1 }, (x) => 1 * x)
    assert(fim.inclinacao < 0, 'a frente (x1) mais alta que a de trás (x0) dá giro NEGATIVO')
    const troca = inclinarSegmento({ ...s, x0: 1, z0: 0, x1: 0, z1: 0, comp: 1 }, (x) => 1 * x)
    assert(troca.inclinacao > 0, 'trocando x0 e x1 o sinal inverte (a ordem das pontas importa)')
    // altura não finita (um campo corrompido) não vira NaN no objeto 3D: o segmento fica plano
    const nan = inclinarSegmento(s, () => Number.NaN)
    assert(nan.y === 0 && nan.inclinacao === 0 && nan.comprimento === s.comp, `alturas NaN: segmento plano e sem NaN (veio ${nan.y}/${nan.inclinacao}/${nan.comprimento})`)
    const inf = inclinarSegmento(s, () => Number.POSITIVE_INFINITY)
    assert(inf.y === 0 && inf.inclinacao === 0 && inf.comprimento === s.comp, 'alturas infinitas: segmento plano e sem Infinity')
    // SÓ UMA ponta ruim (a outra boa): é a entrada que SEPARA «valida só uma» de «valida as duas». O teste só tinha as DUAS ruins (`() => NaN`), e os mutantes I13/I14 (validar só h1, ou só h0)
    // sobreviveram: com `h0 = NaN` e `h1` finito o centro vira `(NaN + h1) / 2 = NaN` num objeto 3D. Construí a entrada que os separa ANTES de chamá-los de equivalentes.
    const soTras = inclinarSegmento(s, (x) => (x === s.x0 ? Number.NaN : 1))
    assert(soTras.y === 0 && soTras.inclinacao === 0 && soTras.comprimento === s.comp, `só a ponta de TRÁS com NaN: segmento plano e sem NaN (veio ${soTras.y}/${soTras.inclinacao}/${soTras.comprimento})`)
    const soFrente = inclinarSegmento(s, (x) => (x === s.x1 ? Number.POSITIVE_INFINITY : 1))
    assert(soFrente.y === 0 && soFrente.inclinacao === 0 && soFrente.comprimento === s.comp, `só a ponta da FRENTE com Infinity: segmento plano e sem Infinity (veio ${soFrente.y}/${soFrente.inclinacao}/${soFrente.comprimento})`)
    // controle: as pontas ficam em x0 ≠ x1 (senão `x === s.x0` pegaria as duas e o teste não separaria nada)
    assert(s.x0 !== s.x1, 'controle do instrumento: as duas pontas do segmento têm x diferentes (o teste de uma ponta só ruim as distingue por x)')
  }

  // ── A ELEVAÇÃO DOS MARCADORES NO CHÃO (a AUDITORIA de 26/11 apontou, olhando a FOTO 31, o anel amarelo do ponto B cortado pelo morro; MEDIDO em `medir-anel-e-linha-da-patrulha.mjs`, 6 biomas, controles verdes:
  //    91 % dos anéis horizontais têm uma parte ENTERRADA; +0,10 m deixa 13 %, +0,20 m deixa 2 %; a LINHA inclinada tem o meio enterrado em 2,2 % e +0,10 m a leva a 0,0 %). A elevação mora numa função PURA: SEM campo
  //    é +0 EXATO (I1: com a chave desligada o jogo de hoje não muda um bit), e só COM campo sobe. ──
  {
    const campoQualquer = { i: 0, j: 0, alturas: new Float32Array(113 * 113), nivelAgua: -0.4, versao: 1 } as CampoRelevo
    assert(Object.is(elevacaoDoAnel(undefined), 0), 'sem campo o anel não sobe nada: +0 EXATO (I1)')
    assert(Object.is(elevacaoDaLinha(undefined), 0), 'sem campo a linha não sobe nada: +0 EXATO (I1)')
    assert(elevacaoDoAnel(campoQualquer) === ELEVACAO_DO_ANEL && ELEVACAO_DO_ANEL === 0.2, `com campo o anel sobe ${ELEVACAO_DO_ANEL} (= 0,20 m: deixa 2 % dos anéis cortados contra 13 % a +0,10 m)`)
    assert(elevacaoDaLinha(campoQualquer) === ELEVACAO_DA_LINHA && ELEVACAO_DA_LINHA === 0.1, `com campo a linha sobe ${ELEVACAO_DA_LINHA} (= 0,10 m: leva o meio enterrado de 2,2 % a 0,0 %)`)
    assert(ELEVACAO_DO_ANEL > ELEVACAO_DA_LINHA, 'o anel sobe MAIS que a linha: a coroa de raio 0,44 m cobre mais chão que uma caixa de 3 cm de espessura')
    // «SEM campo» é QUALQUER valor falso, o MESMO teste `!campo` de `desnivelDoChao`. O mutante V10 (`campo === undefined ? 0 : ELEVACAO`) SOBREVIVEU e eu o tinha anotado como equivalente: só diferia em `null`, que o
    // parâmetro `unknown` aceita e que `desnivelDoChao` trata como «sem campo». Construí a entrada que o separa: com `null` o desnível seria 0 e a elevação cheia, e o disco ficaria 0,2 m ACIMA de um chão plano (I1 quebrada).
    // Os outros falsos (`false`, `0`, `''`, `NaN`) separam o mutante `campo != null`, que os trataria como campo.
    for (const semCampo of [null, false, 0, '', Number.NaN]) {
      assert(Object.is(elevacaoDoAnel(semCampo), 0), `o anel não sobe com ${JSON.stringify(semCampo)} (falso = sem campo, como o \`!campo\` de desnivelDoChao): +0 EXATO`)
      assert(Object.is(elevacaoDaLinha(semCampo), 0), `a linha não sobe com ${JSON.stringify(semCampo)} (falso = sem campo, como o \`!campo\` de desnivelDoChao): +0 EXATO`)
    }
  }
}
