import React, { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkMath from 'remark-math'
import {
  protegerCifraoMoeda,
  protegerMarkdownInline,
  type DesafioUnificado,
  type FiguraOficial,
  type OrigemQuestao,
} from './contratosEstudo'
import type { FigurasClassificadas, LetraAlternativaVisual } from './figurasEnem'

export type AlinhamentoCelula = 'left' | 'center' | 'right'

export type BlocoEnunciado =
  | { readonly tipo: 'markdown'; readonly texto: string }
  | {
      readonly tipo: 'tabela'
      readonly cabecalho: readonly string[]
      readonly alinhamentos: readonly AlinhamentoCelula[]
      readonly linhas: readonly (readonly string[])[]
    }

const RE_SEPARADOR_TABELA = /^\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)+\|?$/

function quebrarLinhaTabela(linha: string): string[] {
  const aparada = linha.trim().replace(/^\|/, '').replace(/\|$/, '')
  return aparada.split('|').map((c) => c.trim())
}

function extrairAlinhamento(celulaSep: string): AlinhamentoCelula {
  const s = celulaSep.trim()
  const esq = s.startsWith(':')
  const dir = s.endsWith(':')
  if (esq && dir) return 'center'
  if (dir) return 'right'
  return 'left'
}

export function dividirBlocosEnunciado(texto: string): BlocoEnunciado[] {
  const linhas = texto.replace(/\r\n/g, '\n').split('\n')
  const blocos: BlocoEnunciado[] = []
  let bufferMd: string[] = []

  const flushMd = () => {
    const joined = bufferMd.join('\n').trim()
    if (joined) blocos.push({ tipo: 'markdown', texto: joined })
    bufferMd = []
  }

  let i = 0
  while (i < linhas.length) {
    const atual = linhas[i].trim()
    const prox = i + 1 < linhas.length ? linhas[i + 1].trim() : ''
    if (atual.includes('|') && RE_SEPARADOR_TABELA.test(prox)) {
      flushMd()
      const cabecalho = quebrarLinhaTabela(atual)
      const alinhamentos = quebrarLinhaTabela(prox).map(extrairAlinhamento)
      const corpo: string[][] = []
      i += 2
      while (i < linhas.length) {
        const l = linhas[i].trim()
        if (!l || !l.includes('|')) break
        corpo.push(quebrarLinhaTabela(l))
        i++
      }
      blocos.push({ tipo: 'tabela', cabecalho, alinhamentos, linhas: corpo })
      continue
    }
    bufferMd.push(linhas[i])
    i++
  }
  flushMd()
  return blocos
}

export const MarkdownInline: React.FC<{ readonly texto: string }> = ({ texto }) => (
  <ReactMarkdown
    remarkPlugins={[remarkMath]}
    rehypePlugins={[rehypeKatex]}
    components={{ p: ({ children }) => <>{children}</> }}
  >
    {protegerMarkdownInline(texto)}
  </ReactMarkdown>
)

const SELO_POR_ORIGEM: Record<
  OrigemQuestao,
  { readonly rotulo: string; readonly classe: string }
> = {
  enem_oficial: { rotulo: 'ENEM', classe: 'enem' },
  senai_oficial: { rotulo: 'SENAI', classe: 'senai' },
  etec_oficial: { rotulo: 'ETEC', classe: 'etec' },
  motor_parametrico: { rotulo: 'MOTOR INFINITO', classe: 'motor' },
}

export interface AberturaQuestaoProps {
  readonly desafio: DesafioUnificado
  readonly blocos: readonly BlocoEnunciado[]
  readonly figurasClassificadas: FigurasClassificadas
  readonly erradasSet: ReadonlySet<string>
  readonly resolvida: boolean
  readonly onResponder: (altId: string) => void
}

type NivelZoom = 1 | 1.5 | 2

