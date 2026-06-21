/**
 * Welcome Screen — Assistente Moeda
 *
 * The first screen users see. Offers two paths:
 *   1. Continue as Guest (local storage only)
 *   2. Sign In / Create Account (cloud sync available)
 *
 * Design: Premium, dark, with the app's purple accent gradient.
 */

import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthContext } from '@/hooks/useAuth';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';

export default function WelcomeScreen() {
  const router = useRouter();
  const auth = useAuthContext();

  const handleGuestMode = () => {
    auth.enterGuestMode();
    router.replace('/(app)/(tabs)');
  };

  return (
    <View style={styles.container}>
      {/* Logo area */}
      <View style={styles.logoArea}>
        <Text style={styles.emoji}>🪙</Text>
        <Text style={styles.title}>Assistente Moeda</Text>
        <Text style={styles.subtitle}>
          Seu assistente financeiro pessoal com IA
        </Text>
      </View>

      {/* Action buttons */}
      <View style={styles.actions}>
        {/* Primary: Sign In */}
        <Pressable
          style={({ pressed }) => [
            styles.buttonPrimary,
            pressed && styles.buttonPressed,
          ]}
          onPress={() => router.push('/(auth)/login')}
        >
          <Text style={styles.buttonPrimaryText}>Entrar na Conta</Text>
        </Pressable>

        {/* Secondary: Create Account */}
        <Pressable
          style={({ pressed }) => [
            styles.buttonSecondary,
            pressed && styles.buttonPressed,
          ]}
          onPress={() => router.push('/(auth)/register')}
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
      </View>

      {/* Footer */}
      <Text style={styles.footer}>
        Logic Defense • v1.0.0
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xxl,
    paddingTop: 120,
    paddingBottom: spacing.xxxl,
  },

  logoArea: {
    alignItems: 'center',
    gap: spacing.md,
  },
  emoji: {
    fontSize: 64,
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },

  actions: {
    gap: spacing.md,
  },
  buttonPrimary: {
    backgroundColor: colors.accent.purple,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  buttonPrimaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
    fontSize: 16,
    fontWeight: '600',
  },
  buttonGhost: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    gap: 2,
  },
  buttonGhostText: {
    color: colors.text.tertiary,
    fontSize: 14,
  },
  buttonGhostCaption: {
    color: colors.text.disabled,
    fontSize: 11,
  },
  buttonPressed: {
    opacity: 0.75,
  },

  footer: {
    color: colors.text.disabled,
    fontSize: 11,
    textAlign: 'center',
  },
});
