# Masterclass Módulo 3: Engenharia Financeira Avançada — Algoritmos de Detecção de Wash Transactions e Netting de Saldos
*Manual de Aulas, Especificação de Protocolo de Compensação Líquida e Análise de WhatsAppExporter.tsx*

Este documento serve como o Guia Didático e Manual de Especificação Técnica para o **Módulo 3: Detecção de Wash Transactions e Algoritmos de Netting** no ecossistema Assistente-Moeda. Ele apresenta a modelagem contábil avançada, a análise detalhada do algoritmo de varredura e o plano de aula voltado ao ensino de engenharia de ledger financeiro.

---

## 📑 CAPÍTULO 1: Engenharia Financeira Avançada e a Teoria do Netting

### 1.1 Teoria Contábil (Operações Casadas - Wash Transactions)
No desenho de sistemas de registro de transações (*ledgers*), a integridade dos volumes agregados é constantemente ameaçada por **transações espelhadas** ou **Wash Transactions**. Trata-se de lançamentos de créditos e débitos de valores idênticos que ocorrem dentro do mesmo período operacional, anulando-se mutuamente no saldo de caixa final, mas inflando artificialmente os indicadores de fluxo de caixa bruto (inflows/outflows).

No ecossistema de parcerias de transporte ou representação de frotas, um exemplo clássico é o reembolso de revisão mecânica:
* O parceiro comercial credita $R\$ 2.485,67$ na conta do operador (lançado como `partner_in`).
* O operador imediatamente efetua o pagamento de $R\$ 2.485,67$ referente à taxa de revisão administrativa da concessionária (lançado como `partner_out`).

Sob o regime de caixa tradicional não-netado, a exibição de receita bruta acumularia o crédito, e a de despesa bruto acumularia o débito. Isso cria um **ruído informacional**: o relatório sugere que a operação possui maior velocidade de circulação de capital do que a realidade, distorcendo métricas de produtividade real. O saldo de caixa final não é alterado, mas o volume operacional bruto é inflado artificialmente em $R\$ 4.971,34$.

---

### 1.2 O Princípio da Compensação Líquida (Netting)
Para sanar o ruído informacional das transações casadas, sistemas corporativos modernos aplicam o **Princípio do Netting (Compensação Líquida)**. O netting reduz múltiplos débitos e créditos bilaterais a um único valor líquido de saldo, limpando os registros de volume duplicado.

No Assistente-Moeda, o netting é acompanhado por um mecanismo de **absorção de déficit nas Metas Acumuladas**. Se o saldo líquido de parcerias resulta em uma perda neta (débitos excedendo créditos), essa obrigação pendente não pode simplesmente constar em uma linha flutuante e isolada de despesa secundária. O motor a consolida como uma **dívida acumulada de metas**. 

Ao converter o déficit financeiro de parceria diretamente em semanas equivalentes de trabalho adicionadas ao alvo do motorista, o sistema altera o foco psicológico do operador: ele não visualiza apenas uma meta nominal abstrata, mas sim a necessidade real de cobertura dinâmica do seu passivo líquido total de caixa.

---

## 💻 CAPÍTULO 2: Anatomia do Código Fonte (WhatsAppExporter.tsx)

