import React, { useEffect, useRef, useState } from 'react'
import { DESCRICAO_ERRO_PEDAGOGICO, tituloDoTema } from './contratosEstudo'
import type { DiagnosticoEstudo } from './diagnosticoEstudo'
import type { EstadoEstudoLocal, EventoEstudo } from './repositorioEstudo'

export interface CadernoEstudoOverlayProps {
  readonly estadoEstudo: EstadoEstudoLocal
  readonly diagnostico: DiagnosticoEstudo
  readonly statusAcao?: string
  readonly onFechar: () => void
  readonly onTreinarTema: (temaId: string) => void
  readonly onExportarJson: () => Promise<void> | void
  readonly onApagarTudo: () => Promise<void> | void
}

function seloPrioridade(risco: number): { readonly texto: string; readonly classe: string } {
  if (risco >= 100) return { texto: 'Prioridade Alta', classe: 'alta' }
  if (risco >= 45) return { texto: 'Prioridade Média', classe: 'media' }
  return { texto: 'Atenção', classe: 'atencao' }
}

function rotuloEvento(ev: EventoEstudo): string {
  switch (ev.tipo) {
    case 'acerto':
      return `Acerto (Grau ${ev.grau}${ev.errosNaConta > 0 ? `, ${ev.errosNaConta} erro(s)` : ', de 1ª'})`
    case 'erro_alternativa': {
      const desc = ev.tagErro ? DESCRICAO_ERRO_PEDAGOGICO[ev.tagErro]?.titulo ?? ev.tagErro : ''
      return `Erro (Grau ${ev.grau}${desc ? ` · ${desc}` : ''})`
    }
    case 'dica_pedida':
      return `Dica N${ev.nivelDica} pedida (Grau ${ev.grau})`
    case 'abandono':
      return `Desistência/troca (Grau ${ev.grau})`
  }
}

