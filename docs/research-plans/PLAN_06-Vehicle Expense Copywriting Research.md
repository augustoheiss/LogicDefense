# Plano de Pesquisa: Vehicle Expense Copywriting Research

Este documento detalha o plano de implementação e a especificação técnica para o setor de **Veículos e Gestão de Frota (Vertente de Copywriting, Personas e Growth Hacking)**, elaborado a partir do estudo do artigo *"O Dreno Oculto do Ativo Automóvel: Análise de Procura de Mercado, Engenharia de Valor e Persuasão Psicológica para Plataformas de Gestão Financeira"*.

---

## 🎯 Executive Summary & Sector Mapping

* **Setor de Aplicação:** Veículos e Gestão de Frota (Vehicles & Fleet) - Foco em Ativação de Utilizadores, Copywriting e Diferenciação por Segmento.
* **Visão Geral:** O estudo detalha o dreno oculto do TCO automóvel (um desvio médio de $823.44/mês entre a prestação percebida e a realidade estrutural). Ele identifica as dores financeiras de quatro personas de mercado: Trabalhadores Independentes (Freelancers/1099), Motoristas TVDE, Operadores Logísticos e Entusiastas Automotivos. Adicionalmente, propõe uma ativação contextual de UI por meio de expressões baseadas em MCC/transações bancárias em tempo real e fornece cinco frameworks psicológicos de alta conversão fundamentados na engenharia de valor.

---

## 🧮 Mathematical Models & Formulas

### 1. Equação do Dreno Oculto Mensal ($D_{\text{oculto}}$)
Expressa a dissonância cognitiva entre o custo visível (prestação do financiamento $P$) e o custo real estruturado:
$$D_{\text{oculto}} = \text{Depreciação} + \text{Seguro} + \text{Combustível}_{\text{desvio}} + \text{Manutenção}_{\text{provisão}} + \text{Taxas} + \text{Juros}$$
*(no modelo padrão AAA/Vincentric, isso resulta em um desvio mensal de aproximadamente $823.44 USD)*

---

### 2. Impacto da Perda Fiscal em Trabalhadores Independentes ($L_{\text{fiscal}}$)
Se um trabalhador independente negligenciar o registro contemporâneo de uma fração de suas viagens ($\phi_{\text{omissão}}$):
$$\text{MilhasPerdidas} = \text{MilhasProfissionais} \times \phi_{\text{omissão}}$$
$$\text{DeduçãoPerdida} = \text{MilhasPerdidas} \times R_{\text{milhagem\_2026}}$$
$$L_{\text{fiscal}} = \text{DeduçãoPerdida} \times (T_{\text{rendimento}} + T_{\text{independente}})$$
* **Exemplo de 2026:** Com $R_{\text{milhagem\_2026}} = 0.725 \text{ USD/milha}$, $15.000$ milhas anuais e $\phi_{\text{omissão}} = 30\%$:
  $$\text{DeduçãoPerdida} = 4.500 \times 0.725 = 3.262,50 \text{ USD}$$
  Sob uma taxa agregada de $37.3\%$, o prejuízo líquido direto é de **$1.216,91 USD**.

---

### 3. Margem Horária Líquida Real do Motorista TVDE ($LH_{\text{líquido}}$)
Desmistifica o ganho bruto por hora ($GH_{\text{bruto}}$) ao deduzir o custo operacional por milha ($C_{\text{milha}}$) multiplicado pela distância percorrida por hora ($d_{\text{hora}}$):
$$LH_{\text{líquido}} = GH_{\text{bruto}} - (C_{\text{milha}} \times d_{\text{hora}})$$
* **Exemplo Real:** Se $GH_{\text{bruto}} = 25.00 \text{ USD/hora}$ e $C_{\text{milha}} = 0.62 \text{ USD/milha}$ em $20$ milhas/hora (reposicionamento incluído):
  $$LH_{\text{líquido}} = 25.00 - (0.62 \times 20) = 12.60 \text{ USD/hora}$$
