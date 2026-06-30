/**
 * Register Screen — Assistente Moeda
 *
 * Premium new-account creation with email, password, and optional
 * display name. Mirrors the login screen's polish:
 *   - Reanimated entrance animations (staggered form fields)
 *   - Animated input focus state (purple border glow)
 *   - Haptic feedback on submit + success/error notification
 *   - Animated success state with ZoomIn celebration
 *   - KeyboardAvoidingView tuned per platform
 *   - SafeAreaView for notch/home-bar respect
 *   - Full design-system token usage — no magic numbers
 */

import { useState, useCallback } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  ZoomIn,
} from 'react-native-reanimated';
import { useAuthContext } from '@/hooks/useAuth';
import { useHaptics, ImpactFeedbackStyle, NotificationFeedbackType } from '@/hooks/useHaptics';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';

// ── Animated TextInput wrapper with focus-state glow ────────────────

interface GlowInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  keyboardType?: TextInput['props']['keyboardType'];
  autoCapitalize?: TextInput['props']['autoCapitalize'];
  autoComplete?: TextInput['props']['autoComplete'];
  editable?: boolean;
  enterDelay?: number;
}

function GlowInput({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  autoComplete,
  editable = true,
  enterDelay = 0,
}: GlowInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <Animated.View
      entering={FadeInDown.delay(enterDelay).duration(400).springify().damping(18)}
      style={styles.inputGroup}
    >
      <Text style={styles.label}>{label}</Text>
      <View
        style={[
          styles.inputWrapper,
          isFocused && styles.inputWrapperFocused,
        ]}
      >
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.text.disabled}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          editable={editable}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
      </View>
    </Animated.View>
  );
}

// ── Register Screen ─────────────────────────────────────────────────

