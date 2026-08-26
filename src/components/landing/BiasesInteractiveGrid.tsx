import { useState } from 'react'

type NeonColor = 'cyan' | 'purple' | 'gold' | 'green' | 'red' | 'orange' | 'pink' | 'blue' | 'gray'

interface BiasCardData {
  id: string
  number: string
  title: string
  color: NeonColor
  symbol: string
  shortSummary: string
  fullExplanation: React.ReactNode
  interactiveExample?: {
    label: string
    formula: string
    calculation: string
  }
}

const BIASES: BiasCardData[] = [
  {
    id: 'bias-plus-minus',
    number: '+ e −',
    title: 'A Lei do Menor Esforço (+) e o Hack Japonês (−)',
    color: 'green',
    symbol: '±',
    shortSummary: 'Na adição, moldamos a massinha. Na subtração, o Subtraendo é o Rei: zere a unidade e o cálculo desce reto.',
    fullExplanation: (
      <>
        <p>
          Na <strong>Adição</strong>, moldamos a "massinha": identificamos qual número precisa de menos passos na reta numérica para chegar num zero redondo. Tiramos de um lado e compensamos no outro. Exemplo: <code>18 + 7</code> ➔ tira 2 do sete e dá para o dezoito ➔ <strong>20 + 5 = 25</strong>.
        </p>
        <p>
          Na <strong>Subtração</strong>, o Subtraendo é o Rei. Mexemos nele primeiro dando passos até a unidade zerar, e aplicamos o exato mesmo passo no número de cima. O cálculo desce reto sem pedir emprestado. Exemplo: <code>42 − 19</code> ➔ ande +1 nos dois ➔ <strong>43 − 20 = 23</strong>.
        </p>
      </>
    ),
    interactiveExample: {
      label: 'Subtração sem pedir emprestado',
      formula: '42 − 19  ➔  (+1 nos dois)  ➔  43 − 20',
      calculation: '= 23 (Cálculo Direto)',
    },
  },
  {
    id: 'bias-multiplication',
    number: '×',
    title: 'A Diferença de Quadrados (×)',
    color: 'red',
    symbol: '²',
    shortSummary: 'Multiplique números equidistantes elevando a base ao quadrado e subtraindo o passo ao quadrado.',
    fullExplanation: (
      <>
        <p>
          Se houver um valor central e uma variável equidistante (ex: <code>12 × 8</code>, que é <code>(10 + 2) × (10 − 2)</code>), usamos a diferença de quadrados: a base ao quadrado menos o passo ao quadrado <code>(10² − 2²)</code> = <strong>100 − 4 = 96</strong>. Pura geometria mental.
        </p>
      </>
    ),
    interactiveExample: {
      label: 'Multiplicação Instantânea',
      formula: '12 × 8 = (10 + 2)(10 − 2) = 10² − 2²',
      calculation: '100 − 4 = 96',
    },
  },
  {
    id: 'bias-zero',
    number: '0',
    title: 'A Maldição e o Início',
    color: 'gray',
    symbol: '∅',
    shortSummary: 'O elemento neutro da soma e a maldição na divisão. Proibido em balanças exatas.',
    fullExplanation: (
      <>
        <p>
          O elemento neutro da soma e subtração! Junto com o 9 torna algo completo às vezes sem aparecer. Ele é tão importante que é proibido usar numa balança exata (divisão), porque faz parecer que qualquer resultado é a mesma coisa. Ele não é neutro na multiplicação: ele é a maldição, o <strong>viés necessário</strong>.
        </p>
      </>
    ),
  },
  {
    id: 'bias-one',
    number: '1',
    title: 'A Balança e a Unidade',
    color: 'cyan',
    symbol: '⚖️',
    shortSummary: 'A sequência dos números naturais, o acréscimo de um e o início de toda harmonia aritmética.',
    fullExplanation: (
      <>
        <p>
          A sequência dos números naturais. O acréscimo de um. Onde o rótulo da conta começa e a <strong>balança dos números</strong> entra em ação.
        </p>
      </>
    ),
  },
  {
    id: 'bias-two-four-eight',
    number: '2 · 4 · 8',
    title: 'A Base do Universo',
    color: 'purple',
    symbol: '2ⁿ',
    shortSummary: 'A base binária da computação. O dobro do dobro (4) e o cubo de 2 (8).',
    fullExplanation: (
      <>
        <p>
          <strong>Tabuada do 2:</strong> O Universo que entendemos de verdade é escrito na base 2: Preto e Branco, as cores que prevalecem no Sistema.
        </p>
        <p>
          <strong>Tabuada do 4:</strong> O dobro do dobro. Qualquer número multiplicado por 4 é o dobro duas vezes.
        </p>
        <p>
          <strong>A Grandeza do 8:</strong> O cubo de 2. Sabe como somar 8 rápido? Volta dois passos e adiciona uma dezena à esquerda.
        </p>
      </>
    ),
    interactiveExample: {
      label: 'Hack de Somar 8',
      formula: '35 + 8  ➔  Volta 2 (33) e Soma 10',
      calculation: '= 43',
    },
  },
  {
    id: 'bias-three-six',
    number: '3 · 6',
    title: 'A Fração e a Dúzia',
    color: 'orange',
    symbol: '⅓',
    shortSummary: 'A parte perfeita do número completo, o rei das dízimas e a utilidade milenar da base 12.',
    fullExplanation: (
      <>
        <p>
          <strong>Tabuada do 3:</strong> Uma parte perfeita do número completo, o rei das dízimas periódicas. Sabe quem ele coroa? O 9.
        </p>
        <p>
          <strong>Tabuada do 6:</strong> A meia dúzia. Um sistema antigo muito útil, porque o 12 se divide perfeitamente por 2, 3, 4 e 6!
        </p>
      </>
    ),
  },
  {
    id: 'bias-five',
    number: '5',
    title: 'O Nosso Relógio',
    color: 'blue',
    symbol: '⏱️',
    shortSummary: 'A facilidade de cortar na metade e terminar sempre em 0 ou 5.',
    fullExplanation: (
      <>
        <p>
          A tabuada que nos faz inteligentes com a sua facilidade absoluta em transformar o difícil. A mágica de <strong>cortar na metade</strong> e terminar em 0 ou 5 (ex: <code>48 × 5 = 24 × 10 = 240</code>).
        </p>
      </>
    ),
    interactiveExample: {
      label: 'Multiplicação por 5 em 1 segundo',
      formula: '48 × 5  ➔  Metade de 48 é 24  ➔  Multiplica por 10',
      calculation: '= 240',
    },
  },
  {
    id: 'bias-seven',
    number: '7',
    title: 'O Número da Fênix (142857)',
    color: 'pink',
    symbol: '𝟕',
    shortSummary: 'A misteriosa dízima cíclica 142857 que se auto-reconstitui e soma 999.',
    fullExplanation: (
      <>
        <p>
          Ele é aceito como louco porque sua verdade é encontrada em números muito grandes ou muito pequenos. Mas em conjunto, a divisão por 7 gera a poderosa dízima <strong>142857</strong>. Todos os números aparecem nela; os invisíveis completam as partes perfeitas. Fatorando: <strong>(142 + 857 = 999)</strong>.
        </p>
      </>
    ),
  },
  {
    id: 'bias-nine',
    number: '9',
    title: 'O Infinito que Completa',
    color: 'gold',
    symbol: '∞',
    shortSummary: 'Se 8 ÷ 9 = 0.888..., então 9 ÷ 9 = 0.999... = 1. A morte da fração e o nascimento do Todo.',
    fullExplanation: (
      <>
        <p>
          O número que não aparece nas dízimas periódicas porque ele mostra o infinito de qualquer número. Se <code>1 ÷ 9 = 0.111...</code> e <code>8 ÷ 9 = 0.888...</code>, então <code>9 ÷ 9 = 0.999...</code> (o Infinito que vira o 1, o Todo!). A regra do 9 é divina: <strong>diminui uma unidade e soma uma na dezena</strong> (9, 18, 27, 36...).
        </p>
      </>
    ),
    interactiveExample: {
      label: 'O Salto do Infinito',
      formula: '9 ÷ 9 = 0.999... = 1',
      calculation: 'A Fração se Torna Completa',
    },
  },
]

