// ============================================================
// Logic Friction — Math Bridge
// Sprint 4: Standardized interface to both math engines.
// Odd waves → LogicDefense (basic arithmetic)
// Even waves → LogicAscension (PEMDAS / fractions)
// ============================================================
import { generateMathProblem, buildQuestionText, generateOptions, generateTip } from '../../LogicDefense/engine/mathEngine'
import { generateDynamicQuestion } from '../../LogicAscension/mathEngine'

// ── Unified Output ──────────────────────────────────────────────────────────────
export interface FrictionAnswer {
  value: number
  label: string    // Display label (e.g. "3/4" for fractions, "42" for integers)
  isCorrect: boolean
}

export interface FrictionProblem {
  expression: string
  answers: FrictionAnswer[]
  explanation: string
}

// ── Strip HTML tags from explanation strings ─────────────────────────────────────
// LogicDefense tips use <br>, <span>, etc. — we need plain text for 3D rendering.
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// ── Main Generator ──────────────────────────────────────────────────────────────
/**
 * Generates a standardized math problem for a given wave.
 *
 * Wave 1, 3, 5, 7 … → Basic arithmetic (LogicDefense engine)
 * Wave 2, 4, 6, 8 … → PEMDAS / fractions (LogicAscension engine)
 *
 * The difficulty scales with the wave number:
 * - Defense: `wave` directly maps to `generateMathProblem(wave)`
 * - Ascension: `stage = ceil(wave / 2)` maps to `generateDynamicQuestion(stage)`
 */
export function generateFrictionProblem(waveNumber: number): FrictionProblem {
  const isOdd = waveNumber % 2 !== 0

  if (isOdd) {
    return generateFromDefense(waveNumber)
  } else {
    return generateFromAscension(waveNumber)
  }
}

// ── Defense Adapter (Odd Waves) ─────────────────────────────────────────────────
function generateFromDefense(wave: number): FrictionProblem {
  const problem = generateMathProblem(wave, 0)
  const expression = buildQuestionText(problem)
  const options = generateOptions(problem.answer) // Returns 3 options
  const explanation = stripHtml(generateTip(problem))

  // Pad to exactly 4 answers
  while (options.length < 4) {
    const fake = problem.answer + Math.floor(Math.random() * 20) - 10
    if (fake !== problem.answer && fake >= 0 && !options.includes(fake)) {
      options.push(fake)
    }
  }

  // Shuffle
  const shuffled = options.sort(() => Math.random() - 0.5)

  const answers: FrictionAnswer[] = shuffled.map(value => ({
    value,
    label: String(value),
    isCorrect: value === problem.answer,
  }))

  return { expression, answers, explanation }
}

// ── Float → Fraction fallback ───────────────────────────────────────────────────
// If a numeric value wasn't found in answerLabels, try to reconstruct a fraction
// string by testing common denominators (2–12). Returns "1/3" instead of "0.333…".
function floatToFractionLabel(value: number): string {
  // Integer — no fraction needed
  if (Number.isInteger(value)) return String(value)

  // Try denominators 2 through 12
  for (let d = 2; d <= 12; d++) {
    const n = Math.round(value * d)
    if (Math.abs(n / d - value) < 1e-9) {
      // Simplify via GCD
      const g = gcd(Math.abs(n), d)
      const sn = n / g
      const sd = d / g
      return sd === 1 ? `${sn}` : `${sn}/${sd}`
    }
  }

  // Fallback: 2 decimal places
  return value.toFixed(2).replace(/\.?0+$/, '')
}

// Simple GCD for the fallback
function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

// Snap to 5 decimal places — must match the Ascension engine's snap precision
function snap(v: number): number {
  return Math.round(v * 100000) / 100000
}

// ── Ascension Adapter (Even Waves) ──────────────────────────────────────────────
function generateFromAscension(wave: number): FrictionProblem {
  const stage = Math.ceil(wave / 2)
  const question = generateDynamicQuestion(stage)

  // Build answers array from correctAnswer + wrongAnswers
  const allValues = [question.correctAnswer, ...question.wrongAnswers]
  const shuffled = allValues.sort(() => Math.random() - 0.5)

  const labels = question.answerLabels ?? {}

  const answers: FrictionAnswer[] = shuffled.map(value => {
    // Snap the value to match the key precision used by mkFracLabels
    const snapped = snap(value)
    const label = labels[snapped] ?? labels[value] ?? floatToFractionLabel(value)
    return {
      value,
      label,
      isCorrect: value === question.correctAnswer,
    }
  })

  const explanation = question.explanation

  return {
    expression: question.expression,
    answers,
    explanation,
  }
}
