import React, { useEffect, useRef, useState } from 'react'
import { formatarVida, legendaDaVida, nomeAcessivelDaVida, proximaLegenda } from './textosVida'

/**
 * O selo de vida do herói: um CORAÇÃO e o número, SEM o texto «Vida do herói» à mostra (decisão do usuário, 20/11).
 *
 * - A legenda («Vida do herói: 10.512», com o valor EXATO: o selo curto diz «10k» e esconderia um ganho de +512) abre por um ESTADO
 *   (`aberta`) e também com o mouse em cima (`:hover`, só no desktop). O estado existe porque o `:hover` do celular é emulado e pegajoso
 *   (o T2 mediu a legenda presa) e porque o `Escape` precisa fechá-la (WCAG 1.4.13 «Dismissible»). A transição é `proximaLegenda`.
 * - Toque e Enter/Espaço alternam; `Escape`, toque fora e perda de foco fecham.
 * - O leitor de tela lê o valor EXATO («Vida do herói: 10.512»), nunca «10k»; o coração e a legenda visual são `aria-hidden`.
 * - É `role="img"` + `tabindex="0"`, e NÃO um `<button>`: ele só informa, e um botão que não faz nada promete uma ação que não existe.
 * - O clique nele NÃO é clique no mundo: `.ilha-army` está na lista de exclusão do `onPointerDown` da shell (rodada 4 do T2, DEF-L51B-1: sem
 *   isso, clicar no coração atirava e abria o joystick). `contratoDoHud.test.ts` falha se um elemento do HUD recebe ponteiro e fica de fora.
 */
export const SeloDeVida: React.FC<{ vida: number }> = ({ vida }) => {
  const [aberta, setAberta] = useState(false)
  // O MOUSE mostra a legenda por um canal visual PARALELO ao estado (`.mouse-em-cima`), ligado só com `pointerType === 'mouse'`. Não é o `:hover` do CSS: o
  // toque num dispositivo de ponteiro primário fine/hover (2-em-1, Chromebook) deixa o `:hover` verdadeiro e a legenda ficava PRESA depois do 2º toque
  // (reproduzido no jogo real; com o `:hover` neutralizado a mesma sequência fecha). O mouse não toca no estado `aberta`: sair com o mouse não fecha uma
  // legenda aberta por Enter ou por toque.
  const [mouseEmCima, setMouseEmCima] = useState(false)
  const raiz = useRef<HTMLDivElement>(null)

  // Toque/clique FORA do selo fecha a legenda. O ouvinte só existe enquanto ela está aberta (não pesa no jogo o resto do tempo).
  useEffect(() => {
    if (!aberta) return
    const fora = (event: PointerEvent) => {
      if (raiz.current && event.target instanceof Node && raiz.current.contains(event.target)) return
      setAberta((atual) => proximaLegenda(atual, 'toqueFora'))
    }
    document.addEventListener('pointerdown', fora, true)
    return () => document.removeEventListener('pointerdown', fora, true)
  }, [aberta])

  return (
    <div
      ref={raiz}
      className={`ilha-army${aberta ? ' aberta' : ''}${mouseEmCima ? ' mouse-em-cima' : ''}`}
      data-testid="ilha-exercito"
      role="img"
      tabIndex={0}
      data-teclado-proprio=""
      data-esc-proprio={aberta ? '' : undefined}
      aria-label={nomeAcessivelDaVida(vida)}
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') setMouseEmCima(true)
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === 'mouse') setMouseEmCima(false)
      }}
      onClick={(event) => {
        // `click` (e não `pointerup`): o navegador só o gera quando o pointerdown e o pointerup foram NO MESMO elemento. Com `pointerup`, apertar FORA do
        // selo e soltar SOBRE ele abria a legenda (achado do revisor, reproduzido no jogo real). Toque, mouse esquerdo e caneta geram `click`.
        // O botão PRINCIPAL continua checado: o direito e o do meio já não geram `click`, mas a guarda é barata e documenta a regra.
        if (event.button === 0) setAberta((atual) => proximaLegenda(atual, 'toque'))
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          if (aberta) {
            // O jogo NÃO fecha o card por baixo porque, ENQUANTO a legenda está aberta, o selo declara `data-esc-proprio` (o handler do jogo, na
            // CAPTURA da window, consulta `jogoTomaEscape` ANTES de agir). Com a legenda fechada o atributo some: o Esc volta a ser do jogo (senão
            // um card aberto ficava preso com o foco no selo). O `stopPropagation` abaixo não protegeria nada: ele roda depois, na fase do React.
            event.stopPropagation()
            setAberta((atual) => proximaLegenda(atual, 'escape'))
          }
        } else if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          event.stopPropagation()
          // Segurar a tecla repete o keydown: sem isto a legenda piscava (abre/fecha a cada repetição). O jogo faz o mesmo (`if (event.repeat) return`).
          if (!event.repeat) setAberta((atual) => proximaLegenda(atual, 'teclaAbrir'))
        }
      }}
      onBlur={() => setAberta((atual) => proximaLegenda(atual, 'perdeuFoco'))}
    >
      <svg className="ilha-army-icone" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
        <path d="M12 21.2l-1.45-1.32C5.4 15.2 2 12.1 2 8.3 2 5.2 4.4 3 7.4 3c1.7 0 3.4.8 4.6 2.1C13.2 3.8 14.9 3 16.6 3 19.6 3 22 5.2 22 8.3c0 3.8-3.4 6.9-8.55 11.58L12 21.2z" />
      </svg>
      <span className="ilha-army-valor" aria-hidden="true">
        {formatarVida(vida)}
      </span>
      <span className="ilha-army-legenda" aria-hidden="true">
        {legendaDaVida(vida)}
      </span>
    </div>
  )
}
