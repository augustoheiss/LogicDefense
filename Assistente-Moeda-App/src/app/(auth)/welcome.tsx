/**
 * Welcome Screen — Assistente Moeda
 *
 * The first screen users see. On first launch it renders the full
 * OnboardingCarousel; on subsequent launches it goes straight to the
 * premium welcome gate.
 *
 * Paths:
 *   1. Entrar na Conta   → Login screen
 *   2. Criar Conta        → Register screen
 *   3. Continuar sem conta → Guest mode (local-only)
 *
 * Design: Cinematic dark with purple accent gradient, Reanimated
 * entrance animations, haptic feedback on CTAs, SafeAreaView.
 */

import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  ZoomIn,
} from 'react-native-reanimated';
import { useAuthContext } from '@/hooks/useAuth';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useHaptics, ImpactFeedbackStyle } from '@/hooks/useHaptics';
import { OnboardingCarousel } from '@/components/OnboardingCarousel';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';

export default function WelcomeScreen() {
  const router = useRouter();
  const auth = useAuthContext();
  const { hasSeenOnboarding, isLoading: onboardingLoading, completeOnboarding } = useOnboarding();
  const { impact } = useHaptics();
  const insets = useSafeAreaInsets();

  // Local flag to transition from carousel to welcome content with animation
  const [showWelcome, setShowWelcome] = useState(false);

  const handleOnboardingComplete = async () => {
    await completeOnboarding();
    setShowWelcome(true);
  };

  const handleGuestMode = () => {
    impact(ImpactFeedbackStyle.Light);
    auth.enterGuestMode();
    router.replace('/(app)/(tabs)');
  };

  const handleLogin = () => {
    impact(ImpactFeedbackStyle.Medium);
    router.push('/(auth)/login');
  };

  const handleRegister = () => {
    impact(ImpactFeedbackStyle.Medium);
    router.push('/(auth)/register');
  };

  // ── Loading state ──────────────────────────────────────────
  if (onboardingLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent.purple} />
      </View>
    );
  }

  // ── Onboarding carousel (first launch only) ───────────────
  if (!hasSeenOnboarding && !showWelcome) {
    return <OnboardingCarousel onComplete={handleOnboardingComplete} />;
  }

  // ── Welcome gate ───────────────────────────────────────────
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[colors.background.primary, '#0f0a1e', colors.background.primary]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      <View
        style={[
          styles.content,
          {
            paddingTop: insets.top + spacing.xxxxl,
            paddingBottom: insets.bottom + spacing.xxl,
          },
        ]}
      >
        {/* Logo area */}
        <View style={styles.logoArea}>
          <Animated.View entering={ZoomIn.springify().damping(12).delay(100)}>
            <View style={styles.emojiGlow}>
              <Text style={styles.emoji}>🪙</Text>
            </View>
          </Animated.View>

          <Animated.Text
            entering={FadeIn.delay(300).duration(500)}
            style={styles.title}
          >
            Assistente Moeda
          </Animated.Text>

          <Animated.Text
            entering={FadeIn.delay(500).duration(500)}
            style={styles.subtitle}
          >
            Seu assistente financeiro pessoal{'\n'}com inteligência artificial
          </Animated.Text>
        </View>

        {/* Action buttons */}
        <Animated.View
          entering={FadeInUp.delay(600).duration(500).springify().damping(15)}
          style={styles.actions}
        >
          {/* Primary: Sign In */}
          <Pressable
            style={({ pressed }) => [
              styles.buttonPrimary,
              pressed && styles.buttonPrimaryPressed,
            ]}
            onPress={handleLogin}
          >
            <LinearGradient
              colors={[colors.accent.purple, colors.accent.purpleHover]}
              style={styles.buttonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.buttonPrimaryText}>Entrar na Conta</Text>
            </LinearGradient>
          </Pressable>

          {/* Secondary: Create Account */}
          <Pressable
            style={({ pressed }) => [
              styles.buttonSecondary,
              pressed && styles.buttonPressed,
            ]}
            onPress={handleRegister}
          >
            <Text style={styles.buttonSecondaryText}>Criar Conta</Text>
          </Pressable>

          {/* Tertiary: Guest Mode */}
          <Pressable
            style={({ pressed }) => [
              styles.buttonGhost,
              pressed && styles.buttonPressed,
            ]}
            onPress={handleGuestMode}
          >
            <Text style={styles.buttonGhostText}>
              Continuar sem conta
            </Text>
            <Text style={styles.buttonGhostCaption}>
              Dados salvos apenas no dispositivo
            </Text>
          </Pressable>
        </Animated.View>

        {/* Footer */}
        <Animated.Text
          entering={FadeIn.delay(800).duration(400)}
          style={styles.footer}
        >
          Logic Defense • v1.0.0
        </Animated.Text>
      </View>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.primary,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xxl,
  },

  // Logo
  logoArea: {
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xxxxl,
  },
  emojiGlow: {
    width: 100,
    height: 100,
    borderRadius: radius.full,
    backgroundColor: colors.accent.purpleLight,
    borderWidth: 1,
    borderColor: colors.accent.purpleBorder,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  emoji: {
    fontSize: 52,
  },
  title: {
    fontSize: typography.h1.fontSize,
    lineHeight: typography.h1.lineHeight,
    fontWeight: typography.h1.fontWeight,
    letterSpacing: typography.h1.letterSpacing,
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: typography.bodyLarge.fontSize,
    lineHeight: typography.bodyLarge.lineHeight + 4,
    fontWeight: typography.bodyLarge.fontWeight,
    color: colors.text.secondary,
    textAlign: 'center',
  },

  // Actions
  actions: {
    gap: spacing.md,
  },
  buttonPrimary: {
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  buttonGradient: {
    paddingVertical: spacing.lg + spacing.xs,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  buttonPrimaryText: {
    color: '#fff',
    fontSize: typography.bodyLarge.fontSize,
    fontWeight: '700',
  },
  buttonPrimaryPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  buttonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.accent.purpleBorder,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  buttonSecondaryText: {
    color: colors.accent.purple,
    fontSize: typography.bodyLarge.fontSize,
    fontWeight: '600',
  },
  buttonGhost: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    gap: spacing.xxs,
  },
  buttonGhostText: {
    color: colors.text.tertiary,
    fontSize: typography.body.fontSize,
    fontWeight: typography.body.fontWeight,
  },
  buttonGhostCaption: {
    color: colors.text.disabled,
    fontSize: typography.labelSmall.fontSize,
    fontWeight: typography.labelSmall.fontWeight,
  },
  buttonPressed: {
    opacity: 0.7,
  },

  // Footer
  footer: {
    color: colors.text.disabled,
    fontSize: typography.labelSmall.fontSize,
    fontWeight: typography.labelSmall.fontWeight,
    textAlign: 'center',
  },
});
