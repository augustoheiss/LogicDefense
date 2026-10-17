declare function describe(name: string, fn: () => void): void;
declare function it(name: string, fn: () => void): void;
declare function expect(actual: any): {
  toBe(expected: any): void;
  toEqual(expected: any): void;
  toBeDefined(): void;
  toBeTruthy(): void;
  toBeFalsy(): void;
  toContain(expected: any): void;
  toHaveProperty(prop: string, value?: any): void;
  toBeGreaterThan(expected: any): void;
  toBeLessThan(expected: any): void;
  not: any;
};
import { serializeDynamicCSV } from '../core/dynamicCsvSerializer';
import { parseCSVText } from '../utils/csvEngine';
import { parseDynamicCSV } from '../core/dynamicCsvParser';
import type { TableRow, DynamicTableSchema, InvestorProfileConfig, TableGoals } from '../core/types';

describe('Roundtrip Dynamic CSV & Backup v3 Fidelity', () => {
  it('deve exportar e reimportar tabela completa com esquema dinâmico, perfil de investidor e colunas customizadas sem perda', () => {
    const tableId = 'tab_roundtrip_test_001';
    const tableName = 'Portfólio de Investimentos & SMB';
    const description = 'Planilha com colunas customizadas e perfil de investidor';

    const schema: DynamicTableSchema = {
      version: 3,
      tableId,
      columns: [
        {
          id: 'date',
          originalHeader: 'Data Operação',
          label: 'Data',
          dataType: 'date',
          role: 'primary_date',
          visible: true,
          isCustom: false,
        },
        {
          id: 'value',
          originalHeader: 'Valor Bruto',
          label: 'Valor',
          dataType: 'money',
          role: 'primary_amount',
          visible: true,
          isCustom: false,
          transformRule: { invertSign: false },
        },
        {
          id: 'description',
          originalHeader: 'Descrição',
          label: 'Descrição',
          dataType: 'text',
          role: 'primary_description',
          visible: true,
          isCustom: false,
        },
        {
          id: 'ticker',
          originalHeader: 'Ativo B3',
          label: 'Ticker',
          dataType: 'ticker',
          role: 'invest_ticker',
          visible: true,
          isCustom: false,
        },
        {
          id: 'quantity',
          originalHeader: 'Qtd Cotas',
          label: 'Quantidade',
          dataType: 'quantity',
          role: 'invest_quantity',
          visible: true,
          isCustom: false,
        },
        {
          id: 'unit_price',
          originalHeader: 'Preço Médio',
          label: 'Preço Unitário',
          dataType: 'money',
          role: 'invest_unit_price',
          visible: true,
          isCustom: false,
        },
        {
          id: 'centro_custo',
          originalHeader: 'Centro de Custo',
          label: 'Centro de Custo',
          dataType: 'text',
          role: 'custom_attribute',
          visible: true,
          isCustom: true,
        },
        {
          id: 'projeto_tag',
          originalHeader: 'Projeto Especial',
          label: 'Projeto',
          dataType: 'text',
          role: 'custom_attribute',
          visible: true,
          isCustom: true,
        },
      ],
      delimiter: ';',
      hasHeaders: true,
      updatedAt: '2026-10-10T12:00:00.000Z',
    };

    const investorProfile: InvestorProfileConfig = {
      profileType: 'balanced',
      emergencyFundMonthsGoal: 12,
      fireTargetAnnualExpensesMultiplier: 30,
      monthlyContributionGoal: 3500,
      customAllocations: [
        { assetClass: 'equities_brazil', targetPercentage: 30 },
        { assetClass: 'real_estate_funds', targetPercentage: 25 },
        { assetClass: 'fixed_income_ipca', targetPercentage: 25 },
        { assetClass: 'equities_global', targetPercentage: 15 },
        { assetClass: 'crypto', targetPercentage: 5 },
      ],
    };

    const goals: TableGoals = {
      globalGoals: { dailyGoal: 150, weeklyGoal: 1050, annualCost: 54600 },
      dailyGoals: { 2026: 150 },
      weeklyGoals: { 2026: 1050 },
      annualCosts: { 2026: 54600 },
    };

    const rows: TableRow[] = [
      {
        id: 'row-uuid-001',
        date: '2026-07-15',
        value: 3850.0,
        description: 'COMPRA DE ACOES PETR4',
        entryType: 'deposit',
        category: 'Investimentos',
        tags: 'b3,renda_variavel',
        ticker: 'PETR4',
        quantity: 100,
        unitPrice: 38.5,
        customValues: {
          centro_custo: 'HOLDING_PESSOAL',
          projeto_tag: 'APORTE_MENSAL_JULHO',
        },
      },
      {
        id: 'row-uuid-002',
        date: '2026-07-20',
        value: 1250.75,
        description: 'FATURA NUBANK - INFRAESTRUTURA CLOUD',
        entryType: 'expense',
        category: 'Tecnologia',
        tags: 'aws,servidores',
        customValues: {
          centro_custo: 'TI_DEV',
          projeto_tag: 'ASSISTENTE_MOEDA_SAAS',
        },
      },
    ];

    // 1. Export via serializeDynamicCSV (Backup v3 Engine)
    const exportedCSV = serializeDynamicCSV(
      rows,
      tableName,
      description,
      goals,
      tableId,
      'am_sheet_live_test_key_123',
      42,
      schema,
      investorProfile
    );

    expect(exportedCSV.includes('## COIN ASSISTANT BACKUP v3 ##')).toBe(true);
    expect(exportedCSV.includes('## SCHEMA_COLUMNS ##')).toBe(true);
    expect(exportedCSV.includes('## INVESTOR_PROFILE ##')).toBe(true);
    expect(exportedCSV.includes('## ROWS ##')).toBe(true);
    expect(exportedCSV.includes('PETR4')).toBe(true);
    expect(exportedCSV.includes('HOLDING_PESSOAL')).toBe(true);
    expect(exportedCSV.includes('TI_DEV')).toBe(true);

    // 2. Re-import via parseCSVText (which delegates to parseDynamicCSV for v3)
    const parsed = parseCSVText(exportedCSV);

    expect(parsed.errors.length).toBe(0);
    expect(parsed.rows.length).toBe(2);
    expect(parsed.metadata?.name).toBe(tableName);
    expect(parsed.metadata?.tableId).toBe(tableId);

    // 3. Verify Schema Integrity
    expect(parsed.metadata?.schema).toBeDefined();
    const parsedSchema = parsed.metadata!.schema!;
    expect(parsedSchema.columns.length).toBe(schema.columns.length);
    const tickerCol = parsedSchema.columns.find((c) => c.id === 'ticker');
    expect(tickerCol?.role).toBe('invest_ticker');
    const centroCustoCol = parsedSchema.columns.find((c) => c.id === 'centro_custo');
    expect(centroCustoCol?.isCustom).toBe(true);

    // 4. Verify Investor Profile Integrity
    expect(parsed.metadata?.investorProfile).toBeDefined();
    const parsedProfile = parsed.metadata!.investorProfile!;
    expect(parsedProfile.profileType).toBe('balanced');
    expect(parsedProfile.emergencyFundMonthsGoal).toBe(12);
    expect(parsedProfile.fireTargetAnnualExpensesMultiplier).toBe(30);
    expect(parsedProfile.monthlyContributionGoal).toBe(3500);
    expect(parsedProfile.customAllocations?.length).toBe(5);

    // 5. Verify Row Data Integrity and Custom Values Preservation
    const row1 = parsed.rows.find((r) => 'id' in r && r.id === 'row-uuid-001') as TableRow;
    expect(row1).toBeDefined();
    expect(row1.value).toBe(3850.0);
    expect(row1.ticker).toBe('PETR4');
    expect(row1.quantity).toBe(100);
    expect(row1.unitPrice).toBe(38.5);
    expect(row1.customValues?.centro_custo).toBe('HOLDING_PESSOAL');
    expect(row1.customValues?.projeto_tag).toBe('APORTE_MENSAL_JULHO');

    const row2 = parsed.rows.find((r) => 'id' in r && r.id === 'row-uuid-002') as TableRow;
    expect(row2).toBeDefined();
    expect(row2.value).toBe(1250.75);
    expect(row2.entryType).toBe('expense');
    expect(row2.customValues?.centro_custo).toBe('TI_DEV');
    expect(row2.customValues?.projeto_tag).toBe('ASSISTENTE_MOEDA_SAAS');
  });
});
