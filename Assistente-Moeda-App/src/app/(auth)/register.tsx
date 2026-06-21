/**
 * Register Screen — Assistente Moeda
 *
 * New account creation with email, password, and optional display name.
 * Includes validation, error handling, and navigation to login.
 */

import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthContext } from '@/hooks/useAuth';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';

export default function RegisterScreen() {
  const router = useRouter();
  const auth = useAuthContext();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleRegister = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Preencha email e senha');
      return;
    }
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres');
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }

    setError(null);
    setIsLoading(true);

    const result = await auth.register(
      email.trim(),
      password,
      displayName.trim() || undefined,
    );
    setIsLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      setSuccess(true);
    }
  };

  if (success) {
    return (
      <View style={[styles.container, styles.successContainer]}>
        <Text style={styles.successEmoji}>✅</Text>
        <Text style={styles.successTitle}>Conta criada!</Text>
        <Text style={styles.successText}>
          Verifique seu email para confirmar a conta.
        </Text>
        <Pressable
          style={({ pressed }) => [
            styles.submitButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={() => router.replace('/(auth)/login')}
        >
          <Text style={styles.submitText}>Ir para Login</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>← Voltar</Text>
          </Pressable>
          <Text style={styles.title}>Criar Conta</Text>
          <Text style={styles.subtitle}>
            Sincronize seus dados entre dispositivos
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nome (opcional)</Text>
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Como quer ser chamado?"
              placeholderTextColor={colors.text.disabled}
              autoCapitalize="words"
              editable={!isLoading}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="seu@email.com"
              placeholderTextColor={colors.text.disabled}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              editable={!isLoading}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Senha</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Mínimo 6 caracteres"
              placeholderTextColor={colors.text.disabled}
              secureTextEntry
              editable={!isLoading}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Confirmar Senha</Text>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Repita a senha"
              placeholderTextColor={colors.text.disabled}
              secureTextEntry
              editable={!isLoading}
            />
          </View>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {error}</Text>
            </View>
          )}

          <Pressable
            style={({ pressed }) => [
              styles.submitButton,
              isLoading && styles.submitDisabled,
              pressed && styles.buttonPressed,
            ]}
            onPress={handleRegister}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>Criar Conta</Text>
            )}
          </Pressable>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Já tem uma conta? </Text>
          <Pressable onPress={() => router.replace('/(auth)/login')}>
            <Text style={styles.footerLink}>Entrar</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.xxxl,
  },

  header: {
    marginBottom: spacing.xxxl,
  },
  backButton: {
    marginBottom: spacing.xl,
  },
  backText: {
    color: colors.text.tertiary,
    fontSize: 14,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 15,
    color: colors.text.secondary,
    lineHeight: 22,
  },

  form: {
    gap: spacing.lg,
  },
  inputGroup: {
    gap: spacing.xs,
  },
  label: {
    color: colors.text.secondary,
    fontSize: 13,
    fontWeight: '500',
  },
  input: {
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: colors.text.primary,
    fontSize: 16,
  },

  errorBox: {
    backgroundColor: colors.danger.light,
    borderWidth: 1,
    borderColor: colors.danger.border,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  errorText: {
    color: colors.danger.main,
    fontSize: 13,
  },

  submitButton: {
    backgroundColor: colors.accent.purple,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  submitDisabled: {
    opacity: 0.6,
  },
  submitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonPressed: {
    opacity: 0.75,
  },

  successContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxxl,
    gap: spacing.lg,
  },
  successEmoji: {
    fontSize: 48,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.primary,
  },
  successText: {
    fontSize: 15,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
  },

  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.xxxl,
  },
  footerText: {
    color: colors.text.tertiary,
    fontSize: 14,
  },
  footerLink: {
    color: colors.accent.purple,
    fontSize: 14,
    fontWeight: '600',
  },
});
