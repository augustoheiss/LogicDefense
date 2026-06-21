import { View, Text, StyleSheet, Pressable, TextInput, Platform } from 'react-native';
import { useCoinDB } from '@/hooks/useCoinDB';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';

export function TimeMachineBar() {
  const db = useCoinDB();

  return (
    <View style={styles.container}>
      <View style={styles.timeMachineBar}>
        <View style={styles.timeMachineLeft}>
          <Text style={styles.timeMachineEmoji}>🕰️</Text>
          <View style={styles.timeMachineControl}>
            <Text style={styles.timeMachineLabel}>Máquina do Tempo</Text>
            {Platform.OS === 'web' ? (
              <input
                type="date"
                value={db.cutoffDate}
                onChange={(e) => db.setCutoffDate(e.target.value)}
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  color: '#fff',
                  fontSize: 12,
                  borderRadius: 6,
                  paddingLeft: 10,
                  paddingRight: 10,
                  paddingTop: 5,
                  paddingBottom: 5,
                  outline: 'none',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  colorScheme: 'dark',
                }}
              />
            ) : (
              <TextInput
                style={styles.timeMachineInputNative}
                value={db.cutoffDate}
                onChangeText={db.setCutoffDate}
                placeholder="AAAA-MM-DD"
                placeholderTextColor={colors.text.disabled}
              />
            )}
          </View>
        </View>
        {db.cutoffDate !== '' && (
          <Pressable
            style={({ pressed }) => [
              styles.timeMachineReset,
              pressed && styles.pressed,
            ]}
            onPress={() => db.setCutoffDate('')}
          >
            <Text style={styles.timeMachineResetText}>✕ Reset</Text>
          </Pressable>
        )}
      </View>

      {db.cutoffDate !== '' && (
        <View style={styles.timeMachineWarning}>
          <Text style={styles.timeMachineWarningText}>
            ⚠️ Exibindo dados até {db.cutoffDate.split('-').reverse().join('/')}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background.primary,
    paddingBottom: spacing.xs,
  },
  timeMachineBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  timeMachineLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  timeMachineEmoji: {
    fontSize: 20,
  },
  timeMachineControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  timeMachineLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  timeMachineInputNative: {
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    fontSize: 12,
    color: colors.text.primary,
    width: 125,
  },
  timeMachineReset: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  timeMachineResetText: {
    fontSize: 11,
    color: colors.accent.purple,
    fontWeight: '600',
  },
  timeMachineWarning: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.2)',
  },
  timeMachineWarningText: {
    fontSize: 11,
    color: '#22d3ee',
    fontWeight: '500',
  },
  pressed: {
    opacity: 0.7,
  },
});
