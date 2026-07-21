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

// ── 1. SMB & Accounting Widget ───────────────────────────────────────────────
export function SMBSectorWidget() {
  return <SMBAccountingWidgets />;
}

// ── 2. Real Estate Widget ────────────────────────────────────────────────────
export function RealEstateSectorWidget() {
  return (
    <View style={{ gap: spacing.md }}>
      <RealEstateWidgets />
      <SovereignPropTechWidgets />
    </View>
  );
}

// ── 3. Vehicles & Fleet Widget ───────────────────────────────────────────────
export function VehiclesSectorWidget() {
  return (
    <View style={{ gap: spacing.md }}>
      <VehicleFleetWidgets />
      <VehicleCopywritingWidgets />
    </View>
  );
}

// ── 4. Legal & Taxes Widget ──────────────────────────────────────────────────
export function LegalTaxesSectorWidget() {
  return (
    <View style={{ gap: spacing.md }}>
      <LegalAuditWidgets />
      <TaxOptimizationWidgets />
      <FinancialPrivacyWidgets />
    </View>
  );
}

// ── 5. Personal Finance Widget ────────────────────────────────────────────────
export function PersonalFinanceSectorWidget() {
  return <PFMRetentionWidgets />;
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
