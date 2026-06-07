# Masterclass Módulo 4: Integridade Cronológica e Pipelines de Relatórios Continuos
*Manual de Aulas, Especificação de Loop Calendário e Análise de WhatsAppExporter.tsx & dateUtils.ts*

Este documento serve como o Guia Didático e Manual de Especificação Técnica para o **Módulo 4: Integridade Cronológica e Pipelines de Relatórios** no ecossistema Assistente-Moeda. Ele detalha a importância da integridade da linha do tempo na visualização financeira, as regras de controle de timezone e os algoritmos que garantem que períodos de inatividade não se tornem pontos cegos na gestão empresarial.

---

## 📑 CAPÍTULO 1: A Importância Psicológica e Contábil da Linha do Tempo Contínua

### 1.1 Teoria Comportamental: Os Pontos Cegos do Operador (Quiet Weeks)
Na gestão financeira pessoal e empresarial, existe um viés cognitivo perigoso conhecido como **negligência de inatividade**. Quando um profissional autônomo (como um motorista parceiro) ou uma pequena empresa enfrenta uma semana de faturamento nulo devido a férias, manutenção de equipamentos ou problemas de saúde, a tendência mental e operacional é simplesmente ocultar ou ignorar esse período na compilação dos dados.

Contudo, sob a ótica contábil, uma **"semana vazia"** (com receita de $R\$ 0,00$) está longe de ter impacto neutro. Durante esses dias, os custos fixos estruturais continuam a acumular silenciosamente de forma linear:
* A depreciação do ativo (veículo ou maquinário) ocorre ininterruptamente.
* O rateio do seguro anual e do IPVA segue gerando despesa diária constante.
* As obrigações financeiras de financiamento continuam vencendo.

Se o pipeline de relatórios omite as semanas sem transação, a mente do operador consolida uma percepção inflada e otimista de produtividade (viés de sobrevivência de dados). O profissional vê apenas as semanas ativas (ex: Semana 1, Semana 2, Semana 4) e esquece que a Semana 3 acumulou uma dívida invisível em relação ao alvo operacional semanal estabelecido. A integridade cronológica obriga o sistema a expor essas lacunas, forçando a conscientização sobre o faturamento pendente necessário para equilibrar o saldo acumulado total.

---

### 1.2 Princípio da Integridade Cronológica: Data-Driven Loop vs. Calendar-Driven Loop
A diferença arquitetural entre sistemas financeiros de baixa e alta qualidade reside no modelo de iteração dos dados dos relatórios:

#### 1. Loop Guiado por Dados (Data-Driven Loop):
O sistema agrupa as transações existentes no banco de dados e itera estritamente sobre as chaves desse agrupamento. Se a base contiver lançamentos apenas nas semanas 1 e 3, o loop executará duas iterações:
$$\text{Chaves de Agrupamento} = \{\text{Semana 1}, \text{Semana 3}\}$$
A Semana 2 é omitida do relatório, criando um "salto temporal".

#### 2. Loop Guiado por Calendário (Calendar-Driven Loop):
O sistema ignora temporariamente as chaves existentes na base. Ele estabelece as fronteiras físicas do período (ex: dia 1 ao dia 30 do mês de relatório), calcula a grade cronológica teórica (quais são as semanas daquele mês no calendário gregoriano) e então itera de forma sequencial por cada slot temporal criado.
$$\text{Grade Calendário} = [\text{Semana 1}, \text{Semana 2}, \text{Semana 3}, \text{Semana 4}]$$

Para cada slot, o sistema executa uma varredura (*lookup*) cruzada na base de dados. Caso retorne zero registros, o sistema dispara um fluxo de contingência (*fallback*) para renderizar a semana com receita zerada, calculando o impacto negativo sobre a meta acumulada. A integridade cronológica assegura que a contagem do tempo decorrido permaneça em harmonia com a passagem física dos dias.

---

