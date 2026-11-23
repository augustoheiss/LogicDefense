import React, { useState } from 'react'
import { linhasDaLista, resumoDaBase, type ContextoDoResumo, type LinhaDaLista, type ObraDaLista, type RecursosDaLista } from './listaDeConstrucoes'
import { precoDeEvoluir } from './atalhosIlha'
import './painelDeConstrucoes.css'

/**
 * O PAINEL VERTICAL DE CONSTRUÇÕES (pedido do usuário, 23/11): no lugar da linha horizontal de status, um botão «Construções (N)» que ABRE uma coluna com cada construção nossa e o que se pode evoluir. A lógica (que linhas, o que cada
 * nível dá, o preço, se dá para pagar) é da `listaDeConstrucoes.ts` (pura e testada); aqui só se desenha. O botão evolui pelo mesmo caminho do painel da obra (`aoEvoluir(id)`), então o preço cobrado e as recusas são os de sempre.
 */
interface Props {
  readonly obras: readonly ObraDaLista[]
  readonly recursos: RecursosDaLista
  readonly resumo: ContextoDoResumo
  /** Evolui a obra `id` (o mesmo `evoluir` do painel da obra). */
  readonly aoEvoluir: (id: number) => void
}

const MARCADOR_DO_TIPO: Readonly<Record<string, string>> = { nucleo: '🏰', torre: '🗼', portao: '⛩️', quartel: '⚔️', britador: '⛏️', serraria: '🪵', mina: '💎' }

function textoDoPreco(l: LinhaDaLista): string {
  return l.preco ? precoDeEvoluir(l.preco) : ''
}

export const PainelDeConstrucoes: React.FC<Props> = ({ obras, recursos, resumo, aoEvoluir }) => {
  const [aberto, setAberto] = useState(false)
  const linhas = linhasDaLista(obras, recursos)
  const base = resumoDaBase(obras, resumo)
  const aEvoluir = linhas.filter((l) => l.podeEvoluir).length
  return (
    <div className="ilha-construcoes" data-testid="ilha-construcoes">
      <button
        type="button"
        className="ilha-construcoes-botao"
        data-testid="ilha-construcoes-abrir"
        aria-expanded={aberto}
        aria-controls="ilha-construcoes-lista"
        onClick={() => setAberto((valor) => !valor)}
      >
        <span>{base.temBase ? `Base · vida ${base.vidaDoNucleo}` : base.baseDestruida ? 'Base destruída' : 'Sem base'}</span>
        <span className="ilha-construcoes-contagem">
          {linhas.length} {linhas.length === 1 ? 'construção' : 'construções'}
          {aEvoluir > 0 ? ` · ${aEvoluir} ${aEvoluir === 1 ? 'pode evoluir' : 'podem evoluir'}` : ''}
        </span>
        <span aria-hidden="true">{aberto ? '▲' : '▼'}</span>
      </button>
      {aberto && (
        <div className="ilha-construcoes-lista" id="ilha-construcoes-lista" data-testid="ilha-construcoes-lista" role="region" aria-label="Construções e evolução">
          <p className="ilha-construcoes-resumo" data-testid="ilha-construcoes-resumo">
            {`Tropas ${base.tropas} · ${base.emOrdens} em ordens · ${base.emVigia} em vigia`}
            {base.emObras > 0 ? ` · ${base.emObras} em obras (frágil!)` : ''}
            {base.levaEm !== null ? ` · Leva em ${base.levaEm}s` : ''}
            {base.dragao ? ' · Dragão à solta' : ''}
            {base.semCaminho ? ' · sem caminho' : ''}
            {base.nucleoInimigoCaiu ? ' · Núcleo inimigo destruído · sem novas levas' : ''}
          </p>
          {linhas.length === 0 && <p className="ilha-construcoes-vazio">Nenhuma construção ainda.</p>}
          <ul className="ilha-construcoes-itens">
            {linhas.map((l) => (
              <li key={l.id} className={l.fraca ? 'ilha-construcao fraca' : 'ilha-construcao'} data-testid={`ilha-construcao-${l.id}`}>
                <div className="ilha-construcao-topo">
                  <span aria-hidden="true">{MARCADOR_DO_TIPO[l.tipo] ?? '🏗️'}</span>
                  <strong>{l.titulo}</strong>
                  <span className="ilha-construcao-nivel" data-testid={`ilha-construcao-${l.id}-nivel`}>
                    Nv. {l.nivel}
                  </span>
                  <span className="ilha-construcao-vida" title="vida / vida máxima">
                    {l.vida}/{l.vidaMaxima}
                  </span>
                </div>
                {l.emConstrucao && <p className="ilha-construcao-aviso">Em construção (frágil)</p>}
                {l.nivelMaximo ? (
                  <p className="ilha-construcao-aviso">Nível máximo</p>
                ) : (
                  <>
                    <p className="ilha-construcao-ganho" data-testid={`ilha-construcao-${l.id}-ganho`}>
                      Próximo nível: {l.ganho}
                    </p>
                    <div className="ilha-construcao-acao">
                      <span className="ilha-construcao-preco">{textoDoPreco(l)}</span>
                      <button
                        type="button"
                        className="ilha-construcao-evoluir"
                        data-testid={`ilha-construcao-${l.id}-evoluir`}
                        disabled={!l.podeEvoluir}
                        title={l.motivo ?? 'Evoluir'}
                        onClick={() => aoEvoluir(l.id)}
                      >
                        Evoluir
                      </button>
                    </div>
                    {!l.podeEvoluir && l.motivo && <p className="ilha-construcao-motivo">{l.motivo}</p>}
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
