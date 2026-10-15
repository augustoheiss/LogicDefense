import type { MathProblem, MathLensId, StructuredTipStep } from '../types/game'

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/**
 * Calibrates difficulty tier so Hardcore (+300) and GodMode (+1000) scale
 * mental sophistication (Difference of Squares, 3-digit constant-difference,
 * multi-step halving) rather than generating meaningless 4-digit random noise.
 */
function getMentalTier(wave: number, waveOffset: number): { tier: 1 | 2 | 3; scale: number } {
  const baseScale = Math.min(12, Math.ceil(wave / 2))
  if (waveOffset >= 1000) {
    return { tier: 3, scale: Math.min(16, baseScale + 6) }
  }
  if (waveOffset >= 300) {
    return { tier: 2, scale: Math.min(14, baseScale + 3) }
  }
  return { tier: 1, scale: baseScale }
}

export function generateMathProblem(wave: number, waveOffset: number = 0): MathProblem {
  const effectiveWave = wave + waveOffset
  let operations: Array<'+' | '-' | 'x' | '÷'> = ['+', '-', 'x']
  if (wave % 10 === 0 || effectiveWave % 10 === 0) {
    operations = ['÷']
  } else if (wave >= 4 && Math.random() < 0.22) {
    operations = ['+', '-', 'x', '÷']
  }

  const op = pick(operations)
  const { tier, scale } = getMentalTier(wave, waveOffset)

  let n1 = 0
  let n2 = 0
  let answer = 0
  const traps: Record<number, string> = {}

  if (op === '+') {
    // 80% chance to craft a "Massinha da Soma" number ending in 6, 7, 8, 9 or 1, 2, 3
    if (Math.random() < 0.8) {
      const maxTens = tier === 1 ? Math.min(8, scale + 1) : tier === 2 ? Math.min(18, scale + 5) : Math.min(35, scale + 10)
      const tens1 = randInt(1, maxTens) * 10
      const unit1 = pick([6, 7, 8, 9])
      n1 = tens1 + unit1
      const shift = 10 - unit1
      const maxTens2 = tier === 1 ? Math.min(6, scale) : tier === 2 ? Math.min(14, scale + 3) : Math.min(25, scale + 8)
      n2 = randInt(1, maxTens2) * 10 + randInt(shift + 1, 8)
      answer = n1 + n2

      // Pedagogical traps:
      // 1. Rounded n1 up (+shift) but forgot to subtract shift from n2
      traps[answer + shift] = `Você arredondou o ${n1} (+${shift}), mas esqueceu de descontar esses ${shift} passos do ${n2}!`
      // 2. Subtracted shift from both or compensated in the wrong direction
      if (answer - shift * 2 > 0) {
        traps[answer - shift * 2] = `Você tirou ${shift} dos dois lados em vez de transferir de um número para o outro.`
      }
      // 3. Off by a ten (carrying slip)
      if (answer - 10 > 0) {
        traps[answer - 10] = `Faltou somar a nova dezena formada quando as unidades passaram de 10.`
      }
    } else {
      // Ataque Direto (no carrying needed: u1+u2 < 10)
      const u1 = randInt(1, 5)
      const u2 = randInt(1, 9 - u1)
      const d1 = randInt(1, Math.min(9, scale + tier)) * 10
      const d2 = randInt(1, Math.min(9 - d1 / 10, scale + tier)) * 10
      n1 = d1 + u1
      n2 = Math.max(11, d2 + u2)
      answer = n1 + n2
      traps[answer + 10] = `As unidades (${u1} + ${u2} = ${u1 + u2}) não passam de 10; não precisava subir 1 na dezena!`
    }
  } else if (op === '-') {
    // 85% chance to craft a "Hack Japonês" subtraction where unit of subtrahend > unit of minuend
    if (Math.random() < 0.85) {
      const subUnit = pick([6, 7, 8, 9])
      const shift = 10 - subUnit
      const maxSubTens = tier === 1 ? Math.min(7, scale + 1) : tier === 2 ? Math.min(18, scale + 5) : Math.min(35, scale + 12)
      const subTens = randInt(1, maxSubTens) * 10
      n2 = subTens + subUnit

      const minUnit = randInt(1, subUnit - 1)
      const diffTens = randInt(1, Math.min(12, scale + tier * 2)) * 10
      n1 = subTens + diffTens + minUnit
      if (n1 <= n2) n1 = n2 + 10 + minUnit
      answer = n1 - n2

      // Pedagogical traps:
      // 1. Classic school error: subtracted larger unit from smaller unit (|u1 - u2|) without borrowing
      const invertedUnitAns = Math.floor(n1 / 10) * 10 - Math.floor(n2 / 10) * 10 + (subUnit - minUnit)
      if (invertedUnitAns !== answer && invertedUnitAns > 0) {
        traps[invertedUnitAns] = `Armadilha clássica: você fez ${subUnit} − ${minUnit} na unidade! Use o Hack Japonês: some +${shift} nos DOIS números (${n1 + shift} − ${n2 + shift}).`
      }
      // 2. Rounded n2 up (+shift) to next ten, but forgot to add +shift to n1!
      if (answer - shift > 0) {
        traps[answer - shift] = `Quase lá! Você avançou +${shift} para zerar o ${n2} (virando ${n2 + shift}), mas esqueceu de avançar +${shift} no ${n1} também!`
      }
      // 3. Forgot to reduce ten after borrowing
      traps[answer + 10] = `Se fizer pelo método antigo de emprestar, lembre de descontar 1 dezena; pelo Hack Japonês (+${shift} nos dois) você nunca precisa emprestar!`
    } else {
      // Ataque Direto (u1 >= u2 and d1 >= d2)
      const u2 = randInt(1, 4)
      const u1 = randInt(u2 + 1, 9)
      const d2 = randInt(1, Math.min(6, scale)) * 10
      const d1 = d2 + randInt(1, Math.min(6, scale)) * 10
      n1 = d1 + u1
      n2 = d2 + u2
      answer = n1 - n2
      traps[answer + 10] = `Cuidado na casa das dezenas: ${d1} − ${d2} = ${d1 - d2}.`
    }
  } else if (op === 'x') {
    // Choose among the 5 Heiss-Lab Multiplication Archetypes
    const roll = Math.random()
    if (roll < 0.28 && (scale >= 3 || tier >= 2)) {
      // Archetype 1: A Diferença de Quadrados (mid + pass) × (mid - pass) = mid² - pass²
      const bases = tier === 1 ? [10, 20] : tier === 2 ? [10, 20, 30] : [20, 30, 40, 50]
      const mid = pick(bases)
      const pass = pick([1, 2, 3, 4])
      n1 = mid + pass
      n2 = mid - pass
      if (Math.random() < 0.5) { const t = n1; n1 = n2; n2 = t }
      answer = n1 * n2
      const midSq = mid * mid
      const passSq = pass * pass
      traps[midSq] = `Você calculou a base ao quadrado (${mid}² = ${midSq}), mas esqueceu de tirar o passo ao quadrado (− ${pass}² = −${passSq})!`
      traps[midSq - pass] = `Na Diferença de Quadrados, tiramos ${pass}² (${passSq}), e não apenas ${pass}!`
      traps[midSq + passSq] = `A fórmula é a DIFERENÇA de quadrados (${midSq} − ${passSq} = ${answer}), não a soma!`
    } else if (roll < 0.48) {
      // Archetype 2: O Truque do 5 (Nosso Relógio)
      n2 = 5
      n1 = tier === 1 ? randInt(3, 9) * 2 : tier === 2 ? randInt(6, 18) * 2 : randInt(12, 32) * 2
      if (Math.random() < 0.4) { const t = n1; n1 = n2; n2 = t }
      const other = n1 === 5 ? n2 : n1
      answer = n1 * n2
      traps[other * 10] = `Multiplicar por 5 é multiplicar por 10 (${other * 10}) e CORTAR NA METADE (${answer})!`
      traps[answer + 5] = `Dica do Relógio: metade de ${other} é ${other / 2}, com um zero no final vira ${answer} cravado!`
    } else if (roll < 0.68) {
      // Archetype 3: O Infinito que Completa (Regra do 9)
      n1 = 9
      n2 = tier === 1 ? randInt(3, 9) : tier === 2 ? randInt(6, 16) : randInt(11, 25)
      if (Math.random() < 0.5) { const t = n1; n1 = n2; n2 = t }
      const other = n1 === 9 ? n2 : n1
      answer = n1 * n2
      traps[other * 10 - 1] = `Na regra do 9 (${other} × 10 − ${other}), você tira um grupo inteiro de ${other}, e não apenas 1 unidade!`
      traps[answer + 9] = `Você fez ${other} × 10 = ${other * 10}; agora basta tirar ${other} para chegar em ${answer}.`
    } else if (roll < 0.85) {
      // Archetype 4: A Base do Universo (2, 4, 8 — Dobro, Dobro do Dobro, Cubo)
      const baseFactor = pick([2, 4, 8])
      const other = tier === 1 ? randInt(4, 12) : tier === 2 ? randInt(8, 22) : randInt(14, 35)
      n1 = other
      n2 = baseFactor
      answer = n1 * n2
      if (baseFactor === 4) {
        traps[other * 2] = `Multiplicar por 4 é o DOBRO DUAS VEZES: o dobro de ${other} é ${other * 2}, e o dobro de ${other * 2} é ${answer}!`
      } else if (baseFactor === 8) {
        traps[other * 4] = `Multiplicar por 8 é dobrar TRÊS vezes (${other} ➔ ${other * 2} ➔ ${other * 4} ➔ ${answer})!`
      }
    } else {
      // Archetype 5: Decomposição Tática
      n1 = tier === 1 ? randInt(11, 19) : tier === 2 ? randInt(13, 28) : randInt(22, 48)
      n2 = randInt(3, 8)
      answer = n1 * n2
      const d = Math.floor(n1 / 10) * 10
      const u = n1 % 10
      traps[d * n2 + u] = `Você multiplicou a dezena (${d} × ${n2} = ${d * n2}), mas esqueceu de multiplicar a unidade (${u} × ${n2} = ${u * n2})!`
    }
  } else {
    // op === '÷' (Boss Wave or Division Challenge)
    const roll = Math.random()
    if (roll < 0.55) {
      // Corta no Meio (Ambos pares: divide por 4, 6, 8 ou 12)
      n2 = pick([4, 6, 8, 12])
      answer = tier === 1 ? randInt(4, 15) : tier === 2 ? randInt(11, 28) : randInt(18, 45)
      n1 = n2 * answer
      traps[n1 / 2] = `Você cortou pela metade uma vez (${n1 / 2}), mas para dividir por ${n2} precisamos continuar simplificando até ${answer}!`
      traps[answer + 2] = `Simplifique cortando os dois números pela metade: ${n1} ÷ ${n2} = ${n1 / 2} ÷ ${n2 / 2} = ${answer}.`
    } else {
      // Espelho da Tabuada / Fênix (7, 9, 3)
      n2 = pick([3, 7, 9])
      answer = tier === 1 ? randInt(5, 12) : tier === 2 ? randInt(11, 24) : randInt(16, 36)
      n1 = n2 * answer
      traps[answer + 1] = `Use o Espelho da Multiplicação: ${n2} × ${answer} = ${n1}.`
      if (answer - 1 > 0) traps[answer - 1] = `Quase! Faltou 1 grupo de ${n2} para completar ${n1}.`
    }
  }

  const baseProblem: MathProblem = { n1, n2, op, answer }
  const enriched = enrichProblemWithPedagogy(baseProblem, traps)
  return enriched
}

