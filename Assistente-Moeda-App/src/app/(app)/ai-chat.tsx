/**
 * AI Chat Screen (Modal) — Assistente Moeda
 * Phase 1: Placeholder — full implementation in Phase 4.
 */

import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';

export default function AIChatScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.closeText}>← Fechar</Text>
        </Pressable>
        <Text style={styles.title}>🤖 Assistente IA</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.placeholder}>
        <Text style={styles.emoji}>🤖</Text>
        <Text style={styles.text}>Em construção — Fase 4</Text>
        <Text style={styles.subtext}>
          Chat com IA para análise financeira personalizada.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  closeText: {
    color: colors.accent.purple,
    fontSize: 14,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xxxl,
  },
  emoji: { fontSize: 48 },
  text: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  subtext: {
    fontSize: 13,
    color: colors.text.tertiary,
    textAlign: 'center',
    lineHeight: 19,
  },
});
