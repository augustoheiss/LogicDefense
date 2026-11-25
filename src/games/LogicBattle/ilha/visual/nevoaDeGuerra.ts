import { PARTIDA } from '../partidaPolicies'
import { CELULAS_DO_DISCO, chaoRevelado, cobertoAgora, type PartidaState } from '../partidaSim'

/**
 * A névoa de guerra PINTADA (24/11/2026): em vez de 12.769 colunas cinza (141.120 triângulos, 98,9 % da cena, medido), o chão ganha uma textura de 113×113 que o shader do terreno lê.
 * Este módulo é PURO e só decide, para cada célula do chão, em qual dos três estados ela está. O desenho (cor, bruma, borda orgânica) fica em `NevoaPintada.tsx`.
 *
 * REGRA DE OURO (I8a): a máscara NUNCA reimplementa a regra de visão. Ela chama `cobertoAgora` e `chaoRevelado`, as mesmas funções que a simulação usa para decidir o que o jogador vê, o que a
 * torre alcança e onde se pode construir. Duas cópias da regra um dia divergiriam, e o jogador veria na tela uma coisa e o jogo trataria outra.
 */

/** Células por lado: a MESMA grade do `chaoVisto`, do A* e do relevo (113 = 2·56 + 1). */
export const LADO_NEVOA = 113

/** Os três estados de uma célula: o valor é o que vai para a textura (e o shader lê a razão `valor / 255`). */
export const NEVOA = { nuncaVisto: 0, jaVisto: 128, visivelAgora: 255 } as const

/**
 * A máscara do estado atual: `LADO_NEVOA · LADO_NEVOA` bytes, indexada como `CELULAS_DO_DISCO[k].i` (o índice que o jogo usa em `chaoVisto`). Células fora do disco (se `PARTIDA.atlas`
 * deixar de ser «grade») ficam em `nuncaVisto`. Com `PARTIDA.nuvem` desligado o jogo inteiro é visível, e a máscara diz o mesmo.
 */
export function dadosDaNevoa(state: PartidaState): Uint8Array {
  const dados = new Uint8Array(LADO_NEVOA * LADO_NEVOA)
  if (!PARTIDA.nuvem) {
    dados.fill(NEVOA.visivelAgora)
    return dados
  }
  for (const celula of CELULAS_DO_DISCO) {
    dados[celula.i] = cobertoAgora(state, celula.x, celula.z)
      ? NEVOA.visivelAgora
      : chaoRevelado(state, celula.x, celula.z)
        ? NEVOA.jaVisto
        : NEVOA.nuncaVisto
  }
  return dados
}

/**
 * Aproxima `atual` de `alvo` em `dt` segundos, de modo que uma mudança completa (0 → 255) leve `tempoTransicao` segundos (padrão 0,35 s): a névoa não pisca ao ganhar ou perder visão, ela
 * se abre e se fecha. Escreve em `atual` e devolve se algo mudou (para o chamador só reenviar a textura à GPU quando preciso).
 *
 * Entrada inválida não faz nada: `dt` NaN, zero, negativo ou infinito deixa a máscara como está (uma aba em segundo plano ou um relógio estranho não pode «pular» a névoa nem corrompê-la).
 * Os vetores de tamanhos diferentes lançam erro: ler fora do vetor daria uma textura torta sem ninguém perceber.
 */
export function misturarNevoa(atual: Uint8Array, alvo: Uint8Array, dt: number, tempoTransicao = 0.35): boolean {
  if (atual.length !== alvo.length) throw new Error(`misturarNevoa: tamanhos diferentes (${atual.length} × ${alvo.length})`)
  if (!(dt > 0) || !Number.isFinite(dt) || !(tempoTransicao > 0)) return false
  // 255 bytes em `tempoTransicao` segundos: a velocidade é a mesma para clarear e para escurecer, e uma transição completa (0 ↔ 255) leva exatamente `tempoTransicao`.
  const passo = Math.min(255, (255 * dt) / tempoTransicao)
  let mudou = false
  for (let k = 0; k < atual.length; k += 1) {
    const a = atual[k]
    const b = alvo[k]
    if (a === b) continue
    const diferenca = b - a
    // Se o alvo está ao alcance do passo, vai exatamente a ele (nunca passa). Senão anda `passo`, arredondado para o byte, mas NUNCA menos de 1 byte: com `dt` minúsculo o passo é < 0,5 e
    // `Math.round` o zeraria, e a névoa congelaria no meio (medido no teste: parada em 0 por 200.000 passos com dt = 0,0002 s). Anda sempre na direção do alvo, então não oscila.
    const andar = Math.max(1, Math.round(passo))
    atual[k] = Math.abs(diferenca) <= andar ? b : a + Math.sign(diferenca) * andar
    mudou = true
  }
  return mudou
}
