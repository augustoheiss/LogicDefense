import React, { useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkMath from 'remark-math'
import { protegerCifraoMoeda, type DesafioUnificado } from './contratosEstudo'

export interface PainelDicasProps {
  readonly desafio: DesafioUnificado
  readonly dicasAbertas: 0 | 1 | 2 | 3
  readonly resolvida: boolean
  readonly ultimoGanhoPt?: string
  readonly onPedirDica: (nivel: 1 | 2 | 3) => void
  readonly onProximaQuestao: () => void
  readonly onVoltarJogo: () => void
}

const ROTULOS_DICAS: Record<1 | 2 | 3, string> = {
  1: 'Dica 1 · Foco',
  2: 'Dica 2 · Boteco',
  3: 'Dica 3 · 1º Passo',
}

function limparPrefixoBoteco(texto: string): string {
  return texto.replace(/^Resumo de boteco:\s*/i, '')
}

const MarkdownDicaInline: React.FC<{ readonly texto: string }> = ({ texto }) => (
  <ReactMarkdown
    remarkPlugins={[remarkMath]}
    rehypePlugins={[rehypeKatex]}
    components={{ p: ({ children }) => <>{children}</> }}
  >
    {protegerCifraoMoeda(texto)}
  </ReactMarkdown>
)

export const PainelDicas: React.FC<PainelDicasProps> = ({
  desafio,
  dicasAbertas,
  resolvida,
  ultimoGanhoPt,
  onPedirDica,
  onProximaQuestao,
  onVoltarJogo,
}) => {
  const dicasVisiveis = desafio.dicas.filter((d) => d.nivel <= dicasAbertas)
  const ultimaDicaRef = useRef<HTMLLIElement | null>(null)
  const posAcertoRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (dicasAbertas > 0) {
      ultimaDicaRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [dicasAbertas])

  useEffect(() => {
    if (resolvida) {
      posAcertoRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [resolvida])

  const listaDicas = dicasVisiveis.length > 0 && (
    <ol className="ilha-dicas-lista">
      {dicasVisiveis.map((dica, idx) => {
        const ehUltima = idx === dicasVisiveis.length - 1
        const corpo = dica.nivel === 2 ? limparPrefixoBoteco(dica.textoPt) : dica.textoPt
        return (
          <li
            key={dica.nivel}
            ref={ehUltima ? ultimaDicaRef : undefined}
            className="ilha-dica-item"
            data-testid={`ilha-dica-texto-${dica.nivel}`}
          >
            <strong>
              Nível {dica.nivel} — {dica.titulo}:
            </strong>{' '}
            <MarkdownDicaInline texto={corpo} />
          </li>
        )
      })}
    </ol>
  )

  return (
    <section className="ilha-dicas" aria-label="Dicas progressivas">
      {resolvida && (
        <div ref={posAcertoRef} className="ilha-pos-acerto" data-testid="ilha-pos-acerto">
          <div className="ilha-pos-acerto-titulo">Resolução completa liberada</div>
          {ultimoGanhoPt && (
            <p className="ilha-pos-acerto-ganho" data-testid="ilha-pos-acerto-ganho">
              <strong>Recompensa aplicada:</strong> {ultimoGanhoPt}
            </p>
          )}
          <div className="ilha-pos-acerto-texto">
            <MarkdownDicaInline texto={desafio.posAcerto.solucaoCompletaPt} />
          </div>
          {desafio.posAcerto.metodos.length > 0 && (
            <ul className="ilha-pos-acerto-metodos">
              {desafio.posAcerto.metodos.map((m, idx) => (
                <li key={idx}>
                  <strong>{m.selo}:</strong> <MarkdownDicaInline texto={m.resumo} />
                </li>
              ))}
            </ul>
          )}
          <p className="ilha-pos-acerto-real">
            <strong>Na vida real:</strong> <MarkdownDicaInline texto={desafio.posAcerto.dicaVidaRealPt} />
          </p>
          <div className="ilha-pos-acerto-acoes">
            <button
              type="button"
              className="ilha-pos-acerto-proxima"
              data-testid="ilha-conta-proxima"
              onClick={onProximaQuestao}
            >
              Próxima questão
            </button>
            <button
              type="button"
              className="ilha-pos-acerto-voltar"
              data-testid="ilha-conta-voltar-pos-acerto"
              onClick={onVoltarJogo}
            >
              Voltar ao jogo<span className="ilha-atalho-tecla"> (Q)</span>
            </button>
          </div>
        </div>
      )}

      {!resolvida ? (
        <>
          <div className="ilha-dicas-cabecalho">
            <span className="ilha-dicas-titulo">Dicas progressivas</span>
            <span className="ilha-dicas-sem-pena">
              Dicas não reduzem seu buff (só erro de alternativa divide por 2)
            </span>
          </div>

          <div className="ilha-dicas-botoes">
            {([1, 2, 3] as const).map((nivel) => {
              const aberta = nivel <= dicasAbertas
              const bloqueadaPorOrdem = !aberta && nivel > dicasAbertas + 1
              return (
                <button
                  key={nivel}
                  type="button"
                  className="ilha-dica-btn"
                  data-testid={`ilha-dica-btn-${nivel}`}
                  aria-pressed={aberta}
                  disabled={aberta || bloqueadaPorOrdem}
                  onClick={() => onPedirDica(nivel)}
                >
                  {aberta ? `✓ ${ROTULOS_DICAS[nivel]}` : ROTULOS_DICAS[nivel]}
                </button>
              )
            })}
          </div>

          {listaDicas}
        </>
      ) : (
        dicasVisiveis.length > 0 && (
          <details className="ilha-dicas-recolhidas">
            <summary>Ver dicas usadas nesta questão ({dicasVisiveis.length})</summary>
            {listaDicas}
          </details>
        )
      )}
    </section>
  )
}
