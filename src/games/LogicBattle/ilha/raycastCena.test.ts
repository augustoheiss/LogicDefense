import { Mesh } from 'three'
import { raycastCondicional, semRaycast } from './raycastCena'

function assert(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem)
}

/**
 * F2-D7: «Editar blocos» desligava o clique de obras e tropas para sempre.
 *
 * O react-three-fiber ignora prop com valor `undefined` (`if (value === undefined) continue` em `applyProps`,
 * conferido no 9.6.1 instalado). Com `raycast={bloqueia ? semRaycast : undefined}`, o `semRaycast` era gravado
 * na malha ao entrar no modo e NUNCA saía: voltar a `undefined` não faz nada. A malha precisa receber, ao
 * voltar, a função de verdade (`Mesh.prototype.raycast`), que é um valor definido e por isso o R3F a grava.
 */
export function run() {
  assert(raycastCondicional(true) === semRaycast, 'F2-D7: bloqueando, a malha recebe a função que nunca acerta')
  assert(
    raycastCondicional(false) === Mesh.prototype.raycast,
    'F2-D7: liberando, a malha recebe a função de raycast do Mesh (e NÃO undefined, que o R3F ignora)',
  )
  assert(raycastCondicional(false) !== undefined, 'F2-D7: o valor de liberar tem de ser DEFINIDO: undefined o R3F não aplica')

  // O ciclo inteiro, como o R3F o aplica: grava só o que NÃO é undefined. Entra, sai, entra de novo.
  const malha = new Mesh()
  const original = malha.raycast
  const aplicar = (valor: unknown) => {
    if (valor === undefined) return // a regra do R3F que causou o defeito
    malha.raycast = valor as Mesh['raycast']
  }
  aplicar(raycastCondicional(true))
  assert(malha.raycast === semRaycast, 'F2-D7: no modo de edição a malha não é clicável')
  aplicar(raycastCondicional(false))
  assert(malha.raycast === original, 'F2-D7: ao sair do modo de edição a malha volta a ser clicável (o defeito deixava o semRaycast)')
  aplicar(raycastCondicional(true))
  aplicar(raycastCondicional(false))
  assert(malha.raycast === original, 'F2-D7: o ciclo pode repetir sem perder o clique')

  // Controle negativo: a forma ANTIGA, aplicada pela mesma regra do R3F, deixa a malha morta. Prova que o ciclo
  // acima distingue o defeito do conserto (um teste que passa nas duas formas não testa nada).
  const antiga = (bloqueia: boolean) => (bloqueia ? semRaycast : undefined)
  const morta = new Mesh()
  const aplicarMorta = (valor: unknown) => {
    if (valor === undefined) return
    morta.raycast = valor as Mesh['raycast']
  }
  aplicarMorta(antiga(true))
  aplicarMorta(antiga(false))
  assert(morta.raycast === semRaycast, 'controle: com `undefined` a malha FICA presa no semRaycast (era o defeito)')
}
