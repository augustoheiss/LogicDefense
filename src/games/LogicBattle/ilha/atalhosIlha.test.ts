import {
  alvoDoTeclado,
  cliqueAbreOPainelDaObra,
  destinoDoToque,
  jogoTomaConfirmar,
  jogoTomaEscape,
  paraPropagacaoDoPointerdown,
  precoDeEvoluir,
  painelValido,
  proximaEntradaPorTeclado,
  teclaDoBotaoFocado,
  type AlvoDoTeclado,
} from './atalhosIlha'

function assert(condition: boolean, name: string): asserts condition {
  if (!condition) throw new Error(name)
}

const corpo: AlvoDoTeclado = { tag: 'BODY', ehCampoDeTexto: false, ehControleProprio: false, tratouEscape: false }
const botao: AlvoDoTeclado = { tag: 'BUTTON', ehCampoDeTexto: false, ehControleProprio: false, tratouEscape: false }
const campo: AlvoDoTeclado = { tag: 'INPUT', ehCampoDeTexto: true, ehControleProprio: false, tratouEscape: false }
const link: AlvoDoTeclado = { tag: 'A', ehCampoDeTexto: false, ehControleProprio: false, tratouEscape: false }
// O selo de vida: um <div role="img" tabindex=0> que TRATA o próprio Enter/Espaço/Escape (data-teclado-proprio). Não é BUTTON, então a regra antiga
// («só botão/link/campo é dono da tecla») deixava o jogo agir ANTES do onKeyDown do selo (captura na window): o herói pulava, o card era
// confirmado, o Esc fechava o card. Achado do revisor independente da L5.1, provado no jogo real.
// selo com a legenda FECHADA: trata Enter/Espaco (ehControleProprio) mas NAO tem nada a fechar com o Esc (tratouEscape false)
const selo: AlvoDoTeclado = { tag: 'DIV', ehCampoDeTexto: false, ehControleProprio: true, tratouEscape: false }
// selo com a legenda ABERTA: o Esc e dele (fecha a legenda)
const seloAberto: AlvoDoTeclado = { tag: 'DIV', ehCampoDeTexto: false, ehControleProprio: true, tratouEscape: true }

