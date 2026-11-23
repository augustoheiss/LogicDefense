import React, { useEffect, useMemo, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkMath from 'remark-math'
import 'katex/dist/katex.min.css'
import { fatorDoBuff } from '../buffPorErro'
import { GRAU_PARTIDA, type GrauConta, PARTIDA } from '../partidaPolicies'
import { protegerCifraoMoeda, type DesafioUnificado } from './contratosEstudo'
import { PainelDicas } from './PainelDicas'

export interface ModalContaProps {
  readonly desafio: DesafioUnificado | null
  readonly grauSelecionado: GrauConta
  readonly carregando: boolean
  readonly erroCarregamento?: boolean
  readonly dicasAbertas: 0 | 1 | 2 | 3
  readonly erradasClicadas: readonly string[]
  readonly diagnosticoAtual: string
  readonly ultimoGanhoPt?: string
  readonly erros: number
  readonly resolvida: boolean
  readonly temaTreinoAtivo?: string | null
  readonly onSelecionarGrau: (grau: GrauConta) => void
  readonly onResponder: (altId: string) => void
  readonly onPedirDica: (nivel: 1 | 2 | 3) => void
  readonly onProximaQuestao: () => void
  readonly onTentarNovamente?: () => void
  readonly onMinimizarJogo: () => void
  readonly onDesistirETrocar: () => void
  readonly onAbrirCaderno: () => void
}

type AlinhamentoCelula = 'left' | 'center' | 'right'

type BlocoEnunciado =
  | { readonly tipo: 'markdown'; readonly texto: string }
  | {
      readonly tipo: 'tabela'
      readonly cabecalho: readonly string[]
      readonly alinhamentos: readonly AlinhamentoCelula[]
      readonly linhas: readonly (readonly string[])[]
    }

const RE_SEPARADOR_TABELA = /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?$/

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

const GRAUS_TODOS: readonly GrauConta[] = [1, 2, 3, 4, 5, 6, 7]
const GRAUS_MOTOR: readonly GrauConta[] = [1, 2, 3, 4]

const MarkdownInline: React.FC<{ readonly texto: string }> = ({ texto }) => (
  <ReactMarkdown
    remarkPlugins={[remarkMath]}
    rehypePlugins={[rehypeKatex]}
    components={{ p: ({ children }) => <>{children}</> }}
  >
    {protegerCifraoMoeda(texto)}
  </ReactMarkdown>
)

export const ModalConta: React.FC<ModalContaProps> = ({
  desafio,
  grauSelecionado,
  carregando,
  erroCarregamento,
  dicasAbertas,
  erradasClicadas,
  diagnosticoAtual,
  ultimoGanhoPt,
  erros,
  resolvida,
  temaTreinoAtivo,
  onSelecionarGrau,
  onResponder,
  onPedirDica,
  onProximaQuestao,
  onTentarNovamente,
  onMinimizarJogo,
  onDesistirETrocar,
  onAbrirCaderno,
}) => {
  const cardRef = useRef<HTMLDivElement | null>(null)
  const grausDisponiveis = PARTIDA.enemHabilitado ? GRAUS_TODOS : GRAUS_MOTOR
  const buffPct = Math.round(fatorDoBuff(erros) * 10000) / 100
  const buffTexto = `${String(buffPct).replace('.', ',')}%`
  const erradasSet = useMemo(() => new Set(erradasClicadas), [erradasClicadas])
  const blocos = useMemo(
    () => (desafio ? dividirBlocosEnunciado(desafio.enunciadoMarkdown) : []),
    [desafio],
  )

  useEffect(() => {
    cardRef.current?.focus({ preventScroll: true })
  }, [])

  return (
    <div
      className="ilha-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Desafio Matemático"
      data-testid="ilha-modal-conta"
    >
      <div ref={cardRef} className="ilha-card" tabIndex={-1}>
        <header className="ilha-card-topo">
          <div className="ilha-card-badges">
            <span className="ilha-badge-tempo" data-testid="ilha-badge-tempo-real">
              ⚡ Tempo real (100%)
            </span>
            <span
              className={`ilha-badge-buff${erros > 0 ? ' reduzido' : ''}`}
              data-testid="ilha-badge-buff"
            >
              Buff: {buffTexto}
            </span>
            {temaTreinoAtivo && (
              <span className="ilha-badge-treino" title="Treino direcionado do seu Caderno de Estudo">
                Foco direcionado
              </span>
            )}
          </div>
          <div className="ilha-card-acoes-topo">
            <button
              type="button"
              className="ilha-btn-topo-caderno"
              data-testid="ilha-conta-abrir-caderno"
              onClick={onAbrirCaderno}
            >
              Caderno<span className="ilha-atalho-tecla"> (G)</span>
            </button>
            <button
              type="button"
              className="ilha-btn-topo-jogo"
              data-testid="ilha-conta-minimizar"
              onClick={onMinimizarJogo}
            >
              Jogo<span className="ilha-atalho-tecla"> (Q)</span>
            </button>
          </div>
        </header>

        <div className="ilha-tiers" role="group" aria-label="Escolha o grau de dificuldade">
          {grausDisponiveis.map((item) => {
            const spec = GRAU_PARTIDA[item]
            return (
              <button
                key={item}
                type="button"
                data-testid={`ilha-tier-${item}`}
                aria-pressed={item === grauSelecionado}
                title={spec.sub}
                onClick={() => onSelecionarGrau(item)}
              >
                {spec.rotulo}
              </button>
            )
          })}
        </div>

        <div className="ilha-card-corpo">
          {erroCarregamento ? (
            <div className="ilha-conta-erro">
              <p>Não foi possível carregar a questão agora.</p>
              {onTentarNovamente && (
                <button type="button" className="ilha-pos-acerto-proxima" onClick={onTentarNovamente}>
                  Tentar novamente
                </button>
              )}
            </div>
          ) : carregando || !desafio ? (
            <p className="ilha-conta-carregando">Carregando questão...</p>
          ) : (
            <>
              <div className="ilha-conta-meta">
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

              {!desafio.altarFisicoCompativel && (
                <p className="ilha-slow">
                  Questão oficial com 5 alternativas (A–E) · o mundo segue em tempo real.
                </p>
              )}

              <div className="ilha-enunciado" data-testid="ilha-conta-enunciado">
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
                              <th
                                key={cIdx}
                                style={{ textAlign: bloco.alinhamentos[cIdx] ?? 'left' }}
                              >
                                <MarkdownInline texto={cel} />
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {bloco.linhas.map((linha, rIdx) => (
                            <tr key={rIdx}>
                              {linha.map((cel, cIdx) => (
                                <td
                                  key={cIdx}
                                  style={{ textAlign: bloco.alinhamentos[cIdx] ?? 'left' }}
                                >
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

              <div className="ilha-choices">
                {desafio.alternativas.map((alt) => {
                  const foiErrada = erradasSet.has(alt.id)
                  const marcadaCerta = resolvida && alt.correta
                  return (
                    <button
                      key={alt.id}
                      type="button"
                      data-testid={`ilha-alt-${alt.letra}`}
                      className={`ilha-choice-btn${foiErrada ? ' errada' : ''}${marcadaCerta ? ' certa' : ''}`}
                      disabled={resolvida || foiErrada}
                      onClick={() => onResponder(alt.id)}
                    >
                      <span className="ilha-choice-letra">{alt.letra})</span>
                      <span className="ilha-choice-texto">
                        <MarkdownInline texto={alt.rotulo} />
                      </span>
                    </button>
                  )
                })}
              </div>

              {diagnosticoAtual && (
                <p
                  className={`ilha-diagnostico${resolvida ? ' acerto' : ' erro'}`}
                  data-testid="ilha-conta-diagnostico"
                >
                  {diagnosticoAtual}
                  {!resolvida && erros > 0 ? ` · Buff reduzido para ${buffTexto}` : ''}
                </p>
              )}

              <PainelDicas
                desafio={desafio}
                dicasAbertas={dicasAbertas}
                resolvida={resolvida}
                ultimoGanhoPt={ultimoGanhoPt}
                onPedirDica={onPedirDica}
                onProximaQuestao={onProximaQuestao}
                onVoltarJogo={onMinimizarJogo}
              />
            </>
          )}
        </div>

        <footer className="ilha-card-rodape">
          {!resolvida && (
            <button
              type="button"
              className="ilha-desistir"
              data-testid="ilha-conta-desistir"
              onClick={onDesistirETrocar}
            >
              Desistir e trocar
            </button>
          )}
          <button
            type="button"
            className="ilha-fechar"
            data-testid="ilha-conta-fechar"
            onClick={onMinimizarJogo}
          >
            Voltar ao jogo<span className="ilha-atalho-tecla"> (Q)</span>
          </button>
        </footer>
      </div>
    </div>
  )
}
