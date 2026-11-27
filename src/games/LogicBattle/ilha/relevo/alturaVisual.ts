import { emAguaRasa, type LagoaRasa } from '../biomaRecursos'
import { classificarSuporteObra, pegadaEfetivaFundacao, type TipoSuporteFundacao, Y_AGUA_VISUAL, Y_SOLO_VISUAL } from '../visual/suporteFundacao'
import { alturaEm, type CampoRelevo } from './campoRelevo'
import { desnivelDaMalha, type ChaoDaMalha } from './chaoDaMalha'

/** O chão que o DESENHO consulta: o campo cru (a altura bilinear de hoje) ou o chão visto (a malha que o GPU desenha). Um tipo só para os 44 pontos que repassam o que recebem. */
export type ChaoDoDesenho = CampoRelevo | ChaoDaMalha

/**
 * A FONTE ÚNICA da altura do chão DESENHADO (F2, 24/11/2026). Lógica PURA, testada no Node (`relevoVisual.test.ts`).
 *
 * O chão do jogo era um plano em `Y_SOLO_VISUAL = −0,45`, e dezenas de pontos de desenho o repetiam. Agora um ponto de desenho que está NO CHÃO pergunta a UMA função «qual é a altura do chão aqui?»,
 * e o relevo entra pela resposta. O contrato mais importante (I1, plano = hoje): SEM CAMPO devolve EXATAMENTE `Y_SOLO_VISUAL`, o mesmo número de hoje, então com a chave `PARTIDA.relevo.visual`
 * desligada (ou enquanto a geração fatiada ainda não terminou) o jogo não muda de um pixel.
 *
 * ATENÇÃO: nem todo `−0,45` do código é o chão. As botas do herói (`IlhaRua.tsx`, `position={[-0.45, -0.55, 0.14]}`) são offsets LOCAIS do corpo, dentro de um grupo que já foi posto no lugar certo:
 * somar o terreno ali afundaria o herói. Só os pontos classificados como chão do mundo (categoria A/B de `medicoes/F2/classificacao-dos-pontos.md`) usam esta função.
 */

/**
 * A altura (Y do mundo) do chão desenhado em `(x, z)`: `Y_SOLO_VISUAL` mais a altura do campo. Sem campo, ou com `x`/`z` que não são números finitos, devolve EXATAMENTE `Y_SOLO_VISUAL`.
 *
 * Por que a entrada não finita é tratada AQUI e não por `alturaEm`: `alturaEm` prende `NaN` e infinitos ao CENTRO do quadrado (`dentro()` devolve 0), e o centro de um quadrado qualquer pode ter altura
 * diferente de zero. Um objeto com a posição corrompida apareceria elevado (medido em 24/11: dá 0 em (0,0) só porque a praça é plana). Um valor finito fora do quadrado prende na borda, como `alturaEm`:
 * um objeto na emenda entre dois quadrados não pula.
 */
export function alturaVisualDoChao(campo: ChaoDoDesenho | undefined, x: number, z: number): number {
  return Y_SOLO_VISUAL + desnivelDoChao(campo, x, z)
}

/**
 * O DESNÍVEL do relevo em `(x, z)`: a altura do campo ACIMA do plano de hoje, a ÚNICA conta (Task 4, 25/11/2026). Sem campo, ou com `x`/`z` que não são números finitos, é EXATAMENTE 0 (I1: o jogo
 * de hoje). Todo ponto de desenho que está no chão soma isto à altura que já tinha: `y_novo = y_de_hoje + desnivelDoChao(campo, x, z)`. Existe como função porque a expressão
 * `campo ? alturaVisualDoChao(campo, x, z) − Y_SOLO_VISUAL : 0` já aparecia copiada em 2 lugares e as obras a repetiriam: uma cópia é onde alguém esquece o `− Y_SOLO_VISUAL` e o chão sobe 0,45 m
 * num plano.
 */
export function desnivelDoChao(campo: ChaoDoDesenho | undefined, x: number, z: number): number {
  if (!campo || !Number.isFinite(x) || !Number.isFinite(z)) return 0
  // O CHÃO VISTO (a malha que o GPU desenha) e o campo CRU (a altura bilinear de hoje) são DOIS tipos: um `ChaoDaMalha` tem `campo` e `passo`, um `CampoRelevo` tem `alturas`. Quem produz o objeto escolhe qual chão
  // o desenho usa (F2, 26/11, decisão do usuário: amostrar a malha); os 44 pontos só repassam o que recebem.
  if ('passo' in campo) return desnivelDaMalha(campo, x, z)
  return alturaEm(campo, x, z)
}

