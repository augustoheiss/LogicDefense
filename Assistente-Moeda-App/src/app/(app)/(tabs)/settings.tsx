/**
 * Settings Tab — Assistente Moeda
 *
 * Account management, sync controls, app preferences, and GOALS ACCORDION.
 *
 * Goals section allows editing:
 *   - Weekly goals by year (dailyGoals multiplied by 7)
 *   - Annual costs by year
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  View,
  Text,
  Pressable,
  TextInput,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  Modal,
  ActivityIndicator,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthContext } from '@/hooks/useAuth';
import { useCoinDB } from '@/hooks/useCoinDB';
import { useSubscription } from '@/hooks/useSubscription';
import { useHaptics, ImpactFeedbackStyle } from '@/hooks/useHaptics';
import { clearDB } from '@/storage/asyncStorageAdapter';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { typography, fontFamily } from '@/theme/typography';
import { shadows } from '@/theme/shadows';
import { Card } from '@/components/ui/Card';
import { TokenProgressBar } from '@/components/ui/TokenProgressBar';
import { SectorSettingsPanel } from '@/components/ui/SectorSettingsPanel';
import { formatCurrencySmart } from '@/core/formatCurrency';
import type { TableGoals } from '@/core/types';

// ── Animated Pressable for spring-scale micro-interactions ───────────────────

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const SPRING_CONFIG = { damping: 15, stiffness: 300, mass: 0.8 };

export default function SettingsScreen() {
  const router = useRouter();
  const auth = useAuthContext();
  const db = useCoinDB();
  const { impact } = useHaptics();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const isVisitor = !auth.user || auth.mode === 'guest';

  const { isPro, subscriptionType, packages, consumables, purchasePackage, restorePurchases, expirationDate, isProcessing } = useSubscription();
  const maxTokens = auth.profile?.tokenCap ?? (auth.isPremium ? 1_000_000 : 1_000_000);
  const tokenBalance = auth.isPremium ? (auth.profile?.tokenBalance ?? 0) : 0;

  const [showStoreModal, setShowStoreModal] = useState(false);
  const [showDebugger, setShowDebugger] = useState(false);

  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const handleUpdatePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("Preencha todos os campos.");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("A nova senha deve ter no mínimo 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("As senhas não coincidem.");
      return;
    }

    setIsUpdatingPassword(true);
    setPasswordError('');
    try {
      const email = auth.user?.email;
      if (!email) throw new Error("Email do usuário não encontrado.");

      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });

      if (reauthError) {
        setPasswordError("Senha atual incorreta");
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setPasswordError(updateError.message);
        return;
      }

      setIsPasswordModalOpen(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      if (Platform.OS === 'web') {
        window.alert("Senha alterada com sucesso!");
      } else {
        Alert.alert("Sucesso", "Senha alterada com sucesso!");
      }
    } catch (err: any) {
      setPasswordError(err.message || String(err));
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const fetchTokenBalance = useCallback(async () => {
    await auth.refreshProfile();
  }, [auth.refreshProfile]);

  const incrementarTokensNoBancoLocal = useCallback(async (_amount: number, _transactionId?: string) => {
    await auth.refreshProfile();
  }, [auth.refreshProfile]);

  const handlePurchase = async (pkg: any) => {
    if (isProcessing) return;
    impact(ImpactFeedbackStyle.Medium);

    try {
      const isConsumable = pkg.packageType === 'CUSTOM' || pkg.identifier === 'moeda_tokens_100k' || pkg.identifier.includes('token') || pkg.identifier.includes('consumable');
      
      if (isConsumable) {
        const transactionId = await purchasePackage(pkg);
        if (transactionId) {
          let amount = 100_000;
          if (pkg.identifier === 'moeda_tokens_100k') {
            amount = 100_000;
          } else if (pkg.identifier.includes('50k')) {
            amount = 50_000;
          } else if (pkg.identifier.includes('200k')) {
            amount = 200_000;
          } else if (pkg.identifier.includes('500k')) {
            amount = 500_000;
          }
          
          await incrementarTokensNoBancoLocal(amount, transactionId);
          if (Platform.OS === 'web') {
            window.alert(`Recarga bem-sucedida! Adicionado ${amount.toLocaleString('pt-BR')} tokens ao seu saldo.`);
          } else {
            Alert.alert("Recarga Concluída", `Adicionado ${amount.toLocaleString('pt-BR')} tokens ao seu saldo.`);
          }
        }
      } else {
        const success = await purchasePackage(pkg);
        if (success) {
          if (Platform.OS === 'web') {
            window.alert('Assinatura Pro ativada com sucesso!');
          } else {
            Alert.alert("Assinatura Ativa", "Você agora tem acesso completo ao Assistente Moeda Pro!");
          }
        }
      }
    } catch (err: any) {
      if (err && !err.userCancelled) {
        console.error("Purchase Failed:", err);
        const msg = err.message || String(err);
        if (Platform.OS === 'web') {
          window.alert("Erro na compra: " + msg);
        } else {
          Alert.alert("Erro na compra", msg);
        }
      }
    }
  };

  useEffect(() => {
    fetchTokenBalance();
  }, [fetchTokenBalance]);

  const handleLocalMigration = async () => {
    if (auth.mode !== 'authenticated' || !auth.user) {
      if (Platform.OS === 'web') {
        window.alert("Por favor, faça login ou crie uma conta para migrar suas planilhas para a nuvem.");
      } else {
        Alert.alert("Atenção", "Por favor, faça login ou crie uma conta para migrar suas planilhas para a nuvem.");
      }
      return;
    }

    if (db.tables.length === 0) {
      if (Platform.OS === 'web') {
        window.alert("Nenhuma planilha local encontrada para migrar.");
      } else {
        Alert.alert("Aviso", "Nenhuma planilha local encontrada para migrar.");
      }
      return;
    }
    
    setIsMigrating(true);
    try {
      const res = await db.migrateLocalToCloud();
      if (res.success) {
        if (Platform.OS === 'web') {
          window.alert('Suas planilhas locais foram migradas para a nuvem com sucesso!');
        } else {
          Alert.alert('Sucesso', 'Suas planilhas locais foram migradas para a nuvem com sucesso!');
        }
      } else {
        if (Platform.OS === 'web') {
          window.alert(`Falha na migração: ${res.error}`);
        } else {
          Alert.alert('Erro', `Falha na migração: ${res.error}`);
        }
      }
    } catch (err: any) {
      const errMsg = err.message || 'Erro inesperado durante a migração.';
      if (Platform.OS === 'web') {
        window.alert(errMsg);
      } else {
        Alert.alert('Erro', errMsg);
      }
    } finally {
      setIsMigrating(false);
    }
  };

  const handleManualSync = async () => {
    if (auth.mode !== 'authenticated' || !auth.user) return;
    setIsSyncing(true);
    try {
      const res = await db.syncCloud();
      if (res.success) {
        Alert.alert('Sucesso', 'Sincronização concluída com sucesso!');
      } else {
        Alert.alert('Erro', `Falha na sincronização: ${res.error}`);
      }
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Erro inesperado ao sincronizar.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLogout = () => {
    const performLogout = async () => {
      try {
        await auth.logout();
        if (Platform.OS !== 'web') {
          Alert.alert("Sucesso", "Você saiu da conta.");
          router.replace('/');
        } else {
          window.alert("Você saiu da conta.");
          window.location.href = '/laboratorio/assistente-moeda';
        }
      } catch (error: any) {
        console.error("Logout Error:", error);
        const msg = error?.message || String(error);
        if (Platform.OS === 'web') {
          window.alert("Erro ao sair: " + msg);
        } else {
          Alert.alert("Erro ao sair", msg);
        }
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm("Seus dados locais serão apagados. Deseja sair?")) {
        performLogout();
      }
    } else {
      Alert.alert(
        'Sair da Conta',
        'Seus dados locais serão apagados. Deseja sair?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Sair', style: 'destructive', onPress: performLogout },
        ]
      );
    }
  };

  const handleClearLocalCache = () => {
    const performClear = async () => {
      try {
        await db.clearLocalState();
        if (Platform.OS === 'web') {
          window.alert("Sucesso: Os dados locais foram apagados.");
        } else {
          Alert.alert("Sucesso", "Os dados locais foram apagados.");
        }
      } catch (error: any) {
        console.error("Clear Cache Error:", error);
        const msg = error?.message || String(error);
        if (Platform.OS === 'web') {
          window.alert("Erro ao limpar dados: " + msg);
        } else {
          Alert.alert("Erro ao limpar dados", msg);
        }
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm("Tem certeza? Isso apagará os dados não salvos neste dispositivo.")) {
        performClear();
      }
    } else {
      Alert.alert(
        'Atenção',
        'Tem certeza? Isso apagará os dados não salvos neste dispositivo.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Apagar', style: 'destructive', onPress: performClear },
        ]
      );
    }
  };

  const handleDeleteAccount = () => {
    if (isVisitor) {
      Alert.alert("Aviso", "Esta funcionalidade só está disponível para usuários com contas cadastradas.");
      return;
    }

    const performDelete = async () => {
      setIsDeleting(true);
      try {
        const { error } = await supabase.rpc('delete_user_account');
        if (error) throw error;

        // Clear local state/DB
        await db.clearLocalState();

        // Sign out
        await auth.logout();

        if (Platform.OS === 'web') {
          window.alert("Sua conta e todos os dados associados foram excluídos com sucesso.");
          window.location.href = '/laboratorio/assistente-moeda';
        } else {
          Alert.alert("Conta Excluída", "Sua conta e todos os dados associados foram excluídos com sucesso.");
          router.replace('/');
        }
      } catch (err: any) {
        console.error("Delete Account Error:", err);
        const msg = err?.message || String(err);
        if (Platform.OS === 'web') {
          window.alert("Erro ao excluir conta: " + msg);
        } else {
          Alert.alert("Erro ao excluir conta", msg);
        }
      } finally {
        setIsDeleting(false);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm("Esta ação é irreversível e apagará todos os seus dados.\n\nATENÇÃO: A exclusão da conta NÃO cancela assinaturas ativas. Você deve cancelar sua assinatura diretamente na sua loja de aplicativos (Google Play / App Store).\n\nDeseja prosseguir com a exclusão definitiva?")) {
        performDelete();
      }
    } else {
      Alert.alert(
        'Excluir Conta?',
        'Esta ação é irreversível e apagará todos os seus dados. ATENÇÃO: A exclusão da conta NÃO cancela assinaturas ativas. Você deve cancelar sua assinatura diretamente na sua loja de aplicativos (Google Play / App Store).',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Excluir', style: 'destructive', onPress: performDelete },
        ]
      );
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>

      <View style={styles.header}>
        <Text style={styles.title}>⚙️ Ajustes</Text>
        <Text style={styles.subtitle}>Conta, metas e preferências</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {/* ── Account & License Section ──────────────────────────────── */}
        <Section title="🔑 Licença & Armazenamento">
          <Card>
            <View style={styles.profileRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {auth.isPremium ? '⭐' : '🔒'}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.profileName}>
                  {auth.isPremium ? 'Licença Pro Ativa' : 'Plano Gratuito (Local)'}
                </Text>
                <Text style={styles.profileEmail}>
                  {auth.profile?.licenseKey 
                    ? `Chave: ${auth.profile.licenseKey.slice(0, 12)}...` 
                    : 'Dados salvos 100% no dispositivo local'}
                </Text>
                <Text style={styles.tierText}>
                  {auth.isPremium ? '⭐ Motor de IA e Consultor Liberados' : '🔒 Insira uma Chave Pro para ativar o Assistente de IA'}
                </Text>
              </View>
            </View>
          </Card>
        </Section>

        {/* ── AI Engine Section (Fuel Gauge) ───────────────── */}
        <Section title="⚡ Motor de Inteligência Artificial">
          <Card glow>
            <Text style={styles.gaugeTitle}>Consumo de Tokens da IA</Text>
            <Text style={styles.gaugeSubtitle}>
              Saldo: <Text style={styles.gaugeBalanceHighlight}>{tokenBalance.toLocaleString('pt-BR')}</Text> / {maxTokens.toLocaleString('pt-BR')} tokens
            </Text>
            
            <View style={styles.progressBarWrapper}>
              <TokenProgressBar current={tokenBalance} max={maxTokens} />
            </View>
            
            <Text style={styles.gaugeHelperText}>
              Os tokens são consumidos conforme você envia mensagens e solicita análises da IA.
            </Text>

            {isPro && expirationDate && (
              <Text style={styles.gaugeProStatus}>
                ⭐ Assinatura Pro ativa até {(() => {
                  try {
                    return new Date(expirationDate).toLocaleDateString('pt-BR');
                  } catch (e) {
                    return expirationDate;
                  }
                })()}
              </Text>
            )}

            <HapticButton
              style={styles.storefrontButton}
              onPress={() => {
                impact(ImpactFeedbackStyle.Light);
                setShowStoreModal(true);
              }}
            >
              <Text style={styles.storefrontButtonText}>🪙 Recarregar Créditos (Loja)</Text>
            </HapticButton>
          </Card>
        </Section>

        {/* ── Migration Section ───────────────────────────── */}
        {!isVisitor && (
          <Section title="Migração de Dados">
            <Card>
              <Text style={styles.migrationTitle}>📤 Migrar Planilhas Locais</Text>
              <Text style={styles.migrationText}>
                Você tem {db.tables.length} planilhas salvas na memória local. Você pode migrá-las e enviá-las para sua conta em nuvem agora.
              </Text>
              <Pressable
                style={({ pressed }) => [
                  styles.migrationButton,
                  isMigrating && styles.syncButtonDisabled,
                  pressed && styles.pressed,
                ]}
                onPress={handleLocalMigration}
                disabled={isMigrating}
              >
                <Text style={styles.migrationButtonText}>
                  {isMigrating ? '⏳ Migrando...' : '📤 Subir Planilhas Locais para a Nuvem'}
                </Text>
              </Pressable>
            </Card>
          </Section>
        )}

        {/* ── Goals Accordion ─────────────────────────────── */}
        {db.activeTable && (
          <Section title="🎯 Metas Semanais">
            <GoalsAccordion
              key={db.activeTable.id}
              goals={db.activeTable.goals}
              onUpdate={db.updateGoals}
            />
          </Section>
        )}

        {/* ── Sector Configurations ───────────────────────── */}
        {db.activeTable && (
          <Section title="⚙️ Módulos / Setores">
            <SectorSettingsPanel />
          </Section>
        )}

        {/* ── API Integration ─────────────────────────────── */}
        {db.activeTable && (
          <Section title="🔌 Integração via API (IA)">
            <SpreadsheetApiSection 
              tableId={db.activeTable.id} 
              onShowStore={() => setShowStoreModal(true)} 
            />
          </Section>
        )}

        {/* ── Table Management ────────────────────────────── */}
        <Section title="📋 Tabelas">
          <Card>
            {db.tables.length === 0 ? (
              <Text style={styles.emptyText}>Nenhuma tabela criada</Text>
            ) : (
              db.tables.map((t, i) => (
                <View key={t.id} style={styles.tableRow}>
                  <Pressable
                    style={[
                      styles.tableButton,
                      i === db.activeTableIndex && styles.tableButtonActive,
                    ]}
                    onPress={() => db.setActiveTableIndex(i)}
                  >
                    <Text
                      style={[
                        styles.tableName,
                        i === db.activeTableIndex && styles.tableNameActive,
                      ]}
                    >
                      {i === db.activeTableIndex ? '● ' : '○ '}
                      {t.name}
                    </Text>
                    <Text style={styles.tableRowCount}>{t.rows.length} entradas</Text>
                  </Pressable>
                </View>
              ))
            )}
          </Card>
        </Section>

        {/* ── Danger Zone ────────────────────────────────── */}
        <Section title="Zona de Perigo">
          <Card style={{ borderColor: colors.danger.main, borderWidth: 1 }}>
            <Text style={{ fontSize: 13, color: colors.text.secondary, marginBottom: spacing.md }}>
              Ações irreversíveis. Tenha cuidado ao prosseguir.
            </Text>
            <View style={{ gap: spacing.md }}>
              <Pressable
                style={({ pressed }) => [
                  {
                    backgroundColor: 'transparent',
                    borderWidth: 1,
                    borderColor: colors.danger.main,
                    paddingVertical: spacing.sm,
                    borderRadius: radius.sm,
                    alignItems: 'center',
                  },
                  pressed && styles.pressed,
                ]}
                onPress={handleClearLocalCache}
              >
                <Text style={{ color: colors.danger.main, fontSize: 13, fontWeight: '600' }}>
                  🗑️ Limpar Planilhas do Navegador
                </Text>
              </Pressable>

              {!isVisitor && (
                <Pressable
                  style={({ pressed }) => [
                    {
                      backgroundColor: colors.danger.main,
                      paddingVertical: spacing.sm,
                      borderRadius: radius.sm,
                      alignItems: 'center',
                    },
                    isDeleting && { opacity: 0.5 },
                    pressed && styles.pressed,
                  ]}
                  onPress={handleDeleteAccount}
                  disabled={isDeleting}
                >
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>
                    {isDeleting ? '⏳ Excluindo Conta...' : '⚠️ Excluir Conta Permanentemente'}
                  </Text>
                </Pressable>
              )}
            </View>
          </Card>
        </Section>

        {/* ── App Info ────────────────────────────────────── */}
        <Section title="Sobre">
          <Card>
            <Text style={styles.infoRow}>Versão: 1.0.0</Text>
            <Text style={styles.infoRow}>Plataforma: Expo SDK 56</Text>
            <Text style={styles.infoRow}>Motor: React Native 0.85</Text>
            <Text style={styles.infoRow}>Desenvolvido por: Logic Defense</Text>
          </Card>
        </Section>

        {/* ── Collapsible Dev Mode Debugger ───────────────── */}
        {showDebugger && (
          <View style={{
            marginHorizontal: spacing.md,
            marginTop: spacing.md,
            backgroundColor: '#1f2937',
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: '#374151',
            padding: spacing.md,
            gap: spacing.xs
          }}>
            <Text style={{ color: '#ef4444', fontWeight: 'bold', fontSize: 13, marginBottom: 4 }}>🔍 X-RAY SUBSCRIPTION DEBUGGER</Text>
            <Text style={{ color: '#9ca3af', fontSize: 11, fontFamily: 'monospace' }}>User ID: {auth.user?.id || 'null'}</Text>
            <Text style={{ color: '#9ca3af', fontSize: 11, fontFamily: 'monospace' }}>Mode: {auth.mode}</Text>
            <Text style={{ color: '#9ca3af', fontSize: 11, fontFamily: 'monospace' }}>Session: {auth.session ? 'Active' : 'None'}</Text>
            <Text style={{ color: '#ef4444', fontSize: 11, fontFamily: 'monospace' }}>Fetch Error: {JSON.stringify(auth.profileFetchError || 'No error captured')}</Text>
            <Text style={{ color: '#22d3ee', fontSize: 11, fontFamily: 'monospace' }}>profile is null: {JSON.stringify(!auth.profile)}</Text>
            <Text style={{ color: '#facc15', fontSize: 11, fontFamily: 'monospace' }}>premiumTier: {JSON.stringify(auth.profile?.premiumTier)}</Text>
            <Text style={{ color: '#facc15', fontSize: 11, fontFamily: 'monospace' }}>premium_tier (raw): {JSON.stringify((auth.profile as any)?.premium_tier)}</Text>
            <Text style={{ color: '#c084fc', fontSize: 11, fontFamily: 'monospace' }}>subscriptionType: {JSON.stringify(auth.profile?.subscriptionType)}</Text>
            <Text style={{ color: '#c084fc', fontSize: 11, fontFamily: 'monospace' }}>subscriptionType hook: {JSON.stringify(subscriptionType)}</Text>
            <Text style={{ color: '#4ade80', fontSize: 11, fontFamily: 'monospace' }}>isPro hook: {JSON.stringify(isPro)}</Text>
            <Text style={{ color: '#4ade80', fontSize: 11, fontFamily: 'monospace' }}>auth.isPremium: {JSON.stringify(auth.isPremium)}</Text>
            <Text style={{ color: '#9ca3af', fontSize: 11, fontFamily: 'monospace' }}>auth.user: {JSON.stringify(auth.user?.email)}</Text>
          </View>
        )}

        <Pressable
          onPress={() => setShowDebugger(prev => !prev)}
          style={{ alignSelf: 'center', marginVertical: spacing.md, opacity: 0.3 }}
        >
          <Text style={{ color: colors.text.tertiary, fontSize: 11, fontFamily: 'monospace' }}>
            {showDebugger ? 'Hide Developer Tools 🐛' : '🐛 Modo Dev'}
          </Text>
        </Pressable>

        {/* ── Logout ─────────────────────────────────────── */}
        {!isVisitor && (
          <Pressable
            style={({ pressed }) => [styles.logoutButton, pressed && styles.pressed]}
            onPress={handleLogout}
          >
            <Text style={styles.logoutText}>Sair da Conta</Text>
          </Pressable>
        )}

        <View style={{ height: spacing.huge }} />
      </ScrollView>

      {/* ── Change Password Modal ───────────────────────── */}
      <Modal
        visible={isPasswordModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          if (!isUpdatingPassword) {
            setIsPasswordModalOpen(false);
          }
        }}
      >
        <View style={styles.modalBackground}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🔒 Alterar Senha</Text>
              <Pressable
                onPress={() => {
                  if (!isUpdatingPassword) {
                    setIsPasswordModalOpen(false);
                  }
                }}
                disabled={isUpdatingPassword}
                style={styles.modalCloseButton}
              >
                <Text style={styles.modalCloseText}>✖</Text>
              </Pressable>
            </View>

            <View style={styles.modalContent}>
              <Text style={styles.passwordLabel}>Senha Atual</Text>
              <TextInput
                style={styles.passwordInput}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry={true}
                placeholder="Digite sua senha atual"
                placeholderTextColor={colors.text.disabled}
                editable={!isUpdatingPassword}
              />

              <Text style={styles.passwordLabel}>Nova Senha</Text>
              <TextInput
                style={styles.passwordInput}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={true}
                placeholder="No mínimo 6 caracteres"
                placeholderTextColor={colors.text.disabled}
                editable={!isUpdatingPassword}
              />

              <Text style={styles.passwordLabel}>Confirmar Nova Senha</Text>
              <TextInput
                style={styles.passwordInput}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={true}
                placeholder="Repita a nova senha"
                placeholderTextColor={colors.text.disabled}
                editable={!isUpdatingPassword}
              />

              {passwordError ? (
                <Text style={styles.passwordErrorText}>{passwordError}</Text>
              ) : null}

              <Pressable
                style={({ pressed }) => [
                  styles.buyButton,
                  isUpdatingPassword && styles.syncButtonDisabled,
                  pressed && styles.pressed,
                  { marginTop: spacing.lg }
                ]}
                onPress={handleUpdatePassword}
                disabled={isUpdatingPassword}
              >
                <Text style={styles.buyButtonText}>
                  {isUpdatingPassword ? '⏳ Atualizando...' : 'Confirmar Alteração'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Storefront Modal ────────────────────────────── */}
      <Modal
        visible={showStoreModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowStoreModal(false)}
      >
        <View style={styles.modalBackground}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🪙 Loja de Créditos & Pro</Text>
              <Pressable onPress={() => setShowStoreModal(false)} style={styles.modalCloseButton}>
                <Text style={styles.modalCloseText}>✖</Text>
              </Pressable>
            </View>

            <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalContentInner}>
              {/* ── Entitlement Status Banner ──────────────────── */}
              <View style={[styles.statusCard, isPro && styles.statusCardActive]}>
                <Text style={styles.statusTitle}>
                  {isPro ? '⭐ Plano PRO Ativo' : '🆓 Plano Gratuito Limitado'}
                </Text>
                <Text style={styles.statusDescription}>
                  {isPro 
                    ? `Você tem acesso ilimitado ao Motor Estatístico, Projeções e maior cota de IA!${
                        subscriptionType ? `\nPlano: ${subscriptionType === 'yearly' ? 'Anual' : 'Mensal'}` : ''
                      }${
                        expirationDate ? `\nExpira em: ${(() => {
                          try { return new Date(expirationDate).toLocaleDateString('pt-BR'); }
                          catch { return expirationDate; }
                        })()}` : ''
                      }`
                    : 'Assine o Pro para liberar análises ilimitadas, mediana, desvios padrões e inteligência avançada.'}
                </Text>
              </View>

              {/* ── Subscription Section (hidden when PRO active) ─ */}
              {!isPro && (
                <>
                  <Text style={styles.storeSectionTitle}>Planos de Assinatura (Pro)</Text>
                  {packages.length === 0 ? (
                    <Text style={styles.emptyStoreText}>Carregando assinaturas...</Text>
                  ) : (
                    <>
                      {/* Mensal Button */}
                      {(() => {
                        const monthlyPkg = packages.find(p => p.packageType === 'MONTHLY');
                        if (!monthlyPkg) return null;
                        return (
                          <Card key={monthlyPkg.identifier} glow variant="accent" style={styles.storeCard}>
                            <View style={styles.storeCardHeader}>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.storeCardTitle}>Mensal</Text>
                                <Text style={styles.storeCardDesc}>{monthlyPkg.product.description}</Text>
                              </View>
                              <Text style={styles.storeCardPrice}>{monthlyPkg.product.priceString}</Text>
                            </View>
                            <HapticButton
                              style={[styles.buyButton, isProcessing && { opacity: 0.5 }]}
                              onPress={() => handlePurchase(monthlyPkg)}
                              disabled={isProcessing}
                            >
                              <Text style={styles.buyButtonText}>Assinar Mensal</Text>
                            </HapticButton>
                          </Card>
                        );
                      })()}

                      {/* Anual Button */}
                      {(() => {
                        const yearlyPkg = packages.find(p => p.packageType === 'YEARLY' || p.packageType === 'ANNUAL');
                        if (!yearlyPkg) return null;
                        return (
                          <Card key={yearlyPkg.identifier} glow variant="accent" style={styles.storeCard}>
                            <View style={styles.storeCardHeader}>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.storeCardTitle}>Anual</Text>
                                <Text style={styles.storeCardDesc}>{yearlyPkg.product.description}</Text>
                              </View>
                              <Text style={styles.storeCardPrice}>{yearlyPkg.product.priceString}</Text>
                            </View>
                            <View style={styles.bestValueBadge}>
                              <Text style={styles.bestValueBadgeText}>MELHOR VALOR</Text>
                            </View>
                            <HapticButton
                              style={[styles.buyButton, isProcessing && { opacity: 0.5 }]}
                              onPress={() => handlePurchase(yearlyPkg)}
                              disabled={isProcessing}
                            >
                              <Text style={styles.buyButtonText}>Assinar Anual</Text>
                            </HapticButton>
                          </Card>
                        );
                      })()}
                    </>
                  )}
                </>
              )}

              {/* ── Consumables Section (always visible) ─────── */}
              <Text style={styles.storeSectionTitle}>Créditos Avulsos (Combustível)</Text>
              {consumables.length === 0 ? (
                <Text style={styles.emptyStoreText}>Carregando pacotes de recarga...</Text>
              ) : (
                <>
                  {/* 100k Tokens Button — explicit identifier match */}
                  {(() => {
                    const tokenPkg = consumables.find(p => p.identifier === 'moeda_tokens_100k');
                    if (!tokenPkg) {
                      // Fallback: render all consumables if 'moeda_tokens_100k' not found by identifier
                      return consumables.map((pkg) => (
                        <Card key={pkg.identifier} style={styles.storeCard}>
                          <View style={styles.storeCardHeader}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.storeCardTitle}>{pkg.product.title}</Text>
                              <Text style={styles.storeCardDesc}>{pkg.product.description}</Text>
                            </View>
                            <Text style={styles.storeCardPrice}>{pkg.product.priceString}</Text>
                          </View>
                          <HapticButton
                            style={[styles.buyButton, styles.buyButtonConsumable, isProcessing && { opacity: 0.5 }]}
                            onPress={() => handlePurchase(pkg)}
                            disabled={isProcessing}
                          >
                            <Text style={styles.buyButtonText}>Comprar Recarga</Text>
                          </HapticButton>
                        </Card>
                      ));
                    }
                    return (
                      <Card key={tokenPkg.identifier} style={styles.storeCard}>
                        <View style={styles.storeCardHeader}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.storeCardTitle}>100k Tokens</Text>
                            <Text style={styles.storeCardDesc}>Adiciona 100.000 tokens de saldo ao Motor de IA</Text>
                          </View>
                          <Text style={styles.storeCardPrice}>{tokenPkg.product.priceString}</Text>
                        </View>
                        <HapticButton
                          style={[styles.buyButton, styles.buyButtonConsumable, isProcessing && { opacity: 0.5 }]}
                          onPress={() => handlePurchase(tokenPkg)}
                          disabled={isProcessing}
                        >
                          <Text style={styles.buyButtonText}>Comprar 100k Tokens</Text>
                        </HapticButton>
                      </Card>
                    );
                  })()}
                </>
              )}

              {/* ── Restore Purchases ───────────────────────── */}
              <Pressable
                style={({ pressed }) => [styles.restorePurchasesBtn, (pressed || isProcessing) && styles.pressed, isProcessing && { opacity: 0.5 }]}
                disabled={isProcessing}
                onPress={async () => {
                  if (isProcessing) return;
                  try {
                    await restorePurchases();
                  } catch (err: any) {
                    console.error('Restore failed:', err);
                  }
                }}
              >
                <Text style={styles.restorePurchasesText}>🔄 Restaurar Compras</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Section Component ────────────────────────────────────────────────────────