export function buildQuestionText(problem: MathProblem): string {
  const { n1, n2, op } = problem
  if (op === '÷') return `CHEFE! ${n1} ÷ ${n2} = ?`
  return `${n1} ${op} ${n2} = ?`
}

export function generateOptions(
  answer: number,
  problem?: MathProblem,
  optionCount: 3 | 4 = 3,
): number[] {
  const options: number[] = [answer]

  // 1. Prioritize diagnostic pedagogical traps if available
  if (problem?.trapExplanations) {
    for (const key of Object.keys(problem.trapExplanations)) {
      const trapVal = Number(key)
      if (
        Number.isFinite(trapVal) &&
        trapVal >= 0 &&
        trapVal !== answer &&
        !options.includes(trapVal)
      ) {
        options.push(trapVal)
        if (options.length >= optionCount) break
      }
    }
  }

  // 2. Smart offsets that preserve unit digit or tens step (realistic mental decoys)
  const smartOffsets = [-10, 10, -2, 2, -4, 4, -5, 5, -3, 3, -1, 1]
  for (const off of smartOffsets) {
    if (options.length >= optionCount) break
    const candidate = answer + off
    if (candidate >= 0 && candidate !== answer && !options.includes(candidate)) {
      options.push(candidate)
    }
  }

  // 3. Fallback safety loop
  while (options.length < optionCount) {
    const fake = answer + Math.floor(Math.random() * 12) - 6
    if (fake !== answer && fake >= 0 && !options.includes(fake)) options.push(fake)
  }

  return options.sort(() => Math.random() - 0.5)
}

