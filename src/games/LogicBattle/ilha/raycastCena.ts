import { Mesh } from 'three'

/** Raycast que nunca acerta: a malha continua visível mas o clique atravessa. */
export const semRaycast = () => undefined

/**
 * O `raycast` de uma malha, conforme ela deva ou não receber clique agora.
 *
 * NUNCA devolve `undefined` para «liberar»: o react-three-fiber ignora prop com valor `undefined`
 * (`if (value === undefined) continue` em `applyProps`), então `raycast={bloqueia ? semRaycast : undefined}`
 * gravava o `semRaycast` na malha ao entrar no modo e jamais o tirava. Ao sair de «Editar blocos» as obras
 * Nv. 1–4, as tropas e o herói ficavam sem clique até recarregar a página (F2-D7). `Mesh.prototype.raycast`
 * é um valor definido, então o R3F o grava de volta.
 */
export function raycastCondicional(bloqueia: boolean): Mesh['raycast'] {
  return bloqueia ? (semRaycast as Mesh['raycast']) : Mesh.prototype.raycast
}