const Section = React.memo(function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
});

// ── Spreadsheet API Keys Integration Section ───────────────────────────────────

const API_URL = process.env.EXPO_PUBLIC_AI_BACKEND_URL || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';

const SpreadsheetApiSection = React.memo(function SpreadsheetApiSection({
  tableId,
  onShowStore,
}: {
  tableId: string;
  onShowStore: () => void;
}) {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [keyHint, setKeyHint] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [copiedSchema, setCopiedSchema] = useState(false);

  const handleCopySchema = async () => {
    const schemaUrl = `${API_URL}/api/v1/public/openapi.json`;
    await Clipboard.setStringAsync(schemaUrl);
    setCopiedSchema(true);
    setTimeout(() => setCopiedSchema(false), 2000);
  };

  useEffect(() => {
    fetchActiveKey();
  }, [tableId]);

  const fetchActiveKey = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('spreadsheet_api_keys')
        .select('key_hint')
        .eq('table_id', tableId)
        .maybeSingle();

      if (data) {
        setKeyHint(data.key_hint);
      } else {
        setKeyHint(null);
      }
      setApiKey(null);
      setCopied(false);
    } catch (e) {
      console.warn('Erro ao carregar dica da chave API:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (apiKey) {
      await Clipboard.setStringAsync(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const generateKey = async () => {
    if (keyHint) {
      const proceed = await new Promise<boolean>((resolve) => {
        if (Platform.OS === 'web') {
          const ok = window.confirm(
            "Atenção: Ao gerar uma nova chave de API, qualquer integração ativa (no ChatGPT, Make ou scripts) que use a chave antiga vai parar de funcionar imediatamente. Deseja continuar?"
          );
          resolve(ok);
        } else {
          Alert.alert(
            "Atenção",
            "Ao gerar uma nova chave de API, qualquer integração ativa (no ChatGPT, Make ou scripts) que use a chave antiga vai parar de funcionar imediatamente. Deseja continuar?",
            [
              { text: "Cancelar", style: "cancel", onPress: () => resolve(false) },
              { text: "Confirmar", style: "destructive", onPress: () => resolve(true) }
            ]
          );
        }
      });
      if (!proceed) return;
    }

    setGenerating(true);
    try {
      const sessionRes = await supabase.auth.getSession();
      const token = sessionRes.data.session?.access_token;

      const headers: any = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_URL}/api/v1/api-keys/generate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          table_id: tableId,
          permissions: 'read:write',
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        let errMsg = errText;
        try {
          const errJson = JSON.parse(errText);
          errMsg = errJson.detail || errMsg;
        } catch (e) {}

        if (errMsg.includes("Upgrade to PRO") || response.status === 403 && errMsg.includes("PRO")) {
          if (Platform.OS === 'web') {
            window.alert("Faça upgrade para o plano PRO para gerenciar chaves de API em planilhas adicionais!");
          } else {
            Alert.alert(
              "Limite Atingido",
              "Faça upgrade para o plano PRO para gerenciar chaves de API em planilhas adicionais.",
              [
                { text: "Ver Planos", onPress: onShowStore },
                { text: "Fechar", style: "cancel" }
              ]
            );
          }
        } else {
          if (Platform.OS === 'web') {
            window.alert(`Erro ao gerar chave: ${errMsg}`);
          } else {
            Alert.alert("Erro", `Erro ao gerar chave: ${errMsg}`);
          }
        }
        return;
      }

      const resData = await response.json();
      setApiKey(resData.api_key);
      setKeyHint(resData.key_hint);
      setCopied(false);
    } catch (error: any) {
      if (Platform.OS === 'web') {
        window.alert(`Erro de rede: ${error.message}`);
      } else {
        Alert.alert("Erro de Rede", `Não foi possível conectar ao servidor: ${error.message}`);
      }
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <Card style={styles.apiCard}>
        <ActivityIndicator size="small" color={colors.accent.purple} />
      </Card>
    );
  }

  return (
    <Card style={styles.apiCard}>
      <Text style={styles.apiDescription}>
        Conecte esta planilha a IAs externas (como ChatGPT ou Claude) e ferramentas de automação (Make, n8n) para ler ou adicionar transações.
      </Text>

      {keyHint ? (
        <View style={styles.keyContainer}>
          <Text style={styles.keyLabel}>
            Dica da Chave Ativa: <Text style={styles.keyHintText}>{keyHint}</Text>
          </Text>
          
          {apiKey ? (
            <View style={styles.rawKeyBox}>
              <Text style={styles.rawKeyLabel}>Sua Chave de API:</Text>
              <TextInput
                style={styles.rawKeyInput}
                value={apiKey}
                editable={false}
                selectTextOnFocus
              />
              <HapticButton
                onPress={handleCopy}
                style={[styles.copyBtn, copied && styles.copyBtnSuccess]}
              >
                <Text style={styles.copyBtnText}>
                  {copied ? 'Copiado! ✓' : 'Copiar Chave 📋'}
                </Text>
              </HapticButton>
              <Text style={styles.rawKeyWarning}>
                ⚠️ Guarde esta chave em local seguro. Por motivos de segurança, você não poderá visualizá-la novamente.
              </Text>
            </View>
          ) : (
            <HapticButton onPress={generateKey} disabled={generating} style={styles.regenerateBtn}>
              {generating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.regenerateBtnText}>🔄 Regerar Nova Chave de API</Text>
              )}
            </HapticButton>
          )}
        </View>
      ) : (
        <HapticButton onPress={generateKey} disabled={generating} style={styles.generateBtn}>
          {generating ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.generateBtnText}>🔑 Gerar Chave de API para esta Planilha</Text>
          )}
        </HapticButton>
      )}

      {/* ── Guia de Integração com IAs Externas ───────────────────────── */}
      <HapticButton 
        onPress={() => setShowGuide(!showGuide)} 
        style={styles.guideHeader}
      >
        <Text style={styles.guideHeaderTitle}>
          {showGuide ? '🔌 Ocultar Guia de Integração ▲' : '🔌 Como conectar a IAs Externas ▼'}
        </Text>
      </HapticButton>

      {showGuide && (
        <View style={styles.guideContent}>
          <Text style={styles.guideStepTitle}>1. Obter o Schema da API:</Text>
          <Text style={styles.guideText}>
            As IAs externas precisam do Schema OpenAPI para saber quais endpoints chamar. Copie o link abaixo para importar:
          </Text>
          <HapticButton 
            onPress={handleCopySchema} 
            style={[styles.copySchemaBtn, copiedSchema && styles.copyBtnSuccess]}
          >
            <Text style={styles.copySchemaBtnText}>
              {copiedSchema ? 'Link Copiado! ✓' : 'Copiar Link do Schema OpenAPI 📋'}
            </Text>
          </HapticButton>

          <Text style={styles.guideStepTitle}>2. Configuração no ChatGPT (Custom GPTs):</Text>
          <View style={styles.guideStepsBox}>
            <Text style={styles.guideStepItem}>• Vá em Explore GPTs → Create → Configure.</Text>
            <Text style={styles.guideStepItem}>• Role até o final e clique em Create new action.</Text>
            <Text style={styles.guideStepItem}>• Clique em Import from URL, cole o link copiado e clique em Import.</Text>
            <Text style={styles.guideStepItem}>• Em Authentication, mude para API Key.</Text>
            <Text style={styles.guideStepItem}>• Escolha Auth Type: Custom e no nome do cabeçalho digite exatamente: X-Spreadsheet-Key.</Text>
            <Text style={styles.guideStepItem}>• Cole a sua chave de API gerada no campo de valor e salve.</Text>
          </View>

          <Text style={styles.guideStepTitle}>3. Configuração no Claude (Projects) / n8n / Make:</Text>
          <View style={styles.guideStepsBox}>
            <Text style={styles.guideStepItem}>• Claude Projects: Envie o link do Schema OpenAPI nas instruções do projeto, e forneça sua chave para uso nas ações.</Text>
            <Text style={styles.guideStepItem}>• Automações: Em qualquer requisição HTTP, envie o cabeçalho X-Spreadsheet-Key preenchido com a chave de API gerada.</Text>
          </View>
        </View>
      )}
    </Card>
  );
});


