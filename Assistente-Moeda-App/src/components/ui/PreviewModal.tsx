/**
 * PreviewModal Component — Assistente Moeda
 *
 * Overlay modal rendering a multiline text area for reviewing, editing,
 * copying, sharing, or pasting data. Supports:
 *   1. WhatsApp report sharing (edit before send)
 *   2. CSV export sharing (edit before download/share)
 *   3. CSV import pasting (paste raw CSV text and import)
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
  Platform,
  useWindowDimensions,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';

interface PreviewModalProps {
  visible: boolean;
  mode: 'whatsapp' | 'csv_export' | 'csv_import';
  initialText: string;
  onClose: () => void;
  onConfirm: (text: string) => void;
}

export function PreviewModal({
  visible,
  mode,
  initialText,
  onClose,
  onConfirm,
}: PreviewModalProps) {
  const { width } = useWindowDimensions();
  const isWide = width >= 600;

  const [text, setText] = useState(initialText);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (visible) {
      setText(initialText);
      setCopied(false);
    }
  }, [visible, initialText]);

  const handleCopy = async () => {
    try {
      await Clipboard.setStringAsync(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error(err);
      Alert.alert('Erro', 'Não foi possível copiar o texto.');
    }
  };

  const handleConfirm = () => {
    if (mode === 'csv_import' && !text.trim()) {
      Alert.alert('Erro', 'O texto para importação não pode estar vazio.');
      return;
    }
    onConfirm(text);
  };

  const title =
    mode === 'whatsapp' ? '📱 Enviar Relatório WhatsApp' :
    mode === 'csv_export' ? '📤 Exportar CSV (Texto)' :
    '📥 Importar CSV / Backup (Texto)';

  const confirmLabel =
    mode === 'whatsapp' ? 'Compartilhar' :
    mode === 'csv_export' ? 'Compartilhar/Salvar' :
    'Importar';

  const description =
    mode === 'whatsapp' ? 'Edite o texto do relatório abaixo antes de compartilhar no WhatsApp:' :
    mode === 'csv_export' ? 'Veja e edite o CSV gerado antes de salvar ou compartilhar:' :
    'Cole ou edite o conteúdo CSV/Backup (ponto-e-vírgula ou vírgula) para ser importado:';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modalContainer, isWide && styles.modalContainerWide]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>×</Text>
            </Pressable>
          </View>

          {/* Body */}
          <View style={styles.body}>
            <Text style={styles.description}>{description}</Text>
            
            <TextInput
              style={styles.textInput}
              multiline
              value={text}
              onChangeText={setText}
              placeholder={mode === 'csv_import' ? 'Cole o CSV/Backup v2 aqui...' : ''}
              placeholderTextColor={colors.text.disabled}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            {mode !== 'csv_import' && (
              <Pressable
                style={[
                  styles.button,
                  styles.buttonSecondary,
                  copied && styles.buttonSuccess,
                ]}
                onPress={handleCopy}
              >
                <Text style={styles.buttonText}>
                  {copied ? '✅ Copiado!' : '📋 Copiar'}
                </Text>
              </Pressable>
            )}
            <Pressable
              style={[styles.button, styles.buttonPrimary]}
              onPress={handleConfirm}
            >
              <Text style={styles.buttonText}>{confirmLabel}</Text>
            </Pressable>
            <Pressable
              style={[styles.button, styles.buttonOutline]}
              onPress={onClose}
            >
              <Text style={styles.buttonText}>Cancelar</Text>
            </Pressable>
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
    padding: spacing.md,
  },
  modalContainer: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.25)',
    borderRadius: radius.lg,
    width: '100%',
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
    overflow: 'hidden',
  },
  modalContainerWide: {
    maxWidth: 600,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.accent.purpleLight || '#e9d5ff',
    flex: 1,
  },
  closeBtn: {
    padding: spacing.xs,
  },
  closeBtnText: {
    color: colors.text.disabled,
    fontSize: 22,
    fontWeight: 'bold',
  },
  body: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  description: {
    fontSize: 12,
    color: colors.text.secondary,
    lineHeight: 16,
  },
  textInput: {
    backgroundColor: colors.background.primary,
    borderColor: colors.border.default,
    borderWidth: 1,
    borderRadius: radius.md,
    color: colors.text.primary,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 11,
    padding: spacing.md,
    height: 250,
    textAlignVertical: 'top',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    gap: spacing.sm,
    backgroundColor: colors.background.primary,
  },
  button: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  buttonPrimary: {
    backgroundColor: colors.accent.purple,
  },
  buttonSecondary: {
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.3)',
    marginRight: 'auto', // Push to left side of footer
  },
  buttonSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  buttonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  buttonText: {
    color: colors.text.primary,
    fontSize: 12,
    fontWeight: '600',
  },
});