export function BiasesInteractiveGrid() {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const toggleExpand = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id))
  }

  return (
    <section className="biases-section" id="vieses-section" aria-labelledby="biases-heading">
      <div className="section">
        <div className="text-center mb-4">
          <span className="section-tag-gold">
            <span>📐</span>
            <span>OS 9 VIÉSES DOS NÚMEROS</span>
          </span>
        </div>

        <h2 id="biases-heading" className="section-heading section-heading--center">
          Pare de Decorar. <span className="section-heading--accent">Hackeie a Geometria</span>.
        </h2>

        <p className="section-sub-center">
          A Matemática não vai sair do lugar. Nós apenas escrevemos problemas diferentes de maneiras que produzam resultados. A regra universal: <strong>Manipule sempre do maior para o menor.</strong>
        </p>

        {/* Biases Grid */}
        <div className="biases-grid">
          {BIASES.map((bias) => {
            const isExpanded = expandedId === bias.id
            return (
              <article
                key={bias.id}
                className={`bias-card bias-card--${bias.color} ${isExpanded ? 'bias-card--open' : ''}`}
              >
                <div className="bias-card__header">
                  <span className="bias-card__number">{bias.number}</span>
                  <span className="bias-card__symbol">{bias.symbol}</span>
                </div>

                <h3 className="bias-card__title">{bias.title}</h3>
                <p className="bias-card__summary">{bias.shortSummary}</p>

                {bias.interactiveExample && (
                  <div className="bias-card__example-box">
                    <span className="bias-card__example-label">{bias.interactiveExample.label}:</span>
                    <code className="bias-card__example-formula">{bias.interactiveExample.formula}</code>
                    <span className="bias-card__example-res">{bias.interactiveExample.calculation}</span>
                  </div>
                )}

                {/* Expandable Explanation */}
                {isExpanded && (
                  <div className="bias-card__full-content">
                    {bias.fullExplanation}
                  </div>
                )}

                <button
                  type="button"
                  className="bias-card__expand-btn"
                  onClick={() => toggleExpand(bias.id)}
                  aria-expanded={isExpanded}
                >
                  {isExpanded ? '▲ Recolher explicação' : '▼ Ver fundamento completo'}
                </button>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
