// ──────────────────────────────────────────────────────────────────────────────
// content.ts — Banco de dados local do Portal Educacional
//
// Para adicionar conteúdo novo, basta incluir um item nos arrays abaixo.
// Nenhuma outra alteração é necessária nas páginas.
// ──────────────────────────────────────────────────────────────────────────────
/**
 * Remove citation artefacts like [cite: 12] that can leak from AI tooling.
 * Safe to apply at render time — has no effect if the pattern is absent.
 */
export function cleanRichContent(raw: string): string {
  if (!raw) return '';
  // Pega[cite: 1], [Cite: 1, 2], e até os antigos 【4:2†source】
  return raw.replace(/\[cite[^\]]*\]|【[^\]]*】/gi, '');
}
// ── YouTube Videos ────────────────────────────────────────────────────────────

export interface YouTubeVideo {
  id: string
  title: string
  description: string
  /** ID do vídeo no YouTube. Ex: para https://youtu.be/aircAruvnKk → 'aircAruvnKk' */
  youtubeId: string
  /** Tag de categoria exibida no card */
  tag: string
}

export const youtubeVideos: YouTubeVideo[] = [
  {
    id: 'vid-1',
    title: 'Infinito em uma Fração - Dízimas Periódicas - Versão 2',
    description: 'O 0,999... é realmente igual a 1? Exploramos um dos conceitos mais fascinantes da matemática: as dízimas periódicas e o conceito de infinito contido em números aparentemente simples.',
    youtubeId: 'SMc1eWC66XI',
    tag: 'Matemática · Infinito',
  },
  {
    id: 'vid-2',
    title: 'Dízimas Periódicas e o Infinito: Uma Jornada Filosófica e Matemática',
    description: 'Você já parou para pensar que a matemática pura pode ser um portal direto para a filosofia e a evolução humana? Mergulhamos no universo das dízimas como uma forma de entender o nosso lugar no mundo.',
    youtubeId: 'Ayhg1fQEwuY',
    tag: 'Matemática · Filosofia',
  },
  {
    id: 'vid-3',
    title: 'O Equilíbrio Perfeito: Como Mudar Sua Visão Sobre a Matemática',
    description: 'Você já sentiu ansiedade ao estudar matemática? Descubra como ela pode deixar de ser a "vilã" da história para se tornar uma parceira no desenvolvimento do pensamento crítico e da contemplação.',
    youtubeId: 'bRHFaC2SiqA',
    tag: 'Educação · Filosofia',
  },
  {
    id: 'vid-4',
    title: 'Esqueça a Decoreba: O Verdadeiro Sentido da Álgebra e da Vida',
    description: 'Vamos desconstruir tudo o que te ensinaram sobre as ciências exatas e transformar o cálculo em uma experiência filosófica, estética e libertadora. Entenda o verdadeiro significado do sinal de igual.',
    youtubeId: '-kqrR1auDYs',
    tag: 'Matemática · Ensino',
  },
  {
    id: 'vid-5',
    title: 'A Matemática Oculta da Realidade: Do Paradoxo dos 60% à Geometria da Empatia',
    description: 'Exploramos a matemática invisível que rege quase tudo ao nosso redor, desde o mercado financeiro até a física das alavancas, e como o nosso cérebro frequentemente se engana na lógica estrutural.',
    youtubeId: 'c8-i_PBTF7Q',
    tag: 'Matemática · Realidade',
  },
  {
    id: 'vid-6',
    title: 'A Geometria da Vida: Da Proporção Matemática à Empatia Humana',
    description: 'Um resgate histórico e filosófico da matemática. Pare de enxergar a vida de forma puramente linear e utilitária, e passe a compreendê-la através de uma "geometria curva e empática".',
    youtubeId: '1t5IGD2jUGM',
    tag: 'Matemática · História',
  },
  {
    id: 'vid-7',
    title: 'IA contra a Burocracia Escolar: Conheça o Assistente Modelo e o Escudo RAG',
    description: 'A maior ameaça à educação hoje não é a falta de tecnologia, mas a burocracia extrema. Conheça como a IA atua como um "triturador de burocracia" para devolver tempo aos professores.',
    youtubeId: 'dX5yKonrWP4',
    tag: 'IA · Educação',
  },
  {
    id: 'vid-8',
    title: 'O Segundo Atual: Como a Inteligência Artificial Pode Humanizar o Ensino',
    description: 'Mergulhe em uma proposta revolucionária: usar a IA com o "Escudo RAG" para destruir a burocracia e resgatar o momento presente de conexão real entre professor e aluno.',
    youtubeId: 'yC34sSWONd0',
    tag: 'IA · Sociedade',
  },
  {
    id: 'vid-9',
    title: 'A Regra de Ouro: Da Índia Antiga ao Mundo Digital',
    description: 'Para muitos, a Regra de Três é apenas multiplicar em cruz. Ilustramos visualmente por que esse pensamento é uma armadilha e como ele nos impede de ver a harmonia por trás dos números.',
    youtubeId: 'xudn8fRCxFo',
    tag: 'Matemática · Regra de Três',
  },
  {
    id: 'vid-10',
    title: 'Muito Além do X: A História e a Psicologia da Regra de Três',
    description: 'Vamos desconstruir o famoso "multiplica cruzado e isola o x". Descubra como a Regra de Três não é apenas um truque de cálculo, mas sim a arquitetura invisível do raciocínio lógico moderno.',
    youtubeId: 'kCbV5S4025Q',
    tag: 'Matemática · História',
  },

  {
    id: 'vid-11',
    title: 'Das Pirâmides aos Pixels: O Código-Fonte Oculto dos Números Quebrados',
    description: `Você já sentiu aquele frio na barriga ao encarar uma conta com frações? E se a gente te dissesse que a matemática escolar, na verdade, esconde uma linguagem de sobrevivência usada há milênios? 🤯

No episódio de hoje, nós vamos hackear a "Arquitetura dos Números Quebrados". Esqueça a decoreba de regras sem sentido! Nós vamos te mostrar como a matemática não é só para passar na prova, mas sim o verdadeiro código-fonte da realidade.`,
    youtubeId: '-L35Tk_OJZk',
    tag: 'Matemática · História',
  },

  {
    id: 'vid-12',
    title: 'Das Pirâmides aos Pixels: O Código-Fonte Oculto dos Números Quebrados',
    description: `Você já sentiu aquele frio na barriga ao encarar uma conta com frações? E se a gente te dissesse que a matemática escolar, na verdade, esconde uma linguagem de sobrevivência usada há milênios? 🤯

No episódio de hoje, nós vamos hackear a "Arquitetura dos Números Quebrados". Esqueça a decoreba de regras sem sentido! Nós vamos te mostrar como a matemática não é só para passar na prova, mas sim o verdadeiro código-fonte da realidade.`,
    youtubeId: '6oPs6wJaisQ',
    tag: 'Matemática · História',
  },


  {
    id: 'vid-13',
    title: 'A Álgebra que Cura Ossos e o Verdadeiro Significado do Sinal de Igual (=)',
    description: `Neste episódio, mergulhamos na fascinante e turbulenta história da matemática para desconstruir a ideia de que ela é feita apenas de regras frias e sem sentido. Em uma verdadeira viagem no tempo, vamos descobrir como o simples ato de resolver uma equação tem tudo a ver com a cura do nosso próprio corpo e da nossa mente.`,
    youtubeId: '9BasdznhftA',
    tag: 'Matemática · História',
  },


  {
    id: 'vid-14',
    title: 'A Álgebra que Cura Ossos e o Verdadeiro Significado do Sinal de Igual (=)',
    description: `Neste episódio, mergulhamos na fascinante e turbulenta história da matemática para desconstruir a ideia de que ela é feita apenas de regras frias e sem sentido. Em uma verdadeira viagem no tempo, vamos descobrir como o simples ato de resolver uma equação tem tudo a ver com a cura do nosso próprio corpo e da nossa mente.`,
    youtubeId: 'tznZ7rZ3IGA',
    tag: 'Matemática · História',
  },
  {
    id: 'vid-15',
    title: `O Fim do Labirinto Burocrático: A Investigação sobre o Assistente Escola Modelo`,
    description: `Descubra como a Inteligência Artificial está sendo usada para solucionar um dos maiores mistérios da educação moderna: o desaparecimento do tempo dos professores!`,
    youtubeId: 'j3sf_kZuDD4',
    tag: 'IA · Educação',
  },
  {
    id: 'vid-16',
    title: `O Fim do Labirinto Burocrático: A Investigação sobre o Assistente Escola Modelo`,
    description: `Descubra como a Inteligência Artificial está sendo usada para solucionar um dos maiores mistérios da educação moderna: o desaparecimento do tempo dos professores!`,
    youtubeId: 'sLhxml3Lfok',
    tag: 'IA · Educação',
  },
  {
    id: 'vid-17',
    title: 'A Regra de Ouro: O Código Oculto da Matemática e a Tragédia do "Multiplica Cruzado"',
    description: 'Esqueça a decoreba. O que te ensinaram na escola foi apenas um atalho mecânico que roubou a essência de uma das ferramentas cognitivas mais poderosas da humanidade. Mergulhamos nas areias da antiga Rota da Seda.',
    youtubeId: 'rCAid3r_Oqc',
    tag: 'Matemática · Regra de Três',
  },
  {
    id: 'vid-18',
    title: 'Muito Além do X: A Filosofia da Regra de Três (Podcast Heiss-Lab)',
    description: 'Em formato de podcast, mergulhamos em uma conversa profunda sobre como os mercadores antigos operavam como supercomputadores biológicos e como a proporção inversa nos ensina sobre colaboração e empatia.',
    youtubeId: 'cMHIW0I65_4',
    tag: 'Matemática · Podcast',
  },
  {
    id: 'vid-19',
    title: 'The Architecture of Abstraction (Twin Lines)',
    description: 'An alternative hip-hop anthem exploring the history of algebra, from the medical origins of Al-jabr to the invention of the equals sign and the bloody academic duels of the Renaissance.',
    youtubeId: 'tWRGW75IQQ4',
    tag: 'Música · Álgebra (EN)',
  },
  {
    id: 'vid-20',
    title: 'A Arquitetura da Abstração (O Som da Balança)',
    description: 'Um boom-bap épico sobre a história da abstração matemática, a Casa da Sabedoria em Bagdá e como os atalhos modernos destruíram o verdadeiro significado do sinal de igual.',
    youtubeId: '4NcRy6x9Qjc',
    tag: 'Música · Álgebra (PT)',
  },
  {
    id: 'vid-21',
    title: 'O Número Quebrado (A Arquitetura da Fração)',
    description: 'Uma jornada musical desde o Olho de Hórus no Egito até os códigos modernos de CSS e compressão de dados, desconstruindo a decoreba letal do "inverte e multiplica".',
    youtubeId: 'soGhq-wpNMA',
    tag: 'Música · Frações (PT)',
  },
  {
    id: 'vid-22',
    title: 'The Broken Number (Architecture of the Fraction)',
    description: 'A driving boom-bap track explaining the cognitive hurdles and the real-world architecture of fractions. Stop memorizing the rule, understand the design!',
    youtubeId: '5a4b__xZdz4',
    tag: 'Música · Frações (EN)',
  },
  {
    id: 'vid-23',
    title: 'The Fiction of the Frictionless (The Golden Rule)',
    description: 'A conscious hip-hop track criticizing the rote memorization of the Rule of Three and advocating for true intellectual friction to build cognitive resilience.',
    youtubeId: 'wDc7e6P0XSE',
    tag: 'Música · Proporção (EN)',
  },
  {
    id: 'vid-24',
    title: 'A Fricção do Pensamento (A Regula Aurea)',
    description: 'Um manifesto musical sobre o Supercomputador Biológico da Rota da Seda e a tragédia do atalho na educação. Descubra o valor de UM e fuja do lugar comum!',
    youtubeId: 'hjtSPLkwaeQ',
    tag: 'Música · Proporção (PT)',
  },
  {
    id: 'vid-25',
    title: 'The Ballad of the Absurd Root',
    description: 'No digital crutch, no external drive, just a five-fingered memory keeping logic alive. A musical journey exploring the history of negative numbers and the cognitive act of subtraction.',
    youtubeId: 'yExTHV0_7XU',
    tag: 'Música · Matemática (EN)',
  },
  {
    id: 'vid-26',
    title: 'A Lógica Oculta dos Números Negativos e o Perigo da Atrofia Mental',
    description: 'Mergulhamos na história da matemática para entender como mentes brilhantes da Europa sofreram para aceitar os números negativos, enquanto civilizações antigas resolveram isso muito antes.',
    youtubeId: 'EjH6ERFmNDk',
    tag: 'Matemática · História',
  },
  {
    id: 'vid-27',
    title: 'A Lógica Oculta dos Números Negativos | Podcast',
    description: 'Podcast: O Bloqueio Europeu, a Armadilha Geométrica, a Solução Oriental das varetas, e a lógica financeira de que cancelar uma dívida resulta em um alívio.',
    youtubeId: 'UjZtVDo-VeE',
    tag: 'Podcast · Matemática',
  },
  {
    id: 'vid-28',
    title: 'O Peso do Conceito (A Descoberta do Negativo)',
    description: 'A nossa biologia é a mesma, não houve evolução. Um rap investigativo que desvenda o "absurdo" dos números negativos e alerta para o perigo da atrofia mental.',
    youtubeId: 'XnFRvCtkqKg',
    tag: 'Música · Matemática (PT)',
  },
  {
    id: 'vid-29',
    title: 'Mente, Matemática e Máquina: A Tecnologia Está Atrofiando Nosso Raciocínio? | Podcast',
    description: 'O custo invisível da conveniência digital. Discutimos a epidemia de atrofia cognitiva causada pela IA e a necessidade do esforço neural pelo mecanismo de Grokking.',
    youtubeId: 'JaiVcCQg4VI',
    tag: 'Podcast · Educação',
  },
  {
    id: 'vid-30',
    title: 'Mente, Matemática e Máquina: A Tecnologia Está Atrofiando Nosso Raciocínio?',
    description: 'A tecnologia que deveria nos impulsionar está enferrujando nossa rede neural. Descubra como transformar decoreba em lógica usando a analogia financeira.',
    youtubeId: 'AkJHlGzm5ao',
    tag: 'Educação · IA',
  },
  {
    id: 'vid-31',
    title: 'The Cognitive Cathedral',
    description: 'Embrace the productive struggle, let the neurons ignite. A powerful track defending the waking brain against algorithmic sleep and epistemic atrophy. Use it or lose it!',
    youtubeId: 'Ur-eqYRa8tA',
    tag: 'Música · Filosofia (EN)',
  }
];