*Nota: TVDEs gastam entre 35% e 42% do tempo em vazio (deadhead), sem passageiro, desgastando o ativo sem remuneração direta.*

---

### 4. Desperdício por Milhas em Vazio na Logística ($W_{\text{deadhead}}$)
Calcula a ineficiência de quilometragem não faturada (deadhead miles) para um operador comercial:
$$W_{\text{deadhead}} = \text{MilhasAnuais} \times \phi_{\text{deadhead}} \times C_{\text{combustivel\_milha}}$$
* **Exemplo:** Em $100.000$ milhas com taxa de deadhead de $15\%$ ($\phi_{\text{deadhead}} = 0.15$) e combustível a $0.67 \text{ USD/milha}$:
  $$W_{\text{deadhead}} = 100.000 \times 0.15 \times 0.67 = 10.050 \text{ USD/ano por veículo}$$

---

## 💡 Immediate Implementation Ideas

1. **Notificação Dinâmica de Ativação Contextual (MCC Trigger):**
   Implementar um middleware no frontend que escuta a importação de transações. Se identificar gastos de combustível (ex: "Repsol", "Galp", "Shell"), oficinas ou pedágios, exibe uma notificação suave convidando o utilizador a ativar o módulo automóvel.
2. **Widget "Dreno Oculto do Meu Carro" (Efeito Choque):**
   Um widget visual de onboarding que pede apenas o modelo/valor do carro e exibe imediatamente o gráfico de barras comparando o custo visível (prestação) com o TCO real oculto estimado.
3. **Calculadora TVDE de Rentabilidade Real:**
   Simulador simples de um único ecrã onde o motorista Uber insere as receitas semanais e a milhagem profissional para ver a margem líquida real líquida de desgaste e reposicionamento.
4. **Planeador de Carro de Projeto (Colecionadores):**
   Componente de acompanhamento de restauro dividido em etapas de engenharia (chassis, motor, pintura) com uma aba automática de contingência (calculando $25\%$ de margem de segurança contra flutuações de peças).

---

## 🔬 Topics Needing Deep Study / Open Questions

* **Integração com APIs de Localização:** Para motoristas e freelancers, o registro automático de milhas via GPS no browser pode ser instável ou drenar a bateria do smartphone. Seria melhor integrar APIs de parceiros de telemetria ou criar logs simplificados de início/fim baseados em rotas do Google Maps?
* **Bloqueio Fiscal entre Métodos (IRS):** Como estruturar o alerta de UI para evitar que trabalhadores independentes no Brasil ou EUA façam a escolha incorreta de deduções no Ano 1 de uso de um veículo (impedindo o uso futuro da taxa simplificada)?
* **Reconciliação Automática de Transações Automóvel:** De que forma criar um dicionário leve de palavras-chave locais (Portugal/Brasil) de categorias automóveis para disparar a ativação da interface progressiva com o mínimo de falsos positivos?

---

## 🏷️ CSV Schema & Auto-Activation Tags

### CSV Schema de Viagens de Independentes e TVDE
```csv
data,origem,destino,milhas_km,tipo_viagem,receita_bruta,despesas_combustivel,portagem_estacionamento
```

### Tags de Auto-Ativação (Tags/Metadata que disparam o Módulo de Frota/Copywriting):
* **Cabeçalhos de Colunas / Chaves:** `tipo_viagem`, `receita_bruta`, `despesas_combustivel`, `milhas_km`
* **Expressões e Metadados do Conteúdo:**
  * `TVDE`, `Uber`, `Lyft`, `Bolt`, `TLC NYC`, `Zoepf`, `HR&A`
  * `Freelancer`, `Freelancer Tax`, `1099`, `Milhagem Padrão`, `Dedução de Milhas`, `Despesas Reais`
  * `Owner-Operator`, `Custo por Milha`, `Deadhead`, `Milhas em Vazio`, `Breakeven Logística`
  * `Carro de Projeto`, `Project Car`, `Restauro Clássico`, `Sobrecapitalização`
  * `Your Driving Costs`, `AAA Driving Costs`, `TCO Automóvel`, `Dreno Oculto`