export const AberturaQuestao: React.FC<AberturaQuestaoProps> = ({
  desafio,
  blocos,
  figurasClassificadas,
  erradasSet,
  resolvida,
  onResponder,
}) => {
  const [rascunhoAberto, setRascunhoAberto] = useState(false)
  const [textoRascunho, setTextoRascunho] = useState('')
  const [figuraAmpliada, setFiguraAmpliada] = useState<FiguraOficial | null>(null)
  const [zoom, setZoom] = useState<NivelZoom>(1)
  const lightboxPalcoRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setRascunhoAberto(false)
    setTextoRascunho('')
    setFiguraAmpliada(null)
    setZoom(1)
  }, [desafio.id])

  useEffect(() => {
    if (!figuraAmpliada) return
    lightboxPalcoRef.current?.focus({ preventScroll: true })
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        setFiguraAmpliada(null)
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [figuraAmpliada])

  const selo = SELO_POR_ORIGEM[desafio.origem]
  const temFiguraEnunciado = figurasClassificadas.enunciado.length > 0
  const modoVisualAlt = figurasClassificadas.modoAlternativaVisual
  const temAlternativaLarga =
    !modoVisualAlt &&
    desafio.alternativas.some(
      (alt) => (alt.rotulo.includes('\\frac') && alt.rotulo.length >= 45) || alt.rotulo.length >= 90,
    )

  const renderAlternativas = () => (
    <div
      className={`ilha-choices${temFiguraEnunciado ? ' ilha-choices-palco' : ''}${
        modoVisualAlt ? ' ilha-choices-visuais' : ''
      }${!temFiguraEnunciado && temAlternativaLarga ? ' ilha-choices-largas' : ''}`}
    >
      {desafio.alternativas.map((alt) => {
        const foiErrada = erradasSet.has(alt.id)
        const marcadaCerta = resolvida && alt.correta
        const thumbAlt = modoVisualAlt
          ? figurasClassificadas.alternativasPorLetra[alt.letra as LetraAlternativaVisual]
          : undefined

        return (
          <button
            key={alt.id}
            type="button"
            data-testid={`ilha-alt-${alt.letra}`}
            className={`ilha-choice-btn${thumbAlt ? ' ilha-choice-visual' : ''}${
              foiErrada ? ' errada' : ''
            }${marcadaCerta ? ' certa' : ''}`}
            disabled={resolvida || foiErrada}
            onClick={() => onResponder(alt.id)}
          >
            {thumbAlt && (
              <span className="ilha-choice-thumb-wrap">
                <img
                  src={thumbAlt.src}
                  alt={thumbAlt.alt}
                  width={thumbAlt.largura}
                  height={thumbAlt.altura}
                />
              </span>
            )}
            <span className="ilha-choice-linha">
              <span className="ilha-choice-letra">{alt.letra})</span>
              <span className="ilha-choice-texto">
                <MarkdownInline texto={alt.rotulo} />
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )

  return (
    <section className={`ilha-abertura${temFiguraEnunciado ? ' com-palco' : ' texto-limpo'}`}>
      <div className="ilha-abertura-fio">
        <div className="ilha-conta-meta">
          <span className={`ilha-selo-origem ${selo.classe}`} data-testid="ilha-selo-origem">
            {selo.rotulo}
          </span>
          <span className="ilha-tema-tag">{desafio.temaTituloPt}</span>
          {desafio.referenciaOficial ? (
            <span className="ilha-enem-ref" data-testid="ilha-enem-ref">
              {desafio.referenciaOficial.citacaoCurta} · {desafio.referenciaOficial.licenca}
            </span>
          ) : (
            <span className="ilha-motor-ref">
              {desafio.altarFisicoCompativel
                ? 'Os pisos N L S O no chão também respondem'
                : 'Responda diretamente no card'}
            </span>
          )}
        </div>

        <button
          type="button"
          className="ilha-btn-rascunho"
          data-testid="ilha-btn-rascunho"
          aria-expanded={rascunhoAberto}
          onClick={() => setRascunhoAberto((v) => !v)}
        >
          {rascunhoAberto ? 'Ocultar rascunho' : 'Rascunho'}
        </button>
      </div>

      {!desafio.altarFisicoCompativel && (
        <p className="ilha-slow">
          Questão oficial com 5 alternativas (A–E) · o mundo segue em tempo real.
        </p>
      )}

      {rascunhoAberto && (
        <div className="ilha-rascunho-painel">
          <label className="ilha-rascunho-rotulo" htmlFor={`rascunho-${desafio.id}`}>
            Bloco de rascunho livre (não afeta sua pontuação)
          </label>
          <textarea
            id={`rascunho-${desafio.id}`}
            className="ilha-rascunho-textarea"
            data-testid="ilha-rascunho-texto"
            rows={3}
            placeholder="Anote equações, frações, proporções ou etapas intermediárias aqui..."
            value={textoRascunho}
            onChange={(e) => setTextoRascunho(e.target.value)}
          />
        </div>
      )}

      <div
        className={`ilha-enunciado${temFiguraEnunciado ? ' ilha-enunciado-palco' : ' ilha-enunciado-editorial'}`}
        data-testid="ilha-conta-enunciado"
      >
        {blocos.map((bloco, idx) =>
          bloco.tipo === 'markdown' ? (
            <ReactMarkdown
              key={idx}
              remarkPlugins={[remarkMath]}
              rehypePlugins={[rehypeKatex]}
            >
              {protegerCifraoMoeda(bloco.texto)}
            </ReactMarkdown>
          ) : (
            <div key={idx} className="ilha-tabela-wrap">
              <table className="ilha-tabela-enem">
                <thead>
                  <tr>
                    {bloco.cabecalho.map((cel, cIdx) => (
                      <th key={cIdx} style={{ textAlign: bloco.alinhamentos[cIdx] ?? 'left' }}>
                        <MarkdownInline texto={cel} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bloco.linhas.map((linha, rIdx) => (
                    <tr key={rIdx}>
                      {linha.map((cel, cIdx) => (
                        <td key={cIdx} style={{ textAlign: bloco.alinhamentos[cIdx] ?? 'left' }}>
                          <MarkdownInline texto={cel} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ),
        )}
      </div>

      {temFiguraEnunciado ? (
        <div className="ilha-abertura-split">
          <div className="ilha-abertura-prancha">
            <div className="ilha-figuras" data-testid="ilha-figuras-oficiais">
              {figurasClassificadas.enunciado.map((figura) => (
                <button
                  key={figura.src}
                  type="button"
                  className="ilha-passe-partout-btn"
                  aria-label={`Ampliar figura: ${figura.alt}`}
                  onClick={() => {
                    setZoom(1)
                    setFiguraAmpliada(figura)
                  }}
                >
                  <span className="ilha-passe-partout">
                    <img
                      src={figura.src}
                      alt={figura.alt}
                      width={figura.largura}
                      height={figura.altura}
                    />
                  </span>
                  <span className="ilha-passe-partout-zoom" aria-hidden="true">
                    Ampliar
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="ilha-abertura-alternativas">{renderAlternativas()}</div>
        </div>
      ) : (
        renderAlternativas()
      )}

      {figuraAmpliada && (
        <div
          className="ilha-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Inspeção ampliada da figura"
          data-testid="ilha-lightbox"
          data-esc-proprio="true"
          onClick={() => setFiguraAmpliada(null)}
        >
          <div
            ref={lightboxPalcoRef}
            className="ilha-lightbox-palco"
            tabIndex={-1}
            data-esc-proprio="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ilha-lightbox-barra">
              <div className="ilha-lightbox-zoom-grupo" role="group" aria-label="Nível de ampliação">
                <button
                  type="button"
                  data-testid="ilha-lightbox-zoom-1"
                  data-esc-proprio="true"
                  aria-pressed={zoom === 1}
                  onClick={() => setZoom(1)}
                >
                  1×
                </button>
                <button
                  type="button"
                  data-testid="ilha-lightbox-zoom-15"
                  data-esc-proprio="true"
                  aria-pressed={zoom === 1.5}
                  onClick={() => setZoom(1.5)}
                >
                  1,5×
                </button>
                <button
                  type="button"
                  data-testid="ilha-lightbox-zoom-2"
                  data-esc-proprio="true"
                  aria-pressed={zoom === 2}
                  onClick={() => setZoom(2)}
                >
                  2×
                </button>
              </div>
              <button
                type="button"
                className="ilha-lightbox-fechar"
                data-testid="ilha-lightbox-fechar"
                data-esc-proprio="true"
                onClick={() => setFiguraAmpliada(null)}
              >
                Fechar (Esc)
              </button>
            </div>
            <div className="ilha-lightbox-scroll">
              <div className="ilha-lightbox-moldura">
                <img
                  src={figuraAmpliada.src}
                  alt={figuraAmpliada.alt}
                  style={
                    zoom === 1
                      ? { width: 'auto', maxWidth: '100%', maxHeight: 'calc(84vh - 96px)' }
                      : {
                          width: `${Math.min(
                            Math.round(figuraAmpliada.largura * zoom),
                            zoom === 1.5 ? 1450 : 1900,
                          )}px`,
                          maxWidth: 'none',
                        }
                  }
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
