import { useState, useEffect, CSSProperties } from 'react';
import { Question } from './mathEngine';

// ── Types ──────────────────────────────────────────────────────────────────────
export interface ChoiceOption {
  value: number;
  isCorrect: boolean;
}

interface CombatArenaProps {
  playerPower: number;
  monsterLevel: number;
  question: Question;
  /** Pre-shuffled array of exactly 4 options (one correct + three wrong). */
  choices: ChoiceOption[];
  onResult: (correct: boolean) => void;
  /** True when fighting the Final Boss — triggers special styling and instant-defeat on wrong answer. */
  isBoss?: boolean;
  /** True when playerPower < enemyLevel — triggers Desperation Mode UI. */
  isDesperationMode?: boolean;
  /**
   * True when playerPower < enemyLevel / 2 — the power gap is so absurd the
   * monster instant-crushes the player before they can attempt the math.
   * The arena skips the question and auto-fires onResult(false) after 2 s.
   */
  isImpossibleMode?: boolean;
}

// ── Keyframe injection (one-time, safe to inline) ─────────────────────────────
const ARENA_STYLES = `
@keyframes arena-enter {
  from { opacity: 0; transform: scale(0.88) translateY(16px); }
  to   { opacity: 1; transform: scale(1)    translateY(0);    }
}
@keyframes result-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.6; }
}
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20%       { transform: translateX(-6px); }
  40%       { transform: translateX(6px); }
  60%       { transform: translateX(-4px); }
  80%       { transform: translateX(4px); }
}
@keyframes desperation-border {
  0%, 100% { box-shadow: 0 0 30px rgba(255,0,0,0.35), 0 0 60px rgba(255,0,0,0.15), inset 0 0 20px rgba(255,0,0,0.06); border-color: #ff2222; }
  50%       { box-shadow: 0 0 60px rgba(255,0,0,0.75), 0 0 120px rgba(255,0,0,0.30), inset 0 0 30px rgba(255,0,0,0.12); border-color: #ff8888; }
}
@keyframes desperation-banner {
  0%, 100% { background: rgba(255,0,0,0.14); }
  50%       { background: rgba(255,0,0,0.28); }
}
@keyframes desperation-text {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.75; transform: scale(1.04); }
}
@keyframes impossible-crush {
  0%   { transform: scale(1);    opacity: 1; }
  30%  { transform: scale(1.04); opacity: 1; }
  60%  { transform: scale(0.94); opacity: 0.9; }
  100% { transform: scale(1);    opacity: 1; }
}
@keyframes impossible-border {
  0%, 100% { box-shadow: 0 0 40px rgba(180,0,0,0.6),  0 0 80px rgba(180,0,0,0.25);  border-color: #880000; }
  50%       { box-shadow: 0 0 80px rgba(255,20,20,0.9), 0 0 160px rgba(255,20,20,0.40); border-color: #ff0000; }
}
@keyframes impossible-text {
  0%   { letter-spacing: 0.06em; }
  50%  { letter-spacing: 0.18em; color: #ff4444; }
  100% { letter-spacing: 0.06em; }
}
`;

// ── Sub-components ─────────────────────────────────────────────────────────────
function CombatantCard({
  emoji,
  name,
  statLabel,
  statValue,
  color,
}: {
  emoji: string;
  name: string;
  statLabel: string;
  statValue: number;
  color: string;
}) {
  return (
    <div style={{
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      gap:            8,
      padding:        '16px 24px',
      background:     `${color}10`,
      border:         `1px solid ${color}44`,
      borderRadius:   10,
      minWidth:       120,
    }}>
      <span style={{ fontSize: 40 }}>{emoji}</span>
      <span style={{
        fontSize:    10,
        color:       `${color}bb`,
        fontFamily:  "'Courier New', monospace",
        textTransform: 'uppercase',
        letterSpacing: 2,
      }}>
        {name}
      </span>
      <div style={{
        display:       'flex',
        flexDirection: 'column',
        alignItems:    'center',
        gap:           2,
      }}>
        <span style={{ fontSize: 9, color: '#475569', fontFamily: "'Courier New', monospace" }}>
          {statLabel}
        </span>
        <span style={{
          fontSize:   28,
          fontWeight: 700,
          color,
          fontFamily: "'Courier New', monospace",
          lineHeight:  1,
        }}>
          {statValue}
        </span>
      </div>
    </div>
  );
}

