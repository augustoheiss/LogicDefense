import type { CampoRelevo } from './campoRelevo'
import { terrenoBloqueiaLinha } from './regrasDoRelevo'

/**
 * Linha de visão sobre o relevo para fog of war (`marcarChao`, `dentroDaUniao`) na F3c.
 * Observador a 1,6 m acima do solo local e alvo a 0,9 m.
 */
export function temLinhaDeVisaoNoRelevo(
  campo: CampoRelevo | undefined,
  ox: number,
  oz: number,
  ax: number,
  az: number,
): boolean {
  if (!campo) return true
  return !terrenoBloqueiaLinha(campo, ox, oz, 1.6, ax, az, 0.9)
}
