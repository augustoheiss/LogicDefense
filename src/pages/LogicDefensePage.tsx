import { useState } from 'react'
import { GamePage } from '../games/LogicDefense'

// ── Accordion ─────────────────────────────────────────────────────────────────
interface AccordionProps {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}

function Accordion({ title, defaultOpen = false, children }: AccordionProps) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={`accordion${open ? ' accordion--open' : ''}`}>
      <button
        className="accordion__trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="accordion__trigger-label">{title}</span>
        <span className="accordion__arrow">▼</span>
      </button>
      <div className="accordion__body">
        <div className="accordion__content">{children}</div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export function LogicDefensePage() {
  // Incrementing this key causes React to fully unmount + remount <GamePage>,
  // destroying every ref, interval, RAF loop, and closure from the old session.
  const [gameKey, setGameKey] = useState(0)

  return (
    <div>
      {/* ── Game section: takes exactly 100vh ── */}
      <div className="ld-game-section">
        <GamePage key={gameKey} onReset={() => setGameKey(k => k + 1)} />
        {/* Scroll hint appears over the game (bottom center, non-interactive) */}
        <div className="ld-scroll-hint">
          <span className="ld-scroll-hint__label">Role para ler</span>
          <span className="ld-scroll-hint__arrow">↓</span>
        </div>
      </div>

      {/* ── Content below the game ── */}
      <div className="ld-below">
        <div className="section section--sm">
          <p className="section__title" style={{ marginBottom: 4 }}>
            Sobre o Jogo
          </p>
          <p className="section__subtitle">
            Leia o Manifesto e aprenda os segredos por trás dos números.
          </p>

          {/* ── Manifesto Accordion ── */}
          <Accordion title="📖 A Lógica do One Piece — Manifesto" defaultOpen>
            <p>
              Palavras como <strong>Amor</strong>, <strong>Ódio</strong>, ou o meio termo{' '}
              (<strong>A Cadeira</strong>), podem ter infinitos significados dependendo de como
              as falamos, dos nossos motivos e de eventos externos imprevisíveis. Esses fatores
              podem fazer com que nossas palavras sumam no vácuo ou sejam potencializadas como
              por um microfone. Vivemos em um mundo de probabilidades.
            </p>
            <p>
              Está na hora de sair do dicionário, sair da biblioteca e experimentar a Lógica na
              prática. Use todos esses Dados, Informações, Conhecimentos e Sabedoria a seu favor
              estudando a função dos números (e das palavras).
            </p>
            <p>
              Desligue o seu "Juiz" interno — aquele que rejeita as pessoas só porque elas não te
              dão importância ou não te respeitam. A Lógica por trás de todos esses motivos é mais
              profunda e soberana, e ninguém escapa da lei das probabilidades. Aceite a Morte, e
              então, Viva. Não como uma máquina, que hoje está incrivelmente potente, mas como a
              alma que você é.
            </p>
            <hr />
            <p style={{ color: 'var(--green)', fontWeight: 'bold', textAlign: 'center' }}>
              [ SOBRE O PROJETO ]
            </p>
            <p style={{ textAlign: 'center' }}>
              Este jogo é um Museu Vivo. Foi produzido{' '}
              <strong>100% em co-criação com Inteligência Artificial</strong>, provando que a IA
              é a melhor ferramenta para mentes que não têm medo de pensar e filosofar sobre o
              código.
            </p>
            <p style={{ textAlign: 'center' }}>
              Quer falar com o autor ou trocar ideias sobre tecnologia e educação?
              <br />
              📧{' '}
              <a
                href="mailto:augustoheiss@gmail.com"
                style={{ color: 'var(--accent)' }}
              >
                augustoheiss@gmail.com
              </a>
            </p>
          </Accordion>

          {/* ── Viases Accordion ── */}
          <Accordion title="🔢 Os Viéses dos Números">
            <p style={{ fontStyle: 'italic', color: 'var(--text-dim)', textAlign: 'center' }}>
              A Matemática não vai sair do lugar. Nós apenas escrevemos problemas diferentes de
              maneiras que produzam resultados. A regra universal: Manipule sempre do maior para
              o menor.
            </p>

            <h3>A Lei do Menor Esforço (+) e o Hack Japonês (−)</h3>
            <p>
              Na <strong>Adição</strong>, moldamos a "massinha". Identificamos qual número precisa
              de menos passos na reta numérica para chegar num zero redondo. Tiramos de um lado e
              compensamos no outro. O que sobra, fazemos por Decomposição (Centena com Centena,
              Dezena com Dezena). Exemplo: 18 + 7 ➔ Tira 2 do sete e dá para o dezoito ➔
              Fica 20 + 5 = 25.
            </p>
            <p>
              Na <strong>Subtração</strong>, o Subtraendo é o Rei. Mexemos nele primeiro dando
              passos para frente ou para trás na reta numérica até a unidade zerar, e aplicamos o
              exato mesmo passo no número de cima. O cálculo desce reto, sem nunca precisar "pedir
              emprestado". Exemplo visual: 42 − 19 ➔ Ande 1 passo para frente nos dois números
              para zerar a unidade do Rei ➔ 43 − 20 = 23.
            </p>

            <h3>A Diferença de Quadrados (×)</h3>
            <p>
              Na multiplicação, se houver um valor e uma variável em comum equidistante
              (ex: 12 × 8, que é (10+2)×(10−2) ou base² − passo²), usamos a diferença de
              quadrados: a base ao quadrado menos o passo ao quadrado (10² − 2²) = (100 − 4 = 96).
              Pura geometria mental.
            </p>

            <h3>0: A Maldição e o Início</h3>
            <p>
              O elemento neutro da soma e subtração! Junto com o 9 torna algo completo às vezes
              sem aparecer. Ele é tão importante que é proibido usar numa balança exata (divisão),
              porque ele faz parecer que qualquer resultado é a mesma coisa. Ele não é neutro na
              multiplicação, ele é a maldição, o viés necessário.
            </p>

            <h3>1: A Balança</h3>
            <p>
              A sequência dos números naturais. O acréscimo de um. Onde o rótulo da conta começa
              e a balança dos números entra em ação.
            </p>

            <h3>2, 4 e 8: A Base do Universo</h3>
            <p>
              <strong>Tabuada do 2:</strong> O Universo que entendemos de verdade é escrito na
              base 2: Preto e Branco, as cores que prevalecem no Sistema.
              <br />
              <strong>Tabuada do 4:</strong> O dobro do dobro. Qualquer número multiplicado por 4
              é o dobro duas vezes.
              <br />
              <strong>A Grandeza do 8:</strong> O cubo de 2. Sabe como somar 8 rápido? Volta dois
              passos e adiciona uma dezena à esquerda.
            </p>

            <h3>3 e 6: A Fração e a Dúzia</h3>
            <p>
              <strong>Tabuada do 3:</strong> Uma parte perfeita do número completo, o rei das
              dízimas periódicas. Sabe quem ele coroa? O 9.
              <br />
              <strong>Tabuada do 6:</strong> A meia dúzia. Palavras de um sistema antigo muito
              útil, porque o 12 se divide perfeitamente por 2, 3, 4 e 6!
            </p>

            <h3>5: O Nosso Relógio</h3>
            <p>
              A tabuada que nos faz inteligentes com a sua facilidade absoluta em transformar o
              difícil. A mágica de cortar na metade e terminar em 0 ou 5.
            </p>

            <h3>7: O Número da Fênix (142857)</h3>
            <p>
              Ele é aceito como louco porque sua verdade é encontrada em números muito grandes ou
              muito pequenos. Mas em conjunto, a divisão por 7 gera a poderosa dízima{' '}
              <strong>142857</strong>. Todos os números aparecem nela; os invisíveis completam as
              partes perfeitas. Fatorando: (142 + 857 = 999).
            </p>

            <h3>9: O Infinito que Completa</h3>
            <p>
              O número que não aparece nas dízimas periódicas porque ele mostra o infinito de
              qualquer número. Se 1 ÷ 9 = 0.111... e 8 ÷ 9 = 0.888..., então 9 ÷ 9 = 0.999...
              (o Infinito que vira o 1, o Todo!). A morte de uma fração e o nascimento de algo
              completo.
              <br />
              A regra do 9 é divina: diminui uma unidade e soma uma na dezena (9, 18, 27, 36...).
            </p>
          </Accordion>
        </div>
      </div>
    </div>
  )
}
