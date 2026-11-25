import { BIOMA_VISUAL_CATALOG } from './biomaVisualCatalog'
import { campoDoSoloExato, campoDoSoloRapido, GRADE_DO_SOLO, limparCacheDoSolo } from './campoDoSolo'

function assert(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem)
}

const BIOMAS = ['clareira', 'bosque', 'serra_ouro', 'ribeira', 'tundra_cristal', 'basalto_brasa'] as const

function hex(h: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number]
}

/**
 * O CAMPO SUAVE DO SOLO por grade grossa + interpolação (24/11/2026). O perfil mediu o custo da geração de texturas por bioma em OPERAÇÕES (não em ms, que variam com a carga da máquina): 3,1 milhões de
 * chamadas de ruído por pacote, 50% só no solo a 512 px (o fBm de 6 oitavas por pixel de `macro` e `micro`) e 25% no grão da estrada. O solo é um campo de FREQUÊNCIA BAIXA (no máximo 32 ciclos em 512 px,
 * 16 px por ciclo), então amostrá-lo em cada um dos 262.144 pixels é trabalho jogado fora: uma grade de `GRADE_DO_SOLO` × `GRADE_DO_SOLO` amostras e a interpolação bilinear (periódica, como a textura) dão o
 * mesmo campo a um sexto do custo. As RACHADURAS e os VEIOS (limiar duro, só em serra_ouro e basalto_brasa) NÃO entram aqui: interpolá-los borraria a borda; seguem por pixel exato.
 */
/**
 * CONTRATO da INTEGRAÇÃO do campo do solo em `texturasPbrProcedural.ts` (24/11/2026). Lê o TEXTO (o gerador precisa de canvas e roda no navegador, não no Node). Garante que o solo lê o campo da grade
 * grossa (`campoDoSoloRapido`), que NÃO recalcula `macro`/`micro` por pixel (era 50% das chamadas de ruído do pacote), e que as RACHADURAS e os VEIOS (limiar duro) continuam por pixel exato: interpolá-los
 * borraria a borda.
 */
