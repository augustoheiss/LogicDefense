import { RELEVO_REGRAS } from './campoRelevo'
import { LIMIAR_ROCHA_COMECA, LIMIAR_ROCHA_TOTAL, nyDoDeclive, pesoDaRocha } from './misturaDoTerreno'

function assert(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem)
}

/**
 * A MISTURA DO TERRENO (F2, Task 3, 25/11/2026): quanta ROCHA aparece em cada ponto, em função do declive. É lógica PURA (o shader só a replica), para o limiar ser um número testado e não um gosto.
 *
 * O desenho (D4, aprovado em 24/11: «alinhar a rocha exatamente aos limiares para leitura visual imediata»): a rocha COMEÇA onde deixa de dar para construir uma obra (declive `declMaxObra`
 * = 0,35, `ny` = 0,9439) e é TOTAL onde deixa de dar para andar (declive `declMaxAndar` = 0,75, `ny` = 0,8000). O jogador lê no chão o que a regra da F3 fará. Os limiares são IMPORTADOS de
 * `RELEVO_REGRAS` (não copiados): se o UAT afinar D4, a cor acompanha.
 */
export function run(): void {
  // nyDoDeclive: ny = 1 / √(1 + d²), os números do plano (medidos em 25/11)
  assert(Math.abs(nyDoDeclive(0) - 1) < 1e-12, 'declive 0 (chão plano): ny = 1')
  assert(Math.abs(nyDoDeclive(0.18) - 0.9842) < 5e-5, `declive 0,18 (bloco): ny ≈ 0,9842 (veio ${nyDoDeclive(0.18)})`)
  assert(Math.abs(nyDoDeclive(0.35) - 0.9439) < 5e-5, `declive 0,35 (obra): ny ≈ 0,9439 (veio ${nyDoDeclive(0.35)})`)
  assert(Math.abs(nyDoDeclive(0.75) - 0.8) < 5e-5, `declive 0,75 (andar): ny ≈ 0,8000 (veio ${nyDoDeclive(0.75)})`)
  assert(nyDoDeclive(1.2) < nyDoDeclive(0.75) && nyDoDeclive(0.75) < nyDoDeclive(0.35), 'ny DECRESCE com o declive (uma encosta mais íngreme tem a normal mais deitada)')

  // os limiares vêm das regras aprovadas, não de números soltos
  assert(Math.abs(LIMIAR_ROCHA_COMECA - nyDoDeclive(RELEVO_REGRAS.declMaxObra)) < 1e-12, 'a rocha COMEÇA no declive da obra (RELEVO_REGRAS.declMaxObra)')
  assert(Math.abs(LIMIAR_ROCHA_TOTAL - nyDoDeclive(RELEVO_REGRAS.declMaxAndar)) < 1e-12, 'a rocha é TOTAL no declive de andar (RELEVO_REGRAS.declMaxAndar)')
  assert(LIMIAR_ROCHA_TOTAL < LIMIAR_ROCHA_COMECA, 'a rocha total acontece num ny MENOR (mais íngreme) que o começo')

  // pesoDaRocha(ny): 0 no plano e até o começo; 1 do total em diante; monótono e contínuo entre os dois
  assert(pesoDaRocha(1) === 0, 'chão plano (ny = 1): nenhuma rocha')
  assert(pesoDaRocha(LIMIAR_ROCHA_COMECA) === 0, 'exatamente no começo: ainda 0 (a mistura nasce SUAVE, sem salto)')
  assert(pesoDaRocha(LIMIAR_ROCHA_TOTAL) === 1, 'exatamente no total: 1')
  assert(pesoDaRocha(0) === 1 && pesoDaRocha(0.3) === 1, 'penhasco (ny pequeno): rocha total')
  assert(pesoDaRocha(0.9842) === 0, 'declive de bloco (0,18): ainda 0 (dá para construir bloco, é chão)')
  assert(pesoDaRocha(0.9439 + 1e-3) === 0, 'um pouco mais plano que o começo: 0')
  const meio = (LIMIAR_ROCHA_COMECA + LIMIAR_ROCHA_TOTAL) / 2
  assert(Math.abs(pesoDaRocha(meio) - 0.5) < 1e-9, `no meio da faixa o peso é 0,5 (a curva é simétrica; veio ${pesoDaRocha(meio)})`)
  // A CURVA é o SMOOTHERSTEP 6t⁵ − 15t⁴ + 10t³ (a do `suave` do relevo, derivada zero nas pontas), não o smoothstep 3t² − 2t³: os dois valem 0,5 no meio, então a simetria NÃO os distingue. Em t = 0,25
  // o smootherstep vale 0,10351563 e o smoothstep 0,15625 (diferença 0,053); em t = 0,75, 0,89648438 contra 0,84375. Valores calculados à mão em 25/11, não derivados do código.
  const nyEmT = (t: number): number => LIMIAR_ROCHA_COMECA - t * (LIMIAR_ROCHA_COMECA - LIMIAR_ROCHA_TOTAL)
  assert(Math.abs(pesoDaRocha(nyEmT(0.25)) - 0.10351563) < 1e-7, `em t = 0,25 o peso é 0,10351563 (smootherstep; o smoothstep daria 0,15625); veio ${pesoDaRocha(nyEmT(0.25))}`)
  assert(Math.abs(pesoDaRocha(nyEmT(0.75)) - 0.89648438) < 1e-7, `em t = 0,75 o peso é 0,89648438 (smootherstep; o smoothstep daria 0,84375); veio ${pesoDaRocha(nyEmT(0.75))}`)
  // derivada ZERO nas pontas: um passo minúsculo para dentro da faixa quase não muda o peso. Em t = 0,01 o smootherstep vale 9,85e-6 e o smoothstep 2,98e-4 (30× mais); em t = 0,99 falta 9,85e-6 para 1
  // (smoothstep: 2,98e-4). O limite 1e-4 separa as duas curvas. Valores calculados em 25/11.
  assert(pesoDaRocha(nyEmT(0.01)) < 1e-4 && 1 - pesoDaRocha(nyEmT(0.99)) < 1e-4, 'derivada zero nas pontas: em t = 0,01 e t = 0,99 o peso ainda está a menos de 1e-4 de 0 e de 1 (o smoothstep daria 2,98e-4)')
  assert(pesoDaRocha(nyEmT(0.01)) > 1e-6, 'controle do medidor: o peso em t = 0,01 NÃO é zero (9,85e-6): uma função que devolve 0 em toda a ponta não é um smootherstep')

  // monotonia e continuidade: varre ny de 1 a 0, em passos de 0,0005: o peso nunca DESCE, nunca salta mais que 0,05 entre vizinhos, e fica sempre em [0, 1]
  let anterior = pesoDaRocha(1)
  let saltoMaximo = 0
  for (let ny = 1; ny >= 0; ny -= 0.0005) {
    const p = pesoDaRocha(ny)
    assert(p >= 0 && p <= 1, `o peso (${p}) sai de [0, 1] em ny=${ny}`)
    assert(p >= anterior - 1e-12, `o peso DESCEU com a encosta mais íngreme: ny=${ny.toFixed(4)} peso=${p} antes=${anterior}`)
    saltoMaximo = Math.max(saltoMaximo, p - anterior)
    anterior = p
  }
  // O maior passo de um smootherstep é 1,875 · Δny / largura = 1,875 · 0,0005 / 0,14386 = 0,00652 (calculado em 25/11 e medido igual). Limites com folga dos dois lados: um DEGRAU daria ~1 (>> 0,052)
  // e um peso que nunca muda (função morta) daria 0 (< 0,0026); o valor real (0,0065) fica no meio.
  assert(saltoMaximo < 0.052, `o peso salta ${saltoMaximo.toFixed(4)} entre vizinhos (a mistura teria uma borda dura em vez de gradiente)`)
  assert(saltoMaximo > 0.0026, `controle do medidor: o gradiente EXISTE (o maior passo foi ${saltoMaximo.toFixed(5)}; uma função morta daria 0)`)

  // entradas ruins não propagam: NaN e ±∞ valem «sem rocha» (chão), nunca NaN no shader (um NaN apaga o pixel)
  for (const ruim of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    const p = pesoDaRocha(ruim)
    assert(Number.isFinite(p), `pesoDaRocha(${ruim}) tem de ser finito (veio ${p})`)
  }
  assert(pesoDaRocha(Number.NaN) === 0, 'NaN vira «sem rocha»')
  assert(pesoDaRocha(2) === 0 && pesoDaRocha(-1) === 1, 'ny fora de [0, 1]: 2 vira chão plano e −1 vira penhasco (prende, não extrapola)')

  // o DECLIVE e o ny são a mesma coisa vista de dois lados: ida e volta
  for (const d of [0, 0.1, 0.35, 0.5, 0.75, 1, 2, 5]) {
    const ny = nyDoDeclive(d)
    const volta = Math.sqrt(1 - ny * ny) / ny
    assert(Math.abs(volta - d) < 1e-9, `ida e volta do declive ${d}: voltou ${volta}`)
  }
}
