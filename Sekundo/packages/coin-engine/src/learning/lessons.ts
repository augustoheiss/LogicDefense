/**
 * Micro-Lessons & Financial Literacy Curriculum — Assistente Moeda
 *
 * Bite-sized, jargon-free lessons tailored for Brazilian families
 * and individuals seeking financial health and autonomy.
 */

export interface MicroLesson {
  id: string;
  category: 'primeiros_socorros' | 'reserva' | 'orcamento' | 'economia' | 'investimentos';
  title: string;
  readingMinutes: number;
  pillar: 'cashflow' | 'reserve' | 'discipline' | 'efficiency';
  summary: string;
  content: string;
  keyTakeaway: string;
  actionChallenge: string;
}

export const FINANCIAL_LESSONS: MicroLesson[] = [
  {
    id: 'les_01_primeiros_passos',
    category: 'primeiros_socorros',
    title: 'Onde Foi Parar o Meu Dinheiro?',
    readingMinutes: 2,
    pillar: 'discipline',
    summary: 'A sensação de trabalhar o mês todo e não ver a cor do dinheiro quase sempre vem dos pequenos vazamentos invisíveis.',
    content: `Você já teve a sensação de receber o salário e, duas semanas depois, a conta estar vazia sem você saber exatamente por quê?

Isso raramente acontece por causa de uma grande compra planejada. Acontece pelos "ralos invisíveis":
- Entregas de comida por aplicativo no cansaço da semana.
- Assinaturas de serviços esquecidos que cobram todo mês no cartão.
- Pequenos lanches e cafés diários de R$ 10 ou R$ 15 que somam R$ 450 no fim do mês.

O primeiro passo não é cortar tudo e viver de privação. É apenas ANOTAR. Quando você anota, você tira o gasto do piloto automático e devolve o comando para você.`,
    keyTakeaway: 'Você não pode controlar o que você não mede. Anotar é o primeiro ato de liberdade financeira.',
    actionChallenge: 'Anote 100% do que você gastar nos próximos 3 dias, até a bala de troco.',
  },
  {
    id: 'les_02_reserva_sem_neura',
    category: 'reserva',
    title: 'Reserva de Emergência: O Colchão da Família',
    readingMinutes: 3,
    pillar: 'reserve',
    summary: 'Reserva não é para te deixar rico; é para impedir que você fique pobre no primeiro imprevisto.',
    content: `Imprevistos não avisam quando vão chegar: um pneu que fura, um dente que quebra, um remédio urgente ou a perda temporária de renda.

Sem reserva, qualquer imprevisto vira dívida no rotativo do cartão (com juros de mais de 400% ao ano) ou no cheque especial.

Como calcular a reserva de emergência da sua família:
1. Some apenas suas despesas ESSENCIAIS mensais (aluguel, condomínio, luz, água, mercado básico, remédios).
2. Multiplique por 3 meses (se você tem emprego com estabilidade ou CLT).
3. Multiplique por 6 meses (se você é autônomo, freelancer ou PJ).

Onde guardar?
Em locais com **liquidez diária** (que você saca na hora) e baixo risco: Tesouro Selic ou CDB de banco confiável com 100% do CDI. Nunca na poupança (que rende menos que a inflação) e nunca em ações de risco.`,
    keyTakeaway: 'Reserva de emergência compra paz de espírito e noites de sono tranquilo.',
    actionChallenge: 'Defina hoje um valor inicial simbólico (mesmo que seja R$ 50) e guarde em um CDB com liquidez diária.',
  },
  {
    id: 'les_03_regra_50_30_20',
    category: 'orcamento',
    title: 'A Regra dos Três Potes: 50 - 30 - 20',
    readingMinutes: 3,
    pillar: 'cashflow',
    summary: 'Um método simples e visual para dividir sua renda sem planilhas complexas de centenas de linhas.',
    content: `Se o seu orçamento é complexo demais, você vai desistir em duas semanas. A regra dos 3 potes simplifica tudo:

1. **50% para Necessidades Básicas:**
   Moradia, comida de supermercado, contas de consumo (água, luz, internet), transporte e saúde. Se esse pote estiver passando de 60%, é sinal de que o padrão fixo de vida está alto demais para o momento.

2. **30% para Desejos Pessoais & Lazer:**
   Passeios com a família, streaming, delivery de fim de semana, roupas e hobbies. Cortar 100% do lazer gera frustração e recaída de consumo. O lazer precisa ter espaço com limite claro!

3. **20% para o Seu Futuro & Dívidas:**
   Quitação de dívidas caras, construção da reserva de segurança e investimentos futuros. Pague a si mesmo primeiro assim que o salário cair.`,
    keyTakeaway: 'Divida sua renda em 3 grandes grupos antes de começar a gastar.',
    actionChallenge: 'Calcule quanto 50% da sua renda representa hoje e compare com o total das suas contas fixas.',
  },
  {
    id: 'les_04_dividas_inteligentes',
    category: 'primeiros_socorros',
    title: 'A Bola de Neve das Dívidas e Como Estancar',
    readingMinutes: 3,
    pillar: 'efficiency',
    summary: 'Nem toda dívida é igual. Priorizar a ordem certa de pagamento economiza milhares de reais em juros.',
    content: `Quando as contas acumulam, muitas pessoas cometem o erro de pagar a dívida de menor valor primeiro, ignorando a taxa de juros.

Hierarquia de combate às dívidas:
1. **Dívidas Assassinas (Juros Explosivos):**
   Cartão de crédito rotativo e cheque especial. Devem ser eliminadas IMEDIATAMENTE. Se não der para pagar à vista, pegue um crédito consignado ou empréstimo pessoal com juros bem menores para liquidá-las de uma vez.
2. **Dívidas Essenciais à Sobrevivência:**
   Luz, água e aluguel. O atraso resulta em corte de serviços essenciais ou despejo.
3. **Dívidas com Garantia:**
   Financiamento de imóvel ou carro. O atraso constante pode levar à perda do bem.
4. **Dívidas sem Garantia:**
   Carnês de lojas ou empréstimos pessoais simples. São as melhores para renegociar com grandes descontos em feirões como o Serasa Limpa Nome.`,
    keyTakeaway: 'Troque dívidas caras (cartão rotativo) por dívidas mais baratas para estancar os juros.',
    actionChallenge: 'Liste todas as pendências da família com o valor total e a taxa mensal de juros de cada uma.',
  },
  {
    id: 'les_05_investir_sem_medo',
    category: 'investimentos',
    title: 'O Poder dos Juros Compostos a Seu Favor',
    readingMinutes: 3,
    pillar: 'efficiency',
    summary: 'Fazer o dinheiro trabalhar para você não requer ser especialista da bolsa.',
    content: `Juros compostos podem ser seus maiores inimigos (quando você deve ao banco) ou seus maiores aliados (quando você investe com regularidade).

A matemática da constância:
Se você guardar **R$ 200 por mês** a uma taxa média de 10% ao ano:
- Em 5 anos: você terá acumulado ~R$ 15.500 (com R$ 3.500 apenas de juros ganhos).
- Em 10 anos: você terá acumulado ~R$ 41.000 (com R$ 17.000 de juros ganhos!).
- Em 20 anos: você terá acumulado ~R$ 151.000 (com R$ 103.000 ganhos só de juros!).

Perceba: com o tempo, o dinheiro gerado pelos juros supera em muito o dinheiro que você tirou do bolso. O segredo não é a quantia inicial, é o tempo e a disciplina.`,
    keyTakeaway: 'A consistência mensal supera o valor inicial. Comece hoje com o que tiver.',
    actionChallenge: 'Simule agora mesmo no What-If o impacto de poupar R$ 150 por mês durante 3 anos.',
  },
];
