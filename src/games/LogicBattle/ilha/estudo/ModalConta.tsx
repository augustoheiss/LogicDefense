import React, { useEffect, useMemo, useRef } from 'react'
import 'katex/dist/katex.min.css'
import { fatorDoBuff } from '../buffPorErro'
import { GRAU_PARTIDA, type GrauConta, PARTIDA } from '../partidaPolicies'
import { AberturaQuestao, dividirBlocosEnunciado, MarkdownInline } from './AberturaQuestao'
import type { DesafioUnificado } from './contratosEstudo'
import { classificarFigurasParaApresentacao, figurasEfetivas } from './figurasEnem'
import { PainelDicas } from './PainelDicas'

export { dividirBlocosEnunciado }

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
  readonly onLimparTemaTreino?: () => void
}

const GRAUS_TODOS: readonly GrauConta[] = [1, 2, 3, 4, 5, 6, 7]
const GRAUS_MOTOR: readonly GrauConta[] = [1, 2, 3, 4]

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
  onLimparTemaTreino,
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
  const figuras = useMemo(() => (desafio ? figurasEfetivas(desafio) : []), [desafio])
  const enunciadoTemTabela = useMemo(
    () => blocos.some((bloco) => bloco.tipo === 'tabela'),
    [blocos],
  )
  const figurasClassificadas = useMemo(
    () => classificarFigurasParaApresentacao(figuras, { enunciadoTemTabela }),
    [figuras, enunciadoTemTabela],
  )
  const modoPalco = Boolean(desafio && figurasClassificadas.enunciado.length > 0)

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
      <div ref={cardRef} className={`ilha-card${modoPalco ? ' ilha-card-palco' : ''}`} tabIndex={-1}>
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
                <span>Foco direcionado</span>
                {onLimparTemaTreino && (
                  <button
                    type="button"
                    className="ilha-badge-treino-limpar"
                    data-testid="ilha-limpar-foco"
                    title="Sair do foco direcionado"
                    aria-label="Sair do foco direcionado"
                    onClick={onLimparTemaTreino}
                  >
                    ×
                  </button>
                )}
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
              <AberturaQuestao
                desafio={desafio}
                blocos={blocos}
                figurasClassificadas={figurasClassificadas}
                erradasSet={erradasSet}
                resolvida={resolvida}
                onResponder={onResponder}
              />

              {diagnosticoAtual && (
                <p
                  className={`ilha-diagnostico${resolvida ? ' acerto' : ' erro'}`}
                  data-testid="ilha-conta-diagnostico"
                >
                  <MarkdownInline texto={diagnosticoAtual} />
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
