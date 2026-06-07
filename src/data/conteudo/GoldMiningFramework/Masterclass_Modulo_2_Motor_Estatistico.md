# Masterclass Módulo 2: O Motor Matemático — Dilatação Temporal de Alta Fidelidade e Projeções
*Manual de Aulas, Engenharia Reversa e Especificação Técnica do Motor Estatístico*

Este documento serve como o Guia Didático e Manual de Especificação Técnica do **Módulo 2: O Motor de Projeção Estatística e Dilatação Temporal** no ecossistema Assistente-Moeda. Ele apresenta de forma aprofundada a modelagem matemática, a anatomia do código-fonte e o blueprint de treinamento para capacitar equipes de engenharia a construir sistemas de previsão financeira sem corrupção de dados contratuais.

---

## 📑 CAPÍTULO 1: O Modelo de Projeção Estatística e Dilatação Temporal

### 1.1 Teoria Contábil: Despesas Variáveis vs. Passivos Contratuais Prorrogados
Na ciência de dados financeiros aplicada, a projeção de dados históricos para períodos futuros (dilatação temporal ou *time-dilation*) exige a separação estrita de dois comportamentos macroeconômicos de transações:

1. **Despesas Variáveis Operacionais (Variable Expenses):** Custos flutuantes associados à frequência de atividade (ex: combustível, alimentação, manutenção corretiva). Esses itens dependem do volume de trabalho e devem ser tratados estatisticamente por médias distribuídas. Se o motorista gastou $R\$ 1.200,00$ de combustível ao longo de um período de origem de 3 meses, o valor mensal esperado é a diluição direta desse total pelo tempo decorrido, distribuído de forma homogênea no período de destino.
2. **Passivos Rateados/Contratuais (Fixed/Prorated Liabilities):** Contratos fixos que possuem um valor nominal absoluto e uma duração pré-definida (ex: Financiamento de veículo de $R\$ 85.000,00$ em 60 parcelas, IPVA de $R\$ 5.259,00$, seguro anual de $R\$ 8.217,00$). A natureza contábil desses passivos impede sua diluição temporal no momento da projeção. O valor nominal do contrato não pode diminuir simplesmente porque o período de origem analisado foi mais longo.

A dilatação temporal para despesas variáveis opera sob um modelo de **extrapolação de densidade**, enquanto os passivos contratuais operam sob um modelo de **preservação e translação de integridade**.

---

### 1.2 A Anatomia do Bug de Diluição Global (Fator 12x)
No sistema de projeção legado, o motor estatístico aplicava uma regra de diluição uniforme baseada em um denominador calendário global (`globalSourceMonthCount`).

#### A Fórmula do Erro Legado:
Seja $T$ um passivo contratual anual (IPVA) com valor total $V_T = R\$ 5.259,00$ e duração de 12 meses, registrado uma única vez em um ano de origem ($N_{\text{origem}} = 12$ meses).
O sistema legado calculava o valor estatístico médio da categoria da seguinte forma:

$$\text{Valor Mensal Médio Errado } (M_{\text{errado}}) = \frac{\sum V_T}{N_{\text{origem}}} = \frac{R\$ 5.259,00}{12} \approx R\$ 438,25$$

No momento de projetar o passivo para o ano de destino como um novo contrato de 12 meses, o motor multiplicava esse valor mensal diluído pela duração média do período ($S_T = 12$ meses):

$$V_{\text{projetado}} = M_{\text{errado}} \times S_T = R\$ 438,25 \times 12 \approx R\$ 5.259,00$$

Até aqui, a multiplicação anulava a divisão. No entanto, se o IPVA de origem de $R\$ 5.259,00$ fosse parcelado (ex: 5 parcelas de $R\$ 1.051,80$) ou se fosse um financiamento único registrado no ano, o sistema multiplicava as médias de ocorrência de forma distorcida. 

Se um financiamento de $R\$ 85.000,00$ em 60 parcelas ocorresse na origem, o sistema realizava o seguinte cálculo:
1. Somava o valor do financiamento na origem: $R\$ 85.000,00$.
2. Dividia pelo denominador global de meses do ano analisado ($12$ meses):

$$\text{Média Mensal } (M_{\text{errado}}) = \frac{R\$ 85.000,00}{12} \approx R\$ 7.083,33$$