function formatCascata(a: number, shift: number, op: '+' | '-'): string {
  if (shift === 0) return `${a}`
  if (shift < 10) return `${a} ${op} ${shift} = ${op === '+' ? a + shift : a - shift}`
  const res = op === '+' ? a + shift : a - shift
  const u = shift % 10
  const d = shift - u
  if (u === 0) return `${a} ${op} ${shift} = ${res}`
  const step1 = op === '+' ? a + u : a - u
  return `${a} ${op} ${shift} = ${step1} ${op} ${d} = ${res}`
}

function stripTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .trim()
}

function enrichProblemWithPedagogy(
  problem: MathProblem,
  traps: Record<number, string>,
): MathProblem {
  const { n1, n2, op, answer } = problem
  let lensId: MathLensId = 'ataque_direto'
  let lensTitle = 'Ataque Direto na Reta Numérica'
  let shortHint = `Calcule do maior para o menor: ${n1} ${op} ${n2}`
  const structuredSteps: StructuredTipStep[] = []

  if (op === '+') {
    const u1 = n1 % 10, u2 = n2 % 10
    const d1 = Math.floor((n1 % 100) / 10), d2 = Math.floor((n2 % 100) / 10)
    const c1 = Math.floor(n1 / 100), c2 = Math.floor(n2 / 100)

    if (u1 + u2 < 10 && d1 + d2 < 10 && c1 + c2 < 10) {
      lensId = 'ataque_direto'
      lensTitle = 'Ataque Direto (Sem Vai-Um)'
      shortHint = `Some dezenas com dezenas e unidades com unidades!`
      structuredSteps.push({
        badge: '⚡ ATAQUE DIRETO',
        title: 'Linha de Frente Limpa',
        content: `Nenhuma casa passa de 10! Some direto da esquerda para a direita: ${n1} + ${n2} = ${answer}.`,
      })
    } else {
      lensId = 'lei_menor_esforco'
      lensTitle = 'A Lei do Menor Esforço (Massinha da Soma)'
      const alvo = u1 >= 6 ? n1 : u2 >= 6 ? n2 : n1
      const outro = alvo === n1 ? n2 : n1
      const shift = u1 >= 6 || u2 >= 6 ? 10 - (alvo % 10) : alvo % 10
      const isUp = u1 >= 6 || u2 >= 6
      const temp1 = isUp ? alvo + shift : alvo - shift
      const temp2 = isUp ? outro - shift : outro + shift
      shortHint = `💡 Molde a massinha: transforme em ${temp1} + ${temp2}!`
      structuredSteps.push(
        {
          badge: '🧱 PASSO 1 — MOLDAR A MASSINHA',
          title: 'Arredondar sem "Subir 1"',
          content: isUp
            ? `O ${alvo} precisa de apenas +${shift} passos para fechar ${temp1}. Tiramos ${shift} do ${outro} (${outro} − ${shift} = ${temp2}) e passamos para ele!`
            : `Recuamos ${shift} passos no ${alvo} para fechar ${temp1} redondo e somamos esses +${shift} no ${outro} (${outro} + ${shift} = ${temp2}).`,
        },
        {
          badge: '🎯 PASSO 2 — DECOMPOSIÇÃO FINAL',
          title: 'Do Maior para o Menor',
          content: `Agora a conta ficou limpa e redonda: ${temp1} + ${temp2} = ${answer}!`,
        },
      )
    }
  } else if (op === '-') {
    const u1 = n1 % 10, u2 = n2 % 10
    const d1 = Math.floor((n1 % 100) / 10), d2 = Math.floor((n2 % 100) / 10)
    const c1 = Math.floor(n1 / 100), c2 = Math.floor(n2 / 100)

    if (u1 >= u2 && d1 >= d2 && c1 >= c2) {
      lensId = 'ataque_direto'
      lensTitle = 'Ataque Direto (Sem Emprestar)'
      shortHint = `Todas as casas de ${n1} são maiores que as de ${n2}!`
      structuredSteps.push({
        badge: '⚡ ATAQUE DIRETO',
        title: 'Subtração Limpa',
        content: `Não precisa pedir emprestado em nenhuma casa: ${n1} − ${n2} = ${answer}.`,
      })
    } else {
      lensId = 'hack_japones'
      lensTitle = 'O Hack Japonês (O Subtraendo é o Rei)'
      const shift = u2 >= 5 ? 10 - u2 : u2 > 0 ? u2 : 100 - (n2 % 100)
      const isAdding = u2 >= 5 || u2 === 0
      const novoN1 = isAdding ? n1 + shift : n1 - shift
      const novoN2 = isAdding ? n2 + shift : n2 - shift
      const sign = isAdding ? '+' : '−'
      shortHint = `💡 Nunca empreste! Faça ${sign}${shift} nos DOIS ➔ ${novoN1} − ${novoN2}`
      structuredSteps.push(
        {
          badge: '🗡️ PASSO 1 — O SUBTRAENDO É O REI',
          title: `Zerar o ${n2} Mantendo a Distância`,
          content: `Olhe apenas para o número de baixo (${n2}): damos ${sign}${shift} passos nos DOIS números na reta numérica. O ${n1} vira ${novoN1} e o ${n2} vira ${novoN2} redondo!`,
        },
        {
          badge: '⚡ PASSO 2 — DESCIDA RETA SEM DOR',
          title: 'Distância Intacta',
          content: `Sem precisar "pedir emprestado": ${novoN1} − ${novoN2} = ${answer}!`,
        },
      )
    }
  } else if (op === 'x') {
    const diff = Math.abs(n1 - n2)
    const mid = Math.min(n1, n2) + diff / 2

    if (diff > 0 && diff % 2 === 0 && mid % 10 === 0) {
      const pass = diff / 2
      lensId = 'diferenca_quadrados'
      lensTitle = 'A Diferença de Quadrados (a² − b²)'
      shortHint = `💡 Equidistantes de ${mid}: faça ${mid}² − ${pass}² (${mid * mid} − ${pass * pass})`
      structuredSteps.push(
        {
          badge: '📐 GEOMETRIA DA MENTE',
          title: `(${mid} + ${pass}) × (${mid} − ${pass})`,
          content: `Ambos estão a exatamente ${pass} passos do centro ${mid}!`,
        },
        {
          badge: '⚡ FÓRMULA SOBERANA',
          title: 'Base² menos Passo²',
          content: `${mid}² − ${pass}² = ${mid * mid} − ${pass * pass} = ${answer}!`,
        },
      )
    } else if (n1 === 5 || n2 === 5) {
      const outro = n1 === 5 ? n2 : n1
      lensId = 'truque_relogio_5'
      lensTitle = 'O Nosso Relógio (Truque do ×5)'
      shortHint = `💡 Multiplique ${outro} por 10 (${outro * 10}) e corte na metade!`
      structuredSteps.push({
        badge: '🕔 O TRUQUE DO 5',
        title: 'Multiplica por 10 e Corta no Meio',
        content: `5 é a metade de 10! Faça ${outro} × 10 = ${outro * 10}, e a metade de ${outro * 10} é ${answer}!`,
      })
    } else if (n1 === 9 || n2 === 9) {
      const outro = n1 === 9 ? n2 : n1
      lensId = 'infinito_9'
      lensTitle = 'O Infinito que Completa (Regra do ×9)'
      shortHint = `💡 Faça 10 × ${outro} (${outro * 10}) e tire um ${outro}!`
      structuredSteps.push({
        badge: '♾️ A REGRA DIVINA DO 9',
        title: '10 Grupos Menos 1 Grupo',
        content: `Em vez de decorar, multiplique por 10 (${outro} × 10 = ${outro * 10}) e subtraia o próprio ${outro}: ${outro * 10} − ${outro} = ${answer}!`,
      })
    } else if (n1 === 2 || n2 === 2 || n1 === 4 || n2 === 4 || n1 === 8 || n2 === 8) {
      const base = [2, 4, 8].includes(n1) ? n1 : n2
      const outro = base === n1 ? n2 : n1
      lensId = 'base_universo_248'
      lensTitle = `A Base do Universo (×${base})`
      shortHint =
        base === 2
          ? `💡 O dobro direto de ${outro}`
          : base === 4
            ? `💡 O dobro do dobro: ${outro} ➔ ${outro * 2} ➔ ${answer}`
            : `💡 O cubo de 2 (dobre 3 vezes): ${outro} ➔ ${outro * 2} ➔ ${outro * 4} ➔ ${answer}`
      structuredSteps.push({
        badge: '🌌 BASE 2 · 4 · 8',
        title: base === 4 ? 'O Dobro Duas Vezes' : base === 8 ? 'O Dobro Três Vezes' : 'A Simetria Binária',
        content:
          base === 4
            ? `Multiplicar por 4 é dobrar duas vezes: dobro de ${outro} é ${outro * 2}; dobro de ${outro * 2} é ${answer}!`
            : base === 8
              ? `Multiplicar por 8 é dobrar três vezes seguidas: ${outro} ➔ ${outro * 2} ➔ ${outro * 4} ➔ ${answer}!`
              : `O dobro de ${outro} fecha diretamente em ${answer}.`,
      })
    } else {
      const maior = Math.max(n1, n2)
      const menor = Math.min(n1, n2)
      const d = Math.floor(maior / 10) * 10
      const u = maior % 10
      lensId = 'decomposicao_tatica'
      lensTitle = 'Decomposição Tática (Maior pro Menor)'
      shortHint = `💡 Separe: (${d} × ${menor}) + (${u} × ${menor})`
      structuredSteps.push({
        badge: '🧩 DECOMPOSIÇÃO TÁTICA',
        title: 'Fatie o Maior Número',
        content: `Separe ${maior} em ${d} + ${u}: (${d} × ${menor} = ${d * menor}) mais (${u} × ${menor} = ${u * menor}) = ${answer}!`,
      })
    }
  } else {
    // op === '÷'
    if (n1 % 2 === 0 && n2 % 2 === 0 && n2 !== 10) {
      lensId = 'corta_no_meio'
      lensTitle = 'Corta no Meio (Simplificação Sucessiva)'
      shortHint = `💡 Ambos são pares! Corte pela metade: ${n1 / 2} ÷ ${n2 / 2}`
      structuredSteps.push({
        badge: '✂️ CORTA NO MEIO',
        title: 'Reduza os Dois pela Metade',
        content: `Quando ambos são pares, corte pela metade sem dó: ${n1} ÷ ${n2} vira ${n1 / 2} ÷ ${n2 / 2} = ${answer}!`,
      })
    } else if (n2 === 7 || n2 === 9) {
      lensId = 'numero_fenix_7'
      lensTitle = n2 === 7 ? 'O Número da Fênix (÷7)' : 'A Roda do Infinito (÷9)'
      shortHint = `💡 Espelho da Tabuada: ${n2} × ? = ${n1}`
      structuredSteps.push({
        badge: '🔥 ESPELHO DA LÓGICA',
        title: `Quantas vezes o ${n2} cabe em ${n1}?`,
        content: `Inverta a pergunta para multiplicação: ${n2} × 10 = ${n2 * 10}, ajustando os passos chegamos em ${n2} × ${answer} = ${n1}!`,
      })
    } else {
      lensId = 'corta_no_meio'
      lensTitle = 'A Chave & Inversão Tática'
      shortHint = `💡 Pense: ${n2} × ? = ${n1}`
      const rawTip = stripTags(generateTip(problem))
      structuredSteps.push({
        badge: '🗝️ A CHAVE DE DIVISÃO',
        title: 'Fatiando do Maior para o Menor',
        content: rawTip,
      })
    }
  }

  return {
    ...problem,
    lensId,
    lensTitle,
    shortHint,
    trapExplanations: traps,
    structuredSteps,
  }
}

