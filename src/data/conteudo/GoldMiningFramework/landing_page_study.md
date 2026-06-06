# 🎨 Estudo de Reestruturação da Landing Page (Framework BAB)

Este documento detalha o estudo conceitual de UI/UX e copywriting estruturado de acordo com o framework **Before-After-Bridge (BAB)**, mapeando os requisitos do Assistente-Moeda para a nova versão da Landing Page.

## 1. Mapeamento de Copywriting & Mensagem

O objetivo é substituir a copy atual por uma linguagem visceral, baseada nas dores reais mineradas nos ecossistemas e estruturadas em `GoldMiningFramework.md`.

### 1️⃣ Above the Fold (A Entrada do Sistema)
* **Headline**: *"Assuma o Volante do seu Fluxo de Caixa Real e Pare de Dirigir de Olhos Vendados"*
* **Subheadline**: *"O Assistente-Moeda não é uma planilha comum. É um motor de inteligência financeira local com IA que fatia seus custos invisíveis por dia e calcula seu lucro líquido real, integrando juros compostos automatizados e relatórios de auditoria."*
* **Benefícios Rápidos (Quick Benefits)**:
  * **✦ Meta Diária de Sobrevivência Dinâmica**: Saiba os primeiros Reais do dia que já estão comprometidos antes de ligar o motor.
  * **✦ Rendimento de Portfólio Integrado**: Loop cronológico de juros compostos a 0.8%/mês CDI direto nos aportes salvos.
  * **✦ Soberania Absoluta dos Dados**: Processamento local criptografado. Nada sai do seu dispositivo.

### 2️⃣ O Antes (Before — Dor Real)
* **Título**: *"A Ilusão do Lucro e o Pesadelo das Contas Anuais Invisíveis"*
* **Foco**: O motorista/profissional que fatura bem, mas é pego de surpresa por custos fixos anuais diluídos.
* **Card 1 — A Falsa Sensação de Riqueza**: *"Você faz um faturamento bruto excelente na semana, mas esquece que o IPVA, o seguro, a depreciação e a manutenção estão correndo em silêncio debaixo dos seus pés. Quando a conta chega no final do ano, o seu lucro simplesmente desaparece."*
* **Card 2 — Planilhas Tradicionais que Mentem**: *"Lançar um gasto de R$ 3.000 em Janeiro faz aquele mês parecer um desastre completo, e os meses seguintes parecerem falsamente lucrativos. Sem diluir os custos fixos no tempo por regime de competência, você está operando no escuro."*
* **Desconstrução de Crença**: *"Muitos motoristas e profissionais independentes acreditam que basta anotar o que entra e sai no dia para ter controle. A verdade inconveniente é que sem ratear os custos de longo prazo proporcionalmente pelo calendário, você está gastando capital de giro achando que é lucro."*

### 3️⃣ O Depois (After — O Alívio)
* **Título**: *"Imagine marchar sabendo exatamente onde pisar"*
* **Resultado**: O alívio de saber que os custos anuais já estão cobertos e o que sobra é lucro limpo.
* **Dobra de Resultado**: *"Ligue o seu carro ou abra o seu negócio sabendo que os primeiros R$ 108,00 do dia já estão automaticamente quitados e guardados para as suas contas anuais rateadas. O que passar dessa linha, é lucro real e líquido no seu bolso."*
* **Visual de Sucesso**: Simulação visual interativa ou estática de métricas de estabilidade, exibindo clareza operacional de forma dinâmica (ex: ajustes automáticos para meses de 28 ou 31 dias).

### 4️⃣ A Ponte (Bridge — Apresentando o Produto & Guia Prático)
* **Título**: *"Como Operar o Assistente-Moeda: 3 Passos Simples"*
* **Passos**:
  * **Passo 1 — Lançando o Dia a Dia (Custos Variáveis)**: Adicione despesas pontuais como combustíveis e pedágios com a mesma data de início e fim. O sistema isola o impacto financeiro no mês corrente.
  * **Passo 2 — A Mágica do Rateio Completo (Custos Fixos)**: IPVA ou Seguro Anual? Defina a data inicial e final (ex: 01/Jan a 31/Dez). O motor fatiará o montante, cobrando apenas a fração justa para cada dia de calendário.
  * **Passo 3 — Extraia a Inteligência Máxima**: Rastreie o fluxo diário em gráficos, utilize o Analista de IA para auditoria inteligente local e exporte em PDF com um clique.

---

## 2. Requisitos de UI/UX e Design de Layout

### A. Relação com a Área de Criação de Tabelas (Empty State)
* Atualmente, se o usuário não possui uma tabela ativa, o sistema exibe apenas o painel `EmptyState`.
* **Novo Design**: O `EmptyState` será posicionado no topo da tela inicial como o painel principal de onboarding (com a listagem das tabelas criadas ou o botão de criação).
* Logo abaixo deste painel, renderizaremos o conteúdo completo da Landing Page (`MoedaLandingGuide.tsx`) de forma contínua, permitindo ao usuário rolar a tela e ler sobre os benefícios, o framework BAB e os passos de operação antes de interagir com o sistema.
* Mantemos o mesmo design na exibição padrão quando uma tabela está aberta, com o guia prático no rodapé do editor de tabelas para consultas rápidas.

### B. Consistência Visual e Responsividade
* Uso de wrappers responsivos flex/grid (`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6`) para garantir que os cards se adaptem a smartphones e tablets.
* Manutenção do tema dark e do design glassmorphic premium (bordas brancas translúcidas, fundos escuros, efeitos de brilho em gradiente).
* **Normalização Universal**: Todas as categorias exibidas como exemplo ou mock no guia visual devem estar estritamente em **MAIÚSCULO** (ex: `'AH ITAU'`, `'EH BB'`).
