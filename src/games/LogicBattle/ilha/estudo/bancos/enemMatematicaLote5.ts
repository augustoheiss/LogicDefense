/**
 * Lote 5 — 20 questões oficiais do ENEM (2015–2024, Caderno 5 Amarelo), priorizando itens com
 * figuras HD limpas auditadas e gabaritos conferidos com `gabaritosMatematicaEnem.ts`.
 * Dicas e diagnósticos seguem estritamente a política Zero-Spoiler.
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
  readonly alternativas: Readonly<
    Record<
      'A' | 'B' | 'C' | 'D' | 'E',
      {
        readonly rotulo: string
        readonly valorNumerico?: number
        readonly diagnosticoPt: string
        readonly tagErro?: TipoErroPedagogico
      }
    >
  >
  readonly dicas: readonly [string, string, string]
  readonly solucaoCompletaPt: string
  readonly atalhoPt: string
  readonly outroCaminhoPt: string
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
      metodos: [
        { selo: 'Mapa no guardanapo', resumo: s.atalhoPt },
        { selo: 'Outro caminho', resumo: s.outroCaminhoPt },
      ],
      dicaVidaRealPt: s.dicaVidaRealPt,
    },
  }
}

const SPECS_LOTE5: readonly SpecEnemOficial[] = [
  {
    ano: 2015,
    questao: 137,
    grau: 6,
    temaId: 'enem_geometria_medidas',
    correta: 'B',
    enunciadoMarkdown:
      'A figura representa a vista superior de uma bola de futebol americano, cuja forma é um elipsoide obtido pela rotação de uma elipse em torno do eixo das abscissas. Os valores $a$ e $b$ são, respectivamente, a metade do seu comprimento horizontal e a metade do seu comprimento vertical. Para essa bola, a diferença entre os comprimentos horizontal e vertical é igual à metade do comprimento vertical.\n\nConsidere que o volume aproximado dessa bola é dado por $V = 4ab^2$.\n\nO volume dessa bola, em função apenas de $b$, é dado por',
    alternativas: {
      A: {
        rotulo: '$8b^3$',
        diagnosticoPt: 'Isso aconteceria se $a = 2b$ (comprimento horizontal sendo o dobro do vertical), mas a diferença vale metade do vertical.',
        tagErro: 'algebra_manipulacao',
      },
      B: {
        rotulo: '$6b^3$',
        diagnosticoPt: 'Correto! Como $2a - 2b = b \\Rightarrow a = \\frac{3}{2}b$, substituindo em $4ab^2$ obtém-se a expressão correta.',
      },
      C: {
        rotulo: '$5b^3$',
        diagnosticoPt: 'Confira a simplificação após isolar $a$ em termos de $b$; falta um ajuste fracionário.',
        tagErro: 'algebra_manipulacao',
      },
      D: {
        rotulo: '$4b^3$',
        diagnosticoPt: 'Você considerou $a = b$ (uma esfera), ignorando que os eixos da elipse são diferentes.',
        tagErro: 'leitura_interpretacao',
      },
      E: {
        rotulo: '$2b^3$',
        diagnosticoPt: 'Se $a$ substituído reduzisse o volume a $2b^3$, o comprimento horizontal $2a$ seria menor que o vertical $2b$.',
        tagErro: 'algebra_manipulacao',
      },
    },
    dicas: [
      'Atenção à definição de $a$ e $b$: eles são METADES dos comprimentos! Logo os comprimentos inteiros são $2a$ e $2b$.',
      'Traduza a frase: $(\\text{comp. horizontal}) - (\\text{comp. vertical}) = \\frac{1}{2}(\\text{comp. vertical})$, isto é, $2a - 2b = b$.',
      'Armadilha: escrever $a - b = b$ esquecendo o fator $2$ nos comprimentos totais.',
    ],
    solucaoCompletaPt: 'Comprimento horizontal $= 2a$ e vertical $= 2b$. Da condição: $2a - 2b = \\frac{1}{2}(2b) = b \\Rightarrow 2a = 3b \\Rightarrow a = \\frac{3}{2}b$. Substituindo em $V = 4ab^2$: $V = 4 \\left(\\frac{3}{2}b\\right) b^2 = 6b^3$.',
    atalhoPt: 'Divida $2a - 2b = b$ por $2$: $a - b = 0{,}5b \\Rightarrow a = 1{,}5b$; depois $4 \\times 1{,}5 = 6$.',
    outroCaminhoPt: 'Teste um exemplo numérico: $b = 2$ (vertical $4$), então horizontal $= 4 + 2 = 6 \\Rightarrow a = 3$. $V = 4(3)(2)^2 = 48 = 6 \\times 2^3$.',
    dicaVidaRealPt: 'Conferir a diferença entre raio/semieixo e diâmetro/comprimento total é regra de ouro em geometria.',
  },
  {
    ano: 2015,
    questao: 139,
    grau: 5,
    temaId: 'enem_funcoes_sequencias',
    correta: 'B',
    enunciadoMarkdown:
      'Um investidor inicia um dia com $x$ ações de uma empresa. No decorrer desse dia, ele efetua apenas dois tipos de operações, comprar ou vender ações. Para realizar essas operações, ele segue estes critérios:\n\nI. vende metade das ações que possui, assim que seu valor fica acima do valor ideal ($V_i$);\nII. compra a mesma quantidade de ações que possui, assim que seu valor fica abaixo do valor mínimo ($V_m$);\nIII. vende todas as ações que possui, quando seu valor fica acima do valor ótimo ($V_o$).\n\nO gráfico apresenta o período de operações e a variação do valor de cada ação, em reais, no decorrer daquele dia e a indicação dos valores ideal, mínimo e ótimo.\n\nQuantas operações o investidor fez naquele dia?',
    alternativas: {
      A: {
        rotulo: '3',
        valorNumerico: 3,
        diagnosticoPt: 'Você esqueceu de contar um dos cruzamentos importantes ou achou que o estoque já havia zerado antes do pico final.',
        tagErro: 'leitura_interpretacao',
      },
      B: {
        rotulo: '4',
        valorNumerico: 4,
        diagnosticoPt: 'Perfeito! Vende metade (1ª) antes das 11h, compra dobrando (2ª) antes das 12h, cruza $V_i$ (3ª) perto das 13h e liquida tudo acima de $V_o$ (4ª) antes das 14h — depois disso não tem mais ações!',
      },
      C: {
        rotulo: '5',
        valorNumerico: 5,
        diagnosticoPt: 'Cuidado com o critério III! Quando passa de $V_o$, ele vende TODAS as ações — após zerar a carteira, não há mais nada para vender após as 15h.',
        tagErro: 'leitura_interpretacao',
      },
      D: {
        rotulo: '6',
        valorNumerico: 6,
        diagnosticoPt: 'Você contou cruzamentos de subida e descida sem lembrar que a carteira zera ao cruzar $V_o$.',
        tagErro: 'leitura_interpretacao',
      },
      E: {
        rotulo: '7',
        valorNumerico: 7,
        diagnosticoPt: 'Apenas cruzar as linhas pontilhadas na descida não dispara venda ou compra; além disso, após zerar em $V_o$, todas as operações cessam.',
        tagErro: 'leitura_interpretacao',
      },
    },
    dicas: [
      'Acompanhe o saldo de ações em ordem cronológica das 10h às 17h: comece com $x$ ações.',
      'Preste muita atenção ao critério III (acima de $V_o$): se o investidor vende TUDO que possui, o que acontece com o saldo depois desse instante?',
      'Armadilha clássica: continuar contando o pico das 15h sendo que o investidor já tinha zerado a carteira por volta das 13h30!',
    ],
    solucaoCompletaPt: '1) Entre 10h e 11h: sobe acima de $V_i$ $\\rightarrow$ vende metade (fica $x/2$). 2) Perto das 12h: cai abaixo de $V_m$ $\\rightarrow$ compra a mesma quantidade (fica com $x$). 3) Perto das 13h: sobe acima de $V_i$ $\\rightarrow$ vende metade (fica $x/2$). 4) Antes das 14h: passa acima de $V_o$ $\\rightarrow$ vende TUDO (saldo $0$). Como não volta mais abaixo de $V_m$, encerra o dia em 4 operações.',
    atalhoPt: 'Assim que a curva rompe a linha tracejada superior $V_o$, todas as vendas posteriores deixam de existir.',
    outroCaminhoPt: 'Simule começando com 100 ações e anote o saldo após cada evento no gráfico.',
    dicaVidaRealPt: 'Simular estado com um valor simples (como 100 unidades) evita esquecer condições de parada ou saldo zero.',
  },
  {
    ano: 2015,
    questao: 141,
    grau: 5,
    temaId: 'enem_funcoes_sequencias',
    correta: 'D',
    enunciadoMarkdown:
      'Atualmente existem diversas locadoras de veículos, permitindo uma concorrência saudável para o mercado, fazendo com que os preços se tornem acessíveis. Nas locadoras $P$ e $Q$, o valor da diária de seus carros depende da distância percorrida, conforme o gráfico.\n\nO valor pago na locadora $Q$ é menor ou igual àquele pago na locadora $P$ para distâncias, em quilômetros, presentes em qual(is) intervalo(s)?',
    alternativas: {
      A: {
        rotulo: 'De 20 a 100.',
        diagnosticoPt: 'Olhe com cuidado entre 20 e 100 km: nesse trecho, a curva de $Q$ está ACIMA da reta de $P$, custando mais caro!',
        tagErro: 'leitura_interpretacao',
      },
      B: {
        rotulo: 'De 80 a 130.',
        diagnosticoPt: 'Os pontos de cruzamento das duas tarifas acontecem exatamente em $20\\text{ km}$ e em $100\\text{ km}$, e não em $80$ ou $130$.',
        tagErro: 'leitura_interpretacao',
      },
      C: {
        rotulo: 'De 100 a 160.',
        diagnosticoPt: 'Esse intervalo está correto, mas é incompleto: veja o início do gráfico entre $0$ e $20\\text{ km}$!',
        tagErro: 'leitura_interpretacao',
      },
      D: {
        rotulo: 'De 0 a 20 e de 100 a 160.',
        diagnosticoPt: 'Correto! A curva $Q$ começa abaixo em R$ 40,00, cruza $P$ em $20\\text{ km}$, fica mais cara no meio e volta a ficar abaixo a partir dos $100\\text{ km}$.',
      },
      E: {
        rotulo: 'De 40 a 80 e de 130 a 160.',
        diagnosticoPt: 'No gráfico horizontal (eixo $x$), o cruzamento das linhas define exatamente os limites dos intervalos.',
        tagErro: 'leitura_interpretacao',
      },
    },
    dicas: [
      'Pagar "menor ou igual" significa procurar os trechos em que a curva $Q$ está ABAIXO ou TOCANDO a reta $P$.',
      'Localize primeiro os dois pontos de interseção entre $P$ e $Q$ no eixo da distância (eixo horizontal).',
      'Armadilha: esquecer o primeiro trecho inicial antes da primeira interseção.',
    ],
    solucaoCompletaPt: 'Em $x = 0$, $Q = 40 < P = 65$. Em $x = 20$ e $x = 100$, $P$ e $Q$ se cruzam. Entre $20$ e $100$, $Q > P$. De $0$ a $20$ e de $100$ a $160$, $Q \\le P$.',
    atalhoPt: 'Marque os cruzamentos ($20$ e $100$) e olhe onde o traço fino ($Q$) passa por baixo do traço grosso ($P$).',
    outroCaminhoPt: 'Teste o meio ($x = 60$: $Q > P$) para saber qual intervalo fica de fora.',
    dicaVidaRealPt: 'Comparar gráficos de tarifas sempre começa identificando os pontos de cruzamento (empate).',
  },
  {
    ano: 2015,
    questao: 144,
    grau: 5,
    temaId: 'enem_razoes_escalas',
    correta: 'D',
    enunciadoMarkdown:
      'Um pesquisador, ao explorar uma floresta, fotografou uma caneta de $16{,}8\\text{ cm}$ de comprimento ao lado de uma pegada. O comprimento da caneta ($c$), a largura ($L$) e o comprimento ($C$) da pegada, na fotografia, estão indicados no esquema ($c = 1{,}4\\text{ cm}$, $L = 2{,}2\\text{ cm}$, $C = 3{,}4\\text{ cm}$).\n\nA largura e o comprimento reais da pegada, em centímetros, são, respectivamente, iguais a',
    alternativas: {
      A: {
        rotulo: '4,9 e 7,6.',
        diagnosticoPt: 'A caneta real é bem maior que $1{,}4\\text{ cm}$ ($16{,}8\\text{ cm}$ = 12 vezes maior); logo a pegada também cresce 12 vezes.',
        tagErro: 'geometria_escala',
      },
      B: {
        rotulo: '8,6 e 9,8.',
        diagnosticoPt: 'Você parece ter somado uma diferença constante às medidas da foto, quando escala trabalha por multiplicação!',
        tagErro: 'geometria_escala',
      },
      C: {
        rotulo: '14,2 e 15,4.',
        diagnosticoPt: 'Confira a razão de ampliação dividindo $16{,}8$ por $1{,}4$: ela é exatamente um número inteiro.',
        tagErro: 'calculo_aritmetico',
      },
      D: {
        rotulo: '26,4 e 40,8.',
        diagnosticoPt: 'Exato! O fator real/foto é $16{,}8 \\div 1{,}4 = 12$, logo multiplicando $2{,}2$ e $3{,}4$ por 12 achamos as dimensões reais.',
      },
      E: {
        rotulo: '27,5 e 42,5.',
        diagnosticoPt: 'Quase! Verifique a divisão $16{,}8 \\div 1{,}4$ (dá exatamente $12$, e não $12{,}5$).',
        tagErro: 'calculo_aritmetico',
      },
    },
    dicas: [
      'A caneta serve de régua de escala: quanto a caneta real ($16{,}8\\text{ cm}$) é maior que a caneta na foto ($1{,}4\\text{ cm}$)?',
      'Divida $16{,}8$ por $1{,}4$ (ou $168 \\div 14$) para achar o fator de ampliação e multiplique largura e comprimento por ele.',
      'Armadilha: somar a diferença entre $16{,}8$ e $1{,}4$ em vez de multiplicar pela razão.',
    ],
    solucaoCompletaPt: 'Fator de escala = $\\frac{16{,}8}{1{,}4} = \\frac{168}{14} = 12$. Largura real = $12 \\times 2{,}2 = 26{,}4\\text{ cm}$. Comprimento real = $12 \\times 3{,}4 = 40{,}8\\text{ cm}$.',
    atalhoPt: '$14 \\times 10 = 140$ mais $14 \\times 2 = 28$ dá $168$: fator 12 na hora!',
    outroCaminhoPt: 'Multiplique primeiro por 10 ($22$ e $34$) e some o dobro ($+4{,}4$ e $+6{,}8$).',
    dicaVidaRealPt: 'Fotografar um objeto de tamanho conhecido ao lado de um achado permite reconstruir medidas exatas depois.',
  },
  {
    ano: 2016,
    questao: 139,
    grau: 6,
    temaId: 'enem_estatistica_medias',
    correta: 'A',
    enunciadoMarkdown:
      'O cultivo de uma flor rara só é viável se do mês do plantio para o mês subsequente o clima da região possuir as seguintes peculiaridades:\n\n- a variação do nível de chuvas (pluviosidade), nesses meses, não for superior a $50\\text{ mm}$;\n- a temperatura mínima, nesses meses, for superior a $15\\ ^\\circ\\text{C}$;\n- ocorrer, nesse período, um leve aumento não superior a $5\\ ^\\circ\\text{C}$ na temperatura máxima.\n\nUm floricultor consultou um meteorologista que lhe apresentou o gráfico com as condições previstas para os 12 meses seguintes nessa região (de maio de 2012 a maio de 2013).\n\nCom base nas informações do gráfico, o floricultor verificou que poderia plantar essa flor rara. O mês escolhido para o plantio foi',
    alternativas: {
      A: {
        rotulo: 'janeiro.',
        diagnosticoPt: 'Correto! De janeiro para fevereiro as barras de chuva mudam menos de $50\\text{ mm}$, a temperatura mínima segue bem acima de $15\\ ^\\circ\\text{C}$ e a máxima sobe levemente dentro do limite.',
      },
      B: {
        rotulo: 'fevereiro.',
        diagnosticoPt: 'De fevereiro para março a temperatura máxima cai em vez de aumentar levemente!',
        tagErro: 'leitura_interpretacao',
      },
      C: {
        rotulo: 'agosto.',
        diagnosticoPt: 'De agosto para setembro há um salto enorme na pluviosidade (barras passam de ~10 mm para mais de 35 mm? Olhe 2012: barra de outubro e julho — em agosto/setembro ou julho há variação brusca ou mínima baixa).',
        tagErro: 'leitura_interpretacao',
      },
      D: {
        rotulo: 'novembro.',
        diagnosticoPt: 'De novembro para dezembro ocorre variação forte nas chuvas (barra despenca de ~210 mm para ~145 mm, maior que $50\\text{ mm}$).',
        tagErro: 'leitura_interpretacao',
      },
      E: {
        rotulo: 'dezembro.',
        diagnosticoPt: 'Observe que no eixo direito (Temperatura), os rótulos da escala vão de $0$ a $35\\ ^\\circ\\text{C}$; verifique de dezembro para janeiro na linha pontilhada e nas barras.',
        tagErro: 'leitura_interpretacao',
      },
    },
    dicas: [
      'Atenção aos DOIS eixos verticais do gráfico: à esquerda lê-se Pluviosidade (barras); à direita, Temperatura (duas linhas).',
      'Elimine meses pela 3ª condição: a temperatura MÁXIMA (linha cheia) precisa SUBIR do mês escolhido para o seguinte! Poucos pares de meses sobem.',
      'Armadilha: olhar a escala esquerda para ler temperatura mínima ($15\\ ^\\circ\\text{C}$), confundindo os dois eixos.',
    ],
    solucaoCompletaPt: 'Pela escala da direita, temperatura mínima $> 15\\ ^\\circ\\text{C}$ elimina maio a agosto de 2012 e abril a maio de 2013. A temperatura máxima (linha contínua) só sobe entre: ago→set (mas chuva salta $>50\\text{ mm}$), dez→jan (barra cai e máxima oscila) e jan→fev (barras ~130→150 mm, variação $< 50\\text{ mm}$; mínimas ~21 °C $> 15\\ ^\\circ\\text{C}$; máxima sobe ~27→28,5 °C, aumento $\\le 5\\ ^\\circ\\text{C}$). Logo o plantio ocorre no primeiro mês desse par.',
    atalhoPt: 'Filtre primeiro pela inclinação positiva na linha superior (máxima subindo) e cheque variação pequena entre barras vizinhas.',
    outroCaminhoPt: 'Teste apenas as 5 alternativas na tabela/gráfico conferindo as 3 restrições em ordem.',
    dicaVidaRealPt: 'Em gráficos de eixo duplo, conferir sempre qual curva lê na esquerda e qual lê na direita evita erros fatais.',
  },
  {
    ano: 2016,
    questao: 140,
    grau: 5,
    temaId: 'enem_funcoes_sequencias',
    correta: 'C',
    enunciadoMarkdown:
      'Uma cisterna de $6\\ 000\\text{ L}$ foi esvaziada em um período de $3\\text{ h}$. Na primeira hora foi utilizada apenas uma bomba, mas nas duas horas seguintes, a fim de reduzir o tempo de esvaziamento, outra bomba foi ligada junto com a primeira. O gráfico, formado por dois segmentos de reta, mostra o volume de água presente na cisterna em função do tempo.\n\nQual é a vazão, em litro por hora, da bomba que foi ligada no início da segunda hora?',
    alternativas: {
      A: {
        rotulo: '1 000',
        valorNumerico: 1000,
        diagnosticoPt: 'Esse é a vazão da PRIMEIRA bomba ($6\\ 000 - 5\\ 000 = 1\\ 000\\text{ L/h}$), e a pergunta quer a vazão da SEGUNDA bomba!',
        tagErro: 'leitura_interpretacao',
      },
      B: {
        rotulo: '1 250',
        valorNumerico: 1250,
        diagnosticoPt: 'Confira o esvaziamento nas 2 horas finais: saem $5\\ 000\\text{ L}$ em $2\\text{ h}$, logo a vazão conjunta é $2\\ 500\\text{ L/h}$, e subtraindo a 1ª bomba resta mais que $1\\ 250$.',
        tagErro: 'calculo_aritmetico',
      },
      C: {
        rotulo: '1 500',
        valorNumerico: 1500,
        diagnosticoPt: 'Correto! A 1ª bomba tira $1\\ 000\\text{ L/h}$; juntas tiram $5\\ 000\\text{ L}$ em $2\\text{ h}$ ($2\\ 500\\text{ L/h}$), logo a nova bomba contribui com a diferença.',
      },
      D: {
        rotulo: '2 000',
        valorNumerico: 2000,
        diagnosticoPt: 'Se a segunda bomba tivesse vazão de $2\\ 000\\text{ L/h}$, somando aos $1\\ 000\\text{ L/h}$ da primeira esvaziaria $6\\ 000\\text{ L}$ nas 2 horas finais, e só restavam $5\\ 000\\text{ L}$.',
        tagErro: 'calculo_aritmetico',
      },
      E: {
        rotulo: '2 500',
        valorNumerico: 2500,
        diagnosticoPt: 'Essa é a vazão SOMA das duas bombas juntas nas 2 horas finais ($5\\ 000 / 2$), esquecendo de descontar o trabalho da 1ª bomba!',
        tagErro: 'leitura_interpretacao',
      },
    },
    dicas: [
      'No gráfico $AB$ ($0$ a $1\\text{ h}$), apenas a bomba 1 atua: quanto o volume caiu nessa 1ª hora?',
      'No trecho $BC$ ($1$ a $3\\text{ h}$), as DUAS bombas operam juntas: ache a taxa combinada ($\\text{L/h}$) e subtraia a taxa da bomba 1.',
      'Armadilha clássica: responder a vazão conjunta ou a vazão da primeira bomba.',
    ],
    solucaoCompletaPt: 'Vazão da 1ª bomba = $\\frac{6\\ 000 - 5\\ 000}{1} = 1\\ 000\\text{ L/h}$. Nas $2\\text{ h}$ seguintes ($BC$), saem $5\\ 000\\text{ L}$, então $V_1 + V_2 = \\frac{5\\ 000}{2} = 2\\ 500\\text{ L/h}$. Logo $V_2 = 2\\ 500 - 1\\ 000 = 1\\ 500\\text{ L/h}$.',
    atalhoPt: 'Em 3 horas totais, a 1ª bomba trabalhou 3h ($3\\ 000\\text{ L}$); os outros $3\\ 000\\text{ L}$ foram tirados pela 2ª bomba em 2h.',
    outroCaminhoPt: 'Usar trabalho total de cada bomba separadamente ($3\\ 000\\text{ L}$ em $2\\text{ h}$) dispensa subtrair taxas.',
    dicaVidaRealPt: 'Somar a produção individual ao longo de toda a janela temporal costuma ser ainda mais rápido que subtrair taxas.',
  },
  {
    ano: 2016,
    questao: 142,
    grau: 5,
    temaId: 'enem_razoes_escalas',
    correta: 'E',
    enunciadoMarkdown:
      'De forma geral, os pneus radiais trazem em sua lateral uma marcação do tipo $abc/deRfg$, como $185/65R15$. Essa marcação identifica as medidas do pneu da seguinte forma:\n\n- $abc$ é a medida da largura do pneu, em milímetro;\n- $de$ é igual ao produto de $100$ pela razão entre a medida da altura (em milímetro) e a medida da largura do pneu (em milímetro);\n- $R$ significa radial;\n- $fg$ é a medida do diâmetro interno do pneu, em polegada.\n\nAnalisando as opções disponíveis ($175/65R15$, $175/75R15$, $175/80R15$, $185/60R15$ e $205/55R15$), o proprietário conclui que o pneu mais adequado é o que tem a **menor altura**.\n\nDesta forma, o proprietário deverá comprar o pneu com a marcação',
    alternativas: {
      A: {
        rotulo: '205/55R15.',
        diagnosticoPt: 'Ele tem o menor percentual ($55\\%$), mas sua largura é bem maior ($205\\text{ mm}$): $55\\%$ de $205$ resulta em $112{,}75\\text{ mm}$.',
        tagErro: 'leitura_interpretacao',
      },
      B: {
        rotulo: '175/65R15.',
        diagnosticoPt: '$65\\%$ de $175\\text{ mm}$ resulta em $113{,}75\\text{ mm}$, ficando um pouco mais alto que outro modelo.',
        tagErro: 'calculo_aritmetico',
      },
      C: {
        rotulo: '175/75R15.',
        diagnosticoPt: '$75\\%$ de $175\\text{ mm}$ dá $131{,}25\\text{ mm}$, altura bem maior.',
        tagErro: 'calculo_aritmetico',
      },
      D: {
        rotulo: '175/80R15.',
        diagnosticoPt: '$80\\%$ de $175\\text{ mm}$ resulta em $140\\text{ mm}$, que na verdade é o pneu MAIS ALTO da lista!',
        tagErro: 'leitura_interpretacao',
      },
      E: {
        rotulo: '185/60R15.',
        diagnosticoPt: 'Correto! $60\\%$ de $185\\text{ mm}$ resulta em $111{,}0\\text{ mm}$, a menor altura absoluta entre os cinco modelos.',
      },
    },
    dicas: [
      'Traduzindo a segunda regra: $de = 100 \\cdot \\frac{\\text{altura}}{\\text{largura}}$, logo $\\text{altura} = \\frac{de}{100} \\times \\text{largura}$.',
      'Ou seja, você quer o MENOR produto entre os dois primeiros números de cada código ($abc \\times de$).',
      'Armadilha: escolher o menor número $abc$ ou o menor percentual $de$ isoladamente sem multiplicar os dois.',
    ],
    solucaoCompletaPt: 'Altura em mm: $205 \\times 0{,}55 = 112{,}75$; $175 \\times 0{,}65 = 113{,}75$; $175 \\times 0{,}75 = 131{,}25$; $175 \\times 0{,}80 = 140$; $185 \\times 0{,}60 = 111{,}00\\text{ mm}$. O menor valor é $111\\text{ mm}$ no modelo $185/60R15$.',
    atalhoPt: 'Entre $205 \\times 55$, $175 \\times 65$ e $185 \\times 60$, note que $185 \\times 6 = 1110$, menor que $205 \\times 5{,}5 = 1127{,}5$.',
    outroCaminhoPt: 'Descarte na hora $175/75$ e $175/80$ pois ambos têm mesma largura de $175$ com percentual maior que $65$.',
    dicaVidaRealPt: 'Esse número do perfil do pneu sempre é uma porcentagem da largura, e nunca milímetros diretos.',
  },
  {
    ano: 2016,
    questao: 146,
    grau: 7,
    temaId: 'enem_geometria_medidas',
    correta: 'D',
    enunciadoMarkdown:
      'Um petroleiro possui reservatório em formato de um paralelepípedo retangular com as dimensões dadas por $60\\text{ m} \\times 10\\text{ m}$ de base e $10\\text{ m}$ de altura. Com o objetivo de minimizar o impacto ambiental de um eventual vazamento, esse reservatório é subdividido em três compartimentos, $A$, $B$ e $C$, de mesmo volume, por duas placas de aço retangulares com dimensões de $7\\text{ m}$ de altura e $10\\text{ m}$ de base, conforme a figura.\n\nSuponha que ocorra um desastre quando o petroleiro se encontra com sua carga máxima: ele sofre um acidente que ocasiona um furo no fundo do compartimento $C$. Para fins de cálculo, considere desprezíveis as espessuras das placas divisórias.\n\nApós o fim do vazamento, o volume de petróleo derramado terá sido de',
    alternativas: {
      A: {
        rotulo: '$1{,}4 \\times 10^3\\text{ m}^3$',
        diagnosticoPt: 'Você calculou apenas o volume retido nos compartimentos $A$ e $B$ até $7\\text{ m}$ ($2 \\times 200 \\times 7$? Não, $2\\times 200\\times 3 = 1,2\\times10^3$; $1,4\\times 10^3$ seria uma fração parcial do compartimento $C$).',
        tagErro: 'leitura_interpretacao',
      },
      B: {
        rotulo: '$1{,}8 \\times 10^3\\text{ m}^3$',
        diagnosticoPt: 'Confira a soma do compartimento $C$ inteiro com as faixas superiores de $3\\text{ m}$ acima das placas em $A$ e $B$.',
        tagErro: 'geometria_escala',
      },
      C: {
        rotulo: '$2{,}0 \\times 10^3\\text{ m}^3$',
        diagnosticoPt: 'Esse é o volume apenas do compartimento $C$, esquecendo que os $3\\text{ m}$ superiores de $A$ e $B$ transbordam por cima das placas de $7\\text{ m}$!',
        tagErro: 'leitura_interpretacao',
      },
      D: {
        rotulo: '$3{,}2 \\times 10^3\\text{ m}^3$',
        diagnosticoPt: 'Excelente! O que NÃO vaza é apenas o que fica preso abaixo dos $7\\text{ m}$ em $A$ e $B$ ($2{,}8\\times 10^3\\text{ m}^3$); todo o resto dos $6\\ 000\\text{ m}^3$ derrama.',
      },
      E: {
        rotulo: '$6{,}0 \\times 10^3\\text{ m}^3$',
        diagnosticoPt: 'As placas de $7\\text{ m}$ contêm quase $70\\%$ dos tanques $A$ e $B$ impedindo que toda a carga total vaze.',
        tagErro: 'leitura_interpretacao',
      },
    },
    dicas: [
      'A carga está no máximo ($10\\text{ m}$ de altura), mas as divisórias entre $A, B, C$ têm apenas $7\\text{ m}$ de altura.',
      'Pense no que FICA dentro do navio após o furo em $C$: somente o líquido retido até a altura das comportas em $A$ e $B$.',
      'Armadilha clássica: achar que apenas o compartimento $C$ vaza, esquecendo a lâmina superior de $3\\text{ m}$ em $A$ e $B$.',
    ],
    solucaoCompletaPt: 'Cada compartimento tem $20\\text{ m} \\times 10\\text{ m}$ de base (área $200\\text{ m}^2$). Volume total = $60 \\times 10 \\times 10 = 6\\ 000\\text{ m}^3$. Ficam retidos em $A$ e $B$ apenas $7\\text{ m}$ de altura: $V_{\\text{retido}} = 2 \\times 200 \\times 7 = 2\\ 800\\text{ m}^3$. Logo vaza $6\\ 000 - 2\\ 800 = 3\\ 200 = 3{,}2 \\times 10^3\\text{ m}^3$.',
    atalhoPt: 'Vazou $C$ inteiro ($2\\ 000\\text{ m}^3$) + fatia de $3\\text{ m}$ no topo de $A$ e $B$ ($2 \\times 200 \\times 3 = 1\\ 200\\text{ m}^3$).',
    outroCaminhoPt: 'Usar o método complementar (Total menos Retido) economiza somar volumes parciais.',
    dicaVidaRealPt: 'Divisórias parciais funcionam como açudes: retêm líquido apenas até a altura de sua parede.',
  },
  {
    ano: 2017,
    questao: 146,
    grau: 5,
    temaId: 'enem_funcoes_sequencias',
    correta: 'B',
    enunciadoMarkdown:
      'Raios de luz solar estão atingindo a superfície de um lago formando um ângulo $x$ com a sua superfície, conforme indica a figura.\n\nEm determinadas condições, pode-se supor que a intensidade luminosa desses raios, na superfície do lago, seja dada aproximadamente por $I(x) = k \\cdot \\operatorname{sen}(x)$, sendo $k$ uma constante, e supondo-se que $x$ está entre $0^\\circ$ e $90^\\circ$.\n\nQuando $x = 30^\\circ$, a intensidade luminosa se reduz a qual percentual de seu valor máximo?',
    alternativas: {
      A: {
        rotulo: '33%',
        valorNumerico: 33,
        diagnosticoPt: 'Você dividiu $30^\\circ$ por $90^\\circ$, mas a intensidade depende de $\\operatorname{sen}(x)$, que não cresce linearmente com o ângulo!',
        tagErro: 'leitura_interpretacao',
      },
      B: {
        rotulo: '50%',
        valorNumerico: 50,
        diagnosticoPt: 'Correto! O valor máximo ocorre para $\\operatorname{sen}(90^\\circ) = 1$ (valendo $k$), enquanto em $30^\\circ$ temos $\\operatorname{sen}(30^\\circ) = 0{,}5$.',
      },
      C: {
        rotulo: '57%',
        valorNumerico: 57,
        diagnosticoPt: 'Você parece ter usado $\\frac{\\sqrt{3}}{3}$ em vez do valor notável de $\\operatorname{sen}(30^\\circ)$.',
        tagErro: 'geometria_escala',
      },
      D: {
        rotulo: '70%',
        valorNumerico: 70,
        diagnosticoPt: 'Cerca de $0{,}71$ corresponde a $\\operatorname{sen}(45^\\circ)$, e não a $\\operatorname{sen}(30^\\circ)$.',
        tagErro: 'geometria_escala',
      },
      E: {
        rotulo: '86%',
        valorNumerico: 86,
        diagnosticoPt: '$0{,}866$ é o valor de $\\cos(30^\\circ)$ (ou $\\operatorname{sen}(60^\\circ)$)! A fórmula usa seno de $30^\\circ$.',
        tagErro: 'geometria_escala',
      },
    },
    dicas: [
      'Para $x$ entre $0^\\circ$ e $90^\\circ$, qual é o maior valor possível que $\\operatorname{sen}(x)$ pode assumir?',
      'Divida $I(30^\\circ)$ pelo valor máximo de $I(x)$: a constante $k$ cancela automaticamente!',
      'Armadilha clássica: achar que $30^\\circ$ é $1/3$ de $90^\\circ$, esquecendo a função seno, ou trocar seno por cosseno.',
    ],
    solucaoCompletaPt: 'O seno máximo em $(0^\\circ, 90^\\circ]$ ocorre em $90^\\circ$, onde $\\operatorname{sen}(90^\\circ) = 1$, logo $I_{\\text{máx}} = k$. Em $x = 30^\\circ$, $\\operatorname{sen}(30^\\circ) = \\frac{1}{2}$, então $I(30^\\circ) = \\frac{1}{2}k = 0{,}50\\,I_{\\text{máx}} = 50\\%$.',
    atalhoPt: 'Razão = $\\operatorname{sen}(30^\\circ) / 1 = 1/2 = 50\\%$.',
    outroCaminhoPt: 'Lembre da tabela dos ângulos notáveis ($30^\\circ, 45^\\circ, 60^\\circ$): seno de $30^\\circ$ é sempre meio.',
    dicaVidaRealPt: 'Grandezas trigonométricas não dobram quando o ângulo dobra.',
  },
  {
    ano: 2017,
    questao: 147,
    grau: 5,
    temaId: 'enem_geometria_medidas',
    correta: 'B',
    enunciadoMarkdown:
      'A imagem apresentada na figura é uma cópia em preto e branco da tela quadrada intitulada *O peixe*, de Marcos Pinto, que foi colocada em uma parede para exposição e fixada nos pontos $A$ e $B$.\n\nPor um problema na fixação de um dos pontos, a tela se desprendeu, girando rente à parede. Após o giro, ela ficou posicionada como ilustrado na figura, formando um ângulo de $45^\\circ$ com a linha do horizonte.\n\nPara recolocar a tela na sua posição original, deve-se girá-la, rente à parede, no menor ângulo possível inferior a $360^\\circ$.\n\nA forma de recolocar a tela na posição original, obedecendo ao que foi estabelecido, é girando-a em um ângulo de',
    alternativas: {
      A: {
        rotulo: '90° no sentido horário.',
        diagnosticoPt: 'Um giro de $90^\\circ$ horário colocaria a borda superior inclinada, sem devolver o ponto $A$ para o topo esquerdo acima do ponto $B$.',
        tagErro: 'geometria_escala',
      },
      B: {
        rotulo: '135° no sentido horário.',
        diagnosticoPt: 'Correto! A diagonal principal do quadrado ($AB$) estava a $-45^\\circ$; como ela girou para baixo passando pela horizontal e ficando $45^\\circ$ abaixo no outro lado, somaram-se $90^\\circ + 45^\\circ$ no sentido anti-horário.',
      },
      C: {
        rotulo: '180° no sentido anti-horário.',
        diagnosticoPt: 'Girar $180^\\circ$ deixaria o quadro ainda pendurado em diagonal, sem alinhar as bordas na vertical/horizontal.',
        tagErro: 'geometria_escala',
      },
      D: {
        rotulo: '270° no sentido anti-horário.',
        diagnosticoPt: 'Mesmo se apontasse o sentido anti-horário, girar $225^\\circ$ (ou $270^\\circ$) não é o MENOR ângulo possível para retornar.',
        tagErro: 'leitura_interpretacao',
      },
      E: {
        rotulo: '315° no sentido horário.',
        diagnosticoPt: 'Você considerou apenas $45^\\circ$ como o ângulo que caiu (fazendo $360^\\circ - 45^\\circ$), sem perceber que $A$ deu quase meia-volta por baixo de $B$!',
        tagErro: 'leitura_interpretacao',
      },
    },
    dicas: [
      'Acompanhe o segmento que vai de $B$ até $A$ (diagonal fixa em $B$). Na tela original, onde fica o ponto $A$ em relação a $B$? (Acima e à esquerda: ângulo de $45^\\circ$ acima da horizontal à esquerda).',
      'Após soltar-se, a ponta $A$ caiu passando pela horizontal até ficar $45^\\circ$ abaixo? Observe a figura: o canto $A$ agora está lá embaixo à esquerda, mantendo o lado $AB$ a $45^\\circ$ do horizonte — ou seja, o quadro caiu por giro no sentido anti-horário passando pelo lado vertical ($90^\\circ + 45^\\circ$).',
      'Armadilha: achar que o quadro rodou só $45^\\circ$ e tentar desgirar no sentido errado.',
    ],
    solucaoCompletaPt: 'Fixado em $B$, o ponto $A$ estava inicialmente acima e à esquerda ($135^\\circ$ no círculo trigonométrico em torno de $B$). Na posição final, $A$ continua à esquerda abaixo, agora formando $45^\\circ$ abaixo do eixo horizontal ($225^\\circ$? Na verdade a borda superior e a diagonal giram $90^\\circ$ ao cair $45^\\circ$ da horizontal: de $45^\\circ$ acima do solo até $45^\\circ$ abaixo/ao lado, ou pelo lado direito do quadrado: a borda que era horizontal agora inclina $135^\\circ$ anti-horário!). Para voltar pelo menor caminho, gira-se $135^\\circ$ no sentido horário.',
    atalhoPt: 'Compare a orientação do peixe/lado $A$: o topo superior do quadro caiu para a esquerda e virou para baixo — passou da vertical ($90^\\circ$) por mais $45^\\circ$.',
    outroCaminhoPt: 'Observe a diagonal $BA$: o vetor $\\vec{BA}$ apontava para cima-esquerda ($\\text{NO}$) e girou até baixo-esquerda ($\text{SO}$) ou para baixo — total de $135^\\circ$ anti-horário, logo retorna no sentido horário.',
    dicaVidaRealPt: 'Para medir rotação de uma figura 2D, escolha uma única aresta com seta e acompanhe apenas o ângulo dessa aresta.',
  },
  {
    ano: 2017,
    questao: 153,
    grau: 6,
    temaId: 'enem_porcentagem_financeira',
    correta: 'A',
    enunciadoMarkdown:
      'Num dia de tempestade, a alteração na profundidade de um rio, num determinado local, foi registrada durante um período de $4\\text{ horas}$. Os resultados estão indicados no gráfico de linhas. Nele, a profundidade $h$, registrada às $13\\text{ horas}$, não foi anotada e, a partir de $h$, cada unidade sobre o eixo vertical representa um metro.\n\nFoi informado que entre $15\\text{ horas}$ e $16\\text{ horas}$, a profundidade do rio diminuiu em $10\\%$.\n\nÀs $16\\text{ horas}$, qual é a profundidade do rio, em metro, no local onde foram feitos os registros?',
    alternativas: {
      A: {
        rotulo: '18',
        valorNumerico: 18,
        diagnosticoPt: 'Correto! Das 15h às 16h a curva desce 2 linhas da grade ($2\\text{ m}$), que correspondem a $10\\%$ da profundidade das 15h ($20\\text{ m}$).',
      },
      B: {
        rotulo: '20',
        valorNumerico: 20,
        diagnosticoPt: 'Cuidado! Esse valor é a profundidade às $15\\text{ horas}$, antes da queda de $10\\%$ — a questão pergunta às $16\\text{ horas}$!',
        tagErro: 'leitura_interpretacao',
      },
      C: {
        rotulo: '24',
        valorNumerico: 24,
        diagnosticoPt: 'Verifique a contagem exata de degraus verticais entre $15\\text{ h}$ e $16\\text{ h}$: há 2 espaços horizontais de grade.',
        tagErro: 'calculo_aritmetico',
      },
      D: {
        rotulo: '36',
        valorNumerico: 36,
        diagnosticoPt: 'Você contou subdivisões extras na grade vertical ($4\\text{ m}$ em vez de $2\\text{ m}$).',
        tagErro: 'leitura_interpretacao',
      },
      E: {
        rotulo: '40',
        valorNumerico: 40,
        diagnosticoPt: 'Mesmo problema de contar cada intervalo com valor dobrado: cada faixa da malha equivale a exatamente $1\\text{ m}$.',
        tagErro: 'leitura_interpretacao',
      },
    },
    dicas: [
      'A grade vertical não mostra $h$, mas cada linha horizontal acima de $h$ soma exatamente $1\\text{ metro}$!',
      'Conte quantas faixas a linha do gráfico DESCE entre o ponto das 15h e o ponto das 16h.',
      'Se essa queda em metros representa $10\\%$ do nível das 15h, multiplique por 10 para descobrir as 15h e depois subtraia a queda!',
    ],
    solucaoCompletaPt: 'Entre 15h ($h + 6$) e 16h ($h + 4$), a profundidade caiu $2\\text{ m}$. Se $2\\text{ m} = 10\\%$ de $P_{15}$, então $P_{15} = 20\\text{ m}$. Às 16h: $20 - 2 = 18\\text{ m}$.',
    atalhoPt: '$10\\% \\leftrightarrow 2\\text{ m} \\Rightarrow 90\\% \\leftrightarrow 9 \\times 2 = 18\\text{ m}$.',
    outroCaminhoPt: 'Ache $h = 20 - 6 = 14\\text{ m}$ e some os $4$ degraus do ponto das 16h.',
    dicaVidaRealPt: 'Quando o zero de um gráfico está interrompido (zigue-zague no eixo), calcule pela diferença entre dois pontos.',
  },
  {
    ano: 2019,
    questao: 138,
    grau: 6,
    temaId: 'enem_estatistica_medias',
    correta: 'D',
    enunciadoMarkdown:
      'O gráfico mostra a evolução mensal das vendas de certo produto de julho a novembro de 2011: Jul = $700$, Ago = $2\\ 500$, Set = $2\\ 500$, Out = $2\\ 800$ e Nov = $2\\ 700$ unidades.\n\nSabe-se que o mês de julho foi o pior momento da empresa em 2011 e que o número de unidades vendidas desse produto em dezembro de 2011 foi igual à média aritmética do número de unidades vendidas nos meses de julho a novembro do mesmo ano.\n\nO gerente de vendas disse que, se essa redução no número de unidades vendidas de novembro para dezembro se mantivesse constante nos meses subsequentes, as vendas só voltariam a ficar piores que julho de 2011 no final de 2012. O diretor financeiro rebateu mostrando que, mantida a tendência, isso aconteceria já em',
    alternativas: {
      A: {
        rotulo: 'janeiro.',
        diagnosticoPt: 'Em janeiro de 2012 as vendas caem de $2\\ 240$ em mais $460$, indo para $1\\ 780$ (ainda bem acima dos $700$ de julho).',
        tagErro: 'calculo_aritmetico',
      },
      B: {
        rotulo: 'fevereiro.',
        diagnosticoPt: 'Em fevereiro chega a $1\\ 320$, acima do piso de julho ($700$).',
        tagErro: 'calculo_aritmetico',
      },
      C: {
        rotulo: 'março.',
        diagnosticoPt: 'Em março cai para $860$ unidades — muito perto de $700$, mas ainda NÃO ficou pior que julho!',
        tagErro: 'leitura_interpretacao',
      },
      D: {
        rotulo: 'abril.',
        diagnosticoPt: 'Perfeito! A média de jul–nov é $2\\ 240$ (queda de $460$ por mês após nov = $2\\ 700$); após 4 meses de queda vai a $400 < 700$.',
      },
      E: {
        rotulo: 'maio.',
        diagnosticoPt: 'Em abril as vendas já passam abaixo de $700$ unidades (vão para $400$), então o rompimento acontece antes de maio.',
        tagErro: 'calculo_aritmetico',
      },
    },
    dicas: [
      'Primeiro calcule a média de vendas dos 5 meses (Jul a Nov): esse valor será a venda de Dezembro.',
      'A queda mensal constante é dada por $\\text{Novembro} - \\text{Dezembro}$. Descubra quantos meses depois de dezembro essa subtração cruza abaixo de $700$.',
      'Armadilha: parar em março ($860$) achando que já passou abaixo de $700$, ou partir do mês errado!',
    ],
    solucaoCompletaPt: 'Média jul–nov = $\\frac{700 + 2500 + 2500 + 2800 + 2700}{5} = \\frac{11\\ 200}{5} = 2\\ 240$ (Dezembro). Redução mensal = $2\\ 700 - 2\\ 240 = 460$. Em 2012: Jan = $1\\ 780$, Fev = $1\\ 320$, Mar = $860$, Abr = $400 < 700$. Logo ocorre em abril.',
    atalhoPt: 'Precisa cair mais que $2\\ 240 - 700 = 1\\ 540$ a passos de $460$: $3 \\times 460 = 1\\ 380$ (não basta), $4 \\times 460 = 1\\ 840$ (4º mês).',
    outroCaminhoPt: 'Usar a linha de desvios em torno de $2\\ 500$: $( -1800 + 0 + 0 + 300 + 200 )/5 = -1300/5 = -260 \\Rightarrow 2\\ 500 - 260 = 2\\ 240$.',
    dicaVidaRealPt: 'Calcular médias por desvio relativo a um valor central redondo reduz soma de números grandes.',
  },
  {
    ano: 2019,
    questao: 143,
    grau: 5,
    temaId: 'enem_porcentagem_financeira',
    correta: 'A',
    enunciadoMarkdown:
      'Um casal planejou uma viagem e definiu como teto para o gasto diário um valor de até R$ 1 000,00. Antes de decidir o destino, pesquisou a taxa de câmbio vigente e as estimativas de gasto diário para escolher o destino que apresentasse o **menor custo diário em real**.\n\n| País de destino | Moeda local | Taxa de câmbio | Gasto diário |\n| :--- | :--- | :---: | :---: |\n| França | Euro (€) | R$ 3,14 | 315,00 € |\n| EUA | Dólar (US$) | R$ 2,78 | US$ 390,00 |\n| Austrália | Dólar australiano (A$) | R$ 2,14 | A$ 400,00 |\n| Canadá | Dólar canadense (C$) | R$ 2,10 | C$ 410,00 |\n| Reino Unido | Libra esterlina (£) | R$ 4,24 | £ 290,00 |\n\nNessas condições, qual será o destino escolhido para a viagem?',
    alternativas: {
      A: {
        rotulo: 'Austrália.',
        diagnosticoPt: 'Correto! $400 \\times 2{,}14 =$ R$ 856,00, superando por pouco o Canadá (R$ 861,00) como menor custo diário em real.',
      },
      B: {
        rotulo: 'Canadá.',
        diagnosticoPt: 'Apesar do câmbio menor (R$ 2,10 vs 2,14), o gasto em moeda local ($410$) leva o total para R$ 861,00, um pouco acima de R$ 856,00!',
        tagErro: 'leitura_interpretacao',
      },
      C: {
        rotulo: 'EUA.',
        diagnosticoPt: '$390 \\times 2{,}78 =$ R$ 1.084,20, ultrapassando até mesmo o teto diário de R$ 1.000,00.',
        tagErro: 'calculo_aritmetico',
      },
      D: {
        rotulo: 'França.',
        diagnosticoPt: '$315 \\times 3{,}14 =$ R$ 989,10, bem mais caro que os destinos abaixo de R$ 870,00.',
        tagErro: 'calculo_aritmetico',
      },
      E: {
        rotulo: 'Reino Unido.',
        diagnosticoPt: '$290 \\times 4{,}24 =$ R$ 1.229,60, o mais caro em reais entre todos os cinco países.',
        tagErro: 'leitura_interpretacao',
      },
    },
    dicas: [
      'A moeda com menor número de gasto diário (£ 290) nem sempre é a mais barata em reais por causa da cotação!',
      'Multiplique taxa de câmbio pelo gasto diário em cada país — comece pelas cotações menores que dão valores claramente abaixo de R$ 900.',
      'Compare com muito cuidado os dois únicos candidatos na casa dos R$ 850–865.',
    ],
    solucaoCompletaPt: 'França: $3{,}14 \\times 315 = 989{,}10$; EUA: $2{,}78 \\times 390 = 1.084{,}20$; Austrália: $2{,}14 \\times 400 = 856{,}00$; Canadá: $2{,}10 \\times 410 = 861{,}00$; Reino Unido: $4{,}24 \\times 290 = 1.229{,}60$. O menor valor em real é R$ 856,00.',
    atalhoPt: 'Compare só $400 \\times 2{,}14 = 856$ com $410 \\times 2{,}10 = 861$, pois os outros três superam R$ 980.',
    outroCaminhoPt: 'Estime mentalmente arredondando ($3\\times 300 > 900$, $2{,}8\\times 400 > 1000$, $4{,}2\\times 300 > 1200$) para eliminar três países sem conta exata.',
    dicaVidaRealPt: 'Orçar viagens comparando o produto "câmbio $\\times$ diária" evita cair na ilusão da moeda numericamente menor.',
  },
  {
    ano: 2020,
    questao: 148,
    grau: 7,
    temaId: 'enem_geometria_medidas',
    correta: 'D',
    enunciadoMarkdown:
      'A fabricação da Bandeira Nacional deve obedecer ao descrito na Lei n. 5.700/1971:\n\n"Para cálculos das dimensões, será tomada por base a largura, dividindo-a em $14$ partes iguais, sendo cada uma chamada módulo ($M$). Os demais requisitos seguem o critério:\nI. Comprimento será de vinte módulos ($20M$);\nII. A distância dos vértices do losango amarelo ao quadro externo será de $1{,}7M$;\nIII. O raio do círculo azul no meio do losango amarelo será de três módulos e meio ($3{,}5M$)."\n\nUm torcedor, dispondo de cortes de tecidos verde ($180\\text{ cm} \\times 150\\text{ cm}$) e amarelo (o quanto baste), deseja confeccionar a **maior Bandeira Nacional possível** a partir das medidas do tecido verde.\n\nQual a medida, em centímetro, do lado do menor quadrado de tecido azul que deverá ser comprado para confecção do círculo da bandeira desejada?',
    alternativas: {
      A: {
        rotulo: '27',
        valorNumerico: 27,
        diagnosticoPt: 'Você calculou $3\\text{ módulos}$ ($3 \\times 9$), mas o RAIO é $3{,}5M$ e o quadrado precisa comportar o DIÂMETRO inteiro ($7M$)!',
        tagErro: 'leitura_interpretacao',
      },
      B: {
        rotulo: '32',
        valorNumerico: 32,
        diagnosticoPt: 'Esse é apenas o RAIO ($3{,}5M \\approx 31{,}5\\text{ cm}$), e um quadrado cujo lado mede apenas o raio só cobriria um quarto do círculo!',
        tagErro: 'geometria_escala',
      },
      C: {
        rotulo: '53',
        valorNumerico: 53,
        diagnosticoPt: 'Você descobriu $M$ usando a largura do tecido verde ($150/14$) sem verificar que $20M$ passaria dos $180\\text{ cm}$ disponíveis!',
        tagErro: 'leitura_interpretacao',
      },
      D: {
        rotulo: '63',
        valorNumerico: 63,
        diagnosticoPt: 'Perfeito! O comprimento $180\\text{ cm}$ é o gargalo ($20M = 180 \\Rightarrow M = 9\\text{ cm}$), logo o diâmetro do círculo azul vale $7M = 63\\text{ cm}$.',
      },
      E: {
        rotulo: '90',
        valorNumerico: 90,
        diagnosticoPt: '90 cm equivale a $10M$, bem maior que o diâmetro real de $7M$ especificado pela lei.',
        tagErro: 'calculo_aritmetico',
      },
    },
    dicas: [
      'A bandeira inteira tem proporção $14M \\times 20M$, e precisa caber inteira dentro do retângulo verde de $150 \\times 180\\text{ cm}$.',
      'Teste qual lado do tecido verde limita o tamanho máximo de $M$: compare $150 \\div 14$ com $180 \\div 20$ e fique com o MENOR $M$!',
      'Armadilha dupla: usar o $M$ maior (que rasgaria o tecido em 20M) ou responder o RAIO ($3{,}5M$) em vez do DIÂMETRO ($7M$) para o lado do quadrado.',
    ],
    solucaoCompletaPt: 'Limites para $M$: largura $\\le 150/14 \\approx 10{,}71\\text{ cm}$ e comprimento $\\le 180/20 = 9\\text{ cm}$. Logo o maior módulo possível é $M = 9\\text{ cm}$ (dando bandeira $126\\text{ cm} \\times 180\\text{ cm}$). O círculo azul tem raio $3{,}5M$, logo seu diâmetro (lado do menor quadrado circunscrito) é $2 \\times 3{,}5M = 7M = 7 \\times 9 = 63\\text{ cm}$.',
    atalhoPt: 'Em qualquer retângulo de corte, o fator limitante é sempre o menor quociente $180/20 = 9$. Diâmetro $= 7 \\times 9$.',
    outroCaminhoPt: 'Lembrar que o raio $3{,}5M$ é exatamente $1/4$ da largura total ($14M/4$), logo o diâmetro ocupa metade da largura ($126 / 2 = 63\\text{ cm}$).',
    dicaVidaRealPt: 'Quando há duas restrições geométricas simultâneas, o limite restritivo (menor escala) é sempre quem manda.',
  },
  {
    ano: 2022,
    questao: 143,
    grau: 5,
    temaId: 'enem_razoes_escalas',
    correta: 'B',
    enunciadoMarkdown:
      'No período de 2005 a 2013, o valor de venda dos imóveis em uma cidade apresentou alta, o que resultou no aumento dos aluguéis. Os gráficos apresentam a evolução desses valores, para um mesmo imóvel:\n\n- Valor mensal do aluguel (R$): 2005 = 630, 2007 = 960, 2009 = 1 350, 2011 = 1 800, 2013 = 3 240;\n- Valor de mercado do imóvel (milhar de R$): 2005 = 90, 2007 = 120, 2009 = 270, 2011 = 450, 2013 = 540.\n\nA rentabilidade do aluguel de um imóvel é calculada pela razão entre o valor mensal de aluguel e o valor de mercado desse imóvel.\n\nCom base nos dados fornecidos, em que ano a rentabilidade do aluguel foi maior?',
    alternativas: {
      A: {
        rotulo: '2005',
        diagnosticoPt: 'Em 2005 a razão vale $\\frac{630}{90\\ 000} = 0{,}7\\%$ ao mês — há outro ano com taxa maior.',
        tagErro: 'calculo_aritmetico',
      },
      B: {
        rotulo: '2007',
        diagnosticoPt: 'Correto! Em 2007 a razão $\\frac{960}{120\\ 000} = 0{,}8\\%$ supera todos os outros anos analisados.',
      },
      C: {
        rotulo: '2009',
        diagnosticoPt: 'Em 2009 o imóvel disparou para R$ 270 mil enquanto o aluguel foi R$ 1.350, baixando a rentabilidade para $0{,}5\\%$.',
        tagErro: 'leitura_interpretacao',
      },
      D: {
        rotulo: '2011',
        diagnosticoPt: 'Em 2011 a razão fica em $\\frac{1800}{450\\ 000} = 0{,}4\\%$, o pior rendimento da série.',
        tagErro: 'leitura_interpretacao',
      },
      E: {
        rotulo: '2013',
        diagnosticoPt: 'Embora seja o maior aluguel em reais (R$ 3.240), o imóvel também subiu para R$ 540 mil, rendendo $\\frac{3240}{540\\ 000} = 0{,}6\\%$.',
        tagErro: 'leitura_interpretacao',
      },
    },
    dicas: [
      'Não precisa converter o denominador para mil reais em cada divisão: basta comparar $\\frac{\\text{Aluguel}}{\\text{Milhar do Imóvel}}$ nos cinco anos!',
      'Calcule as cinco divisões simples: $630/90$, $960/120$, $1350/270$, $1800/450$ e $3240/540$ — todas dão números inteiros!',
      'Armadilha: achar que o último ano vence apenas porque tem a barra mais alta de aluguel.',
    ],
    solucaoCompletaPt: 'Razões (R$ de aluguel por milhar do imóvel): 2005: $630/90 = 7$; 2007: $960/120 = 8$; 2009: $1350/270 = 5$; 2011: $1800/450 = 4$; 2013: $3240/540 = 6$. O maior rendimento ($0{,}8\\%$ a.m.) foi em 2007.',
    atalhoPt: 'Corte os zeros da direita nas razões: $63/9 = 7$, $96/12 = 8$, $135/27 = 5$, $180/45 = 4$, $324/54 = 6$.',
    outroCaminhoPt: 'Lembrar que $0{,}8\\%$ de $120\\ 000$ é $960$ comprova o topo na hora.',
    dicaVidaRealPt: 'Divisões entre múltiplos redondos ficam instantâneas ao cortar zeros comuns antes de dividir.',
  },
  {
    ano: 2022,
    questao: 148,
    grau: 7,
    temaId: 'enem_geometria_medidas',
    correta: 'C',
    enunciadoMarkdown:
      'Uma empresa produz e vende um tipo de chocolate, maciço, em formato de cone circular reto com as medidas do diâmetro da base e da altura iguais a $8\\text{ cm}$ e $10\\text{ cm}$, respectivamente, como apresenta a figura.\n\nDevido a um aumento de preço dos ingredientes, a empresa decide produzir esse mesmo tipo de chocolate com um **volume $19\\%$ menor**, no mesmo formato de cone circular reto com altura de $10\\text{ cm}$.\n\nPara isso, a empresa produzirá esses novos chocolates com medida do **raio** da base, em centímetro, igual a',
    alternativas: {
      A: {
        rotulo: '1,52.',
        valorNumerico: 1.52,
        diagnosticoPt: 'Você reduziu o raio multiplicando por $0{,}19$ em vez de aplicar a raiz quadrada sobre $81\\%$.',
        tagErro: 'porcentagem_base',
      },
      B: {
        rotulo: '3,24.',
        valorNumerico: 3.24,
        diagnosticoPt: 'Cuidado! Reduzir o volume em $19\\%$ mantém $81\\%$ do volume ($4 \\times 0{,}81 = 3{,}24$), mas o raio está AO QUADRADO na fórmula do volume!',
        tagErro: 'algebra_manipulacao',
      },
      C: {
        rotulo: '3,60.',
        valorNumerico: 3.6,
        diagnosticoPt: 'Excelente! O raio original mede $4\\text{ cm}$; como a altura não muda e o volume vai a $81\\%$ ($0{,}81$), $R_{\\text{novo}} = \\sqrt{0{,}81} \\times 4 = 0{,}9 \\times 4$.',
      },
      D: {
        rotulo: '6,48.',
        valorNumerico: 6.48,
        diagnosticoPt: 'Duas pegadinhas juntas: usou o DIÂMETRO ($8\\text{ cm}$) no lugar do RAIO ($4\\text{ cm}$) e esqueceu a raiz quadrada sobre $0{,}81$.',
        tagErro: 'leitura_interpretacao',
      },
      E: {
        rotulo: '7,20.',
        valorNumerico: 7.2,
        diagnosticoPt: 'Você extraiu a raiz quadrada de $0{,}81$ ($0{,}9$), mas multiplicou pelo DIÂMETRO ($8\\text{ cm}$) em vez do RAIO ($4\\text{ cm}$)!',
        tagErro: 'leitura_interpretacao',
      },
    },
    dicas: [
      'Atenção à primeira pegadinha: a figura dá $8\\text{ cm}$ de DIÂMETRO, mas a pergunta pede o RAIO!',
      'Se a altura $h = 10$ e $\\frac{1}{3}\\pi$ permanecem constantes, o volume $V = \\frac{1}{3}\\pi r^2 h$ varia proporcionalmente a $r^2$.',
      'Um volume $19\\%$ menor fica igual a $81\\%$ do original: lembre de tirar a RAIZ QUADRADA de $0{,}81$ para achar o novo raio!',
    ],
    solucaoCompletaPt: 'Raio inicial $r_0 = 8 / 2 = 4\\text{ cm}$. Como altura e $\\pi/3$ não mudam: $\\frac{V_1}{V_0} = \\left(\\frac{r_1}{r_0}\\right)^2 = 0{,}81 \\Rightarrow \\frac{r_1}{4} = \\sqrt{0{,}81} = 0{,}9 \\Rightarrow r_1 = 3{,}60\\text{ cm}$.',
    atalhoPt: 'Multiplicador do raio = $\\sqrt{1 - 0{,}19} = \\sqrt{0{,}81} = 0{,}9$, e $0{,}9 \\times 4 = 3{,}60\\text{ cm}$.',
    outroCaminhoPt: 'Calcule $V_0 = \\frac{\\pi}{3}\\cdot 16 \\cdot 10$ e iguale $0{,}81 V_0 = \\frac{\\pi}{3} r_1^2 \\cdot 10 \\Rightarrow r_1^2 = 12{,}96 \\Rightarrow r_1 = 3{,}60$.',
    dicaVidaRealPt: 'Sempre que uma fórmula tiver termo quadrático ($r^2$), descontos percentuais em volume viram raízes quadradas no raio!',
  },
  {
    ano: 2022,
    questao: 151,
    grau: 6,
    temaId: 'enem_funcoes_sequencias',
    correta: 'E',
    enunciadoMarkdown:
      'Uma máquina em operação tem sua temperatura $T$ monitorada por meio de um registro gráfico ao longo do tempo $t$. Essa máquina possui um pistão cuja velocidade $V$ varia com a temperatura $T$ de acordo com a expressão\n\n$$V = T^2 - 4$$\n\nApós a máquina funcionar durante o intervalo de tempo de $10\\text{ horas}$, o operador analisa o registro gráfico sabendo que a máquina apresenta falhas de funcionamento quando a velocidade do pistão **se anula**.\n\nQuantas vezes a velocidade do pistão se anulou durante as $10\\text{ horas}$ de funcionamento?',
    alternativas: {
      A: {
        rotulo: '1',
        valorNumerico: 1,
        diagnosticoPt: 'Você olhou apenas uma passagem por $T = 2$ ou $T = -2$; percorra a curva inteira de $t = 0$ até $t = 10\\text{ h}$.',
        tagErro: 'leitura_interpretacao',
      },
      B: {
        rotulo: '2',
        valorNumerico: 2,
        diagnosticoPt: 'Você contou apenas quantas vezes a curva cruza $T = +2^\\circ\\text{C}$, esquecendo que $T = -2^\\circ\\text{C}$ também satisfaz $T^2 - 4 = 0$!',
        tagErro: 'algebra_manipulacao',
      },
      C: {
        rotulo: '3',
        valorNumerico: 3,
        diagnosticoPt: 'Você contou apenas os três toques em $T = -2^\\circ\\text{C}$ (mínimos) e esqueceu as duas passagens por $T = +2^\\circ\\text{C}$!',
        tagErro: 'algebra_manipulacao',
      },
      D: {
        rotulo: '4',
        valorNumerico: 4,
        diagnosticoPt: 'Cuidado! A curva cruza a linha $T = 0$ quatro vezes, mas $V = 0$ ocorre quando $T = 2$ OU $T = -2$ (não quando $T = 0$)!',
        tagErro: 'leitura_interpretacao',
      },
      E: {
        rotulo: '5',
        valorNumerico: 5,
        diagnosticoPt: 'Perfeito! A velocidade anula em $T = 2$ (2 cruzamentos) e $T = -2$ (3 vales tangentes), somando exatamente todas as falhas.',
      },
    },
    dicas: [
      'O gráfico mostra a temperatura $T$, e NÃO a velocidade $V$! Descubra primeiro quais valores de $T$ zeram a fórmula $V = T^2 - 4$.',
      'Resolvendo $T^2 - 4 = 0$, você encontra DOIS valores de temperatura: um positivo e um negativo.',
      'Armadilha clássica: esquecer a raiz negativa ou contar os cruzamentos do eixo $T = 0$.',
    ],
    solucaoCompletaPt: '$V = 0 \\Rightarrow T^2 - 4 = 0 \\Rightarrow T = +2$ ou $T = -2$. No gráfico, a linha horizontal pontilhada $T = 2$ é cruzada $2$ vezes, e a linha pontilhada $T = -2$ é tocada nos $3$ vales inferiores. Total = $2 + 3 = 5$ vezes.',
    atalhoPt: 'Passe uma régua nas linhas pontilhadas $2$ e $-2$ do gráfico e conte quantos pontos de interseção aparecem.',
    outroCaminhoPt: 'Lembrar que em $t=0$ ($T=3$) e $t=10$ ($T=3$) a máquina não estava em $T = \\pm 2$.',
    dicaVidaRealPt: 'Equações de 2º grau $x^2 = k$ sempre geram duas raízes simétricas ($+\\sqrt{k}$ e $-\\sqrt{k}$) quando há valores negativos no gráfico.',
  },
  {
    ano: 2023,
    questao: 137,
    grau: 6,
    temaId: 'enem_geometria_medidas',
    correta: 'C',
    enunciadoMarkdown:
      'O mastro de uma bandeira foi instalado perpendicularmente ao solo em uma região plana. Devido aos fortes ventos, três cabos de aço de mesmo comprimento serão instalados com uma extremidade no ponto $P$ a uma altura $h$ do solo e a outra no chão, formando um ângulo $\\alpha$ com o plano do chão.\n\nPor medida de segurança, há apenas três opções de instalação:\n- opção I: $h = 11\\text{ m}$ e $\\alpha = 30^\\circ$;\n- opção II: $h = 12\\text{ m}$ e $\\alpha = 45^\\circ$;\n- opção III: $h = 18\\text{ m}$ e $\\alpha = 60^\\circ$.\n\nA opção a ser escolhida é aquela em que a medida dos cabos seja a **menor possível**. Qual será a medida, em metro, de cada um dos cabos a serem instalados?',
    alternativas: {
      A: {
        rotulo: '$\\frac{22\\sqrt{3}}{3}$',
        diagnosticoPt: 'Você calculou $11 / \\operatorname{sen} 60^\\circ$ ou dividiu pela razão errada; confira a opção II.',
        tagErro: 'geometria_escala',
      },
      B: {
        rotulo: '$11\\sqrt{2}$',
        diagnosticoPt: 'Você misturou a altura da opção I ($11\\text{ m}$) com o ângulo da opção II ($45^\\circ$).',
        tagErro: 'leitura_interpretacao',
      },
      C: {
        rotulo: '$12\\sqrt{2}$',
        diagnosticoPt: 'Correto! Comparando $22\\text{ m}$ (I), $12\\sqrt{2} \\approx 17{,}0\\text{ m}$ (II) e $12\\sqrt{3} \\approx 20{,}8\\text{ m}$ (III), a opção II gera o menor cabo.',
      },
      D: {
        rotulo: '$12\\sqrt{3}$',
        diagnosticoPt: 'Esse é o comprimento da opção III ($18 / \\operatorname{sen} 60^\\circ \\approx 20{,}8\\text{ m}$), maior que o da opção II!',
        tagErro: 'geometria_escala',
      },
      E: {
        rotulo: '$22$',
        valorNumerico: 22,
        diagnosticoPt: 'Esse é o comprimento da opção I ($11 / 0{,}5 = 22\\text{ m}$), o maior cabo entre as três opções.',
        tagErro: 'calculo_aritmetico',
      },
    },
    dicas: [
      'Cada cabo é a HIPOTENUSA de um triângulo retângulo cujo cateto oposto a $\\alpha$ é a altura $h$.',
      'Logo o comprimento do cabo vale $c = \\frac{h}{\\operatorname{sen}\\alpha}$ em cada uma das três opções.',
      'Use aproximações simples ($\\sqrt{2} \\approx 1{,}41$ e $\\sqrt{3} \\approx 1{,}73$) para descobrir qual das três opções produz o menor número!',
    ],
    solucaoCompletaPt: 'Opção I: $c_1 = \\frac{11}{\\operatorname{sen}30^\\circ} = 22\\text{ m}$. Opção II: $c_2 = \\frac{12}{\\sqrt{2}/2} = 12\\sqrt{2} \\approx 16{,}97\\text{ m}$. Opção III: $c_3 = \\frac{18}{\\sqrt{3}/2} = 12\\sqrt{3} \\approx 20{,}78\\text{ m}$. O menor comprimento é $12\\sqrt{2}\\text{ m}$.',
    atalhoPt: 'Compare $12\\sqrt{2}$ com $12\\sqrt{3}$: como $\\sqrt{2} < \\sqrt{3}$, II ganha de III na hora, e $12 \\times 1{,}41 < 22$ ganha de I.',
    outroCaminhoPt: 'Eleve os três comprimentos ao quadrado ($484$, $288$ e $432$) para comparar sem precisar aproximar raízes!',
    dicaVidaRealPt: 'Comparar quadrados elimina qualquer dúvida ao ordenar radicais sem calculadora.',
  },
  {
    ano: 2023,
    questao: 142,
    grau: 6,
    temaId: 'enem_geometria_medidas',
    correta: 'C',
    enunciadoMarkdown:
      'Sejam $a$, $b$ e $c$ as medidas dos lados de um triângulo retângulo, tendo $a$ como medida da hipotenusa. Esses valores $a$, $b$ e $c$ são, respectivamente, os diâmetros dos círculos $C_1$, $C_2$ e $C_3$, como apresentados na figura. Essa construção assegura, pelo teorema de Pitágoras, que $\\text{área}(C_1) = \\text{área}(C_2) + \\text{área}(C_3)$.\n\nUm professor lançou um desafio em uma pizzaria: foram pedidas três pizzas circulares, divididas ao meio, e o professor formou um triângulo com os três diâmetros dessas pizzas (formando um ângulo interno $\\alpha$ oposto ao lado/diâmetro da sua meia pizza).\n\nA área da pizza do professor de matemática é **maior** do que a soma das áreas das outras duas pizzas, pois',
    alternativas: {
      A: {
        rotulo: '$0^\\circ < \\alpha < 90^\\circ$',
        diagnosticoPt: 'Se $\\alpha$ for agudo ($< 90^\\circ$), a lei dos cossenos dá $a^2 < b^2 + c^2$: a pizza do professor seria MENOR que a soma das outras duas!',
        tagErro: 'geometria_escala',
      },
      B: {
        rotulo: '$\\alpha = 90^\\circ$',
        diagnosticoPt: 'No ângulo reto de $90^\\circ$, a área da maior seria exatamente IGUAL à soma das outras duas (Pitágoras).',
        tagErro: 'leitura_interpretacao',
      },
      C: {
        rotulo: '$90^\\circ < \\alpha < 180^\\circ$',
        diagnosticoPt: 'Perfeito! Quando o ângulo oposto ao lado $a$ é obtuso, temos $a^2 > b^2 + c^2$, tornando a área do círculo $a$ maior que a soma das outras duas.',
      },
      D: {
        rotulo: '$\\alpha = 180^\\circ$',
        diagnosticoPt: 'Com $180^\\circ$ os três segmentos ficam colineares (sem formar triângulo) e $a = b + c$, o que não é válido para um triângulo.',
        tagErro: 'geometria_escala',
      },
      E: {
        rotulo: '$180^\\circ < \\alpha < 360^\\circ$',
        diagnosticoPt: 'Nenhum ângulo interno de um triângulo pode atingir $180^\\circ$ ou mais.',
        tagErro: 'geometria_escala',
      },
    },
    dicas: [
      'A área de cada pizza é proporcional ao quadrado do seu diâmetro ($\\frac{\\pi d^2}{4}$).',
      'Logo, área maior que a soma equivale a $a^2 > b^2 + c^2$ — o que acontece quando esticamos o ângulo reto de $90^\\circ$?',
      'Lembre da Lei dos Cossenos ($a^2 = b^2 + c^2 - 2bc\\cos\\alpha$) e de que todo ângulo interno de triângulo está abaixo de $180^\\circ$.',
    ],
    solucaoCompletaPt: 'Pela Lei dos Cossenos, $a^2 = b^2 + c^2 - 2bc\\cos\\alpha$. Para $a^2 > b^2 + c^2$, precisamos $-2bc\\cos\\alpha > 0 \\Rightarrow \\cos\\alpha < 0$, o que ocorre em triângulos exatamente no intervalo obtusângulo $90^\\circ < \\alpha < 180^\\circ$.',
    atalhoPt: 'Em $\\alpha = 90^\\circ$ dá empate (Pitágoras); abrindo o ângulo ($> 90^\\circ$ e $< 180^\\circ$), o lado oposto $a$ estica além da hipotenusa.',
    outroCaminhoPt: 'Lembrar da classificação dos triângulos pelos lados: $a^2 > b^2 + c^2$ define triângulo obtusângulo.',
    dicaVidaRealPt: 'Uma pizza grande costuma ter área maior que duas menores exatamente porque $\\text{área} \\propto \\text{diâmetro}^2$.',
  },
  {
    ano: 2023,
    questao: 145,
    grau: 7,
    temaId: 'enem_estatistica_medias',
    correta: 'E',
    enunciadoMarkdown:
      'Uma empresa de transporte faz regularmente um levantamento do número de viagens realizadas durante o dia por todos os $160$ motoristas cadastrados em seu aplicativo. Em um certo dia, foi gerado o gráfico de barras horizontais relacionando a quantidade de motoristas com a quantidade de viagens realizadas até aquele instante do dia:\n\n- 1 viagem: 10 motoristas\n- 2 viagens: 10 motoristas\n- 3 viagens: 55 motoristas\n- 4 viagens: 25 motoristas\n- 5 viagens: 0 motoristas\n- 6 viagens: 50 motoristas\n- 7 viagens: 10 motoristas\n\nComparando os valores da **média**, da **mediana** e da **moda** da distribuição das quantidades de viagens realizadas pelos motoristas cadastrados nessa empresa, obtém-se',
    alternativas: {
      A: {
        rotulo: '$\\text{mediana} = \\text{média} < \\text{moda}$',
        diagnosticoPt: 'A moda (valor mais frequente) é apenas $3$ viagens ($55$ motoristas), enquanto os $50$ motoristas com $6$ viagens puxam a média para cima de $4$!',
        tagErro: 'estatistica_mediana',
      },
      B: {
        rotulo: '$\\text{mediana} = \\text{moda} < \\text{média}$',
        diagnosticoPt: 'Somando as frequências ($10 + 10 + 55 = 75$), o centro dos 160 motoristas (posições 80 e 81) já caiu na faixa de $4$ viagens, diferente da moda.',
        tagErro: 'estatistica_mediana',
      },
      C: {
        rotulo: '$\\text{mediana} < \\text{média} < \\text{moda}$',
        diagnosticoPt: 'Verifique qual medida vale $3$: a barra mais comprida ($55$ motoristas) marca a moda, ficando à esquerda da mediana.',
        tagErro: 'leitura_interpretacao',
      },
      D: {
        rotulo: '$\\text{moda} < \\text{média} < \\text{mediana}$',
        diagnosticoPt: 'Quase lá, mas o peso forte de $50$ motoristas em $6$ viagens eleva a média para cerca de $4{,}15$, passando acima da mediana!',
        tagErro: 'calculo_aritmetico',
      },
      E: {
        rotulo: '$\\text{moda} < \\text{mediana} < \\text{média}$',
        diagnosticoPt: 'Exato! A barra de 3 viagens lidera (moda), a posição central 80–81 cai em 4 (mediana) e os muitos motoristas com 6 viagens levam a média acima de 4.',
      },
    },
    dicas: [
      'Atenção à inversão do gráfico: o eixo VERTICAL traz os valores analisados (1 a 7 viagens) e o HORIZONTAL traz a quantidade de motoristas!',
      'Calcule na ordem do mais fácil para o mais trabalhoso: 1º Moda (barra maior); 2º Mediana (acumule até as posições 80 e 81 de 160); 3º Média ponderada.',
      'Armadilha clássica: confundir o eixo das frequências com a variável ou ignorar os 0 motoristas de 5 viagens.',
    ],
    solucaoCompletaPt: 'Moda = $3$ ($55$ ocorrências). Frequência acumulada: até 3 viagens = $10 + 10 + 55 = 75$; até 4 viagens = $75 + 25 = 100$. Logo as posições centrais 80ª e 81ª estão em 4 (Mediana $= 4$). Média = $\\frac{10(1)+10(2)+55(3)+25(4)+50(6)+10(7)}{160} = \\frac{665}{160} \\approx 4{,}16$. Logo $\\text{moda} < \\text{mediana} < \\text{média}$.',
    atalhoPt: 'Em torno de $4$: desvios abaixo ($10\\cdot(-3) + 10\\cdot(-2) + 55\\cdot(-1) = -105$) vs acima ($50\\cdot 2 + 10\\cdot 3 = +130$). Como sobra $+25$, a média é maior que 4!',
    outroCaminhoPt: 'Usar a soma de desvios em relação à mediana ($+25/160 > 0$) evita somar produtos grandes até 665.',
    dicaVidaRealPt: 'Quando houver dúvida entre mediana e média inteira adjacente, some os desvios relativos à mediana: o sinal já revela quem é maior.',
  },
  {
    ano: 2023,
    questao: 148,
    grau: 7,
    temaId: 'enem_funcoes_sequencias',
    correta: 'E',
    enunciadoMarkdown:
      'O triângulo da figura é denominado triângulo mágico. Nos círculos, escrevem-se os números de $1$ a $6$, sem repetição, com um número em cada círculo. O objetivo é distribuir os números de forma que as somas dos números em cada lado do triângulo sejam iguais.\n\nConsidere que os números colocados nos vértices do triângulo estejam em progressão aritmética de razão igual a $2$.\n\nNas condições propostas, quais as possíveis soluções para as somas dos números que formam os lados do triângulo?',
    alternativas: {
      A: {
        rotulo: 'Há somente uma solução possível, e as somas em cada lado do triângulo são iguais a 7.',
        diagnosticoPt: 'Mesmo colocando os três menores possíveis ($1, 2, 3$) a soma mínima dos lados de 1 a 6 já seria 9.',
        tagErro: 'calculo_aritmetico',
      },
      B: {
        rotulo: 'Há somente uma solução possível, e as somas em cada lado do triângulo são iguais a 9.',
        diagnosticoPt: 'Com vértices $\{1, 3, 5\}$, eles aparecem em dois lados cada: a soma dos três lados passa para $(21 + 9)/3$, que é diferente de 9!',
        tagErro: 'algebra_manipulacao',
      },
      C: {
        rotulo: 'Há somente duas soluções possíveis, uma com somas iguais a 7 e outra iguais a 9.',
        diagnosticoPt: 'Verifique a identidade fundamental do triângulo mágico: $3S = (1+2+3+4+5+6) + (v_1 + v_2 + v_3)$.',
        tagErro: 'algebra_manipulacao',
      },
      D: {
        rotulo: 'Há somente duas soluções possíveis, uma com somas iguais a 9 e outra iguais a 12.',
        diagnosticoPt: 'As somas 9 e 12 ocorreriam se os vértices fossem $\{1, 2, 3\}$ ou $\{4, 5, 6\}$ (PA de razão 1), mas a razão pedida é 2!',
        tagErro: 'leitura_interpretacao',
      },
      E: {
        rotulo: 'Há somente duas soluções possíveis, uma com somas iguais a 10 e outra iguais a 11.',
        diagnosticoPt: 'Perfeito! Os únicos trios em PA de razão 2 em $\\{1..6\\}$ são $\\{1,3,5\\}$ ($3S = 21 + 9$) e $\\{2,4,6\\}$ ($3S = 21 + 12$), gerando somas 10 e 11 válidas.',
      },
    },
    dicas: [
      'Quais são as únicas progressões aritméticas de 3 elementos e razão $2$ usando números de $1$ a $6$?',
      'Ao somar os três lados ($3S$), cada círculo do meio entra uma vez, mas os três VÉRTICES entram DUAS vezes!',
      'Use a relação $3S = (1+2+3+4+5+6) + (\\text{soma dos vértices})$ para cada uma das duas PAs possíveis e confira se os números do meio completam corretamente.',
    ],
    solucaoCompletaPt: 'PAs de razão 2 em $\\{1..6\\}$: $(1,3,5)$ com soma $9$ e $(2,4,6)$ com soma $12$. Como $3S = 21 + \\text{soma dos vértices}$: caso 1 dá $3S = 21 + 9 = 30 \\Rightarrow S = 10$ (lados $1+6+3$, $3+2+5$, $5+4+1$); caso 2 dá $3S = 21 + 12 = 33 \\Rightarrow S = 11$ (lados $2+5+4$, $4+1+6$, $6+3+2$).',
    atalhoPt: 'Ímpares nos vértices ($1+3+5 = 9$) $\\rightarrow (21+9)/3 = 10$; Pares nos vértices ($2+4+6 = 12$) $\\rightarrow (21+12)/3 = 11$.',
    outroCaminhoPt: 'Só existe um jeito de ter razão 2 sem ultrapassar 6: começar em 1 ou em 2!',
    dicaVidaRealPt: 'Contar quantas vezes os cantos repetem na soma de polígonos resolve qualquer quebra-cabeça mágico.',
  },
  {
    ano: 2024,
    questao: 136,
    grau: 5,
    temaId: 'enem_funcoes_sequencias',
    correta: 'C',
    enunciadoMarkdown:
      'Uma empresa produz mochilas escolares sob encomenda. Essa empresa tem um custo total de produção, composto por um custo fixo, que não depende do número de mochilas, mais um custo variável, que é proporcional ao número de mochilas produzidas. O custo total cresce de forma linear, e a tabela apresenta esse custo para três quantidades produzidas:\n\n| Quantidade de mochilas | 30 | 50 | 100 |\n| :--- | :---: | :---: | :---: |\n| **Custo total (R$)** | 1 050,00 | 1 650,00 | 3 150,00 |\n\nO custo total, em real, para a produção de $80$ mochilas será',
    alternativas: {
      A: {
        rotulo: '2 400,00.',
        valorNumerico: 2400,
        diagnosticoPt: 'Você multiplicou $80$ mochilas pelo custo variável unitário (R$ 30,00) e esqueceu de somar o custo fixo de R$ 150,00!',
        tagErro: 'leitura_interpretacao',
      },
      B: {
        rotulo: '2 520,00.',
        valorNumerico: 2520,
        diagnosticoPt: 'Se você dividiu R$ 3.150,00 por 100 e multiplicou por 80 ($31{,}50 \\times 80$), usou proporção direta ignorando o custo fixo!',
        tagErro: 'proporcao_invertida',
      },
      C: {
        rotulo: '2 550,00.',
        valorNumerico: 2550,
        diagnosticoPt: 'Correto! Cada mochila extra acrescenta R$ 30,00 ao custo; somando $30 \\times 30 = 900$ ao fixo de R$ 150, chega-se a esse valor para 80 unidades.',
      },
      D: {
        rotulo: '2 700,00.',
        valorNumerico: 2700,
        diagnosticoPt: 'Verifique a variação de 50 para 100 mochilas: $1.500 \\div 50$ dá R$ 30,00/mochila, logo 30 mochilas extras sobre 50 somam R$ 900,00.',
        tagErro: 'calculo_aritmetico',
      },
      E: {
        rotulo: '2 800,00.',
        valorNumerico: 2800,
        diagnosticoPt: 'Regra de três direta com a coluna de 30 mochilas ($1.050/30 \\times 80$) superestima o resultado por multiplicar também o custo fixo!',
        tagErro: 'proporcao_invertida',
      },
    },
    dicas: [
      'Como há um custo FIXO na conta, fazer regra de três direta com uma única coluna da tabela falha.',
      'Compare duas colunas quaisquer (por exemplo, 50 e 100 mochilas): toda a diferença em reais veio só das 50 mochilas extras!',
      'Achado o custo por unidade extra, some $30$ unidades ao custo de $50$ mochilas (ou subtraia $20$ do custo de $100$).',
    ],
    solucaoCompletaPt: 'Taxa variável = $\\frac{3\\ 150 - 1\\ 650}{100 - 50} = \\frac{1\\ 500}{50} =$ R$ 30,00/mochila. Partindo de 50 mochilas para 80: $1\\ 650 + 30 \\times 30 = 1\\ 650 + 900 =$ R$ 2 550,00.',
    atalhoPt: 'Média entre $30$ e $100$? Não, $80 = 50 + 30$, e o custo para $30$ extras é $30 \\times 30 = 900$ (sem repetir o fixo).',
    outroCaminhoPt: 'Repare também que $50 + 30 = 80$: $C(50) + C(30) - \\text{fixo} = 1650 + 1050 - 150 = 2550$.',
    dicaVidaRealPt: 'Subtrair duas linhas numa função linear cancela automaticamente o valor fixo desconhecido.',
  },
  {
    ano: 2024,
    questao: 137,
    grau: 5,
    temaId: 'enem_estatistica_medias',
    correta: 'E',
    enunciadoMarkdown:
      'A umidade relativa do ar é um dos indicadores utilizados na meteorologia para fazer previsões sobre o clima. O quadro apresenta as médias mensais, em porcentagem, da umidade relativa do ar em um período de seis meses consecutivos em uma cidade:\n\n| Meses | Maio | Jun. | Jul. | Ago. | Set. | Out. |\n| :--- | :---: | :---: | :---: | :---: | :---: | :---: |\n| **Umidade (%)** | 66 | 64 | 54 | 46 | 60 | 64 |\n\nNessa cidade, a **mediana** desses dados, em porcentagem, da umidade relativa do ar no período considerado foi',
    alternativas: {
      A: {
        rotulo: '56.',
        valorNumerico: 56,
        diagnosticoPt: 'Você calculou o ponto médio entre extremos ($46$ e $66$) ou errou a ordem crescente da série.',
        tagErro: 'estatistica_mediana',
      },
      B: {
        rotulo: '58.',
        valorNumerico: 58,
        diagnosticoPt: 'Você esqueceu de incluir o número repetido ($64$) antes de ordenar os seis valores.',
        tagErro: 'estatistica_mediana',
      },
      C: {
        rotulo: '59.',
        valorNumerico: 59,
        diagnosticoPt: 'Esse valor está muito próximo da média aritmética ($354 / 6$), e NÃO da mediana! Coloque os valores em ordem crescente.',
        tagErro: 'leitura_interpretacao',
      },
      D: {
        rotulo: '60.',
        valorNumerico: 60,
        diagnosticoPt: '60% é apenas o 3º valor ordenado, enquanto para 6 números a mediana é a média entre o 3º e o 4º termo!',
        tagErro: 'estatistica_mediana',
      },
      E: {
        rotulo: '62.',
        valorNumerico: 62,
        diagnosticoPt: 'Correto! Ordenando como $46, 54, 60, 64, 64, 66$, os dois termos centrais são $60$ e $64$, cuja média fecha a resposta.',
      },
    },
    dicas: [
      'A mediana nunca deve ser lida na ordem cronológica dos meses da tabela: é obrigatório ORDENAR os valores primeiro!',
      'Mantenha todas as repetições (o $64$ aparece duas vezes) para ter 6 termos ao todo.',
      'Armadilha dupla: pegar o meio da tabela sem ordenar ($54$ e $46$) ou parar na média aritmética.',
    ],
    solucaoCompletaPt: 'Dados em ordem crescente: $46, 54, 60, 64, 64, 66$. Com 6 observações (quantidade par), a mediana é a média aritmética do 3º e 4º elementos: $\\frac{60 + 64}{2} = 62\\%$.',
    atalhoPt: 'Corte os 2 menores ($46, 54$) e os 2 maiores ($64, 66$): sobram no meio $60$ e $64$.',
    outroCaminhoPt: 'A média exata entre $60$ e $64$ é o número que fica a 2 unidades de cada um.',
    dicaVidaRealPt: 'Sempre confirme se há repetições no conjunto antes de pegar os termos centrais da mediana.',
  },
  {
    ano: 2024,
    questao: 144,
    grau: 7,
    temaId: 'enem_geometria_medidas',
    correta: 'D',
    enunciadoMarkdown:
      'Um sistema de polias circulares e correias é um dos mecanismos responsáveis pela transmissão de movimento em máquinas rotativas. O manual de um motor traz uma figura representando um sistema composto por duas polias e uma correia de transmissão, tensionada e perfeitamente ajustada sobre as polias, com dois trechos retos tangentes medindo $15\\text{ cm}$ cada, uma polia menor de raio $r = 4\\text{ cm}$ (com arco interno de $150^\\circ$) e uma polia maior de raio $R = 8\\text{ cm}$.\n\nConsidere $3$ como valor aproximado para $\\pi$.\n\nA medida do comprimento dessa correia, em centímetro, é',
    alternativas: {
      A: {
        rotulo: '54.',
        valorNumerico: 54,
        diagnosticoPt: 'Faltou o comprimento de um dos arcos circulares ou considerou apenas o menor raio envolvendo a maior parte da correia.',
        tagErro: 'geometria_escala',
      },
      B: {
        rotulo: '60.',
        valorNumerico: 60,
        diagnosticoPt: 'Você calculou metade de cada circunferência ($180^\\circ$ em cada polia), ignorando que a polia menor abraça menos que $180^\\circ$ e a maior abraça mais!',
        tagErro: 'geometria_escala',
      },
      C: {
        rotulo: '66.',
        valorNumerico: 66,
        diagnosticoPt: 'Se os raios trocados ou se usasse $210^\\circ$ na maior com pequena diferença angular daria próximo, mas confira o ângulo abraçado na polia $A$.',
        tagErro: 'calculo_aritmetico',
      },
      D: {
        rotulo: '68.',
        valorNumerico: 68,
        diagnosticoPt: 'Perfeito! Os trechos retos somam $30\\text{ cm}$, o contato na polia menor ($150^\\circ$) mede $10\\text{ cm}$ e na polia maior ($210^\\circ$) mede $28\\text{ cm}$.',
      },
      E: {
        rotulo: '72.',
        valorNumerico: 72,
        diagnosticoPt: 'Você aplicou o ângulo errado ($210^\\circ$ vs $240^\\circ$) ou somou uma circunferência inteira da polia maior.',
        tagErro: 'calculo_aritmetico',
      },
    },
    dicas: [
      'Divida a correia fechada em 4 partes: os dois segmentos retos de $15\\text{ cm}$ + o arco abraçado na polia menor + o arco abraçado na polia maior.',
      'Os dois raios nas tangentes formam $90^\\circ$ com a correia; por paralelismo das tangentes contrapostas, se a polia menor abraça $150^\\circ$ pelo lado esquerdo, a polia maior abraça exatamente o complemento para $360^\\circ$ ($210^\\circ$) pelo lado direito!',
      'Calcule o comprimento de cada arco usando regra de três com o perímetro da respectiva polia ($2\\pi r$ e $2\\pi R$, com $\\pi = 3$).',
    ],
    solucaoCompletaPt: 'Trechos retos: $15 + 15 = 30\\text{ cm}$. Circunferência menor: $C_r = 2\\cdot 3\\cdot 4 = 24\\text{ cm}$; arco de $150^\\circ$: $\\frac{150}{360}\\times 24 = 10\\text{ cm}$. Na polia maior, o ângulo abraçado é $360^\\circ - 150^\\circ = 210^\\circ$; circunferência maior: $C_R = 2\\cdot 3\\cdot 8 = 48\\text{ cm}$; arco: $\\frac{210}{360}\\times 48 = 28\\text{ cm}$. Total = $30 + 10 + 28 = 68\\text{ cm}$.',
    atalhoPt: 'Note que $24\\text{ cm} / 360^\\circ$ dá $2\\text{ cm}$ por $30^\\circ$! Logo $150^\\circ = 5\\times 2 = 10\\text{ cm}$. Na maior ($R=2r$), cada $30^\\circ$ vale $4\\text{ cm}$, logo $210^\\circ = 7\\times 4 = 28\\text{ cm}$.',
    outroCaminhoPt: 'Semi-soma = $30 + 18 + 20 = 68$ usando que a polia maior ganha $30^\\circ$ sobre $180^\\circ$ ($+4$) enquanto a menor perde $30^\\circ$ ($-2$), líquido $+2\\text{ cm}$ sobre $66$? Cuidado: $C_R/2 + C_r/2 = 24 + 12 = 36$, $+30 = 66$, mais diferença $(4 - 2) = +2 \\Rightarrow 68\\text{ cm}$!',
    dicaVidaRealPt: 'Em qualquer sistema de duas polias com correia aberta, a soma dos dois ângulos abraçados é sempre $360^\\circ$.',
  },
]

export const ENEM_MATEMATICA_LOTE5: readonly DesafioUnificado[] = SPECS_LOTE5.map(construirDesafioEnem)
