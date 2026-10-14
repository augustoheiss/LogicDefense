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
import { LegalAuditWidgets } from '../sectors/LegalAuditWidgets';
import { RealEstateWidgets } from '../sectors/RealEstateWidgets';
import { SovereignPropTechWidgets } from '../sectors/SovereignPropTechWidgets';
import { VehicleFleetWidgets } from '../sectors/VehicleFleetWidgets';
import { VehicleCopywritingWidgets } from '../sectors/VehicleCopywritingWidgets';
import { TaxOptimizationWidgets } from '../sectors/TaxOptimizationWidgets';
import { FinancialPrivacyWidgets } from '../sectors/FinancialPrivacyWidgets';
import { PFMRetentionWidgets } from '../sectors/PFMRetentionWidgets';

import { useCoinDB } from '@/hooks/useCoinDB';

function LiveSectorBridgeBanner({ sectorKey, title }: { sectorKey: string; title: string }) {
  const db = useCoinDB();
  const m = db.metrics;
  const rowsCount = db.activeTable?.rows?.length || 0;
  const lastSync = (db.activeTable?.sectorParams as any)?.[`${sectorKey}_syncedAt`];

  const handlePersistSnapshot = () => {
    db.updateSectorParams({
      [`${sectorKey}_syncedAt`]: new Date().toISOString(),
      [`${sectorKey}_baseline`]: {
        monthlyRevenue: Math.round(m.globalMonthlyAvg * 100) / 100,
        monthlyExpense: Math.round(m.survivalMonthly * 100) / 100,
        netBalance: Math.round(m.netBalance * 100) / 100,
        portfolio: Math.round((m.investmentBalance || m.totalInvested) * 100) / 100,
      },
    });
  };

  return (
    <View style={bridgeStyles.banner}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={bridgeStyles.badge}>🔗 CONECTADO À PLANILHA ATIVA ({rowsCount} lançamentos)</Text>
        <Text style={bridgeStyles.title}>{title}</Text>
        <Text style={bridgeStyles.metricsLine}>
          Renda Mensal: {formatCurrencySmart(m.globalMonthlyAvg)} • Custo Mensal: {formatCurrencySmart(m.survivalMonthly)} • Saldo: {formatCurrencySmart(m.netBalance)}
        </Text>
        {lastSync && (
          <Text style={bridgeStyles.syncSub}>
            ✓ Parâmetros salvos no IndexedDB & CSV ({String(lastSync).slice(0, 10)})
          </Text>
        )}
      </View>
      <Pressable style={bridgeStyles.saveBtn} onPress={handlePersistSnapshot}>
        <Text style={bridgeStyles.saveBtnText}>💾 Salvar Base no CSV</Text>
      </Pressable>
    </View>
  );
}

const bridgeStyles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderWidth: 1,
    borderColor: colors.accent.purpleBorder,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  badge: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.accent.purple,
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.primary,
  },
  metricsLine: {
    fontSize: 11,
    color: colors.text.secondary,
  },
  syncSub: {
    fontSize: 10,
    color: colors.success.main,
    fontWeight: '600',
  },
  saveBtn: {
    backgroundColor: colors.accent.purple,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  saveBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
});

// ── 1. SMB & Accounting Widget ───────────────────────────────────────────────
export function SMBSectorWidget() {
  return (
    <View style={{ gap: spacing.sm }}>
      <LiveSectorBridgeBanner sectorKey="smb" title="Motor Contábil PME (DRP, Welford, CFaR & SPED)" />
      <SMBAccountingWidgets />
    </View>
  );
}

// ── 2. Real Estate Widget ────────────────────────────────────────────────────
export function RealEstateSectorWidget() {
  return (
    <View style={{ gap: spacing.md }}>
      <LiveSectorBridgeBanner sectorKey="realEstate" title="Motor Imobiliário & PropTech (SAC/PRICE, Cap Rate & FIIs)" />
      <RealEstateWidgets />
      <SovereignPropTechWidgets />
    </View>
  );
}

// ── 3. Vehicles & Fleet Widget ───────────────────────────────────────────────
export function VehiclesSectorWidget() {
  return (
    <View style={{ gap: spacing.md }}>
      <LiveSectorBridgeBanner sectorKey="vehicles" title="Motor de Frotas & Mobilidade (TCO, Depreciação & Custo/Km)" />
      <VehicleFleetWidgets />
      <VehicleCopywritingWidgets />
    </View>
  );
}

// ── 4. Legal & Taxes Widget ──────────────────────────────────────────────────
export function LegalTaxesSectorWidget() {
  return (
    <View style={{ gap: spacing.md }}>
      <LiveSectorBridgeBanner sectorKey="legalTaxes" title="Motor Tributário, Jurídico & Privacidade (Fator R, PGBL & Auditoria)" />
      <LegalAuditWidgets />
      <TaxOptimizationWidgets />
      <FinancialPrivacyWidgets />
    </View>
  );
}

// ── 5. Personal Finance Widget ────────────────────────────────────────────────
export function PersonalFinanceSectorWidget() {
  return (
    <View style={{ gap: spacing.sm }}>
      <LiveSectorBridgeBanner sectorKey="pfm" title="Motor de Finanças Pessoais (Fluxo 13 Semanas, Monte Carlo FIRE & Sankey)" />
      <PFMRetentionWidgets />
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
