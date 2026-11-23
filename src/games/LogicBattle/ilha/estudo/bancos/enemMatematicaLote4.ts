/**
 * Lote 4 — matematica do caderno 5 amarelo, 2012, 2013 e 2014.
 * Letras conferidas com o indice dos PDFs oficiais. Dicas nao entregam o valor final.
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
    Record<'A' | 'B' | 'C' | 'D' | 'E', { readonly rotulo: string; readonly valorNumerico?: number; readonly diagnosticoPt: string; readonly tagErro?: TipoErroPedagogico }>
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

const SPECS: readonly SpecEnemOficial[] = [
  {
    ano: 2012,
    questao: 142,
    grau: 5,
    temaId: 'enem_aritmetica_ciclos',
    correta: 'B',
    enunciadoMarkdown:
      'Jogar baralho é uma atividade que estimula o raciocínio. Um jogo tradicional é a Paciência, que utiliza 52 cartas. Inicialmente são formadas sete colunas com as cartas. A primeira coluna tem uma carta, a segunda tem duas cartas, a terceira tem três cartas, a quarta tem quatro cartas, e assim sucessivamente até a sétima coluna, a qual tem sete cartas, e o que sobra forma o monte, que são as cartas não utilizadas nas colunas.\n\nA quantidade de cartas que forma o monte é',
    alternativas: {
      A: { rotulo: '21.', valorNumerico: 21, diagnosticoPt: 'Faltou coluna na soma, ou o monte foi confundido com uma das colunas do meio.', tagErro: 'calculo_aritmetico' },
      B: { rotulo: '24.', valorNumerico: 24, diagnosticoPt: 'As sete colunas consomem a soma de 1 até 7. O monte é o que o baralho ainda não sentou.' },
      C: { rotulo: '26.', valorNumerico: 26, diagnosticoPt: 'Metade do baralho é um palpite simétrico. A Paciência não parte o maço ao meio: ela faz uma escada.', tagErro: 'leitura_interpretacao' },
      D: { rotulo: '28.', valorNumerico: 28, diagnosticoPt: 'Essa é a soma das colunas, não o monte. O monte é o baralho menos essa soma.', tagErro: 'leitura_interpretacao' },
      E: { rotulo: '31.', valorNumerico: 31, diagnosticoPt: 'A escada ficou curta ou longa demais. Confira se a sétima coluna entrou com sete cartas, nem seis nem oito.', tagErro: 'calculo_aritmetico' },
    },
    dicas: [
      'O baralho tem 52 cartas. O monte é o que não entrou nas colunas. A pergunta não pede a coluna maior: pede a sobra.',
      'Resumo de boteco: desenhe sete pilhas, com 1, 2, 3, 4, 5, 6 e 7 cartas. Some a escada. O monte é 52 menos essa soma. Quem entrega a soma entregou as colunas, não o monte.',
      'Primeiro passo: a soma de 1 até n é n(n+1)/2. Aqui n é 7. Armadilha: parar na sexta coluna, ou achar que o monte é a metade de 52.',
    ],
    solucaoCompletaPt:
      'Colunas: 1+2+3+4+5+6+7 = 7×8/2 = 28 cartas. Monte: 52 − 28 = 24 cartas. O 28 está nas opções para quem esquece de tirar as colunas do baralho. A Paciência guarda o resto na mão, não em cima da mesa.',
    atalhoPt: 'Monte = 52 − (1+2+…+7). A soma da escada é 7×8/2.',
    outroCaminhoPt: 'Some em pares: 1+7, 2+6, 3+5, e o 4 no meio. Três pares de 8 e mais 4 dão 28. O resto do maço não muda.',
    dicaVidaRealPt: 'Sobra é total menos o que já foi usado. Entregar o usado no lugar da sobra é o erro de quem conta a mesa e esquece o maço.',
  },
  {
    ano: 2012,
    questao: 152,
    grau: 6,
    temaId: 'enem_razoes_escalas',
    correta: 'D',
    enunciadoMarkdown:
      'A capacidade mínima, em BTU/h, de um aparelho de ar-condicionado, para ambientes sem exposição ao sol, pode ser determinada da seguinte forma:\n\n- 600 BTU/h por m², considerando-se até duas pessoas no ambiente;\n- para cada pessoa adicional nesse ambiente, acrescentar 600 BTU/h;\n- acrescentar mais 600 BTU/h para cada equipamento eletroeletrônico em funcionamento no ambiente.\n\nSerá instalado um aparelho em uma sala, sem exposição ao sol, de dimensões 4 m × 5 m, em que permaneçam quatro pessoas e possua um aparelho de televisão em funcionamento.\n\nA capacidade mínima, em BTU/h, desse aparelho deve ser',
    alternativas: {
      A: { rotulo: '12 000.', valorNumerico: 12000, diagnosticoPt: 'Isso é só a área. As duas pessoas extras e a televisão ainda não entraram na conta.', tagErro: 'leitura_interpretacao' },
      B: { rotulo: '12 600.', valorNumerico: 12600, diagnosticoPt: 'Entrou só um acréscimo de 600. A sala tem gente a mais e um aparelho ligado.', tagErro: 'leitura_interpretacao' },
      C: { rotulo: '13 200.', valorNumerico: 13200, diagnosticoPt: 'Faltou um dos três acréscimos de 600: ou uma pessoa, ou a televisão.', tagErro: 'calculo_aritmetico' },
      D: { rotulo: '13 800.', valorNumerico: 13800, diagnosticoPt: 'A área cobre até duas pessoas. As outras duas pessoas e a televisão acrescentam 600 cada.' },
      E: { rotulo: '15 000.', valorNumerico: 15000, diagnosticoPt: 'As quatro pessoas foram todas tratadas como adicionais, em cima da área. As duas primeiras já estão dentro dos 600 por metro quadrado.', tagErro: 'leitura_interpretacao' },
    },
    dicas: [
      'A regra da área já inclui até duas pessoas. Pessoa adicional é quem passa de duas. Equipamento é outra linha, não um morador.',
      'Resumo de boteco: desenhe o retângulo 4 por 5 e escreva 600 em cada metro quadrado. Do lado, conte as pessoas que excedem duas. Do outro lado, a televisão. Cada excedente e cada aparelho valem mais 600. Some as três linhas.',
      'Primeiro passo: área vezes 600. Armadilha: cobrar 600 por cada uma das quatro pessoas, como se a área não tivesse já pago as duas primeiras. A televisão não substitui pessoa: soma.',
    ],
    solucaoCompletaPt:
      'Área: 4 × 5 = 20 m². Base: 20 × 600 = 12 000 BTU/h, já com até duas pessoas. Pessoas adicionais: 4 − 2 = 2, mais 2 × 600 = 1 200. Televisão: 600. Total: 12 000 + 1 200 + 600 = 13 800 BTU/h. Cobrar as quatro pessoas por fora infla o aparelho até 15 000, que está na lista para essa leitura dobrada.',
    atalhoPt: 'Área × 600, mais 600 por pessoa além da segunda, mais 600 pela televisão.',
    outroCaminhoPt:
      'São três pacotes de 600 além da área: duas pessoas e um aparelho. 3 × 600 = 1 800. 12 000 + 1 800 = 13 800. Agrupar os extras evita esquecer um 600 no meio da soma.',
    dicaVidaRealPt: 'Regra com franquia não cobra de novo o que a franquia já inclui. As duas primeiras pessoas estão no metro quadrado. Só o que passa da franquia entra na conta extra.',
  },
  {
    ano: 2012,
    questao: 160,
    grau: 5,
    temaId: 'enem_razoes_escalas',
    correta: 'A',
    enunciadoMarkdown:
      'Uma mãe recorreu à bula para verificar a dosagem de um remédio que precisava dar a seu filho. Na bula, recomendava-se a seguinte dosagem: 5 gotas para cada 2 kg de massa corporal a cada 8 horas.\n\nSe a mãe ministrou corretamente 30 gotas do remédio a seu filho a cada 8 horas, então a massa corporal dele é de',
    alternativas: {
      A: { rotulo: '12 kg.', valorNumerico: 12, diagnosticoPt: 'Trinta gotas são seis grupos de cinco. Cada grupo cobre 2 kg.' },
      B: { rotulo: '16 kg.', valorNumerico: 16, diagnosticoPt: 'O 2 kg e o 8 horas se misturaram. O 8 horas só diz o intervalo, não entra na massa.', tagErro: 'leitura_interpretacao' },
      C: { rotulo: '24 kg.', valorNumerico: 24, diagnosticoPt: 'Aqui cada gota virou quase 1 kg, ou os 5 e os 2 trocaram de lugar na regra de três.', tagErro: 'proporcao_invertida' },
      D: { rotulo: '36 kg.', valorNumerico: 36, diagnosticoPt: 'Trinta mais alguma coisa da bula. A bula é uma razão, gotas para quilogramas, não uma soma.', tagErro: 'proporcao_invertida' },
      E: { rotulo: '75 kg.', valorNumerico: 75, diagnosticoPt: 'Proporção invertida: a massa foi parar no lugar das gotas. Se 5 gotas cobrem 2 kg, mais gotas cobrem mais massa, na mesma razão.', tagErro: 'proporcao_invertida' },
    },
    dicas: [
      'A frase "a cada 8 horas" diz quando repetir a dose. Não muda o peso. A razão que importa é 5 gotas para cada 2 kg.',
      'Resumo de boteco: desenhe pacotinhos de 5 gotas. Cada pacotinho carrega 2 kg da criança. Veja quantos pacotinhos cabem em 30 gotas. Multiplique essa quantidade por 2 kg.',
      'Primeiro passo: 30 dividido por 5. Armadilha: multiplicar 30 por 2 e dividir por 5 do jeito cruzado invertido, ou deixar o 8 entrar na massa. O relógio não pesa.',
    ],
    solucaoCompletaPt:
      '5 gotas correspondem a 2 kg. 30 gotas são 30/5 = 6 grupos. Massa: 6 × 2 = 12 kg. Na regra de três: 5/2 = 30/m, então 5m = 60, m = 12. O 75 kg aparece quando alguém escreve 5/30 = 2/m e inverte a razão.',
    atalhoPt: 'Quantos grupos de 5 gotas há em 30? Cada grupo vale 2 kg.',
    outroCaminhoPt: 'Uma gota cobre 2/5 kg. Trinta gotas cobrem 30 × 2/5 = 12 kg. Descer à unidade só confirma o pacote.',
    dicaVidaRealPt: 'Bula é proporção. O intervalo de horas diz a frequência, não a dose. Misturar o relógio com o peso inventa uma criança que a bula não descreveu.',
  },
  {
    ano: 2012,
    questao: 169,
    grau: 5,
    temaId: 'enem_razoes_escalas',
    correta: 'B',
    enunciadoMarkdown:
      'Há, em virtude da demanda crescente de economia de água, equipamentos e utensílios como, por exemplo, as bacias sanitárias ecológicas, que utilizam 6 litros de água por descarga em vez dos 15 litros utilizados por bacias sanitárias não ecológicas.\n\nQual será a economia diária de água obtida por meio da substituição de uma bacia sanitária não ecológica, que gasta cerca de 60 litros por dia com a descarga, por uma bacia sanitária ecológica?',
    alternativas: {
      A: { rotulo: '24 litros.', valorNumerico: 24, diagnosticoPt: 'Esse é o gasto da bacia nova, não a economia. Economia é o que deixou de sair, não o que ainda sai.', tagErro: 'leitura_interpretacao' },
      B: { rotulo: '36 litros.', valorNumerico: 36, diagnosticoPt: 'O mesmo número de descargas, cada uma mais barata. A diferença diária é o que a casa deixa de gastar.' },
      C: { rotulo: '40 litros.', valorNumerico: 40, diagnosticoPt: 'Uma conta solta com 60 e os litros da descarga, sem manter a quantidade de usos no dia.', tagErro: 'calculo_aritmetico' },
      D: { rotulo: '42 litros.', valorNumerico: 42, diagnosticoPt: 'Aqui os 6 e os 15 foram somados ou subtraídos direto dos 60, sem achar quantas descargas o dia tem.', tagErro: 'proporcao_invertida' },
      E: { rotulo: '50 litros.', valorNumerico: 50, diagnosticoPt: 'Passou da diferença real. A bacia nova ainda gasta água: a economia não é quase o dia inteiro.', tagErro: 'calculo_aritmetico' },
    },
    dicas: [
      'A casa faz o mesmo número de descargas. Muda o litro de cada uma. Economia diária é gasto antigo menos gasto novo, não o gasto novo sozinho.',
      'Resumo de boteco: os 60 litros por dia, com 15 litros por descarga, dizem quantas vezes a descarga foi apertada. A bacia nova gasta 6 litros nessas mesmas vezes. Desenhe as descargas iguais e troque só o copo de água.',
      'Primeiro passo: divida 60 por 15 para achar o número de descargas. Armadilha: responder 60 menos 15, ou entregar os litros da bacia nova como se fossem a economia. O que sobra na conta da água é o que deixou de ser gasto.',
    ],
    solucaoCompletaPt:
      'Descargas por dia: 60 / 15 = 4. A bacia ecológica, nas mesmas 4 descargas, gasta 4 × 6 = 24 litros. Economia: 60 − 24 = 36 litros por dia. Em fração, a nova usa 6/15 = 2/5 da água, então gasta 24 e economiza 3/5 de 60, que também é 36. O 24 está na lista para quem para no gasto novo.',
    atalhoPt: 'Número de descargas = 60/15. Economia = 60 − (esse número × 6).',
    outroCaminhoPt: 'Cada descarga economiza 15 − 6 = 9 litros. Quatro descargas economizam 4 × 9 = 36. A diferença por uso, vezes a frequência, é o mesmo dia.',
    dicaVidaRealPt: 'Economia não é o consumo novo. É a diferença. Trocar a descarga e achar que o número novo já é o que se poupou conta a água que ainda desce.',
  },
  {
    ano: 2013,
    questao: 143,
    grau: 6,
    temaId: 'enem_razoes_escalas',
    correta: 'C',
    enunciadoMarkdown:
      'Uma indústria tem um reservatório de água com capacidade para 900 m³. Quando há necessidade de limpeza do reservatório, toda a água precisa ser escoada. O escoamento da água é feito por seis ralos, e dura 6 horas quando o reservatório está cheio. Esta indústria construirá um novo reservatório, com capacidade de 500 m³, cujo escoamento da água deverá ser realizado em 4 horas, quando o reservatório estiver cheio. Os ralos utilizados no novo reservatório deverão ser idênticos aos do já existente.\n\nA quantidade de ralos do novo reservatório deverá ser igual a',
    alternativas: {
      A: { rotulo: '2.', valorNumerico: 2, diagnosticoPt: 'O reservatório novo é menor, mas o prazo também encolheu. Menos água em menos tempo não pede tão poucos ralos.', tagErro: 'proporcao_invertida' },
      B: { rotulo: '4.', valorNumerico: 4, diagnosticoPt: 'O 4 das horas novas entrou no lugar da quantidade de ralos. Hora não é ralo.', tagErro: 'leitura_interpretacao' },
      C: { rotulo: '5.', valorNumerico: 5, diagnosticoPt: 'Cada ralo antigo tem uma vazão. A vazão que o tanque novo exige, dividida por essa vazão, é o número de ralos.' },
      D: { rotulo: '8.', valorNumerico: 8, diagnosticoPt: 'Passou da vazão necessária. Confira metro cúbico por hora de um ralo só, antes de multiplicar.', tagErro: 'calculo_aritmetico' },
      E: { rotulo: '9.', valorNumerico: 9, diagnosticoPt: 'Uma regra de três direta com 900, 500 e 6, sem olhar as horas, trata o tempo como se fosse o mesmo. O tempo mudou.', tagErro: 'proporcao_invertida' },
    },
    dicas: [
      'Ralo idêntico significa a mesma vazão, em metro cúbico por hora, cada um. Primeiro descubra essa vazão no tanque velho. O tanque novo pede outra vazão total, porque o volume e o prazo mudaram.',
      'Resumo de boteco: o tanque velho esvazia 900 metros cúbicos em 6 horas, com 6 ralos. Isso diz quanto um ralo bebe por hora. O tanque novo precisa esvaziar 500 em 4 horas. Divida o que o tanque novo exige por hora pelo que um ralo consegue.',
      'Primeiro passo: vazão total antiga = volume dividido pelas horas. Vazão de um ralo = essa total dividida pelos ralos. Armadilha: fazer 6 × 500/900 e ignorar que 6 horas viraram 4. Tempo diferente muda a pressa.',
    ],
    solucaoCompletaPt:
      'Vazão total antiga: 900 m³ / 6 h = 150 m³/h, com 6 ralos. Um ralo: 150 / 6 = 25 m³/h. O novo tanque precisa de 500 / 4 = 125 m³/h. Ralos: 125 / 25 = 5. Em uma conta só: ralos = 6 × (500/900) × (6/4) = 6 × (5/9) × (3/2) = 5. O fator 6/4 é a pressa nova. Sem ele, a regra de três mente.',
    atalhoPt: 'Ache m³/h de um ralo no tanque velho. Divida a vazão exigida pelo tanque novo por esse número.',
    outroCaminhoPt:
      'O trabalho de um ralo em uma hora é fixo. O novo serviço é 500 m³ em 4 h, o velho foi 900 m³ em 6 h com 6 ralos. A razão dos serviços, corrigida pelo tempo, multiplica os 6. Chega nos mesmos 5 ralos.',
    dicaVidaRealPt: 'Esvaziar mais depressa não é só ter menos água. É vazão. Se o prazo encolhe mais do que o volume, você pode precisar de quase tantos ralos quanto antes.',
  },
  {
    ano: 2013,
    questao: 146,
    grau: 6,
    temaId: 'enem_porcentagem_financeira',
    correta: 'B',
    enunciadoMarkdown:
      'O contribuinte que vende mais de R$ 20 mil de ações em Bolsa de Valores em um mês deverá pagar Imposto de Renda. O pagamento para a Receita Federal consistirá em 15% do lucro obtido com a venda das ações.\n\nUm contribuinte que vende por R$ 34 mil um lote de ações que custou R$ 26 mil terá de pagar de Imposto de Renda à Receita Federal o valor de',
    alternativas: {
      A: { rotulo: 'R$ 900,00.', valorNumerico: 900, diagnosticoPt: 'A alíquota foi aplicada numa base menor do que o lucro. Lucro é venda menos custo, o lote inteiro.', tagErro: 'porcentagem_base' },
      B: { rotulo: 'R$ 1 200,00.', valorNumerico: 1200, diagnosticoPt: 'A venda passou de 20 mil, então o imposto existe. A base é o lucro, e a alíquota é 15% desse lucro.' },
      C: { rotulo: 'R$ 2 100,00.', valorNumerico: 2100, diagnosticoPt: 'Os 15% incidiram sobre o que a venda passou de 20 mil, não sobre o lucro. O texto isenta quem vende pouco; quem vende muito paga sobre o ganho.', tagErro: 'porcentagem_base' },
      D: { rotulo: 'R$ 3 900,00.', valorNumerico: 3900, diagnosticoPt: 'Os 15% foram para o custo das ações, não para o lucro. Imposto de renda, aqui, não mora no que se pagou.', tagErro: 'porcentagem_base' },
      E: { rotulo: 'R$ 5 100,00.', valorNumerico: 5100, diagnosticoPt: 'Os 15% foram para o valor da venda inteira. A Receita, nessa regra, fica com uma fatia do lucro, não do faturamento.', tagErro: 'porcentagem_base' },
    },
    dicas: [
      'Duas perguntas em ordem. A venda passou de 20 mil? Se passou, o imposto existe. Sobre o quê? Sobre o lucro, não sobre a venda e não sobre o custo.',
      'Resumo de boteco: lucro é o que entrou menos o que a ação tinha custado. Desenhe 34 mil na entrada e 26 mil na saída antiga. O que sobra no meio é a base. Quinze por cento dessa sobra é o imposto. O 20 mil só decide se a porta abre.',
      'Primeiro passo: confirme que 34 mil é mais do que 20 mil. Armadilha: tirar 15% de 34 mil, ou 15% de 26 mil, ou 15% só do pedaço que passou de 20 mil. Nenhuma dessas bases é o lucro.',
    ],
    solucaoCompletaPt:
      'Venda de 34 mil supera 20 mil, então há imposto. Lucro: 34 000 − 26 000 = 8 000. Imposto: 15% de 8 000 = 0,15 × 8 000 = 1 200 reais. Quinze por cento de 34 mil daria 5 100, que taxa o faturamento. Quinze por cento de 26 mil daria 3 900, que taxa o custo. A regra taxa o ganho.',
    atalhoPt: 'Se a venda passa de 20 mil, imposto = 15% de (venda − custo).',
    outroCaminhoPt: '8 000 × 15/100 = 8 000 × 3/20 = 1 200. A fração 3/20 evita a vírgula do 0,15 e mostra o mesmo mil e duzentos.',
    dicaVidaRealPt: 'Isenção é uma porta. Quem atravessa a porta não paga imposto sobre a porta: paga sobre o lucro. O limite de 20 mil não é a base do cálculo.',
  },
  {
    ano: 2013,
    questao: 147,
    grau: 5,
    temaId: 'enem_razoes_escalas',
    correta: 'B',
    enunciadoMarkdown:
      'Para se construir um contrapiso, é comum, na constituição do concreto, se utilizar cimento, areia e brita, na seguinte proporção: 1 parte de cimento, 4 partes de areia e 2 partes de brita. Para construir o contrapiso de uma garagem, uma construtora encomendou um caminhão betoneira com 14 m³ de concreto.\n\nQual é o volume de cimento, em m³, na carga de concreto trazido pela betoneira?',
    alternativas: {
      A: { rotulo: '1,75.', valorNumerico: 1.75, diagnosticoPt: 'O 14 foi dividido por 8, como se a brita ou a areia tivesse uma parte a mais. Conte as partes da receita de novo.', tagErro: 'calculo_aritmetico' },
      B: { rotulo: '2,00.', valorNumerico: 2, diagnosticoPt: 'A receita tem um total de partes. O cimento é uma delas. O caminhão inteiro se reparte nessa receita.' },
      C: { rotulo: '2,33.', valorNumerico: 2.33, diagnosticoPt: 'O 14 foi dividido por 6, pulando uma das partes. Areia, brita e cimento entram todos no denominador.', tagErro: 'calculo_aritmetico' },
      D: { rotulo: '4,00.', valorNumerico: 4, diagnosticoPt: 'Quatro é o número de partes de areia, não o volume de cimento. A pergunta pede o cimento, uma parte só.', tagErro: 'leitura_interpretacao' },
      E: { rotulo: '8,00.', valorNumerico: 8, diagnosticoPt: 'Oito não é a fatia do cimento. Ou a areia e a brita foram somadas e tratadas como volume, sem o cimento no bolo.', tagErro: 'proporcao_invertida' },
    },
    dicas: [
      'Proporção 1 : 4 : 2 não é três números soltos. É uma receita. O caminhão de 14 m³ é o bolo inteiro, já misturado.',
      'Resumo de boteco: some as partes: cimento, areia e brita. Esse total é o denominador. O cimento fica com uma parte. Divida os 14 m³ pelo total de partes e multiplique pelas partes de cimento, que aqui é uma.',
      'Primeiro passo: escreva 1+4+2. Armadilha: dividir 14 pela areia, ou entregar 4 porque a areia é a maior fatia. A pergunta tem nome: cimento.',
    ],
    solucaoCompletaPt:
      'Partes no total: 1 + 4 + 2 = 7. Cada parte vale 14 / 7 = 2 m³. Cimento é 1 parte: 2 m³. Areia seria 8 m³ e brita 4 m³, e 2+8+4 = 14. O 4 e o 8 estão na lista para quem entrega a areia ou a brita no lugar do cimento.',
    atalhoPt: 'Volume da parte = total ÷ (1+4+2). Cimento = uma parte.',
    outroCaminhoPt: 'Cimento é 1/7 da mistura. 14 × 1/7 = 2. A fração deixa claro que o 7 nasce da receita, não de um chute.',
    dicaVidaRealPt: 'Mistura em partes é fração do todo. O todo só existe depois que todas as partes são somadas. Esquecer um ingrediente no denominador engrossa o cimento.',
  },
  {
    ano: 2013,
    questao: 151,
    grau: 6,
    temaId: 'enem_porcentagem_financeira',
    correta: 'E',
    enunciadoMarkdown:
      'Para aumentar as vendas no início do ano, uma loja de departamentos remarcou os preços de seus produtos 20% abaixo do preço original. Quando chegam ao caixa, os clientes que possuem o cartão fidelidade da loja têm direito a um desconto adicional de 10% sobre o valor total de suas compras.\n\nUm cliente deseja comprar um produto que custava R$ 50,00 antes da remarcação de preços. Ele não possui o cartão fidelidade da loja. Caso esse cliente possuísse o cartão fidelidade da loja, a economia adicional que obteria ao efetuar a compra, em reais, seria de',
    alternativas: {
      A: { rotulo: '15,00.', valorNumerico: 15, diagnosticoPt: 'Vinte por cento mais dez por cento, aplicados juntos sobre os 50. Descontos sucessivos não se somam, e a pergunta pede só a segunda mordida.', tagErro: 'porcentagem_base' },
      B: { rotulo: '14,00.', valorNumerico: 14, diagnosticoPt: 'Essa é a economia total, da vitrine até o preço com cartão. A pergunta pede a economia adicional, a do cartão em cima do preço já remarcado.', tagErro: 'leitura_interpretacao' },
      C: { rotulo: '10,00.', valorNumerico: 10, diagnosticoPt: 'Dez por cento do preço original, não do preço que chega ao caixa. O cartão mora depois da remarcação.', tagErro: 'porcentagem_base' },
      D: { rotulo: '5,00.', valorNumerico: 5, diagnosticoPt: 'Cinco reais seria dez por cento de um valor que não é o preço remarcado. O cartão incide sobre o que sobrou dos 20%.', tagErro: 'porcentagem_base' },
      E: { rotulo: '4,00.', valorNumerico: 4, diagnosticoPt: 'O cartão tira 10% do preço já reduzido. Essa diferença, e só ela, é a economia adicional.' },
    },
    dicas: [
      'A palavra é "adicional". Ele já ganharia os 20% mesmo sem cartão. O que muda, se tivesse o cartão, é um segundo desconto, de 10%, em cima do preço que já foi remarcado.',
      'Resumo de boteco: risque 20% dos 50. O que sobrou é o preço de quem não tem cartão. O cartão come 10% desse resto, não dos 50. A economia adicional é só esse segundo pedaço, o que o caixa ainda tiraria.',
      'Primeiro passo: ache o preço com 20% de desconto. Armadilha: somar 20% e 10% e tirar 30% de 50. Outra: tirar 10% dos 50 originais. A base do cartão é o preço que já está na etiqueta nova.',
    ],
    solucaoCompletaPt:
      'Preço remarcado: 50 × 0,80 = 40 reais. Com o cartão: 40 × 0,90 = 36 reais. Economia adicional: 40 − 36 = 4 reais. A economia total, de 50 até 36, seria 14, e está na lista para quem lê "adicional" como "total". Somar as taxas daria 15, que ignora que o segundo desconto mora num preço menor.',
    atalhoPt: 'Preço novo = 80% de 50. Economia do cartão = 10% desse preço novo, não dos 50.',
    outroCaminhoPt:
      '50 × 0,8 × 0,1 = 4. O 0,8 chega na etiqueta. O 0,1 é a mordida do cartão sobre ela. Multiplicar nessa ordem impede de somar 20 com 10.',
    dicaVidaRealPt: 'Desconto sobre desconto não soma. O segundo percentual é tímido de propósito: ele come uma fatia de um bolo que já foi mordido.',
  },
  {
    ano: 2013,
    questao: 155,
    grau: 7,
    temaId: 'enem_probabilidade_contagem',
    correta: 'A',
    enunciadoMarkdown:
      'Numa escola com 1 200 alunos foi realizada uma pesquisa sobre o conhecimento desses em duas línguas estrangeiras, inglês e espanhol.\n\nNessa pesquisa constatou-se que 600 alunos falam inglês, 500 falam espanhol e 300 não falam qualquer um desses idiomas.\n\nEscolhendo-se um aluno dessa escola ao acaso e sabendo-se que ele não fala inglês, qual a probabilidade de que esse aluno fale espanhol?',
    alternativas: {
      A: { rotulo: '$\\dfrac{1}{2}$', valorNumerico: 0.5, diagnosticoPt: 'O grupo de quem não fala inglês tem um tamanho. Dentro dele, só quem fala espanhol e não fala inglês conta a favor.' },
      B: { rotulo: '$\\dfrac{5}{8}$', valorNumerico: 0.625, diagnosticoPt: 'Essa fração mistura os 500 de espanhol com um total que ainda inclui quem fala inglês. A condição "não fala inglês" encolhe o universo.', tagErro: 'combinatoria_probabilidade' },
      C: { rotulo: '$\\dfrac{1}{4}$', valorNumerico: 0.25, diagnosticoPt: 'O universo ficou grande demais, ou os bilíngues foram parar no grupo de quem não fala inglês.', tagErro: 'combinatoria_probabilidade' },
      D: { rotulo: '$\\dfrac{5}{6}$', valorNumerico: 0.833, diagnosticoPt: 'Quase todos, como se quase ninguém sem inglês ficasse sem espanhol. A pesquisa tem um bloco que não fala nenhum dos dois.', tagErro: 'calculo_aritmetico' },
      E: { rotulo: '$\\dfrac{5}{14}$', valorNumerico: 0.357, diagnosticoPt: 'Os 500 foram divididos por um total que não é o grupo "não fala inglês". Probabilidade condicional troca o denominador.', tagErro: 'combinatoria_probabilidade' },
    },
    dicas: [
      'A frase "sabendo-se que ele não fala inglês" troca o universo. Não é mais a escola inteira. É só o pedaço que não fala inglês.',
      'Resumo de boteco: desenhe dois círculos, inglês e espanhol, dentro da escola. Os 300 ficam fora dos dois. Quem fala os dois está na interseção, e essa gente fala inglês, então não entra no universo novo. O favorável é só a lua do espanhol, a parte que não invade o inglês.',
      'Primeiro passo: ache quantos falam as duas línguas, com união = soma menos interseção. A união é a escola menos quem não fala nenhuma. Armadilha: colocar os 500 inteiros no numerador. Boa parte desses 500 também fala inglês e já saiu do universo.',
    ],
    solucaoCompletaPt:
      'Quem fala pelo menos uma língua: 1 200 − 300 = 900. Então 600 + 500 − interseção = 900, e a interseção é 200. Espanhol apenas: 500 − 200 = 300. Quem não fala inglês: 1 200 − 600 = 600. Desses, os que falam espanhol são os 300 do espanhol apenas. Probabilidade: 300/600 = 1/2. Os 200 bilíngues não entram: eles falam inglês, e a condição os expulsou.',
    atalhoPt: 'Universo = quem não fala inglês. Favorável = espanhol apenas. A interseção sai dos dois.',
    outroCaminhoPt:
      'Fora do inglês há 600 alunos. Desses, 300 não falam língua nenhuma, então os outros 300 falam espanhol. 300/600 = 1/2. Os "nenhuma língua" são o complemento dentro do universo novo, e dispensam nomear a interseção em voz alta.',
    dicaVidaRealPt: 'Probabilidade condicional troca a sala, não só o numerador. "Sabendo que não fala inglês" manda embora todo mundo que fala inglês, inclusive quem também fala espanhol.',
  },
  {
    ano: 2013,
    questao: 159,
    grau: 6,
    temaId: 'enem_razoes_escalas',
    correta: 'C',
    enunciadoMarkdown:
      'Uma torneira não foi fechada corretamente e ficou pingando, da meia-noite às seis horas da manhã, com a frequência de uma gota a cada três segundos. Sabe-se que cada gota de água tem volume de 0,2 mL.\n\nQual foi o valor mais aproximado do total de água desperdiçada nesse período, em litros?',
    alternativas: {
      A: { rotulo: '0,2.', valorNumerico: 0.2, diagnosticoPt: 'Esse é o volume de uma gota, em mL, lido como se já fosse o total em litros. A noite inteira pingou.', tagErro: 'unidade_escala' },
      B: { rotulo: '1,2.', valorNumerico: 1.2, diagnosticoPt: 'Perto do desperdício, mas alguma hora ou o 0,2 mL ficou curto na multiplicação. Conte os segundos das seis horas antes das gotas.', tagErro: 'calculo_aritmetico' },
      C: { rotulo: '1,4.', valorNumerico: 1.4, diagnosticoPt: 'Seis horas em segundos, uma gota a cada três, cada gota com 0,2 mL, e o resultado passado para litros.' },
      D: { rotulo: '12,9.', valorNumerico: 12.9, diagnosticoPt: 'O mililitro não virou litro, ou virou com uma casa a menos. Mil mL fazem um litro.', tagErro: 'unidade_escala' },
      E: { rotulo: '64,8.', valorNumerico: 64.8, diagnosticoPt: 'As gotas foram contadas sem dividir os segundos por três, ou o 0,2 entrou grande demais. Uma gota a cada três segundos não é uma gota por segundo.', tagErro: 'calculo_aritmetico' },
    },
    dicas: [
      'A resposta é em litros. A gota está em mililitro. Entre os dois há o fator mil. Antes disso, a noite precisa virar número de gotas.',
      'Resumo de boteco: da meia-noite às seis são seis horas. Passe para segundos. Divida por três: essa é a quantidade de gotas. Cada uma tem 0,2 mL. Some e divida por 1 000 para chegar no litro. "Mais aproximado" avisa que a opção pode arredondar a última casa.',
      'Primeiro passo: 1 hora = 3 600 segundos. Armadilha: tratar 0,2 mL como 0,2 L, ou esquecer de dividir por três e contar uma gota por segundo. A torneira é teimosa, mas não é uma torneira aberta.',
    ],
    solucaoCompletaPt:
      'Seis horas: 6 × 3 600 = 21 600 segundos. Gotas: 21 600 / 3 = 7 200. Volume: 7 200 × 0,2 = 1 440 mL = 1,44 L. O valor mais aproximado na lista é 1,4 litro. 1,2 fica aquém. 12,9 seria esquecer um zero na passagem para litro.',
    atalhoPt: 'Segundos das 6 h ÷ 3 = gotas. Gotas × 0,2 mL ÷ 1 000 = litros. Aproxime.',
    outroCaminhoPt:
      'Em uma hora: 3 600/3 = 1 200 gotas × 0,2 mL = 240 mL = 0,24 L. Em seis horas: 1,44 L. Quebrar por hora deixa o 0,24 visível e a multiplicação por 6 no final.',
    dicaVidaRealPt: 'Gota parece nada até o relógio multiplicar. Segundo, mililitro e litro são três idiomas. A conta só fecha quando os três concordam.',
  },
  {
    ano: 2013,
    questao: 163,
    grau: 5,
    temaId: 'enem_razoes_escalas',
    correta: 'C',
    enunciadoMarkdown:
      'Nos Estados Unidos a unidade de medida de volume mais utilizada em latas de refrigerante é a onça fluida (fl oz), que equivale a aproximadamente 2,95 centilitros (cL). Sabe-se que o centilitro é a centésima parte do litro e que a lata de refrigerante usualmente comercializada no Brasil tem capacidade de 355 mL.\n\nAssim, a medida do volume da lata de refrigerante de 355 mL, em onça fluida (fl oz), é mais próxima de',
    alternativas: {
      A: { rotulo: '0,83.', valorNumerico: 0.83, diagnosticoPt: 'A divisão foi invertida, ou o mililitro foi tratado como litro. Onça fluida é menor que a lata, então o número de onças passa de um.', tagErro: 'proporcao_invertida' },
      B: { rotulo: '1,20.', valorNumerico: 1.2, diagnosticoPt: 'Quase uma onça e pouco não cabe numa lata de 355 mL. A ponte do centilitro ficou curta.', tagErro: 'unidade_escala' },
      C: { rotulo: '12,03.', valorNumerico: 12.03, diagnosticoPt: 'A lata em centilitros, dividida pelos centilitros de uma onça fluida.' },
      D: { rotulo: '104,73.', valorNumerico: 104.73, diagnosticoPt: 'O 2,95 multiplicou em vez de dividir, ou o mililitro não desceu até o centilitro certo.', tagErro: 'proporcao_invertida' },
      E: { rotulo: '120,34.', valorNumerico: 120.34, diagnosticoPt: '355 dividido por 2,95 sem converter mL em cL. Centilitro não é mililitro: um centilitro tem dez mililitros.', tagErro: 'unidade_escala' },
    },
    dicas: [
      'Três nomes para volume: mililitro, centilitro, onça fluida. A onça está dada em centilitros. A lata está em mililitros. O encontro é no centilitro.',
      'Resumo de boteco: um litro tem 100 cL e 1 000 mL, então 1 cL = 10 mL. Passe os 355 mL para cL. Uma onça vale cerca de 2,95 cL. O número de onças é a lata dividida por uma onça. "Mais próxima" autoriza o arredondamento da divisão.',
      'Primeiro passo: 355 mL ÷ 10 = centilitros. Armadilha: dividir 355 direto por 2,95, como se mililitro e centilitro fossem o mesmo copo. Dá um número dez vezes maior.',
    ],
    solucaoCompletaPt:
      '355 mL = 35,5 cL, porque cada centilitro tem 10 mL. Uma onça fluida ≈ 2,95 cL. Número de onças: 35,5 / 2,95. 2,95 × 12 = 35,4, então 35,5 / 2,95 ≈ 12,03. A opção mais próxima é 12,03 fl oz. Dividir 355 por 2,95 sem o fator 10 produz cerca de 120, que está na lista para quem ignora que cL não é mL.',
    atalhoPt: 'mL para cL é dividir por 10. Depois divida pelos 2,95 cL de uma onça.',
    outroCaminhoPt:
      '2,95 cL = 29,5 mL. 355 / 29,5 ≈ 12,03. A mesma divisão, agora com a onça traduzida para mililitro. Os dois caminhos precisam concordar; se não concordam, a casa decimal mudou de nome.',
    dicaVidaRealPt: 'Unidade importada não dispensa a ponte. Centi é cem no litro, mili é mil. O fator dez entre eles é o erro mais barato de cometer e o mais fácil de conferir.',
  },
  {
    ano: 2013,
    questao: 164,
    grau: 6,
    temaId: 'enem_funcoes_sequencias',
    correta: 'B',
    enunciadoMarkdown:
      'Na aferição de um novo semáforo, os tempos são ajustados de modo que, em cada ciclo completo (verde-amarelo-vermelho), a luz amarela permaneça acesa por 5 segundos, e o tempo em que a luz verde permaneça acesa seja igual a $\\dfrac{2}{3}$ do tempo em que a luz vermelha fique acesa. A luz verde fica acesa, em cada ciclo, durante $X$ segundos e cada ciclo dura $Y$ segundos.\n\nQual é a expressão que representa a relação entre $X$ e $Y$?',
    alternativas: {
      A: { rotulo: '$5X - 3Y + 15 = 0$', diagnosticoPt: 'O vermelho ficou com o coeficiente trocado. Se o verde é 2/3 do vermelho, o vermelho é 3/2 do verde, não 3 vezes alguma outra coisa solta.', tagErro: 'proporcao_invertida' },
      B: { rotulo: '$5X - 2Y + 10 = 0$', diagnosticoPt: 'O ciclo é verde mais amarelo mais vermelho. O vermelho se escreve em função do verde, e o amarelo é os 5 segundos fixos.' },
      C: { rotulo: '$3X - 3Y + 15 = 0$', diagnosticoPt: 'Os coeficientes do verde e do ciclo ficaram iguais. A fração 2/3 precisa aparecer na álgebra, não sumir.', tagErro: 'calculo_aritmetico' },
      D: { rotulo: '$3X - 2Y + 15 = 0$', diagnosticoPt: 'O 15 guarda o amarelo com o denominador errado. Ao limpar a fração, o 5 segundos também é multiplicado.', tagErro: 'sinal_precedencia' },
      E: { rotulo: '$3X - 2Y + 10 = 0$', diagnosticoPt: 'Perto da limpeza da equação, mas o amarelo de 5 segundos não gerou esse termo constante. Multiplique a equação inteira pelo mesmo número.', tagErro: 'calculo_aritmetico' },
    },
    dicas: [
      'O ciclo Y é a soma de três luzes. Uma você conhece em segundos: o amarelo. O verde é X. O vermelho não tem letra própria: ele se escreve a partir de X, porque o verde é uma fração dele.',
      'Resumo de boteco: se o verde é 2/3 do vermelho, o vermelho é 3/2 do verde. Desenhe a barra do ciclo: um pedaço X, um pedaço de 5, um pedaço de 3/2 X. Essa soma é Y. Depois limpe a fração multiplicando todo mundo por 2, para a equação ficar inteira como nas opções.',
      'Primeiro passo: escreva Y = X + 5 + vermelho, e troque o vermelho por 3X/2. Armadilha: usar o vermelho como 2/3 de X, invertendo quem é fração de quem. O texto diz que o verde é fração do vermelho, não o contrário.',
    ],
    solucaoCompletaPt:
      'Verde = X = (2/3) do vermelho, então vermelho = (3/2)X. Amarelo = 5. Y = X + 5 + (3/2)X = (5/2)X + 5. Multiplique por 2: 2Y = 5X + 10, ou 5X − 2Y + 10 = 0. Inverter a fração produziria o vermelho curto demais e outra equação. O 15 nas opções nasce quando o 5 é multiplicado por 3 em vez de por 2.',
    atalhoPt: 'Y = X + 5 + (3/2)X. Multiplique por 2 e arrume todos os termos de um lado.',
    outroCaminhoPt:
      'Em meios: o verde são 2 metades, o vermelho são 3 metades do mesmo tamanho, o amarelo são 10 metades de segundo se a unidade for meio segundo... mais simples ficar na multiplicação por 2 da equação Y − 5 = (5/2)X. Os dois lados vezes 2 dão 2Y − 10 = 5X.',
    dicaVidaRealPt: 'Semáforo é uma soma com uma frase de proporção no meio. Traduza a proporção para a letra que falta antes de somar. Fração invertida acende a luz errada.',
  },
  {
    ano: 2013,
    questao: 165,
    grau: 7,
    temaId: 'enem_funcoes_sequencias',
    correta: 'D',
    enunciadoMarkdown:
      'A temperatura $T$ de um forno, em graus centígrados, é reduzida por um sistema a partir do instante de seu desligamento ($t = 0$) e varia de acordo com a expressão $T(t) = -\\dfrac{t^{2}}{4} + 400$, com $t$ em minutos. Por motivos de segurança, a trava do forno só é liberada para abertura quando o forno atinge a temperatura de 39 °C.\n\nQual o tempo mínimo de espera, em minutos, após se desligar o forno, para que a porta possa ser aberta?',
    alternativas: {
      A: { rotulo: '19,0.', valorNumerico: 19, diagnosticoPt: 'A raiz foi cortada pela metade, ou o 4 do denominador entrou uma vez a mais na hora de isolar t.', tagErro: 'calculo_aritmetico' },
      B: { rotulo: '19,8.', valorNumerico: 19.8, diagnosticoPt: 'Um arredondamento no meio da raiz. A equação, depois de isolada, pede um quadrado perfeito.', tagErro: 'calculo_aritmetico' },
      C: { rotulo: '20,0.', valorNumerico: 20, diagnosticoPt: 'Vinte é um chute redondo perto da resposta. Isole t² e confira se o número que sobra é um quadrado exato.', tagErro: 'calculo_aritmetico' },
      D: { rotulo: '38,0.', valorNumerico: 38, diagnosticoPt: 'A temperatura 39 fecha a equação num quadrado perfeito. O tempo é a raiz positiva.' },
      E: { rotulo: '39,0.', valorNumerico: 39, diagnosticoPt: '39 é a temperatura da trava, não o tempo. A incógnita é t, em minutos. O 39 entra no lugar de T.', tagErro: 'leitura_interpretacao' },
    },
    dicas: [
      'A porta abre quando T vale 39. Não quando t vale 39. Substitua a temperatura na fórmula e resolva para o tempo. Tempo negativo não existe nessa espera: a raiz que serve é a positiva.',
      'Resumo de boteco: a fórmula é 400 menos um quarto do quadrado do tempo. Quando a temperatura chega em 39, o que foi perdido desde 400 é 400 − 39. Esse perdido é t²/4. Desenhe: isole o quadrado, multiplique por 4, extraia a raiz.',
      'Primeiro passo: escreva 39 = 400 − t²/4. Armadilha: achar que o tempo é 39 porque a temperatura é 39. Outra: esquecer de multiplicar por 4 antes da raiz, e ficar com a metade do tempo.',
    ],
    solucaoCompletaPt:
      '39 = −t²/4 + 400. Então t²/4 = 400 − 39 = 361. t² = 361 × 4 = 1 444. t = 38, porque 38 × 38 = 1 444 e o tempo de espera não é negativo. 19 seria a raiz de 361, esquecendo o fator 4. 39 seria ler a temperatura como se fosse o relógio.',
    atalhoPt: 't²/4 = 400 − 39. Multiplique por 4 e tire a raiz positiva.',
    outroCaminhoPt:
      '361 = 19². Então t² = 4 × 19², e t = 2 × 19 = 38. Ver o 361 como quadrado evita armar a raiz de 1 444 no escuro: o 4 de fora vira o 2 que multiplica o 19.',
    dicaVidaRealPt: 'Equação do segundo grau que descreve esfriamento pede a raiz positiva. A temperatura e o tempo usam a mesma fórmula e não são o mesmo número. Trocar o nome da incógnita abre o forno quente.',
  },
  {
    ano: 2013,
    questao: 166,
    grau: 7,
    temaId: 'enem_aritmetica_ciclos',
    correta: 'A',
    enunciadoMarkdown:
      'O ciclo de atividade magnética do Sol tem um período de 11 anos. O início do primeiro ciclo registrado se deu no começo de 1755 e se estendeu até o final de 1765. Desde então, todos os ciclos de atividade magnética do Sol têm sido registrados.\n\nNo ano de 2101, o Sol estará no ciclo de atividade magnética de número',
    alternativas: {
      A: { rotulo: '32.', valorNumerico: 32, diagnosticoPt: 'Conte quantos passos de 11 anos separam o começo de 1755 do ano pedido, e lembre que o primeiro ciclo já é o número 1.' },
      B: { rotulo: '34.', valorNumerico: 34, diagnosticoPt: 'Dois ciclos a mais do que a divisão indica. O primeiro ciclo não é o zero: ele já ocupou 1755.', tagErro: 'leitura_interpretacao' },
      C: { rotulo: '33.', valorNumerico: 33, diagnosticoPt: 'Um ciclo a mais. Isso acontece quando o ano inicial é contado como ciclo 0, ou quando a sobra da divisão vira um ciclo extra sem necessidade.', tagErro: 'calculo_aritmetico' },
      D: { rotulo: '35.', valorNumerico: 35, diagnosticoPt: 'A diferença de anos foi dividida por 11 e ainda somada demais. Escreva o ano em que o ciclo n começa, e veja em qual intervalo 2101 cai.', tagErro: 'calculo_aritmetico' },
      E: { rotulo: '31.', valorNumerico: 31, diagnosticoPt: 'Esse é o número de passos completos, não o número do ciclo. O ciclo 1 já existia antes desses passos.', tagErro: 'leitura_interpretacao' },
    },
    dicas: [
      'O ciclo 1 começa em 1755 e dura 11 anos. O ciclo seguinte começa 11 anos depois do início anterior, não "no ano 11" solto. 2101 precisa cair dentro de algum desses intervalos.',
      'Resumo de boteco: o começo do ciclo de número n é 1755 mais (n − 1) vezes 11. O "menos um" existe porque o primeiro ciclo não espera 11 anos para nascer: ele nasce em 1755. Descubra o maior n cujo começo ainda é menor ou igual a 2101, e confira se 2101 não invadiu o ciclo seguinte.',
      'Primeiro passo: calcule 2101 − 1755. Divida por 11 e olhe o quociente e a sobra. Armadilha: chamar o quociente de número do ciclo. O quociente conta os passos depois do ciclo 1. O número do ciclo é esse quociente mais um, se a sobra mostrar que você já entrou no ciclo novo.',
    ],
    solucaoCompletaPt:
      'Do início de 1755 até 2101 há 2101 − 1755 = 346 anos. 346 / 11 = 31 ciclos inteiros de 11 anos, com sobra 346 − 31×11 = 346 − 341 = 5 anos. O ciclo 1 começa em 1755. Depois de 31 intervalos, começa o ciclo 32, no ano 1755 + 31×11 = 2096. Ele segue até 2106. O ano 2101 está cinco anos depois de 2096, ainda dentro do ciclo 32. O 31 é só a quantidade de saltos. O ciclo tem nome 32.',
    atalhoPt: 'Ano inicial do ciclo n = 1755 + (n−1)×11. Ache n tal que esse início seja ≤ 2101 e o próximo início seja > 2101.',
    outroCaminhoPt:
      '1755 + 31×11 = 2096, começo do ciclo 32. 1755 + 32×11 = 2107, começo do ciclo 33. 2101 está entre 2096 e 2106. Intervalo fechado na esquerda e aberto na direita: é o ciclo 32.',
    dicaVidaRealPt: 'Contar ciclos é como contar andares. O térreo já é um andar. A divisão diz quantas escadas você subiu; o número do andar soma o térreo.',
  },
  {
    ano: 2014,
    questao: 138,
    grau: 5,
    temaId: 'enem_porcentagem_financeira',
    correta: 'C',
    enunciadoMarkdown:
      'Uma ponte precisa ser dimensionada de forma que possa ter três pontos de sustentação. Sabe-se que a carga máxima suportada pela ponte será de 12 t. O ponto de sustentação central receberá 60% da carga da ponte, e o restante da carga será distribuído igualmente entre os outros dois pontos de sustentação.\n\nNo caso de carga máxima, as cargas recebidas pelos três pontos de sustentação serão, respectivamente,',
    alternativas: {
      A: { rotulo: '1,8 t; 8,4 t; 1,8 t.', diagnosticoPt: 'O miolo ficou pesado demais e as pontas leves demais. 60% de 12 não é 8,4.', tagErro: 'porcentagem_base' },
      B: { rotulo: '3,0 t; 6,0 t; 3,0 t.', diagnosticoPt: 'Isso reparte em 25%, 50%, 25%. O texto pediu 60% no centro, não a metade.', tagErro: 'leitura_interpretacao' },
      C: { rotulo: '2,4 t; 7,2 t; 2,4 t.', diagnosticoPt: 'Sessenta por cento no centro. Os quarenta que sobram se partem em dois apoios iguais.' },
      D: { rotulo: '3,6 t; 4,8 t; 3,6 t.', diagnosticoPt: 'O centro ficou com menos que 60%. Confira 60% de 12 antes de repartir o resto.', tagErro: 'porcentagem_base' },
      E: { rotulo: '4,2 t; 3,6 t; 4,2 t.', diagnosticoPt: 'A carga maior foi parar nas pontas. O texto dá o maior pedaço ao ponto central.', tagErro: 'leitura_interpretacao' },
    },
    dicas: [
      'Três apoios, uma carga de 12 t. O do meio leva 60%. O que sobra, 40%, se divide em dois apoios iguais. A ordem da resposta é apoio, centro, apoio.',
      'Resumo de boteco: desenhe a ponte com três pilares. No pilar do meio, escreva 60% de 12. Nos dois da beirada, escreva a mesma coisa: metade do que sobrou. Some os três no final: tem de voltar 12. Se não voltar, a porcentagem escorregou.',
      'Primeiro passo: 60% de 12. Armadilha: dar 60% para cada ponta, ou partir 12 em três partes iguais. O centro é privilegiado de propósito. As pontas dividem o resto, não a ponte inteira.',
    ],
    solucaoCompletaPt:
      'Centro: 0,60 × 12 = 7,2 t. Resta 12 − 7,2 = 4,8 t, ou 40% de 12. Cada lateral: 4,8 / 2 = 2,4 t. Na ordem apoio, centro, apoio: 2,4 t; 7,2 t; 2,4 t. Conferência: 2,4 + 7,2 + 2,4 = 12. A ponte devolve o que recebeu.',
    atalhoPt: 'Centro = 60% de 12. Cada ponta = metade dos 40% restantes.',
    outroCaminhoPt: '12 × 0,4 = 4,8 para as duas pontas juntas, 2,4 cada. O centro é o complemento até 12, que é 7,2. Começar pelo resto evita multiplicar 0,6 se a conta de 40% estiver mais clara.',
    dicaVidaRealPt: 'Porcentagem de uma carga, mais o resto repartido, tem de fechar a carga. A soma dos apoios é a prova dos nove da ponte.',
  },
  {
    ano: 2014,
    questao: 144,
    grau: 5,
    temaId: 'enem_aritmetica_ciclos',
    correta: 'B',
    enunciadoMarkdown:
      'Um show especial de Natal teve 45 000 ingressos vendidos. Esse evento ocorrerá em um estádio que disponibilizará 5 portões de entrada, com 4 catracas eletrônicas por portão. Em cada uma dessas catracas, passará uma única pessoa a cada 2 segundos. O público foi igualmente dividido pela quantidade de portões e catracas. Suponha que todos os que compraram ingressos irão ao show e passarão pelas catracas indicadas.\n\nQual é o tempo mínimo para que todos passem pelas catracas?',
    alternativas: {
      A: { rotulo: '1 hora.', valorNumerico: 60, diagnosticoPt: 'Faltou um quarto de hora. Confira pessoas por catraca vezes 2 segundos, e só então passe para hora.', tagErro: 'calculo_aritmetico' },
      B: { rotulo: '1 hora e 15 minutos.', valorNumerico: 75, diagnosticoPt: 'O público se reparte pelas catracas. O tempo é o da fila de uma catraca, porque elas trabalham juntas.' },
      C: { rotulo: '5 horas.', valorNumerico: 300, diagnosticoPt: 'O 5 dos portões entrou no tempo. Com as catracas em paralelo, o tempo não se multiplica pelo número de portões.', tagErro: 'proporcao_invertida' },
      D: { rotulo: '6 horas.', valorNumerico: 360, diagnosticoPt: 'A fila foi tratada como se uma catraca só desse conta de gente demais, ou os 2 segundos viraram outra unidade.', tagErro: 'calculo_aritmetico' },
      E: { rotulo: '6 horas e 15 minutos.', valorNumerico: 375, diagnosticoPt: 'As catracas foram somadas no tempo em vez de dividirem a fila. Paralelo encurta a espera.', tagErro: 'proporcao_invertida' },
    },
    dicas: [
      'As catracas funcionam ao mesmo tempo. O tempo mínimo é o tempo da fila mais longa, e o público foi dividido igualmente, então todas as filas duram o mesmo.',
      'Resumo de boteco: conte as catracas: portões vezes catracas por portão. Divida os 45 000 por esse número. Cada pessoa dessa fila gasta 2 segundos. Passe os segundos para minutos e os minutos para horas.',
      'Primeiro passo: 5 × 4 catracas. Armadilha: multiplicar o tempo pelos portões, como se o público inteiro passasse num portão só e os outros esperassem. Dividir gente é o que o paralelo faz.',
    ],
    solucaoCompletaPt:
      'Catracas: 5 × 4 = 20. Pessoas por catraca: 45 000 / 20 = 2 250. Tempo: 2 250 × 2 = 4 500 segundos. 4 500 / 60 = 75 minutos = 1 hora e 15 minutos. Uma hora seria 3 600 segundos, fila curta demais. Cinco horas seria esquecer que vinte catracas trabalham juntas.',
    atalhoPt: 'Pessoas por catraca = ingressos ÷ (portões × catracas). Tempo = essa fila × 2 segundos.',
    outroCaminhoPt:
      'Uma catraca passa 30 pessoas por minuto, porque 60/2 = 30. Vinte catracas passam 600 pessoas por minuto. 45 000 / 600 = 75 minutos. O ritmo por minuto evita a montanha de segundos.',
    dicaVidaRealPt: 'Serviço em paralelo divide a fila, não multiplica o relógio. Mais catraca, menos tempo. Somar portões no cronômetro é fazer o público entrar duas vezes.',
  },
  {
    ano: 2014,
    questao: 147,
    grau: 5,
    temaId: 'enem_porcentagem_financeira',
    correta: 'B',
    enunciadoMarkdown:
      'Uma organização não governamental divulgou um levantamento sobre saneamento básico em algumas cidades. Os resultados indicam que somente 36% do esgoto gerado nessas cidades é tratado, o que mostra que 8 bilhões de litros de esgoto sem nenhum tratamento são lançados todos os dias nas águas.\n\nUma campanha tem como meta reduzir a quantidade de esgoto lançado nas águas diariamente, sem tratamento, para 4 bilhões de litros. Se o volume de esgoto gerado permanecer o mesmo e a meta se concretizar, o percentual de esgoto tratado passará a ser',
    alternativas: {
      A: { rotulo: '72%.', valorNumerico: 72, diagnosticoPt: 'Dobrar os 36% trata o problema como se o esgoto sem tratamento tivesse sido a metade do total. Ele é mais do que a metade.', tagErro: 'porcentagem_base' },
      B: { rotulo: '68%.', valorNumerico: 68, diagnosticoPt: 'O total de esgoto não muda. Cai pela metade o que segue sem tratamento. O tratado é o que sobra desse total.' },
      C: { rotulo: '64%.', valorNumerico: 64, diagnosticoPt: 'Cem menos 36 é o percentual sem tratamento hoje, não o percentual tratado depois da meta.', tagErro: 'leitura_interpretacao' },
      D: { rotulo: '54%.', valorNumerico: 54, diagnosticoPt: 'Uma soma de 36 com alguma metade. O tratado novo é o total menos os 4 bilhões, em percentual do mesmo total.', tagErro: 'porcentagem_base' },
      E: { rotulo: '18%.', valorNumerico: 18, diagnosticoPt: 'Metade de 36. A meta corta pela metade o esgoto cru, não o percentual que já era tratado.', tagErro: 'leitura_interpretacao' },
    },
    dicas: [
      'O volume gerado fica parado. Hoje, 36% é tratado e o resto, 8 bilhões de litros, não é. A meta mexe só nessa sobra: ela cai para 4 bilhões. O percentual novo é o tratado novo dividido pelo mesmo total.',
      'Resumo de boteco: se 8 bilhões são a parte não tratada, e essa parte é o que falta para 100% a partir dos 36%, você descobre o esgoto total. Desenhe a barra. Pinte 36%. O pedaço branco vale 8 bilhões. A meta corta o branco pela metade. O que foi cortado do branco passa para o pintado. Aí meça de novo a parte pintada.',
      'Primeiro passo: o não tratado é 100% − 36%. Armadilha: responder o dobro de 36, como se metade do cru dobrasse o percentual tratado. Só dobra se o cru fosse exatamente metade do total. Aqui o cru é maior do que a metade.',
    ],
    solucaoCompletaPt:
      'Sem tratamento hoje: 100% − 36% = 64% do total, e isso vale 8 bilhões de litros. Total: 8 / 0,64 = 12,5 bilhões de litros. Tratado hoje: 12,5 − 8 = 4,5 bilhões, que é 36% de 12,5. Com a meta, sem tratamento ficam 4 bilhões, então tratado = 12,5 − 4 = 8,5 bilhões. Percentual: 8,5 / 12,5 = 0,68 = 68%. Os 4 bilhões que deixaram de ir cru para o rio passaram a ser tratados. Por isso 36% não vira 72%: a base não era meio a meio.',
    atalhoPt: 'Total = 8 bilhões ÷ 64%. Tratado novo = total − 4 bilhões. Percentual = tratado novo ÷ total.',
    outroCaminhoPt:
      'Cortar 4 bilhões do cru é acrescentar 4 bilhões ao tratado. Tratado novo = 4,5 + 4 = 8,5, no mesmo total de 12,5. 8,5 ÷ 12,5 = 68/100. A soma 4,5 + 4 deixa o caminho do "o que mudou de coluna" explícito.',
    dicaVidaRealPt: 'Percentual tratado mora no total gerado, não no número que a manchete grita. Se o cru cai e o total fica parado, o tratado sobe o que o cru desceu. A porcentagem nova pede o total de volta.',
  },
]

export const ENEM_MATEMATICA_LOTE4: readonly DesafioUnificado[] = SPECS.map(construirDesafioEnem)
