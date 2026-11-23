/**
 * Lote 3 — matematica do caderno 5 amarelo, anos 2011, 2015, 2016 e 2021.
 * Letras conferidas com o indice lido dos PDFs oficiais. Dicas nao entregam o valor final.
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
    ano: 2011,
    questao: 143,
    grau: 5,
    temaId: 'enem_razoes_escalas',
    correta: 'E',
    enunciadoMarkdown:
      'Sabe-se que a distância real, em linha reta, de uma cidade A, localizada no estado de São Paulo, a uma cidade B, localizada no estado de Alagoas, é igual a 2 000 km. Um estudante, ao analisar um mapa, verificou com sua régua que a distância entre essas duas cidades, A e B, era 8 cm.\n\nOs dados nos indicam que o mapa observado pelo estudante está na escala de',
    alternativas: {
      A: { rotulo: '1 : 250.', valorNumerico: 250, diagnosticoPt: 'Faltaram casas na passagem de quilômetro para centímetro. A régua e a estrada precisam falar o mesmo idioma.', tagErro: 'unidade_escala' },
      B: { rotulo: '1 : 2 500.', valorNumerico: 2500, diagnosticoPt: 'Ainda faltam zeros. 2 000 km não são 2 000 cm, nem 2 000 m.', tagErro: 'unidade_escala' },
      C: { rotulo: '1 : 25 000.', valorNumerico: 25000, diagnosticoPt: 'Você parou em metros, ou comeu um grupo de três zeros. Do quilômetro ao centímetro são cinco saltos de dez, não três.', tagErro: 'unidade_escala' },
      D: { rotulo: '1 : 250 000.', valorNumerico: 250000, diagnosticoPt: 'Quase: sobrou um fator de cem, o que separa o metro do centímetro, ou o contrário.', tagErro: 'unidade_escala' },
      E: { rotulo: '1 : 25 000 000.', valorNumerico: 25000000, diagnosticoPt: 'Oito centímetros no papel cobrem dois mil quilômetros no chão, já escritos em centímetros.' },
    },
    dicas: [
      'Escala 1 : N significa que 1 cm no mapa vale N cm no mundo. Os dois lados da régua precisam estar na mesma unidade antes da divisão.',
      'Resumo de boteco: desenhe a régua de 8 cm de um lado e a estrada de 2 000 km do outro. Embaixo da estrada, vá descendo a escada: km vira m, m vira cm. Cada degrau multiplica por mil ou por cem, e você não pode pular degrau.',
      'Primeiro passo: escreva 2 000 km em centímetros e divida por 8. Armadilha: dividir 2 000 por 8 e ir colocando zero no olho. O zero nasce da unidade, não do humor.',
    ],
    solucaoCompletaPt:
      '2 000 km = 2 000 × 1 000 m = 2 000 000 m = 2 000 000 × 100 cm = 200 000 000 cm. No mapa isso mede 8 cm. A escala é 8 : 200 000 000 = 1 : 25 000 000. Cada centímetro do papel carrega 250 km de estrada. Por isso o mapa cabe na carteira e a viagem não.',
    atalhoPt: 'Passe os 2 000 km para cm (×100 000) e divida pelos 8 cm da régua.',
    outroCaminhoPt:
      '1 km = 100 000 cm. Então 2 000 km = 200 000 000 cm. 200 000 000 / 8 = 25 000 000. O 1 da escala é o 1 cm que sobrou depois de simplificar os 8.',
    dicaVidaRealPt: 'Mapa é uma fração disfarçada de desenho. Quem erra a unidade não erra a conta: erra o tamanho do país.',
  },
  {
    ano: 2011,
    questao: 145,
    grau: 5,
    temaId: 'enem_razoes_escalas',
    correta: 'E',
    enunciadoMarkdown:
      'O consumo de café no Brasil atingiu o maior nível da história no ano passado: os brasileiros beberam o equivalente a 331 bilhões de xícaras.\n\nConsidere que a xícara citada na notícia seja equivalente a, aproximadamente, 120 mL de café. Suponha que em 2010 os brasileiros bebam ainda mais café, aumentando o consumo em $\\dfrac{1}{5}$ do que foi consumido no ano anterior.\n\nDe acordo com essas informações, qual a previsão mais aproximada para o consumo de café em 2010?',
    alternativas: {
      A: { rotulo: '8 bilhões de litros.', valorNumerico: 8, diagnosticoPt: 'A vírgula do mililitro andou demais, ou o aumento de um quinto foi tratado como se fosse o consumo inteiro.', tagErro: 'unidade_escala' },
      B: { rotulo: '16 bilhões de litros.', valorNumerico: 16, diagnosticoPt: 'Ficou na metade do caminho entre xícara e litro, ou aplicou o aumento sobre um volume já cortado.', tagErro: 'unidade_escala' },
      C: { rotulo: '32 bilhões de litros.', valorNumerico: 32, diagnosticoPt: 'Perto do volume do ano anterior, mas ainda sem o quinto a mais, ou com uma casa decimal tímida.', tagErro: 'calculo_aritmetico' },
      D: { rotulo: '40 bilhões de litros.', valorNumerico: 40, diagnosticoPt: 'Isso é o ano anterior, arredondado. A pergunta pede 2010, que bebe um quinto a mais.', tagErro: 'leitura_interpretacao' },
      E: { rotulo: '48 bilhões de litros.', valorNumerico: 48, diagnosticoPt: 'O ano anterior, em litros, cresce um quinto. Aproximar 331 × 120 mL para 40 bilhões de litros e multiplicar por 6/5 fecha a previsão.' },
    },
    dicas: [
      'São dois movimentos. Primeiro traduza xícara para litro. Depois aumente esse volume em um quinto. A pergunta é sobre 2010, não sobre o ano da notícia.',
      'Resumo de boteco: 1 litro são 1 000 mL. Uma xícara de 120 mL é uma fatia pequena de litro. Bilhão de xícaras vira bilhão de litros quando você multiplica por 120 e divide por 1 000. O aumento de um quinto não soma 1/5 de litro: multiplica o total por 1 + 1/5.',
      'Primeiro passo: ache o volume do ano anterior e só então multiplique por 6/5. Armadilha: entregar o volume antigo, que está entre as opções, como se o aumento fosse enfeite de texto.',
    ],
    solucaoCompletaPt:
      '331 bilhões de xícaras × 120 mL = 39 720 bilhões de mL = 39,72 bilhões de litros, porque cada litro tem 1 000 mL. A previsão mais aproximada desse ano é 40 bilhões de litros. Em 2010 o consumo sobe 1/5, então fica 40 × 6/5 = 48 bilhões de litros. O 40 está na lista para quem esquece o quinto. O universo cobrou as duas frases, não só a primeira.',
    atalhoPt: 'Xícaras × 120 / 1 000 dá litros. Aproxime. Multiplique por 6/5.',
    outroCaminhoPt:
      '120 mL = 0,12 L. 331 × 0,12 = 39,72 bilhões de litros. 39,72 × 1,2 = 47,664, que a prova chama de 48 bilhões. O "aproximadamente" do enunciado autoriza o arredondamento para 40 antes do quinto.',
    dicaVidaRealPt: 'Notícia em xícara e conta em litro são a mesma água em dois copos. O aumento percentual só entra depois que os copos têm o mesmo nome.',
  },
  {
    ano: 2011,
    questao: 147,
    grau: 5,
    temaId: 'enem_razoes_escalas',
    correta: 'C',
    enunciadoMarkdown:
      'Para uma atividade realizada no laboratório de Matemática, um aluno precisa construir uma maquete da quadra de esportes da escola que tem 28 m de comprimento por 12 m de largura. A maquete deverá ser construída na escala de 1 : 250.\n\nQue medidas de comprimento e largura, em cm, o aluno utilizará na construção da maquete?',
    alternativas: {
      A: { rotulo: '4,8 e 11,2', diagnosticoPt: 'Os dois números estão certos, na ordem trocada. A pergunta pede comprimento e largura, nessa ordem: 28 m primeiro, 12 m depois.', tagErro: 'leitura_interpretacao' },
      B: { rotulo: '7,0 e 3,0', diagnosticoPt: 'Aqui a escala foi tratada como se 1 cm valesse 4 m, ou os metros foram divididos por um fator que não é 250 em centímetros.', tagErro: 'unidade_escala' },
      C: { rotulo: '11,2 e 4,8', diagnosticoPt: 'Comprimento e largura, em centímetros, depois de dividir a quadra real pela escala.' },
      D: { rotulo: '28,0 e 12,0', diagnosticoPt: 'Esses são os metros da quadra, copiados como se já fossem centímetros da maquete. A escala ainda não trabalhou.', tagErro: 'unidade_escala' },
      E: { rotulo: '30,0 e 70,0', diagnosticoPt: 'Multiplicou em vez de dividir, ou misturou 250 com outro fator. Maquete é a quadra encolhida, não esticada.', tagErro: 'proporcao_invertida' },
    },
    dicas: [
      'A resposta pede centímetros, e a quadra está em metros. A escala 1 : 250 diz que 1 cm da maquete vale 250 cm da escola, não 250 m.',
      'Resumo de boteco: passe os 28 m e os 12 m para centímetros. Aí divida cada um por 250. Desenhe o retângulo grande e, do lado, o retângulo de papel, com a mesma ordem: lado maior primeiro.',
      'Primeiro passo: 1 m = 100 cm. Armadilha: dividir 28 por 250 e chamar o resultado de centímetro, pulando o metro. Outra: entregar os dois números na ordem invertida. A frase pede comprimento e largura, nessa sequência.',
    ],
    solucaoCompletaPt:
      '28 m = 2 800 cm. Na escala 1 : 250, o comprimento da maquete é 2 800 / 250 = 11,2 cm. 12 m = 1 200 cm, e 1 200 / 250 = 4,8 cm. A maquete mede 11,2 cm por 4,8 cm. Quem responde 4,8 e 11,2 fez a conta e trocou a fila. A quadra não troca de lado só porque a régua é menor.',
    atalhoPt: 'Metros para centímetros, depois divide por 250. Mantenha a ordem comprimento, largura.',
    outroCaminhoPt:
      '250 cm = 2,5 m. Então 1 cm da maquete vale 2,5 m da quadra. 28 / 2,5 = 11,2 cm e 12 / 2,5 = 4,8 cm. Mesma escala, lida pelo lado do metro.',
    dicaVidaRealPt: 'Escala de maquete é divisão, não cópia. E a ordem dos lados faz parte da resposta: comprimento não é o número que ficou menor.',
  },
  {
    ano: 2011,
    questao: 161,
    grau: 5,
    temaId: 'enem_funcoes_sequencias',
    correta: 'D',
    enunciadoMarkdown:
      'O número mensal de passagens de uma determinada empresa aérea aumentou no ano passado nas seguintes condições: em janeiro foram vendidas 33 000 passagens; em fevereiro, 34 500; em março, 36 000. Esse padrão de crescimento se mantém para os meses subsequentes.\n\nQuantas passagens foram vendidas por essa empresa em julho do ano passado?',
    alternativas: {
      A: { rotulo: '38 000', valorNumerico: 38000, diagnosticoPt: 'O salto mensal não foi respeitado até julho. Conte quantos meses separam janeiro de julho, não quantos nomes cabem na cabeça.', tagErro: 'calculo_aritmetico' },
      B: { rotulo: '40 500', valorNumerico: 40500, diagnosticoPt: 'Faltou um mês na escada. De janeiro a julho o aumento se repete seis vezes, não cinco.', tagErro: 'leitura_interpretacao' },
      C: { rotulo: '41 000', valorNumerico: 41000, diagnosticoPt: 'O acréscimo mensal, lido entre janeiro e fevereiro, não é um número redondo de mil. Use a diferença que a tabela já deu.', tagErro: 'calculo_aritmetico' },
      D: { rotulo: '42 000', valorNumerico: 42000, diagnosticoPt: 'Janeiro é o primeiro termo. Julho é o sétimo. O mesmo acréscimo mensal, repetido seis vezes, chega lá.' },
      E: { rotulo: '48 000', valorNumerico: 48000, diagnosticoPt: 'Sete saltos, ou um acréscimo maior do que o do enunciado. Janeiro já é um mês de venda, não o zero da escada.', tagErro: 'leitura_interpretacao' },
    },
    dicas: [
      'Três meses seguidos bastam para ver se o aumento é sempre o mesmo. Se for, o ano vira uma escada de degraus iguais. Julho é um degrau dessa escada, não uma conta nova.',
      'Resumo de boteco: subtraia fevereiro de janeiro, e março de fevereiro. Se os dois resultados forem irmãos, esse irmão é o degrau. Aí conte, nos dedos, de janeiro até julho: o primeiro mês já está ocupado, então os degraus são um a menos que o número do mês.',
      'Primeiro passo: janeiro é o termo 1, julho é o termo 7. Armadilha: somar o degrau sete vezes, como se janeiro fosse o chão antes da escada. Janeiro já vendeu 33 000.',
    ],
    solucaoCompletaPt:
      'De janeiro para fevereiro: 34 500 − 33 000 = 1 500. De fevereiro para março: 36 000 − 34 500 = 1 500. O padrão é uma progressão de razão 1 500. Julho é o 7º mês, então há 6 razões depois de janeiro: 33 000 + 6 × 1 500 = 33 000 + 9 000 = 42 000 passagens. Cinco razões dariam junho, não julho.',
    atalhoPt: 'Razão = diferença dos meses dados. Termo de julho = janeiro + 6 razões.',
    outroCaminhoPt:
      'A fórmula do termo geral é a_n = 33 000 + (n − 1) × 1 500. Para n = 7, o (n − 1) é 6. O "menos um" é janeiro já contado. Esquecer esse menos um é o voo que passa de julho.',
    dicaVidaRealPt: 'Sequência com passo fixo não pede que você liste o ano inteiro. Pede que você conte os passos. O primeiro termo já é um mês, não o marco zero.',
  },
  {
    ano: 2011,
    questao: 162,
    grau: 7,
    temaId: 'enem_porcentagem_financeira',
    correta: 'C',
    enunciadoMarkdown:
      'Uma pessoa aplicou certa quantia em ações. No primeiro mês, ela perdeu 30% do total do investimento e, no segundo mês, recuperou 20% do que havia perdido. Depois desses dois meses, resolveu tirar o montante de R$ 3 800,00 gerado pela aplicação.\n\nA quantia inicial que essa pessoa aplicou em ações corresponde ao valor de',
    alternativas: {
      A: { rotulo: 'R$ 4 222,22.', valorNumerico: 4222.22, diagnosticoPt: 'A recuperação foi calculada sobre o que restou, não sobre o que tinha sido perdido. O enunciado diz "20% do que havia perdido".', tagErro: 'porcentagem_base' },
      B: { rotulo: 'R$ 4 523,80.', valorNumerico: 4523.8, diagnosticoPt: 'Os 30% e os 20% foram combinados numa taxa única que não é a história. Perda e recuperação têm bases diferentes.', tagErro: 'porcentagem_base' },
      C: { rotulo: 'R$ 5 000,00.', valorNumerico: 5000, diagnosticoPt: 'Sobrou 70% do início. Voltou 20% da perda, que é 6% do início. Os 3 800 são 76% da quantia aplicada.' },
      D: { rotulo: 'R$ 13 300,00.', valorNumerico: 13300, diagnosticoPt: 'Os 3 800 foram tratados como se fossem a perda, ou uma fatia pequena demais do capital.', tagErro: 'leitura_interpretacao' },
      E: { rotulo: 'R$ 17 100,00.', valorNumerico: 17100, diagnosticoPt: 'Aqui 3 800 virou uma porcentagem que o texto não pediu. O montante final é o que ela tirou, não a perda.', tagErro: 'porcentagem_base' },
    },
    dicas: [
      'Duas porcentagens, duas bases. A perda de 30% é do investimento inteiro. A recuperação de 20% é só daquilo que foi perdido, não do que restou e não do valor inicial inteiro.',
      'Resumo de boteco: desenhe uma barra de 100%. Risque 30%. Dos 30% riscados, pinte de volta um quinto, porque 20% é um quinto. O que sobra pintado, mais o que nunca foi riscado, é a fração final. Essa fração, em reais, vale 3 800.',
      'Primeiro passo: escreva o final como uma única porcentagem do começo. Armadilha: recuperar 20% do que restou (os 70%), ou somar −30% com +20% e achar −10%. As bases não são as mesmas, então as taxas não se somam.',
    ],
    solucaoCompletaPt:
      'Seja x a quantia inicial. Depois do primeiro mês restam 0,70x, e a perda foi 0,30x. No segundo mês ela recupera 20% dessa perda: 0,20 × 0,30x = 0,06x. O montante final é 0,70x + 0,06x = 0,76x = 3 800. Então x = 3 800 / 0,76 = 5 000. Confere: de 5 000, perde 1 500 e fica com 3 500; recupera 20% de 1 500, que são 300; 3 500 + 300 = 3 800.',
    atalhoPt: 'Final = 70% do início + 20% dos 30% perdidos. Isso é 76% do início, e vale 3 800.',
    outroCaminhoPt:
      'Em fração: resta 7/10. Volta (1/5) × (3/10) = 3/50 = 0,06. Soma 0,70 + 0,06 = 0,76 = 76/100 = 19/25. x = 3 800 × 25/19. 3 800 / 19 = 200, vezes 25 = 5 000. A fração só evita a divisão por 0,76 no olho.',
    dicaVidaRealPt: 'Porcentagem de porcentagem não se soma. "Recuperei 20% do que perdi" não desfaz 20 dos 30 pontos. Desfaz 20% daquele pedaço, e o pedaço já era só uma parte do bolo.',
  },
  {
    ano: 2011,
    questao: 163,
    grau: 6,
    temaId: 'enem_razoes_escalas',
    correta: 'D',
    enunciadoMarkdown:
      'Muitas medidas podem ser tomadas em nossas casas visando à utilização racional de energia elétrica. Isso deve ser uma atitude diária de cidadania. Uma delas pode ser a redução do tempo no banho. Um chuveiro com potência de 4 800 W consome 4,8 kW por hora.\n\nUma pessoa que toma dois banhos diariamente, de 10 minutos cada, consumirá, em sete dias, quantos kW?',
    alternativas: {
      A: { rotulo: '0,8', valorNumerico: 0.8, diagnosticoPt: 'Entrou só um pedaço de um dia, ou a potência foi dividida demais. São dois banhos por dia, durante sete dias.', tagErro: 'calculo_aritmetico' },
      B: { rotulo: '1,6', valorNumerico: 1.6, diagnosticoPt: 'Isso parece um único dia de dois banhos. A pergunta pede a semana.', tagErro: 'leitura_interpretacao' },
      C: { rotulo: '5,6', valorNumerico: 5.6, diagnosticoPt: 'Ficou pela metade da semana de banhos, ou contou um banho por dia em vez de dois.', tagErro: 'calculo_aritmetico' },
      D: { rotulo: '11,2', valorNumerico: 11.2, diagnosticoPt: 'Vinte minutos por dia, sete dias, com a potência de 4,8 kW. Minuto virou hora antes de multiplicar.' },
      E: { rotulo: '33,6', valorNumerico: 33.6, diagnosticoPt: '4,8 vezes 7 trata cada dia como uma hora inteira de chuveiro. O dia dessa pessoa tem vinte minutos de banho, não sessenta.', tagErro: 'unidade_escala' },
    },
    dicas: [
      'O enunciado chama de kW o que a conta entrega em energia: potência vezes tempo. A potência já está dada, 4,8 kW. O que falta é o tempo, em horas, dos sete dias.',
      'Resumo de boteco: dois banhos de 10 minutos são 20 minutos por dia. Sete dias são sete vezes isso. Uma hora tem 60 minutos, então 20 minutos são uma fração de hora. Desenhe uma hora fatiada em três: vinte minutos é uma dessas fatias.',
      'Primeiro passo: junte a semana inteira numa quantidade só de horas e multiplique por 4,8. Armadilha: multiplicar 4,8 pelos 7 dias como se cada dia fosse uma hora de chuveiro. O chuveiro não fica ligado no almoço.',
    ],
    solucaoCompletaPt:
      'Dois banhos de 10 min dão 20 min por dia. Em 7 dias: 140 min. 140 / 60 = 7/3 horas, porque 20 min são 1/3 de hora e 7 × 1/3 = 7/3. Energia = 4,8 × 7/3 = 33,6 / 3 = 11,2. O 33,6 é a armadilha de quem conta uma hora por dia. O enunciado escreveu "kW", mas o número que fecha a semana é essa conta de potência vezes tempo.',
    atalhoPt: '20 min por dia = 1/3 hora. Vezes 7 dias. Vezes 4,8 kW.',
    outroCaminhoPt:
      'Um banho de 10 min é 1/6 de hora. Dois banhos: 1/3 de hora. 4,8 / 3 = 1,6 por dia. Vezes 7 dias = 11,2. Separar o dia deixa visível o 1,6, que também está nas opções para quem para no primeiro dia.',
    dicaVidaRealPt: 'Potência é o ritmo. Energia é o ritmo vezes o tempo. Minuto na conta de quilowatt é hora disfarçada: 60 minutos, não 100.',
  },
  {
    ano: 2015,
    questao: 149,
    grau: 6,
    temaId: 'enem_probabilidade_contagem',
    correta: 'D',
    enunciadoMarkdown:
      'Em uma escola, a probabilidade de um aluno compreender e falar inglês é de 30%. Três alunos dessa escola, que estão em fase final de seleção de intercâmbio, aguardam, em uma sala, serem chamados para uma entrevista. Mas, ao invés de chamá-los um a um, o entrevistador entra na sala e faz, oralmente, uma pergunta em inglês que pode ser respondida por qualquer um dos alunos.\n\nA probabilidade de o entrevistador ser entendido e ter sua pergunta oralmente respondida em inglês é',
    alternativas: {
      A: { rotulo: '23,7%', valorNumerico: 23.7, diagnosticoPt: 'Esse número nasce de uma conta de "exatamente um" ou de um produto incompleto. A pergunta aceita qualquer um dos três.', tagErro: 'combinatoria_probabilidade' },
      B: { rotulo: '30,0%', valorNumerico: 30, diagnosticoPt: '30% é a chance de um aluno só. Na sala há três, e basta um entender.', tagErro: 'leitura_interpretacao' },
      C: { rotulo: '44,1%', valorNumerico: 44.1, diagnosticoPt: 'Ficou no meio do caminho do complemento, ou misturou "exatamente dois" com o que a pergunta pede.', tagErro: 'combinatoria_probabilidade' },
      D: { rotulo: '65,7%', valorNumerico: 65.7, diagnosticoPt: 'É mais fácil calcular ninguém entender e tirar isso de 100%. O que sobra é pelo menos uma resposta.' },
      E: { rotulo: '90,0%', valorNumerico: 90, diagnosticoPt: 'Três vezes 30% soma chances como se fossem pedaços de uma pizza só. Pessoas independentes não se somam assim.', tagErro: 'combinatoria_probabilidade' },
    },
    dicas: [
      'A pergunta é "pelo menos um dos três entende". Não é "o primeiro", nem "os três", nem "exatamente um". Qualquer boca que responda já salva o entrevistador.',
      'Resumo de boteco: o caminho curto é o fracasso. Chance de um aluno não entender é o que falta para 100% a partir dos 30%. Os três não se influenciam, então os três fracassos se multiplicam. O sucesso da sala é o que sobra quando você tira esse fracasso conjunto de 100%.',
      'Primeiro passo: escreva a chance de um aluno ficar em silêncio. Armadilha: somar 30% três vezes e achar 90%. Soma de probabilidade só serve para casos que não acontecem juntos. Aqui os alunos podem entender ao mesmo tempo, então o "ou" não é uma soma crua.',
    ],
    solucaoCompletaPt:
      'P(um aluno não fala inglês) = 70% = 0,7. Os três independentes ficam mudos com 0,7 × 0,7 × 0,7 = 0,343. A probabilidade de pelo menos um responder é 1 − 0,343 = 0,657 = 65,7%. Somar 0,3 três vezes conta duas vezes os casos em que mais de um entende, e ainda passa de um teto que a sala não tem.',
    atalhoPt: 'Complemento: 1 − (0,7)³. "Pelo menos um" é o contrário de "nenhum".',
    outroCaminhoPt:
      'Some exatamente um, exatamente dois e exatamente três: C(3,1)×0,3×0,7² + C(3,2)×0,3²×0,7 + 0,3³. Dá o mesmo 0,657, com mais chance de errar a combinação. O complemento existe para não fazer essa festa.',
    dicaVidaRealPt: 'Quando basta um sucesso num grupo, calcule o silêncio de todo mundo e vire do avesso. É mais curto e não conta duas vezes quem fala junto.',
  },
  {
    ano: 2015,
    questao: 154,
    grau: 6,
    temaId: 'enem_razoes_escalas',
    correta: 'B',
    enunciadoMarkdown:
      'A expressão "Fórmula de Young" é utilizada para calcular a dose infantil de um medicamento, dada a dose do adulto:\n\n$$\\text{dose da criança} = \\dfrac{\\text{idade da criança (em anos)}}{\\text{idade da criança (em anos)} + 12} \\cdot \\text{dose do adulto}$$\n\nUma enfermeira deve administrar um medicamento X a uma criança inconsciente, cuja dosagem de adulto é de 60 mg. A enfermeira não consegue descobrir a idade da criança, mas identifica que, algumas horas antes, foi administrada a ela uma dose de 14 mg de um medicamento Y, cuja dosagem de adulto é 42 mg. Sabe-se que a dose da medicação Y administrada à criança estava correta.\n\nEntão, a enfermeira deverá ministrar uma dosagem do medicamento X, em miligramas, igual a',
    alternativas: {
      A: { rotulo: '15.', valorNumerico: 15, diagnosticoPt: 'A fração da criança foi arredondada cedo demais, ou 60 foi partido num número de partes que a fórmula não pediu.', tagErro: 'calculo_aritmetico' },
      B: { rotulo: '20.', valorNumerico: 20, diagnosticoPt: 'A idade some no meio. A fração que serviu para o remédio Y é a mesma que serve para o remédio X.' },
      C: { rotulo: '30.', valorNumerico: 30, diagnosticoPt: 'Metade de 60 seria uma criança com a mesma idade do "12" da fórmula, e os 14 mg com 42 mg não dizem isso.', tagErro: 'leitura_interpretacao' },
      D: { rotulo: '36.', valorNumerico: 36, diagnosticoPt: 'Aqui a dose de Y e a dose adulta de X se misturaram sem a fração. Os dois remédios compartilham a idade, não o miligrama.', tagErro: 'proporcao_invertida' },
      E: { rotulo: '40.', valorNumerico: 40, diagnosticoPt: 'Quarenta não é a fração 14 para 42 aplicada em 60. Simplifique a fração antes de atravessar de um remédio para o outro.', tagErro: 'calculo_aritmetico' },
    },
    dicas: [
      'A idade está escondida, mas a fórmula depende da idade do mesmo jeito para qualquer remédio. O remédio Y já foi dado certo. Ele entrega a fração. O remédio X só aplica essa fração na dose adulta dele.',
      'Resumo de boteco: a fórmula é uma fração da dose de adulto. Essa fração é idade / (idade + 12), e a criança é a mesma. Então 14 está para 42 assim como a dose de X está para 60. Você nem precisa descobrir a idade, se não quiser. A proporção já atravessa.',
      'Primeiro passo: escreva 14 / 42 = dose / 60, ou iguale as duas frações idade / (idade + 12). Armadilha: achar a idade e depois usar a dose de Y no lugar da dose de X. Cada remédio tem a sua dose de adulto.',
    ],
    solucaoCompletaPt:
      'Pelo remédio Y: 14 = [idade / (idade + 12)] × 42. Então idade / (idade + 12) = 14/42 = 1/3. Logo idade = (1/3)(idade + 12), 3 × idade = idade + 12, 2 × idade = 12, idade = 6 anos. Para o remédio X: dose = (6 / 18) × 60 = (1/3) × 60 = 20 mg. Sem achar a idade: a fração já é 1/3, e um terço de 60 mg é a dose.',
    atalhoPt: 'A fração da criança é 14/42. Aplique essa mesma fração em 60.',
    outroCaminhoPt:
      '14/42 = 1/3. Se a fórmula vale 1/3, então idade = (idade + 12) / 3, e a idade é 6. O caminho longo só confirma que a fração não foi inventada. A dose não precisa dela escrita em anos.',
    dicaVidaRealPt: 'Quando duas contas usam a mesma chave escondida, a primeira conta entrega a chave e a segunda só gira. Idade, aqui, é a chave. Não é o que a enfermeira precisa anotar.',
  },
  {
    ano: 2015,
    questao: 160,
    grau: 6,
    temaId: 'enem_estatistica_medias',
    correta: 'D',
    enunciadoMarkdown:
      'Em uma seletiva para a final dos 100 metros livres de natação, numa olimpíada, os atletas, em suas respectivas raias, obtiveram os seguintes tempos, em segundo:\n\n- Raia 1: 20,90\n- Raia 2: 20,90\n- Raia 3: 20,50\n- Raia 4: 20,80\n- Raia 5: 20,60\n- Raia 6: 20,60\n- Raia 7: 20,90\n- Raia 8: 20,96\n\nA mediana dos tempos apresentados no quadro é',
    alternativas: {
      A: { rotulo: '20,70.', valorNumerico: 20.7, diagnosticoPt: '20,70 é um meio-termo bonito que não está no centro da fila ordenada. Mediana não inventa número no meio do caminho errado.', tagErro: 'calculo_aritmetico' },
      B: { rotulo: '20,77.', valorNumerico: 20.77, diagnosticoPt: 'Isso puxa para a média de todos, ou para uma média de raias vizinhas. Mediana não usa a raia 1 nem a raia 8, depois de ordenar.', tagErro: 'leitura_interpretacao' },
      C: { rotulo: '20,80.', valorNumerico: 20.8, diagnosticoPt: '20,80 é um dos dois centrais, sozinho. Com oito tempos, a mediana é a ponte entre o quarto e o quinto, não um deles.', tagErro: 'leitura_interpretacao' },
      D: { rotulo: '20,85.', valorNumerico: 20.85, diagnosticoPt: 'Oito tempos: a mediana senta entre o 4º e o 5º da fila ordenada.' },
      E: { rotulo: '20,90.', valorNumerico: 20.9, diagnosticoPt: '20,90 é o tempo que mais aparece, a moda. A pergunta pediu mediana. Repetição não elege o centro.', tagErro: 'leitura_interpretacao' },
    },
    dicas: [
      'Mediana não olha o número da raia. Olha o tempo, do menor para o maior. Oito tempos é quantidade par: não existe um único nadador no centro.',
      'Resumo de boteco: escreva os oito tempos em ordem, como uma fila de largada de verdade. Risque o mais rápido e o mais lento, depois o novo mais rápido e o novo mais lento, até sobrarem dois no meio. A mediana é a média desses dois que se recusaram a sair.',
      'Primeiro passo: ache o 4º e o 5º da fila ordenada. Armadilha: escolher 20,90 porque aparece três vezes. Isso é moda. Outra: parar no 4º tempo e não fazer a média com o 5º.',
    ],
    solucaoCompletaPt:
      'Em ordem: 20,50; 20,60; 20,60; 20,80; 20,90; 20,90; 20,90; 20,96. Com 8 valores, a mediana é a média do 4º e do 5º: (20,80 + 20,90) / 2 = 41,70 / 2 = 20,85. A moda seria 20,90. A mediana não premia quem repetiu o tempo: premia quem ficou no meio da fila.',
    atalhoPt: 'Ordene. Quantidade par: média do 4º com o 5º.',
    outroCaminhoPt:
      'Os dois centrais são 20,80 e 20,90. A distância entre eles é 0,10. A metade dessa distância, somada ao menor dos dois, é o meio. Mesma ponte, sem escrever a fração 41,70.',
    dicaVidaRealPt: 'Em corrida, o tempo que mais se repete não é o tempo típico do meio. Mediana ignora a torcida da moda e olha quem está no centro depois que todo mundo se alinha.',
  },
  {
    ano: 2015,
    questao: 169,
    grau: 5,
    temaId: 'enem_razoes_escalas',
    correta: 'C',
    enunciadoMarkdown:
      'Deseja-se comprar lentes para óculos. As lentes devem ter espessuras mais próximas possíveis da medida 3 mm. No estoque de uma loja, há lentes de espessuras: 3,10 mm; 3,021 mm; 2,96 mm; 2,099 mm e 3,07 mm.\n\nSe as lentes forem adquiridas nessa loja, a espessura escolhida será, em milímetros, de',
    alternativas: {
      A: { rotulo: '2,099.', valorNumerico: 2.099, diagnosticoPt: 'É a mais fina da prateleira, não a mais próxima de 3. "Próxima" é distância, não o menor número.', tagErro: 'leitura_interpretacao' },
      B: { rotulo: '2,96.', valorNumerico: 2.96, diagnosticoPt: '2,96 fica perto, mas não é a menor distância até 3. Compare os módulos, um por um, antes de escolher.', tagErro: 'calculo_aritmetico' },
      C: { rotulo: '3,021.', valorNumerico: 3.021, diagnosticoPt: 'A menor distância até 3 mm, entre as cinco lentes, é a desta espessura.' },
      D: { rotulo: '3,07.', valorNumerico: 3.07, diagnosticoPt: '3,07 parece "logo acima de 3", mas a distância dela é maior do que a de uma lente que quase encosta.', tagErro: 'calculo_aritmetico' },
      E: { rotulo: '3,10.', valorNumerico: 3.1, diagnosticoPt: '3,10 é a mais grossa. Mais grossa não é mais próxima. A régua mede o afastamento, não o tamanho.', tagErro: 'leitura_interpretacao' },
    },
    dicas: [
      '"Mais próxima de 3 mm" é a menor distância até 3, para cima ou para baixo. Lente mais fina e lente mais grossa são distrações.',
      'Resumo de boteco: escreva 3 mm numa linha. Para cada lente, anote quanto falta ou quanto passa, sempre positivo. Quem tiver o menor positivo ganha. Casa decimal importa: milésimo é menor que centésimo.',
      'Primeiro passo: subtraia 3 de cada espessura e fique com o valor absoluto. Armadilha: escolher a que está escrito com mais casas perto de 3 só no olhar, sem subtrair. O olho mente quando um número tem três casas e o outro tem duas.',
    ],
    solucaoCompletaPt:
      'Distâncias até 3 mm: |3,10 − 3| = 0,10; |3,021 − 3| = 0,021; |2,96 − 3| = 0,04; |2,099 − 3| = 0,901; |3,07 − 3| = 0,07. A menor é 0,021, da lente de 3,021 mm. A de 2,96 perde porque 0,04 é quase o dobro de 0,021. A de 2,099 está longe, mesmo parecendo "dois e qualquer coisa".',
    atalhoPt: 'Módulo da diferença até 3. Ganha o menor módulo.',
    outroCaminhoPt:
      'Em milésimos de milímetro, o alvo é 3 000. As lentes viram 3 100, 3 021, 2 960, 2 099 e 3 070. As distâncias são 100, 21, 40, 901 e 70. O 21 é o menor. Tirar a vírgula só para a comparação ficar inteira.',
    dicaVidaRealPt: 'Proximidade é distância, e distância não tem sinal. Passar 0,02 mm é chegar mais perto do que faltar 0,04 mm. O olho que lê "2,99 qualquer" sem subtrair compra a lente errada.',
  },
  {
    ano: 2015,
    questao: 172,
    grau: 6,
    temaId: 'enem_razoes_escalas',
    correta: 'D',
    enunciadoMarkdown:
      'Alguns exames médicos requerem uma ingestão de água maior do que a habitual. Por recomendação médica, antes do horário do exame, uma paciente deveria ingerir 1 copo de água de 150 mililitros a cada meia hora, durante as 10 horas que antecederiam um exame. A paciente foi a um supermercado comprar água e verificou que havia garrafas dos seguintes tipos:\n\n- Garrafa I: 0,15 litro\n- Garrafa II: 0,30 litro\n- Garrafa III: 0,75 litro\n- Garrafa IV: 1,50 litro\n- Garrafa V: 3,00 litros\n\nA paciente decidiu comprar duas garrafas do mesmo tipo, procurando atender à recomendação médica e, ainda, de modo a consumir todo o líquido das duas garrafas antes do exame.\n\nQual o tipo de garrafa escolhida pela paciente?',
    alternativas: {
      A: { rotulo: 'I', diagnosticoPt: 'Duas garrafas do menor volume não cobrem as 10 horas de copos. O total precisa fechar exatamente, não ficar pela metade.', tagErro: 'calculo_aritmetico' },
      B: { rotulo: 'II', diagnosticoPt: 'Duas dessa ainda são pouco para o volume das 10 horas. Some os copos antes de olhar a prateleira.', tagErro: 'calculo_aritmetico' },
      C: { rotulo: 'III', diagnosticoPt: 'O par dessa garrafa fica aquém do que a médica pediu. "Consumir tudo" não autoriza beber menos.', tagErro: 'leitura_interpretacao' },
      D: { rotulo: 'IV', diagnosticoPt: 'Duas garrafas iguais somam exatamente o volume dos copos das 10 horas.' },
      E: { rotulo: 'V', diagnosticoPt: 'Uma garrafa desse tipo já é o volume inteiro. Duas passam do que ela deve beber, e a paciente quer acabar as duas antes do exame.', tagErro: 'leitura_interpretacao' },
    },
    dicas: [
      'Duas condições ao mesmo tempo: o volume das duas garrafas iguais é exatamente o volume que a médica mandou, nem mais nem menos. Primeiro ache esse volume. A prateleira vem depois.',
      'Resumo de boteco: em 10 horas, de meia em meia hora, conte quantos copos cabem. Cada copo tem 150 mL. Passe o total para litros, porque a prateleira está em litro. Aí procure a garrafa que, comprada em dobro, casa com esse total.',
      'Primeiro passo: meia hora cabe duas vezes em uma hora, então em 10 horas os copos são o dobro das horas. Armadilha: comprar a garrafa que sozinha já tem o volume inteiro. A paciente leva duas. Duas vezes esse volume estoura a recomendação.',
    ],
    solucaoCompletaPt:
      'De meia em meia hora, em 10 horas, há 20 copos. 20 × 150 mL = 3 000 mL = 3 litros. Duas garrafas iguais precisam somar 3 L, então cada uma tem 1,5 L. Essa é a garrafa IV. A garrafa V tem 3 L sozinha; duas dela dariam 6 L, e sobraria água depois do exame.',
    atalhoPt: 'Copos = 10 / 0,5. Volume = copos × 150 mL. Duas garrafas iguais repartem esse volume no meio.',
    outroCaminhoPt:
      '150 mL = 0,15 L. Vinte copos: 20 × 0,15 = 3 L. Metade é 1,5 L, que está na lista como uma das garrafas. Comprar duas dessa metade esvazia a sacola no instante certo.',
    dicaVidaRealPt: 'Unidade de copo e unidade de garrafa só se encontram no litro, ou no mililitro. "Duas iguais e sem sobra" é uma equação, não uma preferência de gôndola.',
  },
  {
    ano: 2015,
    questao: 180,
    grau: 5,
    temaId: 'enem_probabilidade_contagem',
    correta: 'C',
    enunciadoMarkdown:
      'Em uma central de atendimento, cem pessoas receberam senhas numeradas de 1 até 100. Uma das senhas é sorteada ao acaso.\n\nQual é a probabilidade de a senha sorteada ser um número de 1 a 20?',
    alternativas: {
      A: { rotulo: '$\\dfrac{1}{100}$', valorNumerico: 0.01, diagnosticoPt: 'Isso é a chance de uma senha específica, a de número 1 ou qualquer outra sozinha. O intervalo tem mais do que uma senha.', tagErro: 'combinatoria_probabilidade' },
      B: { rotulo: '$\\dfrac{19}{100}$', valorNumerico: 0.19, diagnosticoPt: 'Faltou uma ponta. De 1 até 20, as duas pontas entram. Contar "até 20" como 19 é deixar alguém sem senha.', tagErro: 'calculo_aritmetico' },
      C: { rotulo: '$\\dfrac{20}{100}$', valorNumerico: 0.2, diagnosticoPt: 'Vinte senhas favoráveis, cem possíveis, todas com a mesma chance.' },
      D: { rotulo: '$\\dfrac{21}{100}$', valorNumerico: 0.21, diagnosticoPt: 'Vinte e um conta um número a mais, como se o zero ou o 21 tivesse entrado na fila. A fila começa em 1 e termina em 20.', tagErro: 'calculo_aritmetico' },
      E: { rotulo: '$\\dfrac{80}{100}$', valorNumerico: 0.8, diagnosticoPt: 'Isso é a chance do complementar: senha de 21 até 100. A pergunta pediu de 1 a 20, não o resto da central.', tagErro: 'leitura_interpretacao' },
    },
    dicas: [
      'Sorteio ao acaso, com senhas igualmente possíveis: a probabilidade é a quantidade de senhas que servem, dividida pela quantidade de senhas que existem.',
      'Resumo de boteco: o universo é a fila de 1 até 100. O favorável é um pedaço dessa fila, de 1 até 20. Para contar um pedaço de inteiros, olhe as duas pontas. As duas entram. Não comece no 2 e não pare no 19.',
      'Primeiro passo: escreva quantos inteiros há de 1 até 20, inclusive. Armadilha clássica: responder 19, porque 20 − 1 = 19. Essa conta mede o vão entre eles, não a quantidade de senhas. Outra: inverter e entregar quem ficou de fora.',
    ],
    solucaoCompletaPt:
      'Senhas possíveis: 100, todas com probabilidade igual. Senhas de 1 a 20, inclusive: 20 − 1 + 1 = 20. Probabilidade = 20/100. O "+1" é a senha número 1, que a subtração 20 − 1 tinha expulsado. 19/100 esquece uma ponta. 80/100 responde a pergunta contrária. 1/100 responde "sair exatamente a senha tal".',
    atalhoPt: 'Favoráveis sobre possíveis. De 1 até 20 inclusive há 20 senhas. O total é 100.',
    outroCaminhoPt:
      'A quantidade de inteiros de a até b, com os dois dentro, é b − a + 1. Aqui a = 1 e b = 20. O total já é 100. A fração nem precisa ser simplificada: a prova escreve o cem no denominador.',
    dicaVidaRealPt: 'Contar "de 1 a 20" inclui o 1 e o 20. Subtrair as pontas conta os passos entre elas, não as pessoas na fila. Senha é pessoa, não passo.',
  },
  {
    ano: 2016,
    questao: 144,
    grau: 5,
    temaId: 'enem_estatistica_medias',
    correta: 'B',
    enunciadoMarkdown:
      'Um posto de saúde registrou a quantidade de vacinas aplicadas contra febre amarela nos últimos cinco meses: 21, 22, 25, 31 e 21. No início do primeiro mês, esse posto tinha 228 vacinas em estoque. A política de reposição prevê adquirir novas vacinas, no início do sexto mês, de tal forma que a quantidade inicial em estoque para os próximos meses seja igual a 12 vezes a média das quantidades mensais dessas vacinas aplicadas nos últimos cinco meses.\n\nPara atender essas condições, a quantidade de vacinas contra febre amarela que o posto de saúde deve adquirir no início do sexto mês é',
    alternativas: {
      A: { rotulo: '156.', valorNumerico: 156, diagnosticoPt: 'A média entrou, mas o estoque que ainda sobrou dos 228 não foi descontado do alvo, ou foi descontado duas vezes.', tagErro: 'calculo_aritmetico' },
      B: { rotulo: '180.', valorNumerico: 180, diagnosticoPt: 'O alvo é 12 vezes a média. O que ainda está na geladeira é o estoque inicial menos o que foi aplicado. Compra-se a diferença.' },
      C: { rotulo: '192.', valorNumerico: 192, diagnosticoPt: 'Ficou perto do alvo sem olhar o que os cinco meses já consumiram. Reposição não é o alvo inteiro se ainda existe estoque.', tagErro: 'leitura_interpretacao' },
      D: { rotulo: '264.', valorNumerico: 264, diagnosticoPt: 'Aqui o consumo dos cinco meses foi somado de novo, ou a média foi trocada pela soma.', tagErro: 'calculo_aritmetico' },
      E: { rotulo: '288.', valorNumerico: 288, diagnosticoPt: 'Esse é o estoque que o sexto mês quer encontrar, não a compra. Esquecer de descontar o que sobrou é comprar o alvo inteiro.', tagErro: 'leitura_interpretacao' },
    },
    dicas: [
      'A compra não é a média e não é "12 vezes a média" sozinha. "12 vezes a média" é o estoque que deve existir na abertura do sexto mês. Parte disso ainda está na geladeira.',
      'Resumo de boteco: some os cinco meses e divida por 5. Multiplique por 12: esse é o alvo da abertura. O que foi aplicado já saiu dos 228. O que sobrou é 228 menos essa soma. A nota fiscal é alvo menos sobra.',
      'Primeiro passo: separe três números com nomes. Média. Alvo. Sobra. Armadilha: comprar o alvo inteiro, como se a geladeira tivesse amanhecido vazia. Os 228 não evaporaram; só diminuíram nas aplicações.',
    ],
    solucaoCompletaPt:
      'Soma dos cinco meses: 21 + 22 + 25 + 31 + 21 = 120. Média: 120 / 5 = 24. Alvo na abertura do sexto mês: 12 × 24 = 288. Já foram aplicadas 120 vacinas, então sobraram 228 − 120 = 108. A compra é 288 − 108 = 180. Quem marca 288 comprou o alvo e esqueceu as 108 que ainda estão na caixa.',
    atalhoPt: 'Alvo = 12 × média. Sobra = estoque inicial − soma aplicada. Compra = alvo − sobra.',
    outroCaminhoPt:
      '288 − (228 − 120) = 288 − 228 + 120 = 180. Abrir o parêntese mostra a compra como "alvo menos estoque antigo, mais o que já foi usado". É a mesma diferença, com o sinal do consumo virado para o lado da reposição.',
    dicaVidaRealPt: 'Reposição é a distância entre o que você quer ter e o que ainda tem. Comprar o desejado inteiro, com estoque em cima da mesa, é pagar duas vezes a mesma vacina.',
  },
  {
    ano: 2016,
    questao: 149,
    grau: 5,
    temaId: 'enem_razoes_escalas',
    correta: 'B',
    enunciadoMarkdown:
      'Cinco marcas de pão integral apresentam as seguintes concentrações de fibras (massa de fibra por massa de pão):\n\n- Marca A: 2 g de fibras a cada 50 g de pão\n- Marca B: 5 g de fibras a cada 40 g de pão\n- Marca C: 5 g de fibras a cada 100 g de pão\n- Marca D: 6 g de fibras a cada 90 g de pão\n- Marca E: 7 g de fibras a cada 70 g de pão\n\nRecomenda-se a ingestão do pão que possui a maior concentração de fibras.\n\nA marca a ser escolhida é',
    alternativas: {
      A: { rotulo: 'A.', diagnosticoPt: 'Dois gramas parecem pouco, e são. Concentração é a razão, e essa razão fica atrás das outras.', tagErro: 'proporcao_invertida' },
      B: { rotulo: 'B.', diagnosticoPt: 'A maior razão fibra por grama de pão está nesta marca. Os denominadores não são iguais, então o numerador sozinho não decide.' },
      C: { rotulo: 'C.', diagnosticoPt: 'Cinco gramas em 100 g de pão é uma razão pequena. O 100 do denominador dilui a fibra.', tagErro: 'proporcao_invertida' },
      D: { rotulo: 'D.', diagnosticoPt: 'Seis gramas chamam atenção, mas estão espalhados em 90 g de pão. Divida antes de comparar.', tagErro: 'calculo_aritmetico' },
      E: { rotulo: 'E.', diagnosticoPt: 'Sete é o maior numerador da lista, não a maior concentração. O pão que acompanha esses 7 g também entra na razão.', tagErro: 'leitura_interpretacao' },
    },
    dicas: [
      'Concentração, aqui, é fibra dividida pelo pão. Não é "quem tem mais gramas de fibra no rótulo". Os pães da lista não pesam a mesma coisa.',
      'Resumo de boteco: faça cinco frações, fibra em cima e pão embaixo. Para comparar frações de denominadores diferentes, ache um chão comum ou passe cada uma para decimal. Quem tiver o maior quociente é o pão da recomendação.',
      'Primeiro passo: escreva as cinco divisões. Armadilha: escolher o maior numerador, o 7, ou o menor denominador no olho, sem dividir. Razão é o par, não um dos dois números.',
    ],
    solucaoCompletaPt:
      'A: 2/50 = 0,04. B: 5/40 = 0,125. C: 5/100 = 0,05. D: 6/90 = 0,066…. E: 7/70 = 0,1. A maior concentração é 0,125, a marca B. O sete da marca E perde para o cinco da marca B porque 70 g de pão diluem mais do que 40 g. Numerador campeão não é razão campeã.',
    atalhoPt: 'Divida fibra por massa de pão em cada marca. Fique com o maior quociente.',
    outroCaminhoPt:
      'Em fibra por 100 g: A fica 4 g, B fica 12,5 g, C fica 5 g, D fica cerca de 6,7 g, E fica 10 g. O mesmo ranking, agora com o pão igualado. Igualar o denominador é o que a divisão já fazia escondido.',
    dicaVidaRealPt: 'Rótulo mente quando você lê só o número grande. "7 g de fibra" sem dizer em quanto pão é propaganda. Concentração é a divisão que a propaganda espera que você não faça.',
  },
  {
    ano: 2016,
    questao: 153,
    grau: 7,
    temaId: 'enem_probabilidade_contagem',
    correta: 'E',
    enunciadoMarkdown:
      'Para cadastrar-se em um site, uma pessoa precisa escolher uma senha composta por quatro caracteres, sendo dois algarismos e duas letras (maiúsculas ou minúsculas). As letras e os algarismos podem estar em qualquer posição. O alfabeto é composto por vinte e seis letras e uma letra maiúscula difere da minúscula.\n\nO número total de senhas possíveis é dado por',
    alternativas: {
      A: { rotulo: '$10^{2} \\cdot 26^{2}$', diagnosticoPt: 'Faltou dobrar o alfabeto, porque maiúscula e minúscula são caracteres diferentes, e faltou contar as posições em que os algarismos podem sentar.', tagErro: 'combinatoria_probabilidade' },
      B: { rotulo: '$10^{2} \\cdot 52^{2}$', diagnosticoPt: 'Os tipos de caractere estão certos, mas essa conta fixa a ordem: como se os dois algarismos viessem sempre nos dois primeiros lugares. O enunciado deixa qualquer posição.', tagErro: 'combinatoria_probabilidade' },
      C: { rotulo: '$10^{2} \\cdot 52^{2} \\cdot \\dfrac{4!}{2!}$', diagnosticoPt: 'O fatorial de baixo só divide por um dos pares. São dois algarismos iguais em tipo e duas letras iguais em tipo. Os dois pares pedem desconto.', tagErro: 'combinatoria_probabilidade' },
      D: { rotulo: '$10^{2} \\cdot 26^{2} \\cdot \\dfrac{4!}{2! \\cdot 2!}$', diagnosticoPt: 'As posições estão certas, o alfabeto não. Maiúscula difere de minúscula, então não são 26 símbolos alfabéticos.', tagErro: 'leitura_interpretacao' },
      E: { rotulo: '$10^{2} \\cdot 52^{2} \\cdot \\dfrac{4!}{2! \\cdot 2!}$', diagnosticoPt: '52 símbolos alfabéticos, 10 algarismos, e as posições dos dois tipos no bloco de quatro, sem contar duas vezes a ordem dentro do mesmo tipo.' },
    },
    dicas: [
      'A senha tem quatro casas. Duas são algarismo, duas são letra. A frase "qualquer posição" significa que você escolhe quais casas recebem algarismo. A frase "maiúscula difere da minúscula" dobra o alfabeto.',
      'Resumo de boteco: primeiro escolha o alfabeto de verdade: 26 maiúsculas e 26 minúsculas. Algarismo continua de 0 a 9. Depois escolha 2 casas entre 4 para os algarismos; o resto fica com as letras. Em cada casa de algarismo há 10 escolhas. Em cada casa de letra há o alfabeto dobrado.',
      'Primeiro passo: escreva C(4,2) como 4! sobre o produto de dois fatoriais iguais, um para cada tipo de casa. Armadilha: usar 26 no lugar do alfabeto dobrado, ou esquecer o arranjo das posições e multiplicar só 10² pelo alfabeto ao quadrado, como se a ordem dos tipos fosse fixa.',
    ],
    solucaoCompletaPt:
      'Letras disponíveis: 26 maiúsculas + 26 minúsculas = 52. Algarismos: 10. Escolhem-se 2 posições entre 4 para os algarismos: C(4,2) = 4! / (2! 2!). As outras duas posições são das letras. Cada posição de algarismo tem 10 opções, cada posição de letra tem 52. Total: 10² × 52² × 4! / (2! 2!). O 2! de baixo não é frescura: dentro dos algarismos, a ordem em que você escolheu as casas já foi organizada pela combinação, e o mesmo vale para as letras. Dividir só por um 2! contaria posição dobrada.',
    atalhoPt: '52 letras de verdade, 10 algarismos, C(4,2) jeitos de sentar os algarismos. O resto das casas é letra.',
    outroCaminhoPt:
      'O número de palavras de quatro lugares com dois A e dois L, antes de pintar os símbolos, é 4! / (2! 2!). Depois pinte cada A com 10 cores e cada L com 52. A pintura multiplica. Chega na mesma expressão, começando pela forma da senha e não pelo alfabeto.',
    dicaVidaRealPt: 'Senha não é só "quantos símbolos existem". É símbolos vezes o lugar onde eles podem sentar. Maiúscula e minúscula, quando o site diferencia, são duas teclas, não um capricho de caligrafia.',
  },
  {
    ano: 2016,
    questao: 156,
    grau: 6,
    temaId: 'enem_porcentagem_financeira',
    correta: 'C',
    enunciadoMarkdown:
      'Uma pessoa comercializa picolés. No segundo dia de certo evento ela comprou 4 caixas de picolés, pagando R$ 16,00 a caixa com 20 picolés para revendê-los no evento. No dia anterior, ela havia comprado a mesma quantidade de picolés, pagando a mesma quantia, e obtendo um lucro de R$ 40,00 com a venda de todos os picolés que possuía.\n\nPesquisando o público, ela avalia que será possível obter um lucro 20% maior do que o obtido no primeiro dia.\n\nPara atingir seu objetivo, supondo que todos os picolés disponíveis foram vendidos no segundo dia, o valor de venda de cada picolé, no segundo dia, deve ser',
    alternativas: {
      A: { rotulo: 'R$ 0,96.', valorNumerico: 0.96, diagnosticoPt: 'Esse valor nem cobre o custo da caixa espalhado nos 20 picolés, com lucro por cima. Preço de venda é custo mais lucro, repartido.', tagErro: 'calculo_aritmetico' },
      B: { rotulo: 'R$ 1,00.', valorNumerico: 1, diagnosticoPt: 'Um real deixa o lucro do segundo dia menor do que o combinado. Some o custo do dia com o lucro novo antes de dividir.', tagErro: 'calculo_aritmetico' },
      C: { rotulo: 'R$ 1,40.', valorNumerico: 1.4, diagnosticoPt: 'O lucro novo é 20% a mais sobre o lucro antigo, não sobre o preço. Receita é custo mais esse lucro. Divida pelos picolés.' },
      D: { rotulo: 'R$ 1,50.', valorNumerico: 1.5, diagnosticoPt: 'Passou do preço que gera o lucro pedido. Confira se os 20% incidiram no lucro de 40 reais, e se todas as caixas entraram no custo.', tagErro: 'porcentagem_base' },
      E: { rotulo: 'R$ 1,56.', valorNumerico: 1.56, diagnosticoPt: 'Os 20% foram aplicados no preço antigo de venda. O enunciado aumenta o lucro, não o preço, em 20%.', tagErro: 'porcentagem_base' },
    },
    dicas: [
      'O segundo dia quer um lucro 20% maior que o lucro do primeiro, não um preço 20% maior. Lucro é venda menos compra. O preço de cada picolé é a venda inteira dividida pela quantidade.',
      'Resumo de boteco: as duas diárias compram a mesma coisa, pelo mesmo custo. Descubra esse custo: caixas vezes preço da caixa, e caixas vezes picolés. No primeiro dia o lucro foi 40. No segundo, aumente esse 40 em 20%. A venda do segundo dia é custo mais lucro novo.',
      'Primeiro passo: ache quantos picolés existem no dia. Armadilha: jogar 20% em cima do preço que ela cobrava ontem. O texto não disse que o preço sobe 20%. Disse que o lucro sobe 20%. Base errada, picolé mais caro do que o necessário.',
    ],
    solucaoCompletaPt:
      'Custo do dia: 4 × 16 = R$ 64, por 4 × 20 = 80 picolés. No primeiro dia, lucro 40, então a venda foi 64 + 40 = 104, e cada picolé saiu a 104/80 = 1,30. No segundo dia o lucro sobe 20%: 40 × 1,2 = 48. Venda = 64 + 48 = 112. Preço = 112 / 80 = 1,40. Aplicar 20% sobre 1,30 daria 1,56, que aumenta o preço, não o lucro, e está na lista justamente para essa base trocada.',
    atalhoPt: 'Custo igual nos dois dias. Lucro novo = lucro antigo × 1,2. Preço = (custo + lucro novo) / quantidade.',
    outroCaminhoPt:
      'Cada picolé custa 16/20 = 0,80. O lucro antigo de 40 em 80 unidades é 0,50 por picolé, preço antigo 1,30. O lucro novo é 48 em 80 unidades, 0,60 por picolé. Preço 0,80 + 0,60 = 1,40. Descer à unidade só torna o 20% do lucro visível ao lado do custo.',
    dicaVidaRealPt: 'Subir o lucro 20% não é subir o preço 20%. O custo fica parado no meio. Quem aplica o percentual no preço inteiro paga um aumento que o bolso do cliente não precisava sofrer.',
  },
  {
    ano: 2016,
    questao: 161,
    grau: 6,
    temaId: 'enem_razoes_escalas',
    correta: 'C',
    enunciadoMarkdown:
      'Um paciente necessita de reidratação endovenosa feita por meio de cinco frascos de soro durante 24 h. Cada frasco tem um volume de 800 mL de soro. Nas primeiras quatro horas, deverá receber 40% do total a ser aplicado. Cada mililitro de soro corresponde a 12 gotas.\n\nO número de gotas por minuto que o paciente deverá receber após as quatro primeiras horas será',
    alternativas: {
      A: { rotulo: '16.', valorNumerico: 16, diagnosticoPt: 'O ritmo ficou lento demais. Confira se os 60% restantes estão sendo dados nas horas que sobram, e se cada mL virou 12 gotas.', tagErro: 'calculo_aritmetico' },
      B: { rotulo: '20.', valorNumerico: 20, diagnosticoPt: 'Perto, mas o volume restante ou os minutos das 20 horas não fecharam. 40% nas primeiras quatro horas deixa 60% para o resto do dia.', tagErro: 'porcentagem_base' },
      C: { rotulo: '24.', valorNumerico: 24, diagnosticoPt: 'O que sobra depois dos 40% iniciais, em gotas, repartido pelos minutos que ainda faltam para completar as 24 h.' },
      D: { rotulo: '34.', valorNumerico: 34, diagnosticoPt: 'Um arredondamento ou uma hora a mais entrou no divisor. As horas restantes são 24 menos as quatro já usadas.', tagErro: 'calculo_aritmetico' },
      E: { rotulo: '40.', valorNumerico: 40, diagnosticoPt: 'O 40% virou 40 gotas. Porcentagem não é o ritmo. Ela só diz qual fatia do volume sai no começo.', tagErro: 'porcentagem_base' },
    },
    dicas: [
      'A pergunta não é sobre as primeiras quatro horas. É sobre o ritmo depois delas. Se 40% sai no começo, o resto do volume sai no resto do tempo.',
      'Resumo de boteco: ache o volume total dos cinco frascos. Separe a fatia que fica para depois das quatro horas. Troque mililitro por gota. Troque as horas restantes por minutos. Gotas divididas por minutos é o ritmo.',
      'Primeiro passo: 24 h menos 4 h é o tempo da segunda etapa. Armadilha: aplicar o ritmo nas quatro horas iniciais, ou tratar 40% como 40 gotas. Outra: esquecer que cada mL são 12 gotas e dividir mililitro por minuto.',
    ],
    solucaoCompletaPt:
      'Volume total: 5 × 800 = 4 000 mL. As primeiras 4 h levam 40%, então depois delas restam 60%: 0,6 × 4 000 = 2 400 mL. Em gotas: 2 400 × 12 = 28 800. Tempo restante: 20 h = 1 200 min. Ritmo: 28 800 / 1 200 = 24 gotas por minuto. O 40 da lista é o percentual que já foi embora, não o gotejamento.',
    atalhoPt: '60% do volume total, vezes 12 gotas por mL, dividido pelos minutos das 20 h restantes.',
    outroCaminhoPt:
      '2 400 mL em 1 200 min são 2 mL por minuto. Cada mL são 12 gotas, então 2 × 12 = 24 gotas por minuto. Passar primeiro para mL por minuto encolhe a conta e deixa o 12 para o final.',
    dicaVidaRealPt: 'Gotejamento é volume restante dividido pelo tempo restante, na unidade que a enfermeira conta. Porcentagem só recorta o volume. Quem transforma porcentagem em gotas pulou a ponte.',
  },
  {
    ano: 2016,
    questao: 167,
    grau: 6,
    temaId: 'enem_estatistica_medias',
    correta: 'D',
    enunciadoMarkdown:
      'Uma empresa fez um balanço dos lucros, em milhões de reais, nos últimos sete meses:\n\n- Mês I: 37\n- Mês II: 33\n- Mês III: 35\n- Mês IV: 22\n- Mês V: 30\n- Mês VI: 35\n- Mês VII: 25\n\nO conselho decidiu comprar, nos dois meses seguintes, a mesma quantidade de matéria-prima comprada no mês em que o lucro mais se aproximou da média dos lucros mensais desse período.\n\nNos próximos dois meses, a empresa deverá repetir a compra do mês',
    alternativas: {
      A: { rotulo: 'I.', diagnosticoPt: 'O mês I é o maior lucro, não o mais próximo da média. Extremo não é centro.', tagErro: 'leitura_interpretacao' },
      B: { rotulo: 'II.', diagnosticoPt: 'Perto, mas a distância desse lucro até a média ainda perde para outro mês da lista.', tagErro: 'calculo_aritmetico' },
      C: { rotulo: 'IV.', diagnosticoPt: 'O mês IV é o menor lucro. "Mais se aproximou" não é "mais caiu".', tagErro: 'leitura_interpretacao' },
      D: { rotulo: 'V.', diagnosticoPt: 'A média dos sete meses fica mais perto do lucro deste mês do que de qualquer outro.' },
      E: { rotulo: 'VII.', diagnosticoPt: 'O último mês não tem privilégio. A distância dele até a média é maior do que a do mês que encosta.', tagErro: 'calculo_aritmetico' },
    },
    dicas: [
      'Primeiro a média dos sete lucros. Depois a distância de cada mês até essa média. Ganha quem encosta, não quem é o maior e não quem é o último.',
      'Resumo de boteco: some a coluna e divida por 7. Escreva a média num canto. Para cada mês, anote quanto falta ou quanto passa, sempre positivo. O menor positivo escolhe o mês da compra.',
      'Primeiro passo: a soma precisa fechar antes da divisão. Armadilha: escolher 35 porque aparece duas vezes, ou 37 porque é o topo. A pergunta não pediu moda nem máximo. Pediu proximidade da média.',
    ],
    solucaoCompletaPt:
      'Soma: 37 + 33 + 35 + 22 + 30 + 35 + 25 = 217. Média: 217 / 7 = 31. Distâncias até 31: mês I fica a 6, II a 2, III a 4, IV a 9, V a 1, VI a 4, VII a 6. A menor distância é 1, no mês V, cujo lucro foi 30. Os dois meses seguintes repetem a compra desse mês.',
    atalhoPt: 'Média = soma / 7. Mês vencedor = menor módulo da diferença até essa média.',
    outroCaminhoPt:
      '217 dividido por 7: 7 × 31 = 217, média exata 31, sem dízima. Com média inteira, a distância vira conta de inteiros. O lucro 30 é o vizinho imediato. O 33, dois passos acima, já perde.',
    dicaVidaRealPt: 'Planejar pelo mês "mais típico" é planejar pela média, não pelo mês campeão. O campeão é um pico. Pico não se repete só porque foi bonito.',
  },
  {
    ano: 2016,
    questao: 180,
    grau: 7,
    temaId: 'enem_estatistica_medias',
    correta: 'E',
    enunciadoMarkdown:
      'A permanência de um gerente depende da média do lucro mensal do semestre. Se a média for, no mínimo, de 30 mil reais, ele permanece. O lucro mensal, em milhares de reais, de janeiro a maio foi:\n\n- Janeiro: 21\n- Fevereiro: 35\n- Março: 21\n- Abril: 30\n- Maio: 38\n\nQual deve ser o lucro mínimo da empresa no mês de junho, em milhares de reais, para o gerente continuar no cargo?',
    alternativas: {
      A: { rotulo: '26', valorNumerico: 26, diagnosticoPt: 'A média dos cinco meses já andou, e junho foi pedido para puxar o semestre inteiro até 30. Cinco meses não são seis.', tagErro: 'leitura_interpretacao' },
      B: { rotulo: '29', valorNumerico: 29, diagnosticoPt: 'Ficou um pouco abaixo do que a soma dos seis meses precisa atingir. A média mínima vale para os seis, incluindo junho.', tagErro: 'calculo_aritmetico' },
      C: { rotulo: '30', valorNumerico: 30, diagnosticoPt: 'Trinta seria a resposta se junho pudesse ser a média sozinho. Os meses fracos de janeiro e março ainda estão dentro da soma.', tagErro: 'leitura_interpretacao' },
      D: { rotulo: '31', valorNumerico: 31, diagnosticoPt: 'Um a mais do que a média alvo não compensa, sozinho, os meses que ficaram abaixo. Volte para a soma dos seis.', tagErro: 'calculo_aritmetico' },
      E: { rotulo: '35', valorNumerico: 35, diagnosticoPt: 'A soma dos seis meses precisa ser, no mínimo, 6 vezes 30. Junho cobre o que janeiro a maio ainda não cobriram.' },
    },
    dicas: [
      'A média de 30 mil é do semestre, seis meses, não dos cinco que já passaram. Junho entra na soma. "No mínimo" significa que a soma dos seis tem um chão.',
      'Resumo de boteco: se seis meses têm média 30, a soma deles é 6 vezes 30. Some o que janeiro até maio já colocaram na mesa. O que falta para o chão é o menor junho que salva o gerente.',
      'Primeiro passo: transforme a média alvo em soma alvo. Armadilha: responder 30, como se o mês que falta pudesse ignorar os meses ruins. Média é democrática: janeiro frouxo puxa junho para cima.',
    ],
    solucaoCompletaPt:
      'Soma mínima dos seis meses: 6 × 30 = 180 mil reais. Janeiro a maio: 21 + 35 + 21 + 30 + 38 = 145. Junho precisa de pelo menos 180 − 145 = 35 mil reais. Com 35, a soma fecha 180 e a média fecha 30. Um real a menos e a média desce, e o cargo desce junto.',
    atalhoPt: 'Soma alvo = 6 × 30. Junho = soma alvo − soma dos cinco meses já feitos.',
    outroCaminhoPt:
      'Os desvios até 30, de janeiro a maio: −9, +5, −9, 0, +8. Soma dos desvios: −5. Junho precisa de um desvio de pelo menos +5 para zerar a conta, ou seja, 30 + 5. Desvio é a mesma subtração, escrita ao lado da média em vez de ao lado da soma.',
    dicaVidaRealPt: 'Meta de média não se cumpre no último mês copiando a média. Cumpre-se pagando a dívida dos meses que ficaram abaixo. O último mês é o ajuste, não a média sozinha.',
  },
  {
    ano: 2021,
    questao: 141,
    grau: 7,
    temaId: 'enem_porcentagem_financeira',
    correta: 'D',
    enunciadoMarkdown:
      'Um ciclista de 61 anos mediu a frequência cardíaca máxima em quatro trechos:\n\n- Leve no plano: 90 bpm\n- Forte no plano: 120 bpm\n- Subida moderada: 130 bpm\n- Subida forte: 140 bpm\n\nA faixa aeróbica ideal fica entre 65% e 85% da frequência cardíaca máxima, dada por Fc máx. = 220 − idade, com a idade em anos e o resultado em bpm.\n\nOs trechos nos quais esse ciclista se mantém dentro da faixa aeróbica ideal são',
    alternativas: {
      A: { rotulo: 'leve no plano, forte no plano, subida moderada e subida forte.', diagnosticoPt: 'Os quatro trechos não cabem na faixa. Calcule o teto e o chão antes de convidar todo mundo.', tagErro: 'calculo_aritmetico' },
      B: { rotulo: 'leve no plano, forte no plano e subida moderada.', diagnosticoPt: 'O trecho leve fica abaixo do chão da faixa. "Ideal" tem mínimo, não só máximo.', tagErro: 'leitura_interpretacao' },
      C: { rotulo: 'forte no plano, subida moderada e subida forte.', diagnosticoPt: 'A subida forte passa do teto. 85% não é 100% da frequência máxima.', tagErro: 'porcentagem_base' },
      D: { rotulo: 'forte no plano e subida moderada.', diagnosticoPt: 'Esses dois batimentos ficam entre 65% e 85% da frequência máxima. Os outros dois escapam, um por baixo e um por cima.' },
      E: { rotulo: 'leve no plano e subida forte.', diagnosticoPt: 'Esses dois são justamente os que saem da faixa: um não chega no mínimo, o outro passa do máximo.', tagErro: 'leitura_interpretacao' },
    },
    dicas: [
      'A faixa não é um sentimento. É um intervalo numérico. Primeiro ache a frequência máxima com a idade. Depois ache 65% dela e 85% dela. Só então olhe os quatro trechos.',
      'Resumo de boteco: desenhe uma régua de batimentos. Marque o chão, 65% do máximo, e o teto, 85% do máximo. O trecho que ficar abaixo do chão é folga demais. O que ficar acima do teto é esforço demais. Ficam os que sentam dentro do intervalo, inclusive as pontas se algum encostar.',
      'Primeiro passo: 220 menos a idade. Armadilha: comparar os batimentos com 65 e com 85, como se a faixa fosse "entre 65 bpm e 85 bpm". Esses percentuais são do máximo, não batimentos soltos. Outra: achar que subir forte é sempre o ideal, só porque cansa.',
    ],
    solucaoCompletaPt:
      'Fc máx. = 220 − 61 = 159 bpm. Chão: 0,65 × 159 = 103,35 bpm. Teto: 0,85 × 159 = 135,15 bpm. Leve no plano, 90, está abaixo do chão. Forte no plano, 120, está dentro. Subida moderada, 130, está dentro. Subida forte, 140, passa do teto. Permanecem forte no plano e subida moderada. A faixa é uma janela, não um convite para o maior número da tabela.',
    atalhoPt: 'Máximo = 220 − idade. Janela = de 65% até 85% desse máximo. Risque quem cair fora.',
    outroCaminhoPt:
      '0,65 × 159 = 65 × 1,59 = 103,35 e 0,85 × 159 = 85 × 1,59 = 135,15. Separar o percentual do 159 evita multiplicar 0,65 no escuro. O 1,59 é a frequência máxima escrita em "por cento de cem batimentos", e o percentual vira um inteiro ao lado.',
    dicaVidaRealPt: 'Zona ideal de esforço é um intervalo, com porta de baixo e porta de cima. Treino bom não é o que mais dói. É o que mora entre as duas portas.',
  },
]

export const ENEM_MATEMATICA_LOTE3: readonly DesafioUnificado[] = SPECS.map(construirDesafioEnem)
