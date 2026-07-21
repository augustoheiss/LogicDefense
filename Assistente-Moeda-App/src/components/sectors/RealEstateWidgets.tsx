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
  generatePriceSchedule,
  generateSACSchedule,
  recalculateExtraordinaryAmortization,
  calculateRealYield,
  calculateRossHeidecke,
} from '../../utils/realEstateMath';
import { parseRealEstateCSV, RealEstateProperty } from '../../utils/realEstateParser';

const SAMPLE_REAL_ESTATE_CSV = `property_id,property_name,rental_income,mortgage_interest,amortization_type,property_value,useful_life,effective_age,heidecke_state
PROP01,Apartamento Centro,2500,9.5,price,450000,60,12,0.2
PROP02,Casa Suburbio,3200,8.9,sac,600000,50,20,0.4
PROP03,Sala Comercial,1800,10.2,price,300000,40,5,0.1`;

export function RealEstateWidgets() {
  // ── Amortization Simulator State ──
  const [pv, setPv] = useState('350000'); // Valor Financiado
  const [rate, setRate] = useState('9.5'); // Taxa anual (%)
  const [term, setTerm] = useState('360'); // Prazo (meses)
  const [ae, setAe] = useState('30000'); // Amortização Extraordinária
  const [aeMonth, setAeMonth] = useState('12'); // Mês da amortização
  const [amortType, setAmortType] = useState<'price' | 'sac'>('price');
  const [recalcPath, setRecalcPath] = useState<'term' | 'payment'>('term');

  // ── Fisher Yield State ──
  const [investment, setInvestment] = useState('500000'); // Investimento inicial
  const [rent, setRent] = useState('30000'); // Receita de aluguel anual
  const [expense, setExpense] = useState('8000'); // Despesa anual
  const [vacancy, setVacancy] = useState('5'); // Vacância (%)
  const [igpm, setIgpm] = useState('6.5'); // IGP-M anual (%)
  const [ipca, setIpca] = useState('4.5'); // IPCA anual (%)
  const [horizon, setHorizon] = useState('10'); // Horizonte (anos)

  // ── Operational & Ross-Heidecke State ──
  const [vMarket, setVMarket] = useState('500000'); // Valor de mercado
  const [noi, setNoi] = useState('22000'); // NOI anual
  const [equity, setEquity] = useState('150000'); // Capital próprio investido
  const [debtService, setDebtService] = useState('12000'); // Serviço anual da dívida
  const [age, setAge] = useState('15'); // Idade efetiva
  const [life, setLife] = useState('50'); // Vida útil
  const [vResidual, setVResidual] = useState('100000'); // Valor residual
  const [heidecke, setHeidecke] = useState('0.2'); // Estado de conservação (0 a 1)

  // ── CSV Importer State ──
  const [csvText, setCsvText] = useState(SAMPLE_REAL_ESTATE_CSV);
  const [parsedProperties, setParsedProperties] = useState(() =>
    parseRealEstateCSV(SAMPLE_REAL_ESTATE_CSV)
  );

  // ── 1. Amortization Simulator Calculations ──
  const amortizationResult = useMemo(() => {
    const pvNum = parseFloat(pv) || 0;
    const rateNum = parseFloat(rate) || 0;
    const termNum = parseInt(term, 10) || 0;
    const aeNum = parseFloat(ae) || 0;
    const aeM = parseInt(aeMonth, 10) || 0;

    let scheduleObj =
      amortType === 'price'
        ? generatePriceSchedule(pvNum, rateNum, termNum)
        : generateSACSchedule(pvNum, rateNum, termNum);

    const normalPayment = scheduleObj.schedule[0]?.payment || 0;

    // Get remaining balance at the month of extra payment
    const periodData = scheduleObj.schedule.find((p) => p.period === aeM);
    const balanceBeforeExtra = periodData ? periodData.endingBalance + periodData.amortization : pvNum;
    const remainingMonths = Math.max(0, termNum - aeM + 1);

    const recalc = recalculateExtraordinaryAmortization(
      amortType,
      balanceBeforeExtra,
      aeNum,
      rateNum,
      remainingMonths,
      normalPayment,
      recalcPath
    );

    return {
      normalPayment,
      totalInterestNormal: scheduleObj.totalInterest,
      newMonthsRemaining: recalc.newMonthsRemaining,
      newPayment: recalc.newPayment,
      interestSaved: recalc.interestSaved,
    };
  }, [pv, rate, term, ae, aeMonth, amortType, recalcPath]);

  // ── 2. Fisher Real Yield Calculations ──
  const yieldResult = useMemo(() => {
    const invNum = parseFloat(investment) || 0;
    const rentNum = parseFloat(rent) || 0;
    const expNum = parseFloat(expense) || 0;
    const vacNum = parseFloat(vacancy) || 0;
    const igpmNum = parseFloat(igpm) || 0;
    const ipcaNum = parseFloat(ipca) || 0;
    const horNum = parseInt(horizon, 10) || 10;

    return calculateRealYield(invNum, rentNum, expNum, vacNum, igpmNum, ipcaNum, horNum);
  }, [investment, rent, expense, vacancy, igpm, ipca, horizon]);

  // ── 3. Ross-Heidecke calculations ──
  const rhResult = useMemo(() => {
    const valNew = parseFloat(vMarket) || 0;
    const valRes = parseFloat(vResidual) || 0;
    const effAge = parseInt(age, 10) || 0;
    const useLife = parseInt(life, 10) || 0;
    const hState = parseFloat(heidecke) || 0.0;

    return calculateRossHeidecke(valNew, valRes, effAge, useLife, hState);
  }, [vMarket, vResidual, age, life, heidecke]);

  // Operational metrics
  const opMetrics = useMemo(() => {
    const valM = parseFloat(vMarket) || 1;
    const noiNum = parseFloat(noi) || 0;
    const eqNum = parseFloat(equity) || 1;
    const dsNum = parseFloat(debtService) || 0;
    const grossRent = parseFloat(rent) || noiNum || 1;

    return {
      capRate: (noiNum / valM) * 100,
      coc: ((noiNum - dsNum) / eqNum) * 100,
      grm: valM / grossRent,
    };
  }, [vMarket, noi, equity, debtService, rent]);

  const handleParseCSV = () => {
    const res = parseRealEstateCSV(csvText);
    setParsedProperties(res);
    // Autofill states from the first parsed property if available
    if (res.properties.length > 0) {
      const prop = res.properties[0];
      setRent(String(prop.rentalIncome * 12)); // annualize
      setVMarket(String(prop.propertyValue));
      setLife(String(prop.usefulLife));
      setAge(String(prop.effectiveAge));
      setHeidecke(String(prop.heideckeState));
      setAmortType(prop.amortizationType);
    }
  };

  return (
    <View style={styles.container}>
      {/* 🏢 1. Price vs. SAC & Extraordinary Amortization Simulator */}
      <View style={styles.widgetCard}>
        <Text style={styles.widgetHeader}>📈 Simulador Price vs. SAC & Amortização Extraordinária</Text>
        <Text style={styles.widgetDescription}>
          Simule o recálculo do saldo devedor após aportes pontuais para redução de prazo (Term Reduction) ou redução de parcela (Payment Reduction).
        </Text>

        <View style={styles.inputGrid}>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Valor Financiado (R$)</Text>
            <TextInput
              style={styles.textInput}
              value={pv}
              onChangeText={setPv}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Taxa de Juros Anual (%)</Text>
            <TextInput
              style={styles.textInput}
              value={rate}
              onChangeText={setRate}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Prazo Total (Meses)</Text>
            <TextInput
              style={styles.textInput}
              value={term}
              onChangeText={setTerm}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Aporte Extra (R$)</Text>
            <TextInput
              style={styles.textInput}
              value={ae}
              onChangeText={setAe}
              keyboardType="numeric"
            />
          </View>
        </View>

        <View style={styles.segmentedControl}>
          <Pressable
            style={[styles.segmentBtn, amortType === 'price' && styles.segmentBtnActive]}
            onPress={() => setAmortType('price')}
          >
            <Text style={styles.segmentText}>Tabela Price</Text>
          </Pressable>
          <Pressable
            style={[styles.segmentBtn, amortType === 'sac' && styles.segmentBtnActive]}
            onPress={() => setAmortType('sac')}
          >
            <Text style={styles.segmentText}>Tabela SAC</Text>
          </Pressable>
        </View>

        <View style={styles.segmentedControl}>
          <Pressable
            style={[styles.segmentBtn, recalcPath === 'term' && styles.segmentBtnActive]}
            onPress={() => setRecalcPath('term')}
          >
            <Text style={styles.segmentText}>Reduzir Prazo</Text>
          </Pressable>
          <Pressable
            style={[styles.segmentBtn, recalcPath === 'payment' && styles.segmentBtnActive]}
            onPress={() => setRecalcPath('payment')}
          >
            <Text style={styles.segmentText}>Reduzir Parcela</Text>
          </Pressable>
        </View>

        <View style={styles.comparisonGrid}>
          <View style={styles.comparisonColumn}>
            <Text style={styles.comparisonTitle}>Parcela Normal</Text>
            <Text style={styles.comparisonCost}>
              {formatCurrencySmart(amortizationResult.normalPayment)}
            </Text>
            <Text style={styles.comparisonLabel}>Juros Normais: {formatCurrencySmart(amortizationResult.totalInterestNormal)}</Text>
          </View>

          <View style={[styles.comparisonColumn, styles.comparisonColumnActive]}>
            <Text style={[styles.comparisonTitle, { color: colors.accent.purple }]}>Pós-Amortização</Text>
            <Text style={styles.comparisonCost}>
              {formatCurrencySmart(amortizationResult.newPayment)}
            </Text>
            <Text style={[styles.comparisonLabel, { color: colors.success.main, fontWeight: '700' }]}>
              🛡️ Economia Juros: {formatCurrencySmart(amortizationResult.interestSaved)}
            </Text>
            <Text style={styles.comparisonLabel}>
              Prazo Restante: {amortizationResult.newMonthsRemaining} meses
            </Text>
          </View>
        </View>
      </View>

      {/* 🏢 2. Fisher Inflation & Real Yield Dashboard */}
      <View style={styles.widgetCard}>
        <Text style={styles.widgetHeader}>💵 Rendimento Real e Equação de Fisher</Text>
        <Text style={styles.widgetDescription}>
          Projete os fluxos de receita reajustados pelo IGP-M e despesas operacionais corrigidas pelo IPCA. A TIR real desconta a inflação do IPCA.
        </Text>

        <View style={styles.inputGrid}>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Investimento (R$)</Text>
            <TextInput
              style={styles.textInput}
              value={investment}
              onChangeText={setInvestment}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Aluguel Anual (R$)</Text>
            <TextInput
              style={styles.textInput}
              value={rent}
              onChangeText={setRent}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>IPCA Projetado (%)</Text>
            <TextInput
              style={styles.textInput}
              value={ipca}
              onChangeText={setIpca}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>IGP-M Projetado (%)</Text>
            <TextInput
              style={styles.textInput}
              value={igpm}
              onChangeText={setIgpm}
              keyboardType="numeric"
            />
          </View>
        </View>

        <View style={styles.rowGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statBoxLabel}>TIR Nominal Projetada</Text>
            <Text style={[styles.statBoxValue, { color: colors.info.main }]}>
              {yieldResult.nominalIRR.toFixed(2)}%
            </Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statBoxLabel}>TIR Real (Deflacionada)</Text>
            <Text style={[styles.statBoxValue, { color: colors.success.main }]}>
              {yieldResult.realIRR.toFixed(2)}%
            </Text>
          </View>
        </View>

        <View style={styles.infoBanner}>
          <Text style={styles.infoBannerText}>
            ℹ️ <Text style={{ fontWeight: 'bold' }}>Equação de Fisher:</Text> Um ganho nominal de{' '}
            {yieldResult.nominalIRR.toFixed(1)}% corresponde a um ganho real líquido de{' '}
            {yieldResult.realIRR.toFixed(1)}% após ajuste inflacionário médio.
          </Text>
        </View>
      </View>

      {/* 🏢 3. Cap Rate, CoC & Ross-Heidecke Physical Depreciation */}
      <View style={styles.widgetCard}>
        <Text style={styles.widgetHeader}>🏚️ Depreciação Física Ross-Heidecke & CapEx</Text>
        <Text style={styles.widgetDescription}>
          Avalie o desgaste urbano de benfeitorias para calcular a provisão ideal de CapEx preventivo anual necessário para restaurar a integridade estrutural.
        </Text>

        <View style={styles.inputGrid}>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Valor de Novo (R$)</Text>
            <TextInput
              style={styles.textInput}
              value={vMarket}
              onChangeText={setVMarket}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Idade Efetiva (Anos)</Text>
            <TextInput
              style={styles.textInput}
              value={age}
              onChangeText={setAge}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Vida Útil (Anos)</Text>
            <TextInput
              style={styles.textInput}
              value={life}
              onChangeText={setLife}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Heidecke Estado (0 a 1)</Text>
            <TextInput
              style={styles.textInput}
              value={heidecke}
              onChangeText={setHeidecke}
              keyboardType="numeric"
            />
          </View>
        </View>

        <View style={styles.rowGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statBoxLabel}>Cap Rate Operacional</Text>
            <Text style={styles.statBoxValue}>{opMetrics.capRate.toFixed(2)}%</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statBoxLabel}>Cash-on-Cash Return</Text>
            <Text style={styles.statBoxValue}>{opMetrics.coc.toFixed(2)}%</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statBoxLabel}>Múltiplo GRM</Text>
            <Text style={styles.statBoxValue}>{opMetrics.grm.toFixed(1)}x</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.resultBox}>
          <Text style={styles.resultLabel}>Depreciação Acumulada (Kd):</Text>
          <Text style={[styles.resultValue, { color: colors.danger.main }]}>
            {(rhResult.kd * 100).toFixed(1)}%
          </Text>
          <Text style={styles.resultSub}>
            Valor Depreciado do Imóvel: {formatCurrencySmart(rhResult.depreciatedValue)}
          </Text>
          <View style={styles.capexBox}>
            <Text style={styles.capexLabel}>Provisão de CapEx Anual Preventivo:</Text>
            <Text style={styles.capexValue}>{formatCurrencySmart(rhResult.annualCapExReserveValue)}</Text>
            <Text style={styles.capexSub}>Taxa marginal: {rhResult.annualCapExReserveRate.toFixed(3)}% ao ano</Text>
          </View>
        </View>
      </View>

      {/* 🏢 4. CSV Importer for Real Estate Assets */}
      <View style={styles.widgetCard}>
        <Text style={styles.widgetHeader}>📥 Cadastro de Ativos Imobiliários (CSV)</Text>
        <Text style={styles.widgetDescription}>
          Cadastre seu portfólio de imóveis em formato CSV para auto-preenchimento dos simuladores quantitativos.
        </Text>

        <TextInput
          style={styles.codeTextarea}
          multiline
          value={csvText}
          onChangeText={setCsvText}
          placeholder="property_id,property_name,rental_income..."
          placeholderTextColor={colors.text.disabled}
        />

        <View style={styles.actionRow}>
          <Pressable style={styles.actionBtn} onPress={handleParseCSV}>
            <Text style={styles.actionBtnText}>🔄 Cadastrar Portfólio</Text>
          </Pressable>
          <Pressable
            style={[styles.actionBtn, { backgroundColor: colors.background.tertiary }]}
            onPress={() => {
              setCsvText(SAMPLE_REAL_ESTATE_CSV);
              setParsedProperties(parseRealEstateCSV(SAMPLE_REAL_ESTATE_CSV));
            }}
          >
            <Text style={styles.actionBtnText}>Resetar CSV</Text>
          </Pressable>
        </View>

        {parsedProperties.properties.length > 0 && (
          <View style={styles.propertiesList}>
            <Text style={styles.sectionTitle}>Imóveis Cadastrados ({parsedProperties.properties.length}):</Text>
            {parsedProperties.properties.map((p) => (
              <View key={p.propertyId} style={styles.propertyRow}>
                <Text style={styles.propertyId}>{p.propertyId}</Text>
                <Text style={styles.propertyName} numberOfLines={1}>
                  {p.propertyName}
                </Text>
                <Text style={styles.propertyVal}>
                  {formatCurrencySmart(p.propertyValue)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
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
    borderColor: colors.accent.purple,
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
  rowGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statBox: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.sm,
    padding: spacing.sm,
    gap: 2,
    alignItems: 'center',
  },
  statBoxLabel: {
    fontSize: 8,
    color: colors.text.secondary,
  },
  statBoxValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
  },
  infoBanner: {
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    borderColor: 'rgba(59, 130, 246, 0.25)',
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  infoBannerText: {
    fontSize: 10,
    color: colors.text.secondary,
    lineHeight: 13,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  resultBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
    gap: 4,
  },
  resultLabel: {
    fontSize: 10,
    color: colors.text.secondary,
  },
  resultValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  resultSub: {
    fontSize: 9,
    color: colors.text.disabled,
    textAlign: 'center',
    marginTop: 2,
  },
  capexBox: {
    backgroundColor: 'rgba(168, 85, 247, 0.1)',
    borderRadius: radius.sm,
    padding: spacing.sm,
    width: '100%',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: 2,
  },
  capexLabel: {
    fontSize: 9,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  capexValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.success.main,
  },
  capexSub: {
    fontSize: 7,
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
  propertiesList: {
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
  propertyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.03)',
  },
  propertyId: {
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: colors.text.disabled,
    width: 60,
  },
  propertyName: {
    fontSize: 10,
    color: colors.text.secondary,
    flex: 1,
  },
  propertyVal: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: colors.text.primary,
    textAlign: 'right',
    width: 100,
  },
});
