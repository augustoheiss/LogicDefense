import type { RecursoDescartavel } from './recursoGpuPool'

/**
 * O CICLO DE VIDA de um pacote de texturas que um criador gera e um CONSUMIDOR (em outro componente) usa (24/11/2026). Lógica PURA, testada no Node (`cicloDePacote.test.ts`).
 *
 * O DEFEITO QUE ISTO CORRIGE (medido evento a evento com `instrumentos/rastro-texturas.js`): em toda troca de qualidade que MUDA a resolução (256 ↔ 512), o `CenaBiomaVisual` gerava o pacote de
 * blocos novo e DESCARTAVA o antigo no cleanup do mesmo efeito que anunciava o novo. Só que o consumidor (`IlhaRua` → obras) só passa a usar o novo no commit SEGUINTE (o `setState` do pai):
 * naquele quadro as obras ainda apontavam para as texturas já descartadas e o three as REENVIAVA à GPU (12 texturas por troca, folga de exatamente 1 quadro). Como o dono já as tinha
 * descartado, NINGUÉM as descartava de novo: a GPU foi de 29 a 137 texturas em 4 voltas, sem platô (a cena usava 25).
 *
 * A REGRA: o pacote que SAI não pode ser descartado no passo em que o novo é ANUNCIADO. Fica RETIDO e só é descartado em `confirmar()` (o consumidor já commitou o novo) ou em `encerrar()`.
 * Teto: no máximo UM pacote retido além do atual. Se o consumidor nunca confirmar, o retido mais antigo é descartado ao chegar o próximo anúncio (um consumidor que falha não pode fazer o ciclo
 * acumular sem limite). Nada é descartado duas vezes, e o mesmo pacote anunciado duas vezes (re-render, StrictMode) segue em uso.
 */
export class CicloDePacote<T extends RecursoDescartavel> {
  private atual: T | null = null
  private retido: T | null = null

  /** O criador gerou `pacote` (pode ser `null`: a geração falhou). O que estava em uso passa a RETIDO, não descartado. */
  anunciar(pacote: T | null): void {
    if (pacote === this.atual) return
    // o teto: se já havia um retido que ninguém confirmou, ele sai agora (o consumidor já teve tempo de sobra; senão acumularia sem limite)
    if (this.retido) this.descartar(this.retido)
    this.retido = this.atual
    this.atual = pacote
  }

  /** O consumidor já usa o pacote anunciado por último: o retido não tem mais ninguém olhando e pode sair. */
  confirmar(): void {
    if (this.retido) this.descartar(this.retido)
    this.retido = null
  }

  /** O criador sai de cena (desmontou): descarta TUDO o que ainda estiver vivo, e o ciclo volta ao zero (pode ser reaproveitado, como o StrictMode faz). */
  encerrar(): void {
    const retido = this.retido
    const atual = this.atual
    // zera ANTES de descartar: o estado já não aponta para nada vivo quando o `dispose` roda (um `dispose` que lançasse não deixaria o ciclo com um pacote já morto como «atual»)
    this.retido = null
    this.atual = null
    if (retido && retido !== atual) retido.dispose()
    if (atual) atual.dispose()
  }

  /** Descarta um RETIDO. Um pacote que voltou a ser o atual (o criador reanunciou o mesmo) não é descartado como retido: só o que NÃO é o atual sai. */
  private descartar(pacote: T): void {
    if (pacote !== this.atual) pacote.dispose()
  }
}