// ── Lesson Plans ──────────────────────────────────────────────────────────────

export interface LessonPlan {
  id: string
  /** URL slug para roteamento dinâmico. Ex: 'vieses-dos-numeros' → /repositorio/vieses-dos-numeros */
  slug: string
  title: string
  /** Disciplina principal (Matemática, Tecnologia, etc.) */
  subject: string
  /** Faixa etária / público-alvo */
  grade: string
  description: string
  /**
   * Conteúdo rico em Markdown com suporte a LaTeX.
   * Use $...$ para equações inline e $$...$$ para equações em bloco.
   */
  richContent: string
  /**
   * Caminho do arquivo PDF relativo à pasta /public.
   * Ex: '/pdfs/meu-arquivo.pdf' → arquivo em public/pdfs/meu-arquivo.pdf
   */
  pdfPath: string
  pages: number
  /** Se true, mostra o botão de download na página de leitura. */
  available: boolean
}

export const lessonPlans: LessonPlan[] = [
  {
    id: 'plan-1',
    slug: 'equacao-balanca',
    title: 'O Segredo da Balança: A Filosofia do Sinal de Igual',
    subject: 'Matemática',
    grade: '7°ano ao 9°ano',
    description: 'Esqueça tudo o que você acha que sabe sobre o sinal de igual (=). Descubra como a álgebra funciona usando o princípio inquebrável da balança perfeita!',
    pdfPath: '/pdfs/Equacao_00.pdf',
    pages: 2,
    available: true,
    richContent: String.raw`
## O Segredo da Balança: A Filosofia do Sinal de Igual

Esqueça tudo o que você acha que sabe sobre o sinal de igual ($=$). Desde que você era criança, talvez tenham te ensinado que o sinal de igual é um botão de "ação", como a tecla "Enter" da calculadora, que diz: "Me dê o resultado da conta!". Isso é uma mentira.

O sinal de igual não é uma máquina de resultados. Ele é uma balança perfeita. Quando escrevemos $A = B$, estamos dizendo ao universo que o peso do que está do lado esquerdo é exatamente o mesmo peso do que está do lado direito. Não importa se um lado parece uma bagunça de números e letras e o outro é apenas um número simples. A balança está em perfeito equilíbrio.

O nosso objetivo na álgebra não é "fazer a conta". O nosso objetivo é ser o guardião da balança. Nós podemos fazer qualquer coisa com os números: podemos somar, subtrair, multiplicar e dividir. Temos infinitas possibilidades! Mas existe uma única regra sagrada: tudo o que você fizer de um lado da balança, você precisa fazer do outro lado. Se você tira 5 quilos da esquerda, tem que tirar 5 quilos da direita. Se a balança pender para um lado, o processo não vale mais nada, e a verdade se perde.

O seu processo, a forma como você resolve o problema, é tão importante quanto o resultado final. Vamos treinar a arte do equilíbrio. Encontre o valor do número desconhecido (que chamaremos de $x$, a nossa "caixa misteriosa") mantendo a balança sempre reta!

### PARTE 1: O Aprendiz da Balança (Equações já montadas)

Nesta primeira parte, o universo já traduziu o problema para a linguagem da balança para você. O seu trabalho é descobrir o valor de $x$ manipulando os dois lados igualmente.

* **I. O Mistério das Maçãs:** Na despensa, havia uma caixa misteriosa com $x$ maçãs. Alguém colocou mais 4 maçãs lá dentro, e agora, ao contar tudo, temos exatamente 12 maçãs. Quantas maçãs havia na caixa originalmente? Equação da balança: $$x + 4 = 12$$
* **II. A Divisão do Tesouro:** Um grupo de piratas encontrou um baú com moedas de ouro (representadas por $x$). Eles dividiram as moedas igualmente entre 3 piratas, e cada um foi para casa com 15 moedas. Quantas moedas havia no baú? Equação da balança: $$\frac{x}{3} = 15$$
* **III. O Motorista do Futuro:** Um motorista de aplicativo usa um carro híbrido ultratecnológico. Em uma viagem, o carro consumiu 5 litros de gasolina pura e mais uma quantidade desconhecida $x$ de energia da bateria. No total, o carro gastou o equivalente a 12 "unidades de energia" para fazer a corrida. Qual foi o gasto só da bateria? Equação da balança: $$5 + x = 12$$
* **IV. A Torre de Defesa:** Um programador está criando um jogo de videogame. O jogador ganha 50 pontos por cada monstro derrotado. Sabendo que o jogador derrotou $x$ monstros e terminou a fase com 300 pontos, quantos monstros ele eliminou? Equação da balança: $$50 \cdot x = 300$$
* **V. A Fornada de Pães:** Uma padeira talentosa faz pães artesanais maravilhosos. Ela assou uma quantidade $x$ de pães de manhã, mas vendeu 8 logo de cara. No cesto, sobraram 22 pães. Quantos pães ela assou no total? Equação da balança: $$x - 8 = 22$$
* **VI. O Assistente Escolar:** Um aplicativo assistente-escola disparou notificações para as famílias dos alunos. Ontem ele mandou $x$ notificações. Hoje, para garantir que os pais vissem, ele mandou o dobro de mensagens de ontem ($2x$). No total dos dois dias, foram enviadas 150 mensagens. Quantas mensagens ele mandou ontem? Equação da balança: $$x + 2x = 150 \rightarrow 3x = 150$$
* **VII. O Enigma do Tempo:** O triplo da idade do meu irmão ($x$) menos 5 anos é igual a 25 anos. Qual é a idade dele? Equação da balança: $$3x - 5 = 25$$
* **VIII. O Ritmo da Caminhada:** Uma pessoa quer atingir a meta diária de passos. Ela já deu $x$ passos de manhã. À tarde, ela caminhou mais 4.000 passos, atingindo a marca exata de 9.000 passos no dia. Quantos passos ela deu de manhã? Equação da balança: $$x + 4000 = 9000$$
* **IX. O Custo da Viagem:** Para uma viagem às montanhas de Serra Negra, 4 amigos alugaram uma van. O custo total do aluguel ($x$) foi dividido igualmente entre os 4, e cada um pagou 80 reais. Qual era o valor total do aluguel? Equação da balança: $$\frac{x}{4} = 80$$
* **X. O Construtor Voluntário:** Em uma obra voluntária, você está misturando massa. Você colocou 3 sacos de cimento e $x$ pás de areia na betoneira. Ao todo, a mistura rendeu 18 medidas de material. Quantas pás de areia você colocou? Equação da balança: $$x + 3 = 18$$

### PARTE 2: O Mestre da Balança (Monte e Resolva)

Agora não há mais rodinhas de treinamento. Leia o problema, traduza o texto para a "linguagem da balança" (monte a equação) e depois resolva para encontrar o $x$. Lembre-se: o que fizer de um lado, faça do outro!

* **XI.** Pensei em um número mágico. Quando eu multiplico esse número por 4, o resultado na balança é 36. Que número é esse?
* **XII.** A professora de matemática tinha um pacote de folhas sulfites novas. Ela usou 15 folhas para imprimir uma atividade super legal e sobraram 85 folhas no pacote. Quantas folhas havia no pacote antes da impressão?
* **XIII.** O dobro de um número misterioso, somado com 10, resulta em 50. Que número é esse?
* **XIV.** Em uma escola, o número total de alunos ($x$) foi dividido em 5 salas iguais. Se cada sala ficou com 32 alunos, qual é o número total de alunos da escola?
* **XV.** A metade da idade de uma pessoa é igual a 17 anos. Quantos anos essa pessoa tem?
* **XVI.** Um programador está desenvolvendo um painel financeiro. Ele percebeu que o custo diário fixo do aplicativo é um valor misterioso $x$. Se ele multiplicar esse custo por 7 dias, o servidor vai cobrar 140,00 reais na semana. Qual é o custo diário $x$?
* **XVII.** O triplo de um número secreto, menos 12, dá exatamente zero na balança. Qual é o número secreto?
* **XVIII.** Uma caixa d'água tinha uma quantidade $x$ de litros. Foram consumidos 250 litros durante o dia e, no final da tarde, restaram 500 litros. Qual era a quantidade de água no início do dia?
* **XIX.** Se eu pegar o meu salário mensal, dividir por 4 e usar essa quantia para pagar a prestação do meu carro, eu pagarei exatamente 600 reais. Qual é o valor do meu salário?
* **XX. O Desafio Final:** O sêxtuplo (6 vezes) de um número, somado a 15, equilibra perfeitamente na balança com o número 75. Qual é o valor desse número para que a balança não despenque?
`
  },

  {
    id: 'plan-2',
    slug: 'equacoes-maquina-do-tempo',
    title: 'A Balança da Vida: A Máquina do Tempo das Equações',
    subject: 'Matemática',
    grade: '7°ano ao 9°ano',
    description: 'Aprenda a resolver equações mais complexas usando o conceito de viagem no tempo. Desfaça as ações matemáticas passo a passo para isolar o X.',
    pdfPath: '/pdfs/Equacao_01.pdf',
    pages: 2,
    available: true,
    richContent: String.raw`
## A Balança da Vida: Toda Ação Tem Uma Reação

Vamos continuar na amplificação da nossa balança para o bem do nosso aprendizado. Essa é uma regra que devemos sempre levar para a vida: toda ação tem uma reação[cite: 72]. Muitas vezes, quando algo dá errado, é fácil apontar o dedo[cite: 73]. Mas a verdade é que nós devemos carregar a nossa parte dessa responsabilidade. A culpa não é só dos outros. Precisamos começar a processar os nossos erros segundo a segundo[cite: 74, 75].

Se o problema parece grande, nós podemos fracionar (dividir) o processo para produzir um resultado útil. Até de um grande erro nós podemos extrair algo positivo, desde que a gente processe as falhas com facilidade e sem orgulho[cite: 77]. Se for preciso, a gente fraciona o problema para deixar o resultado final equilibrado[cite: 78]. O universo vai equilibrar a balança de qualquer forma, mas você não precisa usar uma balança quebrada pelo orgulho ou pelo medo de errar[cite: 79]. A sua balança pode e deve estar sempre equilibrada e harmoniosa! [cite: 80]

### Dicas Rápidas: A Máquina do Tempo

Para achar o valor do $x$, nós vamos fazer o processo de voltar no tempo. Pense o seguinte: antes de eu pagar uma conta, ou ganhar um dinheiro, o que aconteceu primeiro? [cite: 83]

* **PASSO 1: Desfaça as ações mais recentes!** Faça o processo da adição ou da subtração primeiro. Tire o peso extra da balança ou devolva o que foi tirado.
* **PASSO 2: O Jogo da Tabuada!** Agora chegou a vez da multiplicação e da divisão. Olhe para a balança limpa e tente entender no português: "Que número vezes 3 dá 15?" [cite: 86] Ou "Qual número dividido por 2 dá 10?"[cite: 87].
* **PASSO 3: Escreva!** Depois de entender na cabeça, escreva como você faria o processo matemático passo a passo para chegar nessa balança equilibrada.

### PARTE 1: O Viajante do Tempo (Equações Montadas)

O universo já traduziu o problema[cite: 89]. Lembre-se: desfaça a adição/subtração primeiro, e depois resolva a multiplicação/divisão! [cite: 90]

* **1. O Triplo do Esforço:** O triplo da idade do meu irmão ($3x$) menos 5 anos de desconto, resulta em 31 anos na balança[cite: 91]. Qual é a idade verdadeira dele? Equação: $$3x - 5 = 31$$ [cite: 92]
* **2. A Metade do Tesouro:** Um pirata pegou a metade das moedas do baú ($\frac{x}{2}$) e depois encontrou mais 10 moedas caídas no chão[cite: 93]. Agora ele tem 40 moedas. Quantas moedas o baú tinha no começo? Equação: $$\frac{x}{2} + 10 = 40$$ [cite: 94]
* **3. O Motorista Estrategista:** Um motorista fez 4 corridas com o mesmo valor ($4x$)[cite: 95]. No caminho, ele gastou 20 reais almoçando. No final, sobraram 60 reais de lucro livre[cite: 96]. Qual foi o valor de cada corrida? Equação: $$4x - 20 = 60$$ [cite: 97]
* **4. A Fornada Gigante:** A padeira assou pães e guardou a terça parte ($\frac{x}{3}$) na vitrine[cite: 98]. Depois, ela colocou mais 15 pães de queijo junto. A vitrine ficou com 35 itens[cite: 99]. Quantos pães ela assou no total? Equação: $$\frac{x}{3} + 15 = 35$$ [cite: 100]
* **5. O Jogo de Videogame:** No jogo, o dobro da sua pontuação ($2x$), mais um bônus de 50 pontos, fez você atingir a marca de 250 pontos na fase[cite: 101]. Qual era a sua pontuação antes do bônus? Equação: $$2x + 50 = 250$$ [cite: 102]
* **6. O Mistério do Caderno:** Eu peguei o número de páginas em branco ($x$), dividi por 4 para dar aos meus amigos ($\frac{x}{4}$), e uma página rasgou (menos 1)[cite: 103]. Sobraram 9 páginas boas para cada um. Quantas páginas em branco existiam? Equação: $$\frac{x}{4} - 1 = 9$$ [cite: 104]
* **7. Caixas de Suprimento:** Cinco caixas misteriosas de itens ($5x$) mais 12 itens soltos no chão somam 72 itens no total[cite: 105]. Quantos itens vêm dentro de cada caixa? Equação: $$5x + 12 = 72$$ [cite: 106]
* **8. A Viagem de Van:** O custo do aluguel da van foi dividido por 5 pessoas ($\frac{x}{5}$)[cite: 107]. Cada pessoa teve que pagar mais 15 reais de pedágio. No fim, cada um gastou 65 reais[cite: 108]. Qual era o valor do aluguel da van? Equação: $$\frac{x}{5} + 15 = 65$$ [cite: 109]
* **9. A Velocidade do Processador:** O sêxtuplo (6 vezes) da velocidade de processamento de um computador ($6x$) menos 10 segundos de atraso dá exatamente 50 segundos[cite: 110]. Qual é a velocidade base? Equação: $$6x - 10 = 50$$ [cite: 111]
* **10. A Construção Voluntária:** A metade dos sacos de cimento ($\frac{x}{2}$) mais 7 pás de areia rendeu 22 baldes de massa perfeita[cite: 112]. Quantos sacos de cimento tínhamos no total? Equação: $$\frac{x}{2} + 7 = 22$$ [cite: 113]

### PARTE 2: O Guardião da Balança (Monte e Resolva)

A rodinha da bicicleta saiu! [cite: 114] Leia o problema em português, monte a sua equação da balança e faça a viagem no tempo para encontrar o $x$[cite: 115].

* **11.** O dobro de um número misterioso, somado com 14, deixa a balança cravada em 50. Que número é esse? [cite: 116]
* **12.** A metade dos alunos de uma sala de aula, menos 3 alunos que faltaram hoje, resulta em 17 alunos presentes[cite: 117]. Quantos alunos essa sala tem no total? [cite: 118]
* **13.** Pensei em um número. Multipliquei esse número por 4, gastei 20 e ainda me sobraram 60. Qual foi o número que eu pensei? [cite: 119]
* **14.** A terça parte da distância de uma viagem, mais 10 quilômetros rodados de bônus, é igual a 30 quilômetros. Qual é a distância total da viagem? [cite: 120, 121]
* **15.** Se eu multiplicar a força de um robô por 5 e depois adicionar 100 pontos de energia, ele fica com 600 pontos de força total[cite: 122]. Qual é a força base do robô? [cite: 123]
* **16.** A idade de uma pessoa multiplicada por 3, menos 8 anos, é igual a 34 anos[cite: 124]. Descubra a idade dessa pessoa[cite: 125].
* **17.** O dobro da capacidade de um tanque de água, mais 15 litros da chuva, totaliza 95 litros[cite: 126]. Quantos litros cabem no tanque inteiro? [cite: 127]
* **18.** A quarta parte dos blocos de montar, menos 5 blocos que vieram quebrados, resultam em 20 blocos perfeitos[cite: 128]. Quantos blocos vieram na caixa original? [cite: 129]
* **19.** Sete vezes um número mágico, somado a 3, deixa a balança equilibrada no número 73. Encontre o número mágico[cite: 130].
* **20. DESAFIO FINAL:** A metade das páginas de um livro, somada com 15 páginas que eu já tinha lido ontem, resulta em 65 páginas[cite: 131]. Quantas páginas tem o livro inteiro? [cite: 132]
`
  },

  {
    id: 'plan-3',
    slug: 'fracoes-operacoes',
    title: 'Operações Aritméticas com Frações: A Construção da Balança',
    subject: 'Matemática',
    grade: '7°ano ao Ensino Médio',
    description: 'Entenda a essência dos raciocínios matemáticos impressos nas funções e nas partes das coisas. Fazer contas com razões e proporções nunca foi tão fascinante.',
    pdfPath: '/pdfs/00-fracoes.pdf',
    pages: 2,
    available: true,
    richContent: String.raw`
## Operações Aritméticas com Frações! A Minha Paixão!

A essência dos raciocínios impressos nas funções e papéis das coisas. Sem resolver esse tipo de operação, a gente não entende nada; somos vítimas de nossos próprios sentimentos, sem entender a eternidade das coisas, ou a eternidade do sistema em que estamos, enquanto ainda estamos nele.

Frações! Razões e Proporções! A soma e a subtração das partes de diferentes razões. Fazer contas nunca foi tão fascinante. Quando operamos com razões e proporções, iniciamos a construção da balança perfeita. É a arte de pegar o que está quebrado, o que é apenas uma parte, e encontrar o seu lugar no todo.

### Exercícios Práticos

1 - **A ADMINISTRAÇÃO DO TEMPO:** Um estudante dedica $\frac{1}{3}$ do seu dia ao sono, $\frac{1}{4}$ aos estudos e $\frac{1}{8}$ ao lazer. Que fração do dia ainda lhe sobra para outras atividades?

2 - **O DESAFIO DA CONSTRUÇÃO:** Em uma obra do SENAI, um pedreiro constrói $\frac{1}{4}$ de um muro no primeiro dia e $\frac{2}{5}$ do mesmo muro no segundo dia. Que fração do muro ainda falta ser construída?

3 - **PRODUÇÃO CASEIRA:** Uma senhora adora fazer grandes levas de pão caseiro, preparando 3 kg de massa por vez. Se ela utiliza $\frac{1}{5}$ dessa massa para fazer pães recheados e divide o restante em porções exatas de $\frac{1}{4}$ de quilo para pães simples, quantos pães simples ela consegue modelar?

4 - **O TANQUE DE COMBUSTÍVEL:** O marcador de combustível de um veículo indica que o tanque está com $\frac{3}{8}$ da sua capacidade. Após abastecer com 20 litros, o tanque passa a registrar $\frac{5}{8}$. Qual é a capacidade total, em litros, desse tanque?

5 - **DIVISÃO DE HERANÇA:** Uma herança foi dividida entre três irmãos. O primeiro recebeu $\frac{1}{2}$ do total, o segundo recebeu $\frac{1}{3}$ do total, e o terceiro recebeu os 15.000,00 reais restantes. Qual era o valor total da herança?

6 - **A TURMA DO VESTIBULINHO:** Em uma sala de aula, $\frac{3}{5}$ dos alunos são meninas. Se há 16 meninos na sala, qual é o total de alunos nessa turma?

7 - **TORNEIRAS E RAZÕES:** Uma torneira enche um reservatório em 3 horas, enquanto uma segunda torneira o enche em 6 horas. Se ambas forem abertas simultaneamente, em que fração de tempo (em horas) o reservatório estará completamente cheio?

8 - **A BIBLIOTECA:** De todos os livros de uma biblioteca, $\frac{1}{4}$ são de matemática, $\frac{2}{5}$ são de literatura e os 350 restantes são de ciências. Quantos livros de matemática existem nessa biblioteca?

9 - **DESCONTO NO SALÁRIO:** Um trabalhador tem $\frac{1}{10}$ do seu salário descontado para a previdência e $\frac{1}{5}$ descontado para o plano de saúde. Sabendo que após os descontos ele recebe 2.100,00 reais, qual é o seu salário bruto?

10 - **A ENGRENAGEM:** Em um sistema mecânico, uma engrenagem gira $\frac{3}{4}$ de volta a cada segundo. Quantas voltas completas ela dará após 12 segundos contínuos de funcionamento?

11 - **A VIAGEM DE CARRO:** Uma família percorreu $\frac{2}{7}$ de uma viagem no primeiro dia e $\frac{3}{5}$ do restante da viagem no segundo dia. Que fração do trajeto total ainda falta percorrer?

12 - **A MISTURA QUÍMICA:** Um técnico de laboratório mistura $\frac{1}{2}$ litro de uma solução A com $\frac{3}{4}$ de litro de uma solução B. Dessa mistura total, ele retira $\frac{1}{3}$ para um experimento. Qual é o volume, em litros, que sobrou no recipiente original?

13 - **ELEIÇÕES ESCOLARES:** Em uma eleição para o grêmio estudantil, o candidato vencedor obteve $\frac{5}{8}$ dos votos válidos, e o candidato perdedor obteve 240 votos. Sabendo que não houve votos nulos ou em branco, quantos alunos votaram?

14 - **COLHEITA:** Dois agricultores estão colhendo laranjas. O primeiro colhe $\frac{1}{3}$ da plantação em 4 dias. O segundo colhe $\frac{1}{4}$ da plantação em 2 dias. Se trabalharem juntos, que fração da plantação eles colherão em 1 dia?

15 - **ORÇAMENTO MENSAL:** Uma família gasta $\frac{2}{5}$ do seu orçamento com alimentação e $\frac{1}{4}$ com aluguel. Se eles conseguem guardar 700,00 reais, que correspondem ao restante do orçamento, qual é a renda total dessa família?

16 - **RENDIMENTO DE MATERIAL:** Uma peça de tecido tem 12 metros. Um alfaiate usa $\frac{2}{3}$ desse tecido para fazer calças e $\frac{1}{4}$ do que sobrou para fazer bermudas. Quantos metros de tecido não foram utilizados?

17 - **O ESPORTISTA:** Durante um treino, um atleta corre $\frac{3}{5}$ do percurso e caminha o restante. Se a parte em que ele caminhou corresponde a 4 km, qual é a distância total do percurso?

18 - **A RECEITA DO SUCESSO:** Uma receita de bolo pede $\frac{3}{4}$ de xícara de açúcar. Se quisermos fazer uma receita e meia (1,5) para uma festa, quantas xícaras de açúcar, em forma de fração imprópria, serão necessárias?

19 - **CAIXA D'ÁGUA:** Uma caixa d'água de 1.000 litros está com $\frac{4}{5}$ de sua capacidade. Ocorreu um vazamento que esvaziou $\frac{1}{8}$ do volume que estava na caixa. Quantos litros restaram após o vazamento?

20 - **A BALANÇA PERFEITA:** Em uma gangorra (balança), o peso no lado esquerdo é equivalente a $\frac{3}{4}$ do peso total suportado. Para equilibrar a balança adicionando um peso de 15 kg no lado direito, qual deve ser a capacidade total de peso dessa balança?
`
  },

  {
    id: 'plan-4',
    slug: 'dizima',
    title: 'O Infinito na Palma da Mão: O Segredo das Dízimas Periódicas',
    subject: 'Matemática',
    grade: '9°ano ao Ensino Médio',
    description:
      'Você já parou para pensar por que algumas frações representam números decimais infinitos, que não acabam nunca?  Qual é a função desse tipo de número na matemática e no universo?',
    pdfPath: '/pdfs/dizima-00.pdf',
    pages: 6,
    available: true,
    richContent: String.raw`
## O Infinito na Palma da Mão: O Segredo das Dízimas Periódicas

Você já parou para pensar por que algumas frações representam números decimais infinitos, que não acabam nunca?  Qual é a função desse tipo de número na matemática e no universo?

Quando nós estudamos o principal desses números — a dízima completa —, nós encontramos a mecânica perfeita de como o infinito funciona. Mas por que nós temos um certo "medo" das grandezas matemáticas? Quando nos deparamos com muitos noves no denominador (como 9, 99 ou 999), nós logo nos perguntamos: "Mas pode isso? Fica repetindo nove no denominador para sempre? Eu sei que funciona só com um nove, mas a regra vale para infinitos noves para representar dízimas diferentes?"

Sim, minha joia, vale! E a mecânica ajuda a explicar perfeitamente essa função. Nós só ficamos surpresos com essas coisas grandiosas porque, no fundo, somos todos primatas curiosos. Nosso instinto acha que coisas grandiosas ou infinitas são sempre mais difíceis de explicar. Mas a verdade é que o infinito tem um padrão.

Vamos para a mecânica de como engarrafar o infinito!

Imagine o número decimal infinito:
$$0,111111111\dots$$

Nós não sabemos que fração ele é, então vamos chamá-lo de $x$.

$$x = 0,111111111\dots$$

Se a gente multiplicar esse valor por 10, a vírgula anda para o lado:

$$10x = 1,111111111\dots$$

Agora a mágica acontece: vamos tirar apenas um $x$ (que vale $0,1111\dots$) dessa conta gigante. Se de $10x$ eu tiro $1x$, me sobram $9x$. Do outro lado, se de $1,1111\dots$ eu tiro a parte infinita ($0,1111\dots$), me sobra apenas o número 1 inteiro. 

Ficamos com: 

$$10x - x = 1,1111\dots - 0,1111\dots$$

$$9x = 1$$

O 9 que está multiplicando passa dividindo:

$$x = \frac{1}{9}$$

"Ah, mas isso vale para coisas mais grandiosas?" Sim, minha joia! Pense agora no número:

$$0,1212121212\dots$$

Como são DOIS algarismos se repetindo, vamos multiplicar esse $x$ por 100:

$$100x = 12,1212121212\dots$$

Vamos tirar somente o primeiro $x$ ($0,1212\dots$) dessa conta: De $100x$ tira $1x$, sobram $99x$. Da parte dos números, tira o infinito, sobra o 12 perfeito.
$$99x = 12$$

$$x = \frac{12}{99}$$

Essa regra vale sempre! O número de algarismos que se repete é a quantidade exata de noves que você vai colocar no denominador. O instinto primata se acalma, e a lógica domina. Vamos praticar e engarrafar nossos próprios infinitos!

### PARTE 1: O Domador de Noves (Repetição de 1 algarismo)

A regra é simples: coloque o algarismo que se repete na parte de cima (numerador) e um único 9 na parte de baixo (denominador).

* $0,222\dots = \frac{\quad}{\quad}$

* $0,444\dots = \frac{\quad}{\quad}$

* $0,555\dots = \frac{\quad}{\quad}$

* $0,777\dots = \frac{\quad}{\quad}$

* $0,888\dots = \frac{\quad}{\quad}$

* $0,111\dots = \frac{\quad}{\quad}$

* $0,333\dots = \frac{\quad}{\quad}$ (Dica de Ouro: Tente simplificar dividindo em cima e embaixo por 3!)

* $0,666\dots = \frac{\quad}{\quad}$ (Dica de Ouro: Simplifique por 3 também!)

* $0,999\dots = \frac{\quad}{\quad}$ (Desafio: escreva a fração e divida na calculadora para ver a mágica suprema do universo!)

* $1,222\dots = \frac{\quad}{\quad}$ (Dica: Pense que é o número 1 inteiro + a fração do 222...)


### PARTE 2: O Desafio dos Noventa e Nove (Repetição de 2 algarismos)

Se dois algarismos formam o padrão infinito, o nosso escudo será o número 99.

* $0,151515\dots = \frac{\quad}{\quad}$
* $0,232323\dots = \frac{\quad}{\quad}$
* $0,454545\dots = \frac{\quad}{\quad}$
* $0,727272\dots = \frac{\quad}{\quad}$
* $0,818181\dots = \frac{\quad}{\quad}$
* $0,949494\dots = \frac{\quad}{\quad}$
* $0,101010\dots = \frac{\quad}{\quad}$
* $0,505050\dots = \frac{\quad}{\quad}$
* $0,121212\dots = \frac{\quad}{\quad}$
* $2,151515\dots = \frac{\quad}{\quad}$ (Lembre-se: são 2 inteiros acompanhados da fração do 15)

### PARTE 3: O Monstro do 999 (Repetição de 3 algarismos)

O instinto primata pode até tremer quando vê uma repetição tripla, mas a regra não falha: 3 algarismos repetindo = 999 no denominador!

* $0,123123\dots = \frac{\quad}{\quad}$
* $0,456456\dots = \frac{\quad}{\quad}$
* $0,789789\dots = \frac{\quad}{\quad}$
* $0,105105\dots = \frac{\quad}{\quad}$
* $0,998998\dots = \frac{\quad}{\quad}$
* $0,005005\dots = \frac{\quad}{\quad}$
* $0,314314\dots = \frac{\quad}{\quad}$
* $0,700700\dots = \frac{\quad}{\quad}$
* $0,250250\dots = \frac{\quad}{\quad}$
* $5,123123\dots = \frac{\quad}{\quad}$ (5 inteiros mais a fração do 123)

### PARTE 4: A Viagem de Volta (Da Fração para o Infinito)

Agora eu te dou a fração mágica pronta e equilibrada. O seu trabalho é soltar o infinito! Escreva qual é o número decimal que ela gera (não esqueça de colocar as reticências "..." no final).
* $\frac{5}{9} =$ _______________
* $\frac{8}{9} =$ _______________
* $\frac{25}{99} =$ _______________
* $\frac{89}{99} =$ _______________
* $\frac{14}{99} =$ _______________
* $\frac{7}{9} =$ _______________
* $\frac{321}{999} =$ _______________
* $\frac{505}{999} =$ _______________
* $\frac{42}{99} =$ _______________

O Grande Salto: $\frac{1}{3} =$ _______________ (Dica final: Multiplique o topo e a base da fração por 3 para fazer o 9 aparecer no denominador, e só então solte o infinito!)`,
  },

  {
    id: 'plan-8',
    slug: 'magica-porcentagem',
    title: 'O Universo em 100 Partes: A Mágica da Porcentagem',
    subject: 'Matemática',
    grade: '7°ano ao Ensino Médio',
    description: 'Aprenda a comparar as grandezas do universo dividindo-as em 100 partes iguais. Domine os três caminhos mentais para calcular porcentagens rapidamente.',
    pdfPath: '/pdfs/Porcentagem_01.pdf',
    pages: 2,
    available: true,
    richContent: String.raw`
## O Universo em 100 Partes: A Mágica da Porcentagem

Vamos dar mais um passo na nossa jornada de decifrar o mundo. Hoje, vamos falar de representações e grandezas. Como nós podemos comparar o tamanho de um planeta com o tamanho de uma formiga? Como sabemos o quanto evoluímos em um projeto? A resposta é uma só: dividindo o universo em 100 partes iguais!

A porcentagem (por cento, ou seja, dividido por 100) é a nossa lente de aumento mágica. Ela nos ajuda a entender a representação de diferentes valores, seja em decimal, em fração ou em porcentagem. Qualquer valor pode representar uma porcentagem de outro valor!

Pense no incrível mundo microscópico: um fio de cabelo é muito fino, certo? Mas um nanofio (usado em chips de computador e inteligência artificial) é cerca de 10.000 vezes menor que um fio de cabelo. Se o fio de cabelo fosse o nosso 100%, o nanofio representaria apenas 0,01% do tamanho dele! 

Qualquer fração representa uma porcentagem. Se fizermos bem esses cálculos, nós seremos capazes de calcular porcentagens de absolutamente qualquer valor no universo, seja ele do tamanho de uma galáxia ou de um átomo. Não importa o tamanho do desafio, se você dividi-lo em 100 pedaços, ele fica fácil de resolver!

### Dicas Rápidas: Os 3 Caminhos da Porcentagem

* **Caminho 1 (A Fração):** Lembre-se que 50% é a mesma coisa que a metade ($\frac{1}{2}$). 25% é a mesma coisa que dividir por 4 ($\frac{1}{4}$). 10% é só dividir por 10!
* **Caminho 2 (Multiplica e Corta Zeros):** Para achar 20% de 80, multiplique os números ($20 \times 80 = 1600$) e depois divida por 100 (corte dois zeros) = 16. Fácil!
* **Caminho 3 (O Caminho Inverso):** Quando a pergunta for "Quantos porcento representa?", monte uma fração com o menor em cima e o maior embaixo, e multiplique por 100. Exemplo: 2 é quantos % de 10? Fazemos $2 \div 10 = 0,2$ e multiplicamos por $100 = 20\%$!

---

### PARTE 1: O Mestre das Partes (Calcule o valor da porcentagem)

Calcule rapidamente os valores abaixo. Lembre-se das dicas do Sherlock para ganhar tempo!

**1.** A) 10% de 100 = ___
B) 20% de 100 = ___
C) 50% de 100 = ___
D) 75% de 100 = ___

**2.** A) 10% de 50 = ___
B) 20% de 50 = ___
C) 50% de 50 = ___
D) 100% de 50 = ___

**3.** A) 10% de 200 = ___
B) 25% de 200 = ___
C) 50% de 200 = ___
D) 5% de 200 = ___

**4.** A) 10% de 80 = ___
B) 20% de 80 = ___
C) 30% de 80 = ___
D) 40% de 80 = ___

**5.** A) 5% de 40 = ___
B) 15% de 40 = ___
C) 25% de 40 = ___
D) 50% de 40 = ___

**6.** A) 1% de 300 = ___
B) 2% de 300 = ___
C) 3% de 300 = ___
D) 10% de 300 = ___

**7.** A) 50% de 12 = ___
B) 25% de 12 = ___
C) 75% de 12 = ___
D) 100% de 12 = ___

**8.** A) 10% de 150 = ___
B) 20% de 150 = ___
C) 30% de 150 = ___
D) 60% de 150 = ___

**9.** A) 5% de 60 = ___
B) 10% de 60 = ___
C) 15% de 60 = ___
D) 20% de 60 = ___

**10.** A) 1% de 1000 = ___
B) 5% de 1000 = ___
C) 15% de 1000 = ___
D) 99% de 1000 = ___

**11.** A) 2% de 500 = ___
B) 4% de 500 = ___
C) 8% de 500 = ___
D) 12% de 500 = ___

**12.** A) 50% de 44 = ___
B) 25% de 44 = ___
C) 10% de 44 = ___
D) 5% de 44 = ___

**13.** A) 10% de 350 = ___
B) 20% de 350 = ___
C) 50% de 350 = ___
D) 1% de 350 = ___

**14. ULTRAPASSANDO 100%:** A) 110% de 50 = ___
B) 120% de 50 = ___
C) 150% de 50 = ___
D) 200% de 50 = ___

---

### PARTE 2: O Detetive do Universo (Descubra a Porcentagem)

Agora o jogo virou. Eu te dou os dois pedaços e você me diz quantos porcento (%) o primeiro número representa do segundo! (Exemplo: 5 de 10 representa 50%).

**15. O BÁSICO DO 100:** A) 5 é quantos % de 100? ___
B) 12 é quantos % de 100? ___
C) 45 é quantos % de 100? ___
D) 99 é quantos % de 100? ___

**16. A METADE (BASE 50):** A) 5 é quantos % de 50? ___
B) 10 é quantos % de 50? ___
C) 25 é quantos % de 50? ___
D) 50 é quantos % de 50? ___

**17. O DESAFIO DO 20:** A) 2 é quantos % de 20? ___
B) 4 é quantos % de 20? ___
C) 10 é quantos % de 20? ___
D) 15 é quantos % de 20? ___

**18. A BASE 40:** A) 4 é quantos % de 40? ___
B) 10 é quantos % de 40? ___
C) 20 é quantos % de 40? ___
D) 30 é quantos % de 40? ___

**19. A BASE 200 (CORTANDO PELA METADE):** A) 20 é quantos % de 200? ___
B) 50 é quantos % de 200? ___
C) 100 é quantos % de 200? ___
D) 150 é quantos % de 200? ___

**20. DESAFIO SHERLOCK:** A) 3 é quantos % de 12? ___
B) 6 é quantos % de 24? ___
C) 9 é quantos % de 36? ___
D) O que as respostas A, B e C têm em comum? ___
`
  },

  {
    id: 'plan-6',
    slug: 'segredo-divisores',
    title: 'O Segredo dos Números: Por Que o Mundo é Dividido Assim?',
    subject: 'Matemática',
    grade: '6°ano ao 9°ano',
    description: 'Descubra por que medimos o tempo em 60 minutos, o círculo em 360 graus e usamos a base 10 para quase tudo. Uma investigação sobre o superpoder matemático dos divisores.',
    pdfPath: '/pdfs/Divisores-emocionante-00.pdf',
    pages: 2,
    available: true,
    richContent: String.raw`
## O Segredo dos Números: Por Que o Mundo é Dividido Assim?

Você já parou para pensar que muitos números que usamos no nosso dia a dia não foram escolhidos por acaso? A forma como medimos o tempo, o espaço e até as formas geométricas tem tudo a ver com um superpoder matemático: os divisores! 

Por que um dia tem 24 horas, e cada hora tem 60 minutos? Por que não usamos 100 minutos? Simples: imagine se uma hora tivesse 100 minutos e o dia fosse dividido em 10 partes... nosso dia teria 8,64 horas! Não daria para dividir direito! O número 60 é incrível porque ele aceita ser dividido por muitos números sem deixar sobras. Ele é amigável!

E o círculo? Uma volta completa tem 360 graus. Por que 360? Porque ele é um dos campeões absolutos de divisores! Dá para dividir um círculo na metade, em três partes, em quatro, em cinco, em seis... E a lista continua! 

A base 10, que usamos para o nosso dinheiro e para contar (afinal, temos 10 dedos), é muito fácil para multiplicar, mas será que ela é tão boa assim para dividir? Elementar, meu caro Watson! Vamos investigar! 

### Missão 1: Os Senhores do Tempo (24 e 60)

O tempo é governado por números altamente divisíveis. Vamos descobrir o porquê. 

1. Liste todos os divisores naturais do número 24 (as horas do nosso dia). 
2. Agora, liste todos os divisores naturais do número 60 (nossos minutos e segundos). 
3. Conte os divisores: Quantos divisores o 24 tem? E quantos divisores o 60 tem? 
4. Quais são os divisores em comum que o 24 e o 60 compartilham? 
5. Se o nosso dia tivesse apenas 10 horas, quais divisores nós perderíamos em comparação com o dia de 24 horas? (Dica: liste os divisores de 10 e compare com os de 24). 

### Missão 2: A Perfeição da Geometria (12 e 360)

As formas perfeitas exigem divisões perfeitas.

6. A metade de 24 é o famoso número 12, que usamos para os meses do ano e para a dúzia. Liste os divisores de 12.
7. O número 360 é um monstro dos divisores! Ele tem 24 divisores no total. Encontre e escreva pelo menos 10 divisores do número 360.
8. Tente dividir 360 por 7. O que acontece? O 7 é um divisor de 360? Explique. 
9. O número 60 é um divisor de 360? Como você pode provar isso matematicamente? 
10. Filosófica: Se você fosse criar um compasso novo, você preferiria que um círculo tivesse 100 graus ou 360 graus? Use a ideia de "divisores" para defender sua resposta. 

### Missão 3: O Mistério da Base 10

Nós usamos a base 10 para quase tudo, mas será que ela é a melhor opção para a divisão?

11. Liste todos os divisores naturais do número 100. 
12. Compare: Quem ganha a batalha da divisão? O número 100 ou o número 60? Qual deles tem mais divisores? 
13. O número 10 é fácil de multiplicar, mas ele tem poucos divisores. Quais são eles? 
14. Se você tivesse que dividir 10 reais igualmente entre 3 pessoas usando apenas moedas de 1 real, daria certo? E se fossem 12 reais? O que isso nos ensina sobre a diferença entre o 10 e o 12? 
15. Encontre um número menor que 20 que tenha exatamente 6 divisores. 

### Missão 4: Os Rebeldes e os Perfeitos

Nem todo número quer ser dividido. Alguns são solitários, outros são perfeitos. 

16. Alguns números são "rebeldes" e só aceitam ser divididos por 1 e por eles mesmos. Tente encontrar os divisores do número 13. O que acontece? 
17. Como a matemática chama esses números misteriosos que só têm exatamente dois divisores? 
18. O número 1 é divisor de absolutamente todos os números naturais. Por que podemos dizer que ele é o "tijolo universal" da matemática? 
19. Um número é chamado de "perfeito" quando a soma de seus divisores (excluindo ele mesmo) é igual a ele próprio. Por exemplo, os divisores de 6 são 1, 2, 3 e 6. Se somarmos $1+2+3=6$! O número 28 também é perfeito. Encontre os divisores de 28 e prove que essa mágica é real! 
20. Desafio Criativo: Se você pudesse inventar um novo sistema de tempo para um planeta alienígena, qual número você escolheria para ser a quantidade de horas no dia? Escolha um número, explique por que ele tem bons divisores e mostre como seria dividido o dia lá! 
`
  },

  {
    id: 'plan-7',
    slug: 'matematica-elegante-recuperacao',
    title: 'Recuperação: Matemática Elegante e Cálculo Mental',
    subject: 'Matemática',
    grade: '8°ano ao Ensino Médio',
    description: 'Não faça contas enormes! Use a fatoração, a simplificação e a lógica para resolver esses 20 desafios rápidos de cálculo mental.',
    pdfPath: '/pdfs/01_TOP.pdf',
    pages: 2,
    available: true,
    richContent: String.raw`
## Recuperação: Matemática Elegante e Cálculo Mental

**Objetivo:** Não faça contas enormes! Use a fatoração, a simplificação e a lógica para resolver. [cite: 336]

1. Calcule $12 \times 25$ transformando o 12 em $(3 \times 4)$. [cite: 337]

2. Resolva $32 \times 125$ fatorando o 32 para encontrar um 8 (lembre que $8 \times 125 = 1000$). [cite: 338]

3. Use a técnica de "dobrar e meiar" para resolver $14 \times 50$. [cite: 339]

4. Calcule $44 \times 5$ (Lembre-se: multiplicar por 5 é igual a dividir por 2 e multiplicar por 10). [cite: 340]

5. Simplifique a expressão usando fator comum: $23 \times 7 + 23 \times 3$. [cite: 341]

6. Simplifique a expressão usando fator comum: $45 \times 18 - 45 \times 8$. [cite: 342]

7. Calcule a distância total de uma viagem feita a $84 \text{ km/h}$ em 5 horas $(84 \times 5)$ usando a metade e o zero. [cite: 343]

8. Simplifique a fração antes de multiplicar: $\frac{24 \times 15}{12 \times 5}$. [cite: 344]

9. Simplifique a fração cortando os fatores comuns: $\frac{36 \times 21}{7 \times 9}$. [cite: 345]

10. Se 5 camisas custam 150, quanto custam 8? (Dica: ache o valor de uma primeiro: $150 \div 5$). [cite: 346]

11. Calcule rapidamente $880 \div 5$ (Dica: dobre o número e corte um zero, ou divida por 10 e dobre). [cite: 347]

12. Resolva usando a diferença de quadrados: $19 \times 21$ (Pense em: $(20 - 1) \times (20 + 1)$ (Use a regra: $a^2 - b^2 = (a + b)(a - b)$)). [cite: 348]

13. Resolva usando a diferença de quadrados: $48 \times 52$. [cite: 349]

14. Quanto é $53^2 - 47^2$? (Use a regra: $a^2 - b^2 = (a + b)(a - b)$). [cite: 350]

15. Calcule $101 \times 65$ usando a propriedade distributiva $(65 \times 100 + 65 \times 1)$. [cite: 351]

16. Calcule $99 \times 34$ (Pense em $100 - 1$). [cite: 352]

17. Calcule $11 \times 43$ usando a regra da soma dos dígitos (Abre o 4 e o 3 e soma no meio). [cite: 353]

18. Inverta a lógica da porcentagem: Quanto é 120% de 50? (Dica: É o mesmo que 50% de 120). [cite: 354]

19. Resolva a conta: $(10 \times 20) \div 12$ simplificando por 4 antes de dividir. [cite: 355]

20. Qual o resultado de $(84 \times 5) \div 12$? (Simplifique o 84 com o 12 antes de multiplicar). [cite: 356]

---

### Gabarito Rápido [cite: 358]

* **1.** 300 [cite: 359]
* **2.** 4000 [cite: 360]
* **3.** 700 [cite: 361]
* **4.** 220 [cite: 362]
* **5.** 230 [cite: 363]
* **6.** 450 [cite: 364]
* **7.** 420 km [cite: 365]
* **8.** 6 [cite: 366]
* **9.** 12 [cite: 367]
* **10.** 240 reais[cite: 368]
* **11.** 176 [cite: 369]
* **12.** 399 [cite: 370]
* **13.** 2496 [cite: 371]
* **14.** 600 [cite: 372]
* **15.** 6565 [cite: 373]
* **16.** 3366 [cite: 374]
* **17.** 473 [cite: 375]
* **18.** 60 [cite: 376]
* **19.** Aprox. 16,6 (ou 50/3) [cite: 377]
* **20.** 35 [cite: 378]
`
  },

  {
    id: 'plan-8',
    slug: 'aritmetica-elegante-01',
    title: 'Super Lista 1: Dobrar, Meiar e Propriedade Distributiva',
    subject: 'Matemática',
    grade: '8°ano ao Ensino Médio',
    description: 'Primeira bateria de exercícios práticos de cálculo mental. Domine as técnicas de dobrar e meiar, além da fatoração básica.',
    pdfPath: '/pdfs/02_TOP.pdf',
    pages: 2,
    available: true,
    richContent: String.raw`
## Super Lista: Aritmética Elegante e Truques Matemáticos (Parte 1)

**Regra de Ouro:** Tente não armar a conta. Use as dicas para fatorar, simplificar e resolver com raciocínio lógico.

### BLOCO 1: Dobrar e Meiar (E outros truques de multiplicação) 

* 1. Calcule $14 \times 5$ (Dica: Divida o 14 por 2 e multiplique o 5 por 10).
* 2. Calcule $18 \times 15$ (Dica: Tire metade de 18 [que é 9] e dobre o 15 [que é 30]. Faça $9 \times 30$).
* 3. Calcule $12 \times 45$ (Dica: Meie o 12 para 6 e dobre o 45 para 90).
* 4. Calcule $24 \times 50$ (Dica: Multiplicar por 50 é o mesmo que multiplicar por 100 e dividir por 2).
* 5. Calcule $16 \times 25$ (Dica: 25 cabe 4 vezes no 100. Divida 16 por 4 e coloque dois zeros).
* 6. Calcule $32 \times 25$ (Dica: Divida 32 por 4 e multiplique por 100).
* 7. Calcule $44 \times 50$ (Dica: Metade de 44 com dois zeros no final).
* 8. Calcule $22 \times 15$ (Dica: $11 \times 30$).
* 9. Calcule $4,5 \times 20$ (Dica: Dobre o 4,5 para 9 e divida o 20 no meio para 10).
* 10. Calcule $3,5 \times 12$ (Dica: Dobre o 3,5 para 7 e divida o 12 no meio para 6).

### BLOCO 2: Fatoração e Propriedade Distributiva

* 11. Calcule $102 \times 7$ (Dica: Faça $100 \times 7 + 2 \times 7$).
* 12. Calcule $101 \times 43$ (Dica: O "truque do espelho": $43 \times 100 + 43 \times 1$).
* 13. Calcule $99 \times 25$ (Dica: Pense em $100 \times 25$ e tire um 25).
* 14. Calcule $12 \times 11$ (Dica: Multiplicação por 11: abra o 1 e o 2 e some no meio -> 1_2).
* 15. Calcule $35 \times 11$ (Dica: Abra o 3 e o 5 e coloque a soma 8 no meio).
* 16. Simplifique: $17 \times 6 + 17 \times 4$ (Dica: Coloque o 17 em evidência e some $6+4$).
* 17. Simplifique: $28 \times 13 - 28 \times 3$ (Dica: Coloque o 28 em evidência e subtraia $13-3$).
* 18. Calcule $15 \times 12$ transformando o 12 em $(10+2)$.
* 19. Calcule $8 \times 999$ (Dica: Faça $8 \times 1000$ e subtraia 8).
* 20. Calcule $5 \times 49$ (Dica: Faça $5 \times 50$ e subtraia 5).
`
  },

  {
    id: 'plan-9',
    slug: 'aritmetica-elegante-02',
    title: 'Super Lista 2: Diferença de Quadrados e Divisão Simplificada',
    subject: 'Matemática',
    grade: '8°ano ao Ensino Médio',
    description: 'Segunda bateria de exercícios práticos. Explore o poder das potências, a clássica diferença de quadrados e simplifique divisões complexas.',
    pdfPath: '/pdfs/03_TOP.pdf',
    pages: 2,
    available: true,
    richContent: String.raw`
## Super Lista: Aritmética Elegante e Truques Matemáticos (Parte 2)

**Regra de Ouro:** Tente não armar a conta. Use as dicas para fatorar, simplificar e resolver com raciocínio lógico.

### BLOCO 3: Diferença de Quadrados e Potências 

* 21. Resolva $39 \times 41$ (Use a regra: $a^2 - b^2 = (a+b)(a-b)$) (Dica: Pense em $(40-1) \times (40+1)$. Faça $40^2 - 1^2$).
* 22. Resolva $29 \times 31$ (Dica: Use o 30 como base. Faça $30^2 - 1^2$).
* 23. Resolva $48 \times 52$ (Use a regra: $a^2 - b^2 = (a+b)(a-b)$) (Dica: Use o 50 como base. Faça $50^2 - 2^2$).
* 24. Quanto é $35^2$? (Dica: Termina em 25. O começo é $3 \times 4$).
* 25. Quanto é $65^2$? (Dica: Termina em 25. O começo é $6 \times 7$).
* 26. Quanto é $95^2$? (Dica: Termina em 25. O começo é $9 \times 10$).
* 27. Simplifique $(15^2 - 5^2)$. (Use a regra: $a^2 - b^2 = (a+b)(a-b)$) (Dica: Use $(15+5) \times (15-5)$).
* 28. Simplifique $(102^2 - 98^2)$. (Use a regra: $a^2 - b^2 = (a+b)(a-b)$) (Dica: Use a soma multiplicada pela diferença: $200 \times 4$).
* 29. Calcule $8^2 / 4$ de forma fatorada $(8 \times 8 / 4)$.
* 30. Calcule $12^2 / 6$ de forma fatorada $(12 \times 12 / 6)$.

### BLOCO 4: Divisão Simplificada

* 31. Simplifique a fração: $(30 \times 14) / 7$. (Dica: Corte o 14 com o 7 antes de multiplicar) .
* 32. Simplifique: $(45 \times 12) / 9$ (Dica: Divida 45 por 9 primeiro).
* 33. Resolva: $(100 \times 24) / 25$ (Dica: 100 dividido por 25 é 4. Faça $4 \times 24$).
* 34. Simplifique: $(36 \times 21) / (6 \times 7)$. (Dica: Divida 36 por 6 e 21 por 7).
* 35. Calcule: $840 \div 5$ (Dica: Divida por 10 [corta zero] e multiplique por 2).
* 36. Calcule: $1200 \div 50$. (Dica: Corte os zeros. Fica $120 \div 5$. Use a regra anterior).
* 37. Quanto é 150% de 40? (Dica: Inverta. É o mesmo que 40% de 150. Ou $1,5 \times 40$).
* 38. Regra de Três Inversa: Se 4 pedreiros levam 10 dias (Total = 40 dias-trabalho), quantos dias levam 8 pedreiros?.
* 39. Regra de Três Direta: Se 2 balas custam 5,00 reais, quanto custam 12? (Ache o fator de aumento de 2 para 12).
* 40. Desafio final: Simplifique $(55 \times 22) / 11$ sem sofrer. (Dica: Divida o 22 ou o 55 por 11 primeiro).
`
  },

  {
    id: 'plan-10',
    slug: 'diferenca-quadrados-fator-comum',
    title: 'Avançado 1: O Poder da Diferença de Quadrados e Fator Comum',
    subject: 'Matemática',
    grade: '9°ano ao Ensino Médio',
    description: 'Eleve o nível do cálculo mental com expressões envolvendo fatoração avançada e produtos notáveis aplicados na prática.',
    pdfPath: '/pdfs/04_TOP.pdf',
    pages: 1,
    available: true,
    richContent: String.raw`
## Parte 1: O Poder da Diferença de Quadrados e Fator Comum 
**Objetivo:** Não faça contas enormes! Use a fatoração, a simplificação e a lógica para resolver.

* 1. Calcule mentalmente: $55^2 - 45^2$.
* 2. Resolva usando fatoração: $37 \times 12 + 37 \times 88$.
* 3. Simplifique a fração: $(98^2 - 4) / 96$.
* 4. Calcule sem armar a conta: $28^2 - 22^2$.
* 5. Qual o valor de: $102 \times 98$ (Dica: pense em $(100+2)(100-2)$).
* 6. Simplifique: $(50^2 - 30^2) / 80$.
* 7. Resolva rapidamente: $4,5 \times 8 + 5,5 \times 8$.
* 8. Calcule: $105^2 - 5^2$.
* 9. Encontre o valor: $73^2 - 27^2$.
* 10. Simplifique a expressão: $(15 \times 15 - 5 \times 5) / 20$.
* 11. Calcule usando distribuição: $64 \times 15$ (Dica: $64 \times 10 + 64 \times 5$).
* 12. Resolva: $19 \times 21$ (Dica: $(20-1)(20+1)$).
* 13. Simplifique: $(100^2 - 80^2) / (100 - 80)$.
* 14. Calcule mentalmente: $8,5^2 - 1,5^2$.
* 15. Fator comum em ação: $125 \times 3 - 25 \times 3$.
* 16. Diferença de quadrados: $101^2 - 99^2$.
* 17. Calcule: $47 \times 53$.
* 18. Simplifique: $(3^2 \times 2^3 + 3^2 \times 2^2) / 3^2$.
* 19. Resolva: $60^2 - 40^2$.
* 20. Desafio rápido: $(2025^2 - 1^2) / 2024$.
`
  },

  {
    id: 'plan-11',
    slug: 'quadrados-perfeitos-ajustes',
    title: 'Avançado 2: Quadrados Perfeitos e Ajustes Finos',
    subject: 'Matemática',
    grade: '9°ano ao Ensino Médio',
    description: 'Desafios finais de simplificação algébrica e aritmética usando trinômio quadrado perfeito, fatoração por agrupamento e ajustes decimais.',
    pdfPath: '/pdfs/05_TOP.pdf',
    pages: 1,
    available: true,
    richContent: String.raw`
## Parte 2: Quadrados Perfeitos e Ajustes Finos 

**Objetivo:** Não faça contas enormes! Use a fatoração, a simplificação e a lógica para resolver.

* 21. Calcule usando o quadrado da soma: $103^2$ (Pense: $(100+3)^2$).
* 22. Calcule usando o quadrado da diferença: $99^2$ (Pense: $(100-1)^2$).
* 23. Resolva: $51^2$.
* 24. Resolva: $29^2$.
* 25. Técnica de dobrar e dividir: $15 \times 16$ (Tente: $30 \times 8$).
* 26. Técnica de dobrar e dividir: $35 \times 12$.
* 27. Simplifique a fração: $(12^2 + 2 \times 12 \times 8 + 8^2) / 20$.
* 28. Calcule: $1005 \times 1005$.
* 29. Calcule mentalmente: $201 \times 199$.
* 30. Simplificação rápida: $25 \times 32$ (Dica: $25 \times 4 \times 8$).
* 31. Soma de quadrados: $11^2 + 9^2$.
* 32. Calcule: $65^2$ (Dica: termina em 25, e o início é $6 \times 7$).
* 33. Calcule: $35^2$.
* 34. Fatoração por agrupamento: $ax + ay + 3x + 3y$ (Para $a=7$, $x=2$, $y=8$).
* 35. Resolva: $14 \times 11$ (Regra do 11: abre o 1 e 4, soma no meio).
* 36. Resolva: $53 \times 11$.
* 37. Diferença de quadrados decimal: $1,2^2 - 0,8^2$.
* 38. Simplifique: $300^2 / 150$.
* 39. Calcule: $1002^2$.
* 40. Desafio final: $1234 \times 0 + 55^2 - 45^2$.
`
  },
  {
    id: 'plan-12',
    slug: 'regra-de-ouro-1',
    title: 'A Regra de Ouro: Proporção Direta e o Equilíbrio',
    subject: 'Matemática',
    grade: '7°ano ao Ensino Médio',
    description: 'A regra de três não é sobre achar o X, é sobre o Equilíbrio do Universo. Explore frações equivalentes e proporções diretas.',
    pdfPath: '/pdfs/regra-de-ouro-1.pdf',
    pages: 2,
    available: true,
    richContent: String.raw`
## A regra de ouro

A regra de três não é sobre achar o valor de "X". Não é sobre chegar ao resultado mais rápido, nem sobre entender a matéria com pressa. Afinal, quem foi que nos disse que não devemos errar? É através do erro que alcançamos novas explicações. Se não temos espaço para processar a falha, estão negando a nós mesmos a própria vida e a capacidade de raciocínio que juraram nos dar.

Não se engane: a regra de três é, em sua essência, sobre o Equilíbrio do Universo. Ninguém pode esconder isso de você, a não ser você mesmo. E se você procurar a fundo, vai encontrar.

Vamos explorar esse tema partindo das frações equivalentes. Pense no seguinte: se 4 reais compram 1 doce, e 20 reais compram 5 doces, temos proporções perfeitas ($1/4$ e $5/20$). A razão, neste primeiro caso, é descobrir quanto vale "1 real de doce", e esse valor proporcional sempre será mantido. Mas a perspectiva pode mudar: se usarmos $4/1$ e $20/5$, a razão agora passa a representar o preço de um doce inteiro. Podemos ir ainda mais longe e afirmar que, se "1 real de doce" equivale a 25% da unidade ($1/4$), então o doce inteiro será 400% maior do que esse fragmento de 1 real.

Durante esse processo de aprendizado, é fundamental escrevermos nosso raciocínio no nosso idioma materno. A essência da Matemática — e de todas as outras áreas de estudo criadas pelo homem — tem como alicerce a nossa linguagem. Não há como escapar disso. Se você acha que é possível evoluir sem aprimorar a comunicação, lembre-se do que cravou o filósofo Ludwig Wittgenstein: "Os limites da minha linguagem são os limites do meu mundo".

Acreditar que o progresso ignora a comunicação seria o mesmo que defender que a Inteligência Artificial evoluiria melhor e mais rápido se não houvesse a Ética ou a Lei. Mas, no estudo verdadeiro e profundo, isso não faz sentido. O nosso avanço real depende de usarmos bem a linguagem que nos foi dada e de compreendermos a ética assimétrica que precede todo e qualquer cálculo, como nos ensina Emmanuel Lévinas.

Introduzir e debater diferentes ferramentas matemáticas ainda na escola serve justamente para sedimentar essa base. Devemos nos preocupar incessantemente em fortalecer a nossa fundação intelectual — lógica e linguística —, pois não existe absolutamente nada mais importante para a construção do pensamento humano do que a solidez dessa base.

* **A Proporção do Doce:** Se com 4 reais é possível comprar exatamente 1 doce, qual é o valor necessário para adquirir 15 doces mantendo a mesma proporção de preço?
* **Ritmo de Caminhada:** Uma pessoa descobre que precisa dar 3.000 passos para percorrer 2,4 km. Quantos quilômetros ela terá percorrido se atingir rigorosamente a sua meta de 9.000 passos no dia?
* **Trabalho Voluntário:** Para preparar uma massa de argamassa perfeita em uma obra, utilizam-se 4 baldes de areia para cada saco de cimento. Quantos baldes de areia serão necessários para acompanhar 7 sacos de cimento?
* **Eficiência Híbrida:** Um carro híbrido consome 2 litros de combustível para percorrer 50 km no modo de combustão. Mantendo esse exato rendimento, quantos litros ele consumirá em uma viagem de 150 km?
* **A Receita Exata:** Uma receita de bolo que rende 8 porções exige 200 gramas de farinha de trigo. Quantas gramas de farinha são necessárias para adaptar a receita para 20 porções?
* **Leitura Focada:** Um estudante lê 12 páginas de um livro de filosofia em 20 minutos. Se ele mantiver a mesma velocidade de leitura e o mesmo foco, quantas páginas ele lerá em 50 minutos?
* **Escala Cartográfica:** Em um mapa de uma trilha, 3 cm no papel representam 15 km na vida real. Qual é a distância real representada por uma linha de 8 cm neste mesmo mapa?
* **Impressão de Documentos:** Uma impressora de escritório consegue imprimir 45 páginas em 3 minutos. Quanto tempo ela levará para imprimir uma apostila completa de 180 páginas?
* **Produção de Software:** Um programador consegue escrever e revisar 150 linhas de código limpo em 2 horas. Mantendo esse ritmo de produtividade, quantas linhas ele terá finalizado após 5 horas de trabalho?
* **A Força da Água:** Uma torneira aberta com vazão constante enche um balde de 15 litros em 5 minutos. Quantos litros de água terão saído dessa torneira após 12 minutos?
* **Costura e Medidas:** Para confeccionar 3 camisas de uniforme do mesmo tamanho, uma costureira utiliza 4,5 metros de tecido. Quantos metros de tecido ela precisará comprar para fazer 10 camisas?
* **Taxa de Download:** A conexão de internet de um laboratório baixa um arquivo de 300 megabytes em 12 segundos. Mantendo a estabilidade da rede, quantos megabytes serão baixados em 40 segundos?
* **Rendimento Profissional:** Um professor substituto recebe 360 reais por 3 dias de aulas ministradas. Qual será a remuneração proporcional se ele lecionar por 14 dias no mês?
* **Pintura de Paredes:** Dois galões de tinta são suficientes para pintar perfeitamente uma área de 25 metros quadrados. Quantos galões serão necessários para pintar um salão de 100 metros quadrados?
* **Sombra e Geometria:** Em um determinado momento da tarde, um poste de 4 metros de altura projeta uma sombra de 1,5 metros. No mesmo instante, qual é a altura de um prédio que projeta uma sombra de 12 metros?
* **Colheita Agrícola:** Uma máquina colheitadeira consegue processar 3 hectares de plantação em 2 horas. Quanto tempo será necessário para que ela processe uma fazenda de 15 hectares?
* **Mensalidade Proporcional:** O plano de assinatura de um servidor em nuvem custa 180 reais por 3 meses de uso. Se o usuário quiser garantir o serviço por 8 meses, quanto ele deverá pagar?
* **O Peso da Lógica:** Em uma balança universal, 5 blocos de metal maciço pesam 12 kg. Qual seria o peso exato de 18 desses mesmos blocos?
* **Tradução de Idiomas:** Um tradutor profissional consegue verter 4 pages de um texto do inglês para o português em 1 hora e meia. Quantas horas ele precisará para traduzir um artigo de 20 páginas?
* **Geração de Energia:** Um painel solar específico gera 150 kWh de energia em 5 dias de sol intenso. Quantos kWh esse mesmo painel gerará ao longo de 30 dias com as mesmas condições climáticas?
`
  },
  {
    id: 'plan-13',
    slug: 'regra-de-ouro-2',
    title: 'A Regra de Ouro – Aula 2: A Engrenagem do Tempo',
    subject: 'Matemática',
    grade: '7°ano ao Ensino Médio',
    description: 'A regra de três inversa é a matemática do trabalho em equipe: quando dividimos o peso de um problema, multiplicamos nosso tempo livre.',
    pdfPath: '/pdfs/regra-de-ouro-2.pdf',
    pages: 2,
    available: true,
    richContent: String.raw`
## A regra de ouro – Aula 2

Como vimos, as frações equivalentes nos mostram com perfeição o princípio da balança na regra de três. Mas será que o universo se equilibra apenas de uma única forma? Não! Existe uma outra engrenagem, mais sutil e profundamente conectada com o nosso bem mais precioso: o tempo.

Pense em uma viagem de carro entre duas cidades. A distância da estrada é fixa, não muda. No entanto, o tempo que passamos dentro do carro é uma variável. Se o veículo for mais rápido, a viagem durará menos tempo; se for mais lento, exigirá mais do nosso tempo. O ganho de um lado exige a redução do outro. Esse é o coração das grandezas inversamente proporcionais.

Nós podemos visualizar isso na própria geometria. Imagine que você tem uma área fixa no chão que precisa ser coberta. Se você dobrar o comprimento dessa área, obrigatoriamente terá que cortar a altura pela metade para que o espaço total continue exatamente o mesmo. A figura muda de forma — deixa de ser um quadrado e se estica em um retângulo —, mas a sua essência, o seu espaço interno, permanece inalterado. Nós apenas adaptamos a forma para preservar o limite.

Mas a beleza real desse cálculo está na colaboração. Se uma torneira enche um tanque em 2 horas, adicionar uma segunda torneira trabalhando junto fará com que o tanque encha muito mais rápido. O volume de água necessário não mudou, mas porque as forças se uniram, o esforço individual e o tempo de espera diminuíram. A regra de três inversa é, no fundo, a matemática do trabalho em equipe: quando dividimos o peso de um problema, multiplicamos o nosso tempo livre.

Ao aprendermos a manipular as frações e a observar os números de ângulos diferentes, dominaremos não apenas uma ferramenta matemática, mas uma nova forma de enxergar o mundo. É um processo contínuo de descobertas. Nós sempre encontraremos caminhos novos para resolver o mesmo problema — e lembre-se: cada erro que cometemos no papel é um passo vital e necessário nessa busca pela resposta certa.

* **Download do Jogo:** Uma atualização pesada de um jogo de videogame demora 40 minutos para ser baixada a uma velocidade de conexão de 15 Mbps. Se o estudante usar o cabo de rede e a internet subir para 60 Mbps, em quantos minutos a atualização estará pronta para jogar?
* **Maratona de Série:** Um grupo de amigos decidiu maratonar um anime. Assistindo 3 episódios por dia, eles terminarão a temporada em 12 dias. Se a ansiedade bater e eles passarem a assistir 4 episódios por dia, em quantos dias terminarão a temporada?
* **Programação de IA:** Um desenvolvedor Python está escrevendo o código para um novo assistente virtual e, trabalhando sozinho, estima que levará 60 horas para terminar. Se ele convidar mais 2 amigos programadores para codar junto com ele (trabalhando no mesmo ritmo), em quantas horas o projeto ficará pronto?
* **O Passeio:** Um motorista dirigindo um carro viaja a 80 km/h e completa um trajeto até a praia em 3 horas. Se ele aumentar a velocidade constante para 100 km/h, quanto tempo levará para completar exatamente a mesma viagem?
* **Caminhada e Frequência:** Em uma rotina de exercícios no parque, uma pessoa caminhando a 4 km/h demora 90 minutos para atingir sua meta de passos diários. Se ela apertar o passo e caminhar a 6 km/h, em quantos minutos ela baterá a mesma meta?
* **Acampamento com a Galera:** Um grupo de 8 amigos alugou uma chácara e levou comida suficiente para 5 dias. No último minuto, mais 2 amigos confirmaram que vão junto. Mantendo as mesmas porções, para quantos dias a comida vai durar com o grupo de 10 pessoas?
* **Bateria do Celular:** Se o brilho da tela do celular estiver configurado para 80%, a bateria aguenta jogar online por 5 horas seguidas. Se o estudante reduzir o brilho para 40%, quantas horas a bateria vai durar jogando?
* **Renderização de Vídeo:** Um computador moderno com 1 placa de vídeo dedicada leva 45 minutos para renderizar um vídeo em 4K para o YouTube. Se um estúdio conectar 3 placas de vídeo idênticas trabalhando juntas, em quantos minutos o vídeo estará pronto?
* **Mutirão de Limpeza:** Em um projeto de ciências, 12 alunos conseguem limpar todo o lixo plástico de uma praça em 4 horas. Se a turma se animar e 16 alunos aparecerem para ajudar, em quantas horas a praça estará limpa?
* **A Engrenagem da Bicicleta:** Uma engrenagem de bicicleta com 24 dentes dá 150 voltas por minuto. Se a corrente for trocada para uma engrenagem menor, de 18 dentes, quantas voltas por minuto essa nova engrenagem dará, mantendo a mesma velocidade da roda?
* **Pintura do Palco:** Faltam poucos dias para o festival de música da escola. 3 estudantes pintando o cenário levariam 8 horas para terminar tudo. Para liberar o palco mais rápido, o grêmio chamou mais pessoas e agora são 6 pintores. Em quanto tempo o cenário ficará pronto?
* **A Força da Água:** Uma piscina gigante de um clube é esvaziada em 12 horas utilizando 2 bombas de sucção. O clube decidiu comprar mais 1 bomba igualzinha para acelerar a limpeza. Com as 3 bombas ligadas ao mesmo tempo, em quantas horas a piscina ficará vazia?
* **Festa da Pizza:** Em uma sexta-feira à noite, 4 amigos pediram pizzas e calcularam que cada um pode comer 6 fatias. Antes da pizza chegar, mais 4 amigos aparecem de surpresa. Se eles dividirem igualmente, quantas fatias cada um comerá agora?
* **Leitura nas Férias:** Uma estudante está lendo um livro de fantasia de 600 páginas. Lendo 20 páginas por dia, o livro durará o mês inteiro (30 dias). Se ela se empolgar com a história e ler 30 páginas por dia, em quantos dias ela terminará a leitura?
* **Construção de Servidor:** Uma equipe de 5 jogadores de Minecraft demora 14 dias para construir uma réplica perfeita de um castelo histórico no servidor. Se a equipe fosse formada por 7 jogadores com a mesma habilidade, em quantos dias o castelo estaria erguido?
* **Câmeras de Segurança:** Um disco rígido (HD) consegue armazenar as gravações de 4 câmeras de segurança por 15 dias. Se a escola instalar mais 2 câmeras no pátio (totalizando 6), para quantos dias o mesmo disco rígido conseguirá armazenar as imagens?
* **Distribuição de Brindes:** Durante uma feira de tecnologia, a organização tem adesivos suficientes para dar 10 adesivos para 120 visitantes. Como a feira lotou e chegaram 150 visitantes interessados, quantos adesivos cada pessoa receberá para que ninguém fique sem?
* **Corrida de Kart:** Em uma pista de Kart, um piloto completa uma volta em 45 segundos correndo a uma velocidade média de 60 km/h. Qual deveria ser a sua velocidade média para conseguir quebrar o recorde e fazer a volta em apenas 36 segundos?
* **Trabalho Voluntário:** Em um abrigo de animais, a ração estocada é suficiente para alimentar 30 cães durante 20 dias. A prefeitura acabou de resgatar mais 10 cães abandonados que foram levados para o abrigo. Quanto tempo esse estoque de ração vai durar agora, alimentando os 40 cães?
* **Revisão de Prova:** Uma professora gasta 10 minutos por prova para corrigir os testes de 24 alunos. Se ela otimizar seu processo e reduzir o tempo para 8 minutos por prova, de quantos alunos ela conseguirá corrigir as provas dentro do mesmo intervalo de tempo total?
`
  },

  {
    id: 'plan-14',
    slug: 'matematica-sinais-peso-alivio',
    title: 'A Matemática dos Sinais: O Peso e o Alívio',
    subject: 'Matemática',
    grade: '7°ano ao Ensino Médio',
    description: 'As operações com números inteiros não são só regrinhas decoradas; elas descrevem a vida real: nossos ganhos, dívidas, quedas e superações.',
    pdfPath: '/pdfs/01-numerosinteiros-revisado.pdf',
    pages: 3,
    available: true,
    richContent: String.raw`
## A Matemática dos Sinais: O Peso e o Alívio

Aprender matemática não precisa ser um processo chato. Ficar confuso ao ver sinais de mais e menos misturados é super normal. É o seu cérebro suando e criando novas conexões. Quebrar a cabeça com um problema e sentir aquele alívio quando finalmente entende é o que constrói a sua inteligência de verdade. As operações com números inteiros não são só regrinhas decoradas; elas descrevem a vida real: nossos ganhos, dívidas, quedas e superações.

Para dominar os sinais, você precisa entender as regras do jogo:

### 1. A Regra do Deslocamento: O Tamanho do Salto
Para calcular o deslocamento — seja de um objeto ou na vida —, a gente sempre faz a diferença entre onde você chegou (Final) e de onde você saiu (Inicial). A regra de ouro é: **Deslocamento = Final - Inicial.**

* **A Subida:** Se você entra no elevador no 2º subsolo ($-2$) e sobe até o 6º andar ($6$), qual foi o seu esforço? A conta é: $6 - (-2)$. O choque de sinais vira uma soma: $6 + 2 = 8$. Você se deslocou $8$ andares para cima!
* **A Queda:** Se você está no 8º andar ($8$) e desce até o 3º subsolo ($-3$), a conta mostra a realidade: $-3 - 8 = -11$. O sinal negativo mostra que você desceu $11$ andares.

### 2. A Batalha Financeira: Dinheiro, Dívidas e o "Menos com Menos"
Na matemática financeira do dia a dia:

* **Soma ($+$):** É o seu salário, o seu ganho, o dinheiro no bolso.
* **Subtração ($-$):** É a dívida, o boleto para pagar, o gasto inesperado.

A maior dúvida da galera: **o que acontece quando temos dois sinais de menos juntos?** Pense nisso como o "perdão de uma dívida".

Imagine que você tem uma conta de luz atrasada de 150 reais(um peso de $-150$). De repente, a companhia avisa que errou e decide cancelar essa cobrança. Subtrair uma dívida — ou seja, fazer $- (-150)$ — é literalmente tirar um peso das costas! Ao invés de dever, o erro foi perdoado. Subtrair uma dor é somar um alívio ($+150$).

As 20 missões a seguir são situações reais. Resolva cada uma e mostre que você domina as regras!

---

### Nível 1: O Desafio do Deslocamento (Final - Inicial)
Calcule a distância percorrida. A conta é sempre: **Final - Inicial**

1. Um mergulhador está a $-45$ metros. Ele usa um balão de emergência e sobe até um helicóptero que o resgata a $+15$ metros de altura. Qual foi o deslocamento total dele?
2. Você está no 12º andar e deixa o celular cair até o 5º subsolo ($-5$). Escreva a conta e calcule o deslocamento exato dessa queda.
3. Um leopardo está a $22$ metros de altura e pula para um vale que fica a $-14$ metros. Qual foi o deslocamento desse salto?
4. Um submarino está a $-120$ metros. Para fugir de um perigo, ele afunda até $-580$ metros. Qual foi o deslocamento vertical dele?
5. Uma lâmina de metal sai de um tanque congelado a $-196^\circ\text{C}$ direto para uma fornalha a $850^\circ\text{C}$. Qual foi a variação (deslocamento) de temperatura?

### Nível 2: O Peso dos Boletos (Somas e Subtrações)
A vida cobra caro. Mostre que sabe fazer as contas do seu bolso.

6. O banco mostra um saldo de $- 210$ reais. Você trabalha no fim de semana e ganha $ 350$ reais. Qual é o seu saldo final agora? Deu pra respirar?
7. Você tinha $ 80$ reais na conta. Consertar a moto custou $- 250$ reais e o banco ainda cobrou uma taxa de $- 45$ reais. Como ficou o seu saldo depois dessa maré de azar?
8. Uma empresa tem uma dívida trabalhista de $- 8.000$ reais. O dono vende o carro por $ 6.500$ reais e coloca o dinheiro na conta da empresa. A dívida acabou? Qual o saldo atual?
9. Um aluno já deve $ 130$ reais para o irmão ($-130$). Ele pega mais $ 90$ reais emprestados com um amigo ($-90$). Qual é o tamanho do buraco em que ele se meteu?
10. Você recebe um adiantamento de $ 400$ reais. Mas logo caem dois débitos na conta: o aluguel atrasado de $- 550$ reais e a conta de água de $- 120$ reais. Faça a conta inteira. Como ficou o seu saldo?

### Nível 3: O Milagre do "Menos com Menos"
Quando o cancelamento de uma dívida salva o seu dia.

11. Seu saldo é de $- 600$ reais por causa de uma cobrança errada de $- 450$ reais. O banco reconhece o erro e cancela (subtrai) essa dívida da sua conta. Faça a conta: $-600 - (-450)$. Qual saldo sobrou?
12. No videogame, seu personagem tomou uma maldição de $-60$ pontos de vida. O curandeiro do time usa uma magia que subtrai (tira) essa maldição: $- (-60)$. O que acontece com os seus pontos de vida?
13. O dono da padaria está com o caixa em $- 380$ reais. Um fornecedor fica com pena e perdoa (subtrai) uma dívida antiga de $ 150$ reais que a padaria tinha com ele. Monte a equação do alívio: $-380 - (-150)$. Qual é a nova situação do caixa?
14. Num jogo de tabuleiro, você está com saldo de $-30$ moedas. O líder do jogo te rouba mais $10$ moedas ($-10$). Na rodada seguinte, você usa uma carta que permite retirar a última ação de prejuízo: $- (-10)$. Você começou em $-30$, sofreu o roubo de $-10$, e depois o roubo foi cancelado. Com qual saldo você fica no final?
15. Uma cliente tinha $- 1.200$ reais de saldo. O juiz obriga a operadora a subtrair (excluir) uma multa injusta de $- 800$ reais e ainda manda a empresa pagar uma indenização de $ 500$ reais para ela. Calcule passo a passo: $-1200 - (-800) + 500$. Ela terminou com dinheiro positivo na conta?

### Nível 4: O Teste de Fogo (Operações Mistas)
Junte tudo e resolva os combos de uma vez só.

16. Você acorda com a energia em $-15$. Um café te dá $+20$. O trânsito tira $-30$. O chefe cancela uma reunião chata, tirando um peso enorme das suas costas: $- (-40)$. Qual é o saldo exato da sua paciência?
17. Um freezer estava a $-5^\circ\text{C}$. Dá um defeito e a temperatura sobe $+18^\circ\text{C}$. O técnico tenta consertar e a temperatura cai $-40^\circ\text{C}$ de uma vez. Para não congelar e estragar tudo, o sistema desfaz (subtrai) essa última queda exagerada: $- (-40)$. Qual foi a temperatura final?
18. Um investidor começa o dia perdendo $-2$ milhões. Tenta recuperar e perde mais $-5$ milhões. A corretora bloqueia a operação e cancela (subtrai) a última perda: $- (-5)$. À tarde, ele acerta a mão e ganha $+8$ milhões. Ele fechou o dia no lucro ou no prejuízo?
19. No RPG, você cai num buraco até o andar $-8$. Uma magia te empurra mais $-12$ andares para baixo. Um aliado te puxa $+30$ andares para cima. O mestre do jogo então decide cancelar (subtrair) aquela sua primeira queda do início: $- (-8)$. Em qual andar você parou?
20. **O Desafio Final:** Calcule o saldo desse dia conturbado:
    * Acordou devendo $- 450$ reais.
    * Fez um trabalho extra e ganhou $+ 600$ reais.
    * A geladeira quebrou: prejuízo de $- 300$ reais.
    * A companhia de água pediu desculpas por um erro e retirou (subtraiu) uma cobrança de $- 250$ reais da sua conta.
    * O cachorro foi no veterinário: $- 150$ reais.

    **Monte a conta:** $-450 + 600 - 300 - (-250) - 150$. Qual é o seu saldo no fim do dia?
`
  },
  {
    id: 'plan-15',
    slug: 'regras-de-ouro-negativos',
    title: 'As 3 Regras de Ouro dos Números Negativos',
    subject: 'Matemática',
    grade: '7°ano ao Ensino Médio',
    description: 'Transforme a confusão dos sinais em clareza lógica usando as analogias do elevador, do dinheiro e a prova irrefutável do perdão de dívidas.',
    pdfPath: '/pdfs/02-numerosinteiros-revisado.pdf',
    pages: 2,
    available: true,
    richContent: String.raw`
## As 3 Regras de Ouro dos Números Negativos

### 1. A Regra do Elevador (Para calcular distâncias)
Pense nos números como andares de um prédio. Os números positivos são os andares para cima, e os negativos são os subsolos. Para saber quantos andares você percorreu, basta pegar o **Andar Final** e subtrair o **Andar Inicial**.

* Se você sai do 2º subsolo ($-2$) para o 6º andar ($6$), a conta é: $6 - (-2) = 6 + 2 = 8$ andares para cima.
* Se você cai do 8º andar ($8$) para o 3º subsolo ($-3$), a conta é: $-3 - 8 = -11$ (uma queda de 11 andares).

### 2. A Regra do Dinheiro (Lucros e Dívidas)
Fica muito mais fácil se você imaginar que matemática é dinheiro.

* **Números positivos ($+$):** É o dinheiro que você tem no bolso (lucro).
* **Números negativos ($-$):** É o dinheiro que você deve (dívida).
* Se você tem $ 5$ reais e gasta $ 18$ reais ($5 - 18$), você fica com uma dívida de $-13$ reais.

### 3. O Truque da Dupla Negação ("Menos com menos dá mais")
Por que isso acontece? Imagine que você tem uma conta de luz atrasada de $ 150$ reais (uma dívida de $-150$ reais). Se a empresa de energia cometer um erro e decidir **retirar (subtrair)** essa dívida de você, o que acontece? Subtrair uma dívida tira um peso das suas costas. Então, $- (-150)$ vira um crédito de $+150$ na sua conta. Retirar uma dívida é o mesmo que ganhar dinheiro!

---

## Hora de Praticar: Os 20 Desafios Simplificados
Resolva os problemas abaixo usando as regrinhas do elevador, do dinheiro e da conta de luz.

### Nível 1: Entendendo a Lógica
1. **Lucros e Dívidas:** Você tem $34$ dívidas ($-34$) e ganha $50$ moedas ($+50$). Qual é o seu saldo final?
2. **Falta de Oxigênio:** Você tem $5$ minutos de oxigênio, mas precisa de $18$ para cruzar um túnel. A conta é $5 - 18$. Qual é o resultado?
3. **O Elevador:** Você está no andar $-4$ e o elevador desce mais $9$ andares ($-9$). Onde você vai parar?
4. **Distância 1:** Um pássaro vai do ponto $45$ metros até o ponto $-15$ metros. Calcule a distância (Final menos Inicial): $-15 - 45$.
5. **Distância 2:** Um drone sobe do ponto $-40$ metros até $25$ metros. Calcule a distância: $25 - (-40)$.

### Nível 2: Descomplicando os Sinais
6. **Extrato Bancário:** Seu saldo é $-80$. O banco cobra uma taxa de $25$ (subtrai $25$) e retira uma dívida velha de $40$ (subtrai $-40$). A conta é: $-80 - 25 - (-40)$. Qual o saldo final?
7. **Tirando o Peso:** Você está no fundo de um poço na posição $-14$. Alguém retira um peso de $8\text{ kg}$ de você. Calcule: $-14 - (-8)$.
8. **Cancelando Dívida:** Você tem saldo $0$. Alguém retira uma cobrança falsa de $500$. Calcule: $0 - (-500)$.
9. **Múltiplos Sinais:** O sinal de menos inverte a direção. O que acontece com três sinais juntos? Calcule: $-(-(-20))$.
10. **Curando a Maldição:** Você tem $8$ pontos de vida. Remove uma penalidade de $-12$. Calcule: $8 - (-12)$.

### Nível 3: Multiplicação e Memória
11. **Viagem no Tempo:** Um barco afunda $5$ toneladas por minuto ($-5$). Como ele estava $6$ minutos atrás no passado ($-6$)? Multiplique: $(-5) \cdot (-6)$.
12. **Refletindo o Feitiço:** O inimigo lança um poder de $-4$, e você usa um escudo que multiplica o efeito por $-3$. Calcule: $(-4) \cdot (-3)$.
13. **Dividindo Dívidas:** Uma empresa faliu com uma dívida de $-18.000$, que será dividida entre $3$ pessoas. Quanto cada um deve pagar?
14. **Não confunda:** Você deve $8$ e faz outra dívida de $12$. Cuidado, aqui não há multiplicação! Calcule: $-8 - 12$.
15. **A Batalha:** O herói tem $15$ pontos de vida. Leva $20$ de dano ($-20$), mas remove uma penalidade de $-10$ (subtrai $-10$). Qual o saldo de vida dele?

### Nível 4: Desafios com Várias Operações (Faça primeiro a multiplicação/divisão)
16. **Pegadinha da Potência:** Calcule as duas partes e diminua: $(-3)^2 - -(3^2)$
17. **Foco:** Lembre-se de multiplicar antes de somar/subtrair: $-15 - (-4) \cdot 5 + (-6)$
18. **A Mistura:** Resolva a divisão e a multiplicação primeiro, depois o meio: $(-24 \div 6) - (-3 \cdot -5)$
19. **O Poder do Zero:** Multiplicar por zero zera tudo: $-10 - (-10) + 14 \cdot 0$
20. **O Desafio Final:** Resolva por partes (primeiro colchetes e parênteses, depois divisão/multiplicação): 
$$ [(-6 \cdot -4) - (-12)] \div (-4) - (8 - 15) \cdot (-2) $$
`
  },
  {
    id: 'plan-16',
    slug: 'expressoes-numericas-trincheira',
    title: 'Expressões Numéricas: A Trincheira de Defesa do Cérebro',
    subject: 'Matemática',
    grade: '7°ano ao Ensino Médio',
    description: 'A ordem das operações não é para complicar, é a sintaxe da comunicação. Combata a atrofia cognitiva e religue as sinapses do seu córtex pré-frontal.',
    pdfPath: '/pdfs/01-expressaonumerica-revisado.pdf',
    pages: 2,
    available: true,
    richContent: String.raw`
## Expressões Numéricas: A Trincheira de Defesa do Cérebro

Expressões Numéricas não é uma 'decoreba de regras chatas'. É uma trincheira de defesa do seu cérebro. A matemática é a gramática da lógica humana:

* **A Ordem das Operações é a Sintaxe da Comunicação:** Por que resolvemos a multiplicação antes da soma? Não é para complicar sua vida. É porque a multiplicação é uma 'soma repetida', ela tem mais peso estrutural. Sem essa regra universal, uma mesma conta teria vários resultados e a comunicação lógica seria um caos.
* **A Lógica do Livro-Caixa (Regra de Sinais):** Vamos jogar fora o decoreba cego de 'menos com menos dá mais'. Pensem como os antigos mercadores e como o gênio indiano Brahmagupta no século VII: O número positivo é um Crédito (seu dinheiro). O número negativo é uma Dívida.
  * Se você soma dois números negativos ($-5 + (-8)$), você está apenas acumulando dívidas. O resultado é $-13$.
  * E a subtração de um negativo? Pense: se o banco subtrai (retira, perdoa) uma dívida (negativo) do seu nome, o que acontece com a sua vida financeira? Você fica mais rico! Retirar uma dívida tem o exato mesmo impacto de adicionar dinheiro. Por isso $-(-5)$ vira $+5$. É pura lógica!
* **Deslocamento Espacial:** Imagine uma linha no chão. Positivo olha para frente, negativo olha para trás. Subtrair é a ordem para 'andar de costas'. Se você olha para trás (negativo) e anda de costas (subtração), você fisicamente se desloca para a frente (positivo)!
* **Divisão é Multiplicação Inversa:** Não trate a divisão como uma regra nova. Ela é apenas a pergunta: 'Qual número eu multiplico para chegar a esse valor?'.

Nós vamos agora resolver aqueles 40 exercícios. **É terminantemente proibido o uso de calculadoras.** Vocês vão sentir a carga cognitiva, vão sentir o cérebro esquentar. Ao organizar os colchetes e administrar essas 'dívidas', vocês estarão religando as sinapses do córtex pré-frontal e recuperando a nossa herança intelectual. Peguem seus lápis. Vamos ao treino!

---

### Nível 1: Lógica de Dívidas, Créditos e Deslocamentos (Soma e Subtração)
*(Treine a visualização mental antes de calcular.)*

1) $-5 + 8$

2) $-12 - 7$

3) $15 - 20$

4) $-4 + (-9)$

5) $10 - (-6)$

6) $-8 + (-3) - (-5)$

7) $-15 + 20 - 10$

8) $-2 - (-2)$

9) $0 - (-14)$

10) $-7 + 7 - 5$

---

### Nível 2: O Deslocamento de Valores (Multiplicação, Divisão e Regra de Sinais)
*(A operação muda de tamanho e de direção.)*

11) $(-4) \cdot (-5)$

12) $6 \cdot (-7)$

13) $(-36) \div 9$

14) $(-48) \div (-8)$

15) $(-3) \cdot 4 \cdot (-2)$

16) $(-100) \div (-5)$

17) $(-2) \cdot (-2) \cdot (-2)$

18) $(-15) \div 3 \cdot (-2)$

19) $8 \cdot (-5) \div (-10)$

20) $(-20) \div (-4) \cdot (-3)$

---

### Nível 3: A Convenção na Prática (Ordem das Operações sem Prioridade de Parênteses)
*(Lembrete mental: a multiplicação e a divisão definem o valor antes de efetuarmos a soma/subtração)*

21) $-5 + 4 \cdot (-2)$

22) $10 - (-6) \div (-3)$

23) $(-8) \cdot 2 - (-15)$

24) $12 \div (-4) + 5 \cdot (-2)$

25) $-3 - (-4) \cdot (-5)$

26) $20 + (-18) \div 6$

27) $-7 \cdot (-2) + 14 \div (-7)$

28) $(-5) \cdot 3 - (-20) \div 4$

29) $15 - 2 \cdot (-4) + (-8) \div (-2)$

30) $-10 \div 5 - 4 \cdot (-3)$

---

### Nível 4: Combate à Atrofia Cognitiva (Ginástica Mental com Parênteses, Colchetes e Chaves)
*(Todos os exercícios foram elaborados para resultar em números inteiros exatos)*

31) $-2 \cdot (-5 + 8)$

32) $10 - (-4 - 6) \div (-2)$

33) $(-12 + 4) \cdot (-3 - (-1))$

34) $-5 + [-3 \cdot (4 - 6)]$

35) $15 - [-2 + (-8 \div 4)] \cdot (-3)$

36) $[(-10) \cdot (-2) - 5] \div (-5)$

37) $-\left\{ 4 - [-3 \cdot (-2 + 5)] \right\}$

38) $20 \div \left\{ -2 \cdot [-4 - (-6 + 1)] \right\} + 3$

39) $-3 \cdot \left\{ -5 + [12 \div (-3) - (-2) \cdot (-4)] \right\}$

40) $\left\{ [-15 \div (-2 - 3)] \cdot (-4) \right\} - [-(-8 + 2)]$
`
  }

]

