/**
 * PaywallModal Component — Assistente Moeda
 *
 * Premium bottom-sheet or full screen overlay modal displaying subscription offers.
 * Connects directly to the useSubscription hook to purchase and restore packages.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { useSubscription, type SubscriptionPackage } from '@/hooks/useSubscription';

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
}

export function PaywallModal({ visible, onClose }: PaywallModalProps) {
  const {
    isPro,
    packages,
    isLoading,
    isProcessing,
    purchasePackage,
    restorePurchases,
    toggleProMock,
  } = useSubscription();

  const [selectedPackage, setSelectedPackage] = useState<SubscriptionPackage | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // Set default package when list is loaded
  React.useEffect(() => {
    if (packages.length > 0 && !selectedPackage) {
      // Prefer Yearly package by default if available
      const yearly = packages.find((p) => p.packageType === 'YEARLY' || p.packageType === 'ANNUAL');
      setSelectedPackage(yearly || packages[0]);
    }
  }, [packages, selectedPackage]);

  // Auto-dismiss when user is already PRO
  React.useEffect(() => {
    if (visible && isPro) {
      const timer = setTimeout(() => {
        onClose();
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [visible, isPro, onClose]);

  const handleSubscribe = async () => {
    if (!selectedPackage || isPurchasing || isProcessing) return;
    setIsPurchasing(true);
    try {
      const success = await purchasePackage(selectedPackage);
      if (success) {
        onClose();
      }
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleRestore = async () => {
    if (isRestoring || isProcessing) return;
    setIsRestoring(true);
    try {
      const success = await restorePurchases();
      if (success) {
        onClose();
      }
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>✨ Desbloqueie o Poder da IA</Text>
            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          {/* Scrollable Content */}
          <ScrollView contentContainerStyle={styles.scrollContent} style={styles.scroll}>
            {/* ── PRO Active State ───────────────────────────── */}
            {isPro ? (
              <View style={styles.proActiveContainer}>
                <View style={styles.iconContainer}>
                  <Text style={styles.premiumIcon}>🎉</Text>
                </View>
                <Text style={styles.title}>Plano PRO Ativo!</Text>
                <Text style={styles.subtitle}>
                  Você já tem acesso completo ao Motor Estatístico, Projeções e inteligência avançada.
                </Text>
                <Pressable
                  style={({ pressed }) => [
                    styles.subscribeBtn,
                    pressed && styles.subscribeBtnPressed,
                  ]}
                  onPress={onClose}
                >
                  <Text style={styles.subscribeBtnText}>Fechar</Text>
                </Pressable>
              </View>
            ) : (
              <>
                {/* Crown Icon */}
                <View style={styles.iconContainer}>
                  <Text style={styles.premiumIcon}>👑</Text>
                </View>

                {/* Title & Tagline */}
                <Text style={styles.title}>Créditos do Motor de IA Gemini</Text>
                <Text style={styles.subtitle}>
                  O aplicativo é 100% Gratuito & Open-Source para gestão local, relatórios, módulo preditivo e chaves de API. A Licença serve exclusivamente para recarregar o Motor de IA interno no servidor.
                </Text>

                {/* Benefits */}
                <View style={styles.benefitsList}>
                  <View style={styles.benefitItem}>
                    <Text style={styles.benefitIcon}>🔓</Text>
                    <View style={styles.benefitTextContainer}>
                      <Text style={styles.benefitTitle}>100% Grátis & Open-Source</Text>
                      <Text style={styles.benefitDesc}>
                        Gestão de tabelas, Módulo Preditivo, Projeções, Auditoria e Import/Export CSV são 100% gratuitos.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.benefitItem}>
                    <Text style={styles.benefitIcon}>🤖</Text>
                    <View style={styles.benefitTextContainer}>
                      <Text style={styles.benefitTitle}>Consultor de IA Gemini (Servidor)</Text>
                      <Text style={styles.benefitDesc}>
                        A Chave de Licença recarrega tokens para usar o nosso modelo Gemini interno com análise financeira em tempo real.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.benefitItem}>
                    <Text style={styles.benefitIcon}>🔌</Text>
                    <View style={styles.benefitTextContainer}>
                      <Text style={styles.benefitTitle}>Agentes Externos & n8n Grátis</Text>
                      <Text style={styles.benefitDesc}>
                        Gere Chaves de API de Planilhas gratuitamente para integrar com Python, n8n ou seus próprios agentes de IA.
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Loading Indicator */}
                {isLoading ? (
                  <ActivityIndicator size="large" color={colors.accent.purple} style={styles.loader} />
                ) : (
                  <View style={styles.packagesContainer}>
                    {packages.map((pkg) => {
                      const isSelected = selectedPackage?.identifier === pkg.identifier;
                      const isYearly = pkg.packageType === 'YEARLY' || pkg.packageType === 'ANNUAL';

                      return (
                        <Pressable
                          key={pkg.identifier}
                          onPress={() => setSelectedPackage(pkg)}
                          style={[
                            styles.packageCard,
                            isSelected && styles.packageCardSelected,
                            isYearly && styles.packageCardYearly,
                          ]}
                        >
                          {isYearly && (
                            <View style={styles.badge}>
                              <Text style={styles.badgeText}>MAIS POPULAR - SALVE 50%</Text>
                            </View>
                          )}

                          <View style={styles.packageHeader}>
                            <Text style={styles.packageName}>
                              {isYearly ? 'Plano Anual' : 'Plano Mensal'}
                            </Text>
                            <View
                              style={[
                                styles.radioCircle,
                                isSelected && styles.radioCircleSelected,
                              ]}
                            />
                          </View>

                          <Text style={styles.packagePrice}>
                            {pkg.product.priceString}
                            <Text style={styles.packagePeriod}>
                              {isYearly ? ' / ano' : ' / mês'}
                            </Text>
                          </Text>

                          <Text style={styles.packageDetails}>
                            {isYearly
                              ? 'Equivale a R$ 10,00 por mês. Faturamento anual.'
                              : 'Cancele a qualquer momento. Faturamento mensal.'}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}

                {/* Actions */}
                <View style={styles.actions}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.subscribeBtn,
                      (!selectedPackage || isPurchasing || isProcessing) && styles.disabledBtn,
                      pressed && styles.subscribeBtnPressed,
                    ]}
                    onPress={handleSubscribe}
                    disabled={!selectedPackage || isPurchasing || isProcessing}
                  >
                    {(isPurchasing || isProcessing) ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.subscribeBtnText}>
                        Começar Teste Pro Agora
                      </Text>
                    )}
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [
                      styles.restoreBtn,
                      (isRestoring || isProcessing) && styles.disabledBtn,
                      pressed && styles.pressed,
                    ]}
                    onPress={handleRestore}
                    disabled={isRestoring || isProcessing}
                  >
                    {(isRestoring || isProcessing) ? (
                      <ActivityIndicator size="small" color={colors.text.secondary} />
                    ) : (
                      <Text style={styles.restoreBtnText}>Restaurar Compras Existentes</Text>
                    )}
                  </Pressable>
                </View>

                {/* Dev Mock Tool */}
                {__DEV__ && (
                  <View style={styles.devMockContainer}>
                    <Text style={styles.devMockTitle}>[Dev Mode] Status da Assinatura:</Text>
                    <View style={styles.devMockRow}>
                      <Text style={styles.devMockStatus}>
                        Pro Ativo: {isPro ? '✅ SIM' : '❌ NÃO'}
                      </Text>
                      <Pressable style={styles.devMockToggleBtn} onPress={toggleProMock}>
                        <Text style={styles.devMockToggleBtnText}>Alternar Mock Pro</Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: colors.background.secondary,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    maxHeight: '90%',
    width: '100%',
    maxWidth: 550,
    alignSelf: 'center',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
    backgroundColor: colors.background.tertiary,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.accent.purple,
  },
  closeBtn: {
    padding: spacing.xs,
  },
  closeBtnText: {
    color: colors.text.secondary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.lg,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  premiumIcon: {
    fontSize: 28,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text.primary,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 12,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: '90%',
    marginTop: -spacing.sm,
  },
  benefitsList: {
    width: '100%',
    backgroundColor: colors.background.tertiary,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    gap: spacing.md,
  },
  benefitItem: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  benefitIcon: {
    fontSize: 22,
  },
  benefitTextContainer: {
    flex: 1,
    gap: 2,
  },
  benefitTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.primary,
  },
  benefitDesc: {
    fontSize: 11,
    color: colors.text.tertiary,
    lineHeight: 15,
  },
  loader: {
    marginVertical: spacing.xl,
  },
  packagesContainer: {
    width: '100%',
    gap: spacing.sm,
  },
  packageCard: {
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    padding: spacing.md,
    position: 'relative',
    overflow: 'hidden',
  },
  packageCardSelected: {
    borderColor: colors.accent.purple,
    backgroundColor: 'rgba(168, 85, 247, 0.05)',
  },
  packageCardYearly: {
    borderWidth: 1.5,
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: colors.accent.purple,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderBottomLeftRadius: radius.sm,
  },
  badgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#ffffff',
  },
  packageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  packageName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.primary,
  },
  radioCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.text.tertiary,
  },
  radioCircleSelected: {
    borderColor: colors.accent.purple,
    backgroundColor: colors.accent.purple,
  },
  packagePrice: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text.primary,
    marginTop: spacing.xs,
  },
  packagePeriod: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.text.secondary,
  },
  packageDetails: {
    fontSize: 10,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  actions: {
    width: '100%',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  subscribeBtn: {
    backgroundColor: colors.accent.purple,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  subscribeBtnPressed: {
    backgroundColor: colors.accent.purpleHover,
  },
  subscribeBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  disabledBtn: {
    opacity: 0.5,
  },
  restoreBtn: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  restoreBtnText: {
    color: colors.text.secondary,
    fontSize: 12,
    fontWeight: '500',
  },
  pressed: {
    opacity: 0.8,
  },
  devMockContainer: {
    width: '100%',
    backgroundColor: colors.background.tertiary,
    borderRadius: radius.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  devMockTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.tertiary,
  },
  devMockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  devMockStatus: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text.secondary,
  },
  devMockToggleBtn: {
    backgroundColor: colors.background.elevated,
    borderWidth: 1,
    borderColor: colors.border.strong,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.xs,
  },
  devMockToggleBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.accent.purple,
  },
  proActiveContainer: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
});
