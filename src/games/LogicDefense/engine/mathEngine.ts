import type { MathProblem } from '../types/game'

export function generateMathProblem(wave: number, waveOffset: number = 0): MathProblem {
  const effectiveWave = wave + waveOffset
  let operations: Array<'+' | '-' | 'x' | '÷'> = ['+', '-', 'x']
  if (effectiveWave % 10 === 0) operations = ['÷']

  const op = operations[Math.floor(Math.random() * operations.length)]
  const difficulty = Math.ceil(effectiveWave / 2)
  let n1: number, n2: number, answer: number

  if (op === '÷') {
    n2 = Math.floor(Math.random() * 10) + 2
    answer = Math.floor(Math.random() * (5 * difficulty)) + 5
    n1 = n2 * answer
  } else {
    n1 = Math.floor(Math.random() * (5 * difficulty)) + 2
    n2 = Math.floor(Math.random() * (5 * difficulty)) + 2
    if (op === '+') { answer = n1 + n2 }
    else if (op === '-') {
      if (n1 < n2) { const t = n1; n1 = n2; n2 = t }
      answer = n1 - n2
    } else {
      n1 = Math.floor(Math.random() * difficulty) + 1
      n2 = Math.floor(Math.random() * 10) + 1
      answer = n1 * n2
    }
  }

  return { n1, n2, op, answer }
}

export function buildQuestionText(problem: MathProblem): string {
  const { n1, n2, op } = problem
  if (op === '÷') return `CHEFE! ${n1} ÷ ${n2} = ?`
  return `${n1} ${op} ${n2} = ?`
}

export function generateOptions(answer: number): number[] {
  const options = [answer]
  while (options.length < 3) {
    const fake = answer + Math.floor(Math.random() * 10) - 5
    if (fake !== answer && fake >= 0 && !options.includes(fake)) options.push(fake)
  }
  return options.sort(() => Math.random() - 0.5)
}

function formatCascata(a: number, shift: number, op: '+' | '-'): string {
  if (shift === 0) return `${a}`
  if (shift < 10) return `${a} ${op} ${shift} = ${op === '+' ? a + shift : a - shift}`
  const res = op === '+' ? a + shift : a - shift
  const u = shift % 10
  const d = shift - u
  if (u === 0) return `${a} ${op} ${shift} = ${res}`
  const step1 = op === '+' ? a + u : a - u
  return `${a} ${op} ${shift} = ${step1} ${op} ${d} = ${res}`
}

