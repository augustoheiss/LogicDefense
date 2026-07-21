import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Platform,
  ScrollView,
} from 'react-native';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { formatCurrencySmart } from '@/core/formatCurrency';
import {
  calculateFatorR,
  calculateLucroPresumido,
  calculateIRPF2026,
  calculateJudicialCorrection,
  calibratePrevidencia,
} from '../../utils/taxMath';
import { parseTaxCSV, TaxRecord } from '../../utils/taxParser';

const SAMPLE_TAX_CSV = `data_vencimento,valor_original,tipo_debito,data_ajuizamento,data_quitacao,massa_salarial_12,receita_bruta_12,cnae_codigo
2023-01-15,10000.0,trabalhista,2024-05-20,2026-07-01,90000.0,350000.0,6201-5/01
2022-10-10,25000.0,civel,2023-11-15,2026-07-01,120000.0,400000.0,6202-3/00`;

export function TaxOptimizationWidgets() {
  // ── Fator R State ──
  const [rev12, setRev12] = useState('350000');
  const [payroll12, setPayroll12] = useState('90000');

  // ── IRPF 2026 State ──
  const [grossClt, setGrossClt] = useState('6000');
  const [cltDeps, setCltDeps] = useState('1');
  const [alimony, setAlimony] = useState('0');

  // ── PJe-Calc Debt Corrector State ──
  const [originalDebt, setOriginalDebt] = useState('10000');
  const [dueDateStr, setDueDateStr] = useState('2022-06-15');
  const [lawsuitDateStr, setLawsuitDateStr] = useState('2023-10-10');
  const [paymentDateStr, setPaymentDateStr] = useState('2026-03-20');
  const [debtType, setDebtType] = useState<'trabalhista' | 'civel'>('trabalhista');

  // ── PGBL / VGBL State ──
  const [grossAnnual, setGrossAnnual] = useState('150000');
  const [inssPaid, setInssPaid] = useState('10800');
  const [annDeps, setAnnDeps] = useState('1');
  const [eduExp, setEduExp] = useState('4000');
  const [healthExp, setHealthExp] = useState('8000');
  const [actualPgbl, setActualPgbl] = useState('5000');

  // ── CSV Importer State ──
  const [csvText, setCsvText] = useState(SAMPLE_TAX_CSV);
  const [parsedTaxes, setParsedTaxes] = useState(() => parseTaxCSV(SAMPLE_TAX_CSV));

  // ── 1. Fator R calculations ──
  const fatorRResult = useMemo(() => {
    const rev = parseFloat(rev12) || 0;
    const pay = parseFloat(payroll12) || 0;
    return calculateFatorR(pay, rev);
  }, [rev12, payroll12]);

  // ── 2. Lucro Presumido comparative base ──
  const presumidoResult = useMemo(() => {
    const revQuarterly = (parseFloat(rev12) || 0) / 4;
    return calculateLucroPresumido(revQuarterly, true);
  }, [rev12]);

  // ── 3. IRPF 2026 calculations ──
  const irpfResult = useMemo(() => {
    const gross = parseFloat(grossClt) || 0;
    const deps = parseInt(cltDeps, 10) || 0;
    const alim = parseFloat(alimony) || 0;

    // Estimate monthly INSS (progressive limit ~R$ 900 max)
    const inssEst = Math.min(gross * 0.11, 900.0);

    return calculateIRPF2026(gross, inssEst, deps, alim);
  }, [grossClt, cltDeps, alimony]);

  // ── 4. Judicial Debt Correction ──
  const debtResult = useMemo(() => {
    const orig = parseFloat(originalDebt) || 0;
    const due = new Date(dueDateStr + 'T12:00:00');
    const law = new Date(lawsuitDateStr + 'T12:00:00');
    const pay = new Date(paymentDateStr + 'T12:00:00');

    // Handle invalid dates
    if (isNaN(due.getTime()) || isNaN(law.getTime()) || isNaN(pay.getTime())) {
      return {
        daysPreJudicial: 0,
        daysJudicial: 0,
        correctedPrincipal: orig,
        interestAccumulated: 0,
        totalDue: orig,
      };
    }

    return calculateJudicialCorrection(orig, due, law, pay, debtType === 'trabalhista');
  }, [originalDebt, dueDateStr, lawsuitDateStr, paymentDateStr, debtType]);

  // ── 5. PGBL vs. VGBL Calibrator ──
  const shelterResult = useMemo(() => {
    const gross = parseFloat(grossAnnual) || 0;
    const inss = parseFloat(inssPaid) || 0;
    const deps = parseInt(annDeps, 10) || 0;
    const edu = parseFloat(eduExp) || 0;
    const health = parseFloat(healthExp) || 0;
    const pgbl = parseFloat(actualPgbl) || 0;

    return calibratePrevidencia(gross, inss, deps, edu, health, pgbl);
  }, [grossAnnual, inssPaid, annDeps, eduExp, healthExp, actualPgbl]);

  const handleParseTaxes = () => {
    const res = parseTaxCSV(csvText);
    setParsedTaxes(res);
    if (res.records.length > 0) {
      const rec = res.records[0];
      setRev12(String(rec.receitaBruta12));
      setPayroll12(String(rec.massaSalarial12));
      setOriginalDebt(String(rec.valorOriginal));
      if (rec.dataVencimento) setDueDateStr(rec.dataVencimento);
      if (rec.dataAjuizamento) setLawsuitDateStr(rec.dataAjuizamento);
      if (rec.dataQuitacao) setPaymentDateStr(rec.dataQuitacao);
      if (rec.tipoDebito) setDebtType(rec.tipoDebito.toLowerCase().includes('civel') ? 'civel' : 'trabalhista');
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* 📊 1. Fator R & Lucro Presumido Advisor */}
      <View style={styles.widgetCard}>
        <Text style={styles.widgetHeader}>📊 Otimizador Tributário PJ (Simples Nacional Fator R)</Text>
        <Text style={styles.widgetDescription}>
          Identifique o enquadramento fiscal ótimo de sua empresa. O Fator R determina a alíquota do Simples de TI e serviços (Anexo III vs. Anexo V).
        </Text>

        <View style={styles.inputGrid}>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Faturamento 12m (R$)</Text>
            <TextInput
              style={styles.textInput}
              value={rev12}
              onChangeText={setRev12}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Massa Salarial 12m (R$)</Text>
            <TextInput
              style={styles.textInput}
              value={payroll12}
              onChangeText={setPayroll12}
              keyboardType="numeric"
            />
          </View>
        </View>

        <View style={styles.metricRow}>
          <View style={styles.metricCell}>
            <Text style={styles.cellLabel}>Fator R Projetado</Text>
            <Text style={[styles.cellValue, { color: colors.warning.main }]}>
              {(fatorRResult.fatorR * 100).toFixed(1)}%
            </Text>
          </View>
          <View style={styles.metricCell}>
            <Text style={styles.cellLabel}>Alíquota Efetiva Simples</Text>
            <Text style={[styles.cellValue, { color: colors.success.main }]}>
              {(fatorRResult.effectiveRate * 100).toFixed(2)}%
            </Text>
          </View>
          <View style={styles.metricCell}>
            <Text style={styles.cellLabel}>Regime Enquadrado</Text>
            <Text style={[styles.cellValue, { color: colors.accent.purple }]}>
              Anexo {fatorRResult.anexo}
            </Text>
          </View>
        </View>

        <View style={styles.tipBanner}>
          <Text style={styles.tipText}>{fatorRResult.description}</Text>
        </View>

        <View style={styles.presumidoSection}>
          <Text style={styles.subHeader}>Comparação Lucro Presumido (Trimestral):</Text>
          <View style={styles.presumidoRow}>
            <Text style={styles.pLabel}>Presunção Serviços (c/ PLP 182)</Text>
            <Text style={styles.pVal}>{(presumidoResult.presumptionRate * 100).toFixed(1)}%</Text>
          </View>
          <View style={styles.presumidoRow}>
            <Text style={styles.pLabel}>Total Tributos (IRPJ+CSLL+PIS+COFINS)</Text>
            <Text style={styles.pVal}>{formatCurrencySmart(presumidoResult.totalTax)}</Text>
          </View>
          <View style={styles.presumidoRow}>
            <Text style={styles.pLabel}>Alíquota Efetiva LP</Text>
            <Text style={[styles.pVal, { fontWeight: '700' }]}>{presumidoResult.effectiveRate.toFixed(2)}%</Text>
          </View>
        </View>
      </View>

      {/* ⚖️ 2. IRPF 2026 Redutor Especial Simulator */}
      <View style={styles.widgetCard}>
        <Text style={styles.widgetHeader}>⚖️ IRPF 2026 & Redutor Mensal Especial (Lei nº 15.270/2025)</Text>
        <Text style={styles.widgetDescription}>
          Simule o holerite líquido de 2026. A nova legislação prevê isenção total até R$ 5.000,00 e decaimento regressivo do redutor especial para salários de até R$ 7.350,00.
        </Text>

        <View style={styles.inputGrid}>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Salário Bruto CLT (R$/mês)</Text>
            <TextInput
              style={styles.textInput}
              value={grossClt}
              onChangeText={setGrossClt}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Dependentes (Qtd)</Text>
            <TextInput
              style={styles.textInput}
              value={cltDeps}
              onChangeText={setCltDeps}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Pensão Alimentícia (R$)</Text>
            <TextInput
              style={styles.textInput}
              value={alimony}
              onChangeText={setAlimony}
              keyboardType="numeric"
            />
          </View>
        </View>

        <View style={styles.calculationPanel}>
          <View style={styles.calcRow}>
            <Text style={styles.calcLabel}>Base de Cálculo Líquida:</Text>
            <Text style={styles.calcVal}>{formatCurrencySmart(irpfResult.netBase)}</Text>
          </View>
          <View style={styles.calcRow}>
            <Text style={styles.calcLabel}>IR Bruto (Tabela Progressiva):</Text>
            <Text style={styles.calcVal}>{formatCurrencySmart(irpfResult.brutoIR)}</Text>
          </View>
          <View style={styles.calcRow}>
            <Text style={[styles.calcLabel, { color: colors.success.main }]}>Redutor Especial (Isenção):</Text>
            <Text style={[styles.calcVal, { color: colors.success.main }]}>
              - {formatCurrencySmart(irpfResult.specialReducer)}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.calcRow}>
            <Text style={[styles.calcLabel, { fontWeight: '700' }]}>IR Retido na Fonte Efetivo:</Text>
            <Text style={[styles.calcVal, { fontWeight: '700', color: colors.danger.main }]}>
              {formatCurrencySmart(irpfResult.effectiveIR)} ({(irpfResult.effectiveRate).toFixed(1)}%)
            </Text>
          </View>
        </View>
      </View>

      {/* 🏛️ 3. PJe-Calc Debt Corrector */}
      <View style={styles.widgetCard}>
        <Text style={styles.widgetHeader}>🏛️ Atualização Monetária Cível & Trabalhista (ADC 58)</Text>
        <Text style={styles.widgetDescription}>
          Simulador atuarial para liquidações cíveis e trabalhistas aplicando IPCA-E + TR na fase pré-judicial e SELIC / IPCA + Taxa Legal CMN na fase processual.
        </Text>

        <View style={styles.inputGrid}>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Valor Original (R$)</Text>
            <TextInput
              style={styles.textInput}
              value={originalDebt}
              onChangeText={setOriginalDebt}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Data de Vencimento</Text>
            <TextInput
              style={styles.textInput}
              value={dueDateStr}
              onChangeText={setDueDateStr}
              placeholder="AAAA-MM-DD"
            />
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Data de Ajuizamento</Text>
            <TextInput
              style={styles.textInput}
              value={lawsuitDateStr}
              onChangeText={setLawsuitDateStr}
              placeholder="AAAA-MM-DD"
            />
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Data de Quitação</Text>
            <TextInput
              style={styles.textInput}
              value={paymentDateStr}
              onChangeText={setPaymentDateStr}
              placeholder="AAAA-MM-DD"
            />
          </View>
        </View>

        <View style={styles.segmentedControl}>
          <Pressable
            style={[styles.segmentBtn, debtType === 'trabalhista' && styles.segmentBtnActive]}
            onPress={() => setDebtType('trabalhista')}
          >
            <Text style={styles.segmentText}>Trabalhista (ADC 58)</Text>
          </Pressable>
          <Pressable
            style={[styles.segmentBtn, debtType === 'civel' && styles.segmentBtnActive]}
            onPress={() => setDebtType('civel')}
          >
            <Text style={styles.segmentText}>Cível (Taxa Legal)</Text>
          </Pressable>
        </View>

        <View style={styles.calculationPanel}>
          <View style={styles.calcRow}>
            <Text style={styles.calcLabel}>Dias Pré-Judiciais (TR/IPCA):</Text>
            <Text style={styles.calcVal}>{debtResult.daysPreJudicial} dias</Text>
          </View>
          <View style={styles.calcRow}>
            <Text style={styles.calcLabel}>Dias Processuais (SELIC/Legal):</Text>
            <Text style={styles.calcVal}>{debtResult.daysJudicial} dias</Text>
          </View>
          <View style={styles.calcRow}>
            <Text style={styles.calcLabel}>Principal Corrigido:</Text>
            <Text style={styles.calcVal}>{formatCurrencySmart(debtResult.correctedPrincipal)}</Text>
          </View>
          <View style={styles.calcRow}>
            <Text style={styles.calcLabel}>Juros Acumulados:</Text>
            <Text style={styles.calcVal}>{formatCurrencySmart(debtResult.interestAccumulated)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.calcRow}>
            <Text style={[styles.calcLabel, { fontWeight: '700' }]}>Saldo Devedor Total devido:</Text>
            <Text style={[styles.calcVal, { fontWeight: '700', color: colors.warning.main, fontSize: 13 }]}>
              {formatCurrencySmart(debtResult.totalDue)}
            </Text>
          </View>
        </View>
      </View>

      {/* 💼 4. PGBL vs. VGBL Calibrator */}
      <View style={styles.widgetCard}>
        <Text style={styles.widgetHeader}>💼 Calibrador Previdenciário (PGBL vs. VGBL)</Text>
        <Text style={styles.widgetDescription}>
          Maximize o diferimento fiscal. Otimize seus aportes de previdência privada para compensar a declaração completa do Imposto de Renda Pessoa Física.
        </Text>

        <View style={styles.inputGrid}>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Renda Anual Bruta (R$)</Text>
            <TextInput
              style={styles.textInput}
              value={grossAnnual}
              onChangeText={setGrossAnnual}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>INSS Anual Pago (R$)</Text>
            <TextInput
              style={styles.textInput}
              value={inssPaid}
              onChangeText={setInssPaid}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Dep. Completo (Qtd)</Text>
            <TextInput
              style={styles.textInput}
              value={annDeps}
              onChangeText={setAnnDeps}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Gasto Educação (R$)</Text>
            <TextInput
              style={styles.textInput}
              value={eduExp}
              onChangeText={setEduExp}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Gasto Saúde (R$)</Text>
            <TextInput
              style={styles.textInput}
              value={healthExp}
              onChangeText={setHealthExp}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Aporte PGBL Atual</Text>
            <TextInput
              style={styles.textInput}
              value={actualPgbl}
              onChangeText={setActualPgbl}
              keyboardType="numeric"
            />
          </View>
        </View>

        <View style={styles.comparisonGrid}>
          <View style={styles.comparisonColumn}>
            <Text style={styles.comparisonTitle}>Desconto Simplificado</Text>
            <Text style={styles.comparisonCost}>
              {formatCurrencySmart(shelterResult.simplificadoDeduction)}
            </Text>
            <Text style={styles.comparisonLabel}>Abatimento Padrão 20%</Text>
          </View>

          <View style={[styles.comparisonColumn, shelterResult.recommendation === 'PGBL' && styles.comparisonColumnActive]}>
            <Text style={styles.comparisonTitle}>Deduções Legais (Completo)</Text>
            <Text style={styles.comparisonCost}>
              {formatCurrencySmart(shelterResult.completoDeduction)}
            </Text>
            <Text style={styles.comparisonLabel}>Com Aportes & Dependentes</Text>
          </View>
        </View>

        <View style={styles.tipBanner}>
          <Text style={styles.tipText}>{shelterResult.description}</Text>
        </View>
      </View>

      {/* 📥 5. CSV Importer for Tax Records */}
      <View style={styles.widgetCard}>
        <Text style={styles.widgetHeader}>📥 Painel Tributário & Judicial (CSV)</Text>
        <Text style={styles.widgetDescription}>
          Importe demonstrativos tributários ou planilhas judiciais para alimentar as simulações e cálculos do painel de forma agregada.
        </Text>

        <TextInput
          style={styles.codeTextarea}
          multiline
          value={csvText}
          onChangeText={setCsvText}
          placeholder="data_vencimento,valor_original,tipo_debito..."
          placeholderTextColor={colors.text.disabled}
        />

        <View style={styles.actionRow}>
          <Pressable style={styles.actionBtn} onPress={handleParseTaxes}>
            <Text style={styles.actionBtnText}>🔄 Reconciliar Lançamentos</Text>
          </Pressable>
          <Pressable
            style={[styles.actionBtn, { backgroundColor: colors.background.tertiary }]}
            onPress={() => {
              setCsvText(SAMPLE_TAX_CSV);
              setParsedTaxes(parseTaxCSV(SAMPLE_TAX_CSV));
            }}
          >
            <Text style={styles.actionBtnText}>Restaurar Exemplo</Text>
          </Pressable>
        </View>

        {parsedTaxes.records.length > 0 && (
          <View style={styles.taxesList}>
            <Text style={styles.sectionTitle}>Lançamentos Fiscais Reconciliados ({parsedTaxes.records.length}):</Text>
            {parsedTaxes.records.map((r, index) => (
              <View key={index} style={styles.taxRow}>
                <Text style={styles.taxDate}>{r.dataVencimento}</Text>
                <Text style={styles.taxType}>
                  {r.tipoDebito} ({r.cnaeCodigo || 'Geral'})
                </Text>
                <Text style={styles.taxVal}>
                  {formatCurrencySmart(r.valorOriginal)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  widgetCard: {
    backgroundColor: colors.background.primary,
    borderColor: colors.border.default,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  widgetHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.primary,
  },
  widgetDescription: {
    fontSize: 11,
    color: colors.text.disabled,
    lineHeight: 14,
  },
  inputGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  inputBox: {
    flex: 1,
    minWidth: 120,
    gap: 4,
  },
  inputLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  textInput: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.sm,
    color: colors.text.primary,
    fontSize: 11,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    minHeight: 30,
  },
  metricRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.01)',
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
  },
  metricCell: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  cellLabel: {
    fontSize: 9,
    color: colors.text.secondary,
  },
  cellValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  tipBanner: {
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    borderColor: 'rgba(59, 130, 246, 0.25)',
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  tipText: {
    fontSize: 10,
    color: colors.text.secondary,
    lineHeight: 13,
  },
  presumidoSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.01)',
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.sm,
    padding: spacing.sm,
    gap: 4,
  },
  subHeader: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 2,
  },
  presumidoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  pLabel: {
    fontSize: 10,
    color: colors.text.secondary,
  },
  pVal: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: colors.text.primary,
  },
  calculationPanel: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    gap: 6,
  },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  calcLabel: {
    fontSize: 10,
    color: colors.text.secondary,
  },
  calcVal: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: colors.text.primary,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginVertical: 4,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: colors.background.tertiary,
    borderRadius: radius.sm,
    padding: 2,
    gap: 2,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: spacing.xs,
    alignItems: 'center',
    borderRadius: radius.sm - 2,
  },
  segmentBtnActive: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  segmentText: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.text.primary,
  },
  comparisonGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  comparisonColumn: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.01)',
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.sm,
    padding: spacing.sm,
    gap: 4,
  },
  comparisonColumnActive: {
    borderColor: colors.success.main,
    borderWidth: 1.5,
  },
  comparisonTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.text.primary,
  },
  comparisonCost: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.primary,
  },
  comparisonLabel: {
    fontSize: 8,
    color: colors.text.disabled,
  },
  codeTextarea: {
    backgroundColor: '#0d1117',
    borderColor: colors.border.default,
    borderWidth: 1,
    borderRadius: radius.sm,
    color: '#a5d6ff',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 10,
    padding: spacing.sm,
    height: 100,
    textAlignVertical: 'top',
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: colors.accent.purple,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.primary,
  },
  taxesList: {
    backgroundColor: 'rgba(255, 255, 255, 0.01)',
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.sm,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 4,
  },
  taxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.03)',
  },
  taxDate: {
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: colors.text.disabled,
    width: 80,
  },
  taxType: {
    fontSize: 10,
    color: colors.text.secondary,
    flex: 1,
  },
  taxVal: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: colors.text.primary,
    textAlign: 'right',
    width: 100,
  },
});
