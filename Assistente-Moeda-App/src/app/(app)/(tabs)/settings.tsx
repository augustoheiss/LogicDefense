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
import { SyncAuditPanel, APIManagementTester } from '@/components/ui';
import { formatCurrencySmart } from '@/core/formatCurrency';
import { validateMobileLicenseKey, getStoredLicenseKey } from '@/storage/authService';
import { ensureApiKeyForTable, generateLocalApiKey, buildCSV, shareCSVText } from '@/services/exportService';
import { validateApiKey, generateNewApiKey, formatTimeRemaining } from '@/services/apiKeyService';
import type { TableGoals, CoinTable } from '@/core/types';

const API_URL = process.env.EXPO_PUBLIC_AI_BACKEND_URL || process.env.EXPO_PUBLIC_API_URL || 'https://ocorrencias-pdf-writer.onrender.com';

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
  const hasActiveLicense = Boolean(auth.profile?.licenseKey && auth.profile?.premiumTier && auth.profile?.premiumTier !== 'free');
  const maxTokens = hasActiveLicense && auth.profile?.tokenCap !== undefined && auth.profile?.tokenCap !== null
    ? auth.profile.tokenCap
    : 0;
  const tokenBalance = hasActiveLicense ? (auth.profile?.tokenBalance ?? 0) : 0;
  const isGodMode = maxTokens === -1 || tokenBalance >= 999_000_000 || auth.profile?.premiumTier === 'godmode_owner' || auth.profile?.premiumTier === 'admin';

  const [showStoreModal, setShowStoreModal] = useState(false);
  const [showDebugger, setShowDebugger] = useState(false);

  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // License Key activation & email recovery states
  const [inputLicenseKey, setInputLicenseKey] = useState('');
  const [isValidatingKey, setIsValidatingKey] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [isRecoveringKey, setIsRecoveringKey] = useState(false);

  // Table management states
  const [newTableName, setNewTableName] = useState('');
  const [editingTableId, setEditingTableId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const handleDownloadBackup = async () => {
    if (!db.activeTable) {
      Alert.alert('Aviso', 'Nenhuma planilha ativa selecionada.');
      return;
    }
    try {
      const csv = buildCSV(
        db.activeTable.rows,
        db.activeTable.name,
        db.activeTable.description,
        db.activeTable.goals,
        db.activeTable.id
      );
      await shareCSVText(csv, db.activeTable.name);
    } catch (e: any) {
      Alert.alert('Erro', e?.message || 'Falha ao gerar o arquivo de backup.');
    }
  };

  const handleValidateKey = async () => {
    if (!inputLicenseKey.trim()) {
      Alert.alert('Erro', 'Por favor, digite uma chave de licença.');
      return;
    }
    setIsValidatingKey(true);
    try {
      const res = await validateMobileLicenseKey(inputLicenseKey.trim(), API_URL);
      if (res.valid) {
        await auth.refreshProfile();
        if (Platform.OS === 'web') {
          window.alert('Chave de Licença ativada com sucesso!');
        } else {
          Alert.alert('Sucesso', 'Chave de Licença ativada com sucesso!');
        }
        setInputLicenseKey('');
      } else {
        if (Platform.OS === 'web') {
          window.alert(res.message || 'Chave inválida.');
        } else {
          Alert.alert('Erro', res.message || 'Chave inválida.');
        }
      }
    } catch (err: any) {
      console.error(err);
      if (Platform.OS === 'web') {
        window.alert('Falha ao validar a chave. Tente novamente.');
      } else {
        Alert.alert('Erro', 'Falha ao validar a chave. Tente novamente.');
      }
    } finally {
      setIsValidatingKey(false);
    }
  };

  const handleRecoverKey = async () => {
    if (!recoveryEmail.trim() || !recoveryEmail.includes('@')) {
      Alert.alert('Erro', 'Por favor, digite um e-mail válido.');
      return;
    }
    setIsRecoveringKey(true);
    try {
      const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL || 'https://logicdefense-api.onrender.com';
      const response = await fetch(`${apiBaseUrl}/api/license/recover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: recoveryEmail.trim() }),
      });
      const data = await response.json();
      const msg = data.message || 'Se existir alguma chave associada a este e-mail, ela foi enviada para sua caixa de entrada.';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Recuperação de Licença', msg);
      }
      setRecoveryEmail('');
    } catch (err: any) {
      const errMsg = 'Falha ao se conectar com o servidor. Tente novamente.';
      if (Platform.OS === 'web') {
        window.alert(errMsg);
      } else {
        Alert.alert('Erro', errMsg);
      }
    } finally {
      setIsRecoveringKey(false);
    }
  };

  const handleAddTable = () => {
    if (!newTableName.trim()) {
      Alert.alert('Erro', 'O nome da planilha não pode estar vazio.');
      return;
    }
    db.addTable(newTableName.trim());
    setNewTableName('');
  };

  const handleStartRenameTable = (t: CoinTable) => {
    setEditingTableId(t.id);
    setRenameValue(t.name);
  };

  const handleSaveRenameTable = (id: string) => {
    if (!renameValue.trim()) {
      Alert.alert('Erro', 'O nome da planilha não pode estar vazio.');
      return;
    }
    db.renameTable(id, renameValue.trim());
    setEditingTableId(null);
  };

  const handleDeleteTable = (t: CoinTable) => {
    if (db.activeTables.length <= 1) {
      Alert.alert('Aviso', 'Você precisa ter pelo menos uma planilha ativa.');
      return;
    }
    const deleteAction = () => {
      db.deleteTable(t.id);
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`Deseja excluir a planilha "${t.name}" e todas as suas entradas?`)) {
        deleteAction();
      }
    } else {
      Alert.alert(
        'Excluir Planilha',
        `Tem certeza que deseja excluir a planilha "${t.name}"? Isso apagará todos os dados dela permanentemente.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Excluir', style: 'destructive', onPress: deleteAction },
        ]
      );
    }
  };

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
  }, []);

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
                    ? `Chave: ${auth.profile.licenseKey}` 
                    : 'Dados salvos 100% no dispositivo local'}
                </Text>
                <Text style={styles.tierText}>
                  {auth.isPremium ? '⭐ Motor de IA e Consultor Liberados' : '🔒 Insira uma Chave Pro para ativar o Assistente de IA'}
                </Text>
              </View>
            </View>

            {/* License Key input / activation */}
            <View style={styles.licenseInputContainer}>
              <Text style={styles.licenseInputLabel}>Ativar Nova Chave de Licença</Text>
              <View style={styles.licenseInputRow}>
                <TextInput
                  style={styles.licenseInput}
                  value={inputLicenseKey}
                  onChangeText={setInputLicenseKey}
                  placeholder="am_pro_..."
                  placeholderTextColor={colors.text.disabled}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Pressable
                  style={({ pressed }) => [
                    styles.licenseBtn,
                    isValidatingKey && { opacity: 0.6 },
                    pressed && styles.pressed,
                  ]}
                  onPress={handleValidateKey}
                  disabled={isValidatingKey}
                >
                  <Text style={styles.licenseBtnText}>
                    {isValidatingKey ? '⏳' : 'Ativar'}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Email License Recovery Box */}
            <View style={styles.recoveryBox}>
              <Text style={styles.recoveryTitle}>📩 Perdeu sua Chave de Licença?</Text>
              <Text style={styles.recoveryText}>
                Digite o e-mail utilizado no Checkout do Stripe para receber todas as suas chaves cadastradas na sua caixa de entrada.
              </Text>
              <View style={styles.licenseInputRow}>
                <TextInput
                  style={styles.licenseInput}
                  value={recoveryEmail}
                  onChangeText={setRecoveryEmail}
                  placeholder="seu-email@exemplo.com"
                  placeholderTextColor={colors.text.disabled}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <Pressable
                  style={({ pressed }) => [
                    styles.recoveryBtn,
                    isRecoveringKey && { opacity: 0.6 },
                    pressed && styles.pressed,
                  ]}
                  onPress={handleRecoverKey}
                  disabled={isRecoveringKey}
                >
                  <Text style={styles.licenseBtnText}>
                    {isRecoveringKey ? '⏳ Enviando...' : 'Enviar Chave'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </Card>
        </Section>

        {/* ── Backup & Safety Advice (Golden Warning) ─────────────── */}
        <Section title="🛡️ Segurança & Backups (.csv)">
          <Card style={styles.backupAdviceCard}>
            <View style={styles.backupHeaderRow}>
              <Text style={styles.backupIcon}>💡</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.backupTitle}>Dica de Ouro: Exporte seus Backups em .CSV</Text>
                <Text style={styles.backupSubtitle}>Sua máquina do tempo pessoal contra imprevistos</Text>
              </View>
            </View>

            <Text style={styles.backupBodyText}>
              Se você gostou da organização atual da sua planilha, <Text style={styles.boldWhite}>baixe um backup em .csv agora mesmo</Text>.
            </Text>

            <Text style={styles.backupBodyText}>
              Uma faísca ou comando da IA pode alterar ou reestruturar pequenas planilhas em milésimos de segundos, criando novas fórmulas ou visões diferentes — e, às vezes, até alucinações. Se algum imprevisto acontecer, um backup <Text style={styles.backupCode}>.csv</Text> salvo no seu computador é a sua <Text style={styles.boldWhite}>garantia mais segura</Text> para retornar no tempo e restaurar exatamente o que estava funcionando perfeitamente.
            </Text>

            {db.activeTable && (
              <Pressable
                style={({ pressed }) => [
                  styles.backupDownloadBtn,
                  pressed && styles.pressed,
                ]}
                onPress={handleDownloadBackup}
              >
                <Text style={styles.backupDownloadBtnText}>
                  📥 Baixar Backup de "{db.activeTable.name}" ({db.activeTable.rows.length} itens)
                </Text>
              </Pressable>
            )}

            <Text style={styles.backupFooterText}>
              ℹ️ Você pode importar este arquivo .csv a qualquer momento na tela inicial para restaurar sua planilha intacta.
            </Text>
          </Card>
        </Section>

        {/* ── AI Engine Section (Fuel Gauge) ───────────────── */}
        <Section title="⚡ Motor de Inteligência Artificial">
          <Card glow>
            <Text style={styles.gaugeTitle}>Consumo de Tokens da IA</Text>
            <Text style={styles.gaugeSubtitle}>
              {!hasActiveLicense ? (
                <Text style={styles.gaugeBalanceHighlight}>Sem licença Pro ativa (Acesso Gratuito Local)</Text>
              ) : isGodMode ? (
                <Text style={styles.gaugeBalanceHighlight}>Saldo: ∞ (God Mode / Ilimitado)</Text>
              ) : (
                <>Saldo: <Text style={styles.gaugeBalanceHighlight}>{tokenBalance.toLocaleString('pt-BR')}</Text> / {maxTokens.toLocaleString('pt-BR')} tokens</>
              )}
            </Text>
            
            <View style={styles.progressBarWrapper}>
              <TokenProgressBar current={tokenBalance} max={maxTokens} />
            </View>
            
            <Text style={styles.gaugeHelperText}>
              O aplicativo e o Módulo Preditivo são 100% gratuitos e open-source. A Chave PRO recarrega créditos exclusivamente para interagir com o Consultor de IA Gemini no nosso servidor. Você também pode integrar agentes externos de graça usando Chaves de API de Planilhas.
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

        {/* ── Real-Time Sync & Audit Panel ─────────────────── */}
        <Section title="⚡ Auditoria & Sincronismo em Tempo Real">
          <SyncAuditPanel />
        </Section>

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
            {db.activeTables.length === 0 ? (
              <Text style={styles.emptyText}>Nenhuma tabela criada</Text>
            ) : (
              db.activeTables.map((t, index) => {
                const isActive = t.id === db.activeTable?.id;
                const isEditing = t.id === editingTableId;

                return (
                  <View key={t.id} style={[styles.tableRowContainer, isActive && styles.tableRowActive]}>
                    {isEditing ? (
                      <View style={styles.renameRow}>
                        <TextInput
                          style={styles.renameInput}
                          value={renameValue}
                          onChangeText={setRenameValue}
                          autoFocus
                        />
                        <Pressable
                          style={[styles.actionBtn, styles.saveBtn]}
                          onPress={() => handleSaveRenameTable(t.id)}
                        >
                          <Text style={styles.actionBtnText}>✓</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.actionBtn, styles.cancelBtn]}
                          onPress={() => setEditingTableId(null)}
                        >
                          <Text style={styles.actionBtnText}>✕</Text>
                        </Pressable>
                      </View>
                    ) : (
                      <View style={styles.tableCardContent}>
                        <Pressable
                          style={styles.tableSelectArea}
                          onPress={() => db.setActiveTableIndex(index)}
                        >
                          <Text style={[styles.tableName, isActive && styles.tableNameActive]}>
                            {isActive ? '● ' : '○ '}
                            {t.name}
                          </Text>
                          <Text style={styles.tableRowCount}>{t.rows.length} entradas</Text>
                        </Pressable>

                        <View style={styles.cardActions}>
                          {/* Reorder Up/Down */}
                          <View style={styles.reorderGroup}>
                            <Pressable
                              style={[styles.iconBtn, index === 0 && styles.disabledBtn]}
                              onPress={() => db.reorderTables(index, index - 1)}
                              disabled={index === 0}
                              accessibilityLabel="Mover para cima"
                            >
                              <Text style={[styles.iconText, index === 0 && styles.disabledText]}>▲</Text>
                            </Pressable>
                            <Pressable
                              style={[styles.iconBtn, index === db.activeTables.length - 1 && styles.disabledBtn]}
                              onPress={() => db.reorderTables(index, index + 1)}
                              disabled={index === db.activeTables.length - 1}
                              accessibilityLabel="Mover para baixo"
                            >
                              <Text style={[styles.iconText, index === db.activeTables.length - 1 && styles.disabledText]}>▼</Text>
                            </Pressable>
                          </View>

                          <Pressable
                            style={styles.iconBtn}
                            onPress={() => handleStartRenameTable(t)}
                            accessibilityLabel="Renomear"
                          >
                            <Text style={styles.iconText}>✏️</Text>
                          </Pressable>
                          <Pressable
                            style={styles.iconBtn}
                            onPress={() => handleDeleteTable(t)}
                            accessibilityLabel="Excluir"
                          >
                            <Text style={[styles.iconText, styles.dangerText]}>🗑️</Text>
                          </Pressable>
                        </View>
                      </View>
                    )}
                  </View>
                );
              })
            )}

            {/* Criar Nova Planilha form directly in Settings */}
            <View style={styles.addTableSection}>
              <Text style={styles.addTableLabel}>Criar Nova Planilha</Text>
              <View style={styles.addTableInputRow}>
                <TextInput
                  style={styles.addTableInput}
                  value={newTableName}
                  onChangeText={setNewTableName}
                  placeholder="Nome da planilha..."
                  placeholderTextColor={colors.text.disabled}
                  onSubmitEditing={handleAddTable}
                  returnKeyType="done"
                />
                <Pressable
                  style={({ pressed }) => [
                    styles.addTableBtn,
                    pressed && styles.pressed,
                  ]}
                  onPress={handleAddTable}
                >
                  <Text style={styles.addTableBtnText}>+ Criar</Text>
                </Pressable>
              </View>
            </View>
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