export function run(): void {
  const semNada = { cardAberto: false, painelAberto: false }
  const comCard = { cardAberto: true, painelAberto: false }
  const comPainel = { cardAberto: false, painelAberto: true }

  // Sem card nem painel, Enter é do navegador: botão focado tem de poder ativar por teclado.
  assert(!jogoTomaConfirmar('Enter', corpo, semNada, true), 'Enter sem card nem painel não é do jogo')
  assert(!jogoTomaConfirmar('Enter', botao, semNada, true), 'Enter com botão focado e sem card fica com o botão')
  assert(!jogoTomaConfirmar('Enter', link, semNada, true), 'Enter em link fica com o link')
  assert(!jogoTomaConfirmar('Enter', campo, semNada, false), 'Enter em campo de texto fica com o campo')

  // Com card ou painel aberto o jogo confirma, no corpo da página.
  assert(jogoTomaConfirmar('Enter', corpo, comCard, false), 'Enter confirma o card aberto')
  assert(jogoTomaConfirmar('Space', corpo, comCard, false), 'Espaço confirma o card aberto')
  assert(jogoTomaConfirmar('Enter', corpo, comPainel, false), 'Enter confirma o painel aberto')
  assert(jogoTomaConfirmar('Space', corpo, comPainel, false), 'Espaço confirma o painel aberto')

  // D-C1: o foco ficou no botão que abriu o card porque o jogador CLICOU nele (entrada por mouse).
  // Enter e Espaço têm de confirmar o card, não reabri-lo.
  assert(jogoTomaConfirmar('Enter', botao, comCard, false), 'D-C1: botão focado por clique de mouse não rouba o Enter do card')
  assert(jogoTomaConfirmar('Space', botao, comCard, false), 'D-C1: botão focado por clique de mouse não rouba o Espaço do card')
  assert(jogoTomaConfirmar('Enter', botao, comPainel, false), 'D-C1: o mesmo vale para o painel da obra')

  // Botão focado por TECLADO (Tab) com card aberto: o foco vence, é o botão que o jogador alcançou.
  assert(!jogoTomaConfirmar('Enter', botao, comCard, true), 'Enter em botão alcançado por Tab ativa o botão, não o card')
  assert(!jogoTomaConfirmar('Space', botao, comPainel, true), 'Espaço em botão alcançado por Tab ativa o botão, não o painel')

  // Campo de texto nunca perde a tecla para o jogo, venha o foco de onde vier.
  assert(!jogoTomaConfirmar('Enter', campo, comCard, false), 'Enter em campo de texto nunca é do jogo')
  assert(!jogoTomaConfirmar('Space', campo, comPainel, false), 'Espaço em campo de texto nunca é do jogo')

  // Outras teclas nunca são de confirmar.
  assert(!jogoTomaConfirmar('KeyX', corpo, comCard, false), 'tecla neutra não confirma')
  assert(!jogoTomaConfirmar('Escape', corpo, comPainel, false), 'Esc não é confirmar')

  // O Espaço do pulo. Regressão do F1-B, medida no navegador: depois de CLICAR num botão do HUD o foco
  // fica nele, e o Espaço deixou de pular. `:focus-visible` não serve para decidir: vira true na
  // primeira tecla. Quem decide é a entrada anterior.
  assert(!teclaDoBotaoFocado(corpo, false), 'Espaço no corpo da página continua sendo o pulo')
  assert(!teclaDoBotaoFocado(corpo, true), 'Espaço no corpo é o pulo mesmo depois de Tab')
  assert(!teclaDoBotaoFocado(botao, false), 'F1-B: botão focado por clique de mouse NÃO rouba o Espaço do pulo')
  assert(teclaDoBotaoFocado(botao, true), 'botão alcançado por Tab fica com o Espaço dele')
  assert(teclaDoBotaoFocado(link, true), 'link alcançado por Tab fica com o Espaço')
  assert(!teclaDoBotaoFocado(link, false), 'link focado por clique não rouba o Espaço do pulo')
  assert(teclaDoBotaoFocado(campo, false), 'Espaço em campo de texto nunca é pulo, mesmo por clique')
  assert(teclaDoBotaoFocado(campo, true), 'Espaço em campo de texto nunca é pulo')

  // Quem registra a origem do foco: ponteiro apaga, Tab acende, o resto não muda.
  assert(proximaEntradaPorTeclado({ tipo: 'ponteiro' }, true) === false, 'clique de mouse apaga a entrada por teclado')
  assert(proximaEntradaPorTeclado({ tipo: 'tecla', code: 'Tab' }, false) === true, 'Tab acende a entrada por teclado')
  assert(proximaEntradaPorTeclado({ tipo: 'tecla', code: 'Tab' }, true) === true, 'Tab de novo mantém a entrada por teclado')
  assert(proximaEntradaPorTeclado({ tipo: 'tecla', code: 'ArrowRight' }, false) === false, 'seta anda a câmera: não acende a entrada por teclado')
  assert(proximaEntradaPorTeclado({ tipo: 'tecla', code: 'ArrowLeft' }, true) === true, 'seta não apaga a origem anterior')
  assert(proximaEntradaPorTeclado({ tipo: 'tecla', code: 'Space' }, false) === false, 'Espaço sozinho não acende: não move o foco')
  assert(proximaEntradaPorTeclado({ tipo: 'tecla', code: 'KeyW' }, true) === true, 'tecla de jogo não apaga a origem anterior')
  assert(proximaEntradaPorTeclado({ tipo: 'tecla', code: 'KeyW' }, false) === false, 'tecla de jogo não acende a origem')

  // A3b: o painel fantasma. O id do painel vive num ref e a obra pode morrer, sumir ou virar inimiga depois.
  // O painel só vale se a obra ainda existe, é nossa e está viva. Do contrário ele está invisível na tela mas
  // `painelAberto` seguia true: o Espaço deixava de pular e o Enter evoluía um id morto.
  const obraViva = { id: 7, lado: 'nosso' as const, hp: 30 }
  const obraMorta = { id: 8, lado: 'nosso' as const, hp: 0 }
  const obraDoInimigo = { id: 9, lado: 'inimigo' as const, hp: 40 }
  const obras = [obraViva, obraMorta, obraDoInimigo]
  assert(painelValido(7, obras), 'painel de obra nossa viva é válido')
  assert(!painelValido(8, obras), 'painel de obra morta (hp 0) é fantasma')
  assert(!painelValido(9, obras), 'painel de obra do inimigo não vale')
  assert(!painelValido(404, obras), 'painel de id que não existe mais é fantasma')
  assert(!painelValido(null, obras), 'sem id não há painel')
  assert(!painelValido(7, []), 'sem obras nenhuma o painel é fantasma')
  assert(!painelValido(7, [{ id: 7, lado: 'nosso' as const, hp: -3 }]), 'hp negativo conta como morta')

  // OBS-F2-1: na derrota o painel não vale, nem para abrir nem para ficar. A obra segue viva, o que muda é a partida:
  // painel interativo por cima da tela de derrota evoluía obra de uma partida que já acabou. `painelValido` ganhou
  // o parâmetro `derrota` para que a regra tenha um dono só (onObra, o efeito que fecha e o JSX liam cada um o seu).
  assert(painelValido(7, obras, false), 'sem derrota nada muda: obra nossa viva abre painel')
  assert(!painelValido(7, obras, true), 'OBS-F2-1: na derrota o painel de obra viva não vale')
  assert(!painelValido(null, obras, true), 'derrota sem id continua sem painel')
  assert(painelValido(7, obras), 'derrota é opcional: sem o argumento vale como partida em andamento')

  // A2b: o clique na obra NOSSA abre o painel e não pode atirar. O `pointerdown` do container atira em todo botão
  // esquerdo fora do império; a malha da obra roda antes (medido: o handler do R3F vem antes do do container), então
  // ela marca o ponteiro como «da obra» e o container não atira nem pede o pointer lock. Esta regra decide QUANDO o
  // ponteiro é da obra. Obra inimiga NÃO entra: continua sendo alvo do tiro e do ataque.
  const nossaViva = { lado: 'nosso' as const, hp: 30 }
  const livre = { botao: 0, olhar: 'primeira' as const, modoEdicao: false }
  assert(cliqueAbreOPainelDaObra(nossaViva, livre), 'A2b: esquerdo em obra nossa viva, em primeira pessoa, abre o painel')
  assert(cliqueAbreOPainelDaObra(nossaViva, { ...livre, olhar: 'terceira' }), 'A2b: o mesmo em terceira pessoa')
  assert(!cliqueAbreOPainelDaObra(nossaViva, { ...livre, olhar: 'imperio' }), 'A2b: no império o container já não atira, não há o que consumir')
  assert(!cliqueAbreOPainelDaObra(nossaViva, { ...livre, botao: 2 }), 'A2b: o direito não abre painel (é ordem)')
  assert(!cliqueAbreOPainelDaObra(nossaViva, { ...livre, botao: 1 }), 'A2b: o do meio não abre painel')
  assert(!cliqueAbreOPainelDaObra(nossaViva, { ...livre, modoEdicao: true }), 'A2b: em modo bloco/linha/consagrar o clique é de edição, não do painel')
  assert(!cliqueAbreOPainelDaObra({ lado: 'inimigo', hp: 40 }, livre), 'A2b: obra do inimigo segue sendo alvo do tiro')
  assert(!cliqueAbreOPainelDaObra({ lado: 'nosso', hp: 0 }, livre), 'A2b: ruína nossa (hp 0) não abre painel e não consome o tiro')
  assert(!cliqueAbreOPainelDaObra(null, livre), 'A2b: obra que sumiu não abre painel')

  // OBS-F2-4: em «Observando» (sem corpo) o `olhar` do quadrado observado segue 'terceira' (medido pelo T2), mas é vista
  // tática: o container não atira lá e retorna cedo SEM consumir o marcador. O marcador sobrava e engolia o 1º tiro
  // depois de «Voltar ao corpo» (medido: 0 tiros no 1º clique contra 1 no controle). Sem corpo vale como império.
  assert(!cliqueAbreOPainelDaObra(nossaViva, { ...livre, semCorpo: true }), 'OBS-F2-4: sem corpo (Observando) vale como império: não marca o ponteiro')
  assert(cliqueAbreOPainelDaObra(nossaViva, { ...livre, semCorpo: false }), 'OBS-F2-4: com corpo, em 3ª pessoa, segue marcando')
  assert(cliqueAbreOPainelDaObra(nossaViva, livre), 'OBS-F2-4: `semCorpo` é opcional: sem ele vale como com corpo')

  // F2-D4: o TOQUE na obra nossa abre o painel e não pode virar joystick nem arrasto de câmera. O container recebia o
  // `pointerdown` do dedo, zerava o marcador da obra sem LER e armava o manche (metade esquerda) ou o olhar (direita):
  // medido pelo T2 em toque real (`stickPonteiro` setado, `.ilha-joystick.ativo`). `ToquePonteiro` decide o destino do
  // dedo; o `pointerId` do dedo é o que a malha marcou, e é comparado com o do evento.
  const larg = 390
  const toque = (x: number, marcado: number | null, idDoDedo = 7) => ({
    marcadoPelaObra: marcado,
    pointerId: idDoDedo,
    x,
    largura: larg,
    olhar: 'terceira' as const,
    semCorpo: false,
  })
  assert(destinoDoToque(toque(50, null)) === 'manche', 'F2-D4: toque no chão, metade esquerda, vira joystick')
  assert(destinoDoToque(toque(300, null)) === 'olhar', 'F2-D4: toque no chão, metade direita, gira a câmera')
  assert(destinoDoToque(toque(50, 7)) === 'obra', 'F2-D4: toque numa obra na metade ESQUERDA abre o painel e NÃO arma o joystick')
  assert(destinoDoToque(toque(300, 7)) === 'obra', 'F2-D4: toque numa obra na metade direita NÃO arrasta a câmera')
  assert(destinoDoToque(toque(50, 3)) === 'manche', 'F2-D4: marcador de OUTRO dedo não rouba este toque (multi-toque)')
  assert(destinoDoToque({ ...toque(50, null), olhar: 'imperio' }) === 'imperio', 'F2-D4: no império não há manche nem olhar')
  assert(destinoDoToque({ ...toque(50, null), semCorpo: true }) === 'imperio', 'F2-D4: sem corpo também é tático')
  assert(destinoDoToque({ ...toque(50, 7), olhar: 'imperio' }) === 'imperio', 'F2-D4: no império a obra segue o fluxo do império')
  assert(destinoDoToque(toque(175.5, null)) === 'olhar', 'F2-D4: o limite é 45% da largura (175,5 já é metade direita)')
  assert(destinoDoToque(toque(175.4, null)) === 'manche', 'F2-D4: logo abaixo de 45% ainda é manche')

  // OBS-F2-5: o `pointerdown` de uma obra INIMIGA à frente tem de PARAR o raycast do R3F. Sem isso o raycast seguia para
  // uma obra NOSSA colinear atrás, que marcava o ponteiro, e o container suprimia o tiro: o clique morria sem atirar
  // e sem abrir painel (medido: HP 500 -> 500 e 0 tiros, contra 488 e 1 tiro com o aliado longe). O `onClick` já parava
  // para qualquer obra viva visível; o `pointerdown` só parava para o botão direito.
  const inimigaViva = { lado: 'inimigo' as const, hp: 500, coberta: true }
  const edicaoNao = { botao: 0, modoEdicao: false }
  assert(paraPropagacaoDoPointerdown(inimigaViva, edicaoNao), 'OBS-F2-5: esquerdo numa inimiga viva e visível para o raycast (nada atrás captura o clique)')
  assert(paraPropagacaoDoPointerdown(inimigaViva, { botao: 2, modoEdicao: false }), 'OBS-F2-5: o direito já parava e continua parando')
  assert(!paraPropagacaoDoPointerdown({ ...inimigaViva, coberta: false }, edicaoNao), 'OBS-F2-5: inimiga na névoa (não coberta) não é alvo: o clique segue para o chão')
  assert(!paraPropagacaoDoPointerdown({ ...inimigaViva, hp: 0 }, edicaoNao), 'OBS-F2-5: ruína inimiga (hp 0) não captura o clique')
  assert(!paraPropagacaoDoPointerdown(inimigaViva, { botao: 0, modoEdicao: true }), 'OBS-F2-5: em modo de edição o clique é de bloco: não paramos')
  assert(!paraPropagacaoDoPointerdown({ lado: 'nosso', hp: 30, coberta: true }, edicaoNao), 'OBS-F2-5: obra NOSSA segue o fluxo do A2b (marca o ponteiro), não esta regra')
  assert(!paraPropagacaoDoPointerdown(null, edicaoNao), 'OBS-F2-5: obra que sumiu não para nada')
  assert(!paraPropagacaoDoPointerdown(inimigaViva, { botao: 1, modoEdicao: false }), 'OBS-F2-5: o botão do meio não é clique de jogo')

  // A4: o painel mostra o preço que `evoluir` cobra, formatado a partir da MESMA constante. O texto fixo mentia
  // em «níveis altos» e continuaria mentindo se alguém mudasse o preço só na função.
  assert(
    precoDeEvoluir({ credito: 1, madeira: 2, ouro: 2 }) === '1 licença, ou 2 madeiras e 2 ouros',
    'A4: o preço de hoje (1 / 2 / 2) sai no texto do painel',
  )
  assert(
    precoDeEvoluir({ credito: 3, madeira: 4, ouro: 1 }) === '3 licenças, ou 4 madeiras e 1 ouro',
    'A4: o texto segue a constante: plurais e singulares acompanham o número',
  )
  assert(
    precoDeEvoluir({ credito: 1, madeira: 1, ouro: 1 }) === '1 licença, ou 1 madeira e 1 ouro',
    'A4: tudo no singular',
  )

  // Conversão do alvo do DOM no tipo puro. Alvo ausente ou sem tag vira corpo.
  assert(alvoDoTeclado(null).tag === 'BODY', 'alvo nulo lê como corpo')
  assert(alvoDoTeclado({}).tag === 'BODY', 'alvo sem tag lê como corpo')
  assert(alvoDoTeclado({ tagName: 'button' }).tag === 'BUTTON', 'tag vira maiúscula')
  assert(alvoDoTeclado({ tagName: 'DIV', isContentEditable: true }).ehCampoDeTexto, 'contenteditable é campo de texto')
  assert(alvoDoTeclado({ tagName: 'INPUT' }).ehCampoDeTexto, 'input é campo de texto')
  assert(!alvoDoTeclado({ tagName: 'CANVAS' }).ehCampoDeTexto, 'canvas não é campo de texto')

  // ── controle que trata o PROPRIO teclado (selo de vida): a tecla e dele, venha o foco de Tab OU de clique ──────────────────────────────
  assert(alvoDoTeclado({ tagName: 'div', dataset: { tecladoProprio: '' } }).ehControleProprio, 'data-teclado-proprio marca o elemento como dono da propria tecla')
  assert(alvoDoTeclado({ tagName: 'div', dataset: { tecladoProprio: 'true' } }).ehControleProprio, 'o valor do atributo nao importa, so a presenca')
  assert(!alvoDoTeclado({ tagName: 'div', dataset: {} }).ehControleProprio, 'sem o atributo nao e controle proprio')
  assert(!alvoDoTeclado({ tagName: 'div' }).ehControleProprio, 'sem dataset nao e controle proprio (nao quebra)')
  assert(!alvoDoTeclado(null).ehControleProprio && !alvoDoTeclado(undefined).ehControleProprio, 'alvo nulo nao e controle proprio')
  assert(teclaDoBotaoFocado(selo, false), 'selo focado por CLIQUE: a tecla e do selo (um div nao ganha foco so por Tab)')
  assert(teclaDoBotaoFocado(selo, true), 'selo focado por Tab: a tecla e do selo')
  assert(!jogoTomaConfirmar('Enter', selo, comCard, false), 'Enter no selo NAO confirma o card do jogo (bug provado no jogo real)')
  assert(!jogoTomaConfirmar('Space', selo, comCard, true), 'Espaco no selo NAO confirma o card')
  assert(!jogoTomaConfirmar('Enter', selo, comPainel, false), 'Enter no selo NAO evolui o painel da obra')
  assert(jogoTomaConfirmar('Enter', corpo, comCard, false), 'regressao: sem controle proprio o Enter ainda confirma o card')

  // ── Escape: com o foco num controle que trata o proprio Esc, o jogo nao fecha card/painel por baixo ───────────────────────────────────
  assert(jogoTomaEscape(corpo), 'Esc com o foco no corpo e do jogo (fecha card/painel/ferramenta)')
  assert(jogoTomaEscape(botao), 'Esc num botao continua do jogo (botao nao trata Esc)')
  assert(jogoTomaEscape(campo) === false, 'Esc num campo de texto fica com o campo')
  assert(jogoTomaEscape(seloAberto) === false, 'Esc no selo com a legenda ABERTA fica com o selo (ele fecha a propria legenda)')
  // REGRESSAO achada pelo revisor no MEU conserto (provada no jogo real): foco no selo, legenda FECHADA, card aberto: o Esc tem de fechar o card.
  // `data-teclado-proprio` (Enter/Espaco) vale SEMPRE; `data-esc-proprio` (o Esc) so enquanto ha legenda para fechar.
  assert(jogoTomaEscape(selo) === true, 'Esc no selo com a legenda FECHADA e do JOGO (senao o card/painel fica preso: ninguem trata o Esc)')
  assert(teclaDoBotaoFocado(selo, false), 'Enter/Espaco no selo continuam do selo mesmo com a legenda fechada (o bug original do pulo)')
  // o atributo que declara «trato o Esc agora»
  assert(alvoDoTeclado({ tagName: 'div', dataset: { tecladoProprio: '', escProprio: '' } }).tratouEscape, 'data-esc-proprio declara que o controle trata o Esc agora')
  assert(!alvoDoTeclado({ tagName: 'div', dataset: { tecladoProprio: '' } }).tratouEscape, 'sem data-esc-proprio o Esc nao e do controle (so Enter/Espaco)')
  assert(!alvoDoTeclado({ tagName: 'div' }).tratouEscape && !alvoDoTeclado(null).tratouEscape, 'sem dataset nao quebra')
  assert(alvoDoTeclado({ tagName: 'div', dataset: { escProprio: '' } }).tratouEscape, 'data-esc-proprio vale sozinho (independe de data-teclado-proprio)')
}
