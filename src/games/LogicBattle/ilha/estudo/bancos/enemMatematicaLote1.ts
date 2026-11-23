/**
 * Lote 1 Curado de Questoes Oficiais do ENEM — Matematica (2º Dia, Caderno 5 Amarelo, 2019–2025).
 *
 * IMPORTANTE — ARQUITETURA & COMPLIANCE:
 *  1. Este modulo e carregado SOMENTE sob demanda via `import()` dinamico (code-splitting no Vite)
 *     para nao aumentar o bundle inicial do portal.
 *  2. Enunciados e alternativas oficiais sao preservados sem alteracao de valores nem opcoes,
 *     com citacao completa CC BY-ND 3.0 ao INEP/ENEM e zero textos literarios/charges de terceiros.
 *  3. Todas as 36 questoes abaixo (12 Grau 5 Hardcore, 12 Grau 6 Super Hardcore, 12 Grau 7 Especialista)
 *     foram extraidas dos PDFs originais, conferidas contra os gabaritos oficiais do INEP e passam
 *     pelo `validarDesafioZeroSpoiler` (dicas N1..N3 + diagnosticos errados sem revelar a resposta).
 */
import type {
  AlternativaUnificada,
  DesafioUnificado,
  DicaProgressiva,
  GrauDificuldade,
  TipoErroPedagogico,
} from '../contratosEstudo'
import { tituloDoTema } from '../contratosEstudo'

interface SpecEnemOficial {
  readonly ano: number
  readonly questao: number
  readonly grau: 5 | 6 | 7
  readonly temaId: string
  readonly correta: 'A' | 'B' | 'C' | 'D' | 'E'
  readonly enunciadoMarkdown: string
  readonly alternativas: Readonly<Record<'A' | 'B' | 'C' | 'D' | 'E', { readonly rotulo: string; readonly valorNumerico?: number; readonly diagnosticoPt: string; readonly tagErro?: TipoErroPedagogico }>>
  readonly dicas: readonly [string, string, string]
  readonly solucaoCompletaPt: string
  readonly dicaVidaRealPt: string
}

function construirDesafioEnem(s: SpecEnemOficial): DesafioUnificado {
  const letras = ['A', 'B', 'C', 'D', 'E'] as const
  const alts: AlternativaUnificada[] = letras.map((letra) => {
    const a = s.alternativas[letra]
    return {
      id: `enem_${s.ano}_q${s.questao}_${letra}`,
      letra,
      rotulo: a.rotulo,
      valorNumerico: a.valorNumerico,
      correta: letra === s.correta,
      diagnosticoPt: a.diagnosticoPt,
      tagErro: letra === s.correta ? undefined : a.tagErro ?? 'calculo_aritmetico',
    }
  })
  const dicas: readonly [DicaProgressiva, DicaProgressiva, DicaProgressiva] = [
    { nivel: 1, titulo: 'Foco & Leitura', textoPt: s.dicas[0] },
    { nivel: 2, titulo: 'Resumo de Boteco', textoPt: s.dicas[1] },
    { nivel: 3, titulo: 'Primeiro Passo & Armadilha', textoPt: s.dicas[2] },
  ]
  const id = `enem_${s.ano}_d2_c5_q${s.questao}`
  return {
    id,
    assinatura: id,
    origem: 'enem_oficial',
    grau: s.grau as GrauDificuldade,
    temaId: s.temaId,
    temaTituloPt: tituloDoTema(s.temaId),
    arquetipoOuItemId: id,
    referenciaOficial: {
      exame: 'ENEM',
      ano: s.ano,
      aplicacao: 'regular',
      dia: 2,
      caderno: '5_amarelo',
      questao: s.questao,
      licenca: 'CC-BY-ND-3.0',
      citacaoCurta: `ENEM ${s.ano} · 2º Dia · Caderno 5 Amarelo · Q.${s.questao} (INEP)`,
    },
    enunciadoMarkdown: s.enunciadoMarkdown,
    alternativas: alts,
    altarFisicoCompativel: false,
    dicas,
    posAcerto: {
      solucaoCompletaPt: s.solucaoCompletaPt,
      metodos: [{ selo: '📘 Resolução Comentada', resumo: s.solucaoCompletaPt }],
      dicaVidaRealPt: s.dicaVidaRealPt,
    },
  }
}

