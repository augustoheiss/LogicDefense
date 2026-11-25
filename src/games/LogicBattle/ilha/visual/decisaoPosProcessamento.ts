import { NeutralToneMapping, type ToneMapping } from 'three'
import type { SpecQualidadeGrafica } from './qualidadeGrafica'

/**
 * A DECISÃO do pós-processamento (24/11/2026), separada do desenho: lógica PURA, testada no Node (`posProcessamento.test.ts`). O desenho (`PosProcessamento.tsx`) só obedece ao que sai daqui.
 *
 * Por que separar: o pior modo de falha do pós-processamento é a TELA PRETA. Um `useFrame` com prioridade positiva desliga o render automático do R3F para o Canvas inteiro; se o composer
 * falhar (contexto WebGL perdido, qualidade Leve, chave desligada) sem devolver o controle, ninguém desenha nada. A regra de «quando ligar» mora aqui, uma só vez, e é consultada a cada quadro.
 */

export interface ContextoDoComposer {
  /** `PARTIDA.posProcessamento`: a chave de rollback da fase. Desligada = o jogo de hoje. */
  readonly chaveLigada: boolean
  /** O `webglcontextlost` foi disparado: o composer não pode tocar em nada (os alvos de render morreram com o contexto). */
  readonly contextoPerdido: boolean
}

export interface ConfigDoComposer {
  readonly ativo: boolean
  readonly bloom: boolean
  readonly ao: boolean
  readonly msaa: 0 | 4
  /** Luminância HDR a partir da qual um pixel brilha. ≥ 1,1: só o que passa de 1,0 de verdade (lava, tocha, cristal, sol na água) dispara bloom; neve, tropas e texto ficam abaixo. */
  readonly bloomLimiar: number
  /** Força do bloom: sutil. Passar de 0,8 lava a imagem (o jogo é de estratégia e leitura matemática). */
  readonly bloomForca: number
  /** Raio do bloom em [0, 1]. */
  readonly bloomRaio: number
}

const DESLIGADO: ConfigDoComposer = { ativo: false, bloom: false, ao: false, msaa: 0, bloomLimiar: 1.1, bloomForca: 0, bloomRaio: 0 }

/**
 * O que o composer deve fazer neste quadro. Devolve SEMPRE `ativo: false` quando algo pede o render do R3F de volta: chave desligada, contexto perdido ou nível sem pós-processamento (o Leve).
 * O Bonito liga bloom e MSAA; o Ultra liga também a oclusão ambiente de tela.
 */
export function configDoComposer(spec: SpecQualidadeGrafica, contexto: ContextoDoComposer): ConfigDoComposer {
  if (!contexto.chaveLigada || contexto.contextoPerdido || !spec.posProcessamento) return DESLIGADO
  return {
    ativo: true,
    bloom: spec.bloom,
    ao: spec.ao,
    msaa: spec.msaa,
    bloomLimiar: 1.15,
    bloomForca: spec.ao ? 0.42 : 0.34,
    bloomRaio: 0.55,
  }
}

/** O bloom roda a METADE da resolução (o custo dele é o preenchimento de pixels e o resultado é borrado de qualquer jeito). Arredonda para cima e nunca devolve menos de 1 px. */
export function resolucaoDoBloom(largura: number, altura: number): { readonly largura: number; readonly altura: number } {
  const meio = (v: number) => (Number.isFinite(v) && v > 0 ? Math.max(1, Math.ceil(v / 2)) : 1)
  return { largura: meio(largura), altura: meio(altura) }
}

/**
 * A anisotropia que as texturas do chão devem usar: o pedido do spec (2×/8×/16×), LIMITADO ao que a GPU suporta (`renderer.capabilities.getMaxAnisotropy()`). Pedir mais que o máximo é inválido
 * no WebGL. O piso é 1 (sem anisotropia, o padrão do three) e um máximo desconhecido (0, NaN, negativo) cai em 1 em vez de quebrar. O jogo rodava com anisotropia 1 em tudo: o chão rasante
 * (a estrada vista de 3ª pessoa) borrava.
 */
export function anisotropiaEfetiva(spec: SpecQualidadeGrafica, maximoDaGpu: number): number {
  const maximo = Number.isFinite(maximoDaGpu) && maximoDaGpu >= 1 ? Math.floor(maximoDaGpu) : 1
  return Math.max(1, Math.min(spec.anisotropia, maximo))
}

/**
 * O MAPEAMENTO DE TOM do jogo: o Neutral (Khronos PBR Neutral). Decisão do USUÁRIO em 24/11/2026, depois de ver as fotos dos três candidatos na mesma cena (`master-plan/relevo-aoe/medicoes/F1/
 * tom-{aces,agx,neutral}-terceira.png`). O ACES de antes dessaturava (saturação do chão 0,349), o AgX ficou lavado e acinzentado (0,257) e o Neutral devolve a cor do material quase intacta (0,454),
 * que é o que o jogo de referência faz. É UMA constante só porque o tom aparece em dois lugares de `IlhaRua`: no Canvas (sem composer, cada material aplica o tom) e no `<PosProcessamento/>` (com
 * composer, só o `OutputPass` o aplica, uma vez, no fim). Se os dois divergissem, ligar o composer mudaria as cores do jogo inteiro sem aviso (contrato em `decisaoPosProcessamento.test.ts`).
 * A exposição (`toneMappingExposure: 1.06`) NÃO mudou: as fotos que o usuário aprovou foram tiradas com ela.
 */
export const TOM_DO_JOGO: ToneMapping = NeutralToneMapping
