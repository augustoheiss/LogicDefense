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
  calculateDynamicCPK,
  compareOwnershipVsRideshare,
  optimizeWeibullMaintenance,
} from '../../utils/vehicleMath';
import { parseVehicleCSV, FleetVehicle } from '../../utils/vehicleParser';

const SAMPLE_VEHICLES_CSV = `idVeiculo,perfil_categoria,perfil_propulsao,perfil_msrp,perfil_distanciaAnual,energia_precoBase,energia_volatilidadeIndice,energia_consumoNominal,energia_fatorCondutor,energia_fatorRota,pneus_quantidadePneus,pneus_precoUnitario,pneus_vidaNominal,pneus_iriEstrada,pneus_sensibilidadeIri,seguro_premioBase,seguro_taxaVariavel,seguro_pontuacaoSeguranca,seguro_fatorRisco,deprec_coefIdade,deprec_coefQuilometragem,deprec_idadeAtualAnos,deprec_quilometragemAcumulada,weibull_beta,weibull_eta,weibull_custoPrev,weibull_custoCorr
CAR01,Comercial,Combustão,120000,22000,5.8,0.15,8.5,0.05,1.0,4,450,40000,2.5,0.1,2400,0.1,90,1.0,0.15,0.08,2,30000,2.2,80000,350,1800
CAR02,Comercial,Elétrico,180000,30000,0.85,0.05,18.0,0.02,1.0,4,550,45000,2.2,0.08,2800,0.08,95,0.8,0.12,0.06,1,15000,1.8,95000,450,2200`;