export function generateTip(problem: MathProblem): string {
  const { n1, n2, op, answer } = problem
  let text = ''

  if (op === '+') {
    const u1 = n1 % 10, u2 = n2 % 10
    const d1 = Math.floor((n1 % 100) / 10), d2 = Math.floor((n2 % 100) / 10)
    const c1 = Math.floor(n1 / 100), c2 = Math.floor(n2 / 100)

    if (u1 + u2 < 10 && d1 + d2 < 10 && c1 + c2 < 10) {
      text = `Ataque Direto:<br>Bicho, a linha de frente ta pronta nesse aqui, só ir DIRETO, encaixar e dar um play. Pensa nos passos da reta numérica, não vamos dar passos grandes!<br><span class="tip-highlight">${n1} + ${n2} = ${answer}</span>.`
    } else {
      let temp1 = n1, temp2 = n2
      let shiftText = ''
      const tu1 = n1 % 100, tu2 = n2 % 100

      if (u1 === 0 || u2 === 0) {
        if ((tu1 >= 60 || tu2 >= 60) && (n1 >= 100 || n2 >= 100)) {
          const alvo = tu1 >= 60 ? n1 : n2
          const outro = tu1 >= 60 ? n2 : n1
          const shift = 100 - (alvo % 100)
          temp1 = alvo + shift; temp2 = outro - shift
          shiftText = `A Lei do Menor Esforço (Centenas):<br>O número ${alvo} está precisando de apenas ${shift} passos na reta numérica para fechar uma centena forte. Tiramos ${shift} do outro (<span class="tip-highlight">${formatCascata(outro, shift, '-')}</span>) e damos para ele.<br>Nova forma da massinha: <span class="tip-highlight">${temp1} + ${temp2}</span>.<br><br>`
        } else if ((tu1 >= 10 && tu1 <= 40) || (tu2 >= 10 && tu2 <= 40)) {
          const alvo = (tu1 >= 10 && tu1 <= 40) ? n1 : n2
          const outro = (tu1 >= 10 && tu1 <= 40) ? n2 : n1
          const shift = alvo % 100
          temp1 = alvo - shift; temp2 = outro + shift
          shiftText = `A Lei do Menor Esforço (Centenas):<br>O número ${alvo} está quebrado, damos ${shift} passos para trás para arredondar para baixo, e jogamos esse peso no outro (<span class="tip-highlight">${formatCascata(outro, shift, '+')}</span>).<br>Nova forma da massinha: <span class="tip-highlight">${temp1} + ${temp2}</span>.<br><br>`
        } else {
          shiftText = `Como um dos números já termina em zero perfeito, não precisamos fazer ajustes na massinha. Vamos direto pro ataque final!<br><br>`
        }
      } else {
        if (u1 >= 6 || u2 >= 6) {
          const alvo = u1 >= 6 ? n1 : n2
          const outro = u1 >= 6 ? n2 : n1
          const shift = 10 - (alvo % 10)
          temp1 = alvo + shift; temp2 = outro - shift
          shiftText = `A Lei do Menor Esforço (Finais 6 a 9):<br>O ${alvo} está a apenas ${shift} passos na reta numérica da próxima dezena. Arredondamos para cima virando ${temp1}, e tiramos os mesmos ${shift} passos do outro (<span class="tip-highlight">${formatCascata(outro, shift, '-')}</span>).<br>Nova forma da massinha: <span class="tip-highlight">${temp1} + ${temp2}</span>.<br><br>`
        } else if ((u1 >= 1 && u1 <= 4) || (u2 >= 1 && u2 <= 4)) {
          const alvo = (u1 >= 1 && u1 <= 4) ? n1 : n2
          const outro = (u1 >= 1 && u1 <= 4) ? n2 : n1
          const shift = alvo % 10
          temp1 = alvo - shift; temp2 = outro + shift
          shiftText = `A Lei do Menor Esforço (Finais 1 a 4):<br>Damos ${shift} passos para trás no ${alvo} para arredondar para baixo (vira ${temp1}), e andamos esses passos guardados somando no outro (<span class="tip-highlight">${formatCascata(outro, shift, '+')}</span>).<br>Nova forma da massinha: <span class="tip-highlight">${temp1} + ${temp2}</span>.<br><br>`
        }
      }

      const c1v = Math.floor(temp1 / 100) * 100, c2v = Math.floor(temp2 / 100) * 100
      const d1v = Math.floor((temp1 % 100) / 10) * 10, d2v = Math.floor((temp2 % 100) / 10) * 10
      const u1v = temp1 % 10, u2v = temp2 % 10
      let decompText = `Decomposição Final (Do Maior pro Menor):<br>`
      if (temp1 >= 100 || temp2 >= 100) decompText += `Centenas: <span class="tip-highlight">${c1v} + ${c2v} = ${c1v + c2v}</span><br>`
      decompText += `Dezenas: <span class="tip-highlight">${d1v} + ${d2v} = ${d1v + d2v}</span><br>`
      decompText += `Unidades: <span class="tip-highlight">${u1v} + ${u2v} = ${u1v + u2v}</span><br>`
      decompText += `Junta tudo: <span class="tip-highlight">${answer}</span>.`
      text = shiftText + decompText
    }
  } else if (op === '-') {
    const u1 = n1 % 10, u2 = n2 % 10
    const d1 = Math.floor((n1 % 100) / 10), d2 = Math.floor((n2 % 100) / 10)
    const c1 = Math.floor(n1 / 100), c2 = Math.floor(n2 / 100)

    if (u1 >= u2 && d1 >= d2 && c1 >= c2) {
      text = `Ataque Direto:<br>Bicho, esse aqui dá pra ir direto na linha de frente que ta fácil mete bala. Pensa nos passos da reta numérica, não vamos dar passos grandes!<br><span class="tip-highlight">${n1} - ${n2} = ${answer}</span>.`
    } else {
      let shift = 0, isAdding = true
      let alvoDesc = 'unidade'
      const tu2 = n2 % 100

      if (n2 >= 100 && tu2 !== 0 && tu2 > 10) {
        alvoDesc = 'dezena e unidade'
        if (tu2 >= 50) { shift = 100 - tu2; isAdding = true }
        else { shift = tu2; isAdding = false }
      } else {
        if (u2 !== 0) {
          if (u2 >= 5) { shift = 10 - u2; isAdding = true; alvoDesc = 'unidade' }
          else { shift = u2; isAdding = false; alvoDesc = 'unidade' }
        } else if (n2 >= 10 && n2 % 10 === 0) {
          const t2 = Math.floor((n2 % 100) / 10)
          if (t2 !== 0) {
            alvoDesc = 'dezena'
            if (t2 >= 5) { shift = 100 - (n2 % 100); isAdding = true }
            else { shift = n2 % 100; isAdding = false }
          }
        }
      }

      if (shift > 0) {
        const novoN1 = isAdding ? n1 + shift : n1 - shift
        const novoN2 = isAdding ? n2 + shift : n2 - shift
        const operacao = isAdding ? `Avançamos ${shift} passos` : `Voltamos ${shift} passos`
        const opSign: '+' | '-' = isAdding ? '+' : '-'
        text = `Hack Japonês (O Subtraendo é o Rei: ${n2}):<br>A regra é nunca pedir emprestado! Olhamos SÓ para o número de baixo: ${operacao} na reta numérica dos DOIS números para zerar a ${alvoDesc} dele.<br>O ${n1} acompanha: <span class="tip-highlight">${formatCascata(n1, shift, opSign)}</span>.<br>O ${n2} zera a ${alvoDesc}: <span class="tip-highlight">${formatCascata(n2, shift, opSign)}</span>.<br>A distância matemática se manteve intacta. O cálculo agora desce reto e sem dor!<br><span class="tip-highlight">${novoN1} - ${novoN2} = ${answer}</span>.`
      } else {
        text = `Hack Japonês:<br>O subtraendo (${n2}) já está redondo como uma pedra. A distância está perfeita, faça o cálculo direto sem medo de emprestar!<br><span class="tip-highlight">${n1} - ${n2} = ${answer}</span>.`
      }
    }
  } else if (op === 'x') {
    const diff = Math.abs(n1 - n2)
    const mid = Math.min(n1, n2) + diff / 2

    if (n1 === 10 || n2 === 10 || n1 === 100 || n2 === 100 || n1 === 1 || n2 === 1) {
      if (n1 === 1 || n2 === 1) {
        text = `A Regra Campeã (x1):<br>Se multiplicar por 1 é sempre ele mesmo, o elemento NEUTRO da multiplicação!<br>Resultado: <span class="tip-highlight">${answer}</span>.`
      } else {
        const isCem = n1 === 100 || n2 === 100
        const zeros = isCem ? 'dois 0s' : 'um 0'
        const mult = isCem ? '100' : '10'
        text = `A Regra Campeã (x${mult}):<br>Nosso campeão da multiplicação! Multiplicar por ${mult} é só potencializar a casa decimal para a direita, adicionando ${zeros}!<br>Resultado direto: <span class="tip-highlight">${answer}</span>.`
      }
    } else if (diff > 0 && diff % 2 === 0 && mid % 10 === 0) {
      const pass = diff / 2
      text = `A Diferença de Quadrados (A Geometria da Mente):<br>Ambos estão a ${pass} passos de distância do número ${mid}. Isso é (${mid} + ${pass}) x (${mid} - ${pass}).<br>Elevamos os dois ao quadrado e tiramos a diferença:<br><span class="tip-highlight">${mid}x${mid} - ${pass}x${pass}</span><br><span class="tip-highlight">${mid * mid} - ${pass * pass} = ${answer}</span>.`
    } else if (n1 >= 100 && n2 >= 100) {
      const c1 = Math.round(n1 / 100) * 100, c2 = Math.round(n2 / 100) * 100
      text = `Titãs Centenários:<br>Arredondamos as centenas! O ${n1} vira ${c1} e o ${n2} vira ${c2}.<br>Multiplicamos a base pesada: <span class="tip-highlight">${c1} x ${c2} = ${c1 * c2}</span>.<br>Depois ajustamos o que sobrou para chegar no <span class="tip-highlight">${answer}</span>.`
    } else if ((n1 === 5 && n2 > 5) || (n2 === 5 && n1 > 5)) {
      const tem5 = n1 === 5 ? n2 : n1
      text = `O Truque do 5:<br>Multiplicar por 5 = multiplicar por 10 e cortar na metade. Rápido e letal!<br><span class="tip-highlight">${tem5} x 10 = ${tem5 * 10}</span>.<br>A metade de ${tem5 * 10} é <span class="tip-highlight">${answer}</span>.`
    } else {
      const maior = Math.max(n1, n2), menor = Math.min(n1, n2)
      if (maior >= 10) {
        const c = Math.floor(maior / 100) * 100
        const d = Math.floor((maior % 100) / 10) * 10
        const u = maior % 10
        const baseRedonda = c > 0 ? (c + (d > 50 ? 100 : 0)) : (Math.floor(maior / 10) * 10 + (u >= 5 ? 10 : 0))
        const resto = maior - baseRedonda
        if (resto < 0) {
          const excesso = Math.abs(resto)
          text = `Estratégia do Excesso:<br>O ${maior} arredonda para ${baseRedonda}.<br><span class="tip-highlight">${baseRedonda} x ${menor} = ${baseRedonda * menor}</span>.<br>Cortamos o excesso: <span class="tip-highlight">${formatCascata(baseRedonda * menor, excesso * menor, '-')}</span>.`
        } else {
          text = `Decomposição Tática:<br>O ${maior} fica redondo no ${baseRedonda}.<br>Base: <span class="tip-highlight">${baseRedonda} x ${menor} = ${baseRedonda * menor}</span>.<br>Mais o resto: <span class="tip-highlight">${formatCascata(baseRedonda * menor, resto * menor, '+')}</span>.`
        }
      } else {
        text = `Ataque Direto:<br>Para esses números de unidade, a memória muscular fala mais alto.<br><span class="tip-highlight">${n1} x ${n2} = ${answer}</span>.`
      }
    }
  } else if (op === '÷') {
    let temp_n1 = n1, temp_n2 = n2
    let simplificou = false, stepStr = ''

    if (temp_n2 !== 10 && n1 % 2 === 0 && n2 % 2 === 0) {
      simplificou = true
      stepStr += `Corta no Meio (Simplificação):<br>Se ambos são pares, vá cortando pela metade sem dó:<br>`
      while (temp_n1 % 2 === 0 && temp_n2 % 2 === 0 && temp_n2 !== 10) {
        stepStr += `<span class="tip-highlight">${temp_n1} ÷ ${temp_n2}</span> ➔ <span class="tip-highlight">${temp_n1 / 2} ÷ ${temp_n2 / 2}</span><br>`
        temp_n1 /= 2; temp_n2 /= 2
        if (temp_n2 === 10) break
      }
    }

    if (temp_n2 === 10) {
      const prefix = simplificou ? stepStr + `<br>` : ''
      text = prefix + `A Majestade Decimal (÷10):<br>O 10 muda apenas a vírgula de lugar para a esquerda no <span class="tip-highlight">${temp_n1}</span>!<br>Resultado direto: <span class="tip-highlight">${answer}</span>.`
    } else if (temp_n2 === 1) {
      text = simplificou ? stepStr + `<br>Dividir por 1 é o próprio número: <span class="tip-highlight">${temp_n1}</span>.` : `Direto: <span class="tip-highlight">${n1}</span>.`
    } else if (temp_n1 <= temp_n2 * 10) {
      const prefix = simplificou ? stepStr + `<br>Ficou mais fácil! Inversão:<br>` : `Inversão:<br>`
      text = prefix + `Quantas vezes o <span class="tip-highlight">${temp_n2}</span> cabe em <span class="tip-highlight">${temp_n1}</span>?<br>Pense: ${temp_n2} x ? = ${temp_n1}.`
    } else {
      const prefix = simplificou ? stepStr + `<br>Ainda tá grande? Use a "Chave":<br>` : `A "Chave" (Abaixando um por um):<br>`
      const sN1 = temp_n1.toString()
      let chaveStr = '', curr = 0
      for (let i = 0; i < sN1.length; i++) {
        curr = curr * 10 + parseInt(sN1[i])
        if (curr < temp_n2 && i === 0) { chaveStr += `O ${curr} é menor que ${temp_n2}. Abaixa o próximo.<br>` }
        else if (curr < temp_n2) { chaveStr += `Abaixa o ${sN1[i]} -> fica ${curr}. Menor que ${temp_n2}, 0 no quoc.<br>` }
        else {
          const q = Math.floor(curr / temp_n2), rem = curr % temp_n2, sub = q * temp_n2
          chaveStr += `Abaixa o ${sN1[i]} -> fica <span class="tip-highlight">${curr}</span>. <span class="tip-highlight">${curr} - ${sub} = ${rem}</span> (quoc. ${q}).<br>`
          curr = rem
        }
      }
      chaveStr += `Resultado: <span class="tip-highlight">${answer}</span>.`
      text = prefix + chaveStr
    }
  }

  return text
}

