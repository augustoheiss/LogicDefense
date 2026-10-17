/**
 * ChoiceDialog Component — Assistente Moeda
 *
 * Cross-platform interactive choice dialog (Web & Mobile).
 * Replaces ambiguous native browser confirm/prompt dialogs with clear,
 * labeled, non-destructive action buttons.
 */

import React from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { colors } from '@coin/theme/colors';
import { spacing, radius } from '@coin/theme/spacing';

export interface ChoiceOption {
  key: string;
  label: string;
  icon?: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'cancel';
  description?: string;
}

interface ChoiceDialogProps {
  visible: boolean;
  title: string;
  message?: string;
  options: ChoiceOption[];
  onSelect: (key: string) => void;
  onClose: () => void;
}

export function ChoiceDialog({
  visible,
  title,
  message,
  options,
  onSelect,
  onClose,
}: ChoiceDialogProps) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 600;

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.card, isDesktop && styles.cardDesktop]}>
          <Text style={styles.title}>{title}</Text>
          {!!message && <Text style={styles.message}>{message}</Text>}

          <View style={styles.optionsContainer}>
            {options.map((opt) => {
              const isPrimary = opt.variant === 'primary';
              const isDanger = opt.variant === 'danger';
              const isCancel = opt.variant === 'cancel';

              return (
                <Pressable
                  key={opt.key}
                  style={({ pressed }) => [
                    styles.optionButton,
                    isPrimary && styles.optionButtonPrimary,
                    isDanger && styles.optionButtonDanger,
                    isCancel && styles.optionButtonCancel,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => onSelect(opt.key)}
                >
                  <View style={styles.optionContent}>
                    {!!opt.icon && <Text style={styles.optionIcon}>{opt.icon}</Text>}
                    <View style={styles.optionTextContainer}>
                      <Text
                        style={[
                          styles.optionLabel,
                          isPrimary && styles.optionLabelPrimary,
                          isDanger && styles.optionLabelDanger,
                          isCancel && styles.optionLabelCancel,
                        ]}
                      >
                        {opt.label}
                      </Text>
                      {!!opt.description && (
                        <Text style={styles.optionDescription}>{opt.description}</Text>
                      )}
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.strong,
    padding: spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
    zIndex: 10,
  },
  cardDesktop: {
    maxWidth: 460,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.xs,
    letterSpacing: -0.3,
  },
  message: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  optionsContainer: {
    gap: spacing.sm,
  },
  optionButton: {
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  optionButtonPrimary: {
    backgroundColor: colors.accent.purpleLight,
    borderColor: colors.accent.purpleBorder,
  },
  optionButtonDanger: {
    backgroundColor: colors.danger.light,
    borderColor: colors.danger.border,
  },
  optionButtonCancel: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    alignItems: 'center',
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  optionIcon: {
    fontSize: 20,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  optionLabelPrimary: {
    color: '#d8b4fe',
  },
  optionLabelDanger: {
    color: colors.danger.main,
  },
  optionLabelCancel: {
    color: colors.text.tertiary,
  },
  optionDescription: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  pressed: {
    opacity: 0.75,
  },
});