export function generateTip(problem: MathProblem): string {
  const { n1, n2, op, answer } = problem
  let text = ''

  if (op === '+') {
    const u1 = n1 % 10, u2 = n2 % 10
    const d1 = Math.floor((n1 % 100) / 10), d2 = Math.floor((n2 % 100) / 10)
    const c1 = Math.floor(n1 / 100), c2 = Math.floor(n2 / 100)

    if (u1 + u2 < 10 && d1 + d2 < 10 && c1 + c2 < 10) {
      text = `Ataque Direto:<br>Bicho, a linha de frente ta pronta nesse aqui, só ir DIRETO, encaixar e dar um play. Pensa nos passos da reta numérica, não vamos dar passos grandes!<br><span class="tip-highlight">${n1} + ${n2} = ${answer}</span>.`
    } else {
      let temp1 = n1, temp2 = n2
      let shiftText = ''
      const tu1 = n1 % 100, tu2 = n2 % 100

      if (u1 === 0 || u2 === 0) {
        if ((tu1 >= 60 || tu2 >= 60) && (n1 >= 100 || n2 >= 100)) {
          const alvo = tu1 >= 60 ? n1 : n2
          const outro = tu1 >= 60 ? n2 : n1
          const shift = 100 - (alvo % 100)
          temp1 = alvo + shift; temp2 = outro - shift
          shiftText = `A Lei do Menor Esforço (Centenas):<br>O número ${alvo} está precisando de apenas ${shift} passos na reta numérica para fechar uma centena forte. Tiramos ${shift} do outro (<span class="tip-highlight">${formatCascata(outro, shift, '-')}</span>) e damos para ele.<br>Nova forma da massinha: <span class="tip-highlight">${temp1} + ${temp2}</span>.<br><br>`
        } else if ((tu1 >= 10 && tu1 <= 40) || (tu2 >= 10 && tu2 <= 40)) {
          const alvo = (tu1 >= 10 && tu1 <= 40) ? n1 : n2
          const outro = (tu1 >= 10 && tu1 <= 40) ? n2 : n1
          const shift = alvo % 100
          temp1 = alvo - shift; temp2 = outro + shift
          shiftText = `A Lei do Menor Esforço (Centenas):<br>O número ${alvo} está quebrado, damos ${shift} passos para trás para arredondar para baixo, e jogamos esse peso no outro (<span class="tip-highlight">${formatCascata(outro, shift, '+')}</span>).<br>Nova forma da massinha: <span class="tip-highlight">${temp1} + ${temp2}</span>.<br><br>`
        } else {
          shiftText = `Como um dos números já termina em zero perfeito, não precisamos fazer ajustes na massinha. Vamos direto pro ataque final!<br><br>`
        }
      } else {
        if (u1 >= 6 || u2 >= 6) {
          const alvo = u1 >= 6 ? n1 : n2
          const outro = u1 >= 6 ? n2 : n1
          const shift = 10 - (alvo % 10)
          temp1 = alvo + shift; temp2 = outro - shift
          shiftText = `A Lei do Menor Esforço (Finais 6 a 9):<br>O ${alvo} está a apenas ${shift} passos na reta numérica da próxima dezena. Arredondamos para cima virando ${temp1}, e tiramos os mesmos ${shift} passos do outro (<span class="tip-highlight">${formatCascata(outro, shift, '-')}</span>).<br>Nova forma da massinha: <span class="tip-highlight">${temp1} + ${temp2}</span>.<br><br>`
        } else if ((u1 >= 1 && u1 <= 4) || (u2 >= 1 && u2 <= 4)) {
          const alvo = (u1 >= 1 && u1 <= 4) ? n1 : n2
          const outro = (u1 >= 1 && u1 <= 4) ? n2 : n1
          const shift = alvo % 10
          temp1 = alvo - shift; temp2 = outro + shift
          shiftText = `A Lei do Menor Esforço (Finais 1 a 4):<br>Damos ${shift} passos para trás no ${alvo} para arredondar para baixo (vira ${temp1}), e andamos esses passos guardados somando no outro (<span class="tip-highlight">${formatCascata(outro, shift, '+')}</span>).<br>Nova forma da massinha: <span class="tip-highlight">${temp1} + ${temp2}</span>.<br><br>`
        }
      }

      const c1v = Math.floor(temp1 / 100) * 100, c2v = Math.floor(temp2 / 100) * 100
      const d1v = Math.floor((temp1 % 100) / 10) * 10, d2v = Math.floor((temp2 % 100) / 10) * 10
      const u1v = temp1 % 10, u2v = temp2 % 10
      let decompText = `Decomposição Final (Do Maior pro Menor):<br>`
      if (temp1 >= 100 || temp2 >= 100) decompText += `Centenas: <span class="tip-highlight">${c1v} + ${c2v} = ${c1v + c2v}</span><br>`
      decompText += `Dezenas: <span class="tip-highlight">${d1v} + ${d2v} = ${d1v + d2v}</span><br>`
      decompText += `Unidades: <span class="tip-highlight">${u1v} + ${u2v} = ${u1v + u2v}</span><br>`
      decompText += `Junta tudo: <span class="tip-highlight">${answer}</span>.`
      text = shiftText + decompText
    }
  } else if (op === '-') {
    const u1 = n1 % 10, u2 = n2 % 10
    const d1 = Math.floor((n1 % 100) / 10), d2 = Math.floor((n2 % 100) / 10)
    const c1 = Math.floor(n1 / 100), c2 = Math.floor(n2 / 100)

    if (u1 >= u2 && d1 >= d2 && c1 >= c2) {
      text = `Ataque Direto:<br>Bicho, esse aqui dá pra ir direto na linha de frente que ta fácil mete bala. Pensa nos passos da reta numérica, não vamos dar passos grandes!<br><span class="tip-highlight">${n1} - ${n2} = ${answer}</span>.`
    } else {
      let shift = 0, isAdding = true
      let alvoDesc = 'unidade'
      const tu2 = n2 % 100

      if (n2 >= 100 && tu2 !== 0 && tu2 > 10) {
        alvoDesc = 'dezena e unidade'
        if (tu2 >= 50) { shift = 100 - tu2; isAdding = true }
        else { shift = tu2; isAdding = false }
      } else {
        if (u2 !== 0) {
          if (u2 >= 5) { shift = 10 - u2; isAdding = true; alvoDesc = 'unidade' }
          else { shift = u2; isAdding = false; alvoDesc = 'unidade' }
        } else if (n2 >= 10 && n2 % 10 === 0) {
          const t2 = Math.floor((n2 % 100) / 10)
          if (t2 !== 0) {
            alvoDesc = 'dezena'
            if (t2 >= 5) { shift = 100 - (n2 % 100); isAdding = true }
            else { shift = n2 % 100; isAdding = false }
          }
        }
      }

      if (shift > 0) {
        const novoN1 = isAdding ? n1 + shift : n1 - shift
        const novoN2 = isAdding ? n2 + shift : n2 - shift
        const operacao = isAdding ? `Avançamos ${shift} passos` : `Voltamos ${shift} passos`
        const opSign: '+' | '-' = isAdding ? '+' : '-'
        text = `Hack Japonês (O Subtraendo é o Rei: ${n2}):<br>A regra é nunca pedir emprestado! Olhamos SÓ para o número de baixo: ${operacao} na reta numérica dos DOIS números para zerar a ${alvoDesc} dele.<br>O ${n1} acompanha: <span class="tip-highlight">${formatCascata(n1, shift, opSign)}</span>.<br>O ${n2} zera a ${alvoDesc}: <span class="tip-highlight">${formatCascata(n2, shift, opSign)}</span>.<br>A distância matemática se manteve intacta. O cálculo agora desce reto e sem dor!<br><span class="tip-highlight">${novoN1} - ${novoN2} = ${answer}</span>.`
      } else {
        text = `Hack Japonês:<br>O subtraendo (${n2}) já está redondo como uma pedra. A distância está perfeita, faça o cálculo direto sem medo de emprestar!<br><span class="tip-highlight">${n1} - ${n2} = ${answer}</span>.`
      }
    }
  } else if (op === 'x') {
    const diff = Math.abs(n1 - n2)
    const mid = Math.min(n1, n2) + diff / 2

    if (n1 === 10 || n2 === 10 || n1 === 100 || n2 === 100 || n1 === 1 || n2 === 1) {
      if (n1 === 1 || n2 === 1) {
        text = `A Regra Campeã (x1):<br>Se multiplicar por 1 é sempre ele mesmo, o elemento NEUTRO da multiplicação!<br>Resultado: <span class="tip-highlight">${answer}</span>.`
      } else {
        const isCem = n1 === 100 || n2 === 100
        const zeros = isCem ? 'dois 0s' : 'um 0'
        const mult = isCem ? '100' : '10'
        text = `A Regra Campeã (x${mult}):<br>Nosso campeão da multiplicação! Multiplicar por ${mult} é só potencializar a casa decimal para a direita, adicionando ${zeros}!<br>Resultado direto: <span class="tip-highlight">${answer}</span>.`
      }
    } else if (diff > 0 && diff % 2 === 0 && mid % 10 === 0) {
      const pass = diff / 2
      text = `A Diferença de Quadrados (A Geometria da Mente):<br>Ambos estão a ${pass} passos de distância do número ${mid}. Isso é (${mid} + ${pass}) x (${mid} - ${pass}).<br>Elevamos os dois ao quadrado e tiramos a diferença:<br><span class="tip-highlight">${mid}x${mid} - ${pass}x${pass}</span><br><span class="tip-highlight">${mid * mid} - ${pass * pass} = ${answer}</span>.`
    } else if (n1 >= 100 && n2 >= 100) {
      const c1 = Math.round(n1 / 100) * 100, c2 = Math.round(n2 / 100) * 100
      text = `Titãs Centenários:<br>Arredondamos as centenas! O ${n1} vira ${c1} e o ${n2} vira ${c2}.<br>Multiplicamos a base pesada: <span class="tip-highlight">${c1} x ${c2} = ${c1 * c2}</span>.<br>Depois ajustamos o que sobrou para chegar no <span class="tip-highlight">${answer}</span>.`
    } else if ((n1 === 5 && n2 > 5) || (n2 === 5 && n1 > 5)) {
      const tem5 = n1 === 5 ? n2 : n1
      text = `O Truque do 5:<br>Multiplicar por 5 = multiplicar por 10 e cortar na metade. Rápido e letal!<br><span class="tip-highlight">${tem5} x 10 = ${tem5 * 10}</span>.<br>A metade de ${tem5 * 10} é <span class="tip-highlight">${answer}</span>.`
    } else {
      const maior = Math.max(n1, n2), menor = Math.min(n1, n2)
      if (maior >= 10) {
        const c = Math.floor(maior / 100) * 100
        const d = Math.floor((maior % 100) / 10) * 10
        const u = maior % 10
        const baseRedonda = c > 0 ? (c + (d > 50 ? 100 : 0)) : (Math.floor(maior / 10) * 10 + (u >= 5 ? 10 : 0))
        const resto = maior - baseRedonda
        if (resto < 0) {
          const excesso = Math.abs(resto)
          text = `Estratégia do Excesso:<br>O ${maior} arredonda para ${baseRedonda}.<br><span class="tip-highlight">${baseRedonda} x ${menor} = ${baseRedonda * menor}</span>.<br>Cortamos o excesso: <span class="tip-highlight">${formatCascata(baseRedonda * menor, excesso * menor, '-')}</span>.`
        } else {
          text = `Decomposição Tática:<br>O ${maior} fica redondo no ${baseRedonda}.<br>Base: <span class="tip-highlight">${baseRedonda} x ${menor} = ${baseRedonda * menor}</span>.<br>Mais o resto: <span class="tip-highlight">${formatCascata(baseRedonda * menor, resto * menor, '+')}</span>.`
        }
      } else {
        text = `Ataque Direto:<br>Para esses números de unidade, a memória muscular fala mais alto.<br><span class="tip-highlight">${n1} x ${n2} = ${answer}</span>.`
      }
    }
  } else if (op === '÷') {
    let temp_n1 = n1, temp_n2 = n2
    let simplificou = false, stepStr = ''

    if (temp_n2 !== 10 && n1 % 2 === 0 && n2 % 2 === 0) {
      simplificou = true
      stepStr += `Corta no Meio (Simplificação):<br>Se ambos são pares, vá cortando pela metade sem dó:<br>`
      while (temp_n1 % 2 === 0 && temp_n2 % 2 === 0 && temp_n2 !== 10) {
        stepStr += `<span class="tip-highlight">${temp_n1} ÷ ${temp_n2}</span> ➔ <span class="tip-highlight">${temp_n1 / 2} ÷ ${temp_n2 / 2}</span><br>`
        temp_n1 /= 2; temp_n2 /= 2
        if (temp_n2 === 10) break
      }
    }

    if (temp_n2 === 10) {
      const prefix = simplificou ? stepStr + `<br>` : ''
      text = prefix + `A Majestade Decimal (÷10):<br>O 10 muda apenas a vírgula de lugar para a esquerda no <span class="tip-highlight">${temp_n1}</span>!<br>Resultado direto: <span class="tip-highlight">${answer}</span>.`
    } else if (temp_n2 === 1) {
      text = simplificou ? stepStr + `<br>Dividir por 1 é o próprio número: <span class="tip-highlight">${temp_n1}</span>.` : `Direto: <span class="tip-highlight">${n1}</span>.`
    } else if (temp_n1 <= temp_n2 * 10) {
      const prefix = simplificou ? stepStr + `<br>Ficou mais fácil! Inversão:<br>` : `Inversão:<br>`
      text = prefix + `Quantas vezes o <span class="tip-highlight">${temp_n2}</span> cabe em <span class="tip-highlight">${temp_n1}</span>?<br>Pense: ${temp_n2} x ? = ${temp_n1}.`
    } else {
      const prefix = simplificou ? stepStr + `<br>Ainda tá grande? Use a "Chave":<br>` : `A "Chave" (Abaixando um por um):<br>`
      const sN1 = temp_n1.toString()
      let chaveStr = '', curr = 0
      for (let i = 0; i < sN1.length; i++) {
        curr = curr * 10 + parseInt(sN1[i])
        if (curr < temp_n2 && i === 0) { chaveStr += `O ${curr} é menor que ${temp_n2}. Abaixa o próximo.<br>` }
        else if (curr < temp_n2) { chaveStr += `Abaixa o ${sN1[i]} -> fica ${curr}. Menor que ${temp_n2}, 0 no quoc.<br>` }
        else {
          const q = Math.floor(curr / temp_n2), rem = curr % temp_n2, sub = q * temp_n2
          chaveStr += `Abaixa o ${sN1[i]} -> fica <span class="tip-highlight">${curr}</span>. <span class="tip-highlight">${curr} - ${sub} = ${rem}</span> (quoc. ${q}).<br>`
          curr = rem
        }
      }
      chaveStr += `Resultado: <span class="tip-highlight">${answer}</span>.`
      text = prefix + chaveStr
    }
  }

  return text
}
