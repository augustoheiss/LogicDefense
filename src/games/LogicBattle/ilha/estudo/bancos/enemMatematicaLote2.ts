/**
 * Lote 2 — matematica oficial do caderno 5 amarelo que ainda nao entrava no LogicBattle.
 *
 * 2009 e 2010 nao tinham PDF de gabarito na pasta: a letra foi resolvida e conferida
 * com o gabarito oficial publicado. 2017, 2020 e 2026 ja tinham PDF e ficaram de fora
 * do lote 1. Enunciado e alternativas seguem o caderno, com citacao CC BY-ND 3.0.
 * Dicas 1..3 desenham o caminho e nao entregam o valor final. A conta fechada fica
 * em posAcerto, liberada so depois do acerto.
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

const SPECS_ENEM_MATEMATICA_LOTE2: readonly SpecEnemOficial[] = [
  {
    ano: 2009,
    questao: 140,
    grau: 5,
    temaId: 'enem_porcentagem_financeira',
    correta: 'D',
    enunciadoMarkdown:
      'Uma resolução do Conselho Nacional de Política Energética (CNPE) estabeleceu a obrigatoriedade de adição de biodísel ao óleo dísel comercializado nos postos. A exigência é que, a partir de 1.º de julho de 2009, 4% do volume da mistura final seja formada por biodísel. Até junho de 2009, esse percentual era de 3%. Essa medida estimula a demanda de biodísel, bem como possibilita a redução da importação de dísel de petróleo.\n\nEstimativas indicam que, com a adição de 4% de biodísel ao dísel, serão consumidos 925 milhões de litros de biodísel no segundo semestre de 2009. Considerando-se essa estimativa, para o mesmo volume da mistura final dísel/biodísel consumida no segundo semestre de 2009, qual seria o consumo de biodísel com a adição de 3%?',
    alternativas: {
      A: {
        rotulo: '27,75 milhões de litros.',
        valorNumerico: 27.75,
        diagnosticoPt: 'Isso é 3% de 925. Você trocou a base: 925 já é a fatia de 4%, não o copo inteiro da mistura.',
        tagErro: 'porcentagem_base',
      },
      B: {
        rotulo: '37,00 milhões de litros.',
        valorNumerico: 37,
        diagnosticoPt: 'Esse número parece um "4% de alguma coisa" solto. A mistura inteira continua a mesma; muda só a fatia.',
        tagErro: 'porcentagem_base',
      },
      C: {
        rotulo: '231,25 milhões de litros.',
        valorNumerico: 231.25,
        diagnosticoPt: 'Você achou quanto vale 1% da mistura e parou no meio do caminho. A pergunta pede a fatia de 3%.',
        tagErro: 'calculo_aritmetico',
      },
      D: {
        rotulo: '693,75 milhões de litros.',
        valorNumerico: 693.75,
        diagnosticoPt: 'Isso. A mistura não muda. Três fatias de 1% cabem dentro das quatro que somam 925 milhões.',
      },
      E: {
        rotulo: '888,00 milhões de litros.',
        valorNumerico: 888,
        diagnosticoPt: 'Você tirou um pedaço pequeno de 925, como se 925 fosse a mistura inteira. 925 já é só o biodísel de 4%.',
        tagErro: 'porcentagem_base',
      },
    },
    dicas: [
      'Sublinhe a frase "o mesmo volume da mistura final". O copo de diesel+biodiesel não muda de tamanho. O que muda é a fatia de biodiesel dentro dele: de 4% para 3%.',
      'Resumo de boteco: 925 milhões não é o tanque. É só a fatia de 4% do tanque. Desenhe uma barra, risque quatro pedaços iguais, escreva 925 em cima dos quatro. Um pedaço é 1%. A pergunta quer três pedaços.',
      'Primeiro passo: divida 925 por 4 para achar 1% da mistura, e multiplique por 3. Armadilha clássica de porcentagem: calcular 3% de 925. Isso responde outra pergunta, a de "quanto é 3% da fatia", não "quanto é a fatia de 3%".',
    ],
    solucaoCompletaPt:
      'Desenho: a mistura inteira é 100%. Desses 100%, 4% valem 925 milhões de litros. Então 1% vale 925 ÷ 4 = 231,25 milhões. A fatia de 3% vale 3 × 231,25 = 693,75 milhões de litros. Outra forma da mesma ideia: 3% está para 4% assim como o consumo novo está para 925, então novo = 925 × 3/4 = 693,75. A base errada (3% de 925) dá 27,75 e parece conta de padaria, mas troca o copo inteiro pela fatia.',
    atalhoPt: '925 milhões são 4 fatias iguais. A pergunta pede 3 dessas fatias: 925 × 3/4.',
    outroCaminhoPt:
      'Ache o volume da mistura: 925 ÷ 0,04 = 23 125 milhões de litros. Aí 3% desse tanque: 0,03 × 23 125 = 693,75. Mais longo, mesmo universo: porcentagem é fatia de um todo que você precisa nomear antes de multiplicar.',
    dicaVidaRealPt:
      'Toda vez que a notícia diz "era 4%, passou a 3%", pergunte: 4% de quê? Se o todo ficou parado, a regra de três é entre as duas fatias, não entre a fatia e ela mesma.',
  },
  {
    ano: 2009,
    questao: 146,
    grau: 6,
    temaId: 'enem_probabilidade_contagem',
    correta: 'C',
    enunciadoMarkdown:
      'O controle de qualidade de uma empresa fabricante de telefones celulares aponta que a probabilidade de um aparelho de determinado modelo apresentar defeito de fabricação é de 0,2%. Se uma loja acaba de vender 4 aparelhos desse modelo para um cliente, qual é a probabilidade de esse cliente sair da loja com exatamente dois aparelhos defeituosos?',
    alternativas: {
      A: {
        rotulo: '2 × (0,2%)^4.',
        diagnosticoPt: 'O expoente 4 pede quatro defeitos, e o cliente saiu com exatamente dois. O 2 da frente também não é a quantidade de duplas.',
        tagErro: 'combinatoria_probabilidade',
      },
      B: {
        rotulo: '4 × (0,2%)^2.',
        diagnosticoPt: 'Faltou a chance dos dois aparelhos bons. E 4 não é o número de jeitos de escolher quais dois, entre quatro, vieram defeituosos.',
        tagErro: 'combinatoria_probabilidade',
      },
      E: {
        rotulo: '6 × (0,2%) × (99,8%).',
        diagnosticoPt: 'A contagem das duplas pode estar no caminho, mas cada caso tem dois defeitos e dois aparelhos bons. Cada fator entra duas vezes, não uma.',
        tagErro: 'combinatoria_probabilidade',
      },
      C: {
        rotulo: '6 × (0,2%)^2 × (99,8%)^2.',
        diagnosticoPt: 'Fechou. Duas falhas, dois aparelhos bons, e seis jeitos de escolher a dupla que falhou.',
      },
      D: {
        rotulo: '4 × (0,2%).',
        diagnosticoPt: 'Isso parece "quatro vezes a chance de um defeito". A pergunta pede exatamente dois defeitos numa compra de quatro, com a ordem das escolhas.',
        tagErro: 'combinatoria_probabilidade',
      },
    },
    dicas: [
      'A pergunta tem três palavras que mandam na conta: exatamente, dois, e quatro aparelhos. "Exatamente dois" não é "pelo menos dois" e não é "o segundo aparelho".',
      'Resumo de boteco: imagine os quatro celulares em cima do balcão. Você circula uma dupla que veio com defeito. Os outros dois precisam ter vindo bons. A chance de um defeito é 0,2%. A chance de um bom é o que falta para 100%.',
      'Primeiro passo: conte de quantos jeitos dá para escolher a dupla defeituosa entre os quatro aparelhos. Depois multiplique a chance de defeito por ela mesma e a chance de aparelho bom por ela mesma. Armadilha: esquecer os aparelhos bons, ou elevar 0,2% à quarta como se os quatro tivessem falhado.',
    ],
    solucaoCompletaPt:
      'Cada aparelho sai defeituoso com probabilidade 0,2% = 0,002 e bom com 99,8% = 0,998, e um não influencia o outro. Para exatamente dois defeitos em quatro aparelhos, primeiro escolha quais dois falharam: o número de duplas é C(4,2) = 4×3/2 = 6. Cada dupla tem probabilidade (0,002)^2 × (0,998)^2. Como as seis duplas não acontecem juntas, soma-se seis vezes a mesma chance: 6 × (0,2%)^2 × (99,8%)^2. É o termo do meio do binômio, não um "vezes 4" de padaria.',
    atalhoPt: 'Exatamente 2 defeitos em 4 aparelhos: C(4,2) × (chance de defeito)^2 × (chance de bom)^2.',
    outroCaminhoPt:
      'Liste um caminho, por exemplo defeito, defeito, bom, bom, e multiplique as quatro chances. Depois multiplique pelos arranjos dessa palavra de quatro letras com duas iguais de cada tipo: 4!/(2!2!) = 6. Chega no mesmo produto.',
    dicaVidaRealPt:
      'Sempre que a frase disser "exatamente k em n", o universo cobra duas coisas: quais posições, e a chance do que sobrou. Esquecer o que sobrou é o erro que a vida real mais perdoa na conversa e menos perdoa na conta.',
  },
  {
    ano: 2009,
    questao: 152,
    grau: 6,
    temaId: 'enem_aritmetica_ciclos',
    correta: 'D',
    enunciadoMarkdown:
      'Um grupo de 50 pessoas fez um orçamento inicial para organizar uma festa, que seria dividido entre elas em cotas iguais. Verificou-se ao final que, para arcar com todas as despesas, faltavam R$ 510,00, e que 5 novas pessoas haviam ingressado no grupo. No acerto foi decidido que a despesa total seria dividida em partes iguais pelas 55 pessoas. Quem não havia ainda contribuído pagaria a sua parte, e cada uma das 50 pessoas do grupo inicial deveria contribuir com mais R$ 7,00.\n\nDe acordo com essas informações, qual foi o valor da cota calculada no acerto final para cada uma das 55 pessoas?',
    alternativas: {
      A: {
        rotulo: 'R$ 14,00.',
        valorNumerico: 14,
        diagnosticoPt: 'O 7 entrou duas vezes na sua cabeça, como se a cota nova fosse o dobro do acréscimo. O 7 é só a diferença entre a cota nova e a antiga.',
        tagErro: 'leitura_interpretacao',
      },
      B: {
        rotulo: 'R$ 17,00.',
        valorNumerico: 17,
        diagnosticoPt: 'Você somou pessoas novas com o acréscimo e tratou isso como se fosse a cota. A cota é dinheiro, não uma mistura de 5 com 7.',
        tagErro: 'leitura_interpretacao',
      },
      C: {
        rotulo: 'R$ 22,00.',
        valorNumerico: 22,
        diagnosticoPt: 'Faltou igualar as duas descrições da mesma despesa. Uma conta solta com 510, 50 e 7 não fecha o total.',
        tagErro: 'calculo_aritmetico',
      },
      D: {
        rotulo: 'R$ 32,00.',
        valorNumerico: 32,
        diagnosticoPt: 'A despesa é uma só. Escrita com as 50 cotas antigas mais 510, ou com as 55 cotas novas, dá o mesmo total.',
      },
      E: {
        rotulo: 'R$ 57,00.',
        valorNumerico: 57,
        diagnosticoPt: 'Você juntou 50 e 7 como se a cota fosse "pessoas mais acréscimo". São grandezas diferentes: uma conta gente, a outra conta real.',
        tagErro: 'unidade_escala',
      },
    },
    dicas: [
      'Existe uma despesa só, com dois apelidos. Apelido antigo: 50 cotas iguais, e ainda faltavam 510 reais. Apelido novo: 55 cotas iguais. A pergunta pede a cota nova.',
      'Resumo de boteco: chame a cota nova de f. Cada uma das 50 pessoas antigas paga mais 7 reais para chegar em f, então a cota antiga era f menos 7. Desenhe duas notas de bar para a mesma conta da festa e escreva um sinal de igual entre elas.',
      'Primeiro passo: 50 × (cota antiga) + 510 = 55 × (cota nova), e a cota antiga é a cota nova menos 7. Armadilha: achar que a cota nova é 7, ou 7 mais alguma contagem de pessoas. O 7 é a diferença, não o valor.',
    ],
    solucaoCompletaPt:
      'Seja f a cota final de cada uma das 55 pessoas. A cota antiga, das 50, era f − 7, porque cada uma delas completa mais 7 reais. A despesa total, pelo olhar antigo, é 50(f − 7) + 510. Pelo olhar novo, é 55f. Iguale: 50f − 350 + 510 = 55f. Então 160 = 5f, logo f = 32. Confira: cota antiga = 25. Cinquenta vezes 25 dá 1 250, mais os 510 que faltavam dá 1 760. E 55 × 32 também dá 1 760. A festa inteira custa 1 760 reais; cada um dos 55 leva 32.',
    atalhoPt: 'Uma despesa, duas escritas: 50(f − 7) + 510 = 55f. O 7 é a ponte entre a cota velha e a nova.',
    outroCaminhoPt:
      'Chame a cota antiga de a. Então a nova é a + 7, e 50a + 510 = 55(a + 7). Abre: 50a + 510 = 55a + 385, então 125 = 5a e a = 25. A cota nova é 25 + 7. Mesma ponte, você só atravessou começando do outro lado.',
    dicaVidaRealPt:
      'Quando o grupo cresce e a conta é a mesma, não some gente com dinheiro. Escreva o total de dois jeitos e iguale. O acréscimo por pessoa é a diferença das cotas, não a cota.',
  },
  {
    ano: 2009,
    questao: 158,
    grau: 7,
    temaId: 'enem_aritmetica_ciclos',
    correta: 'A',
    enunciadoMarkdown:
      'Para cada indivíduo, a sua inscrição no Cadastro de Pessoas Físicas (CPF) é composto por um número de 9 algarismos e outro número de 2 algarismos, na forma d1d2, em que os dígitos d1 e d2 são denominados dígitos verificadores. Os dígitos verificadores são calculados, a partir da esquerda, da seguinte maneira: os 9 primeiros algarismos são multiplicados pela sequência 10, 9, 8, 7, 6, 5, 4, 3, 2 (o primeiro por 10, o segundo por 9, e assim sucessivamente); em seguida, calcula-se o resto r da divisão da soma dos resultados das multiplicações por 11, e se esse resto r for 0 ou 1, d1 é zero, caso contrário d1 = (11 – r). O dígito d2 é calculado pela mesma regra, na qual os números a serem multiplicados pela sequência dada são contados a partir do segundo algarismo, sendo d1 o último algarismo, isto é, d2 é zero se o resto s da divisão por 11 das somas das multiplicações for 0 ou 1, caso contrário, d2 = (11 – s).\n\nSuponha que João tenha perdido seus documentos, inclusive o cartão de CPF e, ao dar queixa da perda na delegacia, não conseguisse lembrar quais eram os dígitos verificadores, recordando-se apenas que os nove primeiros algarismos eram 123.456.789. Neste caso, os dígitos verificadores d1 e d2 esquecidos são, respectivamente,',
    alternativas: {
      A: {
        rotulo: '0 e 9.',
        diagnosticoPt: 'O resto da primeira soma, dividido por 11, caiu no caso em que d1 zera. A segunda fila, já com esse d1 no fim, produz o outro dígito.',
      },
      B: {
        rotulo: '1 e 4.',
        diagnosticoPt: 'Você tratou o resto como se ele fosse o próprio dígito. A regra diz: se o resto for 0 ou 1, o dígito é zero; senão, o dígito é 11 menos o resto.',
        tagErro: 'leitura_interpretacao',
      },
      C: {
        rotulo: '1 e 7.',
        diagnosticoPt: 'A segunda conta não recomeça nos mesmos nove algarismos. Ela começa no segundo e termina no d1 que você acabou de obter.',
        tagErro: 'calculo_aritmetico',
      },
      D: {
        rotulo: '9 e 1.',
        diagnosticoPt: 'A ordem pedido é d1 e depois d2. Um deles nasce da primeira fila; o outro só existe depois que o primeiro entra na segunda fila.',
        tagErro: 'leitura_interpretacao',
      },
      E: {
        rotulo: '0 e 1.',
        diagnosticoPt: 'O primeiro dígito realmente zera quando o resto é 0 ou 1. O segundo não copia esse resto: ele tem soma nova e resto novo.',
        tagErro: 'calculo_aritmetico',
      },
    },
    dicas: [
      'O enunciado já entregou a máquina. Não invente outra regra de CPF. São duas rodadas iguais: multiplica pela escada 10, 9, 8, …, 2, soma, divide por 11, olha o resto.',
      'Resumo de boteco: desenhe os nove algarismos 1 2 3 4 5 6 7 8 9 e, embaixo, a escada 10 9 8 7 6 5 4 3 2. Multiplique cada par, some a coluna. O resto dessa soma por 11 decide d1. Se o resto for 0 ou 1, d1 é zero. Senão, d1 é 11 menos o resto.',
      'Primeiro passo: feche d1 antes de pensar em d2. Para d2, a fila nova começa no 2 e termina no d1 que você acabou de achar, de novo embaixo da escada 10 até 2. Armadilha: repetir os mesmos nove algarismos na segunda conta, ou achar que o resto já é o dígito.',
    ],
    solucaoCompletaPt:
      'Primeira fila: 1×10 + 2×9 + 3×8 + 4×7 + 5×6 + 6×5 + 7×4 + 8×3 + 9×2 = 10+18+24+28+30+30+28+24+18 = 210. 210 ÷ 11 = 19 × 11, sobra resto 1, porque 19×11 = 209. Resto 0 ou 1 força d1 = 0. Segunda fila, começando no segundo algarismo e terminando em d1: 2, 3, 4, 5, 6, 7, 8, 9, 0 contra 10, 9, 8, 7, 6, 5, 4, 3, 2. Soma: 20+27+32+35+36+35+32+27+0 = 244. 244 ÷ 11 deixa resto 2, porque 22×11 = 242. Resto 2 não é 0 nem 1, então d2 = 11 − 2 = 9. Os dígitos esquecidos são 0 e 9, nessa ordem.',
    atalhoPt: 'Escada 10 até 2, soma, resto por 11. Resto 0 ou 1 zera o dígito; qualquer outro resto vira 11 menos o resto. A segunda escada já inclui o primeiro dígito.',
    outroCaminhoPt:
      'Dá para somar em pares que fecham dezena para não se perder: (10+18)=28, (24+28)=52, (30+30)=60, (28+24)=52, +18. 28+52=80, +60=140, +52=192, +18=210. O resto por 11 não muda porque você só reorganizou a soma.',
    dicaVidaRealPt:
      'Dígito verificador não é enfeite. É o resto de uma conta combinada de um jeito que um número digitado errado quase sempre quebra. A matemática aqui é um cadeado, não uma musiquinha de tabuada.',
  },
  {
    ano: 2009,
    questao: 163,
    grau: 5,
    temaId: 'enem_razoes_escalas',
    correta: 'B',
    enunciadoMarkdown:
      'Segundo as regras da Fórmula 1, o peso mínimo do carro, de tanque vazio, com o piloto, é de 605 kg, e a gasolina deve ter densidade entre 725 e 780 gramas por litro. Entre os circuitos nos quais ocorrem competições dessa categoria, o mais longo é Spa-Francorchamps, na Bélgica, cujo traçado tem 7 km de extensão. O consumo médio de um carro da Fórmula 1 é de 75 litros para cada 100 km.\n\nSuponha que um piloto de uma equipe específica, que utiliza um tipo de gasolina com densidade de 750 g/L, esteja no circuito de Spa-Francorchamps, parado no box para reabastecimento. Caso ele pretenda dar mais 16 voltas, ao ser liberado para retornar à pista, seu carro deverá pesar, no mínimo,',
    alternativas: {
      A: {
        rotulo: '617 kg.',
        valorNumerico: 617,
        diagnosticoPt: 'Você somou pouca massa ao carro vazio. Confira se os litros viraram quilogramas com a densidade de 750 g por litro, e se as 16 voltas entraram na distância.',
        tagErro: 'unidade_escala',
      },
      B: {
        rotulo: '668 kg.',
        valorNumerico: 668,
        diagnosticoPt: 'O carro vazio pesa 605 kg. A gasolina das 16 voltas, já em quilogramas, senta em cima disso.',
      },
      C: {
        rotulo: '680 kg.',
        valorNumerico: 680,
        diagnosticoPt: 'A densidade 750 g/L não é 750 kg por litro. Sem passar grama para quilograma, a gasolina fica pesada demais.',
        tagErro: 'unidade_escala',
      },
      D: {
        rotulo: '689 kg.',
        valorNumerico: 689,
        diagnosticoPt: 'Algum fator entrou a mais: ou a distância passou de 16×7 km, ou a densidade não foi 0,75 kg por litro.',
        tagErro: 'calculo_aritmetico',
      },
      E: {
        rotulo: '717 kg.',
        valorNumerico: 717,
        diagnosticoPt: 'Você somou litros no peso em quilogramas, como se 1 litro pesasse 1 kg. Essa gasolina pesa 750 g por litro, menos que 1 kg.',
        tagErro: 'unidade_escala',
      },
    },
    dicas: [
      'O peso mínimo pedido é o do carro vazio com piloto, mais a massa da gasolina das próximas 16 voltas. Nada além disso entra na balança.',
      'Resumo de boteco: desenhe três caixas em fila. Caixa 1: distância = voltas × tamanho da volta. Caixa 2: litros = essa distância na regra "75 litros a cada 100 km". Caixa 3: massa = litros × densidade, com a densidade em kg por litro. Aí soma nos 605 kg.',
      'Primeiro passo: 750 g/L é 0,75 kg/L. Armadilha: somar 750, ou somar litros, direto nos 605 kg. Quilograma só casa com quilograma. Grama e litro são visitas, não moram na mesma conta.',
    ],
    solucaoCompletaPt:
      'Dezesseis voltas de 7 km dão 112 km. O consumo é 75 L a cada 100 km, então em 112 km o carro bebe 112 × 75/100 = 84 litros. A densidade é 750 g/L = 0,75 kg/L, logo 84 litros pesam 84 × 0,75 = 63 kg. O mínimo na saída do box é o carro vazio mais essa gasolina: 605 + 63 = 668 kg. Se alguém soma 84 litros como se fossem 84 kg, o carro fica pesado demais na conta e leve demais na pista.',
    atalhoPt: 'Distância, depois litros, depois kg. 16×7 km, regra de 75 L/100 km, densidade 0,75 kg/L, soma em 605 kg.',
    outroCaminhoPt:
      'Por volta: 7 km gastam 7 × 0,75 = 5,25 litros. Dezesseis voltas gastam 84 litros. O resto da conta é o mesmo: massa = 84 × 0,75 kg e soma no carro vazio. Quebrar por volta só deixa o 7 mais visível.',
    dicaVidaRealPt:
      'Densidade é a ponte entre volume e massa. Sem ela, litro e quilograma são idiomas diferentes. A Fórmula 1 só deixa os dois na mesma balança depois da tradução.',
  },
  {
    ano: 2009,
    questao: 171,
    grau: 7,
    temaId: 'enem_probabilidade_contagem',
    correta: 'C',
    enunciadoMarkdown:
      'A população brasileira sabe, pelo menos intuitivamente, que a probabilidade de acertar as seis dezenas da mega sena não é zero, mas é quase. Mesmo assim, milhões de pessoas são atraídas por essa loteria, especialmente quando o prêmio se acumula em valores altos. Até junho de 2009, cada aposta de seis dezenas, pertencentes ao conjunto {01, 02, 03, ..., 59, 60}, custava R$ 1,50.\n\nConsidere que uma pessoa decida apostar exatamente R$ 126,00 e que esteja mais interessada em acertar apenas cinco das seis dezenas da mega sena, justamente pela dificuldade desta última. Nesse caso, é melhor que essa pessoa faça 84 apostas de seis dezenas diferentes, que não tenham cinco números em comum, do que uma única aposta com nove dezenas, porque a probabilidade de acertar a quina no segundo caso em relação ao primeiro é, aproximadamente,',
    alternativas: {
      A: {
        rotulo: '$1\\frac{1}{2}$ vez menor.',
        valorNumerico: 1.5,
        diagnosticoPt: 'A razão entre os dois jeitos de apostar não fica perto de uma vez e meia. Conte os volantes favoráveis de cada estratégia antes de dividir.',
        tagErro: 'combinatoria_probabilidade',
      },
      B: {
        rotulo: '$2\\frac{1}{2}$ vezes menor.',
        valorNumerico: 2.5,
        diagnosticoPt: 'Dois e meio seria um meio-termo confortável. A contagem dos jogos que dão quina não cai nesse meio.',
        tagErro: 'combinatoria_probabilidade',
      },
      C: {
        rotulo: '4 vezes menor.',
        valorNumerico: 4,
        diagnosticoPt: 'As 84 apostas separadas cobrem cerca de quatro vezes mais sorteios de quina do que o bolão de nove dezenas.',
      },
      D: {
        rotulo: '9 vezes menor.',
        valorNumerico: 9,
        diagnosticoPt: 'O nove da aposta grande não é o fator da comparação. Ele entra na combinação, e a combinação não devolve o próprio nove.',
        tagErro: 'combinatoria_probabilidade',
      },
      E: {
        rotulo: '14 vezes menor.',
        valorNumerico: 14,
        diagnosticoPt: 'Catorze não é a razão dos volantes. É um número que aparece quando se mistura o preço com outra conta.',
        tagErro: 'calculo_aritmetico',
      },
    },
    dicas: [
      'Os R$ 126 viram 84 jogos simples porque cada jogo custa R$ 1,50. O segundo caso é um jogo só, marcando nove dezenas. A pergunta compara a chance de quina do segundo com a do primeiro: quantas vezes menor.',
      'Resumo de boteco: quina é acertar exatamente cinco das seis dezenas sorteadas. No primeiro plano, os 84 volantes não compartilham cinco números, então a quina de um não é a quina de outro: as chances se somam. No segundo plano, as combinações de seis números dentro das nove se atropelam. Por isso o bolo de nove dezenas rende menos quinas do que 84 bilhetes separados.',
      'Primeiro passo: para um volante de seis números, os sorteios de quina são as escolhas de 5 entre esses 6, vezes 1 número entre os que ficaram de fora. Para o jogo de nove, os sorteios de quina são as escolhas de 5 entre as nove, vezes 1 entre as de fora das nove. Divida a contagem do primeiro plano pela do segundo. O total de sorteios possíveis da mega-sena aparece nos dois e se cancela. Armadilha: achar que nove dezenas "valem" nove vezes, ou que C(9,6) = 84 já encerra a história. Esse 84 é o preço igual, não a chance igual.',
    ],
    solucaoCompletaPt:
      'Um volante de 6 números acerta a quina em C(6,5)×C(54,1) = 6×54 = 324 sorteios. Os 84 volantes não compartilham cinco números, então não disputam o mesmo sorteio de quina: são 84×324 = 27 216 sorteios favoráveis. No jogo de 9 dezenas, a quina acontece quando exatamente 5 das 6 sorteadas estão entre as 9: C(9,5)×C(51,1) = 126×51 = 6 426 sorteios. A razão é 27 216 / 6 426 ≈ 4,24. A probabilidade do segundo caso é, aproximadamente, 4 vezes menor que a do primeiro. Se alguém ainda soma a sena (C(9,6) = 84) dentro do "pelo menos cinco", o denominador vira 6 510 e a razão continua perto de 4. O "aproximadamente" do enunciado existe para isso.',
    atalhoPt: 'Compare quantidades de sorteios que pagam quina. O C(60,6) é o mesmo nos dois planos e some na divisão.',
    outroCaminhoPt:
      'O jogo de nove dezenas contém C(9,6) = 84 volantes simples, o mesmo número que o primeiro plano compra. A diferença não é a quantidade de volantes: é que esses 84, espremidos em nove números, repetem as mesmas quinas. Separados, sem cinco números em comum, cada quina é exclusiva.',
    dicaVidaRealPt:
      'Pagar o mesmo preço não compra a mesma chance quando os bilhetes se sobrepõem. Em contagem, sobreposição é subtração. O universo não dá desconto para quem marca os números todos juntinhos.',
  },
  {
    ano: 2009,
    questao: 175,
    grau: 6,
    temaId: 'enem_aritmetica_ciclos',
    correta: 'B',
    enunciadoMarkdown:
      'Joana frequenta uma academia de ginástica onde faz exercícios de musculação. O programa de Joana requer que ela faça 3 séries de exercícios em 6 aparelhos diferentes, gastando 30 segundos em cada série. No aquecimento, ela caminha durante 10 minutos na esteira e descansa durante 60 segundos para começar o primeiro exercício no primeiro aparelho. Entre uma série e outra, assim como ao mudar de aparelho, Joana descansa por 60 segundos.\n\nSuponha que, em determinado dia, Joana tenha iniciado seus exercícios às 10h30min e finalizado às 11h7min. Nesse dia e nesse tempo, Joana',
    alternativas: {
      A: {
        rotulo: 'não poderia fazer sequer a metade dos exercícios e dispor dos períodos de descanso especificados em seu programa.',
        diagnosticoPt: 'O tempo que ela ficou na academia cabe o programa inteiro. Metade seria sobra, não falta.',
        tagErro: 'calculo_aritmetico',
      },
      B: {
        rotulo: 'poderia ter feito todos os exercícios e cumprido rigorosamente os períodos de descanso especificados em seu programa.',
        diagnosticoPt: 'A soma da esteira, do suor e de cada descanso de 60 segundos fecha exatamente o intervalo do relógio.',
      },
      C: {
        rotulo: 'poderia ter feito todos os exercícios, mas teria de ter deixado de cumprir um dos períodos de descanso especificados em seu programa.',
        diagnosticoPt: 'Isso acontece se você cobra dois descansos no mesmo vão, o da série e o da troca de aparelho. O enunciado descreve um descanso por vão.',
        tagErro: 'leitura_interpretacao',
      },
      D: {
        rotulo: 'conseguiria fazer todos os exercícios e cumpriria todos os períodos de descanso especificados em seu programa, e ainda se permitiria uma pausa de 7 min.',
        diagnosticoPt: 'Sete minutos sobrando apareceriam se algum bloco de 60 segundos fosse esquecido na lista. Com a lista completa, o relógio fecha no segundo.',
        tagErro: 'calculo_aritmetico',
      },
      E: {
        rotulo: 'não poderia fazer todas as 3 séries dos exercícios especificados em seu programa; em alguma dessas séries deveria ter feito uma série a menos e não deveria ter cumprido um dos períodos de descanso.',
        diagnosticoPt: 'O programa inteiro cabe. Tirar uma série e um descanso é o conserto de uma conta que contou tempo a mais.',
        tagErro: 'calculo_aritmetico',
      },
    },
    dicas: [
      'Primeiro traduza o relógio. Das 10h30 às 11h07 é um intervalo só. Tudo o que Joana fez precisa caber nesse intervalo, sem inventar pausa e sem apagar descanso.',
      'Resumo de boteco: faça uma coluna de guardanapo com cinco linhas. Esteira. Descanso antes do primeiro aparelho. Tempo suando: 3 séries em cada um dos 6 aparelhos, 30 segundos cada. Descansos entre as séries do mesmo aparelho. Descansos ao trocar de aparelho. Some tudo em minutos e encoste no relógio.',
      'Primeiro passo: entre três séries há dois vãos, e são seis aparelhos. Ao mudar de aparelho há um vão a menos do que o número de aparelhos, porque o último não tem para onde mudar. Armadilha: no instante da troca, cobrar o descanso "entre séries" e outro "ao mudar", como se o relógio parasse duas vezes no mesmo segundo.',
    ],
    solucaoCompletaPt:
      'Do relógio: 11h07 − 10h30 = 37 minutos. Esteira: 10 min. Descanso para começar: 60 s = 1 min. Suor: 6 aparelhos × 3 séries × 30 s = 540 s = 9 min. Entre séries do mesmo aparelho: 2 intervalos × 6 aparelhos = 12 min. Troca de aparelho: 5 intervalos × 1 min = 5 min. Total: 10 + 1 + 9 + 12 + 5 = 37 min. Cabe exatamente o programa, com todos os descansos, e não sobra a pausa de 7 min. Joana poderia ter feito todos os exercícios e cumprido rigorosamente os períodos de descanso.',
    atalhoPt: 'Traduza o relógio para minutos e some cinco blocos: esteira, espera inicial, suor, vãos dentro do aparelho, vãos entre aparelhos.',
    outroCaminhoPt:
      'São 18 séries. Entre elas existem 17 vãos de 60 s, seja dentro do aparelho ou na troca: 17 min. Mais 1 min antes da primeira série, 10 min de esteira e 9 min de suor: de novo 37. Os 17 vãos são os mesmos 12+5, só que você contou a fila inteira em vez dos grupos.',
    dicaVidaRealPt:
      'Tempo de treino não é só o tempo suando. O descanso faz parte do programa. Quem soma só o esforço acha que sobrou hora; quem cobra o descanso duas vezes acha que faltou. O relógio é um só.',
  },
  {
    ano: 2010,
    questao: 143,
    grau: 5,
    temaId: 'enem_estatistica_medias',
    correta: 'B',
    enunciadoMarkdown:
      'A classificação de um país no quadro de medalhas nos Jogos Olímpicos depende do número de medalhas de ouro que obteve na competição, tendo como critérios de desempate o número de medalhas de prata seguido do número de medalhas de bronze conquistados. Nas Olimpíadas de 2004, o Brasil foi o décimo sexto colocado no quadro de medalhas, tendo obtido 5 medalhas de ouro, 2 de prata e 3 de bronze. Parte desse quadro de medalhas é reproduzida a seguir.\n\n- 8º Itália: 10 ouro, 11 prata, 11 bronze\n- 9º Coreia do Sul: 9 ouro, 12 prata, 9 bronze\n- 10º Grã-Bretanha: 9 ouro, 9 prata, 12 bronze\n- 11º Cuba: 9 ouro, 7 prata, 11 bronze\n- 12º Ucrânia: 9 ouro, 5 prata, 9 bronze\n- 13º Hungria: 8 ouro, 6 prata, 3 bronze\n\nSe o Brasil tivesse obtido mais 4 medalhas de ouro, 4 de prata e 10 de bronze, sem alteração no número de medalhas dos demais países mostrados no quadro, qual teria sido a classificação brasileira no quadro de medalhas das Olimpíadas de 2004?',
    alternativas: {
      A: {
        rotulo: '13º',
        valorNumerico: 13,
        diagnosticoPt: 'Décimo terceiro é onde a Hungria está, com menos ouro do que o Brasil novo. O Brasil passa quem tem menos ouro.',
        tagErro: 'leitura_interpretacao',
      },
      B: {
        rotulo: '12º',
        valorNumerico: 12,
        diagnosticoPt: 'Ouro manda. No empate de ouro, a prata desempata. O Brasil novo fica imediatamente atrás de quem ainda o supera nessa ordem.',
      },
      C: {
        rotulo: '11º',
        valorNumerico: 11,
        diagnosticoPt: 'Cuba tem o mesmo ouro e mais prata. Ela continua na frente. Parar nela é ignorar o primeiro desempate.',
        tagErro: 'leitura_interpretacao',
      },
      D: {
        rotulo: '10º',
        valorNumerico: 10,
        diagnosticoPt: 'Grã-Bretanha também tem 9 ouros e mais pratas. O bronze brasileiro, mesmo alto, só seria olhado se a prata empatasse.',
        tagErro: 'leitura_interpretacao',
      },
      E: {
        rotulo: '9º',
        valorNumerico: 9,
        diagnosticoPt: 'Coreia do Sul tem 9 ouros e bem mais pratas. E a Itália tem mais ouro que todo esse grupo. Nenhuma das duas sai da frente.',
        tagErro: 'leitura_interpretacao',
      },
    },
    dicas: [
      'Atualize o Brasil antes de comparar: eram 5 ouros, 2 pratas e 3 bronzes. Some o que o enunciado acrescenta. A ordem de comparação é lei: ouro, depois prata, depois bronze. Bronze só fala se a prata empatar.',
      'Resumo de boteco: os países do 1º ao 7º lugar não estão na tabela, mas estão na frente da Itália, que é a 8ª. Se a Itália continuar na frente do Brasil, esses sete continuam também. Entre os da tabela, risque quem perde para o Brasil e circule quem ainda ganha.',
      'Primeiro passo: todo mundo com mais ouro fica na frente. No grupo com o mesmo ouro, compare a prata. Armadilha: usar o total de medalhas, ou deixar o bronze decidir um duelo que a prata já decidiu. Outra armadilha: esquecer que o 8º lugar já tem sete países acima dele.',
    ],
    solucaoCompletaPt:
      'Brasil novo: 5+4 = 9 ouros, 2+4 = 6 pratas, 3+10 = 13 bronzes. Itália tem 10 ouros e fica na frente. Coreia, Grã-Bretanha e Cuba têm 9 ouros e mais de 6 pratas (12, 9 e 7): ficam na frente. Ucrânia tem 9 ouros e só 5 pratas: o Brasil, com 6, passa na frente. Hungria tem 8 ouros: fica atrás. Quem estava do 14º para baixo estava atrás da Hungria, então tinha no máximo 8 ouros e também fica atrás de quem tem 9. Na frente do Brasil sobram os 7 países acima da Itália, mais Itália, Coreia, Grã-Bretanha e Cuba: 11 países. A classificação é a 12ª.',
    atalhoPt: 'Monte o novo trio do Brasil e compare só ouro, depois prata. Conte quem permanece estritamente na frente e some um.',
    outroCaminhoPt:
      'Encaixe o Brasil na lista visível: depois de Cuba e antes da Ucrânia. Essa vaga, na tabela original, é a da Ucrânia, que era a 12ª. Como ninguém de fora da tabela fura esse bloco de 9 ouros, a vaga continua sendo a 12ª.',
    dicaVidaRealPt:
      'Desempate tem ordem, igual a dicionário. A primeira letra que difere decide. Olhar o total de medalhas é somar letras de posições diferentes e chamar isso de alfabeto.',
  },
  {
    ano: 2010,
    questao: 155,
    grau: 6,
    temaId: 'enem_aritmetica_ciclos',
    correta: 'C',
    enunciadoMarkdown:
      'Uma escola recebeu do governo uma verba de R$ 1000,00 para enviar dois tipos de folhetos pelo correio. O diretor da escola pesquisou que tipos de selos deveriam ser utilizados. Concluiu que, para o primeiro tipo de folheto, bastava um selo de R$ 0,65 enquanto para folhetos do segundo tipo seriam necessários três selos, um de R$ 0,65, um de R$ 0,60 e um de R$ 0,20. O diretor solicitou que se comprassem selos de modo que fossem postados exatamente 500 folhetos do segundo tipo e uma quantidade restante de selos que permitisse o envio do máximo possível de folhetos do primeiro tipo.\n\nQuantos selos de R$ 0,65 foram comprados?',
    alternativas: {
      A: {
        rotulo: '476',
        valorNumerico: 476,
        diagnosticoPt: 'Esse número não paga, com o que sobra, os selos de 0,65 dos 500 folhetos do segundo tipo e ainda os do primeiro. A verba tem de ser gasta a partir dos selos obrigatórios.',
        tagErro: 'leitura_interpretacao',
      },
      B: {
        rotulo: '675',
        valorNumerico: 675,
        diagnosticoPt: 'Você mexeu na verba inteira sem separar antes o custo dos selos de 0,60 e de 0,20, que os 500 folhetos do segundo tipo exigem.',
        tagErro: 'calculo_aritmetico',
      },
      C: {
        rotulo: '923',
        valorNumerico: 923,
        diagnosticoPt: 'Os selos de 0,60 e de 0,20 dos 500 folhetos saem primeiro. O que sobra da verba compra selos de 0,65, inteiros, até não caber mais um.',
      },
      D: {
        rotulo: '965',
        valorNumerico: 965,
        diagnosticoPt: 'Passou do que a verba consegue pagar em selos de 0,65 depois de reservar os outros dois valores. Selo não se compra pela metade.',
        tagErro: 'calculo_aritmetico',
      },
      E: {
        rotulo: '1 538',
        valorNumerico: 1538,
        diagnosticoPt: 'Isso é gastar os 1000 reais só em selos de 0,65. O segundo tipo também come selo de 0,60 e de 0,20, e esse dinheiro sai da mesma verba.',
        tagErro: 'leitura_interpretacao',
      },
    },
    dicas: [
      'A pergunta não pede quantos folhetos do primeiro tipo saíram. Pede quantos selos de R$ 0,65 foram comprados. Esses selos servem os dois tipos de folheto.',
      'Resumo de boteco: os 500 folhetos do segundo tipo são obrigação. Cada um leva um selo de 0,65, um de 0,60 e um de 0,20. Pague primeiro a parte que só o segundo tipo usa, os de 0,60 e os de 0,20. O que sobrar dos 1000 reais é o orçamento exclusivo dos selos de 0,65.',
      'Primeiro passo: 500 × (0,60 + 0,20) sai da verba. Divida o resto por 0,65 e fique com a quantidade inteira, porque não existe selo fracionário. Armadilha: dividir os 1000 direto por 0,65, fingindo que os outros selos são de graça. Outra: responder só os folhetos do primeiro tipo, esquecendo que os 500 do segundo também levaram um selo de 0,65 cada.',
    ],
    solucaoCompletaPt:
      'Os 500 folhetos do segundo tipo exigem 500 selos de R$ 0,60 e 500 de R$ 0,20. Custo dessa parte: 500 × 0,80 = R$ 400,00. Sobram R$ 600,00 para selos de R$ 0,65. 600 / 0,65 = 923,076…, então cabem 923 selos, porque 923 × 0,65 = 599,95 e o próximo selo não cabe nos 5 centavos que restam. Desses 923, quinhentos vão para o segundo tipo e 423 para o primeiro. A pergunta pede os selos de 0,65 comprados: 923.',
    atalhoPt: 'Reserve 0,60 + 0,20 para cada um dos 500. O resto da verba, dividido por 0,65, é a compra inteira de selos de 0,65.',
    outroCaminhoPt:
      'Seja n o número de selos de 0,65. É preciso n ≥ 500, e o custo 0,65n + 0,60×500 + 0,20×500 não pode passar de 1000. Isso é 0,65n ≤ 600. O maior inteiro n nessa desigualdade é a resposta. Folheto do primeiro tipo é o que sobra, n − 500, e a pergunta nem pede esse resto.',
    dicaVidaRealPt:
      'Orçamento com item obrigatório se resolve de trás para frente: pague o que não pode faltar, e o máximo do resto mora no que sobrou. Inteiro importa. Meio selo não cola em envelope.',
  },
  {
    ano: 2010,
    questao: 159,
    grau: 7,
    temaId: 'enem_razoes_escalas',
    correta: 'E',
    enunciadoMarkdown:
      'Embora o Índice de Massa Corporal (IMC) seja amplamente utilizado, existem ainda inúmeras restrições teóricas ao uso e às faixas de normalidade preconizadas. O Recíproco do Índice Ponderal (RIP), de acordo com o modelo alométrico, possui uma melhor fundamentação matemática, já que a massa é uma variável de dimensões cúbicas e a altura, uma variável de dimensões lineares. As fórmulas que determinam esses índices são:\n\n$$\\mathrm{IMC} = \\dfrac{\\mathrm{massa\\ (kg)}}{[\\mathrm{altura\\ (m)}]^{2}}$$\n\n$$\\mathrm{RIP} = \\dfrac{\\mathrm{altura\\ (cm)}}{[\\mathrm{massa\\ (kg)}]^{1/3}}$$\n\nSe uma menina, com 64 kg de massa, apresenta IMC igual a 25 kg/m², então ela possui RIP igual a',
    alternativas: {
      A: {
        rotulo: '0,4 cm/kg^(1/3).',
        valorNumerico: 0.4,
        diagnosticoPt: 'Você inverteu a fração do RIP, ou dividiu a massa pela altura. No RIP, a altura em centímetros fica em cima.',
        tagErro: 'proporcao_invertida',
      },
      B: {
        rotulo: '2,5 cm/kg^(1/3).',
        valorNumerico: 2.5,
        diagnosticoPt: 'Esse número é parente do IMC, não do RIP. O RIP pede a altura em centímetros dividida pela raiz cúbica da massa.',
        tagErro: 'leitura_interpretacao',
      },
      C: {
        rotulo: '8 cm/kg^(1/3).',
        valorNumerico: 8,
        diagnosticoPt: 'A altura ficou em metros, ou a raiz cúbica foi trocada por outra operação. O numerador do RIP está em centímetros.',
        tagErro: 'unidade_escala',
      },
      D: {
        rotulo: '20 cm/kg^(1/3).',
        valorNumerico: 20,
        diagnosticoPt: 'Faltou um zero na passagem de metros para centímetros, ou a raiz cúbica de 64 não entrou inteira na divisão.',
        tagErro: 'unidade_escala',
      },
      E: {
        rotulo: '40 cm/kg^(1/3).',
        valorNumerico: 40,
        diagnosticoPt: 'Do IMC sai a altura em metros. Em centímetros, essa altura dividida pela raiz cúbica de 64 é o RIP.',
      },
    },
    dicas: [
      'São duas fórmulas e uma ponte. O IMC entrega a altura, porque a massa e o IMC já foram dados. O RIP consome essa altura, mas em centímetros, e a mesma massa, agora debaixo de uma raiz cúbica.',
      'Resumo de boteco: IMC é massa dividida pelo quadrado da altura em metros. Se você conhece a massa e o IMC, o quadrado da altura é massa dividida pelo IMC. Desenhe a menina, escreva a altura em metros e só então empurre a vírgula para centímetros. 64 kg é um cubo famoso: procure o número que multiplicado por ele mesmo três vezes devolve 64.',
      'Primeiro passo: altura ao quadrado = 64/25. Armadilha: deixar a altura em metros na hora do RIP, ou inverter a fração e pôr a massa em cima. O enunciado gastou um parágrafo inteiro para dizer que massa é cúbica e altura é linear. A fórmula obedece a esse parágrafo.',
    ],
    solucaoCompletaPt:
      'IMC = 64 / h² = 25, com h em metros. Então h² = 64/25 = 2,56 e h = 1,6 m, porque 1,6 × 1,6 = 2,56. Em centímetros, a altura é 160. A raiz cúbica de 64 é 4, pois 4 × 4 × 4 = 64. RIP = 160 / 4 = 40 cm/kg^(1/3). O 0,4 seria o inverso dessa fração. O 2,5 é 64/25, o quadrado da altura, abandonado no meio da travessia.',
    atalhoPt: 'Do IMC, isole a altura em metros. Passe para centímetros. Divida pela raiz cúbica da massa.',
    outroCaminhoPt:
      'h = √(massa / IMC) = √(64/25) = 8/5 = 1,6 m. O resto não muda. Escrever 64/25 como fração evita a vírgula 2,56 e mostra o 8/5 antes dos centímetros: 160 cm continuam 160.',
    dicaVidaRealPt:
      'Unidade é parte da grandeza, não enfeite da resposta. Metro no IMC e centímetro no RIP são a mesma altura em dois idiomas. Quem não traduz divide números que não moram no mesmo mundo.',
  },
  {
    ano: 2010,
    questao: 172,
    grau: 6,
    temaId: 'enem_porcentagem_financeira',
    correta: 'C',
    enunciadoMarkdown:
      'Em 2006, a produção mundial de etanol foi de 40 bilhões de litros e a de biodiesel, de 6,5 bilhões. Neste mesmo ano, a produção brasileira de etanol correspondeu a 43% da produção mundial, ao passo que a produção dos Estados Unidos da América, usando milho, foi de 45%.\n\nConsiderando que, em 2009, a produção mundial de etanol seja a mesma de 2006 e que os Estados Unidos produzirão somente a metade de sua produção de 2006, para que o total produzido pelo Brasil e pelos Estados Unidos continue correspondendo a 88% da produção mundial, o Brasil deve aumentar sua produção em, aproximadamente,',
    alternativas: {
      A: {
        rotulo: '22,5%.',
        valorNumerico: 22.5,
        diagnosticoPt: '22,5 é a fatia nova dos Estados Unidos, metade de 45. A pergunta pede o aumento do Brasil em relação ao que o Brasil já produzia.',
        tagErro: 'porcentagem_base',
      },
      B: {
        rotulo: '50,0%.',
        valorNumerico: 50,
        diagnosticoPt: 'Os Estados Unidos caem pela metade. O Brasil não copia essa frase. Ele precisa cobrir o buraco e ainda ser medido contra a própria produção antiga.',
        tagErro: 'leitura_interpretacao',
      },
      C: {
        rotulo: '52,3%.',
        valorNumerico: 52.3,
        diagnosticoPt: 'A dupla continua em 88% do mundo. O que os Estados Unidos largam, o Brasil assume, e o aumento se mede sobre os 43% antigos.',
      },
      D: {
        rotulo: '65,5%.',
        valorNumerico: 65.5,
        diagnosticoPt: 'Essa é a fatia nova do Brasil no mundo, não o aumento em relação à fatia antiga. A pergunta pede o quanto a produção brasileira cresce.',
        tagErro: 'porcentagem_base',
      },
      E: {
        rotulo: '77,5%.',
        valorNumerico: 77.5,
        diagnosticoPt: 'Somar 43 com alguma metade solta não é aumento percentual. Aumento percentual divide a diferença pela base antiga.',
        tagErro: 'porcentagem_base',
      },
    },
    dicas: [
      'O biodiesel de 6,5 bilhões é conversa de corredor: a pergunta inteira é sobre etanol. O mundo de 2009 produz o mesmo etanol de 2006. A dupla Brasil + Estados Unidos continua com 88% desse mundo.',
      'Resumo de boteco: em 2006 a dupla era 43% + 45% = 88%. Em 2009 os Estados Unidos ficam com a metade da fatia deles. Desenhe os 88% como uma barra com dois donos. O dono americano encolhe. O dono brasileiro estica até a barra voltar a 88%.',
      'Primeiro passo: a fatia nova do Brasil é 88% menos a fatia nova dos Estados Unidos. O aumento pedido não é essa fatia nova. É (fatia nova − 43) dividido por 43. Armadilha: entregar a fatia nova, ou entregar a queda americana, como se qualquer uma das duas fosse o aumento brasileiro.',
    ],
    solucaoCompletaPt:
      'Em 2006, Brasil 43% e Estados Unidos 45%, soma 88% do mundo. Em 2009 os Estados Unidos produzem a metade: 45/2 = 22,5% do mesmo mundo. Para a dupla seguir em 88%, o Brasil fica com 88 − 22,5 = 65,5% do mundo. Ele saiu de 43% e foi para 65,5%. O aumento, relativo ao que ele já produzia, é (65,5 − 43) / 43 = 22,5 / 43 ≈ 0,523 = 52,3%. Os 40 bilhões nem precisam entrar: as porcentagens já estão no mesmo todo, e o todo não mudou.',
    atalhoPt: 'Fatia nova do Brasil = 88% − metade da fatia americana. Aumento = (nova − 43) / 43.',
    outroCaminhoPt:
      'Em litros, o mundo continua 40 bilhões. EUA caem de 0,45×40 para a metade. Brasil precisa que a soma dos dois litros continue 0,88×40. A diferença de litros do Brasil, dividida pelos litros antigos do Brasil, é o mesmo 52,3%. A porcentagem já tinha feito essa conta escondida.',
    dicaVidaRealPt:
      '"Aumentar em x%" divide pelo tamanho antigo, não pelo tamanho do mundo. A fatia nova e o crescimento da fatia são parentes, não gêmeos. O enunciado pede o parente que olha para trás.',
  },
  {
    ano: 2010,
    questao: 176,
    grau: 5,
    temaId: 'enem_geometria_medidas',
    correta: 'B',
    enunciadoMarkdown:
      'A disparidade de volume entre os planetas é tão grande que seria possível colocá-los uns dentro dos outros. O planeta Mercúrio é o menor de todos. Marte é o segundo menor: dentro dele cabem três Mercúrios. Terra é o único com vida: dentro dela cabem sete Martes. Netuno é o quarto maior: dentro dele cabem 58 Terras. Júpiter é o maior dos planetas: dentro dele cabem 23 Netunos.\n\nSeguindo o raciocínio proposto, quantas Terras cabem dentro de Júpiter?',
    alternativas: {
      A: {
        rotulo: '406',
        valorNumerico: 406,
        diagnosticoPt: 'Esse produto mistura planetas que não estão na ponte entre Júpiter e Terra. A ponte do enunciado passa por Netuno.',
        tagErro: 'leitura_interpretacao',
      },
      B: {
        rotulo: '1 334',
        valorNumerico: 1334,
        diagnosticoPt: 'Júpiter contém Netunos, e cada Netuno contém Terras. As duas quantidades se multiplicam.',
      },
      C: {
        rotulo: '4 002',
        valorNumerico: 4002,
        diagnosticoPt: 'Marte e Mercúrio entraram na conta. A pergunta pede Terras, e a Terra já está escrita direto dentro de Netuno.',
        tagErro: 'leitura_interpretacao',
      },
      D: {
        rotulo: '9 338',
        valorNumerico: 9338,
        diagnosticoPt: 'Um fator a mais se espremeu no produto. Releia quais duas frases ligam Júpiter à Terra.',
        tagErro: 'calculo_aritmetico',
      },
      E: {
        rotulo: '28 014',
        valorNumerico: 28014,
        diagnosticoPt: 'Você multiplicou a cadeia inteira, inclusive os Mercúrios que cabem em Marte. A pergunta não pede Mercúrios.',
        tagErro: 'leitura_interpretacao',
      },
    },
    dicas: [
      'A pergunta pede Terras dentro de Júpiter. Mercúrio e Marte são o aquecimento da história. A ponte que importa é a que liga Júpiter a Netuno e Netuno a Terra.',
      'Resumo de boteco: desenhe três bonecos. Júpiter grandão, com 23 Netunos dentro. Cada Netuno, com 58 Terras dentro. Se cada caixote contém a mesma quantidade de Terras, o total é caixotes vezes Terras por caixote.',
      'Primeiro passo: use só as duas frases "dentro de Júpiter cabem 23 Netunos" e "dentro de Netuno cabem 58 Terras". Armadilha: continuar a cadeia até Marte e Mercúrio. Isso responderia "quantos Mercúrios cabem em Júpiter", que ninguém perguntou. Multiplicar é o certo; somar 23 com 58 contaria planetas de espécies diferentes como se fossem a mesma.',
    ],
    solucaoCompletaPt:
      'Cada Netuno comporta 58 Terras, e Júpiter comporta 23 Netunos. Então Júpiter comporta 23 × 58 Terras. 23 × 50 = 1 150 e 23 × 8 = 184. Soma: 1 334 Terras. Os três Mercúrios de Marte e os sete Martes da Terra são verdadeiros no texto e inúteis na pergunta. Quem os multiplica junto responde outra grandeza.',
    atalhoPt: '23 Netunos por Júpiter, 58 Terras por Netuno. A Terra atravessa essa ponte uma vez só: multiplique os dois números.',
    outroCaminhoPt:
      '23 × 58 = 23 × (60 − 2) = 1 380 − 46 = 1 334. Mesmo produto, sem armar a conta clássica. Útil quando o 8 do 58 parece um lugar fácil de errar o zero.',
    dicaVidaRealPt:
      'Cadeia de "cabe dentro" é multiplicação de fatores, um por elo. Elo que não está no caminho da pergunta não entra no produto. Ler até o fim inclui saber onde parar.',
  },
  {
    ano: 2017,
    questao: 140,
    grau: 6,
    temaId: 'enem_probabilidade_contagem',
    correta: 'E',
    enunciadoMarkdown:
      'Uma empresa construirá sua página na internet e espera atrair um público de aproximadamente um milhão de clientes. Para acessar essa página, será necessária uma senha com formato a ser definido pela empresa. Existem cinco opções de formato oferecidas pelo programador, em que "L" representa letra maiúscula e "D" representa dígito.\n\n- I: LDDDDD\n- II: DDDDDD\n- III: LLDDDD\n- IV: DDDDD\n- V: LLLDD\n\nAs letras do alfabeto, entre as 26 possíveis, bem como os dígitos, entre os 10 possíveis, podem se repetir em qualquer das opções.\n\nA empresa quer escolher uma opção de formato cujo número de senhas distintas possíveis seja superior ao número esperado de clientes, mas que esse número não seja superior ao dobro do número esperado de clientes.\n\nA opção que mais se adequa às condições da empresa é',
    alternativas: {
      A: { rotulo: 'I.', diagnosticoPt: 'Um L e cinco D passam do dobro de um milhão. A janela tem teto, não só chão.', tagErro: 'combinatoria_probabilidade' },
      B: { rotulo: 'II.', diagnosticoPt: 'Seis dígitos fecham exatamente um milhão. A empresa pediu superior ao número de clientes, e "exatamente" não é "superior".', tagErro: 'leitura_interpretacao' },
      C: { rotulo: 'III.', diagnosticoPt: 'Duas letras e quatro dígitos explodem para muito além do dobro. Mais letras não significa formato mais adequado.', tagErro: 'combinatoria_probabilidade' },
      D: { rotulo: 'IV.', diagnosticoPt: 'Cinco dígitos ficam bem abaixo de um milhão. Faltou casa, não sobrou casa.', tagErro: 'calculo_aritmetico' },
      E: { rotulo: 'V.', diagnosticoPt: 'Três letras e dois dígitos caem dentro da janela: mais de um milhão e não mais que o dobro.' },
    },
    dicas: [
      'A empresa quer um número de senhas estritamente maior que um milhão e, ao mesmo tempo, não maior que dois milhões. Desenhe essa janela numa régua antes de calcular qualquer formato.',
      'Resumo de boteco: cada L multiplica por 26, cada D multiplica por 10, e a ordem da senha é o produto, porque a letra pode repetir e o dígito pode repetir. Cinco casas de dígito são 10×10×10×10×10. Uma letra na frente multiplica esse bloco por 26.',
      'Primeiro passo: escreva o produto de cada formato e só depois veja quem entra na janela. Armadilha: achar que um milhão exato já serve. A frase é "superior". Outra armadilha: esquecer que repetir é permitido, e sair combinando sem reposição. Aqui a reposição está liberada.',
    ],
    solucaoCompletaPt:
      'A janela é 1 000 000 < senhas ≤ 2 000 000. I: 26 × 10^5 = 2 600 000, passa do teto. II: 10^6 = 1 000 000, empata com o chão e a empresa pediu superior. III: 26×26×10^4 = 6 760 000, muito acima. IV: 10^5 = 100 000, abaixo do chão. V: 26^3 × 10^2 = 17 576 × 100 = 1 757 600. Está acima de um milhão e abaixo de dois milhões. O formato adequado é o V.',
    atalhoPt: 'Cada L vale ×26, cada D vale ×10, com repetição. Fique com o produto que mora entre um milhão e o dobro, sem encostar no um milhão.',
    outroCaminhoPt:
      'Compare tudo com 10^6. IV é 10 vezes menor. II é exatamente 10^6. I é 2,6 vezes 10^6. III é 6,76 vezes 10^6. V é 1,7576 vezes 10^6. Só o último fator cabe no intervalo (1, 2].',
    dicaVidaRealPt:
      'Senha com repetição é produto, não arranjo sem reposição. E "superior a um milhão" deixa o um milhão do lado de fora. Palavra de enunciado é parede da conta.',
  },
  {
    ano: 2017,
    questao: 141,
    grau: 5,
    temaId: 'enem_probabilidade_contagem',
    correta: 'E',
    enunciadoMarkdown:
      'Como não são adeptos da prática de esportes, um grupo de amigos resolveu fazer um torneio de futebol utilizando videogame. Decidiram que cada jogador joga uma única vez com cada um dos outros jogadores. O campeão será aquele que conseguir o maior número de pontos. Observaram que o número de partidas jogadas depende do número de jogadores, como mostra o quadro:\n\n- 2 jogadores: 1 partida\n- 3 jogadores: 3 partidas\n- 4 jogadores: 6 partidas\n- 5 jogadores: 10 partidas\n- 6 jogadores: 15 partidas\n- 7 jogadores: 21 partidas\n\nSe a quantidade de jogadores for 8, quantas partidas serão realizadas?',
    alternativas: {
      A: { rotulo: '64', valorNumerico: 64, diagnosticoPt: 'Oito vezes oito conta cada pessoa contra ela mesma e ainda conta cada jogo duas vezes. Ninguém joga contra o próprio controle.', tagErro: 'combinatoria_probabilidade' },
      B: { rotulo: '56', valorNumerico: 56, diagnosticoPt: 'Oito vezes sete conta cada partida duas vezes: A contra B é o mesmo jogo que B contra A. O enunciado diz uma única vez.', tagErro: 'combinatoria_probabilidade' },
      C: { rotulo: '49', valorNumerico: 49, diagnosticoPt: 'Sete vezes sete não é o número de pares de um grupo de oito. Faltou a estrutura de "cada um com cada um, sem repetir o par".', tagErro: 'calculo_aritmetico' },
      D: { rotulo: '36', valorNumerico: 36, diagnosticoPt: 'Esse número não continua a escada do quadro. Olhe quanto o quadro cresce cada vez que entra um jogador.', tagErro: 'calculo_aritmetico' },
      E: { rotulo: '28', valorNumerico: 28, diagnosticoPt: 'O oitavo jogador enfrenta os sete que já estavam, uma vez cada. Some isso ao total do quadro para sete jogadores.' },
    },
    dicas: [
      'Cada partida é um par de jogadores. A ordem do par não cria outro jogo: Ana contra Bia é a mesma partida que Bia contra Ana.',
      'Resumo de boteco: olhe a coluna de partidas: 1, 3, 6, 10, 15, 21. A diferença entre uma linha e a anterior é 2, depois 3, depois 4, depois 5, depois 6. O quadro está somando o próximo inteiro. O jogador novo enfrenta todo mundo que já estava sentado no sofá.',
      'Primeiro passo: para passar de 7 jogadores a 8, o novato joga uma vez contra cada um dos sete. Armadilha: multiplicar 8×8 ou 8×7 e entregar isso como se cada confronto tivesse duas partidas. O enunciado já disse "uma única vez".',
    ],
    solucaoCompletaPt:
      'Com 7 jogadores o quadro marca 21 partidas. O oitavo jogador faz uma partida nova contra cada um desses sete, e não repete jogo nenhum que já existia. 21 + 7 = 28. Pelo outro olhar: o número de pares em 8 pessoas é C(8,2) = 8×7/2 = 28. Dividir por 2 é o que impede de contar Ana×Bia e Bia×Ana como dois jogos. 8×7 = 56 seria essa contagem dobrada.',
    atalhoPt: 'A linha nova soma, ao total anterior, o número de adversários do jogador que acabou de chegar.',
    outroCaminhoPt: 'C(8,2) = 8×7/2. O 2 do denominador é a frase "uma única vez": cada par só entra um lado para cima.',
    dicaVidaRealPt:
      'Torneio de todos contra todos é combinação, não tabuada. Se a ordem não cria um jogo novo, divida por 2. O quadro triangular é essa mesma ideia escrita devagar.',
  },
  {
    ano: 2017,
    questao: 166,
    grau: 5,
    temaId: 'enem_razoes_escalas',
    correta: 'D',
    enunciadoMarkdown:
      'Uma bicicleta do tipo mountain bike tem uma coroa com 3 engrenagens e uma catraca com 6 engrenagens, que, combinadas entre si, determinam 18 marchas. Os números de dentes estão no quadro:\n\n- Coroa: 1ª com 46, 2ª com 36, 3ª com 26.\n- Catraca: 1ª com 24, 2ª com 22, 3ª com 20, 4ª com 18, 5ª com 16, 6ª com 14.\n\nO número de voltas efetuadas pela roda traseira a cada pedalada é a quantidade de dentes da coroa dividida pela quantidade de dentes da catraca.\n\nDurante um passeio, deseja-se ir o mais devagar possível, escolhendo uma das combinações:\n\n- I: 1ª coroa × 1ª catraca\n- II: 1ª coroa × 6ª catraca\n- III: 2ª coroa × 4ª catraca\n- IV: 3ª coroa × 1ª catraca\n- V: 3ª coroa × 6ª catraca\n\nA combinação escolhida para realizar esse passeio da forma desejada é',
    alternativas: {
      A: { rotulo: 'I.', diagnosticoPt: 'A primeira coroa é a que tem mais dentes. Mais dentes na coroa empurram a roda para mais voltas por pedalada, não para menos.', tagErro: 'proporcao_invertida' },
      B: { rotulo: 'II.', diagnosticoPt: 'A sexta catraca é a menor. Catraca pequena faz a roda girar mais vezes. Isso é pressa, não passeio lento.', tagErro: 'proporcao_invertida' },
      C: { rotulo: 'III.', diagnosticoPt: 'O meio da tabela não é o extremo. Devagar pede o menor quociente, e essa dupla fica no meio das razões.', tagErro: 'calculo_aritmetico' },
      D: { rotulo: 'IV.', diagnosticoPt: 'Menos dentes na coroa e mais dentes na catraca. O quociente, voltas da roda por pedalada, fica o menor das cinco duplas.' },
      E: { rotulo: 'V.', diagnosticoPt: 'A terceira coroa ajuda a ir devagar, mas a sexta catraca desfaz o favor. Catraca pequena acelera a roda.', tagErro: 'proporcao_invertida' },
    },
    dicas: [
      'Devagar, aqui, não é feeling. É o menor número de voltas da roda traseira por pedalada. E esse número é dentes da coroa divididos pelos dentes da catraca.',
      'Resumo de boteco: a coroa é o numerador, a catraca é o denominador. Para a fração ficar pequenininha, encolha o de cima e estique o de baixo. Coroa com poucos dentes. Catraca com muitos dentes.',
      'Primeiro passo: calcule as cinco razões do anúncio e compare. Armadilha: achar que "1ª com 1ª" é a marcha leve só porque os dois índices são 1. O índice 1 da catraca é justamente a catraca grande, e o índice 1 da coroa é a coroa grande. Eles puxam a fração para lados opostos.',
    ],
    solucaoCompletaPt:
      'Voltas por pedalada = dentes da coroa / dentes da catraca. I: 46/24 ≈ 1,92. II: 46/14 ≈ 3,29. III: 36/18 = 2. IV: 26/24 ≈ 1,08. V: 26/14 ≈ 1,86. O menor quociente é 26/24, a 3ª coroa com a 1ª catraca, combinação IV. A roda quase não avança a cada pedalada. É o passeio de quem quer ver a paisagem e não o próprio suor.',
    atalhoPt: 'Menor coroa no numerador, maior catraca no denominador. Compare as cinco frações e fique com a menor.',
    outroCaminhoPt:
      'Sem dividir todas: II e V usam a catraca de 14, a menor, então são rápidas. I usa a coroa de 46, a maior, então perde para qualquer dupla com coroa menor e a mesma catraca grande. III é 2 certinho. Sobra a coroa de 26 com a catraca de 24, que é quase 1. Ninguém no anúncio fica abaixo disso.',
    dicaVidaRealPt:
      'Marcha é razão. O que está em cima acelera quando cresce; o que está embaixo acelera quando encolhe. Devagar é o extremo certo da fração, não o primeiro nome da tabela.',
  },
  {
    ano: 2017,
    questao: 169,
    grau: 6,
    temaId: 'enem_razoes_escalas',
    correta: 'B',
    enunciadoMarkdown:
      'Para uma temporada das corridas de Fórmula 1, a capacidade do tanque de combustível de cada carro passou a ser de 100 kg de gasolina. Uma equipe optou por utilizar uma gasolina com densidade de 750 gramas por litro, iniciando a corrida com o tanque cheio. Na primeira parada, o computador de bordo acusou o consumo de quatro décimos da gasolina originalmente existente no tanque. Para minimizar o peso e garantir o término da corrida, a equipe reabasteceu o carro com a terça parte do que restou no tanque na chegada ao reabastecimento.\n\nA quantidade de gasolina utilizada, em litro, no reabastecimento foi',
    alternativas: {
      A: { rotulo: '20/0,075', diagnosticoPt: 'A vírgula da densidade andou uma casa a mais. 750 gramas por litro não viram sete centésimos de quilograma.', tagErro: 'unidade_escala' },
      B: { rotulo: '20/0,75', diagnosticoPt: 'A massa que entrou no reabastecimento, em quilogramas, dividida pela densidade em quilogramas por litro, é o volume em litros.' },
      C: { rotulo: '20/7,5', diagnosticoPt: 'Dividir por 7,5 trata a densidade como se 750 gramas fossem 7,5 quilogramas. A ponte certa anda três casas, de grama para quilograma.', tagErro: 'unidade_escala' },
      D: { rotulo: '20 × 0,075', diagnosticoPt: 'Volume não é massa vezes densidade. Densidade já é massa por volume. Para achar volume, a massa divide pela densidade.', tagErro: 'proporcao_invertida' },
      E: { rotulo: '20 × 0,75', diagnosticoPt: 'Multiplicar pela densidade em kg/L devolve quilograma vezes quilograma por litro, não litro. O litro aparece quando você divide.', tagErro: 'proporcao_invertida' },
    },
    dicas: [
      'A pergunta pede litro, e o tanque está contado em quilograma. Densidade é a única ponte. Antes da ponte, ache quantos quilogramas a equipe colocou de volta.',
      'Resumo de boteco: o tanque começou cheio, com 100 kg. Foram embora quatro décimos. Desenhe uma barra de dez pedaços, risque quatro, e olhe os seis que ficaram. A equipe põe de volta a terça parte desses seis. Isso ainda é massa. Litro só nasce quando essa massa encontra a densidade.',
      'Primeiro passo: passe 750 g/L para quilogramas por litro, andando três casas. Volume é massa dividida por essa densidade. Armadilha: multiplicar, como se densidade fosse um desconto. E armadilha de vírgula: três casas não são duas, nem quatro.',
    ],
    solucaoCompletaPt:
      'Consumo de quatro décimos deixa seis décimos no tanque: 0,6 × 100 kg = 60 kg. A terça parte disso é 20 kg. Essa é a massa do reabastecimento. A densidade é 750 g/L = 0,75 kg/L. Volume = massa / densidade = 20 / 0,75 litro. Multiplicar 20 por 0,75 daria outra grandeza e outro idioma. Dividir por 0,075 ou por 7,5 é a mesma conta com a vírgula morando na casa errada.',
    atalhoPt: 'Seis décimos do tanque, um terço disso, em kg. Divida pela densidade já convertida para kg/L.',
    outroCaminhoPt:
      'Em fração: restou 3/5 do tanque, e entra 1/3 disso, ou seja 1/5 de 100 kg = 20 kg. 750 g/L = 3/4 kg/L. Volume = 20 / (3/4) = 20 × 4/3 litros, que é o mesmo que 20/0,75. A fração só esconde a vírgula.',
    dicaVidaRealPt:
      'Se a unidade pedida não é a unidade dada, a densidade é porta, não enfeite. Massa dividida por (massa por volume) devolve volume. Quem multiplica atravessa a porta ao contrário.',
  },
  {
    ano: 2020,
    questao: 163,
    grau: 7,
    temaId: 'enem_probabilidade_contagem',
    correta: 'E',
    enunciadoMarkdown:
      'O Estatuto do Idoso prevê, entre outros benefícios, a restituição de imposto de renda antes dos demais contribuintes. A tabela informa 12 idosos que aguardam restituição. Entre eles, a restituição sai em ordem decrescente de idade e, em subgrupos da mesma idade, a ordem é decidida por sorteio.\n\n- Orlando, 89\n- Gustavo, 86\n- Luana, 86\n- Teresa, 85\n- Márcia, 84\n- Roberto, 82\n- Heloisa, 75\n- Marisa, 75\n- Pedro, 75\n- João, 75\n- Antônio, 72\n- Fernanda, 70\n\nNessas condições, a probabilidade de João ser a sétima pessoa do grupo a receber sua restituição é igual a',
    alternativas: {
      A: { rotulo: '1/12', diagnosticoPt: 'Um doze avos seria a chance de João ser um sorteado qualquer entre os doze. A fila não é um sorteio único: a idade manda primeiro.', tagErro: 'combinatoria_probabilidade' },
      B: { rotulo: '7/12', diagnosticoPt: 'Sete doze avos mistura a posição "sétima" com o tamanho do grupo inteiro. A posição sétima só fica livre para um subgrupo.', tagErro: 'leitura_interpretacao' },
      C: { rotulo: '1/8', diagnosticoPt: 'Oito não é o tamanho do grupo que ainda disputa a sétima vaga com João. Conte só quem tem exatamente a idade dele.', tagErro: 'calculo_aritmetico' },
      D: { rotulo: '5/6', diagnosticoPt: 'Cinco sextos é chance de quase certeza. O sorteio entre pessoas da mesma idade é justo, não esse favoritismo.', tagErro: 'combinatoria_probabilidade' },
      E: { rotulo: '1/4', diagnosticoPt: 'Seis pessoas são mais velhas que João e passam na frente. A sétima vaga é o primeiro sorteio entre as quatro pessoas de 75 anos.' },
    },
    dicas: [
      'A fila tem dois andares. Primeiro, a idade: mais velho recebe antes. Segundo, só dentro da mesma idade, um sorteio justo. João não concorre com Orlando. Orlando já está na frente por causa do 89.',
      'Resumo de boteco: risque, de cima para baixo, todo mundo estritamente mais velho que João. Conte quantos riscados existem. Se esse número for seis, a próxima vaga, a sétima, é justamente a primeira vaga do grupo da idade de João. Aí o sorteio é só entre esse grupo.',
      'Primeiro passo: conte o tamanho do grupo que tem a mesma idade de João, incluindo ele. A chance de ele ser o primeiro sorteado nesse grupo é 1 dividido por esse tamanho. Armadilha: dividir por 12, como se a idade não mandasse na fila. Ou dividir por 8, misturando os de 75 com os mais novos, que nem entram nessa vaga.',
    ],
    solucaoCompletaPt:
      'Mais velhos que João, de 75 anos: Orlando 89, Gustavo 86, Luana 86, Teresa 85, Márcia 84, Roberto 82. São seis. Eles ocupam as vagas 1 a 6, em alguma ordem que não importa. A vaga 7 é a primeira entre Heloisa, Marisa, Pedro e João, os quatro de 75 anos. No sorteio justo, cada um deles é igualmente o primeiro. A probabilidade de ser João é 1/4. Antônio e Fernanda são mais novos e só aparecem depois desse grupo.',
    atalhoPt: 'Conte quem é estritamente mais velho. Se faltava exatamente uma vaga para a posição pedida, João precisa ser o primeiro do próprio grupo de idade.',
    outroCaminhoPt:
      'As ordens do quarteto de 75 anos são 4×3×2×1 = 24, todas igualmente possíveis. Naquelas em que João é o primeiro do quarteto, os outros três se embaralham em 6 ordens. 6/24 = 1/4. O fatorial só confirma o que o "primeiro de um grupo justo" já dizia.',
    dicaVidaRealPt:
      'Quando uma regra ordena e o sorteio só desempata, o espaço amostral encolhe. Gente que a regra já colocou na frente não entra na roleta. Probabilidade aqui é o tamanho do empate, não o tamanho da fila inteira.',
  },
  {
    ano: 2020,
    questao: 172,
    grau: 6,
    temaId: 'enem_estatistica_medias',
    correta: 'D',
    enunciadoMarkdown:
      'O técnico de um time de basquete pretende aumentar a estatura média de sua equipe de 1,93 m para, no mínimo, 1,99 m. Para tanto, dentre os 15 jogadores que fazem parte de sua equipe, irá substituir os quatro mais baixos, de estaturas: 1,78 m, 1,82 m, 1,84 m e 1,86 m. Para isso, o técnico contratou um novo jogador de 2,02 m. Os outros três jogadores que ele ainda precisa contratar devem satisfazer à sua necessidade de aumentar a média das estaturas da equipe. Ele fixará a média das estaturas para os três jogadores que ainda precisa contratar dentro do critério inicialmente estabelecido.\n\nQual deverá ser a média mínima das estaturas, em metro, que ele deverá fixar para o grupo de três novos jogadores que ainda irá contratar?',
    alternativas: {
      A: { rotulo: '1,96', valorNumerico: 1.96, diagnosticoPt: 'Ficou perto da média antiga e da nova, sem passar pela soma. Média de grupo pequeno não é a média do time inteiro.', tagErro: 'calculo_aritmetico' },
      B: { rotulo: '1,98', valorNumerico: 1.98, diagnosticoPt: 'Quase 1,99, mas a conta dos quatro que saem e do que já entrou ainda não foi feita. A média dos três tem de compensar o buraco.', tagErro: 'calculo_aritmetico' },
      C: { rotulo: '2,05', valorNumerico: 2.05, diagnosticoPt: 'Passou um pouco do necessário. Confira a soma que os 15 precisam atingir e o quanto os doze já garantem, incluindo o de 2,02 m.', tagErro: 'calculo_aritmetico' },
      D: { rotulo: '2,06', valorNumerico: 2.06, diagnosticoPt: 'A soma dos quinze na média nova, menos o que já está garantido, repartida pelos três que faltam.' },
      E: { rotulo: '2,08', valorNumerico: 2.08, diagnosticoPt: 'Um dos baixos que saem, ou o contratado de 2,02 m, ficou de fora da soma. A média dos três cresce quando você esquece altura que já entrou.', tagErro: 'leitura_interpretacao' },
    },
    dicas: [
      'Média é soma dividida pela quantidade. Para a média dos 15 chegar a 1,99 m, a soma dos 15 tem um mínimo. Trabalhe com somas, não com a média solta.',
      'Resumo de boteco: desenhe 15 bonequinhos. A soma de hoje é 15 vezes 1,93. Risque os quatro baixos, com as alturas escritas no enunciado. Ponha no lugar o contratado de 2,02, que já está garantido. Faltam três bonequinhos. A soma nova precisa ser, no mínimo, 15 vezes 1,99. O que falta para essa soma é o trabalho dos três.',
      'Primeiro passo: soma que falta, dividida por 3, é a média mínima desse trio. Armadilha: exigir que cada um dos três tenha 1,99 m. A média do trio pode — e aqui precisa — ficar acima da média do time, porque os que ficaram puxam para baixo. Outra armadilha: esquecer de somar o jogador de 2,02 que já foi contratado.',
    ],
    solucaoCompletaPt:
      'Soma atual: 15 × 1,93 = 28,95 m. Saem 1,78 + 1,82 + 1,84 + 1,86 = 7,30 m. Ficam 28,95 − 7,30 = 21,65 m nos onze que permanecem. Entra o de 2,02 m: 23,67 m já garantidos em doze pessoas. A soma mínima dos quinze é 15 × 1,99 = 29,85 m. Faltam 29,85 − 23,67 = 6,18 m para os três. Média mínima do trio: 6,18 / 3 = 2,06 m.',
    atalhoPt: 'Trabalhe em somas. Tire os quatro baixos, some o contratado, veja o quanto falta para 15 vezes a média nova, e divida por 3.',
    outroCaminhoPt:
      'O efeito de trocar um jogador é a diferença de alturas, não a altura nova sozinha. As quatro saídas e uma entrada mudam a soma em −7,30 + 2,02. A soma ainda precisa subir de 28,95 até 29,85. O trio cobre o que essa troca não cobriu. Dividir por 3 no fim é o mesmo 2,06.',
    dicaVidaRealPt:
      'Média de um subgrupo não copia a média do grupo. Quem entra por último carrega o buraco deixado por quem saiu. Por isso o trio precisa ser mais alto que 1,99 m para o time, inteiro, encostar em 1,99 m.',
  },
  {
    ano: 2020,
    questao: 179,
    grau: 5,
    temaId: 'enem_geometria_medidas',
    correta: 'A',
    enunciadoMarkdown:
      'No período de fim de ano, o síndico de um condomínio resolveu colocar, em um poste, uma iluminação natalina em formato de cone, lembrando uma árvore de Natal. A árvore é feita com mangueiras de iluminação, tratadas como segmentos de reta de mesmo comprimento, saindo de um ponto situado a 3 m de altura no poste até um ponto de uma circunferência de fixação no chão. Essa circunferência fica dividida em 20 arcos iguais. O poste está no centro, perpendicular ao chão.\n\nPara economizar, ele usará mangueiras aproveitadas que juntas passam um pouco de 100 m. Ele decide usar exatamente 100 m e deixar o resto de reserva.\n\nPara que ele atinja seu objetivo, o raio, em metro, da circunferência deverá ser de',
    alternativas: {
      A: { rotulo: '4,00.', valorNumerico: 4, diagnosticoPt: 'Cada mangueira é a hipotenusa. A altura do poste é um cateto. O raio é o outro cateto.' },
      B: { rotulo: '4,87.', valorNumerico: 4.87, diagnosticoPt: 'Algum arredondamento de raiz entrou antes da hora. Com esses comprimentos inteiros, o triângulo fecha sem raiz feia.', tagErro: 'calculo_aritmetico' },
      C: { rotulo: '5,00.', valorNumerico: 5, diagnosticoPt: 'Cinco metros é o comprimento de uma mangueira, a hipotenusa, não o raio. O raio deita no chão; a mangueira desce inclinada.', tagErro: 'formula_geometria' },
      D: { rotulo: '5,83.', valorNumerico: 5.83, diagnosticoPt: 'Somar os comprimentos no quadrado, em vez de subtrair, inverte Pitágoras. O maior lado é a mangueira, não o raio.', tagErro: 'formula_geometria' },
      E: { rotulo: '6,26.', valorNumerico: 6.26, diagnosticoPt: 'Esse número nasce de operar 3 e o comprimento da mangueira do jeito que não é cateto-hipotenusa. O raio é o cateto que falta.', tagErro: 'formula_geometria' },
    },
    dicas: [
      'São 20 mangueiras iguais e 100 m usados no total. O cone é a desculpa geométrica. Cada mangueira é um segmento do topo do poste até a borda do círculo no chão.',
      'Resumo de boteco: desenhe um triângulo retângulo de lado. Em pé, os 3 m do poste. Deitado no chão, o raio, que é o que a pergunta pede. Inclinada, uma mangueira. O ângulo reto está no pé do poste, porque o poste é perpendicular ao chão.',
      'Primeiro passo: o comprimento de uma mangueira é o total dividido pela quantidade de arcos. Esse comprimento é a hipotenusa. Armadilha: achar que o raio mede o mesmo que a mangueira. A mangueira é a descida inclinada. O raio é a sombra dela no chão. No triângulo retângulo, o quadrado da hipotenusa menos o quadrado do cateto conhecido devolve o quadrado do raio.',
    ],
    solucaoCompletaPt:
      'Cada mangueira mede 100 / 20 = 5 m. No triângulo retângulo, a hipotenusa é 5 m e o cateto vertical é 3 m. Então r² + 3² = 5², r² + 9 = 25, r² = 16, r = 4 m, porque raio de circunferência não é negativo. É o triângulo 3-4-5 encostado no poste de Natal. Quem responde 5 mediu a mangueira e esqueceu que ela não deita no chão.',
    atalhoPt: 'Comprimento de uma mangueira = total ÷ 20. Esse é o lado maior do triângulo. Altura é o cateto conhecido. O raio é o cateto que falta.',
    outroCaminhoPt:
      'Se você reconhece o trio 3 e 5, o cateto que completa a relação clássica é o raio, sem armar a subtração. A relação é a mesma: o quadrado maior menos o quadrado menor.',
    dicaVidaRealPt:
      'Poste perpendicular ao chão fabrica ângulo reto de graça. Sempre que um fio sai do alto e encontra o chão, o comprimento do fio não é a distância no mapa. O mapa é o outro cateto.',
  },
  {
    ano: 2026,
    questao: 140,
    grau: 6,
    temaId: 'enem_probabilidade_contagem',
    correta: 'B',
    enunciadoMarkdown:
      'O grupo sanguíneo, quanto aos antígenos A e B, pode ser A (só A), B (só B), AB (os dois) ou O (nenhum). O fator Rh entra com "+" quando está presente e "−" quando está ausente. AB+ é o receptor universal. O− é o doador universal.\n\nNuma cidade, 25% da população apresenta apenas o antígeno A, 25% apenas o B e 30% o tipo AB. Em cada grupo sanguíneo, a ocorrência do fator Rh+ é de 60%.\n\nA probabilidade de uma pessoa dessa cidade, escolhida ao acaso, ser receptora universal ou doadora universal é',
    alternativas: {
      A: { rotulo: '0,3.', valorNumerico: 0.3, diagnosticoPt: '0,3 é a fatia AB inteira, com Rh+ e Rh− misturados. Receptor universal é só o AB que tem Rh+.', tagErro: 'leitura_interpretacao' },
      B: { rotulo: '0,26.', valorNumerico: 0.26, diagnosticoPt: 'AB com Rh+ é uma parcela. O com Rh− é outra. As duas não cabem na mesma pessoa, então as chances se somam.' },
      C: { rotulo: '0,06.', valorNumerico: 0.06, diagnosticoPt: 'Esse produto usa só uma das duas pontas, ou multiplica fatias que a pergunta manda somar. "Ou" de eventos separados é soma.', tagErro: 'combinatoria_probabilidade' },
      D: { rotulo: '0,036.', valorNumerico: 0.036, diagnosticoPt: 'Multiplicar as duas probabilidades responderia "ser as duas coisas ao mesmo tempo", e ninguém é AB+ e O− junto.', tagErro: 'combinatoria_probabilidade' },
      E: { rotulo: '0,0144.', valorNumerico: 0.0144, diagnosticoPt: 'Potência em cima de uma fatia pequena não é o "ou" do enunciado. Separe os dois perfis e some.', tagErro: 'combinatoria_probabilidade' },
    },
    dicas: [
      'Receptor universal é um perfil só: AB e Rh+. Doador universal é outro perfil: O e Rh−. A palavra "ou" junta os dois. Antes, descubra a fatia que o texto não deu pronta: quem não é A, nem B, nem AB.',
      'Resumo de boteco: desenhe quatro potes, A, B, AB e O. O texto encheu três. O quarto é o que falta para 100%. Dentro de cada pote, 60% têm Rh+ e o resto tem Rh−. Você só vai pescar em dois lugares: no pote AB, a parte Rh+, e no pote O, a parte Rh−.',
      'Primeiro passo: Rh− é o que falta para 100% quando Rh+ é 60%. Armadilha: usar o pote AB inteiro, sem o Rh. Outra: multiplicar as duas chances, como se a pessoa precisasse ser doadora e receptora ao mesmo tempo. "Ou", com perfis que não se misturam, soma.',
    ],
    solucaoCompletaPt:
      'Grupo O: 100% − 25% − 25% − 30% = 20%. Rh+ é 60% em cada grupo, então Rh− é 40%. Receptor universal, AB+: 30% × 60% = 18% = 0,18. Doador universal, O−: 20% × 40% = 8% = 0,08. Ninguém é os dois ao mesmo tempo, então P(um ou outro) = 0,18 + 0,08 = 0,26. Multiplicar 0,18 por 0,08 responderia uma pessoa impossível.',
    atalhoPt: 'Ache o grupo que sobrou. Recorte Rh+ no AB e Rh− no O. Some, porque os recortes não se encontram.',
    outroCaminhoPt:
      'Em fração: O = 1/5. AB+ = 3/10 × 3/5 = 9/50. O− = 1/5 × 2/5 = 2/25 = 4/50. Soma: 13/50 = 0,26. A fração só impede a vírgula de escorregar na hora de somar 0,18 com 0,08.',
    dicaVidaRealPt:
      '"Ou" soma quando os casos não podem acontecer juntos. "E" multiplica quando os dois precisam acontecer. Trocar essas duas palavras é o jeito mais curto de sair do universo da probabilidade e entrar no da chuteira.',
  },
  {
    ano: 2026,
    questao: 144,
    grau: 5,
    temaId: 'enem_estatistica_medias',
    correta: 'C',
    enunciadoMarkdown:
      'O dono de uma loja de importados anotou a quantidade de tablets de um modelo vendidos em cada mês do primeiro semestre:\n\n- Janeiro: 44\n- Fevereiro: 56\n- Março: 44\n- Abril: 48\n- Maio: 62\n- Junho: 52\n\nA mediana das quantidades mensais de tablets desse modelo vendidos no primeiro semestre é',
    alternativas: {
      A: { rotulo: '44.', valorNumerico: 44, diagnosticoPt: '44 é o valor que mais se repete, a moda. Mediana não elege o campeão de aparições. Ela elege a posição do meio depois de ordenar.', tagErro: 'leitura_interpretacao' },
      B: { rotulo: '46.', valorNumerico: 46, diagnosticoPt: 'Quarenta e seis não está na lista e também não é o meio de uma lista ordenada de seis meses. Ordenar vem antes de tirar qualquer média.', tagErro: 'calculo_aritmetico' },
      C: { rotulo: '50.', valorNumerico: 50, diagnosticoPt: 'Seis meses: a mediana fica entre o terceiro e o quarto da fila ordenada. A média desses dois é o meio.' },
      D: { rotulo: '51.', valorNumerico: 51, diagnosticoPt: 'Isso puxa para a média de todos os meses. A pergunta pediu mediana. Média usa todo mundo; mediana usa o miolo da fila.', tagErro: 'leitura_interpretacao' },
      E: { rotulo: '52.', valorNumerico: 52, diagnosticoPt: '52 está na lista, mas não ocupa sozinho o centro depois da ordenação. Com quantidade par, o centro é uma ponte entre dois valores.', tagErro: 'leitura_interpretacao' },
    },
    dicas: [
      'Mediana não é a média e não é o mês que mais vendeu. É o centro de uma fila ordenada. O primeiro gesto é ordenar os seis números, do menor para o maior. Janeiro não tem privilégio por ser janeiro.',
      'Resumo de boteco: seis cadeiras, uma para cada mês, em ordem de venda. O centro de um número par de cadeiras não é uma cadeira só. É o vão entre a terceira e a quarta. A mediana senta nesse vão: some os dois vizinhos e divida por dois.',
      'Primeiro passo: escreva a fila ordenada e circule o terceiro e o quarto. Armadilha: circular o 44 só porque ele aparece duas vezes. Aparição repetida é moda. Outra armadilha: somar os seis e dividir por seis. Isso é média, e a média desta lista não é o que foi perguntado.',
    ],
    solucaoCompletaPt:
      'Ordenando: 44, 44, 48, 52, 56, 62. Com seis valores, a mediana é a média do 3º e do 4º: (48 + 52) / 2 = 100 / 2 = 50. A moda seria 44, o valor repetido. A média dos seis seria (44+44+48+52+56+62)/6 = 306/6 = 51, que está nas alternativas exatamente para premiar quem trocou o nome da medida. A mediana é 50.',
    atalhoPt: 'Ordene. Quantidade par: média dos dois do meio. Aqui, o terceiro e o quarto da fila.',
    outroCaminhoPt:
      'Risque o menor e o maior, depois o novo menor e o novo maior. Sobram dois números no centro. A mediana é a média deles. Riscar as pontas é o mesmo que ordenar, só que o guardanapo fica mais curto.',
    dicaVidaRealPt:
      'Média se assusta com um mês extraordinário. Mediana não: ela só quer saber quem está no meio da fila. Por isso pesquisa de renda e nota de turma usam as duas e não fingem que são a mesma pessoa.',
  },
  {
    ano: 2026,
    questao: 155,
    grau: 7,
    temaId: 'enem_funcoes_sequencias',
    correta: 'A',
    enunciadoMarkdown:
      'Depreciação é o processo de desvalorização de um bem pelo uso ou pelo desgaste ao longo do tempo. Um carro zero quilômetro é vendido por R$ 80 000,00 e, imediatamente após a venda, ao sair da concessionária, já desvaloriza 10%. A partir daí, há uma depreciação anual de 12%.\n\nQual expressão algébrica relaciona o valor V desse carro, em real, com o tempo de uso t, em ano?',
    alternativas: {
      A: { rotulo: 'V = 72 000 · 0,88^t', diagnosticoPt: 'Os 10% saem uma vez, na porta da loja. Cada ano seguinte multiplica pelo que sobra de uma perda de 12%, e o tempo fica no expoente.' },
      B: { rotulo: 'V = 72 000 · 0,12^t', diagnosticoPt: '0,12 é a fatia que sai, não a fatia que fica. Se o carro perde 12% ao ano, ele conserva o complemento disso.', tagErro: 'porcentagem_base' },
      C: { rotulo: 'V = 80 000 · 0,78^t', diagnosticoPt: 'Somar 10% com 12% e aplicar todo ano, em cima dos 80 mil, mistura a mordida da concessionária com a mordida anual. A primeira acontece uma vez só.', tagErro: 'porcentagem_base' },
      D: { rotulo: 'V = 80 000 · 0,22^t', diagnosticoPt: '22% seria a soma das perdas tratada como se fosse o que sobra. Perda não é fator. O fator é o que permanece.', tagErro: 'porcentagem_base' },
      E: { rotulo: 'V = 80 000 · 0,12^t', diagnosticoPt: 'A base continuou 80 mil, então os 10% da saída da loja sumiram da história, e 0,12 de novo é a parte que cai, não a que fica.', tagErro: 'porcentagem_base' },
    },
    dicas: [
      'Existem duas mordidas, e elas não são do mesmo tipo. A primeira acontece uma vez, no instante em que o carro sai da loja. A segunda se repete todo ano, em cima do valor que já está valendo.',
      'Resumo de boteco: perder 10% uma vez é multiplicar por o que sobra de 100% menos 10%. Esse valor novo é a base. Daí para a frente, perder 12% ao ano é multiplicar, todo ano, por o que sobra de 100% menos 12%. Tempo no expoente significa "repita essa multiplicação t vezes".',
      'Primeiro passo: separe a base, que já sofreu os 10%, do fator anual. Armadilha: somar 10 com 12 e usar um fator único sobre os 80 mil. Outra: colocar no fator a porcentagem que sai, em vez da porcentagem que fica. Quem fica é que multiplica o preço.',
    ],
    solucaoCompletaPt:
      'Na saída da loja: 80 000 × (1 − 0,10) = 80 000 × 0,90 = 72 000. A partir daí, cada ano multiplica por (1 − 0,12) = 0,88. Depois de t anos, V = 72 000 × 0,88^t. O expoente não soma os 12%: ele repete o fator. 0,12^t derreteria o carro quase no primeiro ano, porque 0,12 é a parte que foi embora, não a que ficou na garagem.',
    atalhoPt: 'Uma mordida única define a base. A mordida anual vira fator menor que 1, repetido t vezes.',
    outroCaminhoPt:
      'V(0), logo depois da loja, já é 72 000, antes de qualquer aniversário. V(1) = 72 000 × 0,88. V(2) = 72 000 × 0,88 × 0,88. O padrão da recorrência V(t) = 0,88 × V(t−1) é a exponencial com essa base. Escrever os três primeiros anos no guardanapo impede de colocar 80 000 de volta na fórmula.',
    dicaVidaRealPt:
      'Desconto sucessivo não soma porcentagem. Cada porcentagem mora em cima do valor que sobrou da anterior. Por isso 10% na saída e 12% ao ano não viram 22% por ano. O universo da loja é multiplicativo.',
  },
  {
    ano: 2026,
    questao: 163,
    grau: 7,
    temaId: 'enem_funcoes_sequencias',
    correta: 'D',
    enunciadoMarkdown:
      'Uma padaria vende pizzas de calabresa e de frango. Há 3 funcionários: Ana, Carla e José. No sábado, Ana vendeu 6 pizzas de calabresa e 15 de frango, e recebeu 780 reais por essas vendas. Carla vendeu 5 de calabresa e 8 de frango, e recebeu 470 reais. José vendeu 4 de calabresa, não anotou quantas de frango vendeu, e recebeu 520 reais no total.\n\nQual a quantidade total de pizzas que José vendeu nesse sábado?',
    alternativas: {
      A: { rotulo: '4', valorNumerico: 4, diagnosticoPt: 'Quatro é só a calabresa, que ele anotou. O recibo de 520 reais não fecha só com essas quatro, se o preço for o mesmo da Ana e da Carla.', tagErro: 'leitura_interpretacao' },
      B: { rotulo: '5', valorNumerico: 5, diagnosticoPt: 'Cinco seria quase só a calabresa, com uma de frango tímida. O preço dos dois sabores, tirado das outras duas funcionárias, não deixa o recibo fechar assim.', tagErro: 'calculo_aritmetico' },
      C: { rotulo: '13', valorNumerico: 13, diagnosticoPt: 'Esse número esquece de somar as quatro calabresas, ou conta só o frango. A pergunta pede o total dos dois sabores.', tagErro: 'leitura_interpretacao' },
      D: { rotulo: '14', valorNumerico: 14, diagnosticoPt: 'O preço de cada sabor sai do sistema da Ana com a Carla. No recibo do José, o que passa das quatro calabresas é frango. Some os dois sabores.' },
      E: { rotulo: '18', valorNumerico: 18, diagnosticoPt: 'Dezoito mistura quantidade da Ana ou da Carla com a do José. Cada funcionário tem o próprio par de quantidades.', tagErro: 'calculo_aritmetico' },
    },
    dicas: [
      'O preço da calabresa é o mesmo para os três, e o do frango também. Ana e Carla anotaram os dois sabores e o dinheiro. Isso é um sistema com duas incógnitas. José é a pergunta, não o sistema.',
      'Resumo de boteco: chame c o preço da calabresa e f o do frango. A nota da Ana é uma equação. A nota da Carla é a outra. Resolva o par. Só então abra a nota do José: quatro calabresas já têm preço, o resto do dinheiro é frango, e frango dividido pelo preço unitário é a quantidade que ele esqueceu de anotar.',
      'Primeiro passo: simplifique a equação da Ana, que tem números grandes e visivelmente múltiplos. Armadilha: responder 4, que é o único número que José anotou. A pergunta pede a quantidade total, calabresa mais frango. Outra: usar o dinheiro do José antes de saber o preço. Sem preço, 520 é um verso; com preço, vira equação.',
    ],
    solucaoCompletaPt:
      'Seja c o preço da calabresa e f o do frango. Ana: 6c + 15f = 780. Dividindo por 3: 2c + 5f = 260, então c = (260 − 5f) / 2. Carla: 5c + 8f = 470. Substituindo: 5(260 − 5f)/2 + 8f = 470. Vezes 2: 5(260 − 5f) + 16f = 940, ou 1 300 − 25f + 16f = 940. Então 1 300 − 9f = 940, 9f = 360, f = 40. E c = (260 − 200) / 2 = 30. Confere na Carla: 5×30 + 8×40 = 150 + 320 = 470. José: 4×30 + x×40 = 520, então 120 + 40x = 520, 40x = 400, x = 10 frangos. Total de José: 4 + 10 = 14 pizzas.',
    atalhoPt: 'Duas funcionárias completas determinam os dois preços. A terceira, com um sabor conhecido, revela o outro. Some os sabores no fim.',
    outroCaminhoPt:
      'Elimine c sem substituição: multiplique 2c + 5f = 260 por 5 e a equação da Carla por 2. 10c + 25f = 1 300 e 10c + 16f = 940. Subtraia: 9f = 360. O mesmo preço de frango aparece, e o resto do caminho não muda. Eliminar é só não carregar a incógnita que você ainda não quer ver.',
    dicaVidaRealPt:
      'Dois preços desconhecidos pedem dois recibos completos. O terceiro recibo, pela metade, deixa de ser mistério quando o preço já tem nome. Sistema linear é isso: nomear o que se repete.',
  },
  {
    ano: 2017,
    questao: 136,
    grau: 5,
    temaId: 'enem_funcoes_sequencias',
    correta: 'C',
    enunciadoMarkdown:
      'Os congestionamentos de trânsito constituem um problema que aflige, todos os dias, milhares de motoristas brasileiros. O gráfico ilustra a situação, representando, ao longo de um intervalo definido de tempo, a variação da velocidade de um veículo durante um congestionamento.\n\nQuantos minutos o veículo permaneceu imóvel ao longo do intervalo de tempo total analisado?',
    alternativas: {
      A: { rotulo: '4', valorNumerico: 4, diagnosticoPt: 'Esse intervalo inclui trechos em que a linha ainda está acima do eixo. Acima do eixo, mesmo devagar, o carro anda.', tagErro: 'leitura_interpretacao' },
      B: { rotulo: '3', valorNumerico: 3, diagnosticoPt: 'Sobrou um quadradinho em que a velocidade ainda não é zero, ou em que ela já voltou a subir.', tagErro: 'calculo_aritmetico' },
      C: { rotulo: '2', valorNumerico: 2, diagnosticoPt: 'Imóvel é velocidade zero: a linha grudada no eixo do tempo. Conte só esse trecho.' },
      D: { rotulo: '1', valorNumerico: 1, diagnosticoPt: 'Há um trecho colado no eixo maior do que um único quadradinho. Conte o intervalo inteiro, não só o primeiro.', tagErro: 'calculo_aritmetico' },
      E: { rotulo: '0', valorNumerico: 0, diagnosticoPt: 'O carro para sim. Em algum intervalo a linha encosta no eixo horizontal e fica lá.', tagErro: 'leitura_interpretacao' },
    },
    dicas: [
      'O gráfico é velocidade pelo tempo. Imóvel não é "devagar" e não é "descendo". Imóvel é velocidade zero: a linha encostada no eixo de baixo.',
      'Resumo de boteco: olhe os números do eixo do tempo. Cada quadradinho entre dois números vizinhos vale o mesmo intervalo. Pinte só onde a linha está grudada no eixo, sem folga nenhuma. Onde ela está baixa mas ainda solta do eixo, o carro ainda se move.',
      'Primeiro passo: ache o instante em que a linha chega no eixo e o instante em que ela descola de novo. A diferença é o tempo parado. Armadilha: contar a descida inteira, ou o trecho horizontal que está acima do eixo no começo do gráfico.',
    ],
    solucaoCompletaPt:
      'No gráfico, a velocidade vale zero quando a linha coincide com o eixo do tempo. Isso acontece do instante 6 até o instante 8. De 6 a 8 são 2 minutos. Antes disso a linha está acima do eixo, inclusive no trecho horizontal do começo: horizontal acima do eixo é velocidade constante, não parada. Depois do 8 a linha sobe de novo. O veículo ficou imóvel por 2 minutos.',
    atalhoPt: 'Tempo imóvel = largura do trecho em que a linha fica colada no eixo do tempo.',
    outroCaminhoPt:
      'Os outros horizontais do gráfico não encostam no eixo. Só o patamar final, entre o 6 e o 8, é velocidade nula. Um patamar no meio da altura é cruzeiro, não congestionamento parado.',
    dicaVidaRealPt:
      'No gráfico velocidade × tempo, parado é altura zero, não "reta". Reta horizontal no meio da escala é andar sem acelerar. O engarrafamento de verdade é a reta que mora no chão do gráfico.',
  },
]


export const ENEM_MATEMATICA_LOTE2: readonly DesafioUnificado[] = SPECS_ENEM_MATEMATICA_LOTE2.map(construirDesafioEnem)
