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
  calculateExpectedUtilityOfCompliance,
  evaluateHIPAAStorage,
  calculateSubpoenaVulnerability,
  scanLocalAuditAnomalies,
} from '../../utils/privacyMath';
import { parsePrivacyCSV, OffshoreAccount } from '../../utils/privacyParser';

const SAMPLE_PRIVACY_CSV = `id_conta,nome_instituicao,saldo_cents,jurisdicao_pais,declaracao_fbar,declaracao_fatca,possui_cripto,possui_trust
OFF01,Swissquote Bank,1200000,Suiça,true,true,false,false
OFF02,Cayman Trust Corp,8500000,Cayman,false,false,true,true`;

export function FinancialPrivacyWidgets() {
  // ── Subpoena Shield State ──
  const [storageType, setStorageType] = useState<'cloud_us' | 'cloud_eu' | 'swiss' | 'local_opfs'>('local_opfs');

  // ── HIPAA Compliance State ──
  const [isLocal, setIsLocal] = useState(true);
  const [isZeroCloud, setIsZeroCloud] = useState(true);
  const [hasAes, setHasAes] = useState(true);

  // ── Tax Admin 3.0 Pre-Checker State ──
  const [monthlyInc, setMonthlyInc] = useState('30000');
  const [monthlyExp, setMonthlyExp] = useState('18000');
  const [inv1, setInv1] = useState('5000');
  const [inv2, setInv2] = useState('2500');
  const [inv3, setInv3] = useState('4200');
  const [invGaps, setInvGaps] = useState('0');

  // ── Offshore Account CSV State ──
  const [csvText, setCsvText] = useState(SAMPLE_PRIVACY_CSV);
  const [parsedAccounts, setParsedAccounts] = useState(() => parsePrivacyCSV(SAMPLE_PRIVACY_CSV));

  // ── 1. Subpoena Shield Calculations ──
  const shieldResult = useMemo(() => {
    return calculateSubpoenaVulnerability(storageType);
  }, [storageType]);

  // ── 2. HIPAA Compliance Calculations ──
  const hipaaResult = useMemo(() => {
    return evaluateHIPAAStorage(isLocal, isZeroCloud, hasAes);
  }, [isLocal, isZeroCloud, hasAes]);

  // ── 3. Tax Admin 3.0 local audit scanner ──
  const auditScannerResult = useMemo(() => {
    const inc = parseFloat(monthlyInc) || 0;
    const exp = parseFloat(monthlyExp) || 0;
    const i1 = parseFloat(inv1) || 0;
    const i2 = parseFloat(inv2) || 0;
    const i3 = parseFloat(inv3) || 0;
    const gaps = parseInt(invGaps, 10) || 0;

    // Fake invoice numbers list based on gaps count
    const invoiceNums = [1001, 1002, 1002 + gaps + 1];

    return scanLocalAuditAnomalies([i1, i2, i3], inc, exp, invoiceNums);
  }, [monthlyInc, monthlyExp, inv1, inv2, inv3, invGaps]);

  const handleParsePrivacy = () => {
    setParsedAccounts(parsePrivacyCSV(csvText));
  };

  return (
    <ScrollView style={styles.container}>
      {/* 🛡️ 1. Subpoena Shield & Cloud Vulnerability Meter */}
      <View style={styles.widgetCard}>
        <Text style={styles.widgetHeader}>🛡️ Subpoena Shield & Vulnerômetro de Intimações</Text>
        <Text style={styles.widgetDescription}>
          Avalie o risco de seus registros financeiros e bancários serem acessados em segredo por agências fiscalizadoras federais através de ordens de silêncio (gag orders) na nuvem.
        </Text>

        <View style={styles.segmentedControl}>
          <Pressable
            style={[styles.segmentBtn, storageType === 'cloud_us' && styles.segmentBtnActive]}
            onPress={() => setStorageType('cloud_us')}
          >
            <Text style={styles.segmentText}>Nuvem EUA</Text>
          </Pressable>
          <Pressable
            style={[styles.segmentBtn, storageType === 'cloud_eu' && styles.segmentBtnActive]}
            onPress={() => setStorageType('cloud_eu')}
          >
            <Text style={styles.segmentText}>Nuvem Europa</Text>
          </Pressable>
          <Pressable
            style={[styles.segmentBtn, storageType === 'swiss' && styles.segmentBtnActive]}
            onPress={() => setStorageType('swiss')}
          >
            <Text style={styles.segmentText}>Suiça Cloud</Text>
          </Pressable>
          <Pressable
            style={[styles.segmentBtn, storageType === 'local_opfs' && styles.segmentBtnActive]}
            onPress={() => setStorageType('local_opfs')}
          >
            <Text style={styles.segmentText}>OPFS Local</Text>
          </Pressable>
        </View>

        <View style={styles.shieldDisplay}>
          <View style={styles.gaugeRow}>
            <Text style={styles.gaugeLabel}>Escudo de Intimações:</Text>
            <Text
              style={[
                styles.gaugeValue,
                { color: shieldResult.shieldRating > 70 ? colors.success.main : colors.danger.main },
              ]}
            >
              {shieldResult.shieldRating}/100
            </Text>
          </View>
          <View style={styles.barWrapper}>
            <View
              style={[
                styles.barVisual,
                {
                  width: `${shieldResult.shieldRating}%`,
                  backgroundColor: shieldResult.shieldRating > 70 ? colors.success.main : colors.danger.main,
                },
              ]}
            />
          </View>
          <Text style={styles.gaugeSub}>
            Probabilidade de Ordem de Silêncio (Gag Order): {shieldResult.gagOrderProbability}%
          </Text>
          <View style={styles.tipBanner}>
            <Text style={styles.tipText}>{shieldResult.description}</Text>
          </View>
        </View>
      </View>

      {/* 🏥 2. HIPAA & ABA Rule 1.6 Compliance Badge */}
      <View style={styles.widgetCard}>
        <Text style={styles.widgetHeader}>🏥 Conformidade HIPAA & Código de Ética ABA 1.6</Text>
        <Text style={styles.widgetDescription}>
          Verificador atuarial de segurança para clínicas de saúde e escritórios jurídicos. O armazenamento local qualifica o sistema na isenção automática de BAA ("Conduit Exception").
        </Text>

        <View style={styles.checklist}>
          <Pressable style={styles.checkRow} onPress={() => setIsLocal(!isLocal)}>
            <Text style={styles.checkIcon}>{isLocal ? '🟩' : '⬛'}</Text>
            <Text style={styles.checkText}>Armazenado exclusivamente em Hardware Local</Text>
          </Pressable>
          <Pressable style={styles.checkRow} onPress={() => setIsZeroCloud(!isZeroCloud)}>
            <Text style={styles.checkIcon}>{isZeroCloud ? '🟩' : '⬛'}</Text>
            <Text style={styles.checkText}>Zero Retenção Temporária de Dados na Nuvem</Text>
          </Pressable>
          <Pressable style={styles.checkRow} onPress={() => setHasAes(!hasAes)}>
            <Text style={styles.checkIcon}>{hasAes ? '🟩' : '⬛'}</Text>
            <Text style={styles.checkText}>Criptografia Local Simétrica Ativa (AES-256)</Text>
          </Pressable>
        </View>

        <View style={styles.badgeCard}>
          <View style={styles.badgeHeaderRow}>
            <Text style={styles.badgeTitle}>Status HIPAA / ABA:</Text>
            <View
              style={[
                styles.badgeStatus,
                {
                  backgroundColor:
                    hipaaResult.complianceBadge === 'EXEMPT'
                      ? 'rgba(16, 185, 129, 0.15)'
                      : hipaaResult.complianceBadge === 'COMPLIANT'
                      ? 'rgba(59, 130, 246, 0.15)'
                      : 'rgba(239, 68, 68, 0.15)',
                  borderColor:
                    hipaaResult.complianceBadge === 'EXEMPT'
                      ? colors.success.main
                      : hipaaResult.complianceBadge === 'COMPLIANT'
                      ? colors.info.main
                      : colors.danger.main,
                },
              ]}
            >
              <Text
                style={[
                  styles.badgeTextSymbol,
                  {
                    color:
                      hipaaResult.complianceBadge === 'EXEMPT'
                        ? colors.success.main
                        : hipaaResult.complianceBadge === 'COMPLIANT'
                        ? colors.info.main
                        : colors.danger.main,
                  },
                ]}
              >
                {hipaaResult.complianceBadge}
              </Text>
            </View>
          </View>
          <Text style={styles.badgeRating}>Avaliação de Segurança: {hipaaResult.complianceRating}%</Text>
          <Text style={styles.badgeActionText}>{hipaaResult.remedyAction}</Text>
        </View>
      </View>

      {/* 🔎 3. Algorithmic Audit (Tax Admin 3.0) Local Pre-Checker */}
      <View style={styles.widgetCard}>
        <Text style={styles.widgetHeader}>🔎 Pré-verificador Local de Malha Fina (Fisco 3.0)</Text>
        <Text style={styles.widgetDescription}>
          Simule os cruzamentos estatísticos dos sistemas de inteligência fiscal modernos (arredondamentos, lacunas sequenciais e margem despesa/receita) de forma confidencial em seu browser.
        </Text>

        <View style={styles.inputGrid}>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Renda Declarada (R$)</Text>
            <TextInput
              style={styles.textInput}
              value={monthlyInc}
              onChangeText={setMonthlyInc}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Despesas Declaradas (R$)</Text>
            <TextInput
              style={styles.textInput}
              value={monthlyExp}
              onChangeText={setMonthlyExp}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Fatura 1 (R$)</Text>
            <TextInput
              style={styles.textInput}
              value={inv1}
              onChangeText={setInv1}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Fatura 2 (R$)</Text>
            <TextInput
              style={styles.textInput}
              value={inv2}
              onChangeText={setInv2}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Fatura 3 (R$)</Text>
            <TextInput
              style={styles.textInput}
              value={inv3}
              onChangeText={setInv3}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Lacunas de Sequencial (Gaps)</Text>
            <TextInput
              style={styles.textInput}
              value={invGaps}
              onChangeText={setInvGaps}
              keyboardType="numeric"
            />
          </View>
        </View>

        <View style={styles.auditResultBox}>
          <View style={styles.auditHeader}>
            <Text style={styles.auditTitle}>Risco de Auditoria Fiscal:</Text>
            <Text
              style={[
                styles.auditRiskVal,
                {
                  color:
                    auditScannerResult.auditTriggerRisk === 'ALTO'
                      ? colors.danger.main
                      : auditScannerResult.auditTriggerRisk === 'MÉDIO'
                      ? colors.warning.main
                      : colors.success.main,
                },
              ]}
            >
              {auditScannerResult.auditTriggerRisk}
            </Text>
          </View>

          <View style={styles.auditDetails}>
            <Text style={styles.detailLine}>
              Notas fiscais redondas/estatísticas: {auditScannerResult.roundInvoicePercent.toFixed(0)}%
            </Text>
            <Text style={styles.detailLine}>
              Proporção despesa/faturamento: {auditScannerResult.expenseToIncomeRatio.toFixed(0)}%
            </Text>
          </View>

          <View style={styles.tipsList}>
            {auditScannerResult.remedyTips.map((tip, index) => (
              <Text key={index} style={styles.tipItem}>
                {tip}
              </Text>
            ))}
          </View>
        </View>
      </View>

      {/* 💼 4. Offshore & Trust Account Manager */}
      <View style={styles.widgetCard}>
        <Text style={styles.widgetHeader}>💼 Monitor Confidencial de Ativos Offshore & Trusts</Text>
        <Text style={styles.widgetDescription}>
          Gerencie e fiscalize a conformidade de contas em jurisdições externas com alertas automatizados de declaração FATCA (Modelo 8938) e FBAR (FinCEN).
        </Text>

        <TextInput
          style={styles.codeTextarea}
          multiline
          value={csvText}
          onChangeText={setCsvText}
          placeholder="id_conta,nome_instituicao,saldo_cents..."
          placeholderTextColor={colors.text.disabled}
        />

        <View style={styles.actionRow}>
          <Pressable style={styles.actionBtn} onPress={handleParsePrivacy}>
            <Text style={styles.actionBtnText}>🔄 Reconciliar Contas</Text>
          </Pressable>
          <Pressable
            style={[styles.actionBtn, { backgroundColor: colors.background.tertiary }]}
            onPress={() => {
              setCsvText(SAMPLE_PRIVACY_CSV);
              setParsedAccounts(parsePrivacyCSV(SAMPLE_PRIVACY_CSV));
            }}
          >
            <Text style={styles.actionBtnText}>Restaurar Exemplo</Text>
          </Pressable>
        </View>

        {parsedAccounts.accounts.length > 0 && (
          <View style={styles.accountsList}>
            <Text style={styles.sectionTitle}>Portfólio Externo Auditado:</Text>
            {parsedAccounts.accounts.map((acc) => {
              const usdVal = acc.saldoCents / 100;
              const fbarRequired = usdVal > 10000 && !acc.declaracaoFbar;
              const fatcaRequired = acc.possuiTrust && !acc.declaracaoFatca;

              return (
                <View key={acc.idConta} style={styles.accountRow}>
                  <View style={styles.accMeta}>
                    <Text style={styles.accName}>{acc.nomeInstituicao}</Text>
                    <Text style={styles.accRegion}>
                      {acc.jurisdicaoPais} {acc.possuiTrust ? '(Trust)' : ''}
                    </Text>
                  </View>

                  <View style={styles.accFin}>
                    <Text style={styles.accVal}>{formatCurrencySmart(usdVal)}</Text>
                    {fbarRequired && (
                      <Text style={[styles.accWarning, { color: colors.danger.main }]}>
                        ⚠️ FBAR Obrigatório
                      </Text>
                    )}
                    {fatcaRequired && (
                      <Text style={[styles.accWarning, { color: colors.warning.main }]}>
                        ⚠️ FATCA (Mod. 8938)
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
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
  shieldDisplay: {
    gap: 6,
  },
  gaugeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gaugeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  gaugeValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  barWrapper: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  barVisual: {
    height: '100%',
  },
  gaugeSub: {
    fontSize: 9,
    color: colors.text.disabled,
  },
  tipBanner: {
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    borderColor: 'rgba(59, 130, 246, 0.25)',
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: 4,
  },
  tipText: {
    fontSize: 10,
    color: colors.text.secondary,
    lineHeight: 13,
  },
  checklist: {
    gap: spacing.xs,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 2,
  },
  checkIcon: {
    fontSize: 12,
  },
  checkText: {
    fontSize: 11,
    color: colors.text.secondary,
  },
  badgeCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.sm,
    padding: spacing.md,
    gap: 6,
  },
  badgeHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badgeTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  badgeStatus: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  badgeTextSymbol: {
    fontSize: 9,
    fontWeight: '700',
  },
  badgeRating: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.text.primary,
  },
  badgeActionText: {
    fontSize: 9,
    color: colors.text.disabled,
    lineHeight: 12,
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
  auditResultBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing.md,
    gap: 6,
  },
  auditHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  auditTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  auditRiskVal: {
    fontSize: 13,
    fontWeight: '700',
  },
  auditDetails: {
    gap: 2,
  },
  detailLine: {
    fontSize: 9,
    color: colors.text.disabled,
  },
  tipsList: {
    gap: 4,
    marginTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    paddingTop: spacing.xs,
  },
  tipItem: {
    fontSize: 9,
    color: colors.text.secondary,
    lineHeight: 12,
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
  accountsList: {
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
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.03)',
  },
  accMeta: {
    gap: 2,
    flex: 1,
  },
  accName: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.primary,
  },
  accRegion: {
    fontSize: 9,
    color: colors.text.disabled,
  },
  accFin: {
    alignItems: 'flex-end',
    width: 140,
    gap: 2,
  },
  accVal: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: colors.text.primary,
  },
  accWarning: {
    fontSize: 8,
    fontWeight: '700',
  },
});
