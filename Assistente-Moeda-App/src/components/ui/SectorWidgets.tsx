import React, { useState } from 'react';
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
import { SMBAccountingWidgets } from '../sectors/SMBAccountingWidgets';

// ── 1. SMB & Accounting Widget ───────────────────────────────────────────────
export function SMBSectorWidget() {
  return <SMBAccountingWidgets />;
}

// ── 2. Real Estate Widget ────────────────────────────────────────────────────
export function RealEstateSectorWidget() {
  const [val, setVal] = useState('500000'); // Valor do Imóvel
  const [rent, setRent] = useState('2200'); // Aluguel Mensal
  const [fin, setFin] = useState('350000'); // Valor Financiado
  const [taxa, setTaxa] = useState('9.5'); // Taxa de Juros Anual (%)
  const [prazo, setPrazo] = useState('360'); // Prazo (meses)

  const valNum = parseFloat(val) || 0;
  const rentNum = parseFloat(rent) || 0;
  const finNum = parseFloat(fin) || 0;
  const taxaAnual = parseFloat(taxa) || 0;
  const prazoMeses = parseFloat(prazo) || 0;

  // Rental Yield & Cap Rate
  const rentalYield = valNum > 0 ? (rentNum / valNum) * 100 : 0;
  const capRate = valNum > 0 ? ((rentNum * 12) / valNum) * 100 : 0;

  // SAC vs Price simulation (first installment)
  const taxaMensal = Math.pow(1 + taxaAnual / 100, 1 / 12) - 1;
  
  // Price installment (PMT = PV * [i(1+i)^n] / [(1+i)^n - 1])
  const priceInstallment = taxaMensal > 0 && prazoMeses > 0
    ? (finNum * (taxaMensal * Math.pow(1 + taxaMensal, prazoMeses))) / (Math.pow(1 + taxaMensal, prazoMeses) - 1)
    : 0;

  // SAC installment (A = PV/n, J = PV * i, PMT = A + J)
  const sacAmortization = prazoMeses > 0 ? finNum / prazoMeses : 0;
  const sacJuros = finNum * taxaMensal;
  const sacFirstInstallment = sacAmortization + sacJuros;

  return (
    <View style={styles.card}>
      <Text style={styles.cardHeader}>🏢 Setor: Imobiliário & Incorporação</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🏠 Indicadores de Aluguel</Text>
        <View style={styles.twoInputs}>
          <View style={[styles.inputBox, { flex: 1 }]}>
            <Text style={styles.inputLabel}>Valor Imóvel (R$)</Text>
            <TextInput
              style={styles.input}
              value={val}
              onChangeText={setVal}
              keyboardType="numeric"
              placeholderTextColor={colors.text.disabled}
            />
          </View>
          <View style={[styles.inputBox, { flex: 1 }]}>
            <Text style={styles.inputLabel}>Aluguel (R$ / mês)</Text>
            <TextInput
              style={styles.input}
              value={rent}
              onChangeText={setRent}
              keyboardType="numeric"
              placeholderTextColor={colors.text.disabled}
            />
          </View>
        </View>

        <View style={styles.rowGrid}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Rental Yield (Mensal)</Text>
            <Text style={[styles.metricValue, { color: colors.success.main }]}>
              {rentalYield.toFixed(2)}%
            </Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Cap Rate (Anual)</Text>
            <Text style={[styles.metricValue, { color: colors.success.main }]}>
              {capRate.toFixed(2)}%
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📉 Simulação de Financiamento (1ª Parcela)</Text>
        <View style={styles.inputGrid}>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Financiado (R$)</Text>
            <TextInput
              style={styles.input}
              value={fin}
              onChangeText={setFin}
              keyboardType="numeric"
              placeholderTextColor={colors.text.disabled}
            />
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Juros Anual (%)</Text>
            <TextInput
              style={styles.input}
              value={taxa}
              onChangeText={setTaxa}
              keyboardType="numeric"
              placeholderTextColor={colors.text.disabled}
            />
          </View>
          <View style={[styles.inputBox, { flex: 2 }]}>
            <Text style={styles.inputLabel}>Prazo (Meses)</Text>
            <TextInput
              style={styles.input}
              value={prazo}
              onChangeText={setPrazo}
              keyboardType="numeric"
              placeholderTextColor={colors.text.disabled}
            />
          </View>
        </View>

        <View style={styles.rowGrid}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Price (Tabela Price)</Text>
            <Text style={[styles.metricValue, { color: colors.info.main }]}>
              {formatCurrencySmart(priceInstallment)}
            </Text>
            <Text style={styles.metricSub}>Parcelas fixas</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>SAC (Tabela SAC)</Text>
            <Text style={[styles.metricValue, { color: colors.info.main }]}>
              {formatCurrencySmart(sacFirstInstallment)}
            </Text>
            <Text style={styles.metricSub}>Parcelas decrescentes</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// ── 3. Vehicles & Fleet Widget ───────────────────────────────────────────────
export function VehiclesSectorWidget() {
  const [dist, setDist] = useState('1500'); // Km rodados por mês
  const [comb, setComb] = useState('650'); // Gasto combustível (R$)
  const [maint, setMaint] = useState('200'); // Gasto manutenção (R$)
  const [depr, setDepr] = useState('400'); // Depreciação + Seguro (R$)

  const distNum = parseFloat(dist) || 0;
  const combNum = parseFloat(comb) || 0;
  const maintNum = parseFloat(maint) || 0;
  const deprNum = parseFloat(depr) || 0;

  // CPK: (combustível + manutenção + depreciação) / km
  const totalCost = combNum + maintNum + deprNum;
  const cpk = distNum > 0 ? totalCost / distNum : 0;
  const tco = totalCost;

  return (
    <View style={styles.card}>
      <Text style={styles.cardHeader}>🚗 Setor: Frotas, Veículos & TCO</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📊 Custo Operacional do Veículo</Text>
        
        <View style={styles.inputGrid}>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Distância (KM/mês)</Text>
            <TextInput
              style={styles.input}
              value={dist}
              onChangeText={setDist}
              keyboardType="numeric"
              placeholderTextColor={colors.text.disabled}
            />
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Combustível (R$/mês)</Text>
            <TextInput
              style={styles.input}
              value={comb}
              onChangeText={setComb}
              keyboardType="numeric"
              placeholderTextColor={colors.text.disabled}
            />
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Manutenção (R$/mês)</Text>
            <TextInput
              style={styles.input}
              value={maint}
              onChangeText={setMaint}
              keyboardType="numeric"
              placeholderTextColor={colors.text.disabled}
            />
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Custos Fixos (R$/mês)</Text>
            <TextInput
              style={styles.input}
              value={depr}
              onChangeText={setDepr}
              keyboardType="numeric"
              placeholderTextColor={colors.text.disabled}
            />
          </View>
        </View>

        <View style={styles.rowGrid}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>CPK (Custo por KM)</Text>
            <Text style={[styles.metricValue, { color: colors.warning.main }]}>
              {formatCurrencySmart(cpk)}/km
            </Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>TCO (Custo Mensal)</Text>
            <Text style={[styles.metricValue, { color: colors.danger.main }]}>
              {formatCurrencySmart(tco)}/mês
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔧 Previsão de Manutenção Preventiva</Text>
        <Text style={styles.metricSub}>
          Recomenda-se reservar {formatCurrencySmart(distNum * 0.12)} para fundos de amortecimento/manutenção futura (R$ 0,12 por km).
        </Text>
      </View>
    </View>
  );
}

// ── 4. Legal & Taxes Widget ──────────────────────────────────────────────────
export function LegalTaxesSectorWidget() {
  const [faturamento, setFaturamento] = useState('25000'); // Faturamento Mensal (R$)
  const [folha, setFolha] = useState('7500'); // Folha de pagamento / Pro-Labore (R$)

  const fatNum = parseFloat(faturamento) || 0;
  const folhaNum = parseFloat(folha) || 0;

  // Fator R = Folha de Salários / Faturamento Bruto
  const fatorR = fatNum > 0 ? (folhaNum / fatNum) * 100 : 0;
  const isAnexoIII = fatorR >= 28;

  // Simples Nacional tax estimates
  const taxAnexoIII = fatNum * 0.06; // 6% Anexo III
  const taxAnexoV = fatNum * 0.155; // 15.5% Anexo V
  const taxCurrent = isAnexoIII ? taxAnexoIII : taxAnexoV;

  return (
    <View style={styles.card}>
      <Text style={styles.cardHeader}>⚖️ Setor: Fiscal, Tributário & Fator R</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⚡ Otimizador do Fator R</Text>
        <Text style={styles.label}>O Fator R enquadra prestadores de serviços de TI/Consultoria no Anexo III:</Text>

        <View style={styles.twoInputs}>
          <View style={[styles.inputBox, { flex: 1 }]}>
            <Text style={styles.inputLabel}>Faturamento Mensal (R$)</Text>
            <TextInput
              style={styles.input}
              value={faturamento}
              onChangeText={setFaturamento}
              keyboardType="numeric"
              placeholderTextColor={colors.text.disabled}
            />
          </View>
          <View style={[styles.inputBox, { flex: 1 }]}>
            <Text style={styles.inputLabel}>Folha/Pró-Labore (R$)</Text>
            <TextInput
              style={styles.input}
              value={folha}
              onChangeText={setFolha}
              keyboardType="numeric"
              placeholderTextColor={colors.text.disabled}
            />
          </View>
        </View>

        <View style={styles.resultBox}>
          <Text style={styles.resultLabel}>Seu Fator R:</Text>
          <Text style={[styles.resultValue, { color: isAnexoIII ? colors.success.main : colors.warning.main }]}>
            {fatorR.toFixed(1)}%
          </Text>
          <Text style={[styles.badgeText, { color: isAnexoIII ? colors.success.main : colors.warning.main }]}>
            {isAnexoIII ? '✅ ANEXO III (Alíquota inicial ~6%)' : '⚠️ ANEXO V (Alíquota inicial ~15.5%)'}
          </Text>
          <Text style={styles.resultSub}>
            {isAnexoIII 
              ? 'Ótimo! Seu custo tributário estimado de Simples Nacional é menor.'
              : `Aumentar o Pró-Labore em ${formatCurrencySmart(fatNum * 0.28 - folhaNum)} ajuda a alcançar o benefício.`}
          </Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.rowGrid}>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>Imposto Estimado</Text>
          <Text style={[styles.metricValue, { color: colors.danger.main }]}>
            {formatCurrencySmart(taxCurrent)}
          </Text>
          <Text style={styles.metricSub}>No enquadramento atual</Text>
        </View>

        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>Economia Potencial</Text>
          <Text style={[styles.metricValue, { color: colors.success.main }]}>
            {formatCurrencySmart(taxAnexoV - taxAnexoIII)}
          </Text>
          <Text style={styles.metricSub}>Se otimizado para o Anexo III</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  cardHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.accent.purpleLight || '#e9d5ff',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    paddingBottom: spacing.sm,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.primary,
  },
  label: {
    fontSize: 11,
    color: colors.text.secondary,
  },
  twoInputs: {
    flexDirection: 'row',
    gap: spacing.md,
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
    color: colors.text.disabled,
  },
  input: {
    backgroundColor: colors.background.primary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.sm,
    color: colors.text.primary,
    fontSize: 11,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    minHeight: 30,
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
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    marginVertical: 2,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  rowGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  metricItem: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    padding: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  metricLabel: {
    fontSize: 9,
    color: colors.text.secondary,
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  metricSub: {
    fontSize: 9,
    color: colors.text.disabled,
  },
});