export const CadernoEstudoOverlay: React.FC<CadernoEstudoOverlayProps> = ({
  estadoEstudo,
  diagnostico,
  statusAcao,
  onFechar,
  onTreinarTema,
  onExportarJson,
  onApagarTudo,
}) => {
  const cardRef = useRef<HTMLDivElement | null>(null)
  const [confirmandoApagar, setConfirmandoApagar] = useState(false)
  const { resumoGeral, ondePrecisaAjuda, emQuePrestarAtencao } = diagnostico
  const ultimosEventos = [...estadoEstudo.eventos].slice(-8).reverse()
  const totalEventos = estadoEstudo.eventos.length

  useEffect(() => {
    cardRef.current?.focus({ preventScroll: true })
  }, [])

  return (
    <div
      className="ilha-caderno"
      role="dialog"
      aria-modal="true"
      aria-label="Caderno de Estudo e Diagnóstico"
      data-testid="ilha-caderno"
    >
      <div ref={cardRef} className="ilha-caderno-card" tabIndex={-1}>
        <header className="ilha-caderno-topo">
          <div>
            <h2>Caderno de Estudo</h2>
            <p className="ilha-caderno-sub">
              O jogo continua rolando em 100 % no fundo · Dados salvos só neste navegador
              {resumoGeral.chutesRapidos > 0 ? ` · ${resumoGeral.chutesRapidos} chute(s) rápido(s) (<1,5s)` : ''}
            </p>
          </div>
          <button
            type="button"
            className="ilha-caderno-fechar"
            data-testid="ilha-caderno-fechar"
            onClick={onFechar}
          >
            Voltar ao jogo<span className="ilha-atalho-tecla"> (G / Esc)</span>
          </button>
        </header>

        <div className="ilha-caderno-corpo">
          <section className="ilha-caderno-resumo" aria-label="Resumo geral">
            <div className="ilha-caderno-kpi">
              <strong>{resumoGeral.totalResolvidas}</strong>
              <span>Resolvidas</span>
            </div>
            <div className="ilha-caderno-kpi">
              <strong>{resumoGeral.dePrimeiraPct}%</strong>
              <span>De primeira</span>
            </div>
            <div className="ilha-caderno-kpi">
              <strong>{resumoGeral.totalErros}</strong>
              <span>Erros</span>
            </div>
            <div className="ilha-caderno-kpi">
              <strong>{resumoGeral.totalDicas}</strong>
              <span>Dicas</span>
            </div>
            <div className="ilha-caderno-kpi">
              <strong>{resumoGeral.totalAbandonos}</strong>
              <span>Abandonos</span>
            </div>
            <div className="ilha-caderno-kpi">
              <strong>{resumoGeral.enemsDominados}</strong>
              <span>ENEMs dominados</span>
            </div>
          </section>

          <div className="ilha-caderno-colunas">
            <section className="ilha-caderno-secao" data-testid="ilha-caderno-ajuda">
              <h3>Onde você precisa mais de ajuda</h3>
              {ondePrecisaAjuda.length === 0 ? (
                <p className="ilha-caderno-vazio">
                  Ainda não há pontos críticos. Quando você errar, pedir dicas ou abandonar questões em um tema, os
                  temas prioritários aparecem aqui com um botão direto de treino.
                </p>
              ) : (
                <>
                  <div className="ilha-caderno-grafico" data-testid="ilha-caderno-grafico-fracos" aria-label="Gráfico de risco por tema">
                    {(() => {
                      const maxRisco = Math.max(1, ...ondePrecisaAjuda.map((i) => i.pontuacaoRisco))
                      return ondePrecisaAjuda.slice(0, 5).map((item) => {
                        const selo = seloPrioridade(item.pontuacaoRisco)
                        const pct = Math.min(100, Math.max(12, Math.round((item.pontuacaoRisco / maxRisco) * 100)))
                        return (
                          <div key={`bar-${item.temaId}`} className="ilha-caderno-barra-row">
                            <span className="ilha-caderno-barra-nome">{item.tituloPt}</span>
                            <div className="ilha-caderno-barra-trilha">
                              <div
                                className={`ilha-caderno-barra-fill ${selo.classe}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="ilha-caderno-barra-val">{item.pontuacaoRisco.toFixed(1)}</span>
                          </div>
                        )
                      })
                    })()}
                  </div>
                  <ul className="ilha-caderno-lista">
                  {ondePrecisaAjuda.map((item) => {
                    const selo = seloPrioridade(item.pontuacaoRisco)
                    return (
                      <li key={item.temaId} className="ilha-caderno-item" data-testid={`ilha-ajuda-tema-${item.temaId}`}>
                        <div className="ilha-caderno-item-info">
                          <strong>{item.tituloPt}</strong>
                          <span className="ilha-caderno-metrica" title={`Índice de risco: ${item.pontuacaoRisco}`}>
                            <span className={`ilha-selo-prioridade ${selo.classe}`}>{selo.texto}</span> · {item.errosTotais} erro(s) · {item.abandonos} abandono(s)
                          </span>
                          <p>{item.recomendacaoPt}</p>
                        </div>
                        <button
                          type="button"
                          className="ilha-caderno-treinar"
                          data-testid={`ilha-treinar-${item.temaId}`}
                          onClick={() => onTreinarTema(item.temaId)}
                        >
                          Treinar agora
                        </button>
                      </li>
                    )
                  })}
                  </ul>
                </>
              )}
            </section>

            <section className="ilha-caderno-secao" data-testid="ilha-caderno-atencao">
              <h3>No que você precisa prestar mais atenção</h3>
              {emQuePrestarAtencao.length === 0 ? (
                <p className="ilha-caderno-vazio">
                  Nenhum padrão de armadilha recorrente registrado ainda. Continue resolvendo questões para montar seu
                  mapa de atenção.
                </p>
              ) : (
                <ul className="ilha-caderno-lista">
                  {emQuePrestarAtencao.map((alerta) => (
                    <li key={alerta.tagErro} className="ilha-caderno-item" data-testid={`ilha-atencao-${alerta.tagErro}`}>
                      <div className="ilha-caderno-item-info">
                        <strong>
                          {alerta.tituloPt} ({alerta.ocorrencias}x)
                        </strong>
                        <p>{alerta.alertaPraticoPt}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section className="ilha-caderno-secao" aria-label="Últimas interações">
            <h3>
              Registro recente ({totalEventos} {totalEventos === 1 ? 'evento local' : 'eventos locais'})
            </h3>
            {ultimosEventos.length === 0 ? (
              <p className="ilha-caderno-vazio">Nenhuma interação registrada neste navegador.</p>
            ) : (
              <ul className="ilha-caderno-eventos">
                {ultimosEventos.map((ev, i) => (
                  <li key={`${ev.quando}-${ev.itemId}-${i}`}>
                    <strong>{tituloDoTema(ev.temaId)}:</strong> {rotuloEvento(ev)}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <footer className="ilha-caderno-rodape">
          {statusAcao && (
            <p className="ilha-caderno-status" data-testid="ilha-caderno-status">
              {statusAcao}
            </p>
          )}
          <div className="ilha-caderno-acoes-lgpd">
            <button
              type="button"
              className="ilha-caderno-exportar"
              data-testid="ilha-caderno-exportar"
              onClick={() => void onExportarJson()}
            >
              Exportar JSON
            </button>
            {!confirmandoApagar ? (
              <button
                type="button"
                className="ilha-caderno-apagar"
                data-testid="ilha-caderno-apagar"
                onClick={() => setConfirmandoApagar(true)}
              >
                Apagar meus dados
              </button>
            ) : (
              <div className="ilha-caderno-confirmar-apagar">
                <button
                  type="button"
                  className="ilha-caderno-apagar-confirmar"
                  data-testid="ilha-caderno-apagar-confirmar"
                  onClick={() => {
                    setConfirmandoApagar(false)
                    void onApagarTudo()
                  }}
                >
                  Confirmar: apagar tudo
                </button>
                <button
                  type="button"
                  className="ilha-caderno-cancelar"
                  data-testid="ilha-caderno-apagar-cancelar"
                  onClick={() => setConfirmandoApagar(false)}
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        </footer>
      </div>
    </div>
  )
}