// ── Lesson Categories (Trilhas de Aprendizagem) ───────────────────────────────

export interface LessonCategory {
  id: string
  /** Título da trilha exibido na sidebar */
  title: string
  /** Breve descrição exibida ao expandir */
  description: string
  /** Emoji / ícone representativo */
  icon: string
  /**
   * Slugs das aulas que pertencem a esta trilha.
   * Usar o slug (e não o id numérico) garante que a categorização
   * não quebre caso planos sejam reordenados ou renumerados.
   */
  slugs: string[]
}

export const lessonCategories: LessonCategory[] = [
  {
    id: 'cat-equacao',
    title: 'Princípios por trás da equação de 1° grau',
    description: 'Fundamentos profundos da álgebra e do verdadeiro significado do sinal de igual.',
    icon: '⚖️',
    slugs: ['equacao-balanca', 'equacoes-maquina-do-tempo'],
  },
  {
    id: 'cat-porcentagem',
    title: 'Princípios por trás da porcentagem',
    description: 'O universo inteiro dividido em 100 partes iguais — a lente mágica da proporção.',
    icon: '🔢',
    slugs: ['magica-porcentagem'],
  },
  {
    id: 'cat-divisores',
    title: 'A importância dos Divisores no nosso sistema',
    description: 'Por que 60 minutos, 360 graus e a base 10? A matemática escondida no tempo e no espaço.',
    icon: '÷',
    slugs: ['segredo-divisores'],
  },
  {
    id: 'cat-fracoes',
    title: 'Frações: Das Pirâmides ao Presente',
    description: 'Uma jornada completa pelas frações — da história milenar à aula prática com exercícios.',
    icon: '🍕',
    slugs: ['fracoes-operacoes'],
  },
  {
    id: 'cat-regra-de-tres',
    title: 'Princípios por trás da Regra de Três',
    description: 'O equilíbrio do universo através das grandezas direta e inversamente proporcionais.',
    icon: '📐',
    slugs: ['regra-de-ouro-1', 'regra-de-ouro-2'],
  },
  {
    id: 'cat-simplificacao',
    title: 'Princípios de simplificação em cálculos aritméticos',
    description: 'Dízimas, fatoração e truques mentais — a elegância de fazer mais com menos.',
    icon: '✨',
    slugs: [
      'dizima',
      'aritmetica-elegante-truques',
      'aritmetica-elegante-01',
      'aritmetica-elegante-02',
      'diferenca-quadrados-fator-comum',
      'quadrados-perfeitos-ajustes',
    ],
  },
  {
    id: 'cat-inteiros',
    title: 'A Lógica dos Números Inteiros',
    description: 'O peso e o alívio. A lógica oculta do "menos com menos" e a trincheira de defesa do seu cérebro.',
    icon: '➖',
    slugs: ['matematica-sinais-peso-alivio', 'regras-de-ouro-negativos', 'expressoes-numericas-trincheira'],
  },
]