export default function RegisterScreen() {
  const router = useRouter();
  const auth = useAuthContext();
  const { impact, notification } = useHaptics();
  const insets = useSafeAreaInsets();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleRegister = useCallback(async () => {
    if (!email.trim() || !password.trim()) {
      setError('Preencha email e senha');
      notification(NotificationFeedbackType.Warning);
      return;
    }
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres');
      notification(NotificationFeedbackType.Warning);
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas não coincidem');
      notification(NotificationFeedbackType.Warning);
      return;
    }

    setError(null);
    setIsLoading(true);
    impact(ImpactFeedbackStyle.Medium);

    const result = await auth.register(
      email.trim(),
      password,
      displayName.trim() || undefined,
    );
    setIsLoading(false);

    if (result.error) {
      setError(result.error);
      notification(NotificationFeedbackType.Error);
    } else {
      notification(NotificationFeedbackType.Success);
      setSuccess(true);
    }
  }, [email, password, confirmPassword, displayName, auth, impact, notification]);

  // ── Success state ──────────────────────────────────────────
  if (success) {
    return (
      <View style={styles.root}>
        <LinearGradient
          colors={['#0f0a1e', colors.background.primary, colors.background.primary]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.5 }}
        />
        <View
          style={[
            styles.successContainer,
            {
              paddingTop: insets.top + spacing.xxxl,
              paddingBottom: insets.bottom + spacing.xxl,
            },
          ]}
        >
          <Animated.View entering={ZoomIn.springify().damping(10)}>
            <View style={styles.successEmojiGlow}>
              <Text style={styles.successEmoji}>✅</Text>
            </View>
          </Animated.View>

          <Animated.Text
            entering={FadeIn.delay(300).duration(400)}
            style={styles.successTitle}
          >
            Conta criada!
          </Animated.Text>

          <Animated.Text
            entering={FadeIn.delay(500).duration(400)}
            style={styles.successText}
          >
            Verifique seu email para confirmar a conta.{'\n'}
            Depois é só fazer login para começar.
          </Animated.Text>

          <Animated.View
            entering={FadeInUp.delay(700).duration(400).springify().damping(15)}
            style={styles.successButtonContainer}
          >
            <Pressable
              style={({ pressed }) => [
                styles.submitButton,
                pressed && styles.submitPressed,
              ]}
              onPress={() => {
                impact(ImpactFeedbackStyle.Medium);
                router.replace('/(auth)/login');
              }}
            >
              <LinearGradient
                colors={[colors.accent.purple, colors.accent.purpleHover]}
                style={styles.submitGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.submitText}>Ir para Login</Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        </View>
      </View>
    );
  }

  // ── Registration form ─────────────────────────────────────
  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#0f0a1e', colors.background.primary, colors.background.primary]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.4 }}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: insets.top + spacing.xxxl,
              paddingBottom: insets.bottom + spacing.xxl,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <Animated.View
            entering={FadeIn.delay(100).duration(500)}
            style={styles.header}
          >
            <Pressable
              onPress={() => router.back()}
              hitSlop={spacing.md}
              style={({ pressed }) => [
                styles.backButton,
                pressed && styles.backPressed,
              ]}
            >
              <Text style={styles.backText}>← Voltar</Text>
            </Pressable>
            <Text style={styles.title}>Criar Conta</Text>
            <Text style={styles.subtitle}>
              Sincronize seus dados entre dispositivos
            </Text>
          </Animated.View>

          {/* Form */}
          <View style={styles.form}>
            <GlowInput
              label="Nome (opcional)"
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Como quer ser chamado?"
              autoCapitalize="words"
              editable={!isLoading}
              enterDelay={150}
            />

            <GlowInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="seu@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              editable={!isLoading}
              enterDelay={250}
            />

            <GlowInput
              label="Senha"
              value={password}
              onChangeText={setPassword}
              placeholder="Mínimo 6 caracteres"
              secureTextEntry
              editable={!isLoading}
              enterDelay={350}
            />

            <GlowInput
              label="Confirmar Senha"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Repita a senha"
              secureTextEntry
              editable={!isLoading}
              enterDelay={450}
            />

            {/* Animated error */}
            {error && (
              <Animated.View
                entering={FadeIn.duration(300)}
                exiting={FadeOut.duration(200)}
                style={styles.errorBox}
              >
                <Text style={styles.errorText}>⚠️ {error}</Text>
              </Animated.View>
            )}

            {/* Submit */}
            <Animated.View
              entering={FadeInUp.delay(550).duration(400).springify().damping(15)}
            >
              <Pressable
                style={({ pressed }) => [
                  styles.submitButton,
                  isLoading && styles.submitDisabled,
                  pressed && styles.submitPressed,
                ]}
                onPress={handleRegister}
                disabled={isLoading}
              >
                <LinearGradient
                  colors={[colors.accent.purple, colors.accent.purpleHover]}
                  style={styles.submitGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.submitText}>Criar Conta</Text>
                  )}
                </LinearGradient>
              </Pressable>
            </Animated.View>
          </View>

          {/* Footer */}
          <Animated.View
            entering={FadeIn.delay(700).duration(400)}
            style={styles.footer}
          >
            <Text style={styles.footerText}>Já tem uma conta? </Text>
            <Pressable onPress={() => router.replace('/(auth)/login')}>
              <Text style={styles.footerLink}>Entrar</Text>
            </Pressable>
          </Animated.View>

          <Animated.View entering={FadeIn.delay(800).duration(300)}>
            <Pressable
              style={({ pressed }) => [
                styles.guestLink,
                pressed && styles.backPressed,
              ]}
              onPress={() => {
                impact(ImpactFeedbackStyle.Light);
                auth.enterGuestMode();
                router.replace('/(app)/(tabs)');
              }}
            >
              <Text style={styles.guestLinkText}>
                Voltar para o painel principal (Modo Visitante)
              </Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },

  // Header
  header: {
    marginBottom: spacing.xxxl,
  },
  backButton: {
    marginBottom: spacing.xl,
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
    paddingRight: spacing.md,
  },
  backPressed: {
    opacity: 0.6,
  },
  backText: {
    color: colors.text.tertiary,
    fontSize: typography.body.fontSize,
    fontWeight: typography.body.fontWeight,
  },
  title: {
    fontSize: typography.h1.fontSize,
    lineHeight: typography.h1.lineHeight,
    fontWeight: typography.h1.fontWeight,
    letterSpacing: typography.h1.letterSpacing,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.bodyLarge.fontSize,
    lineHeight: typography.bodyLarge.lineHeight,
    fontWeight: typography.bodyLarge.fontWeight,
    color: colors.text.secondary,
  },

  // Form
  form: {
    gap: spacing.lg,
  },
  inputGroup: {
    gap: spacing.xs,
  },
  label: {
    color: colors.text.secondary,
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontWeight: typography.label.fontWeight,
  },
  inputWrapper: {
    backgroundColor: colors.background.tertiary,
    borderWidth: 1.5,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  inputWrapperFocused: {
    borderColor: colors.accent.purple,
    backgroundColor: colors.background.elevated,
  },
  input: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + spacing.xs,
    color: colors.text.primary,
    fontSize: typography.bodyLarge.fontSize,
  },

  // Error
  errorBox: {
    backgroundColor: colors.danger.light,
    borderWidth: 1,
    borderColor: colors.danger.border,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  errorText: {
    color: colors.danger.main,
    fontSize: typography.label.fontSize,
    fontWeight: typography.label.fontWeight,
  },

  // Submit
  submitButton: {
    borderRadius: radius.md,
    overflow: 'hidden',
    marginTop: spacing.sm,
  },
  submitGradient: {
    paddingVertical: spacing.lg + spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  submitDisabled: {
    opacity: 0.6,
  },
  submitPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  submitText: {
    color: '#fff',
    fontSize: typography.bodyLarge.fontSize,
    fontWeight: '700',
  },

  // Success
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxxl,
    gap: spacing.lg,
  },
  successEmojiGlow: {
    width: 100,
    height: 100,
    borderRadius: radius.full,
    backgroundColor: colors.success.light,
    borderWidth: 1,
    borderColor: colors.success.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  successEmoji: {
    fontSize: 48,
  },
  successTitle: {
    fontSize: typography.h1.fontSize,
    lineHeight: typography.h1.lineHeight,
    fontWeight: typography.h1.fontWeight,
    color: colors.text.primary,
  },
  successText: {
    fontSize: typography.bodyLarge.fontSize,
    lineHeight: typography.bodyLarge.lineHeight + 4,
    fontWeight: typography.bodyLarge.fontWeight,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  successButtonContainer: {
    width: '100%',
  },

  // Footer
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.xxxl,
  },
  footerText: {
    color: colors.text.tertiary,
    fontSize: typography.body.fontSize,
    fontWeight: typography.body.fontWeight,
  },
  footerLink: {
    color: colors.accent.purple,
    fontSize: typography.body.fontSize,
    fontWeight: '600',
  },

  // Guest link
  guestLink: {
    marginTop: spacing.md,
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  guestLinkText: {
    color: colors.text.tertiary,
    fontSize: typography.label.fontSize,
    textDecorationLine: 'underline',
  },
});
