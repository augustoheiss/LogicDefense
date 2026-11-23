/**
 * Lote 1 — questões oficiais de Matemática do Vestibulinho ETEC (Centro Paula Souza).
 * Enunciados e gabaritos conferidos diretamente nos PDFs originais e gabaritos oficiais (2016–2020).
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

interface SpecEtecOficial {
  readonly id: string
  readonly ano: number
  readonly semestre: 1 | 2
  readonly questao: number
  readonly grau: 5 | 6 | 7
  readonly temaId: string
  readonly chaveFigura?: string
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

function construirDesafioEtec(s: SpecEtecOficial): DesafioUnificado {
  const letras = ['A', 'B', 'C', 'D', 'E'] as const
  const alts: AlternativaUnificada[] = letras.map((letra) => {
    const a = s.alternativas[letra]
    return {
      id: `${s.id}_${letra}`,
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
  return {
    id: s.id,
    assinatura: s.id,
    origem: 'etec_oficial',
    grau: s.grau as GrauDificuldade,
    temaId: s.temaId,
    temaTituloPt: tituloDoTema(s.temaId),
    arquetipoOuItemId: s.id,
    chaveFigura: s.chaveFigura,
    referenciaOficial: {
      exame: 'ETEC',
      ano: s.ano,
      questao: s.questao,
      licenca: 'Acervo oficial Vestibulinho ETEC (CPS)',
      citacaoCurta: `ETEC ${s.ano} · ${s.semestre}º Sem · Q.${s.questao}`,
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

const SPECS_ETEC: readonly SpecEtecOficial[] = [
  {
    id: 'etec_2016_2_q26',
    ano: 2016,
    semestre: 2,
    questao: 26,
    grau: 5,
    temaId: 'enem_geometria_medidas',
    chaveFigura: 'etec:2016:2:26',
    correta: 'D',
    enunciadoMarkdown:
      'Os condutos forçados em uma usina hidrelétrica são, na maioria dos casos, tubulações cilíndricas que escoam o líquido sob uma pressão diferente da atmosfera.\n\nNa imagem, temos a representação da secção transversal de um conduto forçado cilíndrico, na qual as circunferências são concêntricas (centro no ponto $C$) e a região ocupada entre a circunferência maior e a circunferência menor é chamada de coroa circular.\n\nSabendo que o raio da circunferência maior mede 15 metros e o raio da circunferência menor mede 10 metros (considere $\\text{Área do círculo} = \\pi r^2$ e $\\pi = 3$), podemos afirmar que a área da coroa circular é, em $\\text{m}^2$,',
    alternativas: {
      A: {
        rotulo: '75.',
        valorNumerico: 75,
        diagnosticoPt: 'Você calculou $\\pi(R - r)^2$ em vez da diferença entre as áreas dos dois círculos ($\\pi R^2 - \\pi r^2$).',
        tagErro: 'algebra_manipulacao',
      },
      B: {
        rotulo: '125.',
        valorNumerico: 125,
        diagnosticoPt: 'Você encontrou $15^2 - 10^2$ corretamente, mas esqueceu de multiplicar o resultado por $\\pi = 3$.',
        tagErro: 'leitura_interpretacao',
      },
      C: {
        rotulo: '225.',
        valorNumerico: 225,
        diagnosticoPt: 'Esse valor corresponde apenas ao quadrado do raio maior sem descontar a região interna nem multiplicar por $\\pi$.',
        tagErro: 'calculo_aritmetico',
      },
      D: {
        rotulo: '375.',
        valorNumerico: 375,
        diagnosticoPt: 'Exato! A área da coroa circular é a área do círculo externo menos a do círculo interno.',
      },
      E: {
        rotulo: '675.',
        valorNumerico: 675,
        diagnosticoPt: 'Você calculou a área total do círculo maior ($3 \\times 15^2$), esquecendo de subtrair o núcleo vazio interno.',
        tagErro: 'leitura_interpretacao',
      },
    },
    dicas: [
      'A coroa circular é o anel que sobra quando recortamos o círculo menor de dentro do círculo maior.',
      'Calcule separadamente a área do círculo externo e a do círculo interno usando $\\pi = 3$, depois faça a subtração.',
      'Armadilha clássica: fazer $(R - r)^2$ em vez de $R^2 - r^2$ antes de multiplicar por $\\pi$.',
    ],
    solucaoCompletaPt: 'Área maior = $3 \\times 15^2 = 675\\text{ m}^2$. Área menor = $3 \\times 10^2 = 300\\text{ m}^2$. Área da coroa = $675 - 300 = 375\\text{ m}^2$.',
    atalhoPt: 'Fatore $\\pi(R^2 - r^2) = 3 \\times (15 - 10)(15 + 10) = 3 \\times 5 \\times 25 = 375$.',
    outroCaminhoPt: 'Multiplique $3$ pela diferença de quadrados $225 - 100$.',
    dicaVidaRealPt: 'Tubos, arruelas e anéis estruturais têm secção calculada sempre por diferença de áreas.',
  },
  {
    id: 'etec_2016_2_q27',
    ano: 2016,
    semestre: 2,
    questao: 27,
    grau: 5,
    temaId: 'enem_razoes_escalas',
    correta: 'E',
    enunciadoMarkdown:
      'Vertedouro é um canal artificial com a finalidade de conduzir a água através de uma barreira. Nas usinas hidrelétricas, os vertedouros são importantes pois escoam o excesso de água, regulando seu nível. A capacidade máxima de escoamento do vertedouro da usina de Itaipu é de $62\\ 200\\text{ m}^3/\\text{s}$, correspondente a 40 vezes a vazão média das Cataratas do Iguaçu.\n\nSobre o texto, é correto concluir que a vazão média das Cataratas do Iguaçu é, em $\\text{m}^3/\\text{min}$,',
    alternativas: {
      A: {
        rotulo: '10 337.',
        valorNumerico: 10337,
        diagnosticoPt: 'Confira a divisão de $62\\ 200$ por $40$ e a multiplicação por $60$ segundos para converter para minuto.',
        tagErro: 'calculo_aritmetico',
      },
      B: {
        rotulo: '29 033.',
        valorNumerico: 29033,
        diagnosticoPt: 'Você errou um fator na conversão de segundo para minuto ou dividiu por um divisor diferente de $40$.',
        tagErro: 'conversao_unidades',
      },
      C: {
        rotulo: '50 373.',
        valorNumerico: 50373,
        diagnosticoPt: 'Refaça a simplificação $\\frac{62\\ 200}{40} \\times 60$; o fator líquido equivale a multiplicar $62\\ 200$ por $1{,}5$.',
        tagErro: 'calculo_aritmetico',
      },
      D: {
        rotulo: '74 330.',
        valorNumerico: 74330,
        diagnosticoPt: 'Observe que dividir por $40$ e multiplicar por $60$ aumenta o número original em metade dele mesmo.',
        tagErro: 'proporcao_invertida',
      },
      E: {
        rotulo: '93 300.',
        valorNumerico: 93300,
        diagnosticoPt: 'Perfeito! Primeiro acha-se a vazão em $\\text{m}^3/\\text{s}$ dividindo por 40 e depois converte-se para $\\text{m}^3/\\text{min}$ multiplicando por 60.',
      },
    },
    dicas: [
      'Atenção à unidade pedida na pergunta: o dado de Itaipu está por SEGUNDO, mas a resposta pede por MINUTO.',
      'Primeiro divida a vazão de Itaipu por 40 para achar a das Cataratas por segundo; em seguida multiplique por 60.',
      'Dica rápida: fazer $\\times 60 \\div 40$ é exatamente multiplicar o valor por $1{,}5$!',
    ],
    solucaoCompletaPt: 'Vazão das Cataratas em $\\text{m}^3/\\text{s} = 62\\ 200 \\div 40 = 1\\ 555\\text{ m}^3/\\text{s}$. Em 1 minuto (60 s): $1\\ 555 \\times 60 = 93\\ 300\\text{ m}^3/\\text{min}$.',
    atalhoPt: '$62\\ 200 \\times \\frac{60}{40} = 62\\ 200 \\times 1{,}5 = 62\\ 200 + 31\\ 100 = 93\\ 300$.',
    outroCaminhoPt: 'Multiplique $62\\ 200 \\times 60$ para passar a $\\text{m}^3/\\text{min}$ e só depois divida por $40$.',
    dicaVidaRealPt: 'Combinar razões de conversão antes da conta evita trabalhar com decimais desnecessários.',
  },
  {
    id: 'etec_2016_2_q29',
    ano: 2016,
    semestre: 2,
    questao: 29,
    grau: 6,
    temaId: 'enem_geometria_medidas',
    chaveFigura: 'etec:2016:2:29',
    correta: 'D',
    enunciadoMarkdown:
      'As barragens são elementos fundamentais para as usinas hidrelétricas. O trapézio $ABCD$ da imagem é um modelo matemático que representa um corte vertical de uma barragem.\n\nNa imagem, a crista mede 10 metros, a altura mede 12 metros, o talude de montante mede 13 metros e o talude de jusante mede 15 metros.\n\nPara calcular a medida da base, considere o primeiro triângulo retângulo formado pelo talude de montante (hipotenusa 13 m), pela altura (12 m) e por uma projeção $x$ na base, onde $x^2 + 12^2 = 13^2 \\Rightarrow x = 5\\text{ m}$.\n\nConsidere também o segundo triângulo retângulo, com hipotenusa igual ao talude de jusante (15 m), altura (12 m) e outra projeção $y$ na base.\n\nApós aplicar o Teorema de Pitágoras no segundo triângulo, podemos concluir que a medida total da base do trapézio é, em metros,',
    alternativas: {
      A: {
        rotulo: '5.',
        valorNumerico: 5,
        diagnosticoPt: 'Esse é apenas o cateto $x$ do triângulo da esquerda, não a base inteira da barragem.',
        tagErro: 'leitura_interpretacao',
      },
      B: {
        rotulo: '9.',
        valorNumerico: 9,
        diagnosticoPt: 'Você encontrou apenas a projeção $y$ do talude da direita; ainda falta somar $x$ e a crista do meio.',
        tagErro: 'leitura_interpretacao',
      },
      C: {
        rotulo: '14.',
        valorNumerico: 14,
        diagnosticoPt: 'Você somou as duas pontas laterais ($x + y$), mas esqueceu o trecho central abaixo da crista.',
        tagErro: 'geometria_escala',
      },
      D: {
        rotulo: '24.',
        valorNumerico: 24,
        diagnosticoPt: 'Excelente! Somou corretamente as duas projeções laterais ($5 + 9$) com o segmento central igual à crista ($10$).',
      },
      E: {
        rotulo: '50.',
        valorNumerico: 50,
        diagnosticoPt: 'Confira a soma da base inferior: você somou medidas inclinadas dos taludes em vez das projeções horizontais.',
        tagErro: 'geometria_escala',
      },
    },
    dicas: [
      'Desenhe as duas alturas descendo dos vértices da crista até a base: elas dividem a base em três trechos.',
      'Use Pitágoras no triângulo da direita ($y^2 + 12^2 = 15^2$) para achar $y$ e depois some os três pedaços da base.',
      'Armadilha comum: calcular $y$ certinho e esquecer que a base total inclui também a projeção esquerda e a largura da crista.',
    ],
    solucaoCompletaPt: 'No segundo triângulo: $y^2 + 12^2 = 15^2 \\Rightarrow y^2 = 225 - 144 = 81 \\Rightarrow y = 9\\text{ m}$. A base é a soma dos três segmentos horizontais: $x + \\text{crista} + y = 5 + 10 + 9 = 24\\text{ m}$.',
    atalhoPt: 'Reconheça os triângulos pitagóricos clássicos: $(5, 12, 13)$ e $3\\times(3, 4, 5) = (9, 12, 15)$. Base = $5 + 10 + 9$.',
    outroCaminhoPt: 'Projete $A$ e $B$ perpendicularmente sobre $DC$ formando um retângulo central de base 10 m entre os dois triângulos.',
    dicaVidaRealPt: 'Conhecer os ternos $(3,4,5)$ e $(5,12,13)$ agiliza questões de geometria em provas técnicas.',
  },
  {
    id: 'etec_2017_1_q09',
    ano: 2017,
    semestre: 1,
    questao: 9,
    grau: 5,
    temaId: 'enem_geometria_medidas',
    correta: 'A',
    enunciadoMarkdown:
      'Um painel fotovoltaico converte energia solar em energia elétrica de forma sustentável. Suponha que, em uma região plana, será instalado um sistema de painéis fotovoltaicos para suprir uma comunidade com energia elétrica. Segue a descrição de alguns itens do projeto:\n\n- instalação de 5 filas paralelas entre si, cada fila contendo 10 painéis;\n- cada painel foi montado com 4 módulos fotovoltaicos congruentes entre si;\n- em cada módulo fotovoltaico, a superfície de captação é retangular, com dimensões de $65\\text{ cm}$ por $150\\text{ cm}$.\n\nNo projeto descrito, a área total da superfície de captação de energia solar é, em metros quadrados,',
    alternativas: {
      A: {
        rotulo: '195.',
        valorNumerico: 195,
        diagnosticoPt: 'Correto! Convertendo as dimensões do módulo para metros ($0{,}65\\text{ m} \\times 1{,}50\\text{ m}$) e multiplicando pelos 200 módulos, obtém-se a área exata.',
      },
      B: {
        rotulo: '185.',
        valorNumerico: 185,
        diagnosticoPt: 'Verifique a multiplicação de $0{,}65 \\times 1{,}5$ por $200$ módulos: houve pequeno erro de arredondamento.',
        tagErro: 'calculo_aritmetico',
      },
      C: {
        rotulo: '175.',
        valorNumerico: 175,
        diagnosticoPt: 'Reveja o produto das dimensões em metro quadrado pela quantidade total de módulos ($5 \\times 10 \\times 4$).',
        tagErro: 'calculo_aritmetico',
      },
      D: {
        rotulo: '165.',
        valorNumerico: 165,
        diagnosticoPt: 'Confira tanto a contagem total de módulos nas 5 filas quanto o cálculo de área de cada placa retangular.',
        tagErro: 'leitura_interpretacao',
      },
      E: {
        rotulo: '155.',
        valorNumerico: 155,
        diagnosticoPt: 'A área de um retângulo de $0{,}65\\text{ m} \\times 1{,}5\\text{ m}$ fica próxima de $1\\text{ m}^2$; para 200 módulos, o resultado é maior.',
        tagErro: 'conversao_unidades',
      },
    },
    dicas: [
      'Primeiro conte quantos módulos existem ao todo multiplicando filas, painéis por fila e módulos por painel.',
      'Converta $65\\text{ cm}$ e $150\\text{ cm}$ para metros ANTES de calcular a área para já obter a resposta em $\\text{m}^2$.',
      'Armadilha: esquecer que $1\\text{ m}^2 = 10\\ 000\\text{ cm}^2$ se multiplicar tudo em centímetros primeiro.',
    ],
    solucaoCompletaPt: 'Total de módulos = $5 \\times 10 \\times 4 = 200$. Área de 1 módulo = $0{,}65\\text{ m} \\times 1{,}50\\text{ m} = 0{,}975\\text{ m}^2$. Total = $200 \\times 0{,}975 = 195\\text{ m}^2$.',
    atalhoPt: '$200 \\times 0{,}65 = 130$; depois $130 \\times 1{,}5 = 130 + 65 = 195$.',
    outroCaminhoPt: 'Em $\\text{cm}^2$: $65 \\times 150 = 9\\ 750\\text{ cm}^2 = 0{,}975\\text{ m}^2$, vezes $200 = 195\\text{ m}^2$.',
    dicaVidaRealPt: 'Converter medidas lineares para metros antes de multiplicar sempre evita erros de potência de 10.',
  },
  {
    id: 'etec_2017_1_q10',
    ano: 2017,
    semestre: 1,
    questao: 10,
    grau: 7,
    temaId: 'enem_geometria_medidas',
    chaveFigura: 'etec:2017:1:10',
    correta: 'B',
    enunciadoMarkdown:
      'A figura apresenta o modelo matemático para determinar a distância mínima $d = BC$ entre dois painéis solares adjacentes instalados em filas paralelas, de modo que um não faça sombra sobre o outro.\n\nCada painel tem comprimento total $AB = 130\\text{ cm}$ (formado por dois módulos de $65\\text{ cm}$ apoiados lado a lado no sentido inclinado). Na figura:\n- $AH$ é perpendicular ao solo ($\\triangle AHB$ é retângulo em $H$);\n- $\\beta = 21{,}80^\\circ$ é o ângulo de incidência solar em relação ao solo;\n- dados: $\\operatorname{sen} 21{,}80^\\circ = 0{,}3714$, $\\cos 21{,}80^\\circ = 0{,}9285$ e $\\operatorname{tg} 21{,}80^\\circ = 0{,}40$.\n\nSabendo que $BH = 120\\text{ cm}$, a distância mínima $d = CB$ entre os painéis é, em metros,',
    alternativas: {
      A: {
        rotulo: '2,35.',
        valorNumerico: 2.35,
        diagnosticoPt: 'Verifique a soma da sombra $CH$ com a projeção $BH = 1{,}20\\text{ m}$ após encontrar a altura $AH$ via Pitágoras.',
        tagErro: 'calculo_aritmetico',
      },
      B: {
        rotulo: '2,45.',
        valorNumerico: 2.45,
        diagnosticoPt: 'Perfeito! Pelo terno $(50, 120, 130)$ temos altura $AH = 0{,}50\\text{ m}$, sombra $CH = 0{,}50 / 0{,}40 = 1{,}25\\text{ m}$ e distância total $1{,}25 + 1{,}20$.',
      },
      C: {
        rotulo: '2,55.',
        valorNumerico: 2.55,
        diagnosticoPt: 'Confira a divisão da altura pela tangente de $21{,}80^\\circ$ ($0{,}40$) ao determinar o trecho $CH$.',
        tagErro: 'geometria_escala',
      },
      D: {
        rotulo: '2,65.',
        valorNumerico: 2.65,
        diagnosticoPt: 'Lembre-se de que a hipotenusa $AB$ vale $130\\text{ cm}$ e o cateto $BH$ vale $120\\text{ cm}$, tornando a altura exata.',
        tagErro: 'calculo_aritmetico',
      },
      E: {
        rotulo: '2,75.',
        valorNumerico: 2.75,
        diagnosticoPt: 'Não some o comprimento inclinado do painel à sombra; a distância $BC$ no solo é $BH + CH$.',
        tagErro: 'leitura_interpretacao',
      },
    },
    dicas: [
      'Observe que a distância $BC$ no solo é a soma de dois trechos: $BH$ (já conhecido) e $CH$ (projeção da sombra).',
      'Use o Teorema de Pitágoras no triângulo $AHB$ para descobrir a altura $AH$, e depois use ângulos alternos internos no vértice $C$ com $\\operatorname{tg}\\beta = \\frac{AH}{CH}$.',
      'Dica: o triângulo $AHB$ tem cateto $120\\text{ cm}$ e hipotenusa $130\\text{ cm}$ — lembra do terno $(5, 12, 13)$!',
    ],
    solucaoCompletaPt: 'Em $\\triangle AHB$: $AH = \\sqrt{130^2 - 120^2} = 50\\text{ cm} = 0{,}50\\text{ m}$. Pelo paralelismo da reta em $A$ com o solo, $\\widehat{ACH} = \\beta = 21{,}80^\\circ$. Logo $\\operatorname{tg}21{,}80^\\circ = \\frac{AH}{CH} \\Rightarrow 0{,}40 = \\frac{0{,}50}{CH} \\Rightarrow CH = 1{,}25\\text{ m}$. Portanto $d = CH + HB = 1{,}25 + 1{,}20 = 2{,}45\\text{ m}$.',
    atalhoPt: 'Terno $10\\times(5,12,13)$ dá $AH = 0{,}5\\text{ m}$; dividir por $0{,}4$ é multiplicar por $2{,}5$: $CH = 1{,}25\\text{ m}$; $+1{,}20 = 2{,}45\\text{ m}$.',
    outroCaminhoPt: 'Usar $\\operatorname{tg}\\beta = 2/5$ mantém todas as contas em frações exatas.',
    dicaVidaRealPt: 'Engenheiros solares calculam o espaçamento entre fileiras pelo ângulo solar do solstício de inverno.',
  },
  {
    id: 'etec_2017_1_q29',
    ano: 2017,
    semestre: 1,
    questao: 29,
    grau: 5,
    temaId: 'enem_razoes_escalas',
    correta: 'B',
    enunciadoMarkdown:
      'Para saber se você e os moradores de sua casa são consumidores moderados de água, basta encontrar o consumo médio por pessoa por dia. Se o resultado for:\n- menor que $150\\text{ L}$ por pessoa, significa que praticam a economia de água;\n- entre $150\\text{ L}$ e $300\\text{ L}$, estão no limite do bom senso;\n- maior que $300\\text{ L}$, devem refletir sobre a utilização ou averiguar vazamentos.\n\nO consumo de água referente ao mês de setembro (30 dias) de uma residência com 5 moradores foi de $25\\text{ m}^3$.\n\nSobre o consumo médio por morador por dia, é correto afirmar que esses moradores',
    alternativas: {
      A: {
        rotulo: 'praticam a economia de água.',
        diagnosticoPt: 'Você obteve menos de $150\\text{ L/dia}$ provavelmente por esquecer que $1\\text{ m}^3 = 1\\ 000\\text{ L}$ ou por dividir mal os 30 dias.',
        tagErro: 'conversao_unidades',
      },
      B: {
        rotulo: 'estão no limite do bom senso.',
        diagnosticoPt: 'Correto! $25\\ 000\\text{ L}$ divididos por $30$ dias e por $5$ moradores dão cerca de $166{,}7\\text{ L/(pessoa}\\cdot\\text{dia)}$.',
      },
      C: {
        rotulo: 'consomem menos do que os que praticam a economia de água.',
        diagnosticoPt: 'Refaça a divisão do volume em litros pelo produto de moradores vezes dias de setembro.',
        tagErro: 'calculo_aritmetico',
      },
      D: {
        rotulo: 'devem refletir sobre a utilização da água na sua casa.',
        diagnosticoPt: 'Se deu acima de $300\\text{ L/dia}$, você esqueceu de dividir pelos 5 moradores ou pelos 30 dias do mês.',
        tagErro: 'leitura_interpretacao',
      },
      E: {
        rotulo: 'devem averiguar a existência de possíveis vazamentos na residência.',
        diagnosticoPt: 'Esse alerta vale apenas para médias superiores a $300\\text{ L}$ por pessoa por dia.',
        tagErro: 'leitura_interpretacao',
      },
    },
    dicas: [
      'Lembre-se de que $1\\text{ m}^3$ equivale a $1\\ 000\\text{ litros}$ e o mês de setembro tem $30$ dias.',
      'Converta os $25\\text{ m}^3$ para litros e divida pelo total de "pessoas-dia" ($5 \\times 30$).',
      'Armadilha: esquecer de dividir pelo número de moradores ou pelo número de dias do mês.',
    ],
    solucaoCompletaPt: 'Volume mensal = $25\\text{ m}^3 = 25\\ 000\\text{ L}$. Por dia da casa = $25\\ 000 \\div 30 \\approx 833{,}3\\text{ L/dia}$. Por pessoa por dia = $833{,}3 \\div 5 \\approx 166{,}7\\text{ L}$, valor situado entre $150\\text{ L}$ e $300\\text{ L}$.',
    atalhoPt: '$25\\ 000 \\div (5 \\times 30) = 25\\ 000 \\div 150 = 500/3 \\approx 166{,}7\\text{ L}$.',
    outroCaminhoPt: 'Multiplique $150\\text{ L} \\times 5 \\times 30 = 22{,}5\\text{ m}^3$ e $300\\text{ L} \\times 5 \\times 30 = 45\\text{ m}^3$; $25\\text{ m}^3$ fica dentro dessa faixa.',
    dicaVidaRealPt: 'Comparar diretamente na unidade da conta de água ($\\text{m}^3$) evita divisões quebradas.',
  },
  {
    id: 'etec_2017_2_q35',
    ano: 2017,
    semestre: 2,
    questao: 35,
    grau: 6,
    temaId: 'enem_geometria_medidas',
    chaveFigura: 'etec:2017:2:35',
    correta: 'D',
    enunciadoMarkdown:
      'Observe o Tangram, em uma possível disposição de suas peças. Na figura, tem-se que:\n\n- $QS$ é paralelo a $BD$;\n- os polígonos $ABCD$ e $OPQR$ são quadrados;\n- $S$ é ponto médio de $CD$;\n- $P$ é ponto médio de $OB$;\n- $O$ é ponto médio de $BD$.\n\nSe a área do triângulo $ABO$ é $16\\text{ cm}^2$, a área do quadrado $OPQR$ é, em centímetros quadrados,',
    alternativas: {
      A: {
        rotulo: '2.',
        valorNumerico: 2,
        diagnosticoPt: 'Você dividiu a área grande vezes demais; o quadrado central do Tangram corresponde a um oitavo do quadrado total.',
        tagErro: 'geometria_escala',
      },
      B: {
        rotulo: '4.',
        valorNumerico: 4,
        diagnosticoPt: 'Cuidado com o fator entre cateto e quadrado: $OP$ é metade de $OB$, mas a área do quadrado sobre $OP$ não divide por 4 em relação ao triângulo isósceles de catetos $OA = OB$.',
        tagErro: 'algebra_manipulacao',
      },
      C: {
        rotulo: '6.',
        valorNumerico: 6,
        diagnosticoPt: 'No Tangram clássico todas as peças têm áreas que são potências ou frações binárias da área total (um quarto, um oitavo e um dezesseis avos do quadrado maior).',
        tagErro: 'geometria_escala',
      },
      D: {
        rotulo: '8.',
        valorNumerico: 8,
        diagnosticoPt: 'Correto! O quadrado $OPQR$ vale exatamente metade de cada um dos dois triângulos grandes do Tangram.',
      },
      E: {
        rotulo: '10.',
        valorNumerico: 10,
        diagnosticoPt: 'Compare geometricamente quantos triângulos pequenos compõem o triângulo grande $ABO$ e quantos compõem o quadrado $OPQR$.',
        tagErro: 'calculo_aritmetico',
      },
    },
    dicas: [
      'As diagonais do quadrado maior $ABCD$ encontram-se perpendicularmente em $O$, formando quatro triângulos congruentes a $ABO$.',
      'Como $P$ é ponto médio de $OB$, os catetos de $OPQR$ têm metade do cateto $OB$ de $ABO$ — compare as fórmulas de área do triângulo ($\\frac{b^2}{2}$) e do quadrado ($\\left(\\frac{b}{2}\\right)^2$)!',
      'Armadilha: pensar que reduzir um comprimento à metade sempre divide qualquer figura pela mesma fração.',
    ],
    solucaoCompletaPt: 'Como $\\triangle ABO$ é retângulo isósceles ($OA = OB = L$), sua área é $\\frac{L^2}{2} = 16 \\Rightarrow L^2 = 32$. O lado do quadrado $OPQR$ é $OP = \\frac{OB}{2} = \\frac{L}{2}$, logo sua área vale $\\left(\\frac{L}{2}\\right)^2 = \\frac{L^2}{4} = \\frac{32}{4} = 8\\text{ cm}^2$.',
    atalhoPt: 'Todo Tangram pode ser fatiado em 16 triangulinhos iguais: cada triângulo grande tem 4 deles ($16\\text{ cm}^2$) e o quadrado tem 2 deles (metade = $8\\text{ cm}^2$).',
    outroCaminhoPt: 'O quadrado total $ABCD$ tem área $4 \\times 16 = 64\\text{ cm}^2$, e o quadrado interno do Tangram sempre vale $1/8$ do todo.',
    dicaVidaRealPt: 'Decompor polígonos em unidades congruentes resolve áreas sem precisar de comprimentos explícitos.',
  },
  {
    id: 'etec_2018_2_q31',
    ano: 2018,
    semestre: 2,
    questao: 31,
    grau: 7,
    temaId: 'enem_geometria_medidas',
    chaveFigura: 'etec:2018:2:31',
    correta: 'D',
    enunciadoMarkdown:
      'Um técnico em edificações irá acompanhar a instalação de painéis solares em uma laje plana e horizontal. Após os cálculos necessários, ele determina que, para ocupar menos espaço nos telhados e obter melhor ângulo solar:\n\n- cada painel deve ter uma inclinação constante e igual a $20^\\circ$; e\n- a distância entre os dois painéis deve ser $3{,}5$ vezes a altura $h$ dos painéis.\n\nDados: $\\operatorname{sen} 20^\\circ = 0{,}34$, $\\cos 20^\\circ = 0{,}94$ e $\\operatorname{tg} 20^\\circ = 0{,}36$.\n\nSabendo que cada placa solar é quadrada e tem $1\\text{ m}^2$ de superfície, a distância entre dois painéis é, em metros, de',
    alternativas: {
      A: {
        rotulo: '0,34.',
        valorNumerico: 0.34,
        diagnosticoPt: 'Você calculou apenas a altura $h$ do painel, esquecendo que a distância pedida é $3{,}5$ vezes essa altura.',
        tagErro: 'leitura_interpretacao',
      },
      B: {
        rotulo: '0,36.',
        valorNumerico: 0.36,
        diagnosticoPt: 'A hipotenusa do painel mede $1\\text{ m}$; para achar o cateto oposto a $20^\\circ$ usamos seno, não tangente, e ainda multiplicamos por $3{,}5$.',
        tagErro: 'geometria_escala',
      },
      C: {
        rotulo: '0,94.',
        valorNumerico: 0.94,
        diagnosticoPt: 'Esse valor é a projeção horizontal do painel ($\\cos 20^\\circ$), e não a altura $h$ nem a distância entre eles.',
        tagErro: 'geometria_escala',
      },
      D: {
        rotulo: '1,19.',
        valorNumerico: 1.19,
        diagnosticoPt: 'Correto! Com placa de $1\\text{ m}$ de lado, $h = \\operatorname{sen} 20^\\circ = 0{,}34\\text{ m}$, e a distância é $3{,}5 \\times 0{,}34$.',
      },
      E: {
        rotulo: '1,26.',
        valorNumerico: 1.26,
        diagnosticoPt: 'Você usou a tangente em vez do seno para calcular $h$ ($3{,}5 \\times 0{,}36$). Como conhecemos a hipotenusa ($1\\text{ m}$), usa-se o seno!',
        tagErro: 'geometria_escala',
      },
    },
    dicas: [
      'Se a placa é quadrada com área de $1\\text{ m}^2$, qual é a medida do lado inclinado (a hipotenusa)?',
      'No triângulo retângulo do painel, $h$ é o cateto oposto a $20^\\circ$ e a placa de $1\\text{ m}$ é a hipotenusa.',
      'Armadilha: confundir $\\operatorname{sen} 20^\\circ$ com $\\operatorname{tg} 20^\\circ$ ou parar na altura $h$ sem multiplicar por $3{,}5$.',
    ],
    solucaoCompletaPt: 'Lado da placa = $\\sqrt{1} = 1\\text{ m}$ (hipotenusa). Altura $h = 1 \\cdot \\operatorname{sen}20^\\circ = 0{,}34\\text{ m}$. Distância entre os painéis = $3{,}5 \\times 0{,}34 = 1{,}19\\text{ m}$.',
    atalhoPt: '$3{,}5 \\times 0{,}34 = (3 + 0{,}5) \\times 0{,}34 = 1{,}02 + 0{,}17 = 1{,}19\\text{ m}$.',
    outroCaminhoPt: 'Multiplique $7/2$ por $34/100$ obtendo $238/200 = 119/100$.',
    dicaVidaRealPt: 'Identificar se o lado dado é hipotenusa ou cateto adjacente define na hora entre seno e tangente.',
  },
  {
    id: 'etec_2018_2_q32',
    ano: 2018,
    semestre: 2,
    questao: 32,
    grau: 5,
    temaId: 'enem_razoes_escalas',
    correta: 'A',
    enunciadoMarkdown:
      'Considere que $\\text{potência} = \\frac{\\text{energia}}{\\text{tempo}}$.\n\nO gasto de energia de uma lâmpada de bulbo de LED de $10\\text{ W}$, acesa por $8\\text{ horas}$, equivale ao mesmo gasto de energia de uma lâmpada incandescente convencional de $75\\text{ W}$ que se mantenha acesa por um tempo aproximado de',
    alternativas: {
      A: {
        rotulo: '1 h.',
        valorNumerico: 1,
        diagnosticoPt: 'Perfeito! Energia total = $80\\text{ Wh}$; dividindo pelos $75\\text{ W}$ da incandescente resulta em aproximadamente $1{,}07\\text{ h}$.',
      },
      B: {
        rotulo: '2 h.',
        valorNumerico: 2,
        diagnosticoPt: 'Com $75\\text{ W}$ em $2\\text{ horas}$ gastaria $150\\text{ Wh}$, quase o dobro dos $80\\text{ Wh}$ da LED.',
        tagErro: 'calculo_aritmetico',
      },
      C: {
        rotulo: '3 h.',
        valorNumerico: 3,
        diagnosticoPt: 'Em $3\\text{ horas}$ uma lâmpada de $75\\text{ W}$ consumiria $225\\text{ Wh}$, muito acima de $80\\text{ Wh}$.',
        tagErro: 'calculo_aritmetico',
      },
      D: {
        rotulo: '4 h.',
        valorNumerico: 4,
        diagnosticoPt: 'Maior potência exige MENOR tempo para gastar a mesma energia — as grandezas potência e tempo são inversamente proporcionais.',
        tagErro: 'proporcao_invertida',
      },
      E: {
        rotulo: '5 h.',
        valorNumerico: 5,
        diagnosticoPt: 'Confira a divisão da energia ($10 \\times 8 = 80$) pela nova potência ($75$).',
        tagErro: 'proporcao_invertida',
      },
    },
    dicas: [
      'Da fórmula dada, $\\text{energia} = \\text{potência} \\times \\text{tempo}$.',
      'Calcule quantos watt-hora ($\\text{Wh}$) a LED consome em 8 horas e divida pela potência da incandescente.',
      'Quanto maior a potência da lâmpada, menos tempo ela pode ficar acesa para gastar a mesma energia.',
    ],
    solucaoCompletaPt: 'Energia da LED = $10\\text{ W} \\times 8\\text{ h} = 80\\text{ Wh}$. Para a incandescente de $75\\text{ W}$: $t = \\frac{80}{75} \\approx 1{,}07\\text{ h} \\approx 1\\text{ h}$.',
    atalhoPt: '$80$ é apenas um pouco maior que $75$, logo a razão $80/75$ é bem próxima da unidade.',
    outroCaminhoPt: 'Como a incandescente tem $7{,}5\\times$ mais potência, dura $8 / 7{,}5 \\approx 1{,}07\\text{ h}$.',
    dicaVidaRealPt: 'Trocar lâmpadas antigas por LED de 9–10 W reduz o gasto de iluminação em cerca de 85%.',
  },
  {
    id: 'etec_2019_1_q47',
    ano: 2019,
    semestre: 1,
    questao: 47,
    grau: 5,
    temaId: 'enem_porcentagem_financeira',
    correta: 'B',
    enunciadoMarkdown:
      'O Prêmio Nobel foi criado por Alfred Nobel que deixou, em testamento, parte de sua fortuna para premiar pessoas que prestassem grandes serviços à humanidade. Em 2017, a Fundação Nobel aumentou o valor do prêmio em $12\\%$, atingindo o valor de 9 milhões de coroas suecas para cada modalidade.\n\nConsiderando $y$ o valor do prêmio em 2017 e $x$ o valor do prêmio em 2016, assinale a alternativa que apresenta a relação correta entre os dois valores.',
    alternativas: {
      A: {
        rotulo: '$y = x + 0{,}12$',
        diagnosticoPt: 'Um aumento de $12\\%$ é proporcional ao valor anterior ($0{,}12x$), e não uma soma fixa de $0{,}12$.',
        tagErro: 'porcentagem_base',
      },
      B: {
        rotulo: '$y = 1{,}12x$',
        diagnosticoPt: 'Isso mesmo! Somar $12\\%$ de $x$ ao próprio $x$ equivale ao fator multiplicativo $(1 + 0{,}12)x$.',
      },
      C: {
        rotulo: '$y = 12x$',
        diagnosticoPt: 'Multiplicar por $12$ aumentaria o prêmio em $1\\ 100\\%$, e não em $12\\%$.',
        tagErro: 'porcentagem_base',
      },
      D: {
        rotulo: '$x = 1{,}12y$',
        diagnosticoPt: 'Cuidado com quem aumentou: o prêmio de 2017 ($y$) é que cresceu sobre o de 2016 ($x$), e não o contrário.',
        tagErro: 'proporcao_invertida',
      },
      E: {
        rotulo: '$x = y + 0{,}12$',
        diagnosticoPt: 'Além de somar uma constante em vez de um percentual, a relação inverteu qual ano teve o maior valor.',
        tagErro: 'algebra_manipulacao',
      },
    },
    dicas: [
      'Aumentar uma grandeza $x$ em $12\\%$ significa pegar $100\\%$ de $x$ e somar $12\\%$ de $x$.',
      'Escreva $y = x + \\frac{12}{100}x$ e coloque $x$ em evidência.',
      'Armadilha: somar $0{,}12$ puro em vez de multiplicar por $x$, ou trocar $x$ por $y$.',
    ],
    solucaoCompletaPt: '$y = x + 0{,}12x = (1 + 0{,}12)x = 1{,}12x$.',
    atalhoPt: 'Todo aumento de $p\\%$ multiplica a base original por $(1 + p/100)$.',
    outroCaminhoPt: 'Teste com $x = 100$: um aumento de $12\\%$ leva a $y = 112$, que só satisfaz $y = 1{,}12x$.',
    dicaVidaRealPt: 'Testar uma equação algébrica com o número 100 confirma instantaneamente o fator percentual.',
  },
  {
    id: 'etec_2019_1_q49',
    ano: 2019,
    semestre: 1,
    questao: 49,
    grau: 6,
    temaId: 'enem_geometria_medidas',
    chaveFigura: 'etec:2019:1:49',
    correta: 'C',
    enunciadoMarkdown:
      'Além do prêmio em dinheiro, os vencedores do Nobel recebem uma medalha de ouro de formato circular de $66\\text{ milímetros}$ de diâmetro e um diploma.\n\nUm vencedor deseja encomendar a construção de uma caixa para acomodar a medalha. A caixa terá a forma de um paralelepípedo de base quadrada, sobre a qual sabe-se que:\n\n- a medida do lado da base é $4\\text{ mm}$ maior do que o diâmetro da medalha;\n- o volume total é igual a $147\\text{ cm}^3$;\n- o material do qual a caixa será feita tem espessura desprezível.\n\nA altura da caixa, em centímetros, será igual a',
    alternativas: {
      A: {
        rotulo: '2,0',
        valorNumerico: 2.0,
        diagnosticoPt: 'Com altura $2{,}0\\text{ cm}$ e base $7 \\times 7\\text{ cm}$, o volume seria apenas $98\\text{ cm}^3$.',
        tagErro: 'calculo_aritmetico',
      },
      B: {
        rotulo: '2,3',
        valorNumerico: 2.3,
        diagnosticoPt: 'Verifique a conversão de milímetros para centímetros antes de elevar o lado da base ao quadrado.',
        tagErro: 'conversao_unidades',
      },
      C: {
        rotulo: '3,0',
        valorNumerico: 3.0,
        diagnosticoPt: 'Perfeito! O lado da base mede $70\\text{ mm} = 7\\text{ cm}$, dando área da base $49\\text{ cm}^2$, e $147 \\div 49$ resulta exatamente nessa altura.',
      },
      D: {
        rotulo: '3,3',
        valorNumerico: 3.3,
        diagnosticoPt: 'Você talvez tenha usado $6{,}6\\text{ cm}$ direto como lado da base sem acrescentar os $4\\text{ mm}$ de folga.',
        tagErro: 'leitura_interpretacao',
      },
      E: {
        rotulo: '4,0',
        valorNumerico: 4.0,
        diagnosticoPt: 'Com altura $4\\text{ cm}$, o volume da caixa chegaria a $196\\text{ cm}^3$, acima de $147\\text{ cm}^3$.',
        tagErro: 'calculo_aritmetico',
      },
    },
    dicas: [
      'Converta todas as medidas da base para centímetros ($10\\text{ mm} = 1\\text{ cm}$), já que o volume e a altura pedida estão em $\\text{cm}$.',
      'Some $66\\text{ mm} + 4\\text{ mm}$ para obter o lado da base, passe para $\\text{cm}$, calcule a área do quadrado ($L^2$) e divida $147$ por ela.',
      'Armadilha: esquecer de converter milímetros para centímetros antes de aplicar $V = L^2 \\cdot h$.',
    ],
    solucaoCompletaPt: 'Lado da base = $66\\text{ mm} + 4\\text{ mm} = 70\\text{ mm} = 7\\text{ cm}$. Área da base = $7^2 = 49\\text{ cm}^2$. Como $V = A_b \\cdot h$, temos $147 = 49 \\cdot h \\Rightarrow h = 3{,}0\\text{ cm}$.',
    atalhoPt: '$7^2 = 49$, e note que $49 \\times 3 = (50 - 1) \\times 3 = 150 - 3 = 147$.',
    outroCaminhoPt: 'Em $\\text{mm}^3$: $147\\text{ cm}^3 = 147\\ 000\\text{ mm}^3$; dividindo por $70^2 = 4\\ 900\\text{ mm}^2$ obtém-se $30\\text{ mm} = 3{,}0\\text{ cm}$.',
    dicaVidaRealPt: 'Uniformizar todas as grandezas na unidade da pergunta logo na leitura evita erros de escala cúbica.',
  },
  {
    id: 'etec_2020_1_q33',
    ano: 2020,
    semestre: 1,
    questao: 33,
    grau: 6,
    temaId: 'enem_geometria_medidas',
    chaveFigura: 'etec:2020:1:33',
    correta: 'A',
    enunciadoMarkdown:
      'Carlos Rogério, empresário do ramo de festas e eventos, decidiu oferecer a seus clientes embalagens diferenciadas para as populares lembrancinhas. Segundo o empresário, a introdução de uma embalagem em formato de poliedro convexo regular (apresentada na imagem, com sua planificação) aumentou seu faturamento no último mês.\n\n(Um poliedro convexo é chamado de regular se suas faces são polígonos regulares congruentes.)\n\nSabendo que todas as faces da embalagem são polígonos regulares, pode-se afirmar que um ângulo interno de uma dessas faces mede',
    alternativas: {
      A: {
        rotulo: '108°',
        valorNumerico: 108,
        diagnosticoPt: 'Excelente! As faces são pentágonos regulares ($n = 5$), e a soma interna de $540^\\circ$ dividida igualmente pelos 5 vértices dá o ângulo de cada canto.',
      },
      B: {
        rotulo: '180°',
        valorNumerico: 180,
        diagnosticoPt: 'Um ângulo interno de $180^\\circ$ formaria uma linha reta, jamais fechando um polígono convexo.',
        tagErro: 'geometria_escala',
      },
      C: {
        rotulo: '360°',
        valorNumerico: 360,
        diagnosticoPt: '$360^\\circ$ é a soma dos ângulos EXTERNOS de qualquer polígono convexo, e não um ângulo interno.',
        tagErro: 'leitura_interpretacao',
      },
      D: {
        rotulo: '405°',
        valorNumerico: 405,
        diagnosticoPt: 'Ângulos internos de polígonos convexos são sempre estritamente menores que $180^\\circ$.',
        tagErro: 'geometria_escala',
      },
      E: {
        rotulo: '540°',
        valorNumerico: 540,
        diagnosticoPt: 'Atenção à pergunta: esse valor é a SOMA dos cinco ângulos internos do pentágono, mas pediu-se apenas UM ângulo interno!',
        tagErro: 'leitura_interpretacao',
      },
    },
    dicas: [
      'Conte quantos lados tem cada face visível do poliedro na imagem e na planificação (dodecaedro regular).',
      'Use a fórmula da soma dos ângulos internos de um polígono de $n$ lados: $S_i = (n - 2) \\cdot 180^\\circ$, depois divida por $n$.',
      'Armadilha clássica: calcular a soma total dos ângulos da face ($540^\\circ$) e parar antes de dividir pelos 5 ângulos.',
    ],
    solucaoCompletaPt: 'Cada face é um pentágono regular ($n = 5$ lados). A soma dos ângulos internos vale $S_i = (5 - 2) \\times 180^\\circ = 540^\\circ$. Como todos os 5 ângulos são iguais, cada ângulo interno mede $\\frac{540^\\circ}{5} = 108^\\circ$.',
    atalhoPt: 'Ângulo externo do pentágono regular = $\\frac{360^\\circ}{5} = 72^\\circ$; o interno é seu suplemento: $180^\\circ - 72^\\circ = 108^\\circ$.',
    outroCaminhoPt: 'Divida o pentágono por um vértice em 3 triângulos ($3 \\times 180^\\circ = 540^\\circ$) e reparta entre os 5 ângulos.',
    dicaVidaRealPt: 'Calcular o ângulo externo ($360^\\circ/n$) e subtrair de $180^\\circ$ é o jeito mais rápido para qualquer polígono regular.',
  },
]

export const ETEC_MATEMATICA_LOTE1: readonly DesafioUnificado[] = SPECS_ETEC.map(construirDesafioEtec)