const SPECS_ENEM_MATEMATICA: readonly SpecEnemOficial[] = [
  // ===========================================================================
  // 🔥 GRAU 5 — HARDCORE (+64): 12 QUESTÕES OFICIAIS DO ENEM
  // ===========================================================================
  {
    ano: 2022,
    questao: 144,
    grau: 5,
    temaId: 'notacao_milhar',
    correta: 'E',
    enunciadoMarkdown:
      'Ao escutar a notícia de que um filme recém-lançado arrecadou, no primeiro mês de lançamento, R$ 1,35 bilhão em bilheteria, um estudante escreveu corretamente o número que representa essa quantia, com todos os seus algarismos.\n\nO número escrito pelo estudante foi',
    alternativas: {
      A: { rotulo: '135 000,00.', valorNumerico: 135000, diagnosticoPt: 'Você escreveu cento e trinta e cinco mil; faltaram casas de milhão e bilhão.', tagErro: 'unidade_escala' },
      B: { rotulo: '1 350 000,00.', valorNumerico: 1350000, diagnosticoPt: 'Isso representa pouco mais de 1 milhão, não 1 bilhão.', tagErro: 'unidade_escala' },
      C: { rotulo: '13 500 000,00.', valorNumerico: 13500000, diagnosticoPt: 'Faltam dois grupos de três zeros para alcançar a ordem dos bilhões.', tagErro: 'unidade_escala' },
      D: { rotulo: '135 000 000,00.', valorNumerico: 135000000, diagnosticoPt: 'Cento e trinta e cinco milhões é 10 vezes menor que 1,35 bilhão!', tagErro: 'unidade_escala' },
      E: { rotulo: '1 350 000 000,00.', valorNumerico: 1350000000, diagnosticoPt: 'Perfeito! 1 bilhão = 10⁹.' },
    },
    dicas: [
      'Conte quantos zeros tem 1 mil, 1 milhão e 1 bilhão na parte inteira (antes da vírgula dos centavos).',
      'Resumo de boteco: cada família sobe de 3 em 3 zeros! Mil tem 3 zeros, milhão tem 6 zeros, bilhão tem 9 zeros.',
      'Escreva 1,35 × 1.000.000.000 e ande a vírgula 9 casas para a direita. Armadilha: parar na casa dos milhões.',
    ],
    solucaoCompletaPt: '1 bilhão = 10⁹. Multiplicando 1,35 por 1 000 000 000 obtemos 1 350 000 000,00.',
    dicaVidaRealPt: 'Ler orçamentos públicos e notícias econômicas exige dominar a escala mil → milhão → bilhão.',
  },
  {
    ano: 2024,
    questao: 156,
    grau: 5,
    temaId: 'enem_funcoes_sequencias',
    correta: 'B',
    enunciadoMarkdown:
      'O uso de aplicativos de transporte tem sido uma alternativa à população que busca preços mais competitivos para se locomover, principalmente nas grandes cidades. As formas usadas para determinar o valor cobrado por cada viagem variam de um aplicativo para outro, mas, em geral, o valor $V$ a ser pago, em real, varia em função de:\n\n- tarifa base $F$: valor fixo, em real, cobrado no início da viagem;\n- tempo $T$: tempo, em minuto, de duração da viagem;\n- distância $D$: distância percorrida, em quilômetro.\n\nUm desses aplicativos cobra R$ 2,00 de valor fixo, acrescido de R$ 0,26 por minuto de viagem e de R$ 1,40 por quilômetro rodado.\n\nNessas condições, a expressão que fornece o valor $V$ a ser pago por uma viagem desse aplicativo é',
    alternativas: {
      A: { rotulo: '2,00F + 0,26T + 1,40D', diagnosticoPt: 'Como F já foi dado como R$ 2,00, ele não multiplica 2,00 — ele vale 2,00!', tagErro: 'leitura_interpretacao' },
      B: { rotulo: '2,00 + 0,26T + 1,40D', diagnosticoPt: 'Correto! Tarifa fixa somada às parcelas proporcionais de T e D.' },
      C: { rotulo: '2,00 + 0,26T + D', diagnosticoPt: 'Faltou multiplicar a distância D pelo preço por quilômetro (1,40).', tagErro: 'leitura_interpretacao' },
      D: { rotulo: '0,26T + 1,40D', diagnosticoPt: 'Esqueceu de somar o valor fixo da tarifa base (2,00).', tagErro: 'leitura_interpretacao' },
      E: { rotulo: 'F + T + D', diagnosticoPt: 'Essa expressão ignora os valores numéricos em reais por minuto e por km.', tagErro: 'leitura_interpretacao' },
    },
    dicas: [
      'Identifique o que é constante (valor fixo cobrado uma única vez) e o que varia conforme T e D.',
      'Resumo de boteco: valor fixo fica sozinho somando; "por minuto" multiplica T e "por quilômetro" multiplica D.',
      'Substitua F diretamente pelo valor numérico dado (2,00) sem multiplicar por F novamente!',
    ],
    solucaoCompletaPt: 'V = F + 0,26T + 1,40D, substituindo F = 2,00 resulta em 2,00 + 0,26T + 1,40D.',
    dicaVidaRealPt: 'Faturas de táxi, delivery e energia seguem o modelo taxa fixa + taxa por unidade consumida.',
  },
  {
    ano: 2023,
    questao: 171,
    grau: 5,
    temaId: 'enem_funcoes_sequencias',
    correta: 'D',
    enunciadoMarkdown:
      'Para concretar a laje de sua residência, uma pessoa contratou uma construtora. Tal empresa informa que o preço $y$ do concreto bombeado é composto de duas partes: uma fixa, chamada de taxa de bombeamento, e uma variável, que depende do volume $x$ de concreto utilizado. Sabe-se que a taxa de bombeamento custa R$ 500,00 e que o metro cúbico do concreto bombeado é de R$ 250,00.\n\nA expressão que representa o preço $y$ em função do volume $x$, em metro cúbico, é',
    alternativas: {
      A: { rotulo: 'y = 250x', diagnosticoPt: 'Faltou somar a taxa fixa de bombeamento de 500.', tagErro: 'leitura_interpretacao' },
      B: { rotulo: 'y = 500x', diagnosticoPt: 'Você multiplicou a taxa fixa pelo volume x e ignorou os 250 por m³.', tagErro: 'leitura_interpretacao' },
      C: { rotulo: 'y = 750x', diagnosticoPt: 'Taxa fixa não se soma com o preço unitário antes de multiplicar por x!', tagErro: 'sinal_precedencia' },
      D: { rotulo: 'y = 250x + 500', diagnosticoPt: 'Certo! Parte variável 250x + parte fixa 500.' },
      E: { rotulo: 'y = 500x + 250', diagnosticoPt: 'Você trocou os papéis do valor fixo com o valor variável por metro cúbico.', tagErro: 'leitura_interpretacao' },
    },
    dicas: [
      'Pergunte: qual valor o cliente paga uma única vez e qual valor cresce junto com o volume x?',
      'Resumo de boteco: na função y = ax + b, quem multiplica x é o preço por unidade; quem vem somando sozinho é a taxa fixa.',
      'Armadilha clássica: inverter quem multiplica x e quem fica fixo — confira quem depende de m³!',
    ],
    solucaoCompletaPt: 'O custo variável por m³ é 250·x e a taxa fixa é 500, logo y = 250x + 500.',
    dicaVidaRealPt: 'Orçamentos de obra sempre separam mobilização fixa do volume variável de material.',
  },
  {
    ano: 2023,
    questao: 161,
    grau: 5,
    temaId: 'enem_porcentagem_financeira',
    correta: 'A',
    enunciadoMarkdown:
      'Dirigir após ingerir bebidas alcoólicas é uma atitude extremamente perigosa, uma vez que, a partir da primeira dose, a pessoa já começa a ter perda de sensibilidade de movimentos e de reflexos. Apesar de a eliminação e absorção do álcool depender de cada pessoa e de como o organismo consegue metabolizar a substância, ao final da primeira hora após a ingestão, a concentração de álcool ($C$) no sangue corresponde a aproximadamente 90% da quantidade ($q$) de álcool ingerida, e a eliminação total dessa concentração pode demorar até 12 horas.\n\nNessas condições, ao final da primeira hora após a ingestão da quantidade $q$ de álcool, a concentração $C$ dessa substância no sangue é expressa algebricamente por',
    alternativas: {
      A: { rotulo: 'C = 0,9q', diagnosticoPt: 'Exato! 90% = 90/100 = 0,9 vezes q.' },
      B: { rotulo: 'C = 0,1q', diagnosticoPt: '0,1q representa 10% (o que foi eliminado), não os 90% que permanecem no sangue.', tagErro: 'leitura_interpretacao' },
      C: { rotulo: 'C = 1 − 0,1q', diagnosticoPt: 'Você subtraiu 10% de q do número 1 em vez de calcular 90% de q.', tagErro: 'porcentagem_base' },
      D: { rotulo: 'C = 1 − 0,9q', diagnosticoPt: 'Porcentagem de q multiplica q, não se subtrai de 1.', tagErro: 'porcentagem_base' },
      E: { rotulo: 'C = q − 10', diagnosticoPt: '90% de q é multiplicação por fração, não subtrair 10 unidades fixas.', tagErro: 'porcentagem_base' },
    },
    dicas: [
      'A expressão pede "90% DA quantidade q" ao final da primeira hora.',
      'Resumo de boteco: "de" na matemática vira multiplicação! Escreva 90/100 em decimal e multiplique por q.',
      'Não confunda "restam 90% de q" com "perdeu 10% de q" escrito sem multiplicar q, nem com tirar 10 de q.',
    ],
    solucaoCompletaPt: '90% de q equivale a (90/100)·q = 0,9q, portanto C = 0,9q.',
    dicaVidaRealPt: 'Converter porcentagens diretamente para multiplicadores decimais agiliza qualquer modelagem.',
  },
  {
    ano: 2025,
    questao: 166,
    grau: 5,
    temaId: 'enem_razoes_escalas',
    correta: 'D',
    enunciadoMarkdown:
      'O dono de uma sorveteria armazena sorvete em potes de $20\\ 000\\ \\text{cm}^3$. Ele serve o sorvete em taças, em porções de $250\\ \\text{mL}$.\n\nA quantidade de taças que ele consegue servir a partir de um pote cheio de sorvete é',
    alternativas: {
      A: { rotulo: '5.', valorNumerico: 5, diagnosticoPt: 'Você deslocou casas decimais a mais na conversão entre cm³ e mL.', tagErro: 'unidade_escala' },
      B: { rotulo: '8.', valorNumerico: 8, diagnosticoPt: 'Faltou um zero! Confira quanto dá dividir 20.000 por 250.', tagErro: 'calculo_aritmetico' },
      C: { rotulo: '50.', valorNumerico: 50, diagnosticoPt: 'Cada litro (1.000 mL) rende 4 taças de 250 mL; confira quantos litros cabem em 20.000 cm³.', tagErro: 'calculo_aritmetico' },
      D: { rotulo: '80.', valorNumerico: 80, diagnosticoPt: 'Certo! 1 cm³ = 1 mL, logo 20.000 ÷ 250 = 80 taças.' },
      E: { rotulo: '800.', valorNumerico: 800, diagnosticoPt: 'Sobrou um zero na divisão ou na conversão de unidades.', tagErro: 'unidade_escala' },
    },
    dicas: [
      'Antes de dividir, descubra a relação exata entre cm³ e mL (lembre que 1 litro = 1.000 cm³ = 1.000 mL).',
      'Resumo de boteco: 1 cm³ e 1 mL são exatamente a MESMA coisa (1:1)! Então é só dividir um volume pelo outro direto.',
      'Armadilha: multiplicar ou dividir por 10 achando que cm³ ≠ mL; corte os zeros na fração 20.000 / 250!',
    ],
    solucaoCompletaPt: 'Como 1 L = 1 dm³ = 1.000 cm³ = 1.000 mL, tem-se 1 cm³ = 1 mL. Logo 20.000 ÷ 250 = 80 taças.',
    dicaVidaRealPt: 'Saber de cor que 1 cm³ = 1 mL e 1 m³ = 1.000 L resolve metade das conversões de volume.',
  },
  {
    ano: 2025,
    questao: 153,
    grau: 5,
    temaId: 'leitura_dados_codigo',
    correta: 'D',
    enunciadoMarkdown:
      'Para acompanhar o fluxo de visitantes em seu prédio, uma empresa estabeleceu um código de identificação para a visitação. De acordo com a regra estabelecida, cada visitante será identificado com um código sequencial numérico com 7 dígitos, determinado, da esquerda para a direita, da seguinte forma:\n\n- o primeiro dígito indica o andar ao qual o visitante se dirige, que é um número de 1 a 4;\n- os dois próximos dígitos correspondem ao número do setor da empresa ao qual o visitante se destina. Esse número varia de 01 a 20;\n- os três dígitos seguintes correspondem ao número do funcionário da empresa com quem o visitante irá se reunir. Esse número varia de 001 a 135;\n- o último dígito indica se o visitante chegou à empresa pela manhã, dígito 0, ou à tarde, dígito 1.\n\nUm visitante chegou à empresa às 10 horas da manhã para se reunir com o funcionário identificado pelo número 109, que trabalha no setor 08 da empresa, localizado no 2º andar.\n\nO código de identificação desse visitante é',
    alternativas: {
      A: { rotulo: '0109082.', diagnosticoPt: 'Você inverteu a ordem dos blocos da esquerda para a direita!', tagErro: 'leitura_interpretacao' },
      B: { rotulo: '0281090.', diagnosticoPt: 'O 1º bloco (andar) tem apenas 1 dígito, e o setor usa 2 dígitos (08).', tagErro: 'leitura_interpretacao' },
      C: { rotulo: '1010982.', diagnosticoPt: 'Ordem e dígito de turno trocados; releia a sequência das 4 regras.', tagErro: 'leitura_interpretacao' },
      D: { rotulo: '2081090.', diagnosticoPt: 'Exato! 2 (andar) + 08 (setor) + 109 (func.) + 0 (manhã).' },
      E: { rotulo: '2810910.', diagnosticoPt: 'Faltou o zero à esquerda do setor (08) e o último dígito da manhã é 0.', tagErro: 'leitura_interpretacao' },
    },
    dicas: [
      'A ordem dada no enunciado é diferente da ordem em que o texto descreve o visitante: siga a ordem das 4 regras!',
      'Resumo de boteco: desenhe 7 tracinhos `_ | __ | ___ | _` e preencha bloco por bloco respeitando os zeros à esquerda.',
      'Armadilha: "10 horas da manhã" só diz que é manhã (dígito final 0) — o número 10 não entra no código!',
    ],
    solucaoCompletaPt: 'Andar (2º) = 2; Setor (08) = 08; Funcionário = 109; Manhã = 0 → código 2081090.',
    dicaVidaRealPt: 'Códigos padronizados (CEP, matrícula, barras) sempre exigem preencher cada campo com o tamanho fixo.',
  },
  {
    ano: 2025,
    questao: 138,
    grau: 5,
    temaId: 'enem_aritmetica_ciclos',
    correta: 'C',
    enunciadoMarkdown:
      'Uma distribuidora de combustível possui caminhões-tanque com capacidade de 30 000 litros cada. Em qualquer transporte realizado por esses caminhões, um mesmo volume de combustível é descartado, pois fica com muitas impurezas. Esse volume descartado independe da quantidade transportada.\n\nUm posto de combustível encomendou 10 000 litros de gasolina dessa distribuidora, que enviou 10 200 litros, considerando o volume descartado no transporte. Mesmo assim, a quantidade de gasolina entregue ao posto foi de 9 900 litros.\n\nEm um novo pedido, esse posto solicitou que fosse entregue exatamente o dobro do volume de gasolina encomendado no pedido anterior.\n\nUtilizando o mesmo caminhão da entrega anterior, qual é o volume mínimo de gasolina, em litro, que a distribuidora deverá enviar para garantir a entrega da quantidade encomendada nesse novo pedido?',
    alternativas: {
      A: { rotulo: '20 100', valorNumerico: 20100, diagnosticoPt: 'Se só faltaram 100 L antes porque já havia 200 L extras, então o descarte total real é 200 + 100, não só 100!', tagErro: 'leitura_interpretacao' },
      B: { rotulo: '20 200', valorNumerico: 20200, diagnosticoPt: '200 L extras não bastaram no 1º pedido (faltaram ainda 100 L)!', tagErro: 'leitura_interpretacao' },
      C: { rotulo: '20 300', valorNumerico: 20300, diagnosticoPt: 'Perfeito! Descarte real = 10.200 − 9.900 = 300 L fixos.' },
      D: { rotulo: '20 400', valorNumerico: 20400, diagnosticoPt: 'O volume descartado independe da carga — não dobra quando o pedido dobra!', tagErro: 'proporcao_invertida' },
      E: { rotulo: '20 600', valorNumerico: 20600, diagnosticoPt: 'Você dobrou o volume descartado, mas o enunciado diz que ele é fixo no caminhão.', tagErro: 'proporcao_invertida' },
    },
    dicas: [
      'Descubra primeiro quanto ficou retido no caminhão comparando o que SAIU da distribuidora (10.200) com o que CHEGOU ao posto (9.900).',
      'Resumo de boteco: essa perda no fundo do tanque é FIXA (não muda quando o pedido dobra!). Some essa perda fixa ao novo pedido.',
      'Armadilha dupla: usar 10.000 em vez de 10.200 para achar a perda, ou dobrar a perda quando o pedido dobra!',
    ],
    solucaoCompletaPt: 'Volume descartado fixo = 10.200 − 9.900 = 300 L. Novo pedido = 2 × 10.000 = 20.000 L. Enviar no mínimo 20.000 + 300 = 20.300 L.',
    dicaVidaRealPt: 'Separar perda fixa (tara/resíduo) de volume útil evita falta de entrega em logística.',
  },
  {
    ano: 2023,
    questao: 165,
    grau: 5,
    temaId: 'enem_estatistica_medias',
    correta: 'C',
    enunciadoMarkdown:
      'Os 100 funcionários de uma empresa estão distribuídos em dois setores: Produção e Administração. Os funcionários de um mesmo setor recebem salários com valores iguais. O quadro apresenta a quantidade de funcionários por setor e seus respectivos salários.\n\n| Setor | Quantidade de funcionários | Salário (em real) |\n| :--- | :---: | :---: |\n| Produção | 75 | 2 000,00 |\n| Administração | 25 | 7 000,00 |\n\nA média dos salários dos 100 funcionários dessa empresa, em real, é',
    alternativas: {
      A: { rotulo: '2 000,00.', valorNumerico: 2000, diagnosticoPt: 'Esse é o salário do setor Produção (moda), não a média ponderada geral.', tagErro: 'leitura_interpretacao' },
      B: { rotulo: '2 500,00.', valorNumerico: 2500, diagnosticoPt: 'Você ponderou os setores de forma incompleta ou dividiu errado.', tagErro: 'calculo_aritmetico' },
      C: { rotulo: '3 250,00.', valorNumerico: 3250, diagnosticoPt: 'Exato! Média ponderada pelos 75 e 25 funcionários.' },
      D: { rotulo: '4 500,00.', valorNumerico: 4500, diagnosticoPt: 'Armadilha da média simples: (2.000 + 7.000) ÷ 2 ignora que há 3× mais gente na Produção!', tagErro: 'proporcao_invertida' },
      E: { rotulo: '9 000,00.', valorNumerico: 9000, diagnosticoPt: 'Você apenas somou os dois salários sem dividir nem ponderar.', tagErro: 'calculo_aritmetico' },
    },
    dicas: [
      'Os dois setores têm o mesmo número de pessoas? Se não têm, a média NÃO pode ser (2.000 + 7.000) ÷ 2.',
      'Resumo de boteco: calcule a folha salarial TOTAL da empresa inteira (gente × salário) e divida pelos 100 funcionários — ou use pesos 0,75 e 0,25!',
      'Armadilha clássica de média ponderada: dividir por 2 esquecendo os pesos 75 e 25.',
    ],
    solucaoCompletaPt: 'Média = (75 × 2.000 + 25 × 7.000) ÷ 100 = (150.000 + 175.000) ÷ 100 = R$ 3.250,00.',
    dicaVidaRealPt: 'Sempre pondere grupos de tamanhos diferentes pelo número de pessoas antes de calcular médias.',
  },
  {
    ano: 2024,
    questao: 166,
    grau: 5,
    temaId: 'enem_aritmetica_ciclos',
    correta: 'A',
    enunciadoMarkdown:
      'Um artesão utiliza dois tipos de componentes, X e Y, nos enfeites que produz. Ele sempre compra todos os componentes em uma mesma loja. O quadro apresenta os preços dos dois tipos de componentes nas lojas I e II.\n\n| Lojas | Preço de X (R$) | Preço de Y (R$) |\n| :---: | :---: | :---: |\n| I | 3,00 | 1,00 |\n| II | 2,00 | 4,00 |\n\nEle confeccionará enfeites formados por **duas unidades do componente X e uma unidade do componente Y** e efetuará a compra na loja que oferecer o menor valor total para a confecção de um enfeite.\n\nO artesão efetuará a compra na loja',
    alternativas: {
      A: { rotulo: 'I, pois o valor é R$ 7,00.', valorNumerico: 7, diagnosticoPt: 'Certo! Loja I: 2×3 + 1×1 = R$ 7,00 contra R$ 8,00 na Loja II.' },
      B: { rotulo: 'I, pois o valor é R$ 4,00.', valorNumerico: 4, diagnosticoPt: 'Na loja I são 2 unidades de X + 1 de Y (não 1 + 1)!', tagErro: 'leitura_interpretacao' },
      C: { rotulo: 'II, pois o valor é R$ 6,00.', valorNumerico: 6, diagnosticoPt: 'Na loja II são 2 unidades de X (2×2 = 4) mais 1 de Y (4), totalizando 8, não 6!', tagErro: 'leitura_interpretacao' },
      D: { rotulo: 'I, pois anuncia o componente com o menor preço.', diagnosticoPt: 'Olhar só o item mais barato não basta; é preciso calcular a receita completa (2X + 1Y).', tagErro: 'leitura_interpretacao' },
      E: { rotulo: 'II, pois o componente X, que é o mais utilizado, tem menor preço.', diagnosticoPt: 'Mesmo com X mais barato na Loja II, Y pesa bastante; compare o valor total 2X + Y nas duas lojas.', tagErro: 'leitura_interpretacao' },
    },
    dicas: [
      'Atenção à receita de UM enfeite: quantos X e quantos Y vão nele?',
      'Resumo de boteco: calcule a conta fechada (2 × X + 1 × Y) na Loja I e na Loja II separadamente e compare os totais.',
      'Armadilha: somar apenas 1X + 1Y ou escolher só olhando o preço unitário mais baixo de um dos itens.',
    ],
    solucaoCompletaPt: 'Loja I: 2×3,00 + 1×1,00 = R$ 7,00. Loja II: 2×2,00 + 1×4,00 = R$ 8,00. Menor custo: Loja I (R$ 7,00).',
    dicaVidaRealPt: 'Comparar cestas completas de compra evita cair na isca de um único produto barato.',
  },
  {
    ano: 2022,
    questao: 168,
    grau: 5,
    temaId: 'enem_razoes_escalas',
    correta: 'D',
    enunciadoMarkdown:
      'Uma instituição de ensino superior ofereceu vagas em um processo seletivo de acesso a seus cursos. Finalizadas as inscrições, foi divulgada a relação do número de candidatos por vaga em cada um dos cursos oferecidos. Esses dados são apresentados no quadro.\n\n| Curso | Número de vagas oferecidas | Número de candidatos por vaga |\n| :--- | :---: | :---: |\n| Administração | 30 | 6 |\n| Ciências Contábeis | 40 | 6 |\n| Engenharia Elétrica | 50 | 7 |\n| História | 30 | 8 |\n| Letras | 25 | 4 |\n| Pedagogia | 25 | 5 |\n\nQual foi o número total de candidatos inscritos nesse processo seletivo?',
    alternativas: {
      A: { rotulo: '200', valorNumerico: 200, diagnosticoPt: '200 é apenas a soma das VAGAS oferecidas, não dos candidatos inscritos!', tagErro: 'leitura_interpretacao' },
      B: { rotulo: '400', valorNumerico: 400, diagnosticoPt: 'Confira a multiplicação vagas × concorrência curso por curso.', tagErro: 'calculo_aritmetico' },
      C: { rotulo: '1 200', valorNumerico: 1200, diagnosticoPt: 'Quase! Faltou somar algum curso ou houve erro na multiplicação de História/Pedagogia.', tagErro: 'calculo_aritmetico' },
      D: { rotulo: '1 235', valorNumerico: 1235, diagnosticoPt: 'Correto! Soma de (vagas × candidatos/vaga) nos 6 cursos.' },
      E: { rotulo: '7 200', valorNumerico: 7200, diagnosticoPt: 'Você somou todas as vagas e multiplicou pela soma das concorrências; cada curso tem sua própria taxa!', tagErro: 'sinal_precedencia' },
    },
    dicas: [
      'Se um curso tem 30 vagas e 6 candidatos POR vaga, quantos candidatos há só nesse curso?',
      'Resumo de boteco: multiplique vagas × concorrência EM CADA LINHA e só no final some os 6 resultados.',
      'Armadilha: somar toda a coluna de vagas (200) e multiplicar pela soma da coluna de concorrência (36)!',
    ],
    solucaoCompletaPt: '30×6 (180) + 40×6 (240) + 50×7 (350) + 30×8 (240) + 25×4 (100) + 25×5 (125) = 1.235 inscritos.',
    dicaVidaRealPt: 'Em taxas "por unidade", multiplique dentro de cada categoria antes de somar totais.',
  },
  {
    ano: 2024,
    questao: 167,
    grau: 5,
    temaId: 'enem_porcentagem_financeira',
    correta: 'B',
    enunciadoMarkdown:
      'João e Felipe participaram, na escola, de uma maratona de matemática na qual, durante uma semana, resolveram 200 questões cada. Nessa maratona, a porcentagem $P$ de acertos de cada participante é convertida em um conceito:\n\n- insatisfatório: se $0 \\le P < 50$;\n- regular: se $50 \\le P < 60$;\n- bom: se $60 \\le P < 75$;\n- muito bom: se $75 \\le P < 90$;\n- excelente: se $90 \\le P \\le 100$.\n\nJoão acertou 75% das questões da maratona e Felipe acertou **30% a menos que a quantidade de questões que João acertou**.\n\nOs conceitos de João e Felipe foram, respectivamente,',
    alternativas: {
      A: { rotulo: 'muito bom e bom.', diagnosticoPt: 'Se Felipe acertou 30% a menos DO QUE JOÃO acertou, ele ficou com 70% dos acertos de João (não 75% − 30%!). Confira quanto dá 70% de 75%.', tagErro: 'porcentagem_base' },
      B: { rotulo: 'muito bom e regular.', diagnosticoPt: 'Perfeito! João = 75% (150 q, muito bom) e Felipe = 105 q = 52,5% (regular).' },
      C: { rotulo: 'muito bom e insatisfatório.', diagnosticoPt: '45% (75 − 30) seria erro de subtrair pontos percentuais; 70% de 75% ainda passa de 50%!', tagErro: 'porcentagem_base' },
      D: { rotulo: 'bom e regular.', diagnosticoPt: 'Observe a desigualdade inclusiva em muito bom: 75 ≤ P < 90 inclui exatamente 75%!', tagErro: 'leitura_interpretacao' },
      E: { rotulo: 'bom e insatisfatório.', diagnosticoPt: 'Verifique os limites ≤ e < da faixa "muito bom" e calcule sobre a base de João.', tagErro: 'porcentagem_base' },
    },
    dicas: [
      'Atenção a duas coisas: o sinal ≤ em "75 ≤ P < 90" e a frase "30% a menos que a QUANTIDADE que João acertou".',
      'Resumo de boteco: ache quantas questões João acertou (75% de 200), tire 30% desse número para Felipe, e só então transforme os acertos de Felipe em % de 200!',
      'Armadilha clássica: fazer 75% − 30% = 45% direto, mudando a base sem perceber!',
    ],
    solucaoCompletaPt: 'João acertou 0,75×200 = 150 questões (75%, conceito muito bom). Felipe acertou 0,70×150 = 105 questões, que em 200 equivalem a 105/200 = 52,5% (conceito regular).',
    dicaVidaRealPt: 'Nunca subtraia porcentagens sem conferir se ambas estão sobre o mesmo total de referência.',
  },
  {
    ano: 2025,
    questao: 164,
    grau: 5,
    temaId: 'enem_razoes_escalas',
    correta: 'C',
    enunciadoMarkdown:
      'O cortisol é um hormônio produzido pelas glândulas adrenais e pode ser considerado um importante marcador do estresse fisiológico. Em um estudo desenvolvido com enfermeiros, foi verificado que a concentração de cortisol salivar em um dia de trabalho, denotada por $T$, era, em média, $1{,}59$ vezes a concentração de cortisol salivar em um dia de folga, denotada por $F$.\n\nNesse estudo, a relação obtida entre $T$ e $F$ foi',
    alternativas: {
      A: { rotulo: 'T = 1,59 + F', diagnosticoPt: '"1,59 vezes" indica multiplicação, não soma!', tagErro: 'leitura_interpretacao' },
      B: { rotulo: 'F = 1,59 + T', diagnosticoPt: 'Além de somar em vez de multiplicar, inverteu quem é 1,59 vezes maior.', tagErro: 'leitura_interpretacao' },
      C: { rotulo: 'T / F = 1,59', diagnosticoPt: 'Exato! T = 1,59·F implica T/F = 1,59.' },
      D: { rotulo: 'F / T = 1,59', diagnosticoPt: 'Você inverteu a razão: quem é maior (1,59× o outro) é T, não F!', tagErro: 'proporcao_invertida' },
      E: { rotulo: 'F · T = 1,59', diagnosticoPt: 'Se T = 1,59·F, ao passar F para o outro lado ele divide, não multiplica.', tagErro: 'sinal_precedencia' },
    },
    dicas: [
      'Escreva em português matemático a frase: "T era 1,59 vezes F".',
      'Resumo de boteco: teste com um número bobo! Se F = 10, então T = 15,9. Qual das 5 fórmulas funciona com F = 10 e T = 15,9?',
      'Armadilha: trocar a ordem da divisão para F/T na hora de isolar 1,59.',
    ],
    solucaoCompletaPt: 'T = 1,59·F. Dividindo ambos os lados por F, obtemos T / F = 1,59.',
    dicaVidaRealPt: 'Testar números fáceis (como 10) protege contra inversões algébricas em questões literais.',
  },

  // ===========================================================================
  // ⚡ GRAU 6 — SUPER HARDCORE (+128): 12 QUESTÕES OFICIAIS DO ENEM
  // ===========================================================================
  {
    ano: 2023,
    questao: 141,
    grau: 6,
    temaId: 'enem_aritmetica_ciclos',
    correta: 'C',
    enunciadoMarkdown:
      'O calendário maia apresenta duas contagens simultâneas de anos, o chamado ano Tzolkim, composto por 260 dias e que determinava o calendário religioso, e o ano Haab, composto por 365 dias e que determinava o calendário agrícola. Um historiador encontrou evidências de que gerações de uma mesma família governaram certa comunidade maia pelo período de 20 ciclos, sendo cada ciclo formado por 52 anos Haab.\n\nDe acordo com as informações fornecidas, durante quantos anos Tzolkim aquela comunidade maia foi governada por tal família?',
    alternativas: {
      A: { rotulo: '741', valorNumerico: 741, diagnosticoPt: 'Confira a razão correta de conversão: é total de dias Haab dividido por 260 dias/ano Tzolkim.', tagErro: 'calculo_aritmetico' },
      B: { rotulo: '1 040', valorNumerico: 1040, diagnosticoPt: '1.040 é apenas a quantidade de anos Haab (20 × 52); faltou converter de anos de 365 dias para anos de 260 dias!', tagErro: 'unidade_escala' },
      C: { rotulo: '1 460', valorNumerico: 1460, diagnosticoPt: 'Perfeito! (20 × 52 × 365) ÷ 260 simplifica 260 = 5 × 52!' },
      D: { rotulo: '2 100', valorNumerico: 2100, diagnosticoPt: 'Verifique a simplificação de 52 por 260 (= 1/5) e depois 365 ÷ 5.', tagErro: 'calculo_aritmetico' },
      E: { rotulo: '5 200', valorNumerico: 5200, diagnosticoPt: 'Você deixou de dividir pelo fator 5 ou confundiu os divisores.', tagErro: 'unidade_escala' },
    },
    dicas: [
      'Esqueça a história maia por 5 segundos: você tem uma duração total medida em anos de 365 dias e quer saber quantos anos de 260 dias cabem nesse mesmo total de dias.',
      'Resumo de boteco: ache o total de dias (ciclos × anos Haab por ciclo × 365) e divida pelo tamanho do ano Tzolkim (260).',
      'Antes de multiplicar contas gigantes, monte a fração (20 × 52 × 365) / 260 e simplifique 52 com 260! Armadilha: parar em 20 × 52 sem converter para Tzolkim.',
    ],
    solucaoCompletaPt: 'Total de dias = 20 × 52 × 365. Em anos Tzolkim: (20 × 52 × 365) ÷ 260. Como 260 ÷ 52 = 5, fica 20 × (365 ÷ 5) = 20 × 73 = 1.460.',
    dicaVidaRealPt: 'Simplificar fatores antes de multiplicar poupa minutos em provas sem calculadora.',
  },
  {
    ano: 2022,
    questao: 140,
    grau: 6,
    temaId: 'enem_porcentagem_financeira',
    correta: 'A',
    enunciadoMarkdown:
      'Em uma loja, o preço promocional de uma geladeira é de R$ 1 000,00 para pagamento somente em dinheiro. Seu preço normal, fora da promoção, é 10% maior. Para pagamento feito com o cartão de crédito da loja, é dado um desconto de 2% sobre o preço normal.\n\nUma cliente decidiu comprar essa geladeira, optando pelo pagamento com o cartão de crédito da loja. Ela calculou que o valor a ser pago seria o preço promocional acrescido de 8%. Ao ser informada pela loja do valor a pagar, segundo sua opção, percebeu uma diferença entre seu cálculo e o valor que lhe foi apresentado.\n\nO valor apresentado pela loja, comparado ao valor calculado pela cliente, foi',
    alternativas: {
      A: { rotulo: 'R$ 2,00 menor.', valorNumerico: 2, diagnosticoPt: 'Exato! Loja: 1.100 × 0,98 = 1.078 vs Cliente: 1.080 → R$ 2,00 menor.' },
      B: { rotulo: 'R$ 100,00 menor.', valorNumerico: 100, diagnosticoPt: 'O desconto de 2% incide sobre 1.100 (R$ 22), não é R$ 100.', tagErro: 'porcentagem_base' },
      C: { rotulo: 'R$ 200,00 menor.', valorNumerico: 200, diagnosticoPt: 'Verifique os valores absolutos de 2% de 1.100.', tagErro: 'calculo_aritmetico' },
      D: { rotulo: 'R$ 42,00 maior.', valorNumerico: 42, diagnosticoPt: 'Tirar 2% de um valor já aumentado em 10% resulta em MENOS que +8%, não mais!', tagErro: 'porcentagem_base' },
      E: { rotulo: 'R$ 80,00 maior.', valorNumerico: 80, diagnosticoPt: '80 reais é o valor total do acréscimo de 8% sobre 1.000, não a diferença entre loja e cliente.', tagErro: 'leitura_interpretacao' },
    },
    dicas: [
      'Calcule dois valores separados e depois subtraia: o preço real da loja e o valor estimado pela cliente.',
      'Resumo de boteco: 2% sobre o preço NORMAL (maior) tira mais dinheiro do que 2% sobre o preço promocional! Por isso o valor da loja sai um pouquinho menor.',
      'Armadilha: responder a diferença percentual sem multiplicar por R$ 1.000, ou achar que 10% − 2% = 8% exato.',
    ],
    solucaoCompletaPt: 'Preço normal = 1.000 × 1,10 = R$ 1.100. Loja (2% desc. sobre 1.100) = 1.100 − 22 = R$ 1.078. Cliente = 1.000 × 1,08 = R$ 1.080. Diferença: R$ 2,00 menor.',
    dicaVidaRealPt: 'Aumento de +a% seguido de desconto de −b% dá sempre menos que +(a−b)% porque o desconto incide sobre o valor maior.',
  },
  {
    ano: 2019,
    questao: 162,
    grau: 6,
    temaId: 'enem_razoes_escalas',
    correta: 'C',
    enunciadoMarkdown:
      'Comum em lançamentos de empreendimentos imobiliários, as maquetes de condomínios funcionam como uma ótima ferramenta de marketing para as construtoras, pois, além de encantar clientes, auxiliam de maneira significativa os corretores na negociação e venda de imóveis.\n\nUm condomínio está sendo lançado em um novo bairro de uma cidade. Na maquete projetada pela construtora, em escala de $1 : 200$, existe um reservatório de água com capacidade de $45\\ \\text{cm}^3$.\n\nQuando todas as famílias estiverem residindo no condomínio, a estimativa é que, por dia, sejam consumidos $30\\ 000$ litros de água.\n\nEm uma eventual falta de água, o reservatório cheio será suficiente para abastecer o condomínio por quantos dias?',
    alternativas: {
      A: { rotulo: '30', valorNumerico: 30, diagnosticoPt: 'Confira a divisão pelo consumo diário e o fator cúbico 200³.', tagErro: 'calculo_aritmetico' },
      B: { rotulo: '15', valorNumerico: 15, diagnosticoPt: 'Revise 360.000 ÷ 30.000.', tagErro: 'calculo_aritmetico' },
      C: { rotulo: '12', valorNumerico: 12, diagnosticoPt: 'Exato! 45 × 200³ cm³ = 360.000 L; 360.000 ÷ 30.000 = 12 dias.' },
      D: { rotulo: '6', valorNumerico: 6, diagnosticoPt: 'Confira a potência de 2³ no cálculo de 200³.', tagErro: 'unidade_escala' },
      E: { rotulo: '3', valorNumerico: 3, diagnosticoPt: 'Lembre-se que 2³ = 8 (e não 2) ao calcular 200³!', tagErro: 'unidade_escala' },
    },
    dicas: [
      'A escala 1 : 200 é linear, mas 45 cm³ é VOLUME! Quantas vezes um volume cresce quando todas as dimensões crescem 200 vezes?',
      'Resumo de boteco: escale ao cubo (200³ = 8.000.000) para achar os cm³ reais, depois divida por 1.000 para passar de cm³ para litros.',
      'Armadilha clássica: usar escala 200 ou 200² em volume, ou errar 1 L = 1.000 cm³.',
    ],
    solucaoCompletaPt: 'V_real = 45 × 200³ = 45 × 8.000.000 = 360.000.000 cm³ = 360.000 L. Dias = 360.000 ÷ 30.000 = 12 dias.',
    dicaVidaRealPt: 'Conversões de escala espacial exigem sempre expoente 1 (comprimento), 2 (área) ou 3 (volume).',
  },
  {
    ano: 2019,
    questao: 156,
    grau: 6,
    temaId: 'divisao_por_fracao',
    correta: 'B',
    enunciadoMarkdown:
      'Para contratar três máquinas que farão o reparo de vias rurais de um município, a prefeitura elaborou um edital que, entre outras cláusulas, previa:\n\n- Cada empresa interessada só pode cadastrar uma única máquina para concorrer ao edital;\n- O total de recursos destinados para contratar o conjunto das três máquinas é de R$ 31 000,00;\n- O valor a ser pago a cada empresa será **inversamente proporcional à idade de uso** da máquina cadastrada pela empresa para o presente edital.\n\nAs três empresas vencedoras do edital cadastraram máquinas com 2, 3 e 5 anos de idade de uso.\n\nQuanto receberá a empresa que cadastrou a máquina com maior idade de uso?',
    alternativas: {
      A: { rotulo: 'R$ 3 100,00', valorNumerico: 3100, diagnosticoPt: 'Você dividiu por 10 (soma 2+3+5) e não inverteu as idades em frações!', tagErro: 'proporcao_invertida' },
      B: { rotulo: 'R$ 6 000,00', valorNumerico: 6000, diagnosticoPt: 'Perfeito! Partes proporcionais a 1/2, 1/3, 1/5 = 15:10:6 (31 partes).' },
      C: { rotulo: 'R$ 6 200,00', valorNumerico: 6200, diagnosticoPt: 'Esse seria o valor proporcional DIRETO para a máquina de 2 anos (2/10 de 31.000)!', tagErro: 'proporcao_invertida' },
      D: { rotulo: 'R$ 15 000,00', valorNumerico: 15000, diagnosticoPt: 'R$ 15.000 é o que recebe a máquina MAIS NOVA (2 anos), não a de maior idade de uso!', tagErro: 'leitura_interpretacao' },
      E: { rotulo: 'R$ 15 500,00', valorNumerico: 15500, diagnosticoPt: 'Esse seria 5/10 do total (proporcional direto à de 5 anos).', tagErro: 'proporcao_invertida' },
    },
    dicas: [
      'Se o pagamento é INVERSAMENTE proporcional à idade, a máquina mais velha recebe menos e a mais nova recebe mais!',
      'Resumo de boteco: divisão inversamente proporcional a 2, 3 e 5 é a MESMA coisa que divisão diretamente proporcional a 1/2, 1/3 e 1/5! Coloque no mesmo denominador (MMC de 2, 3 e 5 = 30).',
      'Armadilha: entregar o valor da máquina mais nova (2 anos) quando a pergunta pede a de MAIOR idade de uso!',
    ],
    solucaoCompletaPt: '1/2 + 1/3 + 1/5 = (15 + 10 + 6)/30 = 31/30. Como o total é R$ 31.000, cada uma das 31 partes vale R$ 1.000. A de 5 anos fica com 6 partes = R$ 6.000,00.',
    dicaVidaRealPt: 'Divisão inversamente proporcional aparece em editais, prêmios por tempo menor e rateios por desempenho.',
  },
  {
    ano: 2022,
    questao: 137,
    grau: 6,
    temaId: 'enem_razoes_escalas',
    correta: 'B',
    enunciadoMarkdown:
      'Um borrifador de atuação automática libera, a cada acionamento, uma mesma quantidade de inseticida. O recipiente desse produto, quando cheio, contém 360 mL de inseticida, que duram 60 dias se o borrifador permanecer ligado ininterruptamente e for acionado a cada 48 minutos.\n\nA quantidade de inseticida que é liberada a cada acionamento do borrifador, em mililitro, é',
    alternativas: {
      A: { rotulo: '0,125.', valorNumerico: 0.125, diagnosticoPt: 'Confira o número de minutos em 1 dia (24 × 60 = 1.440) e divida por 48 minutos.', tagErro: 'calculo_aritmetico' },
      B: { rotulo: '0,200.', valorNumerico: 0.2, diagnosticoPt: 'Certo! 6 mL/dia ÷ 30 acionamentos/dia = 0,200 mL.' },
      C: { rotulo: '4,800.', valorNumerico: 4.8, diagnosticoPt: 'Você dividiu errado ou multiplicou 48 pelo volume em vez de contar quantos acionamentos cabem num dia.', tagErro: 'proporcao_invertida' },
      D: { rotulo: '6,000.', valorNumerico: 6, diagnosticoPt: '6 mL é o gasto POR DIA (360 ÷ 60), ainda falta dividir pelos acionamentos dentro de 1 dia!', tagErro: 'leitura_interpretacao' },
      E: { rotulo: '12,000.', valorNumerico: 12, diagnosticoPt: 'Confira a ordem da divisão: mL por dia dividido por acionamentos por dia.', tagErro: 'proporcao_invertida' },
    },
    dicas: [
      'Divida o problema em duas perguntas bem pequenas: quantos mL ele gasta por DIA? E quantas vezes ele dispara por DIA?',
      'Resumo de boteco: 1 dia tem 24 × 60 = 1.440 minutos. Veja quantos blocos de 48 minutos cabem num dia e divida o gasto diário por essa quantidade!',
      'Armadilha: parar em 360 ÷ 60 (que é o consumo diário, não o de 1 acionamento).',
    ],
    solucaoCompletaPt: 'Consumo diário = 360 ÷ 60 = 6 mL/dia. Acionamentos/dia = (24 × 60) ÷ 48 = 1.440 ÷ 48 = 30. Por acionamento: 6 ÷ 30 = 0,200 mL.',
    dicaVidaRealPt: 'Quebrar uma taxa composta em "por dia" simplifica muito problemas de autonomia.',
  },
  {
    ano: 2022,
    questao: 157,
    grau: 6,
    temaId: 'enem_probabilidade_contagem',
    correta: 'B',
    enunciadoMarkdown:
      'Uma montadora de automóveis divulgou que oferta a seus clientes mais de 1 000 configurações diferentes de carro, variando o modelo, a motorização, os opcionais e a cor do veículo. Atualmente, ela oferece 7 modelos de carros com 2 tipos de motores: 1.0 e 1.6. Já em relação aos opcionais, existem 3 escolhas possíveis: central multimídia, rodas de liga leve e bancos de couro, podendo o cliente optar por incluir um, dois, três ou nenhum dos opcionais disponíveis.\n\nPara ser fiel à divulgação feita, a quantidade mínima de cores que a montadora deverá disponibilizar a seus clientes é',
    alternativas: {
      A: { rotulo: '8.', valorNumerico: 8, diagnosticoPt: 'Você esqueceu a opção "nenhum opcional" (contou 7 subconjuntos em vez de 2³ = 8)!', tagErro: 'combinatoria_probabilidade' },
      B: { rotulo: '9.', valorNumerico: 9, diagnosticoPt: 'Exato! 7 × 2 × 2³ = 112 configurações por cor; 112 × 9 = 1.008 > 1.000.' },
      C: { rotulo: '11.', valorNumerico: 11, diagnosticoPt: 'Atenção: não são 3×4 ou soma de opcionais; cada opcional é sim/não (2³ = 8).', tagErro: 'combinatoria_probabilidade' },
      D: { rotulo: '18.', valorNumerico: 18, diagnosticoPt: 'Se fossem só 4 opções de opcionais (0,1,2,3 sem distinguir quais) daria 56 por cor e 18 cores — mas os 3 opcionais são distintos!', tagErro: 'combinatoria_probabilidade' },
      E: { rotulo: '24.', valorNumerico: 24, diagnosticoPt: 'Com 3 opcionais você usou apenas 3 escolhas (1,2 ou 3) sem contar combinações (2³ = 8).', tagErro: 'combinatoria_probabilidade' },
    },
    dicas: [
      'Atenção à frase: "um, dois, três ou NENHUM dos opcionais". Para cada opcional (multimídia, rodas, couro), você pode colocar ou não colocar!',
      'Resumo de boteco: cada um dos 3 opcionais tem 2 decisões (leva ou não leva), então são 2 × 2 × 2 = 8 pacotes possíveis de opcionais. Multiplique modelos × motores × pacotes × cores > 1.000.',
      'Armadilha clássica: contar os opcionais como "4 escolhas" (0, 1, 2 ou 3) em vez de 2³ = 8 combinações distintas!',
    ],
    solucaoCompletaPt: '7 modelos × 2 motores × 2³ opcionais = 112 configurações por cor. Como 112 × 8 = 896 < 1.000 e 112 × 9 = 1.008 > 1.000, são necessárias no mínimo 9 cores.',
    dicaVidaRealPt: 'Cada item independente do tipo "inclui ou não inclui" dobra o número de combinações (2ⁿ).',
  },
  {
    ano: 2022,
    questao: 159,
    grau: 6,
    temaId: 'divisao_euclidiana_resto',
    correta: 'C',
    enunciadoMarkdown:
      'Cada número que identifica uma agência bancária tem quatro dígitos: $N_1, N_2, N_3, N_4$ mais um dígito verificador $N_5$.\n\nTodos esses dígitos são números naturais pertencentes ao conjunto $\\{0, 1, 2, 3, 4, 5, 6, 7, 8, 9\\}$. Para a determinação de $N_5$, primeiramente multiplica-se ordenadamente os quatro primeiros dígitos do número da agência por 5, 4, 3 e 2, respectivamente, somam-se os resultados e obtém-se $S = 5N_1 + 4N_2 + 3N_3 + 2N_4$.\n\nPosteriormente, encontra-se o resto da divisão de $S$ por 11, denotando por $R$ esse resto. Dessa forma, $N_5$ é a diferença $11 - R$.\n\nConsidere o número de uma agência bancária cujos quatro primeiros dígitos são `0100`.\n\nQual é o dígito verificador $N_5$ dessa agência bancária?',
    alternativas: {
      A: { rotulo: '0', valorNumerico: 0, diagnosticoPt: 'O resto R da divisão de 4 por 11 não é zero — 4 não é múltiplo de 11!', tagErro: 'calculo_aritmetico' },
      B: { rotulo: '6', valorNumerico: 6, diagnosticoPt: 'Você calculou 10 − R ou usou peso 5 em N₂!', tagErro: 'calculo_aritmetico' },
      C: { rotulo: '7', valorNumerico: 7, diagnosticoPt: 'Certo! S = 4; resto de 4 ÷ 11 é 4; 11 − 4 = 7.' },
      D: { rotulo: '8', valorNumerico: 8, diagnosticoPt: 'Você multiplicou N₂ por 3 em vez de 4!', tagErro: 'leitura_interpretacao' },
      E: { rotulo: '9', valorNumerico: 9, diagnosticoPt: 'Verifique a posição do dígito 1 em 0100: ele é N₂ (peso 4), não N₄ (peso 2).', tagErro: 'leitura_interpretacao' },
    },
    dicas: [
      'Associe cada algarismo de `0100` a N₁, N₂, N₃ e N₄, na ordem da esquerda para a direita.',
      'Resumo de boteco: quando o dividendo S é MENOR que 11, o resto da divisão de S por 11 é o próprio S!',
      'Calcule S = 5(0) + 4(1) + 3(0) + 2(0) e lembre que N₅ = 11 − R (não pare no R!).',
    ],
    solucaoCompletaPt: 'Para 0100 temos N₁=0, N₂=1, N₃=0, N₄=0. S = 5·0 + 4·1 + 3·0 + 2·0 = 4. Resto de 4 ÷ 11 é R = 4. Logo N₅ = 11 − 4 = 7.',
    dicaVidaRealPt: 'Dígitos verificadores de CPF, RG, contas bancárias e códigos de barras usam exatamente somas ponderadas módulo 10 ou 11.',
  },
  {
    ano: 2022,
    questao: 167,
    grau: 6,
    temaId: 'enem_geometria_medidas',
    correta: 'B',
    enunciadoMarkdown:
      'Um casal planeja construir em sua chácara uma piscina com o formato de um paralelepípedo reto retângulo com capacidade para 90 000 L de água. O casal contratou uma empresa de construções que apresentou cinco projetos com diferentes combinações nas dimensões internas de profundidade, largura e comprimento. A piscina a ser construída terá revestimento interno em suas paredes e fundo com uma mesma cerâmica, e o casal irá escolher o projeto que exija a menor área de revestimento.\n\nAs dimensões internas de profundidade, largura e comprimento, respectivamente, para cada um dos projetos, são:\n\n- projeto I: 1,8 m, 2,0 m e 25,0 m;\n- projeto II: 2,0 m, 5,0 m e 9,0 m;\n- projeto III: 1,0 m, 6,0 m e 15,0 m;\n- projeto IV: 1,5 m, 15,0 m e 4,0 m;\n- projeto V: 2,5 m, 3,0 m e 12,0 m.\n\nO projeto que o casal deverá escolher será o',
    alternativas: {
      A: { rotulo: 'I.', diagnosticoPt: 'Piscina muito comprida e estreita (2×25) gera muita área de parede lateral!', tagErro: 'formula_geometria' },
      B: { rotulo: 'II.', diagnosticoPt: 'Correto! 5×9 + 2×(2×5 + 2×9) = 45 + 56 = 101 m² (menor área).' },
      C: { rotulo: 'III.', diagnosticoPt: 'Fundo gigante de 6×15 já consome 90 m² só no piso + 42 m² de paredes!', tagErro: 'formula_geometria' },
      D: { rotulo: 'IV.', diagnosticoPt: 'Fundo 15×4 + paredes dá 117 m² — maior que a opção mais equilibrada.', tagErro: 'formula_geometria' },
      E: { rotulo: 'V.', diagnosticoPt: 'Calcule o fundo (larg × comp) + 4 paredes (2·prof·larg + 2·prof·comp); dá 111 m².', tagErro: 'formula_geometria' },
    },
    dicas: [
      'Todos os 5 projetos já têm o mesmo volume (90 m³ = 90.000 L). O que você precisa minimizar é a área das 4 paredes + o fundo (SEM tampa!).',
      'Resumo de boteco: área a azulejar = (largura × comprimento) + 2×profundidade×(largura + comprimento). Quanto mais "cúbica/quadrada" a piscina, menos parede ela gasta!',
      'Armadilha clássica: incluir o teto da piscina na conta (multiplicar o fundo por 2)! Piscina aberta tem só 1 fundo.',
    ],
    solucaoCompletaPt: 'Áreas: I = 50 + 97,2 = 147,2 m²; II = 45 + 56 = 101 m²; III = 90 + 42 = 132 m²; IV = 60 + 57 = 117 m²; V = 36 + 75 = 111 m². Menor área: Projeto II.',
    dicaVidaRealPt: 'Embalagens e caixas com formato próximo do cubo economizam material para o mesmo volume.',
  },
  {
    ano: 2024,
    questao: 160,
    grau: 6,
    temaId: 'enem_funcoes_sequencias',
    correta: 'C',
    enunciadoMarkdown:
      'Uma doceira vende e entrega, em seu bairro, porções de 100 g de docinhos de aniversário. Atualmente, a taxa única de entrega é R$ 10,00, e o valor cobrado por uma porção é R$ 25,00. Por uma estratégia de vendas, a partir da próxima semana, a taxa única de entrega será R$ 15,00, e um novo valor será cobrado por uma porção, de maneira que o valor total a ser pago por um cliente na compra de 5 porções permaneça o mesmo.\n\nA partir da próxima semana, qual será o novo valor cobrado, em real, por uma porção?',
    alternativas: {
      A: { rotulo: '12,50', valorNumerico: 12.5, diagnosticoPt: 'Você errou a divisão do desconto total pelas 5 porções.', tagErro: 'calculo_aritmetico' },
      B: { rotulo: '20,00', valorNumerico: 20, diagnosticoPt: 'Você tirou os R$ 5,00 extras da entrega de CADA porção (R$ 25 − R$ 5)! Isso baixaria a conta total em R$ 20!', tagErro: 'leitura_interpretacao' },
      C: { rotulo: '24,00', valorNumerico: 24, diagnosticoPt: 'Perfeito! Entrega subiu R$ 5; diluído em 5 porções, cada uma cai R$ 1.' },
      D: { rotulo: '30,00', valorNumerico: 30, diagnosticoPt: 'Se a taxa de entrega subiu, o preço da porção precisa CAIR para manter o total igual!', tagErro: 'sinal_precedencia' },
      E: { rotulo: '37,50', valorNumerico: 37.5, diagnosticoPt: 'A soma total permaneceria a mesma; aumentar a porção sobe o total.', tagErro: 'sinal_precedencia' },
    },
    dicas: [
      'A taxa de entrega subiu quanto em reais? Como manter o mesmo preço final para quem compra 5 porções?',
      'Resumo de boteco: se a entrega ficou R$ 5 mais cara, basta tirar R$ 5 espalhados pelas 5 porções! Ou calcule o total antigo (10 + 5×25), tire a nova entrega (15) e divida por 5.',
      'Armadilha clássica: tirar os R$ 5 inteiros de UMA porção achando que cada porção cai R$ 5.',
    ],
    solucaoCompletaPt: 'Total atual para 5 porções: 10 + 5×25 = R$ 135. Novo preço p: 15 + 5p = 135 ⇒ 5p = 120 ⇒ p = R$ 24,00.',
    dicaVidaRealPt: 'Diluir acréscimo de frete no preço unitário de um combo é conta direta de equação de 1º grau.',
  },
  {
    ano: 2024,
    questao: 172,
    grau: 6,
    temaId: 'enem_geometria_medidas',
    correta: 'D',
    enunciadoMarkdown:
      'O estádio do Maracanã passou por algumas modificações estruturais para a realização da Copa do Mundo de 2014, como, por exemplo, as dimensões do campo retangular. Para se adaptar aos padrões da Fifa, as dimensões do campo foram reduzidas de $110\\text{ m} \\times 75\\text{ m}$ para $105\\text{ m} \\times 68\\text{ m}$.\n\nEm quantos metros quadrados a área do campo do Maracanã foi reduzida?',
    alternativas: {
      A: { rotulo: '24', valorNumerico: 24, diagnosticoPt: 'Você somou ou multiplicou apenas as reduções isoladas dos lados (5 e 7) em vez de comparar as duas áreas completas!', tagErro: 'formula_geometria' },
      B: { rotulo: '35', valorNumerico: 35, diagnosticoPt: '35 m² é apenas o cantinho 5×7 que foi cortado nos dois lados juntos — faltaram as duas faixas laterais inteiras!', tagErro: 'formula_geometria' },
      C: { rotulo: '555', valorNumerico: 555, diagnosticoPt: 'Confira a multiplicação 110×75 e 105×68.', tagErro: 'calculo_aritmetico' },
      D: { rotulo: '1 110', valorNumerico: 1110, diagnosticoPt: 'Exato! 8.250 − 7.140 = 1.110 m².' },
      E: { rotulo: '1 145', valorNumerico: 1145, diagnosticoPt: 'Você somou duas vezes o cantinho da esquina (5×7 = 35)!', tagErro: 'formula_geometria' },
    },
    dicas: [
      'A redução NÃO é simplesmente (110 − 105) × (75 − 68)! Desenhe o retângulo maior e tire o retângulo menor de dentro.',
      'Resumo de boteco: calcule a área antiga (110 × 75), calcule a área nova (105 × 68) e faça uma menos a outra!',
      'Armadilha clássica: multiplicar as diferenças dos lados (5 × 7 = 35) ignorando que a faixa tirada percorre todo o comprimento e toda a largura.',
    ],
    solucaoCompletaPt: 'Área antiga = 110 × 75 = 8.250 m². Área nova = 105 × 68 = 7.140 m². Redução = 8.250 − 7.140 = 1.110 m².',
    dicaVidaRealPt: 'Quando os dois lados de um retângulo diminuem, a perda de área envolve as duas faixas inteiras.',
  },
  {
    ano: 2025,
    questao: 152,
    grau: 6,
    temaId: 'enem_razoes_escalas',
    correta: 'D',
    enunciadoMarkdown:
      'Uma fábrica de tijolos ecológicos com 3 funcionários, cada um trabalhando 6 horas diárias, produz 720 unidades por dia. Para atender ao crescimento da demanda por esse tipo de tijolo, essa fábrica passou a ter 5 funcionários, cada um trabalhando 9 horas por dia, aumentando, assim, sua capacidade de produção. Todos os funcionários produzem igual quantidade de tijolos a cada hora, independentemente de trabalharem 6 ou 9 horas diárias.\n\nO número de tijolos fabricados diariamente após o aumento da capacidade de produção é',
    alternativas: {
      A: { rotulo: '800.', valorNumerico: 800, diagnosticoPt: 'Você escalou apenas os funcionários (5/3) e esqueceu do aumento na carga horária (de 6 h para 9 h), ou inverteu uma razão.', tagErro: 'proporcao_invertida' },
      B: { rotulo: '1 080.', valorNumerico: 1080, diagnosticoPt: '1.080 considera apenas o aumento de horas (× 9/6), mantendo só 3 funcionários!', tagErro: 'leitura_interpretacao' },
      C: { rotulo: '1 200.', valorNumerico: 1200, diagnosticoPt: '1.200 considera apenas o aumento de funcionários (× 5/3), mantendo 6 horas por dia!', tagErro: 'leitura_interpretacao' },
      D: { rotulo: '1 800.', valorNumerico: 1800, diagnosticoPt: 'Perfeito! 40 tijolos/homem-hora × (5 × 9 = 45 homem-horas) = 1.800.' },
      E: { rotulo: '2 520.', valorNumerico: 2520, diagnosticoPt: 'Você somou as novas unidades às antigas em vez de recalcular a capacidade nova.', tagErro: 'calculo_aritmetico' },
    },
    dicas: [
      'A produção total depende de duas coisas ao mesmo tempo: quantos funcionários E quantas horas cada um trabalha.',
      'Resumo de boteco: multiplique funcionários × horas para achar o total de "horas trabalhadas da equipe" (antes: 3 × 6 = 18 horas-homem). Descubra quantos tijolos saem por hora-homem e multiplique pelas novas horas-homem!',
      'Armadilha: atualizar só o número de funcionários OU só o número de horas.',
    ],
    solucaoCompletaPt: 'Antes: 3 × 6 = 18 horas-homem fazem 720 tijolos ⇒ 40 tijolos por hora-homem. Depois: 5 × 9 = 45 horas-homem ⇒ 45 × 40 = 1.800 tijolos/dia.',
    dicaVidaRealPt: 'Medir produtividade em "unidades por homem-hora" resolve qualquer regra de três composta sem decoreba.',
  },
  {
    ano: 2025,
    questao: 180,
    grau: 6,
    temaId: 'enem_razoes_escalas',
    correta: 'C',
    enunciadoMarkdown:
      'A final de um campeonato de futebol foi disputada em 2 tempos regulamentares, de 45 minutos cada, sem acréscimos, com uma prorrogação de 30 minutos, também sem acréscimos. Um jogador entrou no início do segundo tempo, com um equipamento para medir a distância percorrida durante sua participação no jogo. Ao final do segundo tempo regulamentar, esse jogador havia percorrido 4,5 km. Ele manteve na prorrogação a mesma velocidade média que havia mantido no segundo tempo regulamentar.\n\nA distância percorrida por esse jogador durante sua participação na partida, em quilômetro, foi',
    alternativas: {
      A: { rotulo: '4,5.', valorNumerico: 4.5, diagnosticoPt: '4,5 km é só o que ele correu no 2º tempo; faltou somar a prorrogação de 30 minutos!', tagErro: 'leitura_interpretacao' },
      B: { rotulo: '6,0.', valorNumerico: 6, diagnosticoPt: 'Confira a pergunta: quantos minutos ao todo o jogador atuou desde o início do 2º tempo (45 min + 30 min = 75 min)?', tagErro: 'calculo_aritmetico' },
      C: { rotulo: '7,5.', valorNumerico: 7.5, diagnosticoPt: 'Exato! 4,5 km em 45 min = 0,1 km/min → 30 min extras = +3,0 km → 7,5 km.' },
      D: { rotulo: '9,0.', valorNumerico: 9, diagnosticoPt: 'Esse jogador não jogou o 1º tempo — ele entrou no início do 2º tempo!', tagErro: 'leitura_interpretacao' },
      E: { rotulo: '12,0.', valorNumerico: 12, diagnosticoPt: '12 km seria se ele tivesse jogado 120 minutos completos (1º + 2º + prorrogação).', tagErro: 'leitura_interpretacao' },
    },
    dicas: [
      'Atenção em que momento o jogador ENTROU na partida: início do segundo tempo!',
      'Resumo de boteco: 4,5 km em 45 minutos dá exatamente 1 km a cada 10 minutos! Quantos km ele faz nos 30 minutos da prorrogação e qual a soma total?',
      'Armadilha dupla: incluir os 45 minutos do 1º tempo (quando ele estava no banco) OU responder só os 3 km da prorrogação!',
    ],
    solucaoCompletaPt: 'No 2º tempo (45 min) correu 4,5 km ⇒ ritmo de 0,1 km/min. Na prorrogação (30 min) correu 30 × 0,1 = 3,0 km. Total = 4,5 + 3,0 = 7,5 km.',
    dicaVidaRealPt: 'Transformar velocidade em "km a cada 10 minutos" ou "por minuto" evita contas com frações de hora.',
  },

  // ===========================================================================
  // 🏆 GRAU 7 — ESPECIALISTA (+256): 12 QUESTÕES OFICIAIS DO ENEM
  // ===========================================================================
  {
    ano: 2022,
    questao: 136,
    grau: 7,
    temaId: 'enem_estatistica_medias',
    correta: 'D',
    enunciadoMarkdown:
      'Em uma universidade, atuam professores que estão enquadrados funcionalmente pela sua maior titulação: mestre ou doutor. Nela há, atualmente, 60 mestres e 40 doutores. Os salários mensais dos professores mestres e dos doutores são, respectivamente, R$ 8 000,00 e R$ 12 000,00.\n\nA diretoria da instituição pretende proporcionar um aumento salarial diferenciado para o ano seguinte, de tal forma que o salário médio mensal dos professores dessa instituição não ultrapasse R$ 12 240,00. A universidade já estabeleceu que o aumento salarial será de 25% para os mestres e precisa ainda definir o percentual de reajuste para os doutores.\n\nMantido o número atual de professores com suas atuais titulações, o aumento salarial, em porcentagem, a ser concedido aos doutores deverá ser de, no máximo,',
    alternativas: {
      A: { rotulo: '14,4.', valorNumerico: 14.4, diagnosticoPt: 'Você aplicou peso incorreto entre o teto da folha e o salário base dos doutores.', tagErro: 'porcentagem_base' },
      B: { rotulo: '20,7.', valorNumerico: 20.7, diagnosticoPt: 'Confira a divisão do aumento restante da folha pelos 40 doutores.', tagErro: 'calculo_aritmetico' },
      C: { rotulo: '22,0.', valorNumerico: 22, diagnosticoPt: 'Confira o novo salário dos mestres (8.000 + 25% = 10.000) multiplicado por 60.', tagErro: 'calculo_aritmetico' },
      D: { rotulo: '30,0.', valorNumerico: 30, diagnosticoPt: 'Perfeito! Folha teto 1.224.000 − 600.000 (mestres) = 624.000 ÷ 40 = 15.600 (+30% sobre 12.000).' },
      E: { rotulo: '37,5.', valorNumerico: 37.5, diagnosticoPt: 'Você pode ter trocado 60 e 40 ou usado média simples entre mestres e doutores!', tagErro: 'proporcao_invertida' },
    },
    dicas: [
      'A média de 100 professores (60 + 40) não pode passar de R$ 12.240,00. Qual é o teto da FOLHA SALARIAL TOTAL dos 100 professores?',
      'Resumo de boteco: ache quanto os 60 mestres já vão consumir depois do aumento de 25%; o que sobrar do orçamento máximo vai dividido pelos 40 doutores!',
      'Depois de achar o novo salário máximo de 1 doutor, compare esse valor com R$ 12.000 para transformar o ganho em porcentagem.',
    ],
    solucaoCompletaPt: 'Folha máxima = 100 × 12.240 = R$ 1.224.000. Novo salário dos mestres = 8.000 × 1,25 = R$ 10.000 ⇒ 60 × 10.000 = R$ 600.000. Sobra para 40 doutores: 624.000 ÷ 40 = R$ 15.600 cada. Aumento = (15.600 − 12.000)/12.000 = 3.600/12.000 = 30%.',
    dicaVidaRealPt: 'Trabalhar com a folha total (orçamento absoluto) antes de dividir pelos cargos evita armadilhas de média ponderada.',
  },
  {
    ano: 2022,
    questao: 155,
    grau: 7,
    temaId: 'enem_funcoes_sequencias',
    correta: 'E',
    enunciadoMarkdown:
      'Um parque tem dois circuitos de tamanhos diferentes para corridas. Um corredor treina nesse parque e, no primeiro dia, inicia seu treino percorrendo 3 voltas em torno do circuito maior e 2 voltas em torno do menor, perfazendo um total de 1 800 m. Em seguida, dando continuidade a seu treino, corre mais 2 voltas em torno do circuito maior e 1 volta em torno do menor, percorrendo mais 1 100 m.\n\nNo segundo dia, ele pretende percorrer 5 000 m nos circuitos do parque, fazendo um número inteiro de voltas em torno deles e de modo que o número de voltas seja o maior possível.\n\nA soma do número de voltas em torno dos dois circuitos, no segundo dia, será',
    alternativas: {
      A: { rotulo: '10.', valorNumerico: 10, diagnosticoPt: 'Você maximizou as voltas no circuito MAIOR em vez do circuito MENOR!', tagErro: 'leitura_interpretacao' },
      B: { rotulo: '13.', valorNumerico: 13, diagnosticoPt: 'Dá para conseguir mais voltas trocando voltas grandes por voltas pequenas para somar 5.000 m.', tagErro: 'calculo_aritmetico' },
      C: { rotulo: '14.', valorNumerico: 14, diagnosticoPt: 'Como 5.000 não é múltiplo exato de 300, você precisa trocar o mínimo de voltas menores por maiores para fechar exato.', tagErro: 'calculo_aritmetico' },
      D: { rotulo: '15.', valorNumerico: 15, diagnosticoPt: 'Confira se essa combinação fecha exatamente 5.000 m com números inteiros de voltas.', tagErro: 'calculo_aritmetico' },
      E: { rotulo: '16.', valorNumerico: 16, diagnosticoPt: 'Certo! Circuitos: 400 m e 300 m. Para fechar 5.000 m com máximo de voltas: 2×400 + 14×300 = 5.000 (16 voltas).' },
    },
    dicas: [
      'Primeiro monte o sistema 2×2 com os dois trechos do 1º dia para descobrir quantos metros tem cada circuito ($M$ e $m$).',
      'Resumo de boteco: depois de achar o circuito grande e o pequeno, para dar o MAIOR número possível de voltas somando 5.000 m, você quer encher o máximo possível de voltas do circuito MENOR!',
      'Armadilha: se 5.000 não divide exato pelo menor circuito, vá substituindo de 1 em 1 volta pelo maior até o resto fechar exato!',
    ],
    solucaoCompletaPt: '3M + 2m = 1.800 e 2M + m = 1.100 ⇒ m = 1.100 − 2M ⇒ 3M + 2(1.100 − 2M) = 1.800 ⇒ M = 400 m e m = 300 m. Queremos 400a + 300b = 5.000 ⇒ 4a + 3b = 50. Para maximizar (a + b), minimizamos a ≥ 0 com 50 − 4a múltiplo de 3: para a = 2, 42 = 3×14 ⇒ b = 14. Total = 2 + 14 = 16 voltas.',
    dicaVidaRealPt: 'Maximizar quantidade sob orçamento fixo significa priorizar o item de menor custo unitário ajustando pelo resto.',
  },
  {
    ano: 2022,
    questao: 147,
    grau: 7,
    temaId: 'enem_geometria_medidas',
    correta: 'E',
    enunciadoMarkdown:
      'Uma cozinheira produz docinhos especiais por encomenda. Usando uma receita-base de massa, ela prepara uma porção, com a qual produz 50 docinhos maciços de formato esférico, com 2 cm de diâmetro. Um cliente encomenda 150 desses docinhos, mas pede que cada um tenha formato esférico com 4 cm de diâmetro.\n\nA cozinheira pretende preparar o número exato de porções da receita-base de massa necessário para produzir os docinhos dessa encomenda.\n\nQuantas porções da receita-base de massa ela deve preparar para atender esse cliente?',
    alternativas: {
      A: { rotulo: '2', valorNumerico: 2, diagnosticoPt: 'Confira a razão de quantidade (150 ÷ 50 = 3) E a razão cúbica de volume ao dobrar o diâmetro.', tagErro: 'unidade_escala' },
      B: { rotulo: '3', valorNumerico: 3, diagnosticoPt: '3 porções fariam 150 docinhos de 2 cm — mas o cliente pediu o DOBRO do diâmetro (4 cm)!', tagErro: 'leitura_interpretacao' },
      C: { rotulo: '6', valorNumerico: 6, diagnosticoPt: 'Você dobrou a massa (×2) porque o diâmetro dobrou, esquecendo que esfera é 3D (volume cresce ao CUBO = 2³ = 8)!', tagErro: 'formula_geometria' },
      D: { rotulo: '12', valorNumerico: 12, diagnosticoPt: 'Você multiplicou pelo quadrado do diâmetro (×4) como se fosse área plana, mas docinho é sólido 3D!', tagErro: 'formula_geometria' },
      E: { rotulo: '24', valorNumerico: 24, diagnosticoPt: 'Exato! 3× a quantidade × 2³ (8× volume cada) = 24 porções.' },
    },
    dicas: [
      'A massa usada depende do VOLUME dos docinhos, não do diâmetro linear.',
      'Resumo de boteco: há dois efeitos multiplicando juntos! (1) quantidade de docinhos subiu de 50 para 150; (2) o diâmetro dobrou (2 cm → 4 cm), então cada docinho gasta 2³ = 8 vezes mais massa!',
      'Armadilha clássica: multiplicar só por 2 (diâmetro dobrou) ou por 2² = 4 em vez de 2³ = 8!',
    ],
    solucaoCompletaPt: 'Quantidade = 150 ÷ 50 = 3 vezes. Diâmetro dobrou (k = 2) ⇒ volume de cada esfera cresce k³ = 8 vezes. Porções = 3 × 8 = 24.',
    dicaVidaRealPt: 'Você nem precisa da fórmula 4/3·π·r³ quando duas esferas são semelhantes: basta elevar a razão dos diâmetros ao cubo!',
  },
  {
    ano: 2023,
    questao: 156,
    grau: 7,
    temaId: 'enem_funcoes_sequencias',
    correta: 'D',
    enunciadoMarkdown:
      'Um agricultor é informado sobre um método de proteção para sua lavoura que consiste em inserir larvas específicas, de rápida reprodução. A reprodução dessas larvas faz com que sua população multiplique-se por 10 a cada 3 dias e, para evitar eventuais desequilíbrios, é possível cessar essa reprodução aplicando-se um produto X. O agricultor decide iniciar esse método com 100 larvas e dispõe de 5 litros do produto X, cuja aplicação recomendada é de exatamente 1 litro para cada população de 200 000 larvas. A quantidade total do produto X de que ele dispõe deverá ser aplicada de uma única vez.\n\nQuantos dias após iniciado esse método o agricultor deverá aplicar o produto X?',
    alternativas: {
      A: { rotulo: '2', valorNumerico: 2, diagnosticoPt: 'Em 2 dias ainda não completou nem o primeiro ciclo de 3 dias.', tagErro: 'leitura_interpretacao' },
      B: { rotulo: '4', valorNumerico: 4, diagnosticoPt: '4 é o número de CICLOS de multiplicação por 10; lembre que cada ciclo dura 3 dias!', tagErro: 'leitura_interpretacao' },
      C: { rotulo: '6', valorNumerico: 6, diagnosticoPt: 'Em 6 dias (2 ciclos) há apenas 100 × 10² = 10.000 larvas.', tagErro: 'calculo_aritmetico' },
      D: { rotulo: '12', valorNumerico: 12, diagnosticoPt: 'Certo! 5 L tratam 1.000.000 de larvas; 100 × 10⁴ = 10⁶ → 4 × 3 = 12 dias.' },
      E: { rotulo: '18', valorNumerico: 18, diagnosticoPt: 'Em 18 dias seriam 6 ciclos (100 milhões de larvas), muito além dos 5 litros disponíveis!', tagErro: 'calculo_aritmetico' },
    },
    dicas: [
      'Quantas larvas no máximo os 5 litros do produto X conseguem tratar de uma única vez?',
      'Resumo de boteco: partindo de 100 larvas, quantas vezes você precisa multiplicar por 10 (acrescentar um zero!) para bater na população suportada pelos 5 litros?',
      'Armadilha clássica: achar o número de saltos (×10) e esquecer de multiplicar cada salto por 3 dias!',
    ],
    solucaoCompletaPt: '5 L × 200.000 larvas/L = 1.000.000 (10⁶) larvas. Partindo de 100 (10²), precisamos multiplicar por 10⁴ (4 ciclos). Como cada ciclo leva 3 dias: 4 × 3 = 12 dias.',
    dicaVidaRealPt: 'Crescimento exponencial em base 10 se resolve contando zeros antes mesmo de usar logaritmos.',
  },
  {
    ano: 2024,
    questao: 136,
    grau: 7,
    temaId: 'enem_funcoes_sequencias',
    correta: 'C',
    enunciadoMarkdown:
      'Uma empresa produz mochilas escolares sob encomenda. Essa empresa tem um custo total de produção, composto por um custo fixo, que não depende do número de mochilas, mais um custo variável, que é proporcional ao número de mochilas produzidas. O custo total cresce de forma linear, e a tabela apresenta esse custo para três quantidades de mochilas produzidas.\n\n| Quantidade de mochilas | 30 | 50 | 100 |\n| :--- | :---: | :---: | :---: |\n| **Custo total (R$)** | **1 050,00** | **1 650,00** | **3 150,00** |\n\nO custo total, em real, para a produção de 80 mochilas será',
    alternativas: {
      A: { rotulo: '2 400,00.', valorNumerico: 2400, diagnosticoPt: '2.400 é apenas o custo variável (80 × 30); faltou somar o custo fixo de R$ 150!', tagErro: 'leitura_interpretacao' },
      B: { rotulo: '2 520,00.', valorNumerico: 2520, diagnosticoPt: 'Armadilha da regra de três direta: (100 → 3.150 ⇒ 80 → 2.520) ignora que o custo fixo não varia com a quantidade!', tagErro: 'proporcao_invertida' },
      C: { rotulo: '2 550,00.', valorNumerico: 2550, diagnosticoPt: 'Exato! Custo por mochila = 30, fixo = 150 → 150 + 80×30 = 2.550.' },
      D: { rotulo: '2 700,00.', valorNumerico: 2700, diagnosticoPt: '2.700 seria se você usasse proporção direta partindo da coluna de 30 mochilas, mas há custo fixo!', tagErro: 'proporcao_invertida' },
      E: { rotulo: '2 800,00.', valorNumerico: 2800, diagnosticoPt: 'Confira a taxa unitária: (1.650 − 1.050) ÷ (50 − 30) = R$ 30/mochila.', tagErro: 'calculo_aritmetico' },
    },
    dicas: [
      'Atenção: como existe um CUSTO FIXO, regra de três direta com qualquer coluna da tabela dá resposta ERRADA!',
      'Resumo de boteco: compare duas colunas da tabela! Como o custo fixo é igual nas duas, a diferença em reais dividida pela diferença de mochilas dá exatamente o custo variável de 1 mochila.',
      'Depois de achar o preço de cada mochila extra (R$ 30), avance 30 mochilas a partir de 50 (1.650 + 30×30) — ou ache o fixo primeiro!',
    ],
    solucaoCompletaPt: 'Variação: (1.650 − 1.050) ÷ (50 − 30) = 600 ÷ 20 = R$ 30/mochila. Custo fixo: 1.050 − 30×30 = R$ 150. Para 80 mochilas: 150 + 80×30 = R$ 2.550,00.',
    dicaVidaRealPt: 'Taxa de variação Δy/Δx elimina imediatamente qualquer termo fixo na análise de tabelas lineares.',
  },
  {
    ano: 2024,
    questao: 138,
    grau: 7,
    temaId: 'enem_razoes_escalas',
    correta: 'C',
    enunciadoMarkdown:
      'Uma empresa de engenharia foi contratada para realizar um serviço no valor de R$ 71 250,00. Os sócios da empresa decidiram que 40% desse valor seria destinado ao pagamento de três engenheiros que gerenciaram o serviço. O pagamento para cada um deles será feito de forma diretamente proporcional ao total de horas trabalhadas. O número de dias e o número de horas diárias trabalhadas pelos engenheiros foram, respectivamente:\n\n- engenheiro I: 4 dias, numa jornada de 5 horas e meia por dia;\n- engenheiro II: 5 dias, numa jornada de 4 horas por dia;\n- engenheiro III: 6 dias, numa jornada de 2 horas e meia por dia.\n\nQual a maior diferença, em real, entre os valores recebidos por esse serviço entre dois desses engenheiros?',
    alternativas: {
      A: { rotulo: '1 000', valorNumerico: 1000, diagnosticoPt: 'Esse seria apenas o salto entre os engenheiros I e II (2 horas), não a MAIOR diferença (entre I e III)!', tagErro: 'leitura_interpretacao' },
      B: { rotulo: '1 500', valorNumerico: 1500, diagnosticoPt: 'Confira o total destinado (40% de 71.250 = 28.500) dividido por 57 horas totais (= R$ 500/hora).', tagErro: 'calculo_aritmetico' },
      C: { rotulo: '3 500', valorNumerico: 3500, diagnosticoPt: 'Perfeito! 22 h − 15 h = 7 h × R$ 500/h = R$ 3.500.' },
      D: { rotulo: '3 800', valorNumerico: 3800, diagnosticoPt: 'Confira quantas horas o engenheiro I (4×5,5 = 22 h) e o III (6×2,5 = 15 h) trabalharam.', tagErro: 'calculo_aritmetico' },
      E: { rotulo: '5 250', valorNumerico: 5250, diagnosticoPt: 'Confira a divisão pela soma real de horas (22 + 20 + 15 = 57 h) e lembre que é 40% de 71.250.', tagErro: 'calculo_aritmetico' },
    },
    dicas: [
      'A pergunta quer a MAIOR diferença: é só pegar quem trabalhou MAIS horas menos quem trabalhou MENOS horas!',
      'Resumo de boteco: ache primeiro 40% de R$ 71.250; depois some as horas totais dos 3 (dias × horas/dia de cada um) para descobrir quanto vale 1 HORA de trabalho!',
      'Multiplique o valor de 1 hora apenas pela diferença (maior hora − menor hora) — economiza duas multiplicações!',
    ],
    solucaoCompletaPt: 'Montante = 0,4 × 71.250 = R$ 28.500. Horas: I = 4×5,5 = 22 h; II = 5×4 = 20 h; III = 6×2,5 = 15 h. Soma = 57 h. Valor/hora = 28.500 ÷ 57 = R$ 500/h. Maior diferença: (22 − 15) × 500 = 7 × 500 = R$ 3.500.',
    dicaVidaRealPt: 'Calcular o "valor por unidade" (R$/hora) torna qualquer comparação de diferenças instantânea.',
  },
  {
    ano: 2024,
    questao: 157,
    grau: 7,
    temaId: 'enem_razoes_escalas',
    correta: 'D',
    enunciadoMarkdown:
      'Uma piscina tem capacidade de 2 500 000 litros. Seu sistema de abastecimento foi regulado para ter uma vazão constante de 6 000 litros de água por minuto. O mesmo sistema foi instalado em uma segunda piscina, com capacidade de 2 750 000 litros, e regulado para ter uma vazão, também constante, capaz de enchê-la em um tempo 20% maior que o gasto para encher a primeira piscina.\n\nA vazão do sistema de abastecimento da segunda piscina, em litro por minuto, é',
    alternativas: {
      A: { rotulo: '8 250.', valorNumerico: 8250, diagnosticoPt: 'Se o tempo para encher é 20% MAIOR (com capacidade só 10% maior), a vazão precisa ser MENOR que 6.000, nunca 8.250!', tagErro: 'proporcao_invertida' },
      B: { rotulo: '7 920.', valorNumerico: 7920, diagnosticoPt: 'Tempo maior reduz a vazão; você multiplicou por 1,2 em vez de dividir por 1,2!', tagErro: 'proporcao_invertida' },
      C: { rotulo: '6 545.', valorNumerico: 6545, diagnosticoPt: 'Você inverteu o efeito da vazão com o tempo.', tagErro: 'proporcao_invertida' },
      D: { rotulo: '5 500.', valorNumerico: 5500, diagnosticoPt: 'Certo! V₂/V₁ = 1,1 e t₂/t₁ = 1,2 ⇒ Q₂ = 6.000 × (1,1 / 1,2) = 5.500 L/min.' },
      E: { rotulo: '5 280.', valorNumerico: 5280, diagnosticoPt: 'Divida por 1,2 em vez de multiplicar por 0,88 (tirar 20% não equivale a dividir por 1,2!).', tagErro: 'porcentagem_base' },
    },
    dicas: [
      'Corte os zeros grandes logo no começo! Compare a capacidade da 2ª piscina com a da 1ª (2.750.000 ÷ 2.500.000 = 1,10, isto é, +10%).',
      'Resumo de boteco: vazão = Volume ÷ Tempo! Se o volume ficou ×1,1 e o tempo ficou ×1,2, então a nova vazão é a antiga vezes (1,1 ÷ 1,2) — ou calcule o tempo real t₁ = 2.500/6 minutos!',
      'Armadilha clássica: achar que "tempo +20%" significa multiplicar vazão por 0,8 ou multiplicar por 1,2!',
    ],
    solucaoCompletaPt: 'Razão de volumes = 2.750/2.500 = 11/10. Razão de tempos = 1,2 = 6/5. Vazão = Volume ÷ Tempo ⇒ Q₂ = 6.000 × (11/10) ÷ (6/5) = 6.000 × (11/12) = 5.500 L/min.',
    dicaVidaRealPt: 'Dividir por 1,2 (fator de +20%) nunca é igual a multiplicar por 0,8 (−20%): 1 / 1,2 = 0,833...',
  },
  {
    ano: 2023,
    questao: 166,
    grau: 7,
    temaId: 'enem_probabilidade_contagem',
    correta: 'C',
    enunciadoMarkdown:
      'Visando atrair mais clientes, o gerente de uma loja anunciou uma promoção em que cada cliente que realizar uma compra pode ganhar um voucher para ser usado em sua próxima compra. Para ganhar seu voucher, o cliente precisa retirar, ao acaso, uma bolinha de dentro de cada uma das duas urnas A e B disponibilizadas pelo gerente, nas quais há apenas bolinhas pretas e brancas.\n\nAtualmente, a probabilidade de se escolher, ao acaso, uma bolinha preta na urna A é igual a 20% e a probabilidade de se escolher uma bolinha preta na urna B é 25%. Ganha o voucher o cliente que retirar duas bolinhas pretas, uma de cada urna.\n\nCom o passar dos dias, o gerente percebeu que, para a promoção ser viável aos negócios, era preciso alterar a probabilidade de acerto do cliente sem alterar a regra da promoção. Para isso, resolveu alterar a quantidade de bolinhas brancas na urna B de forma que a probabilidade de um cliente ganhar o voucher passasse a ser menor ou igual a 1%. Sabe-se que a urna B tem 4 bolinhas pretas e que, em ambas as urnas, todas as bolinhas têm a mesma probabilidade de serem retiradas.\n\nQual é o número mínimo de bolinhas brancas que o gerente deve adicionar à urna B?',
    alternativas: {
      A: { rotulo: '20', valorNumerico: 20, diagnosticoPt: 'Você errou a proporção ou deixou a probabilidade conjunta bem acima de 1%.', tagErro: 'combinatoria_probabilidade' },
      B: { rotulo: '60', valorNumerico: 60, diagnosticoPt: '60 bolinhas brancas é o mínimo contando apenas 4 ÷ 0,05 = 80 bolas no total (ou esqueceu das 12 brancas que JÁ existiam)!', tagErro: 'leitura_interpretacao' },
      C: { rotulo: '64', valorNumerico: 64, diagnosticoPt: 'Exato! B precisa ter ≥ 80 bolas no total (tinha 16: 4P+12B) ⇒ adicionar 64 brancas.' },
      D: { rotulo: '68', valorNumerico: 68, diagnosticoPt: '68 = 80 − 12 brancas já existentes? Não! Já existiam 16 bolas (4 pretas + 12 brancas) na urna B.', tagErro: 'calculo_aritmetico' },
      E: { rotulo: '80', valorNumerico: 80, diagnosticoPt: '80 é o TOTAL final de bolas na urna B, não o número de brancas a ADICIONAR!', tagErro: 'leitura_interpretacao' },
    },
    dicas: [
      'Para ganhar, precisa tirar preta em A E preta em B: multiplicamos 20% (= 1/5) pela nova probabilidade de B, e queremos resultado ≤ 1% (= 1/100).',
      'Resumo de boteco: primeiro descubra quantas bolinhas brancas JÁ existem na urna B hoje (se 4 pretas valem 25%, então 4 é 1/4 do total = 16 bolas, logo já há 12 brancas!).',
      'Armadilha clássica: responder o total final de bolas da urna B (80) sem descontar as 16 bolas que já estavam lá dentro!',
    ],
    solucaoCompletaPt: 'Hoje urna B tem 4 pretas = 25% ⇒ total B = 16 bolas (4P + 12B). Queremos 0,20 × P(B) ≤ 0,01 ⇒ P(B) ≤ 0,05 = 1/20. Como há 4 pretas: 4 / total_novo ≤ 1/20 ⇒ total_novo ≥ 80 bolas. Como já havia 16, adicionar 80 − 16 = 64 brancas.',
    dicaVidaRealPt: 'Sempre verifique se a pergunta pede o valor final ou apenas quanto falta ADICIONAR ao estado inicial.',
  },
  {
    ano: 2019,
    questao: 155,
    grau: 7,
    temaId: 'enem_porcentagem_financeira',
    correta: 'A',
    enunciadoMarkdown:
      'Três sócios resolveram fundar uma fábrica. O investimento inicial foi de R$ 1 000 000,00. E, independentemente do valor que cada um investiu nesse primeiro momento, resolveram considerar que cada um deles contribuiu com um terço do investimento inicial.\n\nAlgum tempo depois, um quarto sócio entrou para a sociedade, e os quatro, juntos, investiram mais R$ 800 000,00 na fábrica. Cada um deles contribuiu com um quarto desse valor. Quando venderam a fábrica, nenhum outro investimento havia sido feito. Os sócios decidiram então dividir o montante de R$ 1 800 000,00 obtido com a venda, de modo proporcional à quantia total investida por cada sócio.\n\nQuais os valores mais próximos, em porcentagens, correspondentes às parcelas financeiras que cada um dos três sócios iniciais e o quarto sócio, respectivamente, receberam?',
    alternativas: {
      A: { rotulo: '29,60 e 11,11.', diagnosticoPt: 'Perfeito! 533,3k/1.800k ≈ 29,63% (mais próximo de 29,60) e 200k/1.800k = 1/9 ≈ 11,11%.' },
      B: { rotulo: '28,70 e 13,89.', diagnosticoPt: 'Confira quanto o 4º sócio colocou: 1/4 de 800k = 200k sobre o total de 1.800k (= 1/9) — converta essa fração para porcentagem.', tagErro: 'calculo_aritmetico' },
      C: { rotulo: '25,00 e 25,00.', diagnosticoPt: 'Isso dividiria igualmente por 4 sócios, ignorando que os 3 primeiros entraram com o milhão inicial!', tagErro: 'leitura_interpretacao' },
      D: { rotulo: '18,52 e 11,11.', diagnosticoPt: '18,52% é só a participação do 1/3 inicial sobre 1.800k; faltou somar os 200k que cada sócio inicial também pôs depois!', tagErro: 'leitura_interpretacao' },
      E: { rotulo: '12,96 e 13,89.', diagnosticoPt: 'Confira a participação de cada sócio sobre o total investido de 1,8 milhão.', tagErro: 'porcentagem_base' },
    },
    dicas: [
      'Some quanto CADA um dos 4 sócios colocou ao todo na fábrica: 1ª rodada (1 milhão ÷ 3 para os 3 primeiros) + 2ª rodada (800 mil ÷ 4 para todos os 4).',
      'Resumo de boteco: calcule primeiro a porcentagem do 4º sócio — é super limpa! Ele só entrou na 2ª rodada com 200 mil de um total de 1.800 mil (= 2/18 = 1/9). E lembre que os 4 percentuais juntos (3×A + B) fecham 100%!',
      'Armadilha: esquecer que os 3 sócios iniciais TAMBÉM entraram com 1/4 dos R$ 800 mil da segunda rodada.',
    ],
    solucaoCompletaPt: 'Total investido = 1.000.000 + 800.000 = 1.800.000. Quarto sócio: 200.000 / 1.800.000 = 1/9 ≈ 11,11%. Restante = 100% − 11,11% = 88,89% dividido por 3 ≈ 29,63% (opção mais próxima: 29,60 e 11,11).',
    dicaVidaRealPt: 'Calcular primeiro o termo mais simples (1/9) já permite eliminar quase todas as alternativas por conferência da soma.',
  },
  {
    ano: 2024,
    questao: 170,
    grau: 7,
    temaId: 'enem_porcentagem_financeira',
    correta: 'D',
    enunciadoMarkdown:
      'Uma casa de shows terá um evento cujo custo total de produção é de R$ 34 350,00, sendo que comporta 500 pessoas. O preço do ingresso será de R$ 130,00 e, normalmente, 60% das pessoas adquirem meia-entrada, pagando R$ 65,00 pelo ingresso. Além do faturamento proveniente da venda de ingressos, a casa de shows vende, com 60% de lucro, bebidas e petiscos ao público no dia do evento.\n\nApós ter vendido todos os 500 ingressos, constatou-se que a quantidade de meias-entradas vendidas superou em **50% o que estava previsto**, impactando o faturamento estimado com a venda de ingressos.\n\nNo dia do evento, decidiu-se manter o percentual de 60% de lucro sobre as bebidas e petiscos, pois todo o público que comprou ingresso compareceu ao show. Com isso, espera-se ter lucro de R$ 17 000,00 nesse evento.\n\nPara que se alcance o lucro esperado, o gasto médio por pessoa com bebidas e petiscos, em real, deverá ser de',
    alternativas: {
      A: { rotulo: '19,50.', valorNumerico: 19.5, diagnosticoPt: 'Você calculou 60% sobre o faturamento sem ajustar a queda ou somou 34.350 errado.', tagErro: 'porcentagem_base' },
      B: { rotulo: '28,80.', valorNumerico: 28.8, diagnosticoPt: 'Você achou apenas o LUCRO necessário no bar (15.600 ÷ 500 = 31,20?) — lembre que só 60% do GASTO do cliente vira lucro!', tagErro: 'porcentagem_base' },
      C: { rotulo: '34,00.', valorNumerico: 34, diagnosticoPt: '34,00 seria apenas dividir R$ 17.000 por 500 ignorando os ingressos e o lucro de 60% no bar.', tagErro: 'leitura_interpretacao' },
      D: { rotulo: '52,00.', valorNumerico: 52, diagnosticoPt: 'Exato! 450 meias (29.250) + 50 inteiras (6.500) = 35.750. Faltam 15.600 de lucro no bar = 60% de 26.000 ⇒ 26.000 ÷ 500 = R$ 52.' },
      E: { rotulo: '68,70.', valorNumerico: 68.7, diagnosticoPt: 'Confira quantas meias-entradas foram vendidas: 50% a mais que 60% é 90% de 500 (450 pessoas), não 110%!', tagErro: 'porcentagem_base' },
    },
    dicas: [
      'Cuidado com duas armadilhas no texto: (1) 50% a MAIS sobre 60% das pessoas é 60% + 30% = 90% (450 pessoas); (2) o lucro desejado depende da RECEITA total (ingressos + lucro do bar − custo do evento).',
      'Resumo de boteco: ache quanto já entrou com os ingressos reais (450 meias + 50 inteiras); compare com o total necessário (custo + lucro = 51.350). A diferença precisa vir dos 60% de lucro sobre as vendas do bar!',
      'Se o lucro do bar precisa ser X, e esse lucro vale 60% do gasto do público, então Gasto Total = X ÷ 0,60; depois divida pelas 500 pessoas.',
    ],
    solucaoCompletaPt: 'Previsto: 60% de 500 = 300 meias. Real (+50%): 450 meias (450×65 = 29.250) + 50 inteiras (50×130 = 6.500) = R$ 35.750 em ingressos. Meta total líquida = 34.350 + 17.000 = 51.350. Lucro faltante no bar = 51.350 − 35.750 = 15.600. Como lucro = 60% da venda do bar: venda bar = 15.600 ÷ 0,6 = R$ 26.000 ⇒ por pessoa = 26.000 ÷ 500 = R$ 52,00.',
    dicaVidaRealPt: 'Saber voltar do lucro desejado para a receita bruta (dividindo pela margem) é essencial em gestão de eventos.',
  },
  {
    ano: 2025,
    questao: 165,
    grau: 7,
    temaId: 'enem_porcentagem_financeira',
    correta: 'C',
    enunciadoMarkdown:
      'Um estacionamento possui 120 vagas para veículos, e todas essas vagas estão ocupadas. Cada cliente paga uma mensalidade para utilizar uma vaga, que é calculada com base nas despesas mensais do estacionamento e no lucro pretendido. As despesas mensais do estacionamento são: R$ 14 240,00 com manutenção mais R$ 36,00 de seguro por veículo. O lucro do estacionamento é determinado pela diferença do valor arrecadado com as mensalidades pelas despesas efetuadas.\n\nA partir do mês seguinte, o valor do seguro por veículo aumentará em 20%, e as despesas com manutenção permanecerão sem alterações. Com isso, o dono do estacionamento reajustará as mensalidades para obter um lucro mensal de R$ 10 000,00. Apesar desse reajuste, todas as vagas continuarão ocupadas.\n\nO valor, em real, da mensalidade reajustada será',
    alternativas: {
      A: { rotulo: '185,60.', valorNumerico: 185.6, diagnosticoPt: 'Você esqueceu de incluir o lucro pretendido de R$ 10.000,00 no rateio entre as 120 vagas!', tagErro: 'leitura_interpretacao' },
      B: { rotulo: '226,09.', valorNumerico: 226.09, diagnosticoPt: 'Confira o novo valor do seguro (36 × 1,2 = 43,20) e a soma fixa de manutenção + lucro.', tagErro: 'calculo_aritmetico' },
      C: { rotulo: '245,20.', valorNumerico: 245.2, diagnosticoPt: 'Exato! (14.240 + 10.000) ÷ 120 = 202,00 + 43,20 de seguro = R$ 245,20.' },
      D: { rotulo: '268,93.', valorNumerico: 268.93, diagnosticoPt: 'Confira a divisão de (14.240 + 10.000) por 120 vagas — ela dá exata!', tagErro: 'calculo_aritmetico' },
      E: { rotulo: '285,60.', valorNumerico: 285.6, diagnosticoPt: 'Você aplicou 20% sobre um valor maior ou somou despesas extras indevidas.', tagErro: 'porcentagem_base' },
    },
    dicas: [
      'O lucro pretendido (10.000) somado à manutenção (14.240) precisa ser coberto pelas 120 vagas — e cada vaga ainda paga o seu seguro reajustado (+20% sobre 36).',
      'Resumo de boteco: você nem precisa multiplicar 43,20 por 120 para depois dividir por 120! Divida (14.240 + 10.000) por 120 primeiro e some direto o novo seguro de 1 carro!',
      'Armadilha: esquecer o lucro de R$ 10.000 ou aplicar +20% sobre a manutenção também.',
    ],
    solucaoCompletaPt: 'Manutenção + lucro = 14.240 + 10.000 = R$ 24.240. Rateado por 120 vagas: 24.240 ÷ 120 = R$ 202,00/vaga. Seguro novo = 36 × 1,20 = R$ 43,20/vaga. Mensalidade = 202,00 + 43,20 = R$ 245,20.',
    dicaVidaRealPt: 'Deixar custos por unidade (como o seguro por veículo) sem multiplicar e dividir economiza contas e erros.',
  },
  {
    ano: 2025,
    questao: 179,
    grau: 7,
    temaId: 'enem_probabilidade_contagem',
    correta: 'C',
    enunciadoMarkdown:
      'Um pai comprou oito presentes diferentes (dentre os quais, uma bicicleta e um celular) para dar a seus três filhos. Ele pretende distribuir os presentes de modo que o filho mais velho e o mais novo recebam três presentes cada um, e o do meio receba os dois presentes restantes. O mais velho ganhará, entre seus presentes, ou uma bicicleta ou um celular, mas não ambos.\n\nDe quantas maneiras distintas a distribuição dos presentes pode ser feita?',
    alternativas: {
      A: { rotulo: '36', valorNumerico: 36, diagnosticoPt: 'Você contou apenas quantos subconjuntos sobram depois de fixar, esquecendo as escolhas dos outros irmãos ou de escolher entre bicicleta/celular.', tagErro: 'combinatoria_probabilidade' },
      B: { rotulo: '53', valorNumerico: 53, diagnosticoPt: 'Em combinatória de etapas sucessivas multiplicamos as possibilidades, não somamos.', tagErro: 'combinatoria_probabilidade' },
      C: { rotulo: '300', valorNumerico: 300, diagnosticoPt: 'Perfeito! 2 × C(6,2) × C(5,3) × C(2,2) = 2 × 15 × 10 × 1 = 300.' },
      D: { rotulo: '360', valorNumerico: 360, diagnosticoPt: 'Depois de dar 3 presentes ao mais velho (usando 1 dos 2 especiais), restam 5 presentes para o mais novo escolher 3 (C(5,3) = 10, não C(6,3))!', tagErro: 'combinatoria_probabilidade' },
      E: { rotulo: '560', valorNumerico: 560, diagnosticoPt: '560 = C(8,3)×C(5,3) conta TODAS as distribuições sem a restrição da bicicleta/celular no mais velho!', tagErro: 'combinatoria_probabilidade' },
    },
    dicas: [
      'Comece sempre pela pessoa que tem RESTRIÇÃO (o filho mais velho): dos 2 itens especiais (bicicleta, celular), quantos vão para ele e de quantas formas?',
      'Resumo de boteco: passo 1 — escolha 1 entre {bicicleta, celular} para o mais velho (2 jeitos); passo 2 — complete os outros 2 presentes dele entre os 6 presentes comuns C(6,2); passo 3 — escolha 3 dos 5 presentes restantes para o mais novo C(5,3); o do meio fica com os últimos 2!',
      'Armadilha clássica: permitir que o outro item especial entre nos 6 escolhidos para completar o mais velho — lembre que o enunciado proíbe ambos irem para ele!',
    ],
    solucaoCompletaPt: 'Mais velho: 2 opções (bicicleta ou celular) × C(6,2) entre os 6 demais presentes = 2 × 15 = 30 jeitos. Mais novo escolhe 3 dos 5 presentes restantes (incluindo o especial que sobrou): C(5,3) = 10. Filho do meio recebe os 2 restantes (1 jeito). Total = 30 × 10 × 1 = 300.',
    dicaVidaRealPt: 'Atender primeiro às restrições antes de distribuir os itens livres evita contar casos proibidos.',
  },
]

export const ENEM_MATEMATICA_LOTE1: readonly DesafioUnificado[] = SPECS_ENEM_MATEMATICA.map(construirDesafioEnem)