// ── Choice button ──────────────────────────────────────────────────────────────
type BtnState = 'idle' | 'correct' | 'wrong' | 'reveal' | 'dim';

function ChoiceBtn({
  value,
  state,
  onClick,
}: {
  value: number;
  state: BtnState;
  onClick: () => void;
}) {
  const stateStyle: Record<BtnState, CSSProperties> = {
    idle: {
      background:  'rgba(15,23,42,0.9)',
      border:      '2px solid #334155',
      color:       '#94a3b8',
      cursor:      'pointer',
      transform:   'scale(1)',
    },
    correct: {
      background:  'rgba(0,60,0,0.7)',
      border:      '2px solid #00ff00',
      color:       '#00ff00',
      cursor:      'default',
      transform:   'scale(1.06)',
      boxShadow:   '0 0 20px rgba(0,255,0,0.5), inset 0 0 12px rgba(0,255,0,0.2)',
      animation:   'result-pulse 0.8s ease infinite',
    },
    wrong: {
      background:  'rgba(60,0,0,0.7)',
      border:      '2px solid #ff4444',
      color:       '#ff4444',
      cursor:      'default',
      transform:   'scale(1)',
      animation:   'shake 0.4s ease',
    },
    reveal: {
      background:  'rgba(0,40,0,0.5)',
      border:      '2px dashed #00ff00',
      color:       '#00ff00',
      cursor:      'default',
      opacity:     0.8,
    },
    dim: {
      background:  'rgba(10,10,20,0.5)',
      border:      '2px solid #1e293b',
      color:       '#334155',
      cursor:      'default',
      opacity:     0.4,
    },
  };

  return (
    <button
      onClick={onClick}
      disabled={state !== 'idle'}
      style={{
        width:          '100%',
        padding:        '20px 12px',
        borderRadius:   10,
        fontSize:       28,
        fontWeight:     700,
        fontFamily:     "'Courier New', monospace",
        transition:     'all 0.2s ease',
        outline:        'none',
        position:       'relative',
        ...stateStyle[state],
      }}
      onMouseEnter={e => {
        if (state === 'idle') {
          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(30,41,59,0.95)';
          (e.currentTarget as HTMLButtonElement).style.borderColor = '#00d4ff';
          (e.currentTarget as HTMLButtonElement).style.color = '#e2e8f0';
        }
      }}
      onMouseLeave={e => {
        if (state === 'idle') {
          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(15,23,42,0.9)';
          (e.currentTarget as HTMLButtonElement).style.borderColor = '#334155';
          (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8';
        }
      }}
    >
      {value}
    </button>
  );
}

// ── Main CombatArena ───────────────────────────────────────────────────────────
export function CombatArena({
  playerPower,
  monsterLevel,
  question,
  choices,
  onResult,
  isBoss = false,
  isDesperationMode = false,
  isImpossibleMode = false,
}: CombatArenaProps) {
  const [picked, setPicked] = useState<number | null>(null);
  const correctAnswer = choices.find(c => c.isCorrect)!.value;

  // Impossible mode: skip the question — auto-fire loss after 2 s cinematic pause
  useEffect(() => {
    if (!isImpossibleMode) return;
    const timer = setTimeout(() => onResult(false), 2000);
    return () => clearTimeout(timer);
  }, [isImpossibleMode, onResult]);

  // After picking, auto-close after 1.8 s
  useEffect(() => {
    if (picked === null || isImpossibleMode) return;
    const timer = setTimeout(() => {
      const wasCorrect = picked === correctAnswer;
      onResult(wasCorrect);
    }, 1800);
    return () => clearTimeout(timer);
  }, [picked, correctAnswer, onResult, isImpossibleMode]);

  const wasCorrect = picked !== null && picked === correctAnswer;

  // Result delta displayed in the VS center after answering.
  // Desperation wrong = instant death (represented as 'death').
  type DeltaDisplay = number | 'death' | null;
  const resultDelta: DeltaDisplay = picked === null ? null
    : wasCorrect
      ? (isDesperationMode ? Math.round(monsterLevel * 0.5) : monsterLevel)
      : (isDesperationMode ? 'death' : -Math.round(monsterLevel * 0.5));

  // Stakes shown before answering
  const gainIfCorrect = isDesperationMode ? Math.round(monsterLevel * 0.5) : monsterLevel;
  const lossIfWrong   = Math.round(monsterLevel * 0.5);

  function getBtnState(opt: ChoiceOption): BtnState {
    if (picked === null) return 'idle';
    if (opt.isCorrect) return picked === opt.value ? 'correct' : 'reveal';
    if (opt.value === picked) return 'wrong';
    return 'dim';
  }

  return (
    <>
      {/* Inject keyframes once */}
      <style>{ARENA_STYLES}</style>

      {/* Backdrop */}
      <div style={{
        position:   'fixed',
        inset:       0,
        background: isImpossibleMode ? 'rgba(40,0,0,0.96)' : 'rgba(4,4,12,0.88)',
        backdropFilter: 'blur(3px)',
        zIndex:     1000,
        display:    'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding:    '16px',
      }}>

        {/* ── IMPOSSIBLE MODE: instant-crush screen ── */}
        {isImpossibleMode ? (
          <div style={{
            width:        '100%',
            maxWidth:      520,
            background:   '#0a0000',
            border:       '2px solid #880000',
            borderRadius:  14,
            overflow:     'hidden',
            animation:    'arena-enter 0.18s cubic-bezier(0.34,1.56,0.64,1) forwards, impossible-border 0.55s ease 0.18s infinite',
            boxShadow:    '0 0 80px rgba(200,0,0,0.6), 0 0 40px rgba(200,0,0,0.3)',
            textAlign:    'center',
          }}>
            <div style={{
              background:   'linear-gradient(135deg, #200000 0%, #100000 100%)',
              borderBottom: '1px solid #55000088',
              padding:      '16px 20px',
            }}>
              <div style={{ color: '#ff4444', fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4 }}>
                Encontro Impossível
              </div>
              <div style={{ color: '#ff0000', fontSize: 22, fontWeight: 900, fontFamily: "'Courier New', monospace" }}>
                💀 ESMAGAMENTO INSTANTÂNEO
              </div>
            </div>
            <div style={{ padding: '28px 24px 32px', display: 'flex', flexDirection: 'column', gap: 18, alignItems: 'center' }}>
              <div style={{
                fontSize: 56,
                animation: 'impossible-crush 0.7s ease infinite',
              }}>
                💥
              </div>
              <div style={{
                color:       '#ff2222',
                fontSize:    15,
                fontWeight:  700,
                lineHeight:  1.55,
                animation:   'impossible-text 1.1s ease infinite',
              }}>
                ⚠️ DIFERENÇA DE PODER ABSURDA!
              </div>
              <div style={{
                color:      '#cc4444',
                fontSize:   13,
                lineHeight: 1.6,
                maxWidth:   380,
              }}>
                O monstro (Lv.{monsterLevel}) te esmagou antes que você pudesse calcular!
                <br />
                <span style={{ color: '#884444', fontSize: 11 }}>
                  Poder necessário mínimo: {Math.ceil(monsterLevel / 2)} · Seu poder: {playerPower}
                </span>
              </div>
              <div style={{
                marginTop:   8,
                padding:     '8px 20px',
                background:  'rgba(180,0,0,0.15)',
                border:      '1px solid #44000088',
                borderRadius: 8,
                color:       '#884444',
                fontSize:    12,
              }}>
                Treine mais e volte mais forte…
              </div>
            </div>
          </div>
        ) : (

        /* Panel */
        <div style={{
          width:         '100%',
          maxWidth:      560,
          background:    isDesperationMode ? '#180404' : '#080c18',
          border:        `2px solid ${isDesperationMode ? '#ff2222' : isBoss ? '#8800cc' : '#1e3a5a'}`,
          borderRadius:  14,
          overflow:      'hidden',
          animation:     isDesperationMode
            ? 'arena-enter 0.22s cubic-bezier(0.34,1.56,0.64,1) forwards, desperation-border 0.7s ease 0.22s infinite'
            : 'arena-enter 0.22s cubic-bezier(0.34,1.56,0.64,1) forwards',
          boxShadow:     isDesperationMode
            ? '0 0 60px rgba(255,0,0,0.4), 0 0 30px rgba(255,0,0,0.2)'
            : '0 0 60px rgba(0,0,0,0.9), 0 0 30px rgba(0,212,255,0.08)',
        }}>

          {/* ── Header ── */}
          <div style={{
            background: isDesperationMode
              ? 'linear-gradient(135deg, #2a0000 0%, #180000 100%)'
              : isBoss
                ? 'linear-gradient(135deg, #1a0028 0%, #0f0020 100%)'
                : 'linear-gradient(135deg, #0d1b2a 0%, #0a1628 100%)',
            borderBottom: `1px solid ${isDesperationMode ? '#ff222255' : isBoss ? '#8800cc' : '#1e3a5a'}`,
            padding:      '12px 20px',
            display:      'flex',
            alignItems:   'center',
            justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 11, color: isDesperationMode ? '#ff4444aa' : '#475569', fontFamily: "'Courier New', monospace", letterSpacing: 2, textTransform: 'uppercase' }}>
              {isDesperationMode ? 'Modo Desespero' : isBoss ? 'Confronto Final' : 'Combat Arena'}
            </span>
            <span style={{ fontSize: 13, color: isDesperationMode ? '#ff4444' : isBoss ? '#cc44ff' : '#00d4ff', fontFamily: "'Courier New', monospace", fontWeight: 700 }}>
              {isDesperationMode ? '💀 ATAQUE DESESPERADO' : isBoss ? '👹 BOSS FINAL' : '⚔️  COMBATE'}
            </span>
            <span style={{ fontSize: 11, color: isDesperationMode ? '#ff4444aa' : '#475569', fontFamily: "'Courier New', monospace", letterSpacing: 2, textTransform: 'uppercase' }}>
              Nível {monsterLevel}
            </span>
          </div>

          {/* ── Desperation banner ── */}
          {isDesperationMode && (
            <div style={{
              padding:      '9px 20px',
              textAlign:    'center',
              animation:    'desperation-banner 0.7s ease infinite',
              borderBottom: '1px solid #ff222244',
              display:      'flex',
              alignItems:   'center',
              justifyContent: 'center',
              gap:          10,
            }}>
              <span style={{ fontSize: 14 }}>⚠️</span>
              <span style={{
                fontSize:    10,
                color:       '#ff6666',
                fontFamily:  "'Courier New', monospace",
                fontWeight:  700,
                letterSpacing: 2,
                textTransform: 'uppercase',
                animation:   'desperation-text 0.7s ease infinite',
              }}>
                Você está sobrepoderado — Erro = DERROTA IMEDIATA
              </span>
              <span style={{ fontSize: 14 }}>⚠️</span>
            </div>
          )}

          <div style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* ── VS Row ── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <CombatantCard emoji="👾" name="Jogador" statLabel="Poder" statValue={playerPower} color="#00ff00" />

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <span style={{
                  fontSize:   22,
                  color:      isDesperationMode ? '#ff2222' : isBoss ? '#cc44ff' : '#ff6b35',
                  fontWeight: 900,
                  fontFamily: "'Courier New', monospace",
                  animation:  isDesperationMode ? 'desperation-text 0.7s ease infinite' : undefined,
                }}>VS</span>
                {picked !== null && (
                  <div style={{
                    fontSize:    12,
                    color:       wasCorrect ? '#00ff00' : '#ff4444',
                    fontFamily:  "'Courier New', monospace",
                    textAlign:   'center',
                    lineHeight:  1.4,
                    fontWeight:  700,
                    animation:   'result-pulse 0.8s ease infinite',
                  }}>
                    {wasCorrect ? '✅' : '❌'}<br />
                    {resultDelta === 'death'
                      ? '💀'
                      : resultDelta !== null && resultDelta > 0
                        ? `+${resultDelta}`
                        : `${resultDelta}`}
                    <br />
                    <span style={{ fontSize: 9, fontWeight: 400, color: wasCorrect ? '#00cc00' : '#cc3333' }}>
                      {resultDelta === 'death' ? 'DERROTA' : 'poder'}
                    </span>
                  </div>
                )}
              </div>

              <CombatantCard
                emoji={isBoss ? '👹' : '💀'}
                name={isBoss ? 'Boss Final' : 'Inimigo'}
                statLabel="Nível"
                statValue={monsterLevel}
                color={isDesperationMode ? '#ff2222' : isBoss ? '#cc44ff' : '#ff4444'}
              />
            </div>

            {/* ── Question ── */}
            <div style={{
              background:   'rgba(0,212,255,0.04)',
              border:       '1px solid #1e3a4a',
              borderRadius: 10,
              padding:      '14px 18px',
              textAlign:    'center',
            }}>
              <p style={{
                margin:      '0 0 10px',
                fontSize:    10,
                color:       '#64748b',
                fontFamily:  "'Courier New', monospace",
                textTransform: 'uppercase',
                letterSpacing: 2,
              }}>
                {question.hint}
              </p>
              <p style={{
                margin:        '6px 0 0',
                fontSize:      56,
                fontWeight:    900,
                color:         '#f1f5f9',
                fontFamily:    "'Courier New', monospace",
                letterSpacing: 3,
                lineHeight:    1,
                textShadow:    '0 0 24px rgba(0,212,255,0.45), 0 2px 6px rgba(0,0,0,0.7)',
              }}>
                {question.expression}
              </p>
              <p style={{
                margin:      '8px 0 0',
                fontSize:    11,
                color:       '#475569',
                fontFamily:  "'Courier New', monospace",
              }}>
                Qual é o resultado?
              </p>
              {/* Stakes display — shown before answering */}
              {picked === null && (
                <div style={{
                  marginTop:  10,
                  display:    'flex',
                  justifyContent: 'center',
                  gap:        18,
                  fontSize:   10,
                  fontFamily: "'Courier New', monospace",
                }}>
                  {isDesperationMode ? (
                    <>
                      <span style={{ color: '#ffd700', fontWeight: 700 }}>
                        ✅ Acerto: Sobrevive! +{gainIfCorrect} (50%)
                      </span>
                      <span style={{ color: '#334155' }}>|</span>
                      <span style={{
                        color:     '#ff2222',
                        fontWeight: 700,
                        animation: 'desperation-text 0.7s ease infinite',
                      }}>
                        ❌ Erro: DERROTA INSTANTÂNEA
                      </span>
                    </>
                  ) : (
                    <>
                      <span style={{ color: '#00cc00' }}>✅ Acerto: +{gainIfCorrect}</span>
                      <span style={{ color: '#334155' }}>|</span>
                      <span style={{ color: isBoss ? '#ff2222' : '#cc4444' }}>
                        ❌ Erro: −{lossIfWrong}{isBoss ? ' · DERROTA!' : ''}
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* ── Choices 2×2 ── */}
            <div style={{
              display:             'grid',
              gridTemplateColumns: '1fr 1fr',
              gap:                 10,
            }}>
              {choices.map((opt, i) => (
                <ChoiceBtn
                  key={i}
                  value={opt.value}
                  state={getBtnState(opt)}
                  onClick={() => { if (picked === null) setPicked(opt.value); }}
                />
              ))}
            </div>

            {/* ── Post-result explanation ── */}
            {picked !== null && (
              <div style={{
                background:   wasCorrect ? 'rgba(0,40,0,0.4)' : 'rgba(40,0,0,0.4)',
                border:       `1px solid ${wasCorrect ? '#00ff00' : '#ff4444'}44`,
                borderRadius: 8,
                padding:      '10px 14px',
                fontSize:     11,
                fontFamily:   "'Courier New', monospace",
                color:        '#94a3b8',
                lineHeight:   1.6,
              }}>
                <span style={{ color: wasCorrect ? '#00ff00' : '#ff4444', fontWeight: 700 }}>
                  {isDesperationMode
                    ? wasCorrect
                      ? `🔥 Milagre! +${gainIfCorrect} poder (50%). Sobreviveu contra as probabilidades!`
                      : `💀 Derrota! Respondeu errado no Ataque Desesperado. Resposta: ${correctAnswer}`
                    : wasCorrect
                      ? `✅ Correto! +${gainIfCorrect} poder absorvido.`
                      : `❌ Errado! −${lossIfWrong} poder (dano). Resposta: ${correctAnswer}`}
                </span>
                {'  '}
                {question.explanation}
              </div>
            )}
          </div>
        </div>
        )} {/* end isImpossibleMode ternary */}
      </div>
    </>
  );
}
