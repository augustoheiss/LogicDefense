/**
 * Lote 1 — questões oficiais de Matemática do Processo Seletivo SENAI-SP (CAI-AE / CAI-AD).
 * Enunciados e gabaritos conferidos diretamente nos PDFs e gabaritos oficiais:
 * CGE 2215 (2023), CGE 2128 (2017) e CGE 2125 (2016).
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

interface SpecSenaiOficial {
  readonly id: string
  readonly ano: number
  readonly cge: number
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

function construirDesafioSenai(s: SpecSenaiOficial): DesafioUnificado {
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
    origem: 'senai_oficial',
    grau: s.grau as GrauDificuldade,
    temaId: s.temaId,
    temaTituloPt: tituloDoTema(s.temaId),
    arquetipoOuItemId: s.id,
    chaveFigura: s.chaveFigura,
    referenciaOficial: {
      exame: 'SENAI',
      ano: s.ano,
      questao: s.questao,
      licenca: 'Acervo oficial Processo Seletivo SENAI-SP',
      citacaoCurta: `SENAI ${s.ano} · CGE ${s.cge} · Q.${s.questao}`,
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

const SPECS_SENAI: readonly SpecSenaiOficial[] = [
  {
    id: 'senai_2023_2215_q21',
    ano: 2023,
    cge: 2215,
    questao: 21,
    grau: 5,
    temaId: 'enem_aritmetica_ciclos',
    correta: 'D',
    enunciadoMarkdown:
      'Uma escola resolveu fretar vans para levar as quatro turmas dos $9^{\\text{os}}$ anos para uma sessão de cinema interativo. A tabela a seguir mostra a quantidade de alunos por turma que participarão dessa saída:\n\n| 9ºA | 9ºB | 9ºC | 9ºD |\n| :---: | :---: | :---: | :---: |\n| 24 | 36 | 24 | 48 |\n\nSabendo que cada van tem capacidade para 16 pessoas, que todas levarão a **mesma quantidade de alunos**, que essa quantidade deve ser a **maior possível** e que não haverá mistura de turmas no mesmo veículo, o número mínimo de vans que será fretado é',
    alternativas: {
      A: {
        rotulo: '6.',
        valorNumerico: 6,
        diagnosticoPt: 'Com capacidade máxima de 16 alunos por van, 132 estudantes precisam de mais do que 6 veículos.',
        tagErro: 'calculo_aritmetico',
      },
      B: {
        rotulo: '7.',
        valorNumerico: 7,
        diagnosticoPt: 'Mesmo ignorando o divisor comum exato, ainda faltaria espaço para parte das turmas em apenas 7 vans.',
        tagErro: 'leitura_interpretacao',
      },
      C: {
        rotulo: '8.',
        valorNumerico: 8,
        diagnosticoPt: 'Você dividiu apenas os alunos restantes ou deixou duas turmas do 9ºA/9ºC fora da contagem separada.',
        tagErro: 'leitura_interpretacao',
      },
      D: {
        rotulo: '11.',
        valorNumerico: 11,
        diagnosticoPt: 'Excelente! O MDC de 24, 36 e 48 é 12 (que cabe na lotação de 16), gerando $2 + 3 + 2 + 4$ veículos.',
      },
      E: {
        rotulo: '12.',
        valorNumerico: 12,
        diagnosticoPt: 'Cuidado! Esse é o número de ALUNOS em cada van (o MDC), mas a pergunta pede o número de VANS!',
        tagErro: 'leitura_interpretacao',
      },
    },
    dicas: [
      'Precisamos do maior divisor comum (MDC) entre 24, 36 e 48 que não ultrapasse 16 alunos por van.',
      'Ache quantos alunos irão em cada van usando o MDC e, depois, divida cada turma por esse número para somar os veículos.',
      'Armadilha clássica: responder o valor do MDC encontrado em vez da soma do número de vans de todas as turmas.',
    ],
    solucaoCompletaPt: '$\\operatorname{MDC}(24, 36, 48) = 12$ alunos/van ($\\le 16$). Vans por turma: $\\frac{24}{12} + \\frac{36}{12} + \\frac{24}{12} + \\frac{48}{12} = 2 + 3 + 2 + 4 = 11$ vans.',
    atalhoPt: 'Some tudo: $24 + 36 + 24 + 48 = 132$ alunos; $132 \\div 12 = 11$ vans.',
    outroCaminhoPt: 'Veja que $24, 36, 48$ são $2\\times12, 3\\times12, 4\\times12$: os fatores já dão o número de vans de cada turma.',
    dicaVidaRealPt: 'Divisão igualitária de lotes sem sobras quase sempre pede MDC seguido da soma dos quocientes.',
  },
  {
    id: 'senai_2023_2215_q25',
    ano: 2023,
    cge: 2215,
    questao: 25,
    grau: 5,
    temaId: 'enem_probabilidade_contagem',
    chaveFigura: 'senai:2023:2215:25',
    correta: 'B',
    enunciadoMarkdown:
      'A figura mostra dois conjuntos, $A$ e $B$, representados no diagrama de Venn. Cada conjunto possui como elementos alguns números.\n\nConsiderando a relação existente entre os dois conjuntos (símbolos e operações), os números **9** e **11** representam',
    alternativas: {
      A: {
        rotulo: '$A \\cup B$.',
        diagnosticoPt: 'A união $A \\cup B$ engloba TODOS os elementos dos dois círculos ($1, 3, 5, 7, 8, 9, 10, 11, 12$), e não apenas os do meio.',
        tagErro: 'leitura_interpretacao',
      },
      B: {
        rotulo: '$A \\cap B$.',
        diagnosticoPt: 'Correto! O símbolo de interseção $\\cap$ representa exatamente os elementos comuns que pertencem simultaneamente a $A$ e $B$.',
      },
      C: {
        rotulo: '$A - B$.',
        diagnosticoPt: 'A diferença $A - B$ reúne apenas quem está exclusivamente em $A$ ($1, 3, 5, 7$).',
        tagErro: 'leitura_interpretacao',
      },
      D: {
        rotulo: '$B - A$.',
        diagnosticoPt: 'A diferença $B - A$ reúne apenas os elementos exclusivos de $B$ ($8, 10, 12$).',
        tagErro: 'leitura_interpretacao',
      },
      E: {
        rotulo: '$(A \\cup B) - B$.',
        diagnosticoPt: 'Remover todo o conjunto $B$ da união resulta justamente em $A - B$, apagando a parte central compartilhada.',
        tagErro: 'algebra_manipulacao',
      },
    },
    dicas: [
      'Observe onde 9 e 11 estão localizados: eles pertencem ao círculo $A$ e também ao círculo $B$ ao mesmo tempo.',
      'Lembre a diferença entre o arco voltado para cima (reúne tudo) e o arco voltado para baixo (só o que é comum aos dois).',
      'Armadilha: confundir o símbolo de união com o de interseção.',
    ],
    solucaoCompletaPt: 'Como 9 e 11 estão na região sobreposta dos diagramas, pertencem simultaneamente a $A$ e a $B$, o que define a interseção $A \\cap B$.',
    atalhoPt: 'Meio compartilhado = elementos em comum = interseção.',
    outroCaminhoPt: 'Liste $A = \\{1,3,5,7,9,11\\}$ e $B = \\{8,9,10,11,12\\}$: o único subconjunto com exatamente 9 e 11 é o conjunto comum.',
    dicaVidaRealPt: 'Pense em "U" de União (junta tudo) e o oposto para o filtro do meio.',
  },
  {
    id: 'senai_2023_2215_q27',
    ano: 2023,
    cge: 2215,
    questao: 27,
    grau: 5,
    temaId: 'enem_geometria_medidas',
    chaveFigura: 'senai:2023:2215:27',
    correta: 'B',
    enunciadoMarkdown:
      'Um estudante, ao dividir o quadrado $ABCD$ pela metade, traçou sua diagonal e obteve dois triângulos: $ABC$ e $ADC$.\n\nQuanto aos lados e ângulos, esses dois triângulos podem ser classificados, respectivamente, como',
    alternativas: {
      A: {
        rotulo: 'escalenos e retângulos.',
        diagnosticoPt: 'Em um quadrado todos os quatro lados têm a mesma medida, portanto cada triângulo possui dois lados iguais!',
        tagErro: 'geometria_escala',
      },
      B: {
        rotulo: 'isósceles e retângulos.',
        diagnosticoPt: 'Correto! Dois lados iguais (lados do quadrado) com um ângulo de $90^\\circ$ entre eles.',
      },
      C: {
        rotulo: 'equiláteros e equiângulos.',
        diagnosticoPt: 'A diagonal de um quadrado mede $L\\sqrt{2}$, sendo maior que os lados $L$; logo os três lados não são iguais.',
        tagErro: 'geometria_escala',
      },
      D: {
        rotulo: 'retângulos e obtusos.',
        diagnosticoPt: 'Um triângulo não pode ter ângulo reto ($90^\\circ$) e ângulo obtuso ($> 90^\\circ$) ao mesmo tempo, pois a soma dos três é $180^\\circ$.',
        tagErro: 'leitura_interpretacao',
      },
      E: {
        rotulo: 'equiláteros e obtusos.',
        diagnosticoPt: 'Cada canto original do quadrado mantém $90^\\circ$, e os dois ângulos restantes valem $45^\\circ$.',
        tagErro: 'geometria_escala',
      },
    },
    dicas: [
      'Analise os dois atributos pedidos na ordem: primeiro quanto aos LADOS, depois quanto aos ÂNGULOS.',
      'Um triângulo formado por dois lados adjacentes do quadrado tem quantos lados iguais? E quanto mede o ângulo no canto do quadrado?',
      'Armadilha: esquecer que os ângulos do triângulo são $90^\\circ, 45^\\circ, 45^\\circ$ e imaginar lados todos iguais.',
    ],
    solucaoCompletaPt: 'No quadrado $ABCD$, $AB = BC = CD = DA = L$ e todos os vértices medem $90^\\circ$. Logo $\\triangle ABC$ e $\\triangle ADC$ têm dois lados iguais ($L$) e hipotenusa $L\\sqrt{2}$ (isósceles) além de um ângulo reto de $90^\\circ$ (retângulos).',
    atalhoPt: 'Dois lados do quadrado iguais + canto de $90^\\circ$.',
    outroCaminhoPt: 'Os ângulos agudos medem $45^\\circ$ e $45^\\circ$: ângulos da base iguais garantem lados opostos iguais.',
    dicaVidaRealPt: 'Esse é exatamente o formato do esquadro de $45^\\circ$ usado em desenho técnico.',
  },
  {
    id: 'senai_2023_2215_q28',
    ano: 2023,
    cge: 2215,
    questao: 28,
    grau: 6,
    temaId: 'enem_funcoes_sequencias',
    chaveFigura: 'senai:2023:2215:28',
    correta: 'A',
    enunciadoMarkdown:
      'Um Pesque-pague está com a seguinte promoção de fim de semana (conforme a placa na imagem):\n\n- **Sábado:** Permissão R\\$ 25,00 + R\\$ 15,00 por kg pescado;\n- **Domingo:** Permissão R\\$ 50,00 + R\\$ 10,00 por kg pescado.\n\nPara um cliente, a fim de que a promoção seja mais compensadora no domingo do que no sábado, a quantidade de peixes (em kg) que ele deve pescar tem que ser',
    alternativas: {
      A: {
        rotulo: 'maior que 5 kg.',
        diagnosticoPt: 'Exato! No ponto de equilíbrio ($5\\text{ kg}$) os dois dias empatam em R$ 100,00; acima disso, o quilo mais barato do domingo vence.',
      },
      B: {
        rotulo: 'maior que 3 kg.',
        diagnosticoPt: 'Com $4\\text{ kg}$, o sábado sairia R$ 85,00 contra R$ 90,00 do domingo — o sábado ainda seria mais barato.',
        tagErro: 'calculo_aritmetico',
      },
      C: {
        rotulo: 'menor que 5 kg.',
        diagnosticoPt: 'Inverteu a desigualdade! Abaixo de $5\\text{ kg}$, a entrada mais barata faz o sábado compensar mais.',
        tagErro: 'proporcao_invertida',
      },
      D: {
        rotulo: 'maior que 0,2 kg.',
        diagnosticoPt: 'Você dividiu $5$ por $25$ em vez de dividir a diferença das taxas fixas ($25$) pela diferença do preço do quilo ($5$).',
        tagErro: 'algebra_manipulacao',
      },
      E: {
        rotulo: 'maior que 1,5 kg.',
        diagnosticoPt: 'Teste com $2\\text{ kg}$: sábado custa R$ 55,00 e domingo custa R$ 70,00, logo ainda não compensa.',
        tagErro: 'calculo_aritmetico',
      },
    },
    dicas: [
      '"Mais compensadora no domingo" significa pagar MENOS no domingo do que no sábado pela mesma massa $x$ em kg.',
      'Monte duas expressões de custo: $50 + 10x < 25 + 15x$ e resolva a inequação.',
      'Armadilha: errar o sinal da desigualdade e marcar "menor" em vez de "maior".',
    ],
    solucaoCompletaPt: 'Custo domingo < Custo sábado $\\Rightarrow 50 + 10x < 25 + 15x \\Rightarrow 25 < 5x \\Rightarrow x > 5\\text{ kg}$.',
    atalhoPt: 'O domingo cobra R$ 25 a mais na entrada, mas economiza R$ 5 por kg: leva $25 \\div 5 = 5\\text{ kg}$ para empatar e passa a compensar acima disso.',
    outroCaminhoPt: 'Teste os valores inteiros: em $x = 5\\text{ kg}$, ambos custam R$ 100,00.',
    dicaVidaRealPt: 'Esse mesmo cálculo decide quando vale a pena pagar anuidade ou plano com taxa fixa menor por uso.',
  },
  {
    id: 'senai_2023_2215_q29',
    ano: 2023,
    cge: 2215,
    questao: 29,
    grau: 5,
    temaId: 'enem_razoes_escalas',
    chaveFigura: 'senai:2023:2215:29',
    correta: 'C',
    enunciadoMarkdown:
      'Um motorista dirige seu veículo a uma velocidade constante de $100\\text{ km/h}$ em uma estrada e avista a placa com a indicação da imagem (Posto de gasolina a $20\\text{ km}$).\n\nMantendo a mesma velocidade, em quantos minutos o motorista chegará ao posto de gasolina?',
    alternativas: {
      A: {
        rotulo: '4.',
        valorNumerico: 4,
        diagnosticoPt: 'Em 4 minutos a $100\\text{ km/h}$, o carro percorre menos de $7\\text{ km}$, bem antes dos $20\\text{ km}$ da placa.',
        tagErro: 'calculo_aritmetico',
      },
      B: {
        rotulo: '5.',
        valorNumerico: 5,
        diagnosticoPt: 'Atenção: você dividiu $100$ por $20$ obtendo $5$, mas essa é a fração de hora ($1/5$ de hora), e não minutos!',
        tagErro: 'conversao_unidades',
      },
      C: {
        rotulo: '12.',
        valorNumerico: 12,
        diagnosticoPt: 'Perfeito! Percorrer $20\\text{ km}$ a $100\\text{ km/h}$ leva um quinto de uma hora ($60 \\div 5$).',
      },
      D: {
        rotulo: '20.',
        valorNumerico: 20,
        diagnosticoPt: 'Seriam 20 minutos se o motorista viajasse a $60\\text{ km/h}$ ($1\\text{ km/min}$), mas ele está a $100\\text{ km/h}$.',
        tagErro: 'leitura_interpretacao',
      },
      E: {
        rotulo: '40.',
        valorNumerico: 40,
        diagnosticoPt: 'Confira sua regra de três: se em 60 min ele faz $100\\text{ km}$, para $20\\text{ km}$ precisa de bem menos que meia hora.',
        tagErro: 'calculo_aritmetico',
      },
    },
    dicas: [
      'A velocidade está em km por HORA (60 minutos), e a pergunta pede o tempo em MINUTOS.',
      'Que fração de $100\\text{ km}$ representam $20\\text{ km}$? Pegue essa mesma fração de 60 minutos.',
      'Armadilha clássica: responder o denominador da fração de hora como se já fosse a resposta em minutos.',
    ],
    solucaoCompletaPt: '$t = \\frac{20}{100}\\text{ h} = \\frac{1}{5}\\text{ h} = \\frac{60}{5}\\text{ min} = 12\\text{ min}$.',
    atalhoPt: '100 km em 60 min $\\xrightarrow{\\div 5}$ 20 km em $60\\div 5 = 12\\text{ min}$.',
    outroCaminhoPt: 'Multiplique $0{,}2\\text{ h} \\times 60\\text{ min/h}$.',
    dicaVidaRealPt: 'Dividir a quilometragem restante por 5 no quinto de 60 minutos dá o tempo mentalmente na rodovia.',
  },
  {
    id: 'senai_2023_2215_q30',
    ano: 2023,
    cge: 2215,
    questao: 30,
    grau: 5,
    temaId: 'enem_geometria_medidas',
    chaveFigura: 'senai:2023:2215:30',
    correta: 'B',
    enunciadoMarkdown:
      'João necessitava determinar a capacidade do reservatório de água na forma de paralelepípedo com as dimensões apresentadas na figura ($2\\text{ m}$ de comprimento, $1\\text{ m}$ de largura e $1\\text{ m}$ de altura). Para não esquecer, fez a anotação:\n\n$$1\\text{ dm}^3 = 1\\text{ litro}$$\n\nDepois de realizados os cálculos, João concluiu que a capacidade do reservatório é',
    alternativas: {
      A: {
        rotulo: '$4\\text{ m}^3$.',
        diagnosticoPt: 'Você somou as três dimensões ($2 + 1 + 1$) em vez de multiplicá-las!',
        tagErro: 'algebra_manipulacao',
      },
      B: {
        rotulo: '2.000 litros.',
        diagnosticoPt: 'Correto! O volume é $2 \\times 1 \\times 1 = 2\\text{ m}^3$, e cada metro cúbico comporta exatamente mil litros.',
      },
      C: {
        rotulo: '$2.000\\text{ cm}^3$.',
        diagnosticoPt: '$2.000\\text{ cm}^3$ equivalem a apenas uma garrafa de 2 litros, bem longe de uma caixa de $2\\text{ m}^3$.',
        tagErro: 'conversao_unidades',
      },
      D: {
        rotulo: '$20\\text{ dm}^3$.',
        diagnosticoPt: 'Ao passar de $\\text{m}^3$ para $\\text{dm}^3$, multiplicamos por $10^3 = 1.000$, e não por $10$.',
        tagErro: 'conversao_unidades',
      },
      E: {
        rotulo: '$200\\text{ cm}^3$.',
        diagnosticoPt: 'Confira a conversão cúbica de unidades e a multiplicação das dimensões.',
        tagErro: 'conversao_unidades',
      },
    },
    dicas: [
      'Primeiro calcule o volume multiplicando comprimento $\\times$ largura $\\times$ altura em metros.',
      'Lembre-se de que $1\\text{ m} = 10\\text{ dm}$, logo $1\\text{ m}^3 = 10 \\times 10 \\times 10 = 1.000\\text{ dm}^3$.',
      'Armadilha: converter metro para decímetro multiplicando por 10 apenas uma vez mesmo estando ao cubo.',
    ],
    solucaoCompletaPt: '$V = 2\\text{ m} \\times 1\\text{ m} \\times 1\\text{ m} = 2\\text{ m}^3$. Como $1\\text{ m}^3 = 1.000\\text{ dm}^3 = 1.000\\text{ litros}$, a capacidade é $2 \\times 1.000 = 2.000\\text{ litros}$.',
    atalhoPt: 'Passe as medidas para decímetros logo no início: $20 \\times 10 \\times 10 = 2.000\\text{ dm}^3 = 2.000\\text{ L}$.',
    outroCaminhoPt: 'Lembrar como referência que uma caixa d\'água doméstica comum de 1.000 L tem $1\\text{ m} \\times 1\\text{ m} \\times 1\\text{ m}$.',
    dicaVidaRealPt: 'Guardar a referência $1\\text{ m}^3 = 1.000\\text{ litros}$ evita erros em cálculos hidráulicos.',
  },
  {
    id: 'senai_2023_2215_q31',
    ano: 2023,
    cge: 2215,
    questao: 31,
    grau: 6,
    temaId: 'enem_aritmetica_ciclos',
    chaveFigura: 'senai:2023:2215:31',
    correta: 'C',
    enunciadoMarkdown:
      'A imagem mostra o número de funcionários de dois turnos da empresa BCD ($1^\\circ$ turno = 320 funcionários e $2^\\circ$ turno = 140 funcionários).\n\nPara a reunião de trabalhos, sabe-se que essa empresa dividiu os dois turnos em grupos iguais e com o maior número possível de funcionários em cada grupo, sem misturar funcionários de turnos diferentes.\n\nConsiderando que será mantida a mesma quantidade de funcionários em cada grupo, a quantidade total de grupos formados será igual a',
    alternativas: {
      A: {
        rotulo: '20.',
        valorNumerico: 20,
        diagnosticoPt: 'Atenção: você respondeu o TAMANHO de cada grupo ($\operatorname{MDC}(320, 140) = 20$ pessoas), e não a QUANTIDADE de grupos!',
        tagErro: 'leitura_interpretacao',
      },
      B: {
        rotulo: '115.',
        valorNumerico: 115,
        diagnosticoPt: 'Com divisor comum igual a 4 haveria 115 grupos, mas o enunciado exige o MAIOR número possível de pessoas por grupo.',
        tagErro: 'algebra_manipulacao',
      },
      C: {
        rotulo: '23.',
        valorNumerico: 23,
        diagnosticoPt: 'Perfeito! O maior tamanho igualitário de grupo é 20 pessoas, resultando em $16$ grupos do $1^\\circ$ turno e $7$ grupos do $2^\\circ$ turno.',
      },
      D: {
        rotulo: '92.',
        valorNumerico: 92,
        diagnosticoPt: 'Usou divisor 5 em vez do maior divisor comum entre 320 e 140.',
        tagErro: 'calculo_aritmetico',
      },
      E: {
        rotulo: '70.',
        valorNumerico: 70,
        diagnosticoPt: '70 é metade de 140, mas 320 não é divisível por 70 sem deixar sobra.',
        tagErro: 'calculo_aritmetico',
      },
    },
    dicas: [
      'Leia com atenção o que a pergunta quer: a quantidade de GRUPOS, e não a quantidade de pessoas em cada grupo.',
      'Encontre o MDC entre 320 e 140 para achar o maior tamanho comum de cada equipe.',
      'Depois de achar quantas pessoas ficam em cada grupo, divida 320 e 140 por esse tamanho e some os dois resultados.',
    ],
    solucaoCompletaPt: '$\\operatorname{MDC}(320, 140) = 20$ funcionários por grupo. Número de grupos: $\\frac{320}{20} + \\frac{140}{20} = 16 + 7 = 23$ grupos.',
    atalhoPt: 'Divida por 10 primeiro ($32$ e $14$), depois por 2 ($16$ e $7$): como $16$ e $7$ são primos entre si, a soma já dá o total de grupos!',
    outroCaminhoPt: 'Total de funcionários = $320 + 140 = 460$; $460 \\div 20 = 23$.',
    dicaVidaRealPt: 'Ao fatorar simultaneamente no método de MDC, os quocientes finais irredutíveis já são o número de partes!',
  },
  {
    id: 'senai_2023_2215_q32',
    ano: 2023,
    cge: 2215,
    questao: 32,
    grau: 6,
    temaId: 'enem_geometria_medidas',
    chaveFigura: 'senai:2023:2215:32',
    correta: 'E',
    enunciadoMarkdown:
      'Quatro retas paralelas, $a$, $b$, $c$ e $d$, estão cortadas por outras duas transversais $r$ e $s$, conforme mostra a figura.\n\nConsiderando os valores dos segmentos apresentados, conclui-se que o valor correto da expressão $x + y$ é',
    alternativas: {
      A: {
        rotulo: '9,0.',
        valorNumerico: 9.0,
        diagnosticoPt: 'Você inverteu uma das razões do Teorema de Tales ao montar a proporção entre os segmentos.',
        tagErro: 'proporcao_invertida',
      },
      B: {
        rotulo: '13,7.',
        valorNumerico: 13.7,
        diagnosticoPt: 'Você aproximou $y$ erradamente ou inverteu a correspondência dos segmentos entre as paralelas $a$-$b$ e $c$-$d$.',
        tagErro: 'proporcao_invertida',
      },
      C: {
        rotulo: '21,2.',
        valorNumerico: 21.2,
        diagnosticoPt: 'Quase lá: $x = 20$, mas confira a regra de três para encontrar $y$ ($8/10 = y/7$? Cuidado na correspondência!).',
        tagErro: 'calculo_aritmetico',
      },
      D: {
        rotulo: '22,0.',
        valorNumerico: 22.0,
        diagnosticoPt: 'Como o segmento na transversal $s$ dobrava de 7 para 14, $x$ dobra de 10 para 20; já $y$ fica em razão igual a $8$ para $10$.',
        tagErro: 'calculo_aritmetico',
      },
      E: {
        rotulo: '25,6.',
        valorNumerico: 25.6,
        diagnosticoPt: 'Perfeito! Pelo Teorema de Tales, $x = 20$ e $y = 5{,}6$, cuja soma fecha corretamente.',
      },
    },
    dicas: [
      'Pelo Teorema de Tales, os segmentos correspondentes entre as mesmas paralelas têm a mesma razão.',
      'Compare a primeira faixa ($10$ com $7$) com a segunda faixa ($x$ com $14$) e com a terceira faixa ($8$ com $y$).',
      'Armadilha: trocar a posição de cima com a de baixo em uma das razões da proporção.',
    ],
    solucaoCompletaPt: 'Razão entre $r$ e $s$: $\\frac{10}{7} = \\frac{x}{14} \\Rightarrow x = 20$. Na terceira faixa: $\\frac{10}{7} = \\frac{8}{y} \\Rightarrow y = \\frac{56}{10} = 5{,}6$. Portanto, $x + y = 20 + 5{,}6 = 25{,}6$.',
    atalhoPt: 'Veja o fator de $r$ para $s$: $7 = 0{,}7 \\times 10$. Então na 2ª faixa $x = 14 / 0{,}7 = 20$, e na 3ª faixa $y = 0{,}7 \\times 8 = 5{,}6$.',
    outroCaminhoPt: 'Multiplique $14/7 = 2$ para dobrar $10$ até $20$, e divida $(8 \\times 7)$ por $10$.',
    dicaVidaRealPt: 'Olhar o fator multiplicativo direto entre duas colunas paralelas economiza montar várias equações.',
  },
  {
    id: 'senai_2023_2215_q36',
    ano: 2023,
    cge: 2215,
    questao: 36,
    grau: 6,
    temaId: 'enem_geometria_medidas',
    chaveFigura: 'senai:2023:2215:36',
    correta: 'E',
    enunciadoMarkdown:
      'Um observador, distante 15 metros de um edifício, avista o seu topo sob o ângulo de $55^\\circ$ indicado na imagem.\n\nConsidere: $\\operatorname{sen} 55^\\circ = 0{,}82$, $\\cos 55^\\circ = 0{,}57$ e $\\operatorname{tg} 55^\\circ = 1{,}43$.\n\nDesprezando a altura do observador, a altura $x$ do edifício é',
    alternativas: {
      A: {
        rotulo: '8,55 m.',
        valorNumerico: 8.55,
        diagnosticoPt: 'Você multiplicou $15$ pelo cosseno ($0{,}57$), mas o lado procurado é oposto ao ângulo de $55^\\circ$.',
        tagErro: 'geometria_escala',
      },
      B: {
        rotulo: '10,48 m.',
        valorNumerico: 10.48,
        diagnosticoPt: 'Você dividiu $15$ pela tangente ($1{,}43$) em vez de multiplicar!',
        tagErro: 'proporcao_invertida',
      },
      C: {
        rotulo: '12,30 m.',
        valorNumerico: 12.3,
        diagnosticoPt: 'Você multiplicou $15$ pelo seno ($0{,}82$), mas $15\\text{ m}$ é o cateto adjacente no solo, e não a hipotenusa.',
        tagErro: 'geometria_escala',
      },
      D: {
        rotulo: '17,55 m.',
        valorNumerico: 17.55,
        diagnosticoPt: 'Verifique a multiplicação $15 \\times 1{,}43$; o valor exato fica um pouco acima.',
        tagErro: 'calculo_aritmetico',
      },
      E: {
        rotulo: '21,45 m.',
        valorNumerico: 21.45,
        diagnosticoPt: 'Correto! A razão entre o cateto oposto (altura) e o cateto adjacente ($15\\text{ m}$) é dada pela tangente de $55^\\circ$.',
      },
    },
    dicas: [
      'No triângulo retângulo formado, conhecemos o cateto horizontal (adjacente ao ângulo de $55^\\circ$) e queremos a altura vertical (cateto oposto).',
      'Qual razão trigonométrica relaciona cateto oposto e cateto adjacente sem envolver a hipotenusa?',
      'Armadilha: usar seno ou cosseno quando o dado conhecido está na horizontal no chão, e não na linha inclinada de visão.',
    ],
    solucaoCompletaPt: '$\\operatorname{tg}55^\\circ = \\frac{x}{15} \\Rightarrow 1{,}43 = \\frac{x}{15} \\Rightarrow x = 15 \\times 1{,}43 = 21{,}45\\text{ m}$.',
    atalhoPt: '$15 \\times 1{,}43 = 10 \\times 1{,}43 + 5 \\times 1{,}43 = 14{,}30 + 7{,}15 = 21{,}45\\text{ m}$.',
    outroCaminhoPt: 'Para ângulos maiores que $45^\\circ$, a tangente passa de 1, logo a altura do prédio é obrigatoriamente maior que os $15\\text{ m}$ da base.',
    dicaVidaRealPt: 'Teodolitos e clinômetros medem alturas inacessíveis aplicando exatamente a tangente da distância horizontal.',
  },
  {
    id: 'senai_2023_2215_q39',
    ano: 2023,
    cge: 2215,
    questao: 39,
    grau: 6,
    temaId: 'enem_geometria_medidas',
    chaveFigura: 'senai:2023:2215:39',
    correta: 'C',
    enunciadoMarkdown:
      'Entre duas retas paralelas existem três figuras planas: um retângulo, um triângulo e um trapézio. Algumas medidas estão assinaladas na figura (largura $3\\text{ m}$ no retângulo, base $3\\text{ m}$ no triângulo, bases $3\\text{ m}$ e $5\\text{ m}$ no trapézio, com distância $4\\text{ m}$ entre as paralelas) e são apenas ilustrativas, não sendo proporcionais.\n\nAnalisando o perímetro e a área das figuras, é correto afirmar que',
    alternativas: {
      A: {
        rotulo: 'a área do trapézio é o triplo da área do triângulo.',
        diagnosticoPt: 'Calcule o trapézio $\\frac{(5+3)\\times 4}{2} = 16\\text{ m}^2$ e compare com o triângulo de $6\\text{ m}^2$: $16$ não é o triplo de $6$.',
        tagErro: 'calculo_aritmetico',
      },
      B: {
        rotulo: 'a área do trapézio é $32\\text{ m}^2$.',
        diagnosticoPt: 'Você calculou $(5 + 3) \\times 4$ e esqueceu de dividir por 2 na fórmula da área do trapézio!',
        tagErro: 'algebra_manipulacao',
      },
      C: {
        rotulo: 'a área do retângulo é o dobro da área do triângulo.',
        diagnosticoPt: 'Correto! Com mesma base ($3\\text{ m}$) e mesma altura ($4\\text{ m}$), o retângulo mede $12\\text{ m}^2$ e o triângulo mede metade ($6\\text{ m}^2$).',
      },
      D: {
        rotulo: 'o perímetro do retângulo é $12\\text{ m}$.',
        diagnosticoPt: 'Você calculou $3 \\times 4$ (isso é a ÁREA!), enquanto o perímetro soma os 4 lados: $3 + 4 + 3 + 4 = 14\\text{ m}$.',
        tagErro: 'leitura_interpretacao',
      },
      E: {
        rotulo: 'o triângulo tem área de $12\\text{ m}^2$.',
        diagnosticoPt: 'Você fez base $\\times$ altura esquecendo de dividir por 2 na fórmula da área do triângulo.',
        tagErro: 'algebra_manipulacao',
      },
    },
    dicas: [
      'Todas as três figuras estão presas entre as mesmas retas paralelas, logo têm a mesma altura ($4\\text{ m}$).',
      'Compare diretamente o retângulo e o triângulo: eles têm a mesma base e a mesma altura!',
      'Armadilha clássica: esquecer o $\\div 2$ nas áreas do triângulo e do trapézio ou confundir área com perímetro no retângulo.',
    ],
    solucaoCompletaPt: '$A_{\\text{ret}} = 3 \\times 4 = 12\\text{ m}^2$; $A_{\\text{tri}} = \\frac{3 \\times 4}{2} = 6\\text{ m}^2$; $A_{\\text{trap}} = \\frac{(5 + 3) \\times 4}{2} = 16\\text{ m}^2$. Logo a área do retângulo é exatamente o dobro da área do triângulo.',
    atalhoPt: 'Não precisa nem fazer todas as contas: todo triângulo com mesma base e mesma altura de um retângulo ocupa exatamente metade de sua área.',
    outroCaminhoPt: 'Confira o perímetro do retângulo ($14\\text{ m}$) e descarte os erros de falta do $\\div 2$.',
    dicaVidaRealPt: 'Figuras entre paralelas mantêm altura constante — um princípio muito explorado por Cavalieri e provas técnicas.',
  },
  {
    id: 'senai_2023_2215_q40',
    ano: 2023,
    cge: 2215,
    questao: 40,
    grau: 7,
    temaId: 'enem_funcoes_sequencias',
    chaveFigura: 'senai:2023:2215:40',
    correta: 'A',
    enunciadoMarkdown:
      'Um terreno de formato retangular possui o lado maior igual ao triplo do lado menor mais 6 metros ($3x + 6$ e $x$), conforme mostra o desenho fora de escala.\n\nSabendo que a área total do terreno é igual a $765\\text{ m}^2$, a medida, em metros, do seu lado menor é igual a',
    alternativas: {
      A: {
        rotulo: '15.',
        valorNumerico: 15,
        diagnosticoPt: 'Correto! Com lado menor igual a 15 m, o maior vale $3(15) + 6 = 51\\text{ m}$, e $15 \\times 51 = 765\\text{ m}^2$.',
      },
      B: {
        rotulo: '21.',
        valorNumerico: 21,
        diagnosticoPt: 'Para lado menor $21\\text{ m}$, o maior seria $69\\text{ m}$, levando a área acima de $1.400\\text{ m}^2$.',
        tagErro: 'calculo_aritmetico',
      },
      C: {
        rotulo: '24.',
        valorNumerico: 24,
        diagnosticoPt: 'Se $x = 24$, o lado maior passaria de $75\\text{ m}$ e o produto ultrapassaria muito $765\\text{ m}^2$.',
        tagErro: 'calculo_aritmetico',
      },
      D: {
        rotulo: '45.',
        valorNumerico: 45,
        diagnosticoPt: '$45$ é o triplo do lado menor ($3x$), e não a medida do lado menor $x$!',
        tagErro: 'leitura_interpretacao',
      },
      E: {
        rotulo: '51.',
        valorNumerico: 51,
        diagnosticoPt: 'Atenção: $51\\text{ m}$ é o comprimento do lado MAIOR ($3x + 6$), enquanto a questão pergunta o lado MENOR!',
        tagErro: 'leitura_interpretacao',
      },
    },
    dicas: [
      'A área do retângulo é $x(3x + 6) = 765$; você pode dividir toda a equação por 3 logo no início para simplificar!',
      'Simplificando por 3, obtemos $x(x + 2) = 255$: procure dois números cuja diferença seja 2 e o produto seja 255.',
      'Armadilha: resolver certinho e acabar marcando a medida do lado maior em vez da do lado menor.',
    ],
    solucaoCompletaPt: '$x(3x + 6) = 765 \\xrightarrow{\\div 3} x(x + 2) = 255 \\Rightarrow x^2 + 2x - 255 = 0$. Fatorando: $(x - 15)(x + 17) = 0$. Como $x > 0$, temos $x = 15\\text{ m}$.',
    atalhoPt: 'Note que $255 = 256 - 1 = 16^2 - 1^2 = (16 - 1)(16 + 1) = 15 \\times 17$!',
    outroCaminhoPt: 'Usando o último dígito do produto $x(3x+6) = 765$: $x$ precisa terminar em 5 ou 0; testando o primeiro múltiplo válido encontra-se a resposta na hora.',
    dicaVidaRealPt: 'Dividir todos os coeficientes por um fator comum antes de aplicar Bhaskara reduz erros de conta em 90%.',
  },
  {
    id: 'senai_2023_2215_q37',
    ano: 2023,
    cge: 2215,
    questao: 37,
    grau: 5,
    temaId: 'enem_porcentagem_financeira',
    correta: 'B',
    enunciadoMarkdown:
      'Em uma operação de fiscalização das condições do transporte escolar, foram vistoriados $2.500$ veículos.\n\nDentre algumas das irregularidades encontradas estão:\n- falta de cinto de segurança ($21\\%$);\n- extintores de incêndio com prazo vencido ($32\\%$);\n- pneus carecas e sem condições de uso ($15\\%$);\n- ausência de monitores para acompanhar as crianças ($5\\%$);\n- documentação irregular ($12\\%$). \n\nDe acordo com esses dados, afirma-se que dos $2.500$ veículos vistoriados,',
    alternativas: {
      A: {
        rotulo: '800 apresentam pneus carecas e sem condições de uso.',
        diagnosticoPt: '800 veículos equivalem a $32\\%$ (extintores vencidos), enquanto pneus carecas são $15\\%$ ($375$ veículos).',
        tagErro: 'leitura_interpretacao',
      },
      B: {
        rotulo: '525 não possuem cinto de segurança.',
        diagnosticoPt: 'Correto! $21\\%$ de $2.500$ são exatamente $21 \\times 25$ veículos sem cinto de segurança.',
      },
      C: {
        rotulo: '375 não possuem monitores.',
        diagnosticoPt: '375 veículos correspondem a $15\\%$ (pneus carecas); ausência de monitores é $5\\%$ ($125$ veículos).',
        tagErro: 'leitura_interpretacao',
      },
      D: {
        rotulo: '300 estão com extintores de incêndio com prazo vencido.',
        diagnosticoPt: '300 veículos representam $12\\%$ (documentação irregular), e não os $32\\%$ dos extintores.',
        tagErro: 'leitura_interpretacao',
      },
      E: {
        rotulo: '125 estão com a documentação irregular.',
        diagnosticoPt: '125 veículos são $5\\%$ (monitores ausentes); documentação irregular soma $12\\%$ ($300$ veículos).',
        tagErro: 'leitura_interpretacao',
      },
    },
    dicas: [
      'Como $1\\%$ de $2.500$ é exatamente $25$, basta multiplicar cada percentual por $25$ e conferir qual afirmação bate.',
      'Verifique par por par sem pressa: as alternativas falsas misturaram os números certos com as categorias erradas!',
      'Dica: multiplique $25 \\times 20 + 25 \\times 1$ para testar rapidamente a segunda opção.',
    ],
    solucaoCompletaPt: '$1\\%$ de $2.500 = 25$. Assim: sem cinto $= 21 \\times 25 = 525$; extintores $= 32 \\times 25 = 800$; pneus $= 15 \\times 25 = 375$; monitores $= 5 \\times 25 = 125$; documentação $= 12 \\times 25 = 300$. Logo a afirmação dos cintos de segurança é a única verdadeira.',
    atalhoPt: 'Calcule $1\\% = 25$ uma só vez e confira as associações categoria–valor.',
    outroCaminhoPt: 'Faça $10\\% = 250$ para checar rapidamente cada faixa percentual.',
    dicaVidaRealPt: 'Questões com vários dados percentuais costumam esconder pegadinhas trocando rótulos entre linhas.',
  },
  {
    id: 'senai_2017_2128_q27',
    ano: 2017,
    cge: 2128,
    questao: 27,
    grau: 6,
    temaId: 'enem_geometria_medidas',
    chaveFigura: 'senai:2017:2128:27',
    correta: 'A',
    enunciadoMarkdown:
      'Durante uma competição do tipo "faça se puder", os atletas precisam subir, apoiados em uma escada, a altura de $28\\text{ m}$, saindo de uma plataforma que está a $4\\text{ m}$ de altura e à distância de $10\\text{ m}$ (na horizontal), conforme a figura.\n\nDesse modo, o comprimento da escada será de',
    alternativas: {
      A: {
        rotulo: '26,0 m.',
        valorNumerico: 26.0,
        diagnosticoPt: 'Perfeito! O desnível vencido pela escada é $28 - 4 = 24\\text{ m}$ e a base horizontal é $10\\text{ m}$, formando o triângulo $(10, 24, 26)$.',
      },
      B: {
        rotulo: '24,0 m.',
        valorNumerico: 24.0,
        diagnosticoPt: 'Esse é apenas o cateto vertical da subida ($28 - 4$), e não a hipotenusa inclinada da escada.',
        tagErro: 'leitura_interpretacao',
      },
      C: {
        rotulo: '30,0 m.',
        valorNumerico: 30.0,
        diagnosticoPt: 'Você calculou a hipotenusa usando $28\\text{ m}$ de altura total em vez de descontar os $4\\text{ m}$ da plataforma.',
        tagErro: 'geometria_escala',
      },
      D: {
        rotulo: '30,5 m.',
        valorNumerico: 30.5,
        diagnosticoPt: 'Revise a subtração das alturas ($28 - 4$) antes de aplicar o Teorema de Pitágoras.',
        tagErro: 'calculo_aritmetico',
      },
      E: {
        rotulo: '34,5 m.',
        valorNumerico: 34.5,
        diagnosticoPt: 'A escada inclina sobre um desnível de $24\\text{ m}$ e afastamento de $10\\text{ m}$; somar diretamente não dá a hipotenusa.',
        tagErro: 'calculo_aritmetico',
      },
    },
    dicas: [
      'A escada NÃO começa no chão (altura zero): ela está apoiada sobre uma plataforma de $4\\text{ m}$.',
      'Desconte os $4\\text{ m}$ da plataforma para achar o cateto vertical, e aplique Pitágoras com o cateto horizontal de $10\\text{ m}$.',
      'Repare que os catetos $(10, 24)$ são exatamente o dobro de $(5, 12)$!',
    ],
    solucaoCompletaPt: 'Altura vencida pela escada = $28 - 4 = 24\\text{ m}$. Pelo Teorema de Pitágoras: $L^2 = 24^2 + 10^2 = 576 + 100 = 676 \\Rightarrow L = 26{,}0\\text{ m}$.',
    atalhoPt: 'Terno pitagórico $2 \\times (5, 12, 13) = (10, 24, 26)$.',
    outroCaminhoPt: 'Some $24^2 = 576$ e $10^2 = 100$ e lembre que $26^2 = 676$.',
    dicaVidaRealPt: 'Escalas e rampas sempre medem o desnível entre os dois pontos de apoio reais, não necessariamente do solo.',
  },
  {
    id: 'senai_2017_2128_q30',
    ano: 2017,
    cge: 2128,
    questao: 30,
    grau: 6,
    temaId: 'enem_geometria_medidas',
    chaveFigura: 'senai:2017:2128:30',
    correta: 'A',
    enunciadoMarkdown:
      'O projeto de um chalé, conforme esboço sem escala, possui dois pavimentos paralelos: o $1^\\circ$ pavimento e o pavimento térreo (de comprimento $6\\text{ m}$).\n\nA água do telhado tem comprimento total inclinado de $8\\text{ m}$ do cume até a base do térreo, sendo que o trecho inclinado entre o $1^\\circ$ pavimento e o térreo mede $5\\text{ m}$.\n\nQual é a medida do comprimento, em metros, do $1^\\circ$ pavimento?',
    alternativas: {
      A: {
        rotulo: '2,25.',
        valorNumerico: 2.25,
        diagnosticoPt: 'Correto! O triângulo superior tem lateral inclinada de $8 - 5 = 3\\text{ m}$, logo por semelhança $\\frac{x}{6} = \\frac{3}{8}$.',
      },
      B: {
        rotulo: '2,50.',
        valorNumerico: 2.5,
        diagnosticoPt: 'Verifique a razão entre a lateral do triângulo superior ($3\\text{ m}$) e a lateral inteira ($8\\text{ m}$).',
        tagErro: 'calculo_aritmetico',
      },
      C: {
        rotulo: '3,60.',
        valorNumerico: 3.6,
        diagnosticoPt: 'Se $3$ fosse dividido por $5$ (em vez de $8$), daria $3{,}60$, mas na semelhança de triângulos compara-se com o lado total do triângulo grande!',
        tagErro: 'geometria_escala',
      },
      D: {
        rotulo: '3,75.',
        valorNumerico: 3.75,
        diagnosticoPt: 'Você calculou a razão usando o trecho inferior ($5/8 \\times 6$) em vez do trecho superior do triângulo menor ($3/8 \\times 6$).',
        tagErro: 'leitura_interpretacao',
      },
      E: {
        rotulo: '4,00.',
        valorNumerico: 4.0,
        diagnosticoPt: 'Subtrair $8 - 5$ para o lado e tentar subtrair algo de $6$ não preserva a semelhança proporcional.',
        tagErro: 'proporcao_invertida',
      },
    },
    dicas: [
      'Como os pavimentos são paralelos, o triângulo do telhado superior é semelhante ao triângulo completo até o térreo.',
      'Quanto mede o lado direito inclinado apenas do triângulo superior? Subtraia $5\\text{ m}$ do comprimento total de $8\\text{ m}$.',
      'Armadilha clássica: usar $5/8$ ou $3/5$ em vez de comparar o lado do triângulo pequeno ($3$) com o lado completo do grande ($8$).',
    ],
    solucaoCompletaPt: 'Lado inclinado superior = $8 - 5 = 3\\text{ m}$. Por semelhança: $\\frac{L_1}{6} = \\frac{3}{8} \\Rightarrow L_1 = \\frac{18}{8} = 2{,}25\\text{ m}$.',
    atalhoPt: '$3/8$ de $6 = 18/8 = 9/4 = 2{,}25\\text{ m}$.',
    outroCaminhoPt: 'Lembre que $1/8 = 0{,}125$, logo $18 \\times 0{,}125 = 2{,}25\\text{ m}$.',
    dicaVidaRealPt: 'Na semelhança de triângulos por base paralela, compare sempre lado correspondente com lado completo do triângulo.',
  },
  {
    id: 'senai_2017_2128_q37',
    ano: 2017,
    cge: 2128,
    questao: 37,
    grau: 5,
    temaId: 'enem_geometria_medidas',
    chaveFigura: 'senai:2017:2128:37',
    correta: 'B',
    enunciadoMarkdown:
      'Certos veículos possuem o macaco hidráulico para troca de pneu na forma de um losango. Quando está na posição final de elevação, o ângulo superior indicado do macaco mede $80^\\circ$, conforme mostrado na figura.\n\nQual é a medida, em graus, do ângulo indicado pela letra $x$ na figura?',
    alternativas: {
      A: {
        rotulo: '50.',
        valorNumerico: 50,
        diagnosticoPt: 'Você calculou apenas metade do ângulo interno lateral como se $x$ fosse apenas até o eixo central!',
        tagErro: 'leitura_interpretacao',
      },
      B: {
        rotulo: '100.',
        valorNumerico: 100,
        diagnosticoPt: 'Correto! No losango, ângulos opostos são iguais e quaisquer dois ângulos consecutivos somam $180^\\circ$.',
      },
      C: {
        rotulo: '140.',
        valorNumerico: 140,
        diagnosticoPt: 'Se o ângulo lateral fosse $140^\\circ$, os quatro ângulos do losango somariam $80 + 80 + 140 + 140 = 440^\\circ$, passando de $360^\\circ$.',
        tagErro: 'geometria_escala',
      },
      D: {
        rotulo: '165.',
        valorNumerico: 165,
        diagnosticoPt: 'Verifique a soma interna de qualquer quadrilátero ($360^\\circ$) descontando dois ângulos opostos de $80^\\circ$.',
        tagErro: 'calculo_aritmetico',
      },
      E: {
        rotulo: '200.',
        valorNumerico: 200,
        diagnosticoPt: '200° é a SOMA dos dois ângulos laterais juntos ($x + x$), esquecendo de dividir por 2 para obter apenas $x$!',
        tagErro: 'leitura_interpretacao',
      },
    },
    dicas: [
      'A figura é um losango (quadrilátero com lados opostos paralelos e ângulos opostos iguais).',
      'Em todo paralelogramo/losango, dois ângulos vizinhos são suplementares (somam $180^\\circ$).',
      'Armadilha: achar $360^\\circ - 160^\\circ = 200^\\circ$ e esquecer que esse total se divide igualmente entre os dois vértices laterais.',
    ],
    solucaoCompletaPt: 'Os quatro ângulos do losango somam $360^\\circ$ e os opostos são iguais: $80^\\circ + 80^\\circ + x + x = 360^\\circ \\Rightarrow 2x = 200^\\circ \\Rightarrow x = 100^\\circ$.',
    atalhoPt: 'Ângulos consecutivos no losango somam $180^\\circ$: $180^\\circ - 80^\\circ = 100^\\circ$.',
    outroCaminhoPt: 'O eixo divide $x$ em duas metades que completam $\\triangle$ retângulo com $40^\\circ$, logo cada metade mede $50^\\circ$ e $x = 2 \\times 50^\\circ$.',
    dicaVidaRealPt: 'Mecanismos articulados em losango conservam ângulos opostos iguais em qualquer altura de abertura.',
  },
  {
    id: 'senai_2016_2125_q30',
    ano: 2016,
    cge: 2125,
    questao: 30,
    grau: 6,
    temaId: 'enem_geometria_medidas',
    chaveFigura: 'senai:2016:2125:30',
    correta: 'D',
    enunciadoMarkdown:
      'Há duas estradas que cruzam as cidades $A, B, C, D$ e $E, F, G, H$. Outras quatro estradas, paralelas entre si, passam pelas cidades $(A\\text{ e }E)$, $(B\\text{ e }F)$, $(C\\text{ e }G)$ e $(D\\text{ e }H)$.\n\nAs distâncias $AB = 50\\text{ km}$, $BC = 60\\text{ km}$, $CD = 90\\text{ km}$ e a distância total de $E$ até $H$ ($600\\text{ km}$) estão representadas no esquema.\n\nNessas condições, qual é a distância entre as cidades $G$ e $H$, em $\\text{km}$?',
    alternativas: {
      A: {
        rotulo: '90.',
        valorNumerico: 90,
        diagnosticoPt: '$90\\text{ km}$ é a distância entre $C$ e $D$ na outra rodovia, que tem escala três vezes menor que o trecho $E$ até $H$.',
        tagErro: 'leitura_interpretacao',
      },
      B: {
        rotulo: '150.',
        valorNumerico: 150,
        diagnosticoPt: 'Esse valor corresponde ao trecho $EF$ (proporcional aos $50\\text{ km}$ de $AB$), e não ao trecho final $GH$.',
        tagErro: 'leitura_interpretacao',
      },
      C: {
        rotulo: '180.',
        valorNumerico: 180,
        diagnosticoPt: 'Esse valor corresponde ao trecho intermediário $FG$ (proporcional aos $60\\text{ km}$ de $BC$).',
        tagErro: 'leitura_interpretacao',
      },
      D: {
        rotulo: '270.',
        valorNumerico: 270,
        diagnosticoPt: 'Correto! A distância total de $A$ até $D$ soma $200\\text{ km}$, exatamente um terço dos $600\\text{ km}$ de $E$ até $H$; multiplicando $90$ por 3 encontra-se $GH$.',
      },
      E: {
        rotulo: '510.',
        valorNumerico: 510,
        diagnosticoPt: 'Subtrações diretas entre $600$ e $90$ não respeitam a proporcionalidade do Teorema de Tales.',
        tagErro: 'proporcao_invertida',
      },
    },
    dicas: [
      'Some as três distâncias parciais na primeira estrada ($AB + BC + CD$) para achar a extensão total de $A$ até $D$.',
      'Compare a extensão total de $A$ até $D$ com os $600\\text{ km}$ da extensão de $E$ até $H$: qual é o fator de multiplicação entre as duas estradas?',
      'Use exatamente o mesmo fator sobre o segmento $CD$ ($90\\text{ km}$) para achar $GH$.',
    ],
    solucaoCompletaPt: '$AD = 50 + 60 + 90 = 200\\text{ km}$. Pelo Teorema de Tales: $\\frac{GH}{90} = \\frac{600}{200} = 3 \\Rightarrow GH = 3 \\times 90 = 270\\text{ km}$.',
    atalhoPt: 'Como $600$ é o triplo de $200$, cada segmento da direita vale o triplo do correspondente da esquerda.',
    outroCaminhoPt: 'Confira a soma da direita: $150 + 180 + 270 = 600\\text{ km}$.',
    dicaVidaRealPt: 'Quando o todo correspondente for informado, compare "todo/todo" com "parte/parte" no Teorema de Tales.',
  },
  {
    id: 'senai_2016_2125_q21',
    ano: 2016,
    cge: 2125,
    questao: 21,
    grau: 6,
    temaId: 'enem_funcoes_sequencias',
    correta: 'E',
    enunciadoMarkdown:
      'Lendo 6 páginas de um livro por dia, um estudante consegue terminar sua leitura 10 dias antes do que se tivesse lido 5 páginas por dia.\n\nQuantas páginas tem o livro?',
    alternativas: {
      A: {
        rotulo: '50.',
        valorNumerico: 50,
        diagnosticoPt: 'Um livro de 50 páginas seria lido em 10 dias a 5/dia e ~8,3 dias a 6/dia — diferença menor que 2 dias.',
        tagErro: 'calculo_aritmetico',
      },
      B: {
        rotulo: '60.',
        valorNumerico: 60,
        diagnosticoPt: 'Com 60 páginas, a diferença seria de apenas $12 - 10 = 2$ dias entre os dois ritmos.',
        tagErro: 'calculo_aritmetico',
      },
      C: {
        rotulo: '110.',
        valorNumerico: 110,
        diagnosticoPt: '110 não é múltiplo de 6 nem de 30, e geraria menos de 4 dias de diferença.',
        tagErro: 'calculo_aritmetico',
      },
      D: {
        rotulo: '240.',
        valorNumerico: 240,
        diagnosticoPt: 'Em 240 páginas a diferença entre $240/5 = 48$ dias e $240/6 = 40$ dias é de 8 dias.',
        tagErro: 'calculo_aritmetico',
      },
      E: {
        rotulo: '300.',
        valorNumerico: 300,
        diagnosticoPt: 'Excelente! A $6\\text{ pág/dia}$ leva $50$ dias e a $5\\text{ pág/dia}$ leva $60$ dias — exatamente $10$ dias antes.',
      },
    },
    dicas: [
      'Se o livro tem $x$ páginas, quanto tempo leva lendo $5$ por dia ($\\frac{x}{5}$) e lendo $6$ por dia ($\\frac{x}{6}$)?',
      'Monte a equação da diferença de tempo: $\\frac{x}{5} - \\frac{x}{6} = 10$.',
      'Repare que $\\frac{1}{5} - \\frac{1}{6} = \\frac{1}{30}$!',
    ],
    solucaoCompletaPt: '$\\frac{x}{5} - \\frac{x}{6} = 10 \\Rightarrow \\frac{6x - 5x}{30} = 10 \\Rightarrow \\frac{x}{30} = 10 \\Rightarrow x = 300\\text{ páginas}$.',
    atalhoPt: 'No tempo dos 10 dias extras a 5 pág/dia acumulam-se $50$ páginas; como se ganha 1 pág/dia ao mudar para 6/dia, o ritmo mais rápido levou $50$ dias ($50 \\times 6 = 300$).',
    outroCaminhoPt: 'O total de páginas precisa ser múltiplo de $\\operatorname{MMC}(5, 6) = 30$: cada bloco de $30$ páginas economiza $6 - 5 = 1$ dia; para economizar 10 dias, são $10$ blocos de $30$.',
    dicaVidaRealPt: 'Transformar velocidade em "dias ganhos por bloco de MMC" resolve problemas de ritmo de cabeça!',
  },
]

export const SENAI_MATEMATICA_LOTE1: readonly DesafioUnificado[] = SPECS_SENAI.map(construirDesafioSenai)