export function VehicleFleetWidgets() {
  // ── CPK Simulator State ──
  const [fcReal, setFcReal] = useState('8.5'); // L/100km
  const [pRef, setPRef] = useState('5.80'); // R$/L
  const [sigma90, setSigma90] = useState('0.15'); // R$
  const [deltaDriver, setDeltaDriver] = useState(0.05); // driver style
  const [iriRoad, setIriRoad] = useState('2.5'); // road roughness
  const [safetyScore, setSafetyScore] = useState(90); // driving safety score (UBI)
  const [harshEvents, setHarshEvents] = useState('5');

  // ── Buy vs. Rideshare NPV State ──
  const [msrp, setMsrp] = useState('120000');
  const [annualDist, setAnnualDist] = useState('20000');
  const [hourlyRate, setHourlyRate] = useState('35');
  const [efficiency, setEfficiency] = useState(0.8); // 80% productivity
  const [resale, setResale] = useState('45000');

  // ── Weibull State ──
  const [weibullBeta, setWeibullBeta] = useState('2.2');
  const [weibullEta, setWeibullEta] = useState('80000');
  const [cPrev, setCPrev] = useState('350');
  const [cCorr, setCCorr] = useState('1800');

  // ── CSV State ──
  const [csvText, setCsvText] = useState(SAMPLE_VEHICLES_CSV);
  const [parsedFleet, setParsedFleet] = useState(() => parseVehicleCSV(SAMPLE_VEHICLES_CSV));

  // ── 1. Real-Time CPK Calculation ──
  const cpkBreakdown = useMemo(() => {
    const fc = parseFloat(fcReal) || 0;
    const p = parseFloat(pRef) || 0;
    const sig = parseFloat(sigma90) || 0;
    const iri = parseFloat(iriRoad) || 2.0;
    const harsh = parseInt(harshEvents, 10) || 0;
    const msrpNum = parseFloat(msrp) || 120000;
    const dist = parseFloat(annualDist) || 20000;

    return calculateDynamicCPK(
      fc,
      p,
      sig,
      deltaDriver,
      4, // numTires
      450, // tireUnitPrice
      40000, // nominalTireLife
      iri,
      0.1, // iriSensitivity
      0.12, // baseMaintCostPerKm (R$/km)
      2400, // baseInsurancePremium
      dist,
      0.08, // baseInsurancePerKm
      harsh,
      1000, // refDistance
      1.2, // harshWeight
      msrpNum,
      0.15, // deprecCoefAge
      0.08, // deprecCoefKm
      0.02, // deprecCoefInteraction
      2 // ageYears
    );
  }, [fcReal, pRef, sigma90, deltaDriver, iriRoad, harshEvents, msrp, annualDist]);

  // ── 2. Buy vs. Rideshare NPV Comparison ──
  const comparisonResult = useMemo(() => {
    const msrpNum = parseFloat(msrp) || 0;
    const dist = parseFloat(annualDist) || 0;
    const hourly = parseFloat(hourlyRate) || 0;
    const res = parseFloat(resale) || 0;

    // Derived: Travel hours per year = distance / average speed (say 50 km/h)
    const travelHours = dist / 50;

    return compareOwnershipVsRideshare(
      msrpNum,
      dist,
      cpkBreakdown.totalCPK,
      34, // corporate tax rate (tau)
      10, // discount rate (r)
      res,
      2.2, // rideshareCostPerKm
      travelHours,
      hourly,
      efficiency
    );
  }, [msrp, annualDist, cpkBreakdown.totalCPK, resale, hourlyRate, efficiency]);

  // ── 3. Weibull Optimizer Calculations ──
  const weibullResult = useMemo(() => {
    const b = parseFloat(weibullBeta) || 1.0;
    const e = parseFloat(weibullEta) || 80000;
    const cp = parseFloat(cPrev) || 100;
    const cc = parseFloat(cCorr) || 500;

    return optimizeWeibullMaintenance(b, e, cp, cc);
  }, [weibullBeta, weibullEta, cPrev, cCorr]);

  const handleParseFleet = () => {
    const res = parseVehicleCSV(csvText);
    setParsedFleet(res);
    if (res.vehicles.length > 0) {
      const v = res.vehicles[0];
      setFcReal(String(v.energiaConsumoNominal));
      setPRef(String(v.energiaPrecoBase));
      setSigma90(String(v.energiaVolatilidadeIndice));
      setIriRoad(String(v.pneusIriEstrada));
      setSafetyScore(v.seguroPontuacaoSeguranca);
      setMsrp(String(v.perfilMsrp));
      setAnnualDist(String(v.perfilDistanciaAnual));
      setWeibullBeta(String(v.weibullBeta));
      setWeibullEta(String(v.weibullEta));
      setCPrev(String(v.weibullCustoPrev));
      setCCorr(String(v.weibullCustoCorr));
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* 🚗 1. Real-Time CPK & UBI Safety Score */}
      <View style={styles.widgetCard}>
        <Text style={styles.widgetHeader}>🚗 CPK Dinâmico & Telemetria do Condutor (UBI)</Text>
        <Text style={styles.widgetDescription}>
          Cálculo dinâmico do Custo por Quilômetro ($CPK$) cruzando consumo em tempo real, abrasão de pneus (pavimento IRI) e seguro comportamental.
        </Text>

        <View style={styles.inputGrid}>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Consumo (L/100km)</Text>
            <TextInput
              style={styles.textInput}
              value={fcReal}
              onChangeText={setFcReal}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Combustível (R$/L)</Text>
            <TextInput
              style={styles.textInput}
              value={pRef}
              onChangeText={setPRef}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Estrada Rugosidade (IRI)</Text>
            <TextInput
              style={styles.textInput}
              value={iriRoad}
              onChangeText={setIriRoad}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Eventos Bruscos (Seguro)</Text>
            <TextInput
              style={styles.textInput}
              value={harshEvents}
              onChangeText={setHarshEvents}
              keyboardType="numeric"
            />
          </View>
        </View>

        <View style={styles.segmentedControl}>
          <Pressable
            style={[styles.segmentBtn, deltaDriver === 0.0 && styles.segmentBtnActive]}
            onPress={() => setDeltaDriver(0.0)}
          >
            <Text style={styles.segmentText}>Estilo Eco (0%)</Text>
          </Pressable>
          <Pressable
            style={[styles.segmentBtn, deltaDriver === 0.08 && styles.segmentBtnActive]}
            onPress={() => setDeltaDriver(0.08)}
          >
            <Text style={styles.segmentText}>Normal (+8%)</Text>
          </Pressable>
          <Pressable
            style={[styles.segmentBtn, deltaDriver === 0.15 && styles.segmentBtnActive]}
            onPress={() => setDeltaDriver(0.15)}
          >
            <Text style={styles.segmentText}>Agressivo (+15%)</Text>
          </Pressable>
        </View>

        {/* CPK Breakdown table */}
        <View style={styles.cpkDisplay}>
          <Text style={styles.cpkTitle}>Detalhamento do CPK Real:</Text>
          
          <View style={styles.tableRow}>
            <Text style={styles.tableColLabel}>Energia / Combustível</Text>
            <Text style={styles.tableColVal}>{formatCurrencySmart(cpkBreakdown.energyCost)}/km</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableColLabel}>Desgaste de Pneus (IRI)</Text>
            <Text style={styles.tableColVal}>{formatCurrencySmart(cpkBreakdown.tireCost)}/km</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableColLabel}>Manutenção Preventiva</Text>
            <Text style={styles.tableColVal}>{formatCurrencySmart(cpkBreakdown.maintenanceCost)}/km</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableColLabel}>Seguro Comportamental (UBI)</Text>
            <Text style={styles.tableColVal}>{formatCurrencySmart(cpkBreakdown.insuranceCost)}/km</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableColLabel}>Depreciação Residual</Text>
            <Text style={styles.tableColVal}>{formatCurrencySmart(cpkBreakdown.depreciationCost)}/km</Text>
          </View>

          <View style={styles.totalCpkCard}>
            <Text style={styles.totalCpkLabel}>Custo Técnico Total (CPK):</Text>
            <Text style={styles.totalCpkValue}>{formatCurrencySmart(cpkBreakdown.totalCPK)}/km</Text>
          </View>
        </View>
      </View>

      {/* 💼 2. Buy vs. Rideshare NPV Simulator */}
      <View style={styles.widgetCard}>
        <Text style={styles.widgetHeader}>⚖️ Aquisição de Frota (VAL) vs. Terceirização</Text>
        <Text style={styles.widgetDescription}>
          Avaliação de viabilidade financeira a 5 anos comparando a compra de frota própria (com Tax Shield e residual) com o rideshare corporativo (recuperando horas de produtividade no banco traseiro).
        </Text>

        <View style={styles.inputGrid}>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>MSRP Veículo (R$)</Text>
            <TextInput
              style={styles.textInput}
              value={msrp}
              onChangeText={setMsrp}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Quilometragem Anual</Text>
            <TextInput
              style={styles.textInput}
              value={annualDist}
              onChangeText={setAnnualDist}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Taxa Horária Sócio/Condutor</Text>
            <TextInput
              style={styles.textInput}
              value={hourlyRate}
              onChangeText={setHourlyRate}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Valor Revenda 5 anos (R$)</Text>
            <TextInput
              style={styles.textInput}
              value={resale}
              onChangeText={setResale}
              keyboardType="numeric"
            />
          </View>
        </View>

        <View style={styles.segmentedControl}>
          <Pressable
            style={[styles.segmentBtn, efficiency === 0.0 && styles.segmentBtnActive]}
            onPress={() => setEfficiency(0.0)}
          >
            <Text style={styles.segmentText}>0% Eficiência</Text>
          </Pressable>
          <Pressable
            style={[styles.segmentBtn, efficiency === 0.5 && styles.segmentBtnActive]}
            onPress={() => setEfficiency(0.5)}
          >
            <Text style={styles.segmentText}>50% Produtividade</Text>
          </Pressable>
          <Pressable
            style={[styles.segmentBtn, efficiency === 0.8 && styles.segmentBtnActive]}
            onPress={() => setEfficiency(0.8)}
          >
            <Text style={styles.segmentText}>80% Produtividade</Text>
          </Pressable>
        </View>

        <View style={styles.comparisonGrid}>
          <View style={styles.comparisonColumn}>
            <Text style={styles.comparisonTitle}>VAL Aquisição Própria</Text>
            <Text style={styles.comparisonCost}>
              {formatCurrencySmart(comparisonResult.valOwnership)}
            </Text>
            <Text style={styles.comparisonLabel}>Com Tax Shield IRC 34%</Text>
          </View>

          <View style={[styles.comparisonColumn, comparisonResult.recommendation === 'rideshare' && styles.comparisonColumnActive]}>
            <Text style={styles.comparisonTitle}>VAL Terceirização App</Text>
            <Text style={styles.comparisonCost}>
              {formatCurrencySmart(comparisonResult.valRideshare)}
            </Text>
            <Text style={styles.comparisonLabel}>Banco de Trás Produtivo</Text>
          </View>
        </View>

        <View style={styles.infoBanner}>
          <Text style={styles.infoBannerText}>
            {comparisonResult.description}
          </Text>
        </View>
      </View>

      {/* 🛠️ 3. Weibull Fleet Maintenance Optimizer */}
      <View style={styles.widgetCard}>
        <Text style={styles.widgetHeader}>⚙️ Otimizador de Substituição Preventiva (Weibull)</Text>
        <Text style={styles.widgetDescription}>
          Previna falhas catastróficas em rota. A distribuição de Weibull determina a quilometragem ótima ($M^*$) de troca de componentes que minimiza o custo total acumulado.
        </Text>

        <View style={styles.inputGrid}>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Weibull Shape (Beta β)</Text>
            <TextInput
              style={styles.textInput}
              value={weibullBeta}
              onChangeText={setWeibullBeta}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Weibull Scale (Eta η)</Text>
            <TextInput
              style={styles.textInput}
              value={weibullEta}
              onChangeText={setWeibullEta}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Troca Preventiva (R$)</Text>
            <TextInput
              style={styles.textInput}
              value={cPrev}
              onChangeText={setCPrev}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Reparo de Quebra (R$)</Text>
            <TextInput
              style={styles.textInput}
              value={cCorr}
              onChangeText={setCCorr}
              keyboardType="numeric"
            />
          </View>
        </View>

        <View style={styles.resultBox}>
          <Text style={styles.resultLabel}>Intervalo Preventivo Recomendado (M*):</Text>
          <Text style={[styles.resultValue, { color: colors.success.main }]}>
            {weibullResult.optimalM.toFixed(0)} km
          </Text>
          <Text style={styles.resultSub}>
            MMBF Histórico (Média): {weibullResult.optimalM > 0 ? (weibullResult.optimalM * 1.3).toFixed(0) : 0} km (Trocar no MMBF aumenta custos de quebra)
          </Text>

          {weibullResult.savings > 0 && (
            <View style={styles.savingsBox}>
              <Text style={styles.savingsLabel}>Economia Teórica de Escala (Weibull vs MMBF):</Text>
              <Text style={styles.savingsValue}>{formatCurrencySmart(weibullResult.savings)}/intervenção</Text>
            </View>
          )}
        </View>
      </View>

      {/* 📥 4. CSV Importer for Fleets */}
      <View style={styles.widgetCard}>
        <Text style={styles.widgetHeader}>📥 Painel de Carregamento de Frota (CSV)</Text>
        <Text style={styles.widgetDescription}>
          Alimente e atualize os indicadores do painel a partir de planilhas de frota desnormalizadas.
        </Text>

        <TextInput
          style={styles.codeTextarea}
          multiline
          value={csvText}
          onChangeText={setCsvText}
          placeholder="idVeiculo,perfil_categoria..."
          placeholderTextColor={colors.text.disabled}
        />

        <View style={styles.actionRow}>
          <Pressable style={styles.actionBtn} onPress={handleParseFleet}>
            <Text style={styles.actionBtnText}>🔄 Reconciliar Frota</Text>
          </Pressable>
          <Pressable
            style={[styles.actionBtn, { backgroundColor: colors.background.tertiary }]}
            onPress={() => {
              setCsvText(SAMPLE_VEHICLES_CSV);
              setParsedFleet(parseVehicleCSV(SAMPLE_VEHICLES_CSV));
            }}
          >
            <Text style={styles.actionBtnText}>Restaurar Exemplo</Text>
          </Pressable>
        </View>

        {parsedFleet.vehicles.length > 0 && (
          <View style={styles.vehiclesList}>
            <Text style={styles.sectionTitle}>Frota Reconciliada ({parsedFleet.vehicles.length}):</Text>
            {parsedFleet.vehicles.map((v) => (
              <View key={v.idVeiculo} style={styles.vehicleRow}>
                <Text style={styles.vehicleId}>{v.idVeiculo}</Text>
                <Text style={styles.vehicleCategory}>
                  {v.perfilCategoria} ({v.perfilPropulsao})
                </Text>
                <Text style={styles.vehicleVal}>
                  {formatCurrencySmart(v.perfilMsrp)}
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
  cpkDisplay: {
    gap: 6,
    marginTop: spacing.xs,
  },
  cpkTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.03)',
  },
  tableColLabel: {
    fontSize: 10,
    color: colors.text.secondary,
  },
  tableColVal: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: colors.text.primary,
  },
  totalCpkCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.sm,
    padding: spacing.sm,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  totalCpkLabel: {
    fontSize: 10,
    color: colors.text.secondary,
  },
  totalCpkValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.warning.main,
    marginTop: 2,
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
  savingsBox: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
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
    color: colors.success.main,
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
  vehiclesList: {
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
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.03)',
  },
  vehicleId: {
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: colors.text.disabled,
    width: 60,
  },
  vehicleCategory: {
    fontSize: 10,
    color: colors.text.secondary,
    flex: 1,
  },
  vehicleVal: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: colors.text.primary,
    textAlign: 'right',
    width: 100,
  },
});