### 2.1 Análise do Algoritmo de Varredura Cruzada (Wash Detection)
O processo de detecção e netagem em [WhatsAppExporter.tsx](file:///c:/Users/Usuario/Desktop/AHeiss_GoogleDrive/02-Programacao/projetos-IA/LogicDefense/src/tools/CoinAssistant/components/WhatsAppExporter.tsx) inicia-se isolando as transações de parceria reais com valores positivos de entrada e saída:

```typescript
  // Trecho de WhatsAppExporter.tsx (Método buildMessage)
  // Group raw partnership arrays for wash detection (matching credited/debited pairs)
  const partnerInRows = table.rows.filter((r) => r.entryType === 'partner_in' && r.value > 0);
  const partnerOutRows = table.rows.filter((r) => r.entryType === 'partner_out' && r.value > 0);

  const matchedInIds = new Set<string>();
  const matchedOutIds = new Set<string>();
  const canceledPartnerships: TableRow[] = [];
```

As variáveis filtram `table.rows` em dois fluxos de dados, ignorando valores nulos ou negativos. Os `Set<string>` funcionam como tabelas de controle de indexação de IDs para gerenciar o estado interno do loop de compensação.

---

### 2.2 Dissecação do Loop de Pareamento
O loop de correspondência implementa uma varredura cruzada quadrática controlada por estado, garantindo que cada transação de crédito encontre no máximo uma transação de débito de mesmo valor absoluto:

```typescript
  // Trecho de WhatsAppExporter.tsx
  // Identify pairs that have the exact same value
  for (const inRow of partnerInRows) {
    const match = partnerOutRows.find(
      (outRow) =>
        !matchedOutIds.has(outRow.id) &&
        Math.round(outRow.value * 100) === Math.round(inRow.value * 100)
    );

    if (match) {
      matchedInIds.add(inRow.id);
      matchedOutIds.add(match.id);
      canceledPartnerships.push(match);
    }
  }
```

#### Análise da Lógica Linha a Linha:
* **Linha 3**: Para cada entrada de crédito (`inRow`), o motor busca uma correspondência nos débitos.
* **Linha 5**: O método `.find()` aplica um filtro com duas condições rígidas:
  1. O ID do débito analisado (`outRow.id`) **não** pode constar no `Set` de correspondências concluídas (`matchedOutIds`). Isso impede que um único débito compense múltiplos créditos de mesmo valor (dupla contagem).
  2. O valor de saída escalado por 100 centavos (`Math.round(outRow.value * 100)`) deve ser matematicamente idêntico ao de entrada (`Math.round(inRow.value * 100)`). A escala para inteiros elimina erros residuais de ponto flutuante do interpretador Javascript.
* **Linhas 9–13**: Se a correspondência (`match`) for positiva, os IDs são armazenados nos respectivos `Sets` para exclusão das próximas iterações, e o débito é adicionado à lista neutra de `canceledPartnerships`.

---

### 2.3 Mecanismo de Absorção de Déficit no Saldo Acumulado
Após a identificação e remoção das Wash Transactions, os registros sem correspondência são agrupados para extrair o déficit real pendente:

```typescript
  // Trecho de WhatsAppExporter.tsx
  // Keep unmatched outstanding rows to accurately represent true outstanding surpluses or liabilities
  const unmatchedPartnerOut = partnerOutRows.filter((r) => !matchedOutIds.has(r.id));

  const recentPartnerOut = unmatchedPartnerOut
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10);

  // Partnership Netting Calculations
  const totalCreditosParceria = metrics.totalPartnerIn;
  const totalDebitosParceria = metrics.totalPartnerOut;
  const netPartnershipDelta = totalCreditosParceria - totalDebitosParceria;
  const partnershipDeficit = netPartnershipDelta < 0 ? Math.abs(netPartnershipDelta) : 0;

  // Absorb Net Deficit into Metas Acumuladas
  const adjustedMetasAcumuladas = goalTarget + partnershipDeficit;
  const partnershipDeficitWeeks = reportWeeklyGoal > 0 ? partnershipDeficit / reportWeeklyGoal : 0;
  const adjustedGoalTotalWeeks = metrics.goalTotalWeeks + partnershipDeficitWeeks;
```

#### Detalhe Arquitetural:
* A variável `unmatchedPartnerOut` extrai as obrigações reais que não tiveram compensação correspondente de receita.
* O motor calcula a variação líquida global da parceria (`netPartnershipDelta`). Caso seja negativa, converte o déficit financeiro em frações de semanas úteis de trabalho baseadas na meta semanal do período ativo (`partnershipDeficitWeeks = partnershipDeficit / reportWeeklyGoal`).
* O alvo acumulado ajustado (`adjustedMetasAcumuladas`) e as semanas de esforço necessárias (`adjustedGoalTotalWeeks`) sofrem incremento, absorvendo dinamicamente a dívida real de parceria.

---

## 📊 CAPÍTULO 3: Harmonização Matemática e Indicadores Semanais

### 3.1 A Equação Algébrica de Harmonização das Semanas de Equilíbrio
No painel consolidado do relatório exportado, o motor do Assistente-Moeda calcula o saldo final correlacionando os fluxos operacionais purificados e os fluxos netados de parceria. Para alinhar a posição de caixa e o número de semanas acumuladas equivalentes, o sistema aplica a seguinte equação de harmonização:

Seja:
* $W_{\text{final}}$: Número de semanas líquidas resultantes exibido no saldo final do relatório.
* $W_{\text{net}}$: Semanas líquidas operacionais calculadas com base na receita operacional e justificativas (excluindo parcerias).
* $\Delta_{\text{parceria}}$: Delta financeiro líquido de parcerias ($totalPartnerIn - totalPartnerOut$).
* $G_{\text{semanal}}$: Meta de faturamento semanal em vigência no período ($reportWeeklyGoal$).

A harmonização matemática é definida como:

$$W_{\text{final}} = W_{\text{net}} + \frac{\Delta_{\text{parceria}}}{G_{\text{semanal}}}$$

Na implementação de `WhatsAppExporter.tsx`, a correspondência de variáveis do código é:

```typescript
const finalWeeks = metrics.netBalanceWeeks + netPartnershipWeeks;
```

Onde `netPartnershipWeeks` é calculado via:

$$\text{netPartnershipWeeks} = \frac{\text{netPartnershipDelta}}{\text{reportWeeklyGoal}}$$

Esta relação garante que a conversão monetária e temporal permaneça em equilíbrio exato.

---

### 3.2 Lógica de Layout Condicional de Linhas no Relatório de Texto
O compilador de mensagens em `WhatsAppExporter.tsx` adota uma lógica de supressão seletiva de linhas baseado no netting para manter a legibilidade:

1. **Supressão de Linhas Brutas:** As linhas clássicas de "Créditos Brutos de Parceria" e "Débitos Brutos de Parceria" são totalmente omitidas do corpo de indicadores para evitar poluição visual.
2. **Absorção de Déficit:** Se $\Delta_{\text{parceria}} < 0$, a linha principal de metas é alterada para exibir:
   `(−) Metas Acumuladas + Déficit Parceria: R$ adjustedMetasAcumuladas (adjustedGoalTotalWeeks sem)`
   Imediatamente abaixo, o sistema injeta a listagem de pendências reais não compensadas:
   `🔎 Déficit Real de Parceria (A pagar):` detalhando os últimos 10 débitos de `recentPartnerOut`.
3. **Divisão de Parcerias Compensadas:** Caso existam transações casadas anuladas ($|canceledPartnerships| > 0$), elas são renderizadas no rodapé sob uma seção de impacto zero no caixa:
   ```markdown
   🤝 *Parcerias Compensadas (Impacto Zero no Caixa):*
     • DD/MM: *R$ Value* — Description _(Anulado/Compensado)_
   ```

---

## 🎓 CAPÍTULO 4: Roteiro Pedagógico e Blueprint de Aula

### 4.1 Lesson Plan: Netting Contábil e Varredura Cruzada de Transações

#### Objetivo de Aprendizagem
Instruir desenvolvedores sênior sobre a concepção e implementação de algoritmos de netagem e filtragem de ruído operacional em relatórios financeiros exportados.

#### Cronograma da Aula (60 Minutos)

| Tempo | Tópico | Estratégia Pedagógica | Foco do Instrutor |
| :--- | :--- | :--- | :--- |
| **00:00 - 00:15** | O Fenômeno das Wash Transactions | Apresentação teórica das operações espelhadas. | Mostrar o ruído gerado por entradas/saídas duplicadas. |
| **00:15 - 00:35** | Dissecação do Algoritmo de Busca com Sets | Análise do loop em `WhatsAppExporter.tsx`. | Explicar o papel do `Set` na prevenção de dupla compensação. |
| **00:35 - 00:50** | Harmonização Matemática Temporal | Revisão da equação de semanas de compensação. | Demonstrar como a conversão temporal alinha-se ao saldo monetário. |
| **00:50 - 11:00** | Escrita de Testes e Simulação de Netting | Laboratório interativo de codificação e testes. | Orientar a escrita de asserções em cenários de netting complexos. |

---

### 4.2 Blueprint do Slide Deck

#### Slide 1: Ruído em Ledgers Financeiros
* **Título do Slide**: O Ruído das Wash Transactions
* **Texto Informativo**:
  * Transações casadas bilaterais inflam o fluxo de caixa bruto artificialmente.
  * Reembolsos imediatos de serviços operacionais ocultam a real escala financeira do negócio.
* **Componente Visual**: Diagrama de fluxo de caixa mostrando duas setas cruzadas de entrada e saída de $R\$ 2.485,67$ rotuladas como "Impacto Líquido Real = R$ 0,00".

#### Slide 2: Pareamento Sem Dupla Contagem
* **Título do Slide**: Estrutura de Busca com Indexadores Estritos (`Set`)
* **Código em Foco**:
  ```typescript
  !matchedOutIds.has(outRow.id) &&
  Math.round(outRow.value * 100) === Math.round(inRow.value * 100)
  ```
* **Destaque Didático**: Explicar como a indexação impede que um débito seja associado a múltiplos créditos de mesmo valor.

#### Slide 3: Harmonização Temporal das Metas
* **Título do Slide**: Conversão Unificada de Déficits para Metas Temporais
* **Equação em Foco**:
  $$W_{\text{final}} = W_{\text{net}} + \frac{\Delta_{\text{parceria}}}{G_{\text{semanal}}}$$
* **Explicação**: Se o motorista possui um déficit operacional de parcerias de $R\$ 800,00$ e sua meta semanal é de $R\$ 400,00$, o motor acrescenta automaticamente exatamente $2$ semanas de esforço adicional no saldo consolidado.

---

### 4.3 Laboratório Prático de Auditoria (Student Handout)

#### Cenário de Execução
Escrever uma suíte de testes de regressão para verificar o algoritmo de netagem e a absorção de déficit de parceria. A base de teste deve simular:
1. Uma transação casada (crédito de $R\$ 2.485,67$ e débito de $R\$ 2.485,67$) que deve ser netada com impacto nulo.
2. Um débito excedente sem compensação (multa de $R\$ 400,00$) que deve incrementar as obrigações acumuladas.

#### Código de Teste (Vitest / Jest)
Peça para os alunos implementarem e rodarem a suíte abaixo para consolidar o aprendizado:

```typescript
import { describe, it, expect } from 'vitest';
import type { TableRow, TableGoals, TableMetrics } from '../types';

// Mock simples da lógica de netting adaptado do WhatsAppExporter para testes unitários
function runTestNetting(rows: TableRow[], reportWeeklyGoal: number, goalTarget: number, initialGoalTotalWeeks: number) {
  const partnerInRows = rows.filter((r) => r.entryType === 'partner_in' && r.value > 0);
  const partnerOutRows = rows.filter((r) => r.entryType === 'partner_out' && r.value > 0);

  const matchedInIds = new Set<string>();
  const matchedOutIds = new Set<string>();
  const canceledPartnerships: TableRow[] = [];

  for (const inRow of partnerInRows) {
    const match = partnerOutRows.find(
      (outRow) =>
        !matchedOutIds.has(outRow.id) &&
        Math.round(outRow.value * 100) === Math.round(inRow.value * 100)
    );

    if (match) {
      matchedInIds.add(inRow.id);
      matchedOutIds.add(match.id);
      canceledPartnerships.push(match);
    }
  }

  const unmatchedPartnerOut = partnerOutRows.filter((r) => !matchedOutIds.has(r.id));
  const totalPartnerIn = partnerInRows.reduce((sum, r) => sum + r.value, 0);
  const totalPartnerOut = partnerOutRows.reduce((sum, r) => sum + r.value, 0);

  const netPartnershipDelta = totalPartnerIn - totalPartnerOut;
  const partnershipDeficit = netPartnershipDelta < 0 ? Math.abs(netPartnershipDelta) : 0;

  const adjustedMetasAcumuladas = goalTarget + partnershipDeficit;
  const partnershipDeficitWeeks = reportWeeklyGoal > 0 ? partnershipDeficit / reportWeeklyGoal : 0;
  const adjustedGoalTotalWeeks = initialGoalTotalWeeks + partnershipDeficitWeeks;

  return {
    canceledPartnerships,
    unmatchedPartnerOut,
    netPartnershipDelta,
    adjustedMetasAcumuladas,
    adjustedGoalTotalWeeks
  };
}

describe('Auditoria de Netting e Compensação de Parceria', () => {
  it('deve identificar e anular transações casadas idênticas e absorver débitos extras', () => {
    // 1. Configurando transações históricas operacionais
    const testRows: TableRow[] = [
      // Entrada e saída casadas (Wash Transactions)
      {
        id: 'p-in-1',
        date: '2026-06-10',
        value: 2485.67,
        entryType: 'partner_in',
        description: 'REEMBOLSO REVISAO'
      },
      {
        id: 'p-out-1',
        date: '2026-06-10',
        value: 2485.67,
        entryType: 'partner_out',
        description: 'PAGAMENTO REVISAO'
      },
      // Débito órfão excedente (Déficit Real)
      {
        id: 'p-out-2',
        date: '2026-06-12',
        value: 400.00,
        entryType: 'partner_out',
        description: 'TAXA EXTRA CONTRATUAL'
      }
    ];

    const reportWeeklyGoal = 400.00;
    const goalTarget = 1600.00; // 4 semanas nominais
    const initialGoalTotalWeeks = 4.0;

    // 2. Executando o modelo de netting
    const res = runTestNetting(testRows, reportWeeklyGoal, goalTarget, initialGoalTotalWeeks);

    // 3. Validação das compensações de impacto zero
    expect(res.canceledPartnerships.length).toBe(1);
    expect(res.canceledPartnerships[0].id).toBe('p-out-1'); // Debito espelhado netado
    expect(res.unmatchedPartnerOut.length).toBe(1);
    expect(res.unmatchedPartnerOut[0].id).toBe('p-out-2'); // Apenas a taxa extra restou

    // 4. Validação da consolidação líquida de metas
    // O delta líquido é de R$ 2.485,67 - (R$ 2.485,67 + R$ 400,00) = -R$ 400,00 (déficit)
    expect(res.netPartnershipDelta).toBe(-400.00);
    
    // As metas acumuladas devem absorver o déficit excedente de R$ 400,00
    // Meta ajustada: R$ 1.600,00 + R$ 400,00 = R$ 2.000,00
    expect(res.adjustedMetasAcumuladas).toBe(2000.00);

    // O tempo de meta deve sofrer acréscimo proporcional de exatamente 1 semana (R$ 400 déficit / R$ 400 meta)
    // Total de semanas ajustado: 4.0 + 1.0 = 5.0 semanas
    expect(res.adjustedGoalTotalWeeks).toBe(5.0);
  });
});
```
