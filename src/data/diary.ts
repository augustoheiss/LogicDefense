export interface DiaryEntry {
  slug: string
  edition: string
  date: string
  title: string
  subtitle: string
  axes: string[]
  disclosure: string
  readingMinutes: number
  body: string
}

export const DIARY_ENTRIES: DiaryEntry[] = [
  {
    slug: 'a-etiqueta-no-martelo',
    edition: '#001',
    date: '2026-11-15',
    title: 'A Etiqueta no Martelo: Será que ter controle é a solução?',
    subtitle:
      'Notas sobre IA, limites humanos e a única coisa que realmente está nas nossas mãos.',
    axes: ['IA & Limites', 'Fé & Ética', 'Atenção'],
    disclosure:
      'Tese e vivência humanas (Augusto Heiss). Revisão gramatical e checagem histórica assistidas por IA.',
    readingMinutes: 6,
    body: `Assisti a alguns filmes e vi comentários de CEOs e especialistas sobre a IA e o avanço que eles tratam como inevitável. Olhando de perto, esses CEOs são pessoas comuns. No fundo, a cobrança é a mesma da política: que um homem mortal resolva os nossos problemas. Eu não acho isso justo. Para chegar a essa autoridade, eles precisam demonstrar muitas qualidades na prática. Um cargo político é a administração de uma cidade ou de um país. Se não conseguimos administrar a própria família, nem viver em paz com ela, não seremos tampouco eficientes nesse trabalho.

Nesse último mês, tenho pensado bastante na expressão "à imagem de Deus", e em que Deus sempre existiu, antes do tempo. A eternidade não tem fim. Nós fomos criados à imagem daquele que existiu antes do tempo. E não: eu não acredito que o homem pode produzir algo como isso, dar "consciência, inteligência, conhecimento, sabedoria" a uma máquina. A máquina só imita essas qualidades e prevê o próximo resultado. Ainda assim, não podemos aplicar o significado dessas palavras à própria máquina. Tenho trabalhado com isso com grande interesse. E, neste diário de bordo, trago algo que gosto de carregar em meu coração.

## I. O limite do controle

Será que ter controle é a solução?

Nós já perdemos o controle para a máquina. Mas o controle era nosso? Está escrito que não cabe ao homem nem mesmo dirigir o seu próprio passo (Jeremias 10:23). Então, qual deveria ser a nossa preocupação?

Deus sempre proveu o necessário para os seus servos. Ele nos deu até o seu Filho, Jesus Cristo, que agora é Rei do seu Reino, o Reino que pedimos na oração do Pai-Nosso. Mas nós, humanos, ainda nos preocupamos em ter o controle. Será que isso pode ajudar em alguma coisa?

De que, de fato, nós temos controle?

**Da nossa integridade.**

> "Tenho visto que toda perfeição tem um limite. Mas o teu mandamento não tem limites." (Salmo 119:96)

E por que lembrar desse limite importa? Porque, muitas vezes, a nossa decisão deve ser impor um limite. Precisamos de certa autoridade. A única coisa que não tem limites, de acordo com a Bíblia, é o mandamento de Deus.

Jó perguntou: "Devemos aceitar apenas o que é bom da parte do verdadeiro Deus e não aceitar também o que é mau?" (Jó 2:10). Muita gente lê isso e passa a achar que tudo aquilo que é bom carrega também algo de mau dentro de si. Mas o que é o mal?

Um diretor de escola, numa reunião com os funcionários, disse uma vez algo que faz pensar: o mal, na verdade, não existe; o que existe é a ausência do que é bom. É como o frio e o calor. O frio nada mais é do que a ausência do calor. O trabalho de um ar-condicionado é retirar o calor do ambiente, e não produzir o frio, pois o frio não existe como coisa criada. O que existe é o calor. O bom é o que existe.

Está escrito que Deus é luz, e não há nenhuma escuridão nele (1 João 1:5). Às vezes confundimos o mal com alguma limitação da nossa perfeição, pois toda perfeição tem um limite. Mas limite não é maldade. Maldade seria achar que não temos limite.

Nós fomos criados à imagem de Deus, que existiu antes do tempo. A máquina, não. Se a gente não consegue entender nem as coisas eternas que existem, como vamos ensinar a ela o que veio antes da eternidade?

## II. O martelo com etiqueta

A máquina prevê o próximo passo com base em informações humanas. Qual é a probabilidade de isso dar certo. Qual letra vem depois. Qual é a maneira mais eficiente, madura e normal que a previsão calculou. E, como se baseia em informações humanas, ela também erra bastante. No entanto, se você escrever "sábio" num martelo, ele ainda não é sábio. É só uma ferramenta.

Sim. O meu martelo sábio revisou este texto. Este diário de bordo também é um martelo com uma etiqueta escrita. A etiqueta não faz o texto sábio.

## III. Governantes mortais

A pergunta do controle não se resolve num CEO, nem num governante. A profecia de Daniel indica quando começariam os últimos dias, e quando o Rei começaria a governar no céu. Nós já vivemos nesse tempo há 112 anos, desde 1914. As coisas na Terra não melhorariam, porque foi lançado para baixo o grande dragão, a serpente original, Satanás, o Diabo. Não devemos esperar nada de um homem mortal, que é como todos nós. De um governante humano. De um CEO.

A terra foi dada aos filhos dos homens, para que os homens a habitassem. Há máquinas, inventadas por homens, e há homens que querem o controle de tudo. Acham que o controle é sempre a solução. Esquecem que Deus sempre provê a saída para os que lhe pertencem. Ele não está parado. Ele não muda. A nossa vida muda por qualquer motivo neste planeta. Devemos confiar naquele cuja vida não muda por motivo nenhum.

## IV. O que não cabe no cálculo

A sua vida, caro leitor, tem um peso enorme.

Levinas dizia que o rosto do próximo pede responsabilidade antes de qualquer razão ou cálculo. Não lembro a frase de cor. O miolo é esse. Simone Weil escreveu que a atenção treinada num problema de geometria, mesmo quando a conta sai errada, é a mesma atenção que permite olhar para alguém e perguntar: o que você está passando? Não é interessante? A razão ajuda. Ainda assim, ela não é a coisa principal que você, ou qualquer pessoa, carrega.

Então não precisamos fazer nada?

Precisamos, sim: conhecer a Deus e àquele a quem ele enviou, Jesus Cristo. Isso não é difícil, mas exige tempo. Exige sacrifício, da mesma forma que qualquer outro trabalho. Só que é recompensador, pois Deus é recompensador dos que o buscam seriamente.
`,
  },
]

export function findDiaryEntry(slug: string | undefined): DiaryEntry | undefined {
  if (!slug) return undefined
  return DIARY_ENTRIES.find((entry) => entry.slug === slug)
}