// ── HapticButton — Pressable with spring-scale micro-animation ──────────────

function HapticButton({
  onPress,
  style,
  children,
  disabled,
}: {
  onPress: () => void;
  style: any;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95, SPRING_CONFIG);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, SPRING_CONFIG);
  };

  return (
    <AnimatedPressable
      style={[style, animatedStyle]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
    >
      {children}
    </AnimatedPressable>
  );
}

// ── Goals Accordion ──────────────────────────────────────────────────────────

const GoalsAccordion = React.memo(function GoalsAccordion({
  goals,
  onUpdate,
}: {
  goals: TableGoals;
  onUpdate: (goals: any) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  
  // Global States
  const [globalWeekly, setGlobalWeekly] = useState(goals.globalGoals ? String(goals.globalGoals.weeklyGoal) : '');

  // Yearly States
  const [newYear, setNewYear] = useState(String(new Date().getFullYear()));
  const [newYearWeekly, setNewYearWeekly] = useState('');

  // Monthly States
  const [newMonth, setNewMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [newMonthWeekly, setNewMonthWeekly] = useState('');

  // Weekly States (for YYYY-Www overrides)
  const [newWeek, setNewWeek] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNum = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
  });
  const [newWeekWeekly, setNewWeekWeekly] = useState('');

  // ── Global Goals Handlers ──────────────────────────────────────────────────
  const handleSaveGlobal = () => {
    const val = parseFloat(globalWeekly.replace(',', '.'));
    if (isNaN(val) || val <= 0) {
      // Clear global goal
      onUpdate({
        ...goals,
        globalGoals: undefined,
      });
      setGlobalWeekly('');
      Alert.alert('Sucesso', 'Meta global removida. O sistema usará as metas anuais ou os padrões legados.');
      return;
    }

    const updatedGlobal = {
      weeklyGoal: val,
      dailyGoal: Math.round((val / 7) * 100) / 100,
      annualCost: val * 52,
    };

    onUpdate({
      ...goals,
      globalGoals: updatedGlobal,
    });
    Alert.alert('Sucesso', 'Meta global atualizada!');
  };

  // ── Yearly Overrides Handlers ──────────────────────────────────────────────
  const yearlyGoals = goals.yearlyGoals ?? {};
  const years = Object.keys(yearlyGoals).map(Number).sort((a, b) => b - a);

  const handleAddYearly = () => {
    const yearNum = parseInt(newYear, 10);
    const val = parseFloat(newYearWeekly.replace(',', '.'));
    if (!yearNum || isNaN(val) || val <= 0) {
      Alert.alert('Erro', 'Preencha o ano e valor da meta semanal.');
      return;
    }

    const updatedYearly = {
      ...yearlyGoals,
      [yearNum]: {
        weeklyGoal: val,
        dailyGoal: Math.round((val / 7) * 100) / 100,
        annualCost: val * 52,
      },
    };

    // Sync with legacy flat arrays for backward compatibility
    const updatedWeeklyGoals = { ...(goals.weeklyGoals ?? {}), [yearNum]: val };
    const updatedDailyGoals = { ...(goals.dailyGoals ?? {}), [yearNum]: Math.round((val / 7) * 100) / 100 };

    onUpdate({
      ...goals,
      yearlyGoals: updatedYearly,
      weeklyGoals: updatedWeeklyGoals,
      dailyGoals: updatedDailyGoals,
    });

    setNewYearWeekly('');
    Alert.alert('Sucesso', `Meta para o ano ${yearNum} adicionada!`);
  };

  const handleDeleteYearly = (year: number) => {
    const nextYearly = { ...yearlyGoals };
    delete nextYearly[year];

    const nextWeeklyGoals = { ...(goals.weeklyGoals ?? {}) };
    delete nextWeeklyGoals[year];

    const nextDailyGoals = { ...(goals.dailyGoals ?? {}) };
    delete nextDailyGoals[year];

    onUpdate({
      ...goals,
      yearlyGoals: nextYearly,
      weeklyGoals: nextWeeklyGoals,
      dailyGoals: nextDailyGoals,
    });
  };

  // ── Monthly Overrides Handlers ─────────────────────────────────────────────
  const monthlyGoals = goals.monthlyGoals ?? {};
  const months = Object.keys(monthlyGoals).sort().reverse();

  const handleAddMonthly = () => {
    if (!newMonth.match(/^\d{4}-\d{2}$/)) {
      Alert.alert('Erro', 'Insira o mês no formato AAAA-MM (Ex: 2026-06).');
      return;
    }
    const val = parseFloat(newMonthWeekly.replace(',', '.'));
    if (isNaN(val) || val <= 0) {
      Alert.alert('Erro', 'Insira um valor de meta válido.');
      return;
    }

    const updatedMonthly = {
      ...monthlyGoals,
      [newMonth]: {
        weeklyGoal: val,
        dailyGoal: Math.round((val / 7) * 100) / 100,
        annualCost: val * 52,
      },
    };

    onUpdate({
      ...goals,
      monthlyGoals: updatedMonthly,
    });

    setNewMonthWeekly('');
    Alert.alert('Sucesso', `Meta para o mês ${newMonth} adicionada!`);
  };

  const handleDeleteMonthly = (monthKey: string) => {
    const nextMonthly = { ...monthlyGoals };
    delete nextMonthly[monthKey];

    onUpdate({
      ...goals,
      monthlyGoals: nextMonthly,
    });
  };

  // ── Weekly Overrides Handlers ──────────────────────────────────────────────
  const weeklyOverrides = useMemo(() => {
    const list: { key: string; value: number }[] = [];
    if (!goals.weeklyGoals) return list;
    for (const key of Object.keys(goals.weeklyGoals)) {
      if (typeof key === 'string' && key.includes('-W')) {
        list.push({ key, value: goals.weeklyGoals[key] });
      }
    }
    return list.sort((a, b) => b.key.localeCompare(a.key));
  }, [goals.weeklyGoals]);

  const handleAddWeekly = () => {
    if (!newWeek.match(/^\d{4}-W\d{2}$/)) {
      Alert.alert('Erro', 'Insira a semana no formato AAAA-WSS (Ex: 2026-W26).');
      return;
    }
    const val = parseFloat(newWeekWeekly.replace(',', '.'));
    if (isNaN(val) || val <= 0) {
      Alert.alert('Erro', 'Insira um valor de meta válido.');
      return;
    }

    const updatedWeeklyGoals = {
      ...(goals.weeklyGoals ?? {}),
      [newWeek]: val,
    };

    onUpdate({
      ...goals,
      weeklyGoals: updatedWeeklyGoals,
    });

    setNewWeekWeekly('');
    Alert.alert('Sucesso', `Meta para a semana ${newWeek} adicionada!`);
  };

  const handleDeleteWeekly = (weekKey: string) => {
    const nextWeeklyGoals = { ...(goals.weeklyGoals ?? {}) };
    delete nextWeeklyGoals[weekKey];

    onUpdate({
      ...goals,
      weeklyGoals: nextWeeklyGoals,
    });
  };

  return (
    <Card>
      <Pressable
        style={styles.accordionHeader}
        onPress={() => setExpanded(!expanded)}
      >
        <Text style={styles.accordionTitle}>
          {expanded ? '▼' : '▶'} Níveis de Metas
        </Text>
        <Text style={styles.accordionCount}>
          {weeklyOverrides.length} Sem. / {Object.keys(monthlyGoals).length} Mens. / {Object.keys(yearlyGoals).length} Anual
        </Text>
      </Pressable>

      {expanded && (
        <View style={styles.accordionBody}>
          
          {/* 1. WEEKLY GOALS OVERRIDES (Priority 1) */}
          <View style={styles.goalSection}>
            <Text style={styles.subSectionTitle}>🚀 Sobrescrita por Semana</Text>
            <Text style={styles.sectionDesc}>Prioridade máxima. Substitui todas as metas para a semana específica (AAAA-WSS).</Text>
            
            {weeklyOverrides.map((item: { key: string; value: number }) => (
              <View key={item.key} style={styles.goalRow}>
                <Text style={[styles.goalYear, { width: 90 }]}>{item.key}</Text>
                <Text style={styles.goalValue}>
                  {formatCurrencySmart(item.value)} /sem
                </Text>
                <Pressable
                  onPress={() => handleDeleteWeekly(item.key)}
                  style={styles.goalDelete}
                >
                  <Text style={styles.goalDeleteText}>✕</Text>
                </Pressable>
              </View>
            ))}

            {/* Add new weekly override */}
            <View style={styles.addGoalRow}>
              <TextInput
                style={[styles.goalInput, { flex: 0.4 }]}
                value={newWeek}
                onChangeText={setNewWeek}
                placeholder="AAAA-WSS"
                placeholderTextColor={colors.text.disabled}
                keyboardType="numbers-and-punctuation"
              />
              <TextInput
                style={[styles.goalInput, { flex: 0.6 }]}
                value={newWeekWeekly}
                onChangeText={setNewWeekWeekly}
                placeholder="Meta semanal (R$)"
                placeholderTextColor={colors.text.disabled}
                keyboardType="decimal-pad"
              />
              <Pressable
                style={({ pressed }) => [styles.goalAddBtn, pressed && styles.pressed]}
                onPress={handleAddWeekly}
              >
                <Text style={styles.goalAddBtnText}>+</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.subSectionDivider} />

          {/* 2. GLOBAL GOAL */}
          <View style={styles.goalSection}>
            <Text style={styles.subSectionTitle}>🌍 Meta Global (Padrão)</Text>
            <Text style={styles.sectionDesc}>Usada como fallback geral na ausência de metas anuais ou mensais.</Text>
            <View style={styles.addGoalRow}>
              <TextInput
                style={[styles.goalInput, { flex: 1 }]}
                value={globalWeekly}
                onChangeText={setGlobalWeekly}
                placeholder="Meta Semanal Global (R$)"
                placeholderTextColor={colors.text.disabled}
                keyboardType="decimal-pad"
              />
              <Pressable
                style={({ pressed }) => [styles.goalSaveBtn, pressed && styles.pressed]}
                onPress={handleSaveGlobal}
              >
                <Text style={styles.goalAddBtnText}>Salvar</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.subSectionDivider} />

          {/* 3. YEARLY GOALS */}
          <View style={styles.goalSection}>
            <Text style={styles.subSectionTitle}>📅 Sobrescrita por Ano</Text>
            <Text style={styles.sectionDesc}>Substitui a meta global para todo o ano selecionado.</Text>
            
            {years.map((yr) => (
              <View key={yr} style={styles.goalRow}>
                <Text style={styles.goalYear}>{yr}</Text>
                <Text style={styles.goalValue}>
                  {formatCurrencySmart(yearlyGoals[yr].weeklyGoal)} /sem
                </Text>
                <Pressable
                  onPress={() => handleDeleteYearly(yr)}
                  style={styles.goalDelete}
                >
                  <Text style={styles.goalDeleteText}>✕</Text>
                </Pressable>
              </View>
            ))}

            {/* Add new yearly override */}
            <View style={styles.addGoalRow}>
              <TextInput
                style={[styles.goalInput, { flex: 0.4 }]}
                value={newYear}
                onChangeText={setNewYear}
                placeholder="Ano"
                placeholderTextColor={colors.text.disabled}
                keyboardType="number-pad"
              />
              <TextInput
                style={[styles.goalInput, { flex: 0.6 }]}
                value={newYearWeekly}
                onChangeText={setNewYearWeekly}
                placeholder="Meta semanal (R$)"
                placeholderTextColor={colors.text.disabled}
                keyboardType="decimal-pad"
              />
              <Pressable
                style={({ pressed }) => [styles.goalAddBtn, pressed && styles.pressed]}
                onPress={handleAddYearly}
              >
                <Text style={styles.goalAddBtnText}>+</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.subSectionDivider} />

          {/* 4. MONTHLY GOALS */}
          <View style={styles.goalSection}>
            <Text style={styles.subSectionTitle}>🗓️ Sobrescrita por Mês</Text>
            <Text style={styles.sectionDesc}>Substitui a meta anual e global para o mês específico (AAAA-MM).</Text>
            
            {months.map((monthKey) => (
              <View key={monthKey} style={styles.goalRow}>
                <Text style={[styles.goalYear, { width: 75 }]}>{monthKey}</Text>
                <Text style={styles.goalValue}>
                  {formatCurrencySmart(monthlyGoals[monthKey].weeklyGoal)} /sem
                </Text>
                <Pressable
                  onPress={() => handleDeleteMonthly(monthKey)}
                  style={styles.goalDelete}
                >
                  <Text style={styles.goalDeleteText}>✕</Text>
                </Pressable>
              </View>
            ))}

            {/* Add new monthly override */}
            <View style={styles.addGoalRow}>
              <TextInput
                style={[styles.goalInput, { flex: 0.4 }]}
                value={newMonth}
                onChangeText={setNewMonth}
                placeholder="AAAA-MM"
                placeholderTextColor={colors.text.disabled}
                keyboardType="numbers-and-punctuation"
              />
              <TextInput
                style={[styles.goalInput, { flex: 0.6 }]}
                value={newMonthWeekly}
                onChangeText={setNewMonthWeekly}
                placeholder="Meta semanal (R$)"
                placeholderTextColor={colors.text.disabled}
                keyboardType="decimal-pad"
              />
              <Pressable
                style={({ pressed }) => [styles.goalAddBtn, pressed && styles.pressed]}
                onPress={handleAddMonthly}
              >
                <Text style={styles.goalAddBtnText}>+</Text>
              </Pressable>
            </View>
          </View>

        </View>
      )}
    </Card>
  );
});

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  title: {
    ...typography.h2,
    color: colors.text.primary,
  } as any,
  subtitle: {
    ...typography.bodySmall,
    color: colors.text.tertiary,
    marginTop: spacing.xxs,
  } as any,

  content: { flex: 1 },
  contentInner: {
    padding: spacing.lg,
    gap: spacing.xl,
  },

  section: { gap: spacing.sm },
  sectionTitle: {
    ...typography.labelSmall,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  } as any,

  // Profile
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accent.purpleLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    ...typography.metric,
    color: colors.accent.purple,
  } as any,
  profileName: {
    ...typography.bodyLarge,
    fontWeight: '600',
    color: colors.text.primary,
  } as any,
  profileEmail: {
    ...typography.label,
    color: colors.text.secondary,
  } as any,
  tierText: {
    ...typography.labelSmall,
    color: colors.text.tertiary,
    marginTop: spacing.xxs,
  } as any,
  guestTitle: {
    ...typography.bodyLarge,
    fontWeight: '600',
    color: colors.text.primary,
  } as any,
  guestText: {
    ...typography.label,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  } as any,
  actionButton: {
    backgroundColor: colors.accent.purple,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  actionButtonText: {
    ...typography.body,
    color: '#fff',
    fontWeight: '600',
  } as any,
  syncButton: {
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.strong,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  syncButtonDisabled: {
    opacity: 0.5,
  },
  syncButtonText: {
    ...typography.label,
    color: colors.text.primary,
    fontWeight: '600',
  } as any,
  migrationTitle: {
    ...typography.bodyLarge,
    fontWeight: '600',
    color: colors.text.primary,
  } as any,
  migrationText: {
    ...typography.label,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  } as any,
  migrationButton: {
    backgroundColor: colors.accent.purple,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  migrationButtonText: {
    ...typography.label,
    color: '#fff',
    fontWeight: '600',
  } as any,
  emptyText: {
    ...typography.label,
    color: colors.text.tertiary,
  } as any,

  // Tables
  tableRow: {
    marginBottom: spacing.xs,
  },
  tableButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tableButtonActive: {
    backgroundColor: colors.accent.purpleLight,
  },
  tableName: {
    fontSize: 14,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  tableNameActive: {
    color: colors.accent.purple,
    fontWeight: '600',
  },
  tableRowCount: {
    fontSize: 11,
    color: colors.text.disabled,
  },

  // Goals Accordion
  accordionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  accordionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  accordionCount: {
    fontSize: 11,
    color: colors.text.disabled,
  },
  accordionBody: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  goalYear: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    width: 50,
  },
  goalValue: {
    fontSize: 14,
    color: colors.accent.purple,
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
    marginRight: spacing.md,
  },
  goalDelete: {
    padding: spacing.xs,
  },
  goalDeleteText: {
    color: colors.danger.main,
    fontSize: 14,
    fontWeight: '600',
  },
  addGoalRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  goalInput: {
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    color: colors.text.primary,
    fontSize: 14,
  },
  goalAddBtn: {
    backgroundColor: colors.accent.purple,
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  goalAddBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },

  // Hierarchical Goals Manager styles
  goalSection: {
    gap: spacing.xs,
  },
  subSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.primary,
  },
  sectionDesc: {
    fontSize: 11,
    color: colors.text.tertiary,
    lineHeight: 15,
  },
  subSectionDivider: {
    height: 1,
    backgroundColor: colors.border.default,
    marginVertical: spacing.sm,
  },
  goalSaveBtn: {
    backgroundColor: colors.accent.purple,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Info
  infoRow: {
    fontSize: 13,
    color: colors.text.secondary,
    marginBottom: spacing.xxs,
  },

  // Logout
  logoutButton: {
    borderWidth: 1,
    borderColor: colors.danger.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  logoutText: {
    color: colors.danger.main,
    fontSize: 14,
    fontWeight: '500',
  },
  pressed: {
    opacity: 0.75,
  },
  // Tokenomics Gauge
  gaugeTitle: {
    ...typography.h3,
    color: colors.text.primary,
  } as any,
  gaugeSubtitle: {
    ...typography.label,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  } as any,
  gaugeBalanceHighlight: {
    fontWeight: '700',
    color: colors.text.primary,
  },
  progressBarWrapper: {
    marginTop: spacing.md,
  },
  gaugeHelperText: {
    ...typography.labelSmall,
    color: colors.text.tertiary,
    marginTop: spacing.sm,
    lineHeight: 16,
  } as any,
  gaugeProStatus: {
    ...typography.labelSmall,
    color: colors.success.main,
    fontWeight: '600',
    marginTop: spacing.xs,
  } as any,
  storefrontButton: {
    backgroundColor: colors.accent.purple,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  storefrontButtonText: {
    ...typography.label,
    color: '#fff',
    fontWeight: '600',
  } as any,
  // Modal Storefront
  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  modalContainer: {
    backgroundColor: colors.background.secondary,
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
    backgroundColor: colors.background.tertiary,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },
  modalCloseButton: {
    padding: spacing.xs,
  },
  modalCloseText: {
    color: colors.text.secondary,
    fontSize: 16,
  },
  modalContent: {
    padding: spacing.md,
  },
  modalContentInner: {
    gap: spacing.md,
    paddingBottom: spacing.huge,
  },
  statusCard: {
    backgroundColor: colors.background.tertiary,
    borderRadius: radius.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  statusCardActive: {
    borderColor: colors.accent.purple,
    backgroundColor: colors.accent.purpleLight,
  },
  statusTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
  },
  statusDescription: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: spacing.xs,
    lineHeight: 16,
  },
  storeSectionTitle: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text.primary,
    marginTop: spacing.sm,
  } as any,
  emptyStoreText: {
    ...typography.bodySmall,
    color: colors.text.tertiary,
    fontStyle: 'italic',
  } as any,
  storeCard: {
    padding: spacing.md,
  },
  storeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  storeCardTitle: {
    ...typography.bodyLarge,
    fontWeight: '700',
    color: colors.text.primary,
  } as any,
  storeCardDesc: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    marginTop: spacing.xxs,
    maxWidth: 250,
  } as any,
  storeCardPrice: {
    ...typography.metricSmall,
    fontWeight: '700',
    color: colors.accent.purple,
  } as any,
  buyButton: {
    backgroundColor: colors.accent.purple,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  buyButtonConsumable: {
    backgroundColor: colors.success.main,
  },
  buyButtonText: {
    ...typography.label,
    color: '#fff',
    fontWeight: '600',
  } as any,
  bestValueBadge: {
    backgroundColor: colors.accent.purple,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.xs,
    marginTop: spacing.xs,
  },
  bestValueBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  restorePurchasesBtn: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  restorePurchasesText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.text.secondary,
  },
  passwordLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  passwordInput: {
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text.primary,
    fontSize: 14,
    marginTop: spacing.xs,
    width: '100%',
  },
  passwordErrorText: {
    color: colors.danger.main,
    fontSize: 12,
    marginTop: spacing.sm,
    fontWeight: '600',
  },
  apiCard: {
    padding: spacing.md,
  },
  apiDescription: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    lineHeight: 18,
    marginBottom: spacing.md,
  } as any,
  keyContainer: {
    gap: spacing.sm,
  },
  keyLabel: {
    ...typography.bodyMedium,
    fontWeight: '600',
    color: colors.text.primary,
  } as any,
  keyHintText: {
    color: colors.accent.purple,
    fontWeight: '700',
  },
  rawKeyBox: {
    marginTop: spacing.xs,
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.strong,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  rawKeyLabel: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.text.secondary,
  } as any,
  rawKeyInput: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.sm,
    padding: spacing.sm,
    color: colors.text.primary,
    fontFamily: 'monospace',
    fontSize: 12,
  },
  copyBtn: {
    backgroundColor: colors.accent.purple,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  copyBtnSuccess: {
    backgroundColor: colors.success.main,
  },
  copyBtnText: {
    ...typography.label,
    color: '#fff',
    fontWeight: '600',
  } as any,
  rawKeyWarning: {
    fontSize: 10,
    color: colors.danger.main,
    fontStyle: 'italic',
    lineHeight: 14,
    marginTop: spacing.xxs,
  },
  generateBtn: {
    backgroundColor: colors.accent.purple,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  generateBtnText: {
    ...typography.label,
    color: '#fff',
    fontWeight: '600',
  } as any,
  regenerateBtn: {
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.strong,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  regenerateBtnText: {
    ...typography.label,
    color: colors.text.secondary,
    fontWeight: '600',
  } as any,
  guideHeader: {
    marginTop: spacing.md,
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.strong,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  guideHeaderTitle: {
    ...typography.bodyMedium,
    fontWeight: '700',
    color: colors.accent.purple,
  } as any,
  guideContent: {
    marginTop: spacing.sm,
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.strong,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  guideStepTitle: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: colors.text.primary,
    marginTop: spacing.xs,
  } as any,
  guideText: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    lineHeight: 16,
  } as any,
  copySchemaBtn: {
    backgroundColor: colors.accent.purple,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    alignItems: 'center',
    marginTop: spacing.xxs,
    marginBottom: spacing.xs,
  },
  copySchemaBtnText: {
    ...typography.label,
    color: '#fff',
    fontWeight: '600',
  } as any,
  guideStepsBox: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.sm,
    padding: spacing.sm,
    gap: spacing.xxs,
  },
  guideStepItem: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    lineHeight: 16,
  } as any,
  boldText: {
    fontWeight: '700',
    color: colors.text.primary,
  },
});