3. Ao gerar a projeção na tabela de destino, em vez de reinserir o contrato original de $R\$ 85.000,00$ para o motor de rateio diário processar, o sistema inseria o valor diluído de $R\$ 7.083,33$ como o valor total do contrato de 60 meses.

Quando o motor de competência diária de destino lia esse contrato projetado, ele recalculava a taxa diária com base no valor corrompido:

$$\text{Taxa Diária Corrompida} = \frac{R\$ 7.083,33}{60 \text{ meses} \times 30,44 \text{ dias}} \approx R\$ 3,87\text{ por dia}$$

O valor correto de rateio diário deveria ser:

$$\text{Taxa Diária Correta} = \frac{R\$ 85.000,00}{60 \text{ meses} \times 30,44 \text{ dias}} \approx R\$ 46,54\text{ por dia}$$

Este erro introduzia um desvio de subestimação massivo de **12 vezes (fator 12x)**, ocultando os custos operacionais reais do negócio.

---

### 1.3 A Solução de Ancoragem Local via `proratedCount`
Para anular o fator de diluição global, o motor de previsão estatística foi refatorado para usar uma **ancoragem local**. Em vez de utilizar o denominador global de meses calendário decorridos, a fórmula para despesas contratuais rateadas foi alterada para dividir as somas acumuladas estritamente pelo número de ocorrências daquela categoria específica (`g.proratedCount`):

#### 1. Mapeamento de Ocorrência Local:
Seja $C$ uma categoria identificada como prorrateada (`isProrated = true`). Seja $P_C$ o conjunto de transações da categoria $C$ no período de origem. O denominador local de cálculo passa a ser:

$$D_{\text{local}} = \text{proratedCount}_C = |P_C|$$

#### 2. Cálculo do Valor Mensal de Alta Fidelidade:
$$\text{Valor Mensal Preservado } (\text{avgMonthlyValue}_C) = \frac{\sum_{i \in P_C} \text{monthlyValue}_i}{\text{proratedCount}_C}$$

#### 3. Cálculo do Valor Total Preservado:
$$\text{Valor Total Preservado } (\text{avgTotalValue}_C) = \frac{\sum_{i \in P_C} \text{value}_i}{\text{proratedCount}_C}$$

Com essa alteração, se o financiamento de $R\$ 85.000,00$ ocorre uma única vez no histórico, o denominador local será exatamente $1$:

$$\text{avgTotalValue}_C = \frac{R\$ 85.000,00}{1} = R\$ 85.000,00$$

Ao gerar o payload de projeção estatística de destino, o sistema ignora divisões globais e injeta o valor nominal de $R\$ 85.000,00$ ancorado diretamente no atributo `value` do registro projetado. Isso garante que a competência diária calcule a curva de custos com precisão no período de destino.

---

## 💻 CAPÍTULO 2: Anatomia do Código Fonte (usePredictionEngine.ts)

