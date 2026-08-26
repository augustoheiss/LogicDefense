import { useState } from 'react'

type HackMode = 'subtraction' | 'addition'

interface PresetSub {
  minuend: number
  subtrahend: number
  label: string
}

interface PresetAdd {
  a: number
  b: number
  label: string
}

const PRESETS_SUB: PresetSub[] = [
  { minuend: 42, subtrahend: 19, label: '42 − 19 (Clássico)' },
  { minuend: 73, subtrahend: 38, label: '73 − 38 (Dezena Alta)' },
  { minuend: 1000, subtrahend: 437, label: '1000 − 437 (Múltiplos Zeros)' },
  { minuend: 85, subtrahend: 27, label: '85 − 27 (Rápido)' },
]

const PRESETS_ADD: PresetAdd[] = [
  { a: 18, b: 7, label: '18 + 7 (Básico)' },
  { a: 29, b: 16, label: '29 + 16 (Composto)' },
  { a: 47, b: 38, label: '47 + 38 (Duplo Ajuste)' },
  { a: 88, b: 35, label: '88 + 35 (Centena)' },
]

export function InteractiveMathHack() {
  const [mode, setMode] = useState<HackMode>('subtraction')

  // Subtraction state
  const [minuend, setMinuend] = useState(42)
  const [subtrahend, setSubtrahend] = useState(19)
  const [subStep, setSubStep] = useState(0) // 0: initial, 1: shift applied, 2: calculated

  // Addition state
  const [addA, setAddA] = useState(18)
  const [addB, setAddB] = useState(7)
  const [addStep, setAddStep] = useState(0) // 0: initial, 1: clay molded, 2: calculated

  // --- Subtraction math logic ---
  // Subtrahend is King: how many steps to reach next multiple of 10?
  const subMod = subtrahend % 10
  const subShift = subMod === 0 ? 0 : 10 - subMod
  const newSub = subtrahend + subShift
  const newMin = minuend + subShift
  const subResult = minuend - subtrahend

  // --- Addition math logic ---
  // Identify which number is closest to a multiple of 10
  const aNeed = (10 - (addA % 10)) % 10
  const bNeed = (10 - (addB % 10)) % 10
  const shiftFromBtoA = aNeed <= bNeed && aNeed > 0
  const addShift = shiftFromBtoA ? aNeed : (bNeed > 0 ? bNeed : 0)
  const newAddA = shiftFromBtoA ? addA + addShift : addA - addShift
  const newAddB = shiftFromBtoA ? addB - addShift : addB + addShift
  const addResult = addA + addB

  const handleSelectSubPreset = (p: PresetSub) => {
    setMinuend(p.minuend)
    setSubtrahend(p.subtrahend)
    setSubStep(0)
  }

  const handleSelectAddPreset = (p: PresetAdd) => {
    setAddA(p.a)
    setAddB(p.b)
    setAddStep(0)
  }

  return (
    <div className="math-hack-card" id="math-hack-demo">
      {/* Header with Mode Switcher */}
      <div className="math-hack-header">
        <div className="math-hack-tag">
          <span className="math-hack-tag__dot" />
          <span>SIMULADOR INTERATIVO AO VIVO</span>
        </div>
        <div className="math-hack-modes" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'subtraction'}
            className={`math-hack-tab ${mode === 'subtraction' ? 'math-hack-tab--active' : ''}`}
            onClick={() => {
              setMode('subtraction')
              setSubStep(0)
            }}
          >
            🗡️ Hack Japonês (−)
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'addition'}
            className={`math-hack-tab ${mode === 'addition' ? 'math-hack-tab--active' : ''}`}
            onClick={() => {
              setMode('addition')
              setAddStep(0)
            }}
          >
            🧪 A Massinha (+)
          </button>
        </div>
      </div>

      {/* --- SUBTRACTION MODE --- */}
      {mode === 'subtraction' && (
        <div className="math-hack-body">
          {/* Preset Buttons */}
          <div className="math-hack-presets">
            <span className="math-hack-presets__label">Exemplos:</span>
            {PRESETS_SUB.map((p, idx) => (
              <button
                key={idx}
                type="button"
                className={`math-hack-preset-btn ${minuend === p.minuend && subtrahend === p.subtrahend ? 'math-hack-preset-btn--selected' : ''}`}
                onClick={() => handleSelectSubPreset(p)}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Dynamic Equation Display */}
          <div className="math-hack-arena">
            {/* Step 0: Initial Traditional View */}
            <div className={`math-hack-stage ${subStep === 0 ? 'math-hack-stage--active' : ''}`}>
              <div className="math-hack-equation">
                <span className="math-num math-num--minuend">{minuend}</span>
                <span className="math-op">−</span>
                <span className="math-num math-num--subtrahend">{subtrahend}</span>
                <span className="math-equals">=</span>
                <span className="math-mystery">?</span>
              </div>
              <p className="math-hack-explanation">
                🛑 <strong>Como a escola ensina:</strong> "2 não tira 9, então corte o 4 e <em>peça emprestado</em>". Isso gera insegurança e travamento mental.
              </p>
            </div>

            {/* Step 1: The Japanese Shift */}
            {subStep >= 1 && (
              <div className={`math-hack-stage ${subStep === 1 ? 'math-hack-stage--active' : ''}`}>
                <div className="math-hack-rule-callout">
                  <span className="math-hack-rule-icon">👑</span>
                  <div>
                    <strong>O Subtraendo é o Rei:</strong> O número de baixo ({subtrahend}) precisa de{' '}
                    <span className="text-cyan-400">+{subShift}</span> para a unidade zerar e virar{' '}
                    <strong>{newSub}</strong>. Andamos o mesmo passo em cima: ({minuend} + {subShift} ={' '}
                    <strong>{newMin}</strong>).
                  </div>
                </div>

                <div className="math-hack-equation math-hack-equation--shifted">
                  <span className="math-num math-num--glow">{newMin}</span>
                  <span className="math-op">−</span>
                  <span className="math-num math-num--glow">{newSub}</span>
                  <span className="math-equals">=</span>
                  <span className="math-mystery">{subStep === 1 ? '...' : subResult}</span>
                </div>
              </div>
            )}

            {/* Step 2: Final Result */}
            {subStep === 2 && (
              <div className="math-hack-stage math-hack-stage--result">
                <div className="math-hack-result-box">
                  <span className="math-hack-result-label">Resultado Instantâneo:</span>
                  <span className="math-hack-result-value">{subResult}</span>
                </div>
                <p className="math-hack-verdict">
                  ⚡ <strong>Sem pedir emprestado:</strong> {newMin} − {newSub} desce reto ({newMin - (newMin % 10) - newSub} + {newMin % 10} = {subResult}). A balança se mantém perfeita!
                </p>
              </div>
            )}
          </div>

          {/* Stepper Controls */}
          <div className="math-hack-footer">
            <div className="math-hack-step-pills">
              <span className={`math-step-dot ${subStep >= 0 ? 'math-step-dot--active' : ''}`}>1. O Problema</span>
              <span className={`math-step-dot ${subStep >= 1 ? 'math-step-dot--active' : ''}`}>2. O Hack (+{subShift})</span>
              <span className={`math-step-dot ${subStep >= 2 ? 'math-step-dot--active' : ''}`}>3. O Resultado</span>
            </div>

            <div className="math-hack-actions">
              {subStep < 2 ? (
                <button
                  type="button"
                  className="btn-hack-next"
                  onClick={() => setSubStep(s => s + 1)}
                >
                  {subStep === 0 ? 'Aplicar Hack Japonês ➔' : 'Ver Resultado Final ➔'}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-hack-reset"
                  onClick={() => setSubStep(0)}
                >
                  ↺ Testar Novamente
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- ADDITION MODE --- */}
      {mode === 'addition' && (
        <div className="math-hack-body">
          {/* Preset Buttons */}
          <div className="math-hack-presets">
            <span className="math-hack-presets__label">Exemplos:</span>
            {PRESETS_ADD.map((p, idx) => (
              <button
                key={idx}
                type="button"
                className={`math-hack-preset-btn ${addA === p.a && addB === p.b ? 'math-hack-preset-btn--selected' : ''}`}
                onClick={() => handleSelectAddPreset(p)}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Dynamic Equation Display */}
          <div className="math-hack-arena">
            {/* Step 0: Initial Traditional View */}
            <div className={`math-hack-stage ${addStep === 0 ? 'math-hack-stage--active' : ''}`}>
              <div className="math-hack-equation">
                <span className="math-num math-num--minuend">{addA}</span>
                <span className="math-op">+</span>
                <span className="math-num math-num--subtrahend">{addB}</span>
                <span className="math-equals">=</span>
                <span className="math-mystery">?</span>
              </div>
              <p className="math-hack-explanation">
                🛑 <strong>Como a escola ensina:</strong> "8 + 7 dá 15, fica o 5 e <em>vai um</em>". Você perde tempo segurando números na memória.
              </p>
            </div>

            {/* Step 1: Mold the Clay */}
            {addStep >= 1 && (
              <div className={`math-hack-stage ${addStep === 1 ? 'math-hack-stage--active' : ''}`}>
                <div className="math-hack-rule-callout">
                  <span className="math-hack-rule-icon">🧪</span>
                  <div>
                    <strong>A Lei da Massinha:</strong> O número {shiftFromBtoA ? addA : addB} precisa de{' '}
                    <span className="text-yellow-400">+{addShift}</span> para arredondar. Tiramos{' '}
                    <span className="text-yellow-400">-{addShift}</span> do outro número. A quantidade total de massa não muda!
                  </div>
                </div>

                <div className="math-hack-equation math-hack-equation--shifted">
                  <span className="math-num math-num--glow">{newAddA}</span>
                  <span className="math-op">+</span>
                  <span className="math-num math-num--glow">{newAddB}</span>
                  <span className="math-equals">=</span>
                  <span className="math-mystery">{addStep === 1 ? '...' : addResult}</span>
                </div>
              </div>
            )}

            {/* Step 2: Final Result */}
            {addStep === 2 && (
              <div className="math-hack-stage math-hack-stage--result">
                <div className="math-hack-result-box">
                  <span className="math-hack-result-label">Resultado Instantâneo:</span>
                  <span className="math-hack-result-value">{addResult}</span>
                </div>
                <p className="math-hack-verdict">
                  ⚡ <strong>Cálculo mental direto:</strong> {newAddA} + {newAddB} = {addResult}. Sem segurar números na memória de curto prazo!
                </p>
              </div>
            )}
          </div>

          {/* Stepper Controls */}
          <div className="math-hack-footer">
            <div className="math-hack-step-pills">
              <span className={`math-step-dot ${addStep >= 0 ? 'math-step-dot--active' : ''}`}>1. O Problema</span>
              <span className={`math-step-dot ${addStep >= 1 ? 'math-step-dot--active' : ''}`}>2. Moldar Massinha</span>
              <span className={`math-step-dot ${addStep >= 2 ? 'math-step-dot--active' : ''}`}>3. O Resultado</span>
            </div>

            <div className="math-hack-actions">
              {addStep < 2 ? (
                <button
                  type="button"
                  className="btn-hack-next"
                  onClick={() => setAddStep(s => s + 1)}
                >
                  {addStep === 0 ? 'Moldar a Massinha ➔' : 'Ver Resultado Final ➔'}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-hack-reset"
                  onClick={() => setAddStep(0)}
                >
                  ↺ Testar Novamente
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
