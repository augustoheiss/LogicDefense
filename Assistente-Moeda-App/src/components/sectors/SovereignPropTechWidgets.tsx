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
  calculateTurnoverCost,
  calculateDownsideOutperformance,
  auditLLCCorporateVeil,
  verifyLocalKeyDerivationStatus,
} from '../../utils/sovereignMath';
import { parseSovereignCSV, SovereignProperty } from '../../utils/sovereignParser';

const SAMPLE_SOVEREIGN_CSV = `llc_name,property_id,monthly_rent,vacancy_months,rehab_exp,marketing_exp,legal_exp,fixed_carrying_exp
Holdings LLC,PROP01,2500,2,1500,2500,500,400
Sovereign Trust,PROP02,4000,4,3000,4000,1000,600`;

export function SovereignPropTechWidgets() {
  // ── Turnover Simulator State ──
  const [rent, setRent] = useState('2500');
  const [vacancy, setVacancy] = useState('3');
  const [rehab, setRehab] = useState('1800');
  const [marketing, setMarketing] = useState('2500');
  const [legal, setLegal] = useState('500');
  const [carrying, setCarrying] = useState('400');

  // ── Downside Frame State ──
  const [portfolioRet, setPortfolioRet] = useState('-8');
  const [benchmarkRet, setBenchmarkRet] = useState('-12');

  // ── ZK Vault State ──
  const [passphrase, setPassphrase] = useState('');

  // ── Commingling Auditor State ──
  const [txFrom, setTxFrom] = useState('Holdings LLC');
  const [txTo, setTxTo] = useState('Pessoal (Sócio)');
  const [txAmt, setTxAmt] = useState('1500');
  const [txDesc, setTxDesc] = useState('Retirada pessoal para despesa de condomínio própria');
  const [manualTxs, setManualTxs] = useState<
    { fromEntity: string; toEntity: string; amountInCents: number; description: string }[]
  >([
    {
      fromEntity: 'Alpha LLC',
      toEntity: 'Beta Trust',
      amountInCents: 500000, // R$ 5.000,00
      description: 'Transferência direta de caixa operacional sem contrato',
    },
  ]);

  // ── CSV Importer State ──
  const [csvText, setCsvText] = useState(SAMPLE_SOVEREIGN_CSV);
  const [parsedSovereign, setParsedSovereign] = useState(() =>
    parseSovereignCSV(SAMPLE_SOVEREIGN_CSV)
  );

  // ── 1. Turnover Leak Calculations ──
  const turnoverResult = useMemo(() => {
    const r = parseFloat(rent) || 0;
    const v = parseFloat(vacancy) || 0;
    const reh = parseFloat(rehab) || 0;
    const mkt = parseFloat(marketing) || 0;
    const leg = parseFloat(legal) || 0;
    const car = parseFloat(carrying) || 0;

    return calculateTurnoverCost(r, v, reh, mkt, leg, car);
  }, [rent, vacancy, rehab, marketing, legal, carrying]);

  // ── 2. Downside Outperformance Calculations ──
  const downsideResult = useMemo(() => {
    const port = parseFloat(portfolioRet) || 0;
    const bench = parseFloat(benchmarkRet) || 0;

    return calculateDownsideOutperformance(port, bench);
  }, [portfolioRet, benchmarkRet]);

  // ── 3. ZK Key Derivation status ──
  const keyStatus = useMemo(() => {
    return verifyLocalKeyDerivationStatus(passphrase);
  }, [passphrase]);

  // ── 4. LLC Corporate Veil Auditor ──
  const auditResults = useMemo(() => {
    return auditLLCCorporateVeil(manualTxs);
  }, [manualTxs]);

  const handleParseSovereignCSV = () => {
    const res = parseSovereignCSV(csvText);
    setParsedSovereign(res);
    if (res.records.length > 0) {
      const rec = res.records[0];
      setRent(String(rec.monthlyRent));
      setVacancy(String(rec.vacancyMonths));
      setRehab(String(rec.rehabExp));
      setMarketing(String(rec.marketingExp));
      setLegal(String(rec.legalExp));
      setCarrying(String(rec.fixedCarryingExp));
    }
  };

  const handleAddTx = () => {
    const amt = parseFloat(txAmt) || 0;
    if (amt <= 0 || !txFrom || !txTo) return;
    setManualTxs((prev) => [
      ...prev,
      {
        fromEntity: txFrom,
        toEntity: txTo,
        amountInCents: amt * 100,
        description: txDesc || 'Transferência',
      },
    ]);
    setTxAmt('1000');
    setTxDesc('');
  };

  return (
    <ScrollView style={styles.container}>
      {/* 💸 1. Tenant Turnover Leak Calculator */}
      <View style={styles.widgetCard}>
        <Text style={styles.widgetHeader}>💸 Vazamento Contábil de Rotatividade de Inquilinos</Text>
        <Text style={styles.widgetDescription}>
          Meça as perdas reais sofridas entre a saída de um inquilino e a absorção/reabilitação do imóvel.
        </Text>

        <View style={styles.inputGrid}>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Aluguel Mensal (R$)</Text>
            <TextInput
              style={styles.textInput}
              value={rent}
              onChangeText={setRent}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Meses de Vacância</Text>
            <TextInput
              style={styles.textInput}
              value={vacancy}
              onChangeText={setVacancy}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Custo Reabilitação (R$)</Text>
            <TextInput
              style={styles.textInput}
              value={rehab}
              onChangeText={setRehab}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Marketing / Corretor</Text>
            <TextInput
              style={styles.textInput}
              value={marketing}
              onChangeText={setMarketing}
              keyboardType="numeric"
            />
          </View>
        </View>

        <View style={styles.inputGrid}>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Custos Admin / Jurídicos</Text>
            <TextInput
              style={styles.textInput}
              value={legal}
              onChangeText={setLegal}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Fixos Condomínio/IPTU (mês)</Text>
            <TextInput
              style={styles.textInput}
              value={carrying}
              onChangeText={setCarrying}
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* Visual Progress Leak Bar */}
        <View style={styles.leakVisual}>
          <Text style={styles.leakLabel}>Distribuição do Custo de Rotatividade:</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressSegment, { flex: Math.max(1, turnoverResult.vacaturaCost), backgroundColor: '#ef4444' }]} />
            <View style={[styles.progressSegment, { flex: Math.max(1, turnoverResult.carryingCost), backgroundColor: '#eab308' }]} />
            <View style={[styles.progressSegment, { flex: Math.max(1, parseFloat(rehab) || 0), backgroundColor: '#a855f7' }]} />
            <View style={[styles.progressSegment, { flex: Math.max(1, (parseFloat(marketing) || 0) + (parseFloat(legal) || 0)), backgroundColor: '#3b82f6' }]} />
          </View>

          <View style={styles.legendsRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#ef4444' }]} />
              <Text style={styles.legendText}>Perda Aluguel: {formatCurrencySmart(turnoverResult.vacaturaCost)}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#eab308' }]} />
              <Text style={styles.legendText}>Carrying Cost: {formatCurrencySmart(turnoverResult.carryingCost)}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#a855f7' }]} />
              <Text style={styles.legendText}>Reabilitação: {formatCurrencySmart(parseFloat(rehab) || 0)}</Text>
            </View>
          </View>

          <View style={styles.totalLeakCard}>
            <Text style={styles.totalLeakTitle}>Custo Total da Rotatividade (Crotatividade):</Text>
            <Text style={styles.totalLeakVal}>{formatCurrencySmart(turnoverResult.totalCost)}</Text>
            <Text style={styles.totalLeakSub}>
              ⚠️ Equivale a {turnoverResult.percentageOfAnnualRent.toFixed(1)}% do rendimento anual esperado da unidade.
            </Text>
          </View>
        </View>
      </View>

      {/* 🔒 2. LLC Corporate Veil & ZK Vault Monitor */}
      <View style={styles.widgetCard}>
        <Text style={styles.widgetHeader}>🔒 Cofre Criptográfico Zero-Knowledge & Auditor de LLCs</Text>
        <Text style={styles.widgetDescription}>
          Garante a privacidade ponta a ponta derivando chaves simétricas localmente. Também audita a segregação de contas corporativas de holdings.
        </Text>

        {/* Vault passphrase input */}
        <View style={styles.vaultSection}>
          <Text style={styles.inputLabel}>Derivar Chave Criptográfica Local (Frase-Passe)</Text>
          <TextInput
            style={styles.textInput}
            value={passphrase}
            onChangeText={setPassphrase}
            placeholder="Mínimo de 8 caracteres"
            secureTextEntry
            placeholderTextColor={colors.text.disabled}
          />
          {keyStatus.derived ? (
            <View style={styles.vaultBadgeActive}>
              <Text style={styles.vaultBadgeText}>
                🔐 Chave {keyStatus.algorithm} Derivada com 310.000 iterações PBKDF2. Fingerprint:{' '}
                {keyStatus.keyFingerprint}
              </Text>
            </View>
          ) : (
            <View style={styles.vaultBadgeInactive}>
              <Text style={styles.vaultBadgeText}>
                ❌ Nenhuma chave local ativa. Dados descriptografados apenas em memória temporária.
              </Text>
            </View>
          )}
        </View>

        <View style={styles.divider} />

        {/* Corporate veil commingling checker */}
        <View style={styles.auditSection}>
          <Text style={styles.sectionTitle}>⚖️ Auditor de Proteção Patrimonial (Corporate Veil)</Text>
          <Text style={styles.widgetDescription}>
            Identifique transações inter-holdings sem contratos legais formais que colocam em risco sua responsabilidade limitada.
          </Text>

          {/* Add simulated transaction */}
          <View style={styles.addTxBox}>
            <View style={styles.rowGrid}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>De (Entidade)</Text>
                <TextInput style={styles.textInput} value={txFrom} onChangeText={setTxFrom} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Para (Entidade)</Text>
                <TextInput style={styles.textInput} value={txTo} onChangeText={setTxTo} />
              </View>
            </View>
            <View style={styles.rowGrid}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Valor (R$)</Text>
                <TextInput style={styles.textInput} value={txAmt} onChangeText={setTxAmt} />
              </View>
              <View style={{ flex: 2 }}>
                <Text style={styles.inputLabel}>Descrição da Transação</Text>
                <TextInput style={styles.textInput} value={txDesc} onChangeText={setTxDesc} />
              </View>
            </View>
            <Pressable style={styles.addTxBtn} onPress={handleAddTx}>
              <Text style={styles.addTxBtnText}>➕ Auditar Transação</Text>
            </Pressable>
          </View>

          {/* Audited issues */}
          <View style={styles.auditReport}>
            {auditResults.map((issue, idx) => (
              <View
                key={idx}
                style={[
                  styles.issueCard,
                  issue.severity === 'high' ? styles.issueCardDanger : styles.issueCardSuccess,
                ]}
              >
                <Text
                  style={[
                    styles.issueText,
                    issue.severity === 'high' ? { color: '#f87171' } : { color: colors.success.main },
                  ]}
                >
                  {issue.description}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* 📊 3. Downside Moment Relative Benchmark Switch */}
      <View style={styles.widgetCard}>
        <Text style={styles.widgetHeader}>📉 Performance Relativa sob Queda (Downside Outperformance)</Text>
        <Text style={styles.widgetDescription}>
          Em fases corretivas do mercado de incorporação, isole o ruído visual enquadrando o desempenho relativo do seu portfólio.
        </Text>

        <View style={styles.rowGrid}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.inputLabel}>Retorno da Carteira (%)</Text>
            <TextInput
              style={styles.textInput}
              value={portfolioRet}
              onChangeText={setPortfolioRet}
              keyboardType="numeric"
            />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.inputLabel}>Retorno do Benchmark (%)</Text>
            <TextInput
              style={styles.textInput}
              value={benchmarkRet}
              onChangeText={setBenchmarkRet}
              keyboardType="numeric"
            />
          </View>
        </View>

        <View
          style={[
            styles.outperformanceCard,
            downsideResult.isPositiveFrame ? styles.outperformanceCardSuccess : styles.outperformanceCardDefault,
          ]}
        >
          <Text style={styles.outperformanceTitle}>Outperformance Relativa (Δoutperformance):</Text>
          <Text
            style={[
              styles.outperformanceVal,
              { color: downsideResult.isPositiveFrame ? colors.success.main : colors.warning.main },
            ]}
          >
            {downsideResult.outperformance > 0 ? '+' : ''}
            {downsideResult.outperformance.toFixed(2)}%
          </Text>
          <Text style={styles.outperformanceFramed}>{downsideResult.framedText}</Text>
        </View>
      </View>

      {/* 🏢 4. CSV Importer for Sovereign Portfolios */}
      <View style={styles.widgetCard}>
        <Text style={styles.widgetHeader}>📥 Cadastro de LLCs e Vacâncias (CSV)</Text>
        <Text style={styles.widgetDescription}>
          Alimente a base de rotatividade e entidades de forma rápida em lote local.
        </Text>

        <TextInput
          style={styles.codeTextarea}
          multiline
          value={csvText}
          onChangeText={setCsvText}
          placeholder="llc_name,property_id,monthly_rent..."
          placeholderTextColor={colors.text.disabled}
        />

        <View style={styles.actionRow}>
          <Pressable style={styles.actionBtn} onPress={handleParseSovereignCSV}>
            <Text style={styles.actionBtnText}>🔄 Cadastrar Portfólio LLC</Text>
          </Pressable>
          <Pressable
            style={[styles.actionBtn, { backgroundColor: colors.background.tertiary }]}
            onPress={() => {
              setCsvText(SAMPLE_SOVEREIGN_CSV);
              setParsedSovereign(parseSovereignCSV(SAMPLE_SOVEREIGN_CSV));
            }}
          >
            <Text style={styles.actionBtnText}>Resetar CSV</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
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
  leakVisual: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  leakLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  progressBar: {
    height: 12,
    flexDirection: 'row',
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  progressSegment: {
    height: '100%',
  },
  legendsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 10,
    color: colors.text.disabled,
  },
  totalLeakCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.sm,
    padding: spacing.sm,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  totalLeakTitle: {
    fontSize: 10,
    color: colors.text.secondary,
  },
  totalLeakVal: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.danger.main,
    marginTop: 2,
  },
  totalLeakSub: {
    fontSize: 8,
    color: colors.text.disabled,
    marginTop: 2,
    textAlign: 'center',
  },
  vaultSection: {
    gap: spacing.sm,
  },
  vaultBadgeActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderColor: 'rgba(16, 185, 129, 0.25)',
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  vaultBadgeInactive: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderColor: 'rgba(239, 68, 68, 0.25)',
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  vaultBadgeText: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.text.primary,
    lineHeight: 13,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  auditSection: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.primary,
  },
  addTxBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: radius.sm,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
    gap: spacing.sm,
  },
  rowGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  addTxBtn: {
    backgroundColor: colors.accent.purple,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  addTxBtnText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.text.primary,
  },
  auditReport: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  issueCard: {
    padding: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  issueCardDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  issueCardSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  issueText: {
    fontSize: 10,
    lineHeight: 13,
  },
  outperformanceCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.sm,
    padding: spacing.sm,
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.xs,
  },
  outperformanceCardSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.03)',
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  outperformanceCardDefault: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  outperformanceTitle: {
    fontSize: 10,
    color: colors.text.secondary,
  },
  outperformanceVal: {
    fontSize: 16,
    fontWeight: '700',
  },
  outperformanceFramed: {
    fontSize: 9,
    color: colors.text.disabled,
    textAlign: 'center',
    marginTop: 2,
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
});
