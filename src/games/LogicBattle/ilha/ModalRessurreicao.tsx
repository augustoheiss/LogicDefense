import React from 'react'
import { PARTIDA, type GrauConta } from './partidaPolicies'
import { bonusVidaPorGrauConta, type EstadoRessurreicao, type NucleoVivoNoAtlas } from './ressurreicaoHeroi'
import { nomeDoBioma } from './visual/biomaVisualCatalog'

export interface ModalRessurreicaoProps {
  readonly estado: EstadoRessurreicao
  readonly nucleosVivos: readonly NucleoVivoNoAtlas[]
  readonly minimizado: boolean
  readonly grauSelecionado: GrauConta
  readonly onSelecionarNucleo: (mapaI: number, mapaJ: number, obraId: number) => void
  readonly onSelecionarGrau: (grau: GrauConta) => void
  readonly onRenascerViaConta: () => void
  readonly onAlternarMinimizar: (minimizado: boolean) => void
}

const GRAUS_DISPONIVEIS: readonly GrauConta[] = PARTIDA.enemHabilitado ? [1, 2, 3, 4, 5, 6, 7] : [1, 2, 3, 4]

export const ModalRessurreicao: React.FC<ModalRessurreicaoProps> = ({
  estado,
  nucleosVivos,
  minimizado,
  grauSelecionado,
  onSelecionarNucleo,
  onSelecionarGrau,
  onRenascerViaConta,
  onAlternarMinimizar,
}) => {
  if (!estado.aguardando) return null
  const segundos = Math.max(1, Math.ceil(estado.cooldownRestanteSeg))
  const dest = estado.nucleoDestino
  const nucleoAtual =
    (dest && nucleosVivos.find((n) => n.mapaI === dest.mapaI && n.mapaJ === dest.mapaJ && n.obraId === dest.obraId)) ??
    nucleosVivos[0]
  const pct =
    estado.cooldownTotalSeg > 0
      ? Math.max(0, Math.min(100, ((estado.cooldownTotalSeg - estado.cooldownRestanteSeg) / estado.cooldownTotalSeg) * 100))
      : 0

  if (minimizado) {
    return (
      <div className="ilha-banner-ressurreicao" data-testid="ilha-banner-ressurreicao" role="status">
        <div className="ilha-banner-ressurreicao-info">
          <strong>Herói tombado</strong>
          <span>
            Renascendo em {segundos}s{' '}
            {nucleoAtual ? `no Núcleo (${nucleoAtual.mapaI},${nucleoAtual.mapaJ})` : ''}
          </span>
          <div className="ilha-ressurreicao-barra">
            <div className="ilha-ressurreicao-progresso" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <button
          type="button"
          className="ilha-ressurreicao-btn-conta"
          data-testid="ilha-ressurreicao-expandir"
          onClick={() => onAlternarMinimizar(false)}
        >
          Renascer agora
        </button>
      </div>
    )
  }

  return (
    <div
      className="ilha-modal-ressurreicao"
      data-testid="ilha-modal-ressurreicao"
      role="dialog"
      aria-modal="false"
      aria-label="Ressurreição do Herói"
    >
      <div className="ilha-ressurreicao-card">
        <div className="ilha-ressurreicao-topo">
          <div>
            <h2>Herói Tombado</h2>
            <p className="ilha-ressurreicao-sub">
              Seu império segue lutando! Escolha em qual Núcleo vivo renascer (com 3s de escudo ao nascer).
            </p>
          </div>
          <span className="ilha-ressurreicao-timer" data-testid="ilha-ressurreicao-timer">
            Auto-renascer em {segundos}s
          </span>
        </div>

        <div className="ilha-ressurreicao-secao">
          <span className="ilha-ressurreicao-rotulo">1. Escolha o Núcleo de destino ({nucleosVivos.length}):</span>
          <div className="ilha-ressurreicao-nucleos">
            {nucleosVivos.map((nuc) => {
              const ativo =
                nucleoAtual?.mapaI === nuc.mapaI &&
                nucleoAtual?.mapaJ === nuc.mapaJ &&
                nucleoAtual?.obraId === nuc.obraId
              return (
                <button
                  key={`${nuc.mapaI}-${nuc.mapaJ}-${nuc.obraId}`}
                  type="button"
                  className={ativo ? 'ilha-ressurreicao-nucleo ativo' : 'ilha-ressurreicao-nucleo'}
                  data-testid={`ilha-ressurreicao-nucleo-${nuc.mapaI}-${nuc.mapaJ}`}
                  aria-pressed={ativo}
                  onClick={() => onSelecionarNucleo(nuc.mapaI, nuc.mapaJ, nuc.obraId)}
                >
                  <strong>
                    Mapa ({nuc.mapaI},{nuc.mapaJ}) · Nv.{nuc.nivel}
                  </strong>
                  <span>
                    {nomeDoBioma(nuc.bioma)} · HP {Math.ceil(nuc.hp)}/{Math.ceil(nuc.maxHp)}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="ilha-ressurreicao-secao">
          <span className="ilha-ressurreicao-rotulo">2. Bônus de vida ao renascer via conta matemática:</span>
          <div className="ilha-ressurreicao-graus">
            {GRAUS_DISPONIVEIS.map((g) => (
              <button
                key={g}
                type="button"
                className={grauSelecionado === g ? 'ilha-chip ativo' : 'ilha-chip'}
                data-testid={`ilha-ressurreicao-grau-${g}`}
                onClick={() => onSelecionarGrau(g)}
              >
                G{g} (+{bonusVidaPorGrauConta(g)} HP)
              </button>
            ))}
          </div>
        </div>

        <div className="ilha-ressurreicao-barra">
          <div className="ilha-ressurreicao-progresso" style={{ width: `${pct}%` }} />
        </div>

        <div className="ilha-ressurreicao-acoes">
          <button
            type="button"
            className="ilha-ressurreicao-btn-conta"
            data-testid="ilha-ressuscitar-conta"
            onClick={onRenascerViaConta}
          >
            Fazer conta e renascer agora (+{bonusVidaPorGrauConta(grauSelecionado)} HP)
          </button>
          <button
            type="button"
            className="ilha-ressurreicao-btn-aguardar"
            data-testid="ilha-ressuscitar-aguardar"
            onClick={() => onAlternarMinimizar(true)}
          >
            Aguardar {segundos}s (comandar tropas)
          </button>
        </div>
      </div>
    </div>
  )
}
