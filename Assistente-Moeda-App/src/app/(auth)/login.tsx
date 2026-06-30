/**
 * Login Screen — Assistente Moeda
 *
 * Premium email + password authentication via Supabase Auth.
 * Features:
 *   - Reanimated entrance animations (header fade, form spring-up)
 *   - Animated input focus state (purple border glow)
 *   - Haptic feedback on submit + error notification
 *   - Animated error box (FadeIn / FadeOut)
 *   - KeyboardAvoidingView tuned per platform (iOS: padding, Android: height)
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
  SlideInDown,
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

// ── Login Screen ────────────────────────────────────────────────────

export default function LoginScreen() {
  const router = useRouter();
  const auth = useAuthContext();
  const { impact, notification } = useHaptics();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = useCallback(async () => {
    if (!email.trim() || !password.trim()) {
      setError('Preencha todos os campos');
      notification(NotificationFeedbackType.Warning);
      return;
    }
    setError(null);
    setIsLoading(true);
    impact(ImpactFeedbackStyle.Medium);

    const result = await auth.login(email.trim(), password);
    setIsLoading(false);

    if (result.error) {
      setError(result.error);
      notification(NotificationFeedbackType.Error);
    } else {
      router.replace('/(app)/(tabs)');
    }
  }, [email, password, auth, router, impact, notification]);

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
            <Text style={styles.title}>Entrar</Text>
            <Text style={styles.subtitle}>
              Acesse sua conta para sincronizar dados
            </Text>
          </Animated.View>

          {/* Form */}
          <View style={styles.form}>
            <GlowInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="seu@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              editable={!isLoading}
              enterDelay={200}
            />

            <GlowInput
              label="Senha"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
              autoComplete="password"
              editable={!isLoading}
              enterDelay={300}
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
              entering={FadeInUp.delay(400).duration(400).springify().damping(15)}
            >
              <Pressable
                style={({ pressed }) => [
                  styles.submitButton,
                  isLoading && styles.submitDisabled,
                  pressed && styles.submitPressed,
                ]}
                onPress={handleLogin}
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
                    <Text style={styles.submitText}>Entrar</Text>
                  )}
                </LinearGradient>
              </Pressable>
            </Animated.View>
          </View>

          {/* Footer */}
          <Animated.View
            entering={FadeIn.delay(600).duration(400)}
            style={styles.footer}
          >
            <Text style={styles.footerText}>Ainda não tem conta? </Text>
            <Pressable onPress={() => router.replace('/(auth)/register')}>
              <Text style={styles.footerLink}>Criar conta</Text>
            </Pressable>
          </Animated.View>

          <Animated.View entering={FadeIn.delay(700).duration(300)}>
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
