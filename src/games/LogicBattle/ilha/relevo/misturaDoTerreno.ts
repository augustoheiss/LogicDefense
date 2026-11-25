import { RELEVO_REGRAS } from './campoRelevo'

/**
 * A MISTURA DO TERRENO (F2, Task 3, 25/11/2026): quanta ROCHA aparece em cada ponto. Lógica PURA (testada no Node em `misturaDoTerreno.test.ts`); o shader do terreno só a replica, de modo que o
 * limiar é um número testado, não um gosto.
 *
 * O desenho (D4, aprovado em 24/11: «alinhar a rocha exatamente aos limiares para leitura visual imediata»): a rocha COMEÇA onde deixa de dar para construir uma obra (declive
 * `RELEVO_REGRAS.declMaxObra`) e é TOTAL onde deixa de dar para andar (`declMaxAndar`). O jogador lê no chão o que a regra da F3 fará. Os limiares são IMPORTADOS de `RELEVO_REGRAS`: se o
 * UAT afinar D4, a cor acompanha.
 */

/** A componente `y` da normal de uma encosta de declive `d` (`d` = metros de subida por metro andado): `ny = 1 / √(1 + d²)`. */
export function nyDoDeclive(declive: number): number {
  return 1 / Math.sqrt(1 + declive * declive)
}

/** O `ny` em que a rocha COMEÇA a aparecer: o do declive em que deixa de dar para construir uma obra (0,35 → 0,9439). */
export const LIMIAR_ROCHA_COMECA = nyDoDeclive(RELEVO_REGRAS.declMaxObra)

/** O `ny` em que a rocha é TOTAL: o do declive em que deixa de dar para andar (0,75 → 0,8000). */
export const LIMIAR_ROCHA_TOTAL = nyDoDeclive(RELEVO_REGRAS.declMaxAndar)

/**
 * O peso da rocha em `[0, 1]` para uma normal de componente `y` = `ny`: 0 até `LIMIAR_ROCHA_COMECA`, 1 de `LIMIAR_ROCHA_TOTAL` em diante, e um smoothstep entre os dois (sem borda dura).
 * `NaN` vale «sem rocha» (um NaN no shader apagaria o pixel); `ny` fora de `[0, 1]` prende nas pontas.
 */
export function pesoDaRocha(ny: number): number {
  if (Number.isNaN(ny)) return 0
  if (ny >= LIMIAR_ROCHA_COMECA) return 0
  if (ny <= LIMIAR_ROCHA_TOTAL) return 1
  const t = (LIMIAR_ROCHA_COMECA - ny) / (LIMIAR_ROCHA_COMECA - LIMIAR_ROCHA_TOTAL)
  // smootherstep 6t⁵ − 15t⁴ + 10t³ (o `suave` de `ruidoRelevo.ts`, o mesmo das máscaras e emendas do relevo): derivada zero nas pontas, então a rocha nasce e termina sem quina. O shader do terreno
  // usa a MESMA expressão e `materialTerrenoRelevo.test.ts` compara as duas.
  return t * t * t * (t * (t * 6 - 15) + 10)
}