/**
 * O desnível de quem REPOUSA NA ÁGUA (Task 4, 25/11/2026): o convés do píer e o que está sobre ele, a vitória-régia. A lâmina d'água desenhada é PLANA em `Y_AGUA_VISUAL` e só o TERRENO é escavado (o leito
 * vai a −1,3 m no centro de uma lagoa), então somar `desnivelDoChao` a quem boia o afundaria 0,5 a 1,3 m (medido nos 169 quadrados: 100 % dos píeres, 97 % das vitórias-régias e 95 % dos juncos). Dentro
 * de uma lagoa (a MESMA `emAguaRasa` que a regra e a água desenhada usam) o apoio é a LÂMINA, medida a partir do plano de hoje (`Y_AGUA_VISUAL − Y_SOLO_VISUAL`); se o chão ali estiver ACIMA dela (uma
 * ilhota), vale o maior dos dois. Fora de qualquer lagoa é o `desnivelDoChao`. Sem campo (ou `x`/`z` que não são números finitos) é EXATAMENTE 0 (I1).
 */
export function desnivelDoApoio(campo: ChaoDoDesenho | undefined, lagoas: readonly LagoaRasa[] | undefined, x: number, z: number): number {
  const chao = desnivelDoChao(campo, x, z)
  if (!campo || !lagoas || !emAguaRasa(lagoas, x, z, 0)) return chao
  return Math.max(chao, Y_AGUA_VISUAL - Y_SOLO_VISUAL)
}

/**
 * O desnível do GRUPO-PAI de uma fundação (Task 4, a água, 25/11/2026). Uma fundação decide o suporte por `classificarSuporteObra` (o centro E os 4 cantos da pegada: `'agua'` se o centro está na lagoa ou se
 * dois cantos estão); a altura tem de seguir ESSA decisão e não um ponto: com `desnivelDoApoio` no centro uma fundação de TERRA cujo centro cai por pouco na elipse subiria à lâmina, e um píer com o centro na
 * margem (mas dois cantos na água) ficaria no leito. `'agua'` é o apoio na lâmina (o maior entre o chão e a lâmina, para a ilhota); `'terra'` é o `desnivelDoChao`. Sem campo é 0 exato (I1); `'agua'` sem
 * lagoas não tem lâmina para repousar e cai no chão (a prop é opcional, como o `campo`).
 */
export function desnivelDaFundacao(
  suporte: TipoSuporteFundacao,
  campo: ChaoDoDesenho | undefined,
  lagoas: readonly LagoaRasa[] | undefined,
  x: number,
  z: number,
): number {
  const chao = desnivelDoChao(campo, x, z)
  if (suporte !== 'agua' || !campo || !lagoas) return chao
  return Math.max(chao, Y_AGUA_VISUAL - Y_SOLO_VISUAL)
}

/**
 * O desnível do GRUPO-PAI de uma OBRA inteira (Task 4, a água, 25/11/2026): a ÚNICA conta que a fundação, a malha da obra pequena (`ObraArquiteturaMesh`) e o fantasma (`GhostBlueprintObra`) chamam, porque
 * desenham o MESMO prédio e a altura tem de ser IDÊNTICA (senão o prédio flutua sobre o píer ou o afunda). Usa a pegada EFETIVA (`pegadaEfetivaFundacao`: um prédio Nv5 ou uma obra de blocos livres tem
 * pegada maior que a do tipo) e o suporte que `classificarSuporteObra` decide sobre ela, entregues a `desnivelDaFundacao`. Sem campo é 0 exato (I1); sem lagoas é o chão.
 */
export function desnivelDaObraNoChao(
  obra: Parameters<typeof pegadaEfetivaFundacao>[0],
  campo: ChaoDoDesenho | undefined,
  lagoas: readonly LagoaRasa[] | undefined,
): number {
  const pegada = pegadaEfetivaFundacao(obra)
  const suporte = lagoas ? classificarSuporteObra(lagoas, pegada.cx, pegada.cz, pegada.dim) : "terra"
  return desnivelDaFundacao(suporte, campo, lagoas, pegada.cx, pegada.cz)
}

/** Abaixo disto o herói está no SUBSOLO (a mina): a mesma regra do jogo (`alturaVisualRecurso`, `partidaSim`), estritamente menor. */
const LIMITE_DO_SUBSOLO = -0.9

/**
 * O chão de referência de quem está em `(x, z, y)`. Existe UMA função porque a mina tem um único chão: as galerias têm `x, z` até 9 m do centro, mas o piso delas é o do CENTRO (`subsoloCentro`).
 * Desenhar a mina com a altura do terreno do ponto onde o herói está faria o herói «flutuar» dentro dela (I9). Em subsolo (`y < −0,9`, estritamente; `NaN` não é subsolo) devolve o chão do centro da
 * mina; senão, o do ponto. Sem mina cavada (`subsoloCentro` null) cai no ponto: não explode.
 */
export function alturaDeReferencia(
  campo: ChaoDoDesenho | undefined,
  subsoloCentro: { readonly x: number; readonly z: number } | null,
  x: number,
  z: number,
  y: number,
): number {
  if (subsoloCentro && y < LIMITE_DO_SUBSOLO) return alturaVisualDoChao(campo, subsoloCentro.x, subsoloCentro.z)
  return alturaVisualDoChao(campo, x, z)
}