### 2.1 Análise de Interfaces do TypeScript
Para acomodar a ancoragem local de valores contratuais, a interface `CategoryStats` foi expandida em [usePredictionEngine.ts](file:///c:/Users/Usuario/Desktop/AHeiss_GoogleDrive/02-Programacao/projetos-IA/LogicDefense/src/tools/CoinAssistant/hooks/usePredictionEngine.ts) com o campo opcional `avgTotalValue`:

```typescript
interface CategoryStats {
  description: string;                  // Descritor único da categoria (normalizado em UPPERCASE)
  entryType: TableRow['entryType'];     // Tipo de entrada ('expense', 'revenue', etc.)
  avgMonthlyTotal: number;              // Média mensal diluída globalmente (para custos variáveis)
  avgFrequency: number;                 // Frequência média mensal calculada (mínimo 1)
  
  /** Marcador booleano que determina se a categoria usa periodStart/periodEnd */
  isProrated: boolean;
  
  /** Duração média do contrato em meses */
  avgPeriodSpanMonths: number;
  
  /** Valor mensal médio local da despesa (valor de parcela) */
  avgMonthlyValue: number;
  
  /** Âncora de preservação do valor total original do contrato */
  avgTotalValue?: number;
}
```

*Importância Arquitetural do `avgTotalValue`:* Este campo funciona como uma âncora de segurança que impede o motor de reconstruir o valor total por multiplicação de aproximações decimais (`avgMonthlyValue * avgPeriodSpanMonths`), o que geraria desvios causados por arredondamentos em centavos.

---

### 2.2 Dissecação do Loop de Médias Estáticas
No loop de agregação do método `generateStatisticalData`, a lógica utiliza o marcador `isProrated` para ramificar os caminhos de cálculo. Veja o trecho exato que realiza esta divisão matemática:

```typescript
  // Trecho de usePredictionEngine.ts
  const stats: CategoryStats[] = Object.values(groups).map((g) => {
    // Uma categoria é classificada como prorrateada se a maioria das suas ocorrências tiver datas de período
    const isProrated = g.proratedCount > 0 && (g.proratedCount / g.count) >= 0.5;

    // ── CUSTO VARIÁVEL: Utiliza o denominador calendário GLOBAL (diluição temporal)
    const trueMonthlyAverage = Math.round((g.totalValue / globalSourceMonthCount) * 100) / 100;
    const trueMonthlyFrequency = Math.max(1, Math.round(g.count / globalSourceMonthCount));

    // ── PASSIVO CONTRATUAL: Ignora o calendário global. Utiliza o denominador de ocorrência LOCAL
    const trueAvgMonthlyValue = isProrated
      ? Math.round((g.totalMonthlyValue / g.proratedCount) * 100) / 100
      : 0;

    const avgTotalValue = isProrated
      ? Math.round((g.totalValue / g.proratedCount) * 100) / 100
      : undefined;

    return {
      description: g.desc,
      entryType: g.et,
      avgMonthlyTotal: trueMonthlyAverage,
      avgFrequency: trueMonthlyFrequency,
      isProrated,
      avgPeriodSpanMonths: isProrated
        ? Math.max(1, Math.round(g.totalPeriodSpanMonths / g.proratedCount))
        : 1,
      avgMonthlyValue: trueAvgMonthlyValue,
      avgTotalValue,
    };
  });
```

*Análise de Engenharia do Código:*
* **Linha 4:** O motor aplica um limiar probabilístico: se mais de 50% dos registros de uma categoria tiverem períodos definidos (`proratedCount / count >= 0.5`), ela é tratada como um passivo contratual.
* **Linhas 12–17:** Quando `isProrated` é verdadeiro, as variáveis de valor contratual (`trueAvgMonthlyValue` e `avgTotalValue`) dividem os acumulados locais pelo contador `g.proratedCount`, mantendo o valor estático imune ao tamanho do período analisado.

---

### 2.3 Mapeamento Direto do Payload Provisionado
Para evitar perdas de centavos, o payload de inserção de dados sintéticos substitui a fórmula de reconstrução aritmética pelo valor estático ancorado. Veja o mapeamento final no construtor de previsão:

```typescript
        // Trecho de usePredictionEngine.ts
        const periodStartYM = targetYM;
        const periodEndYM   = addMonths(targetYM, cat.avgPeriodSpanMonths - 1);
        const periodEndMaxDay = daysInMonth(periodEndYM);
        const monthCount = cat.avgPeriodSpanMonths;
        const monthlyValue = cat.avgMonthlyValue;
        
        // Atribuição direta do valor contratual ancorado para evitar erros de multiplicação
        const totalValue = cat.avgTotalValue ?? 0;

        if (totalValue <= 0) continue;

        result.push({
          date: `${periodStartYM}-01`,
          value: totalValue,
          description: cat.description,
          entryType: cat.entryType,
          periodStart: `${periodStartYM}-01`,
          periodEnd: `${periodEndYM}-${pad2(periodEndMaxDay)}`,
          monthlyValue,
          monthCount,
          generatedBy: 'predicted',
          clonedFrom: sourceMonths.join(','),
        });
```

*Diferença Metodológica:* O código atribui `value: totalValue` diretamente de `cat.avgTotalValue`. A multiplicação antiga ($monthlyValue \times monthCount$) foi removida. Isso elimina erros de precisão decimal do ponto flutuante em sistemas Javascript.

---

## 📊 CAPÍTULO 3: Estrutura de Metadados e Payloads Provisionados

### 3.1 Anatomia do Payload Provisionado e Rastreabilidade
As transações sintéticas geradas pelo motor estatístico precisam ser monitoradas e distinguidas dos lançamentos reais efetuados pelo usuário. Para isso, o payload provisionado injeta metadados de auditoria:

*   `generatedBy: 'predicted'`: Tag de identificação de origem sintética por previsão estatística. Permite que o componente visual aplique classes CSS diferenciadas (ex: borda tracejada ou opacidade de 70%), além de possibilitar filtros de exclusão em massa sem afetar o banco de dados real.
*   `clonedFrom: '2025-01,2025-02,2025-03'`: String contendo o conjunto de meses históricos usados para calcular a estatística. Fornece uma trilha de auditoria (*lineage*), permitindo rastrear a origem matemática da previsão em caso de divergências.
*   `monthlyValue` e `monthCount`: Registram as parcelas estimadas para que o formulário de edição de destino exiba as informações do contrato projetado de forma transparente.

---

### 3.2 Integração com o Schema Geral `TableRow`
Os payloads gerados integram-se diretamente no schema da tabela sem exigir adaptações estruturais:

```json
{
  "date": "2027-01-01",
  "value": 85000.00,
  "description": "FINANCIAMENTO VEICULO",
  "entryType": "expense",
  "periodStart": "2027-01-01",
  "periodEnd": "2031-12-31",
  "monthlyValue": 1416.67,
  "monthCount": 60,
  "generatedBy": "predicted",
  "clonedFrom": "2025-01,2025-02,2025-03"
}
```

Quando esse objeto é inserido na base de dados (`table.rows`), o motor de competência diária (`useMetricsEngine.ts`) o processa de forma natural:
1. Detecta `periodStart` e `periodEnd`.
2. Calcula o tempo total (1826 dias).
3. Divide `value` ($85.000,00$) por $1826$, gerando uma taxa de competência de $R\$ 46,55$ por dia no período de projeção.

---

## 🎓 CAPÍTULO 4: Roteiro Pedagógico e Blueprint de Aula

### 4.1 Lesson Plan: Dilatação Temporal e Prospecção Contábil

#### Objetivo de Aprendizagem
Capacitar desenvolvedores sênior a depurar e corrigir bugs de diluição temporal em motores de projeção de cenários, garantindo a integridade dos passivos contratuais.

#### Cronograma da Aula (60 Minutos)

| Tempo | Tópico | Estratégia Pedagógica | Foco do Instrutor |
| :--- | :--- | :--- | :--- |
| **00:00 - 00:15** | A Diluição Temporal e o Erro Legado | Apresentação teórica com contraste gráfico. | Explicar o impacto financeiro da perda de $R\$ 77.916,00$ em um financiamento projetado. |
| **00:15 - 00:35** | Dissecação Matemática e `proratedCount` | Análise das fórmulas LaTeX e do denominador local. | Mostrar como a ancoragem local preserva o valor nominal absoluto de contratos. |
| **00:35 - 00:50** | Inspeção de Código em `usePredictionEngine.ts` | Revisão interativa do repositório de código. | Focar na interface `CategoryStats` e na ramificação pelo marcador `isProrated`. |
| **00:50 - 11:00** | Laboratório de Testes e Auditoria | Execução de testes de regressão automatizados. | Garantir a escrita correta de asserções matemáticas em Vitest/Jest. |

---

### 4.2 Blueprint do Slide Deck

#### Slide 1: O Desastre da Diluição Contratual
* **Título do Slide**: Projeção de Cenários: O Bug de Diluição Global (Fator 12x)
* **Texto de Apoio**:
  * Passivos contratuais possuem valores nominais absolutos que não devem ser divididos pelo calendário histórico.
  * O erro legado dividia custos fixos pelo período de origem (`globalSourceMonthCount`), reduzindo contratos a 1/12 do valor original na tabela de destino.
* **Componente Visual**: Gráfico de colunas comparando a previsão de custos legada ($R\$ 7.083,00$) contra a previsão ancorada real ($R\$ 85.000,00$) para um financiamento.

#### Slide 2: A Matemática da Solução
* **Título do Slide**: Ancoragem por Denominador de Ocorrência Local
* **Equações LaTeX**:
  $$\text{Fórmula Legada (Variável): } M_{\text{global}} = \frac{\sum \text{Valor}}{\text{Total de Meses da Origem}}$$
  $$\text{Fórmula Corrigida (Contratual): } M_{\text{local}} = \frac{\sum \text{Valor}}{\text{Ocorrências Locais } (\text{proratedCount})}$$
* **Destaque Didático**: Enfatizar que se a categoria aparece uma única vez, $\text{proratedCount} = 1$, neutralizando a diluição.

#### Slide 3: Modelagem em Interfaces TypeScript
* **Título do Slide**: A Interface `CategoryStats` Refatorada
* **Snippet de Código**:
  ```typescript
  interface CategoryStats {
    isProrated: boolean;
    avgMonthlyValue: number;
    avgTotalValue?: number; // Âncora de segurança contratual
  }
  ```
* **Conceito Chave**: Explicar como a inclusão do `avgTotalValue` atua como salvaguarda contra erros de arredondamento de centavos em divisões de ponto flutuante.

#### Slide 4: O Acoplamento de Metadados
* **Título do Slide**: Trilha de Auditoria e Lineage de Dados Sintéticos
* **Payload JSON Exemplo**:
  ```json
  {
    "generatedBy": "predicted",
    "clonedFrom": "2025-01,2025-02,2025-03"
  }
  ```
* **Importância**: O sistema diferencia dados reais de sintéticos, permitindo exclusões seguras e rastreabilidade matemática.

---

### 4.3 Laboratório Prático de Auditoria (Student Handout)

#### Objetivo do Laboratório
Escrever um teste de regressão automatizado para validar que o motor de projeção de cenários não dilui o valor total de um contrato financeiro de veículo ao projetá-lo de um período de origem de 12 meses para o futuro.

#### Cenário de Teste
* **Dados de Origem (12 meses):** Contém uma única despesa com descrição `"FINANCIAMENTO VEHICLE"` de valor nominal $R\$ 85.000,00$ parcelada em 60 meses.
* **Ação do Motor:** Executar a previsão estatística para o ano de 2027.
* **Asserção Esperada:** O valor total da despesa projetada na tabela de destino deve ser exatamente $R\$ 85.000,00$.

#### Código de Teste (Vitest / Jest)
Instrua os alunos a preencher e rodar o teste de regressão a seguir:

```typescript
import { describe, it, expect } from 'vitest';
import { generateStatisticalData, CloneConfig } from '../hooks/usePredictionEngine';
import type { TableRow } from '../types';

describe('Auditoria de Dilatação Temporal de Alta Fidelidade', () => {
  it('deve preservar o valor nominal do financiamento e evitar a diluição por 12', () => {
    // 1. Configurando o cenário com dados históricos reais do ano de 2025 (12 meses)
    const mockRows: TableRow[] = [
      {
        id: 'row-1',
        date: '2025-06-15',
        value: 85000.00,
        description: 'FINANCIAMENTO VEHICLE',
        entryType: 'expense',
        periodStart: '2025-06-15',
        periodEnd: '2030-06-14',
        monthlyValue: 1416.67,
        monthCount: 60
      }
    ];

    // 2. Configurando o motor para ler a origem (12 meses) e projetar para 2027
    const config: CloneConfig = {
      source: {
        type: 'range',
        sourceMonthKeys: [
          '2025-01', '2025-02', '2025-03', '2025-04',
          '2025-05', '2025-06', '2025-07', '2025-08',
          '2025-09', '2025-10', '2025-11', '2025-12'
        ]
      },
      targetStart: '2027-01',
      repeatCount: 1 // Projeta o bloco de 12 meses uma vez
    };

    // 3. Execução do algoritmo de previsão estatística
    const predictedRows = generateStatisticalData(mockRows, config);

    // 4. Auditoria e asserções de integridade
    const financingProjected = predictedRows.find(
      (r) => r.description === 'FINANCIAMENTO VEHICLE'
    );

    expect(financingProjected).toBeDefined();
    
    // O valor projetado na tabela de destino não pode ter sido dividido por 12 (R$ 7.083,33)
    // Ele deve ser mantido idêntico ao nominal de origem para alimentar a competência diária
    expect(financingProjected!.value).toBe(85000.00);

    // O período de vigência deve ter sido transladado corretamente com manutenção da duração de 60 meses
    expect(financingProjected!.periodStart).toBe('2027-01-01');
    expect(financingProjected!.periodEnd).toBe('2031-12-31');
    expect(financingProjected!.monthCount).toBe(60);
    expect(financingProjected!.monthlyValue).toBe(1416.67);
  });
});
```