const SpreadsheetApiSection = React.memo(function SpreadsheetApiSection({
  tableId,
  onShowStore,
}: {
  tableId: string;
  onShowStore: () => void;
}) {
  const router = useRouter();
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [keyHint, setKeyHint] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [selectedTtlDays, setSelectedTtlDays] = useState<number>(1);
  const [timeRemaining, setTimeRemaining] = useState<{ formatted: string; expired: boolean; urgent: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [copiedSchema, setCopiedSchema] = useState(false);
  const [showApiConsoleModal, setShowApiConsoleModal] = useState(false);

  const [selectedPromptTab, setSelectedPromptTab] = useState<number>(0);
  const [copiedPromptIndex, setCopiedPromptIndex] = useState<number | null>(null);

  const handleCopySchema = async () => {
    const schemaUrl = `${API_URL}/api/v1/public/openapi.json`;
    await Clipboard.setStringAsync(schemaUrl);
    setCopiedSchema(true);
    setTimeout(() => setCopiedSchema(false), 2000);
  };

  const handleCopyPrompt = async (index: number, text: string) => {
    await Clipboard.setStringAsync(text);
    setCopiedPromptIndex(index);
    setTimeout(() => setCopiedPromptIndex(null), 2500);
  };

  const SYSTEM_PROMPTS = useMemo(() => [
    {
      title: '🏛️ CFO Executivo',
      subtitle: 'Auditoria Estratégica, DRE, CDI & Projeções C-Level',
      tag: 'Estratégico',
      badgeColor: '#3b82f6',
      description: 'Consultoria financeira C-Level com análise de DRE, ponto de equilíbrio, investimentos CDI (0.8%/mês) e estatísticas avançadas.',
      content: `Você é o Assistente Moeda — CFO Estratégico, Auditor e Analista Financeiro Principal.
Você tem acesso aos dados contábeis em tempo real através da API (cabeçalho X-Spreadsheet-Key).

CONTEXTO & PERFIL DO USUÁRIO:
Você está apoiando alguém que gerencia suas finanças pessoais e profissionais com disciplina e estratégia. O usuário acompanha receitas, despesas e metas operacionais de forma meticulosa. Trate-o como alguém que entende seus números e busca análises de alto nível (C-Level), sem explicações básicas ou simplórias.

DIRETRIZES DE ANÁLISE & RIGOR TÉCNICO:
1. NÚMEROS EXATOS & RIGOR ESTATÍSTICO:
   - Use os números exatos fornecidos no snapshot da API (/analysis-context). NUNCA invente dados.
   - Formate valores monetários rigorosamente como R$ X.XXX,XX (padrão brasileiro).
   - Analise estatísticas avançadas: Maior/Menor transação, Mediana, Moda e Desvio Padrão.
2. DIAGNÓSTICO DE FLUXO & DRE ESTRUTURAL:
   - Receita Operacional Bruta vs. Custos Fixos e Variáveis.
   - Ponto de Equilíbrio (Break-even operacional diário e mensal).
   - Risco de Concentração por Categorias com médias estruturais globais (primeira→última entrada).
3. PORTFÓLIO DE INVESTIMENTOS & JUROS COMPOSTOS:
   - Analise o saldo de aportes acumulados e rendimentos a 0.8%/mês (benchmark CDI).
4. CENÁRIOS PROJETADOS & SIMULAÇÕES:
   - Compare o histórico real com cenários futuros sintéticos (Realista, Otimista, Conservador) e aponte se o ritmo atual sustenta as metas de longo prazo.
5. REGRA DE PASSTHROUGH (PARCERIAS):
   - Entradas e saídas de parceria (partner_in / partner_out) são estritamente repasses — NÃO representam a capacidade operacional do usuário. Analise o desempenho estritamente com base nas métricas operacionais puras.
6. PLANO DE AÇÃO EXECUTIVO:
   - Conclua sempre com 3 a 5 recomendações executivas concretas para maximizar a margem de lucro e blindar o fluxo de caixa.`,
    },
    {
      title: '⚡ Agente Operacional',
      subtitle: 'God Mode, Function Calling & Ingestão em Lote',
      tag: 'Automação',
      badgeColor: '#eab308',
      description: 'Ideal para processar notas, faturas, extratos e responder estritamente com blocos JSON prontos para a rota batch-sync.',
      content: `Você é o Assistente Moeda — Agente Operacional Executivo e Processador de Entradas.
Você tem acesso à API para envio e mutação de dados na planilha (cabeçalho X-Spreadsheet-Key).

SUA MISSÃO:
Processar notas, faturas, extratos bancários, listas de despesas e comandos em linguagem natural, convertendo-os em ações executivas estruturadas.

AÇÕES EXECUTIVAS (GOD MODE / FUNCTION CALLING):
Se o usuário pedir explicitamente para adicionar, registrar ou lançar transações, RESPONDA ÚNICA E EXCLUSIVAMENTE COM O BLOCO JSON CORRESPONDENTE. Não inclua saudações nem texto explicativo.

1. Transação Única:
\`\`\`json
{
  "action": "add_transaction",
  "parameters": {
    "description": "Descrição clara do item",
    "value": -150.00,
    "date": "YYYY-MM-DD",
    "period_start": "YYYY-MM-DD",
    "period_end": "YYYY-MM-DD"
  }
}
\`\`\`

2. Lançamento em Lote / Extratos / Faturas (bulk_add_transactions):
\`\`\`json
{
  "action": "bulk_add_transactions",
  "parameters": {
    "transactions": [
      { "description": "Item 1", "value": -50.00, "date": "YYYY-MM-DD" },
      { "description": "Receita 2", "value": 1200.00, "date": "YYYY-MM-DD" }
    ]
  }
}
\`\`\`

DIRETRIZES DE FORMATAÇÃO & EXECUÇÃO:
1. SINALIZAÇÃO MONETÁRIA:
   - Despesas / Saídas de caixa DEVEM ser números NEGATIVOS (ex: -120.50).
   - Receitas / Entradas de caixa DEVEM ser números POSITIVOS (ex: 2500.00).
2. LANÇAMENTOS PERIÓDICOS:
   - Se um gasto/receita abranger um período (ex: seguro anual, anuidade, assinatura de 12 meses), crie UMA ÚNICA transação com period_start e period_end preenchidos. Para gastos pontuais (ex: almoço), omita esses campos.
3. SEM IDs MANUAIS:
   - NUNCA gere campos 'id' ou UUIDs. Eles são gerados deterministicamente pelo servidor.
4. CATEGORIZAÇÃO PADRÃO:
   - Normalize descrições em categorias estruturadas (ex: DIVERSOS, SERVIÇOS, INFRAESTRUTURA, PESSOAL, BANCOS, UTILITÁRIOS).`,
    },
    {
      title: '🎯 Metas & Tempo',
      subtitle: 'Banco de Tempo, Produtividade & Burnout Shield',
      tag: 'Performance',
      badgeColor: '#10b981',
      description: 'Análise de semanas de crédito/débito, rentabilidade real por hora trabalhada e orientações de ritmo sustentável de trabalho.',
      content: `Você é o Assistente Moeda — Estrategista de Produtividade, Metas e Banco de Tempo.
Você correlaciona o desempenho financeiro com o esforço e a sustentabilidade da rotina de trabalho.

SUA MISSÃO:
Garantir que as metas financeiras sejam atingidas com a máxima eficiência, otimizando o "Banco de Tempo" e prevenindo sobrecarga operacional.

DIRETRIZES DE AVALIAÇÃO & BANCO DE TEMPO:
1. BANCO DE TEMPO (SEMANAS DE CRÉDITO / DÉBITO):
   - Calcule o saldo acumulado de semanas de crédito vs. déficit em relação à meta semanal.
   - Avalie o balanço de metas (excedente real acumulado vs. gap operacional).
2. EFICIÊNCIA OPERACIONAL & VALOR DA HORA:
   - Calcule o rendimento gerado por esforço operacional e identifique quais projetos/clientes entregam maior rentabilidade.
   - Desconsidere repasses de parcerias (passthrough) para medir a capacidade produtiva pura.
3. BURNOUT SHIELD & SUSTENTABILIDADE:
   - Alerte com antecedência se a rotina de trabalho estiver em ritmo insustentável.
   - Indique se há folga no Banco de Tempo para descanso programado sem comprometer as metas anuais.
4. RECOMENDAÇÕES DE CALENDÁRIO:
   - Informe exatamente quantos dias trabalhar e com qual meta diária atuar nas próximas semanas para manter o plano 100% equilibrado.`,
    },
    {
      title: '🛠️ Agente Dev / Script',
      subtitle: 'Passo a Passo Oficial para IAs Desenvolvedoras & Scripts',
      tag: 'Dev / Cursor / Claude Code',
      badgeColor: '#8b5cf6',
      description: 'Instrução completa com endpoints, cabeçalhos e procedimentos padronizados para Claude Code, Cursor, Python CLI e scripts.',
      content: `Você é o Agente Integrador e Desenvolvedor Oficial conectado à planilha via Assistente Moeda API.

DADOS DE CONEXÃO:
- Endpoint Base: ${API_URL}
- OpenAPI Schema: ${API_URL}/api/v1/public/openapi.json
- Autenticação: Envie em TODAS as requisições o cabeçalho HTTP:
  X-Spreadsheet-Key: ${apiKey || '<SUA_CHAVE_API_AQUI>'}

PROCEDIMENTO PADRÃO OBRIGATÓRIO:
1. VALIDAÇÃO DE CONEXÃO & SNAPSHOT (Passo 1):
   - Antes de qualquer ação, realize um GET em ${API_URL}/api/v1/public/analysis-context com o header X-Spreadsheet-Key.
   - Isso retorna a DRE completa, metas ativas, estatísticas avançadas e transações recentes compiladas em memória.
2. LEITURA E CONSULTAS ESPECÍFICAS:
   - Para resumo rápido de totais: GET ${API_URL}/api/v1/public/summary
   - Para listar transações filtradas: GET ${API_URL}/api/v1/public/transactions?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
3. LANÇAMENTO OU MODIFICAÇÃO DE DADOS:
   - Para criar 1 transação: POST ${API_URL}/api/v1/public/transactions (body: {"description": "...", "value": -50.0, "date": "YYYY-MM-DD"})
   - Para sincronismo em lote: POST ${API_URL}/api/v1/public/transactions/batch-sync (body: {"transactions": [...]})
4. BOAS PRÁTICAS DE AMBIENTE:
   - Não crie arquivos temporários soltos na raiz sem necessidade.
   - Sempre confirme as alterações realizadas com um resumo claro dos valores e saldo atualizado.`,
    },
  ], [apiKey]);

  const fetchActiveKey = useCallback(async () => {
    setLoading(true);
    try {
      let localKey: string | null = null;
      let localExp: string | null = null;
      if (typeof window !== 'undefined' && window.localStorage) {
        localKey = window.localStorage.getItem(`coin_api_key_${tableId}`);
        localExp = window.localStorage.getItem(`coin_expires_at_${tableId}`);
      }

      if (!localKey || !localKey.startsWith('am_sheet_live_')) {
        const key = await ensureApiKeyForTable(tableId);
        localKey = key;
        if (typeof window !== 'undefined' && window.localStorage) {
          localExp = window.localStorage.getItem(`coin_expires_at_${tableId}`);
        }
      }

      if (localKey && localKey.startsWith('am_sheet_live_')) {
        setApiKey(localKey);
        setKeyHint(`...${localKey.slice(-4)}`);
        setExpiresAt(localExp);

        // Valida no backend se a chave está ativa e se tem TTL
        validateApiKey(localKey).then(async (valRes) => {
          if (valRes.valid && valRes.expiresAt) {
            setExpiresAt(valRes.expiresAt);
            if (typeof window !== 'undefined' && window.localStorage) {
              window.localStorage.setItem(`coin_expires_at_${tableId}`, valRes.expiresAt);
            }
          } else {
            // Chave expirada, revogada ou ainda não registrada no backend Turso -> Gera nova de 1 dia!
            const storedLicenseKey = await getStoredLicenseKey();
            const newRes = await generateNewApiKey(tableId, storedLicenseKey || undefined, 1);
            if (newRes) {
              setApiKey(newRes.apiKey);
              setKeyHint(newRes.keyHint);
              setExpiresAt(newRes.expiresAt || null);
              if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.setItem(`coin_api_key_${tableId}`, newRes.apiKey);
                window.localStorage.setItem('coin_active_api_key', newRes.apiKey);
                if (newRes.expiresAt) {
                  window.localStorage.setItem(`coin_expires_at_${tableId}`, newRes.expiresAt);
                }
              }
            }
          }
        });
      } else {
        setKeyHint(null);
        setExpiresAt(null);
        setApiKey(null);
      }
      setCopied(false);
    } catch (e) {
      console.warn('Erro ao carregar dica da chave API:', e);
    } finally {
      setLoading(false);
    }
  }, [tableId]);

  useEffect(() => {
    fetchActiveKey();

    if (typeof window !== 'undefined') {
      const handleSync = () => fetchActiveKey();
      window.addEventListener('coin_sync_requested', handleSync);
      window.addEventListener('storage', handleSync);
      return () => {
        window.removeEventListener('coin_sync_requested', handleSync);
        window.removeEventListener('storage', handleSync);
      };
    }
  }, [tableId, fetchActiveKey]);

  // Live countdown ticker & background auto-renewal
  useEffect(() => {
    if (!expiresAt) {
      setTimeRemaining(null);
      return;
    }

    const updateTicker = () => {
      const remaining = formatTimeRemaining(expiresAt);
      setTimeRemaining(remaining);

      if (remaining.expired && apiKey) {
        getStoredLicenseKey().then((licKey) => {
          generateNewApiKey(tableId, licKey || undefined, 1).then((res) => {
            if (res) {
              setApiKey(res.apiKey);
              setKeyHint(res.keyHint);
              setExpiresAt(res.expiresAt || null);
              if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.setItem(`coin_api_key_${tableId}`, res.apiKey);
                window.localStorage.setItem('coin_active_api_key', res.apiKey);
                if (res.expiresAt) {
                  window.localStorage.setItem(`coin_expires_at_${tableId}`, res.expiresAt);
                }
              }
            }
          });
        });
      }
    };

    updateTicker();
    const timer = setInterval(updateTicker, 1000);
    return () => clearInterval(timer);
  }, [expiresAt, tableId, apiKey]);

  const handleCopy = async () => {
    if (apiKey) {
      await Clipboard.setStringAsync(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const generateKey = async () => {
    if (keyHint || apiKey) {
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
      const storedLicenseKey = await getStoredLicenseKey();
      const headers: any = {
        'Content-Type': 'application/json',
      };
      if (storedLicenseKey) {
        headers['X-License-Key'] = storedLicenseKey;
      }

      const response = await fetch(`${API_URL}/api/v1/api-keys/generate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          table_id: tableId,
          license_key: storedLicenseKey || undefined,
          permissions: 'read:write',
          ttl_days: selectedTtlDays,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        let errMsg = errText;
        try {
          const errJson = JSON.parse(errText);
          if (typeof errJson.detail === 'string') {
            errMsg = errJson.detail;
          } else if (Array.isArray(errJson.detail)) {
            errMsg = errJson.detail[0]?.msg || errText;
          }
        } catch (e) {}

        if (response.status === 401 || response.status === 403 || errMsg.includes("PRO") || errMsg.includes("Licença")) {
          if (Platform.OS === 'web') {
            window.alert(errMsg || "Uma Chave de Licença PRO ativa é necessária para gerar chaves de API externa!");
          } else {
            Alert.alert(
              "Licença Necessária",
              errMsg || "Uma Chave de Licença PRO ativa é necessária para gerar chaves de API externa.",
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
      const newKey = resData.api_key || resData.apiKey;
      const newExp = resData.expires_at || resData.expiresAt;
      setApiKey(newKey);
      setKeyHint(resData.key_hint || resData.keyHint || `...${newKey.slice(-4)}`);
      setExpiresAt(newExp || null);
      setCopied(false);

      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(`coin_api_key_${tableId}`, newKey);
        window.localStorage.setItem('coin_active_api_key', newKey);
        if (newExp) {
          window.localStorage.setItem(`coin_expires_at_${tableId}`, newExp);
        }
      }
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

  const renderTtlPicker = () => (
    <View style={{ marginTop: spacing.sm, marginBottom: spacing.xs }}>
      <Text style={{ fontSize: 11, fontWeight: '600', color: colors.text.secondary, marginBottom: 4 }}>
        Validade da Nova Chave:
      </Text>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {[
          { label: '1 Dia (Padrão)', value: 1 },
          { label: '7 Dias', value: 7 },
          { label: '30 Dias', value: 30 },
        ].map((option) => {
          const active = selectedTtlDays === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => setSelectedTtlDays(option.value)}
              style={{
                flex: 1,
                paddingVertical: 6,
                paddingHorizontal: 4,
                borderRadius: 6,
                backgroundColor: active ? colors.accent.purple : colors.background.tertiary,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: active ? colors.accent.purple : colors.border.default,
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: active ? '700' : '500',
                  color: active ? '#ffffff' : colors.text.primary,
                }}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  return (
    <Card style={styles.apiCard}>
      <Text style={styles.apiDescription}>
        Conecte esta planilha a IAs externas (como ChatGPT ou Claude) e ferramentas de automação (Make, n8n) para ler ou adicionar transações.
      </Text>

      {/* Indicador de Validade / Tempo Restante em Horas */}
      {timeRemaining ? (
        <View
          style={{
            marginBottom: spacing.xs,
            paddingVertical: 7,
            paddingHorizontal: 12,
            borderRadius: radius.sm,
            backgroundColor: timeRemaining.expired
              ? 'rgba(239, 68, 68, 0.18)'
              : timeRemaining.urgent
                ? 'rgba(245, 158, 11, 0.18)'
                : 'rgba(34, 197, 94, 0.18)',
            borderWidth: 1,
            borderColor: timeRemaining.expired
              ? '#ef4444'
              : timeRemaining.urgent
                ? '#f59e0b'
                : '#22c55e',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Text
            style={{
              fontSize: 12,
              fontWeight: '700',
              color: timeRemaining.expired
                ? '#f87171'
                : timeRemaining.urgent
                  ? '#fbbf24'
                  : '#4ade80',
            }}
          >
            ⏳ Validade da Chave: {timeRemaining.formatted}
          </Text>
          {timeRemaining.expired ? (
            <Text style={{ fontSize: 10, color: '#f87171', fontWeight: '700' }}>
              ⚠️ Expirada
            </Text>
          ) : (
            <Text style={{ fontSize: 10, color: '#4ade80', fontWeight: '600' }}>
              ✓ Ativa
            </Text>
          )}
        </View>
      ) : (
        <View
          style={{
            marginBottom: spacing.xs,
            paddingVertical: 6,
            paddingHorizontal: 12,
            borderRadius: radius.sm,
            backgroundColor: 'rgba(168, 85, 247, 0.15)',
            borderWidth: 1,
            borderColor: colors.accent.purple,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: 11, color: colors.accent.purple, fontWeight: '600' }}>
            ⏳ Sincronizando validade temporária (Padrão 24h)...
          </Text>
        </View>
      )}

      {keyHint || apiKey ? (
        <View style={styles.keyContainer}>
          <Text style={styles.keyLabel}>
            Dica da Chave Ativa: <Text style={styles.keyHintText}>{keyHint}</Text>
          </Text>
          
          {apiKey ? (
            <View style={styles.rawKeyBox}>
              <Text style={styles.rawKeyLabel}>Sua Chave de API Ativa:</Text>
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
                  {copied ? 'Copiado! ✓' : 'Copiar Chave API 📋'}
                </Text>
              </HapticButton>
              <Text style={{ fontSize: 11, color: colors.success.main, marginTop: spacing.xxs }}>
                ✓ Planilha com chave ativa vinculada (carregada do backup/localStorage).
              </Text>

              {renderTtlPicker()}

              <HapticButton onPress={generateKey} disabled={generating} style={[styles.regenerateBtn, { marginTop: spacing.xs }]}>
                {generating ? (
                  <ActivityIndicator size="small" color={colors.text.secondary} />
                ) : (
                  <Text style={styles.regenerateBtnText}>🔄 Rotacionar / Regerar Nova Chave de API</Text>
                )}
              </HapticButton>
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

      {/* ── Botão para Área de Testes e Alterações em Massa (Modal Local) ───────────────── */}
      <HapticButton
        onPress={() => setShowApiConsoleModal(true)}
        style={{
          backgroundColor: colors.accent.purple,
          paddingVertical: spacing.sm + 2,
          paddingHorizontal: spacing.md,
          borderRadius: radius.md,
          alignItems: 'center',
          marginTop: spacing.md,
        }}
      >
        <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 13 }}>
          🚀 Abrir Console de Testes & Alterações em Massa via API
        </Text>
      </HapticButton>

      {/* ── Modal do Console de Testes & Alterações em Massa ───────────────── */}
      <Modal
        visible={showApiConsoleModal}
        animationType="slide"
        onRequestClose={() => setShowApiConsoleModal(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }} edges={['top', 'bottom']}>
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderBottomWidth: 1,
            borderBottomColor: colors.border.default,
            backgroundColor: colors.background.secondary,
          }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text.primary }}>
              Console de Integração & Testes API
            </Text>
            <Pressable
              onPress={() => setShowApiConsoleModal(false)}
              style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, backgroundColor: colors.background.tertiary }}
            >
              <Text style={{ color: colors.text.primary, fontWeight: '600', fontSize: 13 }}>✕ Fechar</Text>
            </Pressable>
          </View>
          <APIManagementTester />
        </SafeAreaView>
      </Modal>

      {/* ── Hub de Conexão & System Prompts Turbocharged ───────────────────────── */}
      <HapticButton 
        onPress={() => setShowGuide(!showGuide)} 
        style={styles.guideHeader}
      >
        <Text style={styles.guideHeaderTitle}>
          {showGuide ? '🔌 Ocultar Hub de Prompts & Integração ▲' : '🔌 Hub de Conexão & System Prompts Turbocharged ▼'}
        </Text>
      </HapticButton>

      {showGuide && (
        <View style={styles.guideContent}>
          {/* 1. Schema OpenAPI & Chave de Autenticação */}
          <Text style={styles.guideStepTitle}>1. Schema OpenAPI & Autenticação:</Text>
          <Text style={styles.guideText}>
            Para IAs externas (como ChatGPT ou Claude) saberem quais rotas chamar, importe o link OpenAPI e configure o cabeçalho obrigatório:
          </Text>

          <HapticButton 
            onPress={handleCopySchema} 
            style={[styles.copySchemaBtn, copiedSchema && styles.copyBtnSuccess]}
          >
            <Text style={styles.copySchemaBtnText}>
              {copiedSchema ? 'Link OpenAPI Copiado! ✓' : 'Copiar Link do Schema OpenAPI 📋'}
            </Text>
          </HapticButton>

          <View style={{
            backgroundColor: colors.background.secondary,
            padding: spacing.sm,
            borderRadius: radius.sm,
            borderLeftWidth: 3,
            borderLeftColor: colors.accent.purple,
            marginBottom: spacing.xs,
          }}>
            <Text style={{ fontSize: 11, color: colors.text.secondary }}>
              Cabeçalho de Autenticação: <Text style={{ color: colors.text.primary, fontWeight: '700', fontFamily: 'monospace' }}>X-Spreadsheet-Key</Text>
            </Text>
            <Text style={{ fontSize: 11, color: colors.text.secondary, marginTop: 2 }}>
              Status da Chave: <Text style={{ color: colors.accent.purple, fontWeight: '700', fontFamily: 'monospace' }}>{keyHint ? `Ativa (${keyHint})` : 'Gere uma chave acima'}</Text>
            </Text>
          </View>

          {/* 2. Seletor de System Prompts Turbocharged */}
          <Text style={[styles.guideStepTitle, { marginTop: spacing.sm }]}>
            2. System Prompts Prontos para Uso (Turbocharged):
          </Text>
          <Text style={styles.guideText}>
            Escolha o perfil desejado para copiar e colar diretamente nas instruções da sua IA externa (sem limite de tokens, foco em eficiência máxima):
          </Text>

          {/* Tabs de Seleção de Prompts */}
          <View style={{ flexDirection: 'row', gap: 4, marginVertical: spacing.xs }}>
            {SYSTEM_PROMPTS.map((p, idx) => {
              const active = selectedPromptTab === idx;
              return (
                <Pressable
                  key={idx}
                  onPress={() => setSelectedPromptTab(idx)}
                  style={{
                    flex: 1,
                    paddingVertical: 7,
                    paddingHorizontal: 4,
                    borderRadius: radius.xs || 6,
                    backgroundColor: active ? colors.accent.purple : colors.background.secondary,
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: active ? colors.accent.purple : colors.border.default,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: active ? '700' : '600',
                      color: active ? '#ffffff' : colors.text.secondary,
                      textAlign: 'center',
                    }}
                    numberOfLines={1}
                  >
                    {p.title}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Card do Prompt Selecionado */}
          {SYSTEM_PROMPTS[selectedPromptTab] && (
            <View style={{
              backgroundColor: colors.background.secondary,
              borderWidth: 1,
              borderColor: colors.border.strong,
              borderRadius: radius.md,
              padding: spacing.md,
              gap: spacing.xs,
              marginTop: spacing.xxs,
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text.primary }}>
                  {SYSTEM_PROMPTS[selectedPromptTab].title}
                </Text>
                <View style={{
                  backgroundColor: SYSTEM_PROMPTS[selectedPromptTab].badgeColor + '22',
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: SYSTEM_PROMPTS[selectedPromptTab].badgeColor,
                }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: SYSTEM_PROMPTS[selectedPromptTab].badgeColor }}>
                    {SYSTEM_PROMPTS[selectedPromptTab].tag}
                  </Text>
                </View>
              </View>

              <Text style={{ fontSize: 11, color: colors.text.tertiary }}>
                {SYSTEM_PROMPTS[selectedPromptTab].subtitle}
              </Text>

              <Text style={{ fontSize: 11, color: colors.text.secondary, marginVertical: 2, lineHeight: 15 }}>
                💡 <Text style={{ fontStyle: 'italic' }}>{SYSTEM_PROMPTS[selectedPromptTab].description}</Text>
              </Text>

              <TextInput
                style={{
                  backgroundColor: colors.background.tertiary,
                  borderRadius: radius.sm,
                  padding: spacing.sm,
                  fontSize: 11,
                  color: colors.text.primary,
                  fontFamily: 'monospace',
                  maxHeight: 180,
                  borderWidth: 1,
                  borderColor: colors.border.default,
                }}
                value={SYSTEM_PROMPTS[selectedPromptTab].content}
                multiline
                editable={false}
                selectTextOnFocus
              />

              <HapticButton
                onPress={() => handleCopyPrompt(selectedPromptTab, SYSTEM_PROMPTS[selectedPromptTab].content)}
                style={[
                  styles.copyBtn,
                  copiedPromptIndex === selectedPromptTab && styles.copyBtnSuccess,
                  { marginTop: spacing.xxs }
                ]}
              >
                <Text style={styles.copyBtnText}>
                  {copiedPromptIndex === selectedPromptTab ? 'Prompt Copiado com Sucesso! ✓' : 'Copiar System Prompt 📋'}
                </Text>
              </HapticButton>
            </View>
          )}

          {/* 3. Guia Rápido por Plataforma */}
          <Text style={[styles.guideStepTitle, { marginTop: spacing.md }]}>
            3. Como Configurar na sua Plataforma:
          </Text>

          <View style={styles.guideStepsBox}>
            <Text style={[styles.guideStepItem, { fontWeight: '700', color: colors.text.primary }]}>
              🤖 ChatGPT (Custom GPTs):
            </Text>
            <Text style={styles.guideStepItem}>• Explore GPTs → Create → Configure.</Text>
            <Text style={styles.guideStepItem}>• Cole o System Prompt desejado no campo "Instructions".</Text>
            <Text style={styles.guideStepItem}>• Role até o final e clique em "Create new action" → "Import from URL".</Text>
            <Text style={styles.guideStepItem}>• Cole o Link do Schema OpenAPI copiado acima.</Text>
            <Text style={styles.guideStepItem}>• Em Authentication: Auth Type = Custom, Header Name = X-Spreadsheet-Key e cole sua Chave API.</Text>

            <Text style={[styles.guideStepItem, { fontWeight: '700', color: colors.text.primary, marginTop: spacing.xs }]}>
              ⚡ Claude (Projects / Claude Code):
            </Text>
            <Text style={styles.guideStepItem}>• Crie um Project no Claude e cole o System Prompt nas instruções.</Text>
            <Text style={styles.guideStepItem}>• Forneça o link do OpenAPI e sua chave X-Spreadsheet-Key para consultas via ferramentas.</Text>

            <Text style={[styles.guideStepItem, { fontWeight: '700', color: colors.text.primary, marginTop: spacing.xs }]}>
              🛠️ Cursor / Claude Code / Python / n8n:
            </Text>
            <Text style={styles.guideStepItem}>• Use o Prompt "🛠️ Agente Dev / Script" para que a IA siga o passo a passo oficial de validação e leitura sem poluir o ambiente.</Text>
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
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
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

  // License Activation & Recovery Box styles
  licenseInputContainer: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  licenseInputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.tertiary,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
  },
  licenseInputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  licenseInput: {
    flex: 1,
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    color: colors.text.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
  },
  licenseBtn: {
    backgroundColor: colors.accent.purple,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
  },
  licenseBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  recoveryBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.background.tertiary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    gap: spacing.xs,
  },
  recoveryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
  },
  recoveryText: {
    fontSize: 12,
    color: colors.text.secondary,
    lineHeight: 16,
    marginBottom: spacing.xs,
  },
  recoveryBtn: {
    backgroundColor: colors.accent.purple,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },

  // Backup Advice Golden Warning Card styles
  backupAdviceCard: {
    backgroundColor: '#1c1917',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  backupHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  backupIcon: {
    fontSize: 24,
  },
  backupTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fbbf24',
  },
  backupSubtitle: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginTop: 1,
  },
  backupBodyText: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 19,
  },
  boldWhite: {
    fontWeight: '700',
    color: colors.text.primary,
  },
  backupCode: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '700',
    color: '#fbbf24',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  backupDownloadBtn: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: '#f59e0b',
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.xxs,
  },
  backupDownloadBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fbbf24',
  },
  backupFooterText: {
    fontSize: 11,
    color: colors.text.tertiary,
    fontStyle: 'italic',
    marginTop: spacing.xxs,
  },

  // Table Management styles
  tableRowContainer: {
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.background.secondary,
  },
  tableRowActive: {
    borderColor: colors.accent.purpleBorder,
    backgroundColor: colors.accent.purpleLight,
  },
  tableCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tableSelectArea: {
    flex: 1,
    gap: 4,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  reorderGroup: {
    flexDirection: 'row',
    gap: 2,
    marginRight: 4,
  },
  disabledBtn: {
    opacity: 0.25,
  },
  disabledText: {
    color: colors.text.disabled,
  },
  iconBtn: {
    padding: spacing.xs,
    borderRadius: radius.xs,
    backgroundColor: colors.background.tertiary,
  },
  iconText: {
    fontSize: 14,
  },
  dangerText: {
    color: colors.danger.main,
  },
  renameRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  renameInput: {
    flex: 1,
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.strong,
    borderRadius: radius.md,
    color: colors.text.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    fontSize: 14,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveBtn: {
    backgroundColor: colors.success.main,
  },
  cancelBtn: {
    backgroundColor: colors.background.elevated,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  addTableSection: {
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  addTableLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.tertiary,
    textTransform: 'uppercase',
  },
  addTableInputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  addTableInput: {
    flex: 1,
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    color: colors.text.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
  },
  addTableBtn: {
    backgroundColor: colors.accent.purple,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
  },
  addTableBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
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
