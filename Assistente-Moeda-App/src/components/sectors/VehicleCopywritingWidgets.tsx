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
  calculateHiddenDrain,
  calculateFreelancerTaxLoss,
  calculateTVDENetHourly,
  calculateRestorationBudget,
} from '../../utils/vehicleCopywritingMath';
import { detectAutoMerchantContext } from '../../utils/vehicleCopywritingParser';

export function VehicleCopywritingWidgets() {
  // ── Hidden Drain State ──
  const [loanPay, setLoanPay] = useState('1500');
  const [fuelCost, setFuelCost] = useState('800');
  const [carVal, setCarVal] = useState('120000');
  const [mileage, setMileage] = useState('20000');

  // ── Freelancer & UBER State ──
  const [activeTab, setActiveTab] = useState<'contractor' | 'tvde'>('contractor');
  // Contractor
  const [profMiles, setProfMiles] = useState('15000');
  const [omission, setOmission] = useState(0.3); // 30%
  const [taxInc, setTaxInc] = useState('27.5');
  const [taxSoc, setTaxSoc] = useState('11');
  // TVDE
  const [grossHourly, setGrossHourly] = useState('25');
  const [costPerKm, setCostPerKm] = useState('0.80');
  const [kmPerHour, setKmPerHour] = useState('20');
  const [deadhead, setDeadhead] = useState(0.38); // 38%

  // ── Project Car State ──
  const [chassisCost, setChassisCost] = useState('8000');
  const [engineCost, setEngineCost] = useState('12000');
  const [paintCost, setPaintCost] = useState('6000');
  const [interiorCost, setInteriorCost] = useState('4000');

  // ── Merchant Trigger State ──
  const [merchantInput, setMerchantInput] = useState('Posto Ipiranga');
  const [showSoftPrompt, setShowSoftPrompt] = useState(false);

  // ── 1. Hidden Drain calculations ──
  const drainResult = useMemo(() => {
    const loan = parseFloat(loanPay) || 0;
    const fuel = parseFloat(fuelCost) || 0;
    const val = parseFloat(carVal) || 0;
    const mil = parseFloat(mileage) || 0;

    return calculateHiddenDrain(loan, fuel, val, mil);
  }, [loanPay, fuelCost, carVal, mileage]);

  // ── 2. Contractor Tax Loss ──
  const taxLossResult = useMemo(() => {
    const miles = parseFloat(profMiles) || 0;
    const inc = parseFloat(taxInc) || 0;
    const soc = parseFloat(taxSoc) || 0;

    return calculateFreelancerTaxLoss(miles, omission, inc, soc, true);
  }, [profMiles, omission, taxInc, taxSoc]);

  // ── 3. TVDE Net Hourly Income ──
  const tvdeResult = useMemo(() => {
    const gross = parseFloat(grossHourly) || 0;
    const cost = parseFloat(costPerKm) || 0;
    const speed = parseFloat(kmPerHour) || 0;

    return calculateTVDENetHourly(gross, cost, speed, deadhead);
  }, [grossHourly, costPerKm, kmPerHour, deadhead]);

  // ── 4. Project Car Restoration Budget ──
  const projectCarResult = useMemo(() => {
    const c = parseFloat(chassisCost) || 0;
    const e = parseFloat(engineCost) || 0;
    const p = parseFloat(paintCost) || 0;
    const i = parseFloat(interiorCost) || 0;

    const stages = [
      { id: '1', name: 'Funilaria e Chassis', baseCost: c },
      { id: '2', name: 'Motor e Mecânica', baseCost: e },
      { id: '3', name: 'Pintura e Polimento', baseCost: p },
      { id: '4', name: 'Interior e Tapeçaria', baseCost: i },
    ];

    return calculateRestorationBudget(stages);
  }, [chassisCost, engineCost, paintCost, interiorCost]);

  const handleTestMerchant = () => {
    const isTrigger = detectAutoMerchantContext(merchantInput);
    setShowSoftPrompt(isTrigger);
  };

  return (
    <View style={styles.container}>
      {/* 💡 Onboarding Merchant Context Trigger Simulation */}
      <View style={styles.widgetCard}>
        <Text style={styles.widgetHeader}>⚡ Detector de Transações Automóveis (MCC Trigger)</Text>
        <Text style={styles.widgetDescription}>
          Simule a identificação de palavras-chave bancárias que disparam a ativação contextual do módulo de TCO.
        </Text>

        <View style={styles.rowGrid}>
          <TextInput
            style={[styles.textInput, { flex: 2 }]}
            value={merchantInput}
            onChangeText={setMerchantInput}
            placeholder="Ex: Auto Oficina, Shell..."
          />
          <Pressable style={styles.actionBtn} onPress={handleTestMerchant}>
            <Text style={styles.actionBtnText}>Testar Transação</Text>
          </Pressable>
        </View>

        {showSoftPrompt && (
          <View style={styles.softPromptBanner}>
            <Text style={styles.softPromptText}>
              💡 <Text style={{ fontWeight: 'bold' }}>Sugestão de Ativação:</Text> Identificamos gastos em{' '}
              <Text style={{ fontWeight: 'bold', color: colors.accent.purple }}>"{merchantInput}"</Text>.
              Deseja vincular este veículo para monitorar desvios de CPK e dreno de depreciação?
            </Text>
          </View>
        )}
      </View>

      {/* 💸 1. Hidden Drain Shock Card */}
      <View style={styles.widgetCard}>
        <Text style={styles.widgetHeader}>💸 O Dreno Oculto Automóvel (Dissonância Cognitiva)</Text>
        <Text style={styles.widgetDescription}>
          Descubra o vazamento invisível acumulado. A maioria dos proprietários enxerga apenas o financiamento, ignorando a perda residual mecânica e provisões.
        </Text>

        <View style={styles.inputGrid}>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Financiamento (R$/mês)</Text>
            <TextInput
              style={styles.textInput}
              value={loanPay}
              onChangeText={setLoanPay}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Combustível (R$/mês)</Text>
            <TextInput
              style={styles.textInput}
              value={fuelCost}
              onChangeText={setFuelCost}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Valor do Carro (R$)</Text>
            <TextInput
              style={styles.textInput}
              value={carVal}
              onChangeText={setCarVal}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Distância Anual (KM)</Text>
            <TextInput
              style={styles.textInput}
              value={mileage}
              onChangeText={setMileage}
              keyboardType="numeric"
            />
          </View>
        </View>

        <View style={styles.shockContainer}>
          <View style={styles.barItem}>
            <Text style={styles.barLabel}>Custo Visível Percebido (Parcela):</Text>
            <View style={styles.barWrapper}>
              <View style={[styles.barVisual, { flex: 1, backgroundColor: colors.info.main }]} />
            </View>
            <Text style={styles.barValue}>{formatCurrencySmart(parseFloat(loanPay) || 0)}</Text>
          </View>

          <View style={styles.barItem}>
            <Text style={styles.barLabel}>Custo Real Estruturado (TCO Mensal):</Text>
            <View style={styles.barWrapper}>
              <View
                style={[
                  styles.barVisual,
                  { flex: Math.max(1, drainResult.totalTrueTCO / (parseFloat(loanPay) || 1)), backgroundColor: colors.danger.main },
                ]}
              />
            </View>
            <Text style={[styles.barValue, { color: colors.danger.main, fontWeight: '700' }]}>
              {formatCurrencySmart(drainResult.totalTrueTCO)}
            </Text>
          </View>

          <View style={styles.drenoOcultoCard}>
            <Text style={styles.drenoTitle}>⚠️ Dreno Oculto (Vazamento Silencioso):</Text>
            <Text style={styles.drenoValue}>+{formatCurrencySmart(drainResult.hiddenDrain)}/mês</Text>
            <Text style={styles.drenoSub}>
              Composto por: Depreciação ({formatCurrencySmart(drainResult.depreciation)}), Seguro ({formatCurrencySmart(drainResult.insurance)}), Manutenção ({formatCurrencySmart(drainResult.maintenanceReserve)}).
            </Text>
          </View>
        </View>
      </View>

      {/* ⚖️ 2. Freelancer Tax Loss & Rideshare Net Income Simulator */}
      <View style={styles.widgetCard}>
        <Text style={styles.widgetHeader}>📊 Simulador de Personas (Uber / TVDE vs. Freelancer 1099)</Text>
        
        <View style={styles.tabsRow}>
          <Pressable
            style={[styles.tabBtn, activeTab === 'contractor' && styles.tabBtnActive]}
            onPress={() => setActiveTab('contractor')}
          >
            <Text style={styles.tabText}>Freelancer 1099 / CNPJ</Text>
          </Pressable>
          <Pressable
            style={[styles.tabBtn, activeTab === 'tvde' && styles.tabBtnActive]}
            onPress={() => setActiveTab('tvde')}
          >
            <Text style={styles.tabText}>Motorista Aplicativo (TVDE)</Text>
          </Pressable>
        </View>

        {activeTab === 'contractor' ? (
          <View style={styles.tabContent}>
            <Text style={styles.tabDescription}>
              Autônomos e freelancers perdem deduções valiosas ao deixar de registrar milhas contemporaneamente.
            </Text>

            <View style={styles.inputGrid}>
              <View style={styles.inputBox}>
                <Text style={styles.inputLabel}>KM Profissionais Rodados</Text>
                <TextInput
                  style={styles.textInput}
                  value={profMiles}
                  onChangeText={setProfMiles}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.inputBox}>
                <Text style={styles.inputLabel}>IR s/ Rendimento (%)</Text>
                <TextInput
                  style={styles.textInput}
                  value={taxInc}
                  onChangeText={setTaxInc}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.inputBox}>
                <Text style={styles.inputLabel}>Previdência / INSS (%)</Text>
                <TextInput
                  style={styles.textInput}
                  value={taxSoc}
                  onChangeText={setTaxSoc}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.sliderBox}>
              <Text style={styles.inputLabel}>KM Não Registrados (Omissão): {(omission * 100).toFixed(0)}%</Text>
              <View style={styles.segmentedControl}>
                <Pressable style={[styles.segmentBtn, omission === 0.1 && styles.segmentBtnActive]} onPress={() => setOmission(0.1)}>
                  <Text style={styles.segmentText}>Baixa (10%)</Text>
                </Pressable>
                <Pressable style={[styles.segmentBtn, omission === 0.3 && styles.segmentBtnActive]} onPress={() => setOmission(0.3)}>
                  <Text style={styles.segmentText}>Média (30%)</Text>
                </Pressable>
                <Pressable style={[styles.segmentBtn, omission === 0.5 && styles.segmentBtnActive]} onPress={() => setOmission(0.5)}>
                  <Text style={styles.segmentText}>Alta (50%)</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.resultBox}>
              <Text style={styles.resultLabel}>Perda de Dedução Simplificada:</Text>
              <Text style={styles.resultValue}>{formatCurrencySmart(taxLossResult.lostDeduction)}</Text>
              <View style={styles.savingsBox}>
                <Text style={styles.savingsLabel}>💸 Prejuízo Líquido Direto no Bolso (Lfiscal):</Text>
                <Text style={[styles.savingsValue, { color: colors.danger.main }]}>
                  {formatCurrencySmart(taxLossResult.netTaxLoss)}
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.tabContent}>
            <Text style={styles.tabDescription}>
              Calcule seu faturamento horário líquido de combustível, desgaste do carro de aplicativos e tempo morto em rota.
            </Text>

            <View style={styles.inputGrid}>
              <View style={styles.inputBox}>
                <Text style={styles.inputLabel}>Ganho Bruto (R$/hora)</Text>
                <TextInput
                  style={styles.textInput}
                  value={grossHourly}
                  onChangeText={setGrossHourly}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.inputBox}>
                <Text style={styles.inputLabel}>Custo Real p/ KM (R$)</Text>
                <TextInput
                  style={styles.textInput}
                  value={costPerKm}
                  onChangeText={setCostPerKm}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.inputBox}>
                <Text style={styles.inputLabel}>Distância Média p/ Hora</Text>
                <TextInput
                  style={styles.textInput}
                  value={kmPerHour}
                  onChangeText={setKmPerHour}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.sliderBox}>
              <Text style={styles.inputLabel}>Taxa de Corridas Vazias (Deadhead): {(deadhead * 100).toFixed(0)}%</Text>
              <View style={styles.segmentedControl}>
                <Pressable style={[styles.segmentBtn, deadhead === 0.2 && styles.segmentBtnActive]} onPress={() => setDeadhead(0.2)}>
                  <Text style={styles.segmentText}>Otimizado (20%)</Text>
                </Pressable>
                <Pressable style={[styles.segmentBtn, deadhead === 0.38 && styles.segmentBtnActive]} onPress={() => setDeadhead(0.38)}>
                  <Text style={styles.segmentText}>Padrão (38%)</Text>
                </Pressable>
                <Pressable style={[styles.segmentBtn, deadhead === 0.5 && styles.segmentBtnActive]} onPress={() => setDeadhead(0.5)}>
                  <Text style={styles.segmentText}>Alto (50%)</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.resultBox}>
              <Text style={styles.resultLabel}>Margem Horária Líquida Real (LHlíquido):</Text>
              <Text
                style={[
                  styles.resultValue,
                  { color: tvdeResult.warningFlag ? colors.danger.main : colors.success.main },
                ]}
              >
                {formatCurrencySmart(tvdeResult.netHourlyIncome)}/hora
              </Text>
              <Text style={styles.resultSub}>
                Custo de depreciação/consumo em rota: {formatCurrencySmart(tvdeResult.totalCostPerHour)}/hora.
                KM Deadhead desperdiçado por hora: {tvdeResult.deadheadMilesPerHour.toFixed(1)} km.
              </Text>

              {tvdeResult.warningFlag && (
                <View style={styles.warningBanner}>
                  <Text style={styles.warningBannerText}>
                    ⚠️ ALERTA: Seu ganho líquido por hora está abaixo do salário mínimo recomendado. O desgaste mecânico está corroendo sua receita bruta.
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}
      </View>

      {/* 🛠️ 3. Project Car Restoration Budget & Contingency Tracker */}
      <View style={styles.widgetCard}>
        <Text style={styles.widgetHeader}>🔧 Rastreador de Projetos e Restauros Clássicos</Text>
        <Text style={styles.widgetDescription}>
          Planeje as etapas do restauro mecânico. Adiciona-se uma provisão atuarial padrão de 25% de margem de contingência contra sobrecapitalização e sobrepreços de peças raras.
        </Text>

        <View style={styles.inputGrid}>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Funilaria/Chassis (R$)</Text>
            <TextInput
              style={styles.textInput}
              value={chassisCost}
              onChangeText={setChassisCost}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Motor/Mecânica (R$)</Text>
            <TextInput
              style={styles.textInput}
              value={engineCost}
              onChangeText={setEngineCost}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Pintura/Polimento (R$)</Text>
            <TextInput
              style={styles.textInput}
              value={paintCost}
              onChangeText={setPaintCost}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Interior/Tapeçaria (R$)</Text>
            <TextInput
              style={styles.textInput}
              value={interiorCost}
              onChangeText={setInteriorCost}
              keyboardType="numeric"
            />
          </View>
        </View>

        <View style={styles.tableBlock}>
          {projectCarResult.detailedStages.map((stage) => (
            <View key={stage.id} style={styles.tableRowItem}>
              <Text style={styles.stageName}>{stage.name}</Text>
              <View style={styles.stageCosts}>
                <Text style={styles.baseCost}>{formatCurrencySmart(stage.baseCost)}</Text>
                <Text style={styles.contingencyCost}>+ {formatCurrencySmart(stage.contingency)} (Cont.)</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.grandTotalCard}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Custo Base Total:</Text>
            <Text style={styles.totalVal}>{formatCurrencySmart(projectCarResult.totalBaseCost)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Reserva de Contingência (25%):</Text>
            <Text style={[styles.totalVal, { color: colors.warning.main }]}>
              + {formatCurrencySmart(projectCarResult.totalContingency)}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, { fontWeight: '700' }]}>Orçamento Máximo Previsto:</Text>
            <Text style={[styles.totalVal, { fontSize: 15, color: colors.success.main, fontWeight: '700' }]}>
              {formatCurrencySmart(projectCarResult.grandTotal)}
            </Text>
          </View>
        </View>
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
  rowGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
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
  actionBtn: {
    backgroundColor: colors.accent.purple,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.primary,
  },
  softPromptBanner: {
    backgroundColor: 'rgba(168, 85, 247, 0.08)',
    borderColor: 'rgba(168, 85, 247, 0.25)',
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  softPromptText: {
    fontSize: 10,
    color: colors.text.secondary,
    lineHeight: 14,
  },
  inputGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  inputBox: {
    flex: 1,
    minWidth: 100,
    gap: 4,
  },
  inputLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  shockContainer: {
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  barItem: {
    gap: 4,
  },
  barLabel: {
    fontSize: 10,
    color: colors.text.secondary,
  },
  barWrapper: {
    height: 12,
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  barVisual: {
    height: '100%',
  },
  barValue: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: colors.text.primary,
  },
  drenoOcultoCard: {
    backgroundColor: 'rgba(239, 68, 68, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    borderRadius: radius.sm,
    padding: spacing.sm,
    alignItems: 'center',
    gap: 2,
  },
  drenoTitle: {
    fontSize: 10,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  drenoValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.danger.main,
  },
  drenoSub: {
    fontSize: 8,
    color: colors.text.disabled,
    textAlign: 'center',
    lineHeight: 11,
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: colors.background.tertiary,
    borderRadius: radius.sm,
    padding: 2,
    gap: 2,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: spacing.xs,
    alignItems: 'center',
    borderRadius: radius.sm - 2,
  },
  tabBtnActive: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  tabText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.text.primary,
  },
  tabContent: {
    gap: spacing.md,
  },
  tabDescription: {
    fontSize: 11,
    color: colors.text.disabled,
    lineHeight: 14,
  },
  sliderBox: {
    gap: 6,
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
    fontSize: 18,
    fontWeight: '700',
  },
  resultSub: {
    fontSize: 9,
    color: colors.text.disabled,
    textAlign: 'center',
    marginTop: 2,
    lineHeight: 12,
  },
  savingsBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderRadius: radius.sm,
    padding: spacing.sm,
    width: '100%',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: 2,
  },
  savingsLabel: {
    fontSize: 9,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  savingsValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  warningBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderColor: 'rgba(239, 68, 68, 0.25)',
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.xs,
  },
  warningBannerText: {
    fontSize: 9,
    color: '#f87171',
    fontWeight: '600',
    lineHeight: 12,
    textAlign: 'center',
  },
  tableBlock: {
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.01)',
  },
  tableRowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.03)',
  },
  stageName: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.primary,
  },
  stageCosts: {
    alignItems: 'flex-end',
  },
  baseCost: {
    fontSize: 10,
    color: colors.text.secondary,
  },
  contingencyCost: {
    fontSize: 9,
    color: colors.warning.main,
    fontWeight: '600',
  },
  grandTotalCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing.md,
    gap: 4,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 10,
    color: colors.text.secondary,
  },
  totalVal: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: colors.text.primary,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginVertical: 4,
  },
});