## 💻 CAPÍTULO 2: Engenharia do Fluxo Cronológico Semanal (WhatsAppExporter.tsx & dateUtils.ts)

### 2.1 Análise do Algoritmo de Geração de Semanas Continuas
A lógica de geração calendar-driven está centralizada no arquivo [WhatsAppExporter.tsx](file:///c:/Users/Usuario/Desktop/AHeiss_GoogleDrive/02-Programacao/projetos-IA/LogicDefense/src/tools/CoinAssistant/components/WhatsAppExporter.tsx).

O algoritmo calcula os limites de dias do mês ativo e rastreia os domingos para estabelecer as fronteiras de fechamento de semana:

```typescript
  // Trecho de WhatsAppExporter.tsx
  // Generate a continuous chronological sequence of all weeks in the target month
  const totalDays = daysInMonth(selY, selM);
  const sundays: Date[] = [];
  for (let d = 1; d <= totalDays; d++) {
    const date = new Date(selY, selM - 1, d);
    if (date.getDay() === 0) { // Sunday (0 = Domingo)
      sundays.push(date);
    }
  }
```

Para cada domingo encontrado, o motor mapeia o início da semana correspondente (segunda-feira) chamando a função utilitária `getMondayOf` importada de [dateUtils.ts](file:///c:/Users/Usuario/Desktop/AHeiss_GoogleDrive/02-Programacao/projetos-IA/LogicDefense/src/tools/CoinAssistant/utils/dateUtils.ts):

```typescript
// Trecho de dateUtils.ts
export function getMondayOf(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0 = Sun, 1 = Mon … 6 = Sat
  // Distância até segunda-feira: domingo retorna 6 dias, segunda a sábado retorna (day - 1)
  const distanceToMonday = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - distanceToMonday);
  return d;
}
```

Esse mapeamento garante a consolidação de semanas que iniciam na segunda-feira à meia-noite e encerram no domingo seguinte às 23:59:59.

---

### 2.2 Resolução Dinâmica de Metas com Mudança de Ano (*Mid-Month Shifts*)
Para calcular o saldo acumulado de forma justa, as metas semanais não podem ser estáticas ou globais. O alvo de receita deve refletir as configurações vigentes no exato momento da transação. 

O sistema utiliza a função `getWeeklyGoalForDate` para resolver a meta semanal de forma dinâmica utilizando uma hierarquia de prioridades:

```typescript
// Trecho de dateUtils.ts
export function getWeeklyGoalForDate(dateStr: string, goals: TableGoals): number {
  const year  = parseInt(dateStr.slice(0, 4), 10);
  const month = parseInt(dateStr.slice(5, 7), 10);
  return getEffectiveGoals({ year, month }, goals).weeklyGoal;
}
```

A resolução de metas avalia a data de encerramento da semana analisada (domingo):
```typescript
const sundayKey = toLocalKey(sunday);
const weekGoal = getWeeklyGoalForDate(sundayKey, table.goals);
```

Se o motorista definiu uma meta de faturamento semanal de $R\$ 400,00$ em 2025 e decidiu reajustá-la para $R\$ 600,00$ a partir de janeiro de 2026, a passagem de ano-calendário é refletida instantaneamente. O motor calcula a meta da semana que encerra em 2025-12-28 com o alvo de $R\$ 400,00$ e a semana que encerra em 2026-01-04 com o alvo de $R\$ 600,00$, preservando a integridade histórica.

---

### 2.3 Tratamento Defensivo contra Sangramento de Fuso Horário
Date strings em JavaScript sofrem com mutações silenciosas de timezone. Ao inicializar uma data a partir de strings como `"2026-06-07"` sem especificar hora, o interpretador pode convertê-la utilizando o fuso horário UTC (gerando o timestamp correspondente a `2026-06-06 21:00:00` em fusos GMT-3, por exemplo). Esse desvio de 3 horas altera o dia da semana, jogando uma transação registrada em uma segunda-feira para o domingo anterior, corrompendo o balanço semanal.

Para mitigar esse vazamento de dados, o sistema adota o conversor de chave local `toLocalKey`:

```typescript
// Trecho de dateUtils.ts
/** Stable "YYYY-MM-DD" key from a local-time Date (avoids UTC offset issues). */
export function toLocalKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}
```

O método extrai os atributos calendário locais diretamente (`getFullYear()`, `getMonth()`, `getDate()`) e monta uma string crua. Ele ignora as funções internas de string baseadas em UTC do JavaScript (como `.toISOString()`), garantindo o isolamento da data conforme digitada pelo operador.

---

## 📊 CAPÍTULO 3: O Ponto de Encontro: Indexando Parcerias e Receitas no Tempo

### 3.1 Mapeamento Semanal de Fluxos
Dentro da montagem de blocos em `buildMessage`, o motor realiza a varredura e cruzamento de dados filtrando os lançamentos operacionais brutos (`allRevenueRows`) que pertencem à chave de segunda-feira (`mondayKey`) da respectiva semana gerada:

```typescript
    // Trecho de WhatsAppExporter.tsx
    // Find entries for this week from allRevenueRows
    const entries = allRevenueRows.filter((r) => {
      const [ry, rmo, rd] = r.date.split('-').map(Number);
      const rDate = new Date(ry, rmo - 1, rd);
      const rMonday = getMondayOf(rDate);
      return toLocalKey(rMonday) === mondayKey;
    }).sort((a, b) => a.date.localeCompare(b.date));
```

O método extrai o ano, mês e dia da receita histórica (`r.date`), cria o objeto Date local, resolve sua segunda-feira correspondente (`rMonday`) e valida se a chave de fuso horário local é idêntica ao início da semana analisada. Caso afirmativo, a receita é integrada ao pool da semana.

---

### 3.2 A Lógica de Contingência de Atividade Zero
Caso a filtragem retorne um array com tamanho zero (`week.dailyEntries.length === 0`), o compilador de texto impede a ocultação do período e injeta o bloco de dados de saldo zerado:

```typescript
      // Trecho de WhatsAppExporter.tsx
      if (week.dailyEntries.length === 0) {
        lines.push(
          `📉 Fechamento: *R$ 0,00* _(Faltam ${fmt(week.weeklyGoal)} para a meta)_`
        );
      }
```

A variável `week.weeklyGoal` expõe dinamicamente a meta semanal vigente daquele período específico. A injeção força a contabilidade de déficit: a receita bruta da semana é computada como $R\$ 0,00$, o que subtrai $-G_{\text{semanal}}$ do indicador `globalGoalBalance` geral. Este valor é somado na compilação do rodapé de Metas Acumuladas, mantendo a consistência matemática temporal em todo o relatório.

---

## 🎓 CAPÍTULO 4: Roteiro Pedagógico e Blueprint de Aula

### 4.1 Lesson Plan: Pipelines Temporais Contínuos e Timezone-Safety

#### Objetivo de Aprendizagem
Instruir desenvolvedores sobre como implementar iterações guiadas por calendário (Calendar-Driven) e blindagem contra erros de fuso horário (DST e UTC) em motores de série temporal React.

#### Cronograma da Aula (60 Minutos)

| Tempo | Tópico | Estratégia Pedagógica | Foco do Instrutor |
| :--- | :--- | :--- | :--- |
| **00:00 - 00:15** | O Vício da Omissão Temporal | Apresentação conceitual do viés de inatividade. | Mostrar o perigo contábil de ignorar semanas com R$ 0 faturamento. |
| **00:15 - 00:35** | Construção do Algoritmo Calendar-Driven | Revisão do loop de busca de domingos e segundas. | Explicar a varredura cruzada indexada por chaves locais de segunda-feira. |
| **00:35 - 00:50** | Timezone e DST-Safety | Análise de vazamentos causados por fusos GMT/UTC. | Mostrar o perigo de usar `.toISOString()` em datas locais. |
| **00:50 - 11:00** | Escrita de Testes com Dead Zones | Laboratório interativo de testes unitários. | Garantir a cobertura de asserções em meses parciais e vazios. |

---

### 4.2 Blueprint do Slide Deck

#### Slide 1: O Perigo da Linha do Tempo Omitida
* **Título do Slide**: Visibilidade Contábil vs. Negligência de Inatividade
* **Mensagem Principal**:
  * Ocultar períodos sem receita mascara o acúmulo de custos fixos recorrentes.
  * O pipeline de relatórios deve forçar a exibição de lacunas para preservar a integridade das projeções.
* **Componente Visual**: Duas linhas do tempo: uma interrompida saltando de "Semana 1" para "Semana 3", e outra contínua exibindo "Semana 2: R$ 0,00 (Dívida acumulada de meta)".

#### Slide 2: A Rota da Integridade Semanal
* **Título do Slide**: Resolução Calendar-Driven de Datas Âncoras
* **Equações de Fluxo**:
  $$\text{Fronteira Inicial: } D_{\text{monday}} = \text{getMondayOf}(D_{\text{sunday}})$$
  $$\text{Fronteira Final: } D_{\text{sunday}} = D_{\text{monday}} + 6 \text{ dias}$$
* **Conceito Técnico**: Como a iteração sobre os dias do mês isola os domingos para mapear as semanas fechadas de segunda a domingo.

#### Slide 3: Blindagem contra Vazamento de Timezone
* **Título do Slide**: Controle de Fuso Horário Local com `toLocalKey`
* **Código de Comparação**:
  ```typescript
  // APROXIMAÇÃO PERIGOSA (UTC):
  const dateUTC = new Date("2026-06-07").toISOString(); // Pode retornar 2026-06-06T21:00:00.000Z
  
  // SOLUÇÃO SEGURA (Local Key):
  const key = [d.getFullYear(), pad(d.getMonth()+1), pad(d.getDate())].join('-');
  ```
* **Nota Didática**: A string local manual é a única proteção garantida contra DST e timezones locais do usuário.

---

### 4.3 Laboratório Prático de Auditoria (Student Handout)

#### Objetivo do Laboratório
Escrever testes automatizados em Vitest/Jest para garantir que o pipeline de formatação de mensagens gere o relatório de semanas de forma contínua, mesmo sob um cenário de inatividade total (Semana 2 zerada). O teste deve forçar a renderização sequencial de todas as semanas do mês gregoriano, sem omitir a semana vazia.

#### Cenário de Execução
* **Faturamento de Junho de 2026:**
  * Semana 1 (encerra no Domingo 2026-06-07): Faturamento de $R\$ 500,00$.
  * Semana 2 (encerra no Domingo 2026-06-14): Faturamento de $R\$ 0,00$ (Nenhuma transação).
  * Semana 3 (encerra no Domingo 2026-06-21): Faturamento de $R\$ 600,00$.
  * Semana 4 (encerra no Domingo 2026-06-28): Faturamento de $R\$ 450,00$.
* **Meta Semanal:** $R\$ 400,00$.
* **Asserções:** Validar que o resultado contém exatamente as 4 semanas continuas, e que a Semana 2 exibe o texto de fechamento indicando o faturamento em falta.

#### Código de Teste (Vitest / Jest)
Oriente os alunos a executarem e passarem a suíte de validação:

```typescript
import { describe, it, expect } from 'vitest';
import type { TableRow, TableGoals } from '../types';
import { getMondayOf, toLocalKey, getWeeklyGoalForDate } from '../utils/dateUtils';

// Subconjunto simplificado do algoritmo de WhatsAppExporter para teste cronológico
function buildTestWeeklyReport(rows: TableRow[], goals: TableGoals, year: number, month: number) {
  // Encontrar domingos do mês
  const totalDays = new Date(year, month, 0).getDate();
  const sundays: Date[] = [];
  for (let d = 1; d <= totalDays; d++) {
    const date = new Date(year, month - 1, d);
    if (date.getDay() === 0) {
      sundays.push(date);
    }
  }

  const lines: string[] = [];

  for (const sunday of sundays) {
    const monday = getMondayOf(sunday);
    const mondayKey = toLocalKey(monday);

    // Mapear receitas que pertencem à semana
    const entries = rows.filter((r) => {
      if (r.entryType === 'deposit' || r.entryType === 'expense') return false;
      const [ry, rmo, rd] = r.date.split('-').map(Number);
      const rDate = new Date(ry, rmo - 1, rd);
      const rMonday = getMondayOf(rDate);
      return toLocalKey(rMonday) === mondayKey;
    });

    const weeklyTotal = entries.reduce((sum, r) => sum + r.value, 0);
    const sundayKey = toLocalKey(sunday);
    const weekGoal = getWeeklyGoalForDate(sundayKey, goals);

    lines.push(`Semana ${toLocalKey(monday)} a ${toLocalKey(sunday)}`);

    if (entries.length === 0) {
      lines.push(`Fechamento: R$ 0,00 (Faltam R$ ${weekGoal.toFixed(2)} para a meta)`);
    } else {
      lines.push(`Fechamento: R$ ${weeklyTotal.toFixed(2)}`);
    }
  }

  return { sundaysCount: sundays.length, reportLines: lines };
}

describe('Auditoria de Integridade Cronológica e Fallback de Atividade Zero', () => {
  it('deve gerar todas as semanas do mês sequencialmente sem omitir a semana vazia', () => {
    // 1. Configurando transações (com inatividade total na semana de 08/06 a 14/06)
    const mockRows: TableRow[] = [
      { id: '1', date: '2026-06-03', value: 500.00, entryType: 'revenue' }, // Semana 1
      // Nenhuma transação na Semana 2 (08/06 a 14/06)
      { id: '2', date: '2026-06-18', value: 600.00, entryType: 'revenue' }, // Semana 3
      { id: '3', date: '2026-06-25', value: 450.00, entryType: 'revenue' }  // Semana 4
    ];

    const mockGoals: TableGoals = {
      dailyGoals: {},
      weeklyGoals: { 2026: 400.00 },
      annualCosts: {},
      globalGoals: { dailyGoal: 50, weeklyGoal: 400.00, annualCost: 15000 },
      yearlyGoals: {},
      monthlyGoals: {}
    };

    // 2. Executando gerador de relatório para Junho de 2026
    const { sundaysCount, reportLines } = buildTestWeeklyReport(mockRows, mockGoals, 2026, 6);

    // Junho de 2026 possui exatamente 4 domingos (07, 14, 21, 28)
    expect(sundaysCount).toBe(4);
    
    // O relatório deve conter exatamente 8 linhas (4 cabeçalhos + 4 fechamentos de semana)
    expect(reportLines.length).toBe(8);

    // Validar se a segunda semana (índices 2 e 3) está listada e contem o fallback de faturamento zerado
    expect(reportLines[2]).toBe('Semana 2026-06-08 a 2026-06-14');
    expect(reportLines[3]).toBe('Fechamento: R$ 0,00 (Faltam R$ 400.00 para a meta)');

    // Verificar se as semanas ativas geraram os resultados normais
    expect(reportLines[0]).toBe('Semana 2026-06-01 a 2026-06-07');
    expect(reportLines[1]).toBe('Fechamento: R$ 500.00');

    expect(reportLines[4]).toBe('Semana 2026-06-15 a 2026-06-21');
    expect(reportLines[5]).toBe('Fechamento: R$ 600.00');
  });
});
```