export function contratoDoSolo(texturas: string): void {
  const codigo = texturas
    .split(/\r?\n/)
    .filter((linha) => !/^\s*(\/\/|\*|\/\*)/.test(linha))
    .join('\n')
  assert(/import \{[^}]*\bcampoDoSoloRapido\b[^}]*\} from '\.\/campoDoSolo'/.test(codigo), 'o gerador de texturas importa `campoDoSoloRapido`')
  assert(/campoDoSoloRapido\(bioma, resChao\)/.test(codigo), 'o solo lê o campo da grade grossa na resolução do chão')
  assert(!/const macro = fbmTileable\(u, v, 4, 4,/.test(codigo), 'o solo NÃO recalcula o `macro` por pixel (o fBm de 4 oitavas era a maior fatia do custo)')
  assert(!/const micro = fbmTileable\(u, v, 16, 2,/.test(codigo), 'o solo NÃO recalcula o `micro` por pixel')
  // as rachaduras e os veios CONTINUAM por pixel exato (o limiar duro não pode ser interpolado)
  assert(/fbmTileable\(u, v, 8, 3, 213\)/.test(codigo), 'a RACHADURA da serra do ouro segue por pixel exato (limiar duro: interpolar borraria a borda)')
  assert(/fbmTileable\(u, v, 8, 3, 409\)/.test(codigo), 'o VEIO do basalto segue por pixel exato')
}

export function run(texturas?: string): void {
  if (texturas !== undefined) contratoDoSolo(texturas)
  const res = 256 // o teste usa 256: o erro de interpolação depende da RAZÃO res/grade, e o jogo usa 256 e 512 (a 512 a razão é maior e o campo, o mesmo; ver o teste da razão abaixo)

  // ── 0. A ÂNCORA INDEPENDENTE: o solo NÃO PODE MUDAR DE COR. Esta otimização só vale se o visual que o usuário aprovou continuar o mesmo, e o campo «exato» do teste foi escrito por MIM (se eu errasse uma
  //    semente ou uma frequência ao transcrevê-lo, o teste compararia o rápido contra um exato igualmente errado e passaria). Estes valores foram calculados em 24/11 pelo código ANTIGO, o `fbmTileable`
  //    inline de `texturasPbrProcedural.ts` ANTES da mudança (backup `texturasPbrProcedural.antes-perfil.bak`), por um caminho que NÃO passa por `campoDoSolo.ts`, e conferidos bit a bit contra o campo
  //    exato nos 6 biomas (diferença 0). Cada linha é [macro, micro, mistura] em (0,1;0,2), (0,37;0,81), (0,5;0,5) e (0,93;0,07). A SEMENTE do macro depende do nome do bioma, por isso são dois biomas. ───
  const ANCORAS: Record<string, number[][]> = {
    clareira: [[0.522501331, 0.560160977, 0.533046032], [0.299566226, 0.73231617, 0.42073621], [0.710103356, 0.237623481, 0.577808991], [0.426718507, 0.585991385, 0.471314913]],
    tundra_cristal: [[0.435388486, 0.560160977, 0.470324784], [0.281760331, 0.73231617, 0.407915966], [0.546952935, 0.237623481, 0.460340688], [0.603059405, 0.585991385, 0.59828036]],
  }
  for (const [bioma, linhas] of Object.entries(ANCORAS)) {
    // a 128 px os pontos (0,5;0,5) e (0,1;0,2)... nem sempre caem num pixel exato; usa-se 1000 px só nos pixels exatos (múltiplos de 1/1000): (100,200), (370,810), (500,500), (930,70)
    limparCacheDoSolo()
    const exato = campoDoSoloExato(bioma as (typeof BIOMAS)[number], 1000)
    const pixels = [[100, 200], [370, 810], [500, 500], [930, 70]]
    for (let k = 0; k < pixels.length; k += 1) {
      const [x, y] = pixels[k]
      const i = y * 1000 + x
      const [ma, mi, mix] = linhas[k]
      assert(Math.abs(exato.macro[i] - ma) < 2e-6 && Math.abs(exato.micro[i] - mi) < 2e-6 && Math.abs(exato.mistura[i] - mix) < 2e-6, `${bioma}: o solo em (${x / 1000}; ${y / 1000}) é [${exato.macro[i].toFixed(6)}, ${exato.micro[i].toFixed(6)}, ${exato.mistura[i].toFixed(6)}] e o código ANTIGO dava [${ma}, ${mi}, ${mix}]: a cor do chão mudou`)
    }
  }
  limparCacheDoSolo()

  // ── 1. O ERRO contra o campo exato, em TODOS os 6 biomas (a semente do `macro` muda com o nome do bioma). Medido em níveis de cor 8 bits do canal que mais muda entre as duas cores do solo. ──────────────────
  for (const bioma of BIOMAS) {
    limparCacheDoSolo()
    const exato = campoDoSoloExato(bioma, res)
    const rapido = campoDoSoloRapido(bioma, res)
    const cat = BIOMA_VISUAL_CATALOG[bioma]
    const a = hex(cat.soloCorBase)
    const b = hex(cat.soloCorDetalhe)
    const contraste = Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]))
    let maiorMistura = 0
    let somaMistura = 0
    let maiorRugosidade = 0
    for (let i = 0; i < res * res; i += 1) {
      const dm = Math.abs(rapido.mistura[i] - exato.mistura[i])
      const dr = Math.abs(rapido.macro[i] - exato.macro[i])
      maiorMistura = Math.max(maiorMistura, dm)
      somaMistura += dm
      maiorRugosidade = Math.max(maiorRugosidade, dr)
    }
    const erroDeCorMax = maiorMistura * contraste // em níveis de cor 8 bits
    const erroDeCorMedio = (somaMistura / (res * res)) * contraste
    assert(erroDeCorMax < 1.5, `${bioma}: o erro máximo da COR do solo é ${erroDeCorMax.toFixed(2)} níveis (limite 1,5; contraste das duas cores ${contraste}): acima disso a grade grossa é visível`)
    assert(erroDeCorMedio < 0.2, `${bioma}: o erro MÉDIO da cor é ${erroDeCorMedio.toFixed(3)} níveis (limite 0,2)`)
    // a rugosidade vale `0,88 − macro × 0,12` (e variantes até ×0,28): o erro do `macro` em rugosidade, em níveis de 8 bits, também tem de ser invisível
    assert(maiorRugosidade * 0.28 * 255 < 2.5, `${bioma}: o erro do macro na rugosidade é ${(maiorRugosidade * 0.28 * 255).toFixed(2)} níveis (limite 2,5)`)
  }

  // ── 2. SEM EMENDA: o erro contra o campo EXATO é UNIFORME no ladrilho, inclusive nas últimas colunas e linhas (onde o vizinho da interpolação tem de dar a volta). A 1ª versão deste teste comparava o
  //    salto «último pixel contra primeiro pixel» com o salto entre vizinhos internos, e NÃO via a emenda: o campo do solo é tão suave que o salto de uma emenda (0,018) é MENOR que o do próprio ruído
  //    entre dois pixels vizinhos (0,027): a mutação «sem embrulho periódico» (S7/S8) passou (24/11). A medida que discrimina é o ERRO do campo rápido contra o exato: no código real o erro na borda é
  //    igual ao do interior (razão 1,16), e sem o embrulho é 2,6× maior (razão 2,57). O limite 1,8 separa as duas populações com folga dos dois lados. ──────────────────────────────────────────────────
  for (const bioma of BIOMAS) {
    limparCacheDoSolo()
    const rapido = campoDoSoloRapido(bioma, res)
    const exato = campoDoSoloExato(bioma, res)
    let erroBorda = 0
    let erroInterior = 0
    for (let k = 0; k < res; k += 1) {
      for (const x of [res - 2, res - 1]) erroBorda = Math.max(erroBorda, Math.abs(rapido.mistura[k * res + x] - exato.mistura[k * res + x]))
      for (const y of [res - 2, res - 1]) erroBorda = Math.max(erroBorda, Math.abs(rapido.mistura[y * res + k] - exato.mistura[y * res + k]))
      for (const x of [60, 61]) erroInterior = Math.max(erroInterior, Math.abs(rapido.mistura[k * res + x] - exato.mistura[k * res + x]))
    }
    assert(erroBorda / Math.max(erroInterior, 1e-9) < 1.8, `${bioma}: sem emenda na borda do ladrilho (o erro contra o exato é ${erroBorda.toFixed(4)} na borda e ${erroInterior.toFixed(4)} no interior: razão ${(erroBorda / Math.max(erroInterior, 1e-9)).toFixed(2)}, precisa ficar abaixo de 1,8)`)
  }

  // ── 3. DETERMINISMO E CACHE: duas chamadas dão o MESMO objeto (o desenho não depende de mais nada) e a semente do bioma importa (cada bioma tem o seu macro). ──────────────────────────────────────────────
  limparCacheDoSolo()
  const c1 = campoDoSoloRapido('clareira', res)
  assert(campoDoSoloRapido('clareira', res) === c1, 'a 2ª chamada devolve o MESMO objeto (cache)')
  assert(campoDoSoloRapido('bosque', res) !== c1, 'outro bioma, outro campo (a semente do macro muda com o nome do bioma)')
  let diferentes = 0
  const b1 = campoDoSoloRapido('bosque', res)
  for (let i = 0; i < 2000; i += 1) if (Math.abs(b1.macro[i * 31 % (res * res)] - c1.macro[i * 31 % (res * res)]) > 1e-3) diferentes += 1
  assert(diferentes > 1000, `clareira e bosque têm macros diferentes (${diferentes} de 2000 amostras diferem)`)
  assert(campoDoSoloRapido('clareira', 128) !== c1 && campoDoSoloRapido('clareira', 128).macro.length === 128 * 128, 'outra resolução, outro campo')

  // ── 3b. O CACHE NÃO CRESCE SEM LIMITE: o jogo tem 6 biomas × 3 resoluções = 18 combinações, e guardar todas seguraria ~18 campos de 3 Float32Array (até 3 × 4 MB a 1024 px) para sempre. Guarda-se um número
  //    pequeno dos mais recentes (o mutante «cache sem limite» sobreviveu: nenhum teste pedia mais campos do que o cache comportava). Pede-se mais campos do que cabem e confere-se que o mais antigo SAIU. ─────
  {
    limparCacheDoSolo()
    const primeiro = campoDoSoloRapido('clareira', 16)
    for (const b of BIOMAS) campoDoSoloRapido(b, 24) // 6 campos de outra resolução empurram o primeiro para fora
    for (const b of BIOMAS) campoDoSoloRapido(b, 32) // e mais 6
    assert(campoDoSoloRapido('clareira', 16) !== primeiro, 'o campo mais antigo SAIU do cache depois de 12 pedidos novos (o cache tem teto: não segura memória para sempre)')
    // …mas o cache GUARDA O BASTANTE para o caso real: andar para o quadrado vizinho e VOLTAR (a mesma resolução, outro bioma e de volta) não paga duas vezes. Com capacidade 1 o campo funcionava igual,
    // só que a volta custava de novo: a diferença é de TEMPO, e é o que o cache existe para evitar.
    limparCacheDoSolo()
    const voltaA = campoDoSoloRapido('clareira', 32)
    campoDoSoloRapido('bosque', 32)
    campoDoSoloRapido('ribeira', 32)
    assert(campoDoSoloRapido('clareira', 32) === voltaA, 'voltar à clareira depois de dois biomas vizinhos NÃO paga de novo (o cache guarda os últimos, não só o último)')
  }

  // ── 4. O GANHO é real e é em OPERAÇÕES: a grade tem GRADE² amostras por campo, e não res². A 512 px (o Bonito/Ultra) são 16× menos chamadas de ruído nos campos suaves. ────────────────────────────────────
  assert(GRADE_DO_SOLO >= 64 && GRADE_DO_SOLO <= 256, `a grade do solo fica entre 64 e 256 (veio ${GRADE_DO_SOLO}): abaixo de 64 o erro passa de 8 níveis; acima de 256 o ganho some`)
  assert((512 / GRADE_DO_SOLO) ** 2 >= 4, `a 512 px a grade corta pelo menos 4× as chamadas de ruído (corta ${((512 / GRADE_DO_SOLO) ** 2).toFixed(0)}×)`)

  // ── 5. ENTRADA RUIM: resolução 0, negativa, NaN ou fracionária vira um campo válido (nunca um array de tamanho estranho que quebraria a textura). ──────────────────────────────────────────────────────────
  for (const ruim of [0, -5, Number.NaN, 1.7]) {
    limparCacheDoSolo()
    const c = campoDoSoloRapido('clareira', ruim)
    assert(c.macro.length >= 1 && Number.isInteger(Math.sqrt(c.macro.length)) && c.macro.length === c.mistura.length, `resolução inválida (${String(ruim)}) vira um campo quadrado válido (${c.macro.length} pixels)`)
    assert(c.macro.every((v) => Number.isFinite(v)) && c.mistura.every((v) => Number.isFinite(v)), `e sem NaN dentro (${String(ruim)})`)
  }
}
