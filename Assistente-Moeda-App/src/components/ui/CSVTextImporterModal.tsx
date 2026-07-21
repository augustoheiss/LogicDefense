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
  ScrollView,
} from 'react-native';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { useCSVStream } from '@/hooks/useCSVStream';
import { ALL_SECTORS } from '@/hooks/useSectorRegistry';

interface CSVTextImporterModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (summary: string) => void;
}

export function CSVTextImporterModal({
  visible,
  onClose,
  onSuccess,
}: CSVTextImporterModalProps) {
  const { width } = useWindowDimensions();
  const isWide = width >= 600;

  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultSummary, setResultSummary] = useState<{
    success: boolean;
    imported: number;
    skipped: number;
    errors: string[];
    sectors: string[];
  } | null>(null);

  const { importCSVStream } = useCSVStream();

  useEffect(() => {
    if (visible) {
      setText('');
      setResultSummary(null);
      setLoading(false);
    }
  }, [visible]);

  const handleImport = async () => {
    if (!text.trim()) {
      Alert.alert('Erro', 'Por favor, insira o texto CSV para importar.');
      return;
    }

    setLoading(true);
    setResultSummary(null);

    try {
      const res = await importCSVStream(text);
      setResultSummary({
        success: res.success,
        imported: res.importedCount,
        skipped: res.skippedCount,
        errors: res.errors,
        sectors: res.autoActivatedSectors,
      });

      if (res.success) {
        const sectorNames = res.autoActivatedSectors
          .map((id) => ALL_SECTORS.find((s) => s.id === id)?.label || id)
          .join(', ');

        const autoMsg = sectorNames
          ? `\n\nAuto-ativado '${sectorNames}' com base nas tags de dados importadas.`
          : '';

        const summaryText = `Sucesso! Mesclados ${res.importedCount} registros com a planilha.${autoMsg}`;
        onSuccess(summaryText);
      }
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Falha ao processar a importação.');
    } finally {
      setLoading(false);
    }
  };

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
              📥 Importar Bloco CSV de IA / Texto
            </Text>
            <Pressable style={styles.closeBtn} onPress={onClose} disabled={loading}>
              <Text style={styles.closeBtnText}>×</Text>
            </Pressable>
          </View>

          {/* Body */}
          <ScrollView contentContainerStyle={styles.body}>
            <Text style={styles.description}>
              Insira o texto CSV para realizar uma mesclagem aditiva diretamente na sua planilha atual.
              Os seguintes cabeçalhos são esperados:
            </Text>
            <View style={styles.codeContainer}>
              <Text style={styles.codeText}>
                date, type, category, amount, description, tags, metadata_json
              </Text>
            </View>

            <TextInput
              style={styles.textInput}
              multiline
              value={text}
              onChangeText={setText}
              placeholder="Cole seu texto CSV aqui..."
              placeholderTextColor={colors.text.disabled}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />

            {/* Results / Status Banners */}
            {resultSummary && (
              <View
                style={[
                  styles.resultBox,
                  resultSummary.success ? styles.resultBoxSuccess : styles.resultBoxError,
                ]}
              >
                <Text style={styles.resultTitle}>
                  {resultSummary.success ? '✅ Importação Concluída' : '⚠️ Falha na Importação'}
                </Text>
                <Text style={styles.resultText}>
                  Registros importados/mesclados: {resultSummary.imported}
                </Text>
                <Text style={styles.resultText}>
                  Registros ignorados: {resultSummary.skipped}
                </Text>

                {resultSummary.sectors.length > 0 && (
                  <View style={styles.bannerActive}>
                    <Text style={styles.bannerActiveText}>
                      🚀 Auto-activated '{resultSummary.sectors
                        .map((id) => ALL_SECTORS.find((s) => s.id === id)?.label || id)
                        .join(', ')}' based on imported data tags.
                    </Text>
                  </View>
                )}

                {resultSummary.errors.length > 0 && (
                  <View style={styles.errorsContainer}>
                    <Text style={styles.errorsTitle}>Avisos/Erros:</Text>
                    {resultSummary.errors.slice(0, 5).map((err, idx) => (
                      <Text key={idx} style={styles.errorItem}>
                        • {err}
                      </Text>
                    ))}
                    {resultSummary.errors.length > 5 && (
                      <Text style={styles.errorItem}>
                        ... e mais {resultSummary.errors.length - 5} erros.
                      </Text>
                    )}
                  </View>
                )}
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Pressable
              style={[styles.button, styles.buttonOutline]}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={styles.buttonText}>Fechar</Text>
            </Pressable>
            <Pressable
              style={[styles.button, styles.buttonPrimary, loading && styles.buttonDisabled]}
              onPress={handleImport}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Importando...' : 'Mesclar Dados'}
              </Text>
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
    maxHeight: '90%',
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
  codeContainer: {
    backgroundColor: '#0d1117',
    padding: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  codeText: {
    fontSize: 11,
    color: '#a5d6ff',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
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
    height: 180,
    textAlignVertical: 'top',
  },
  resultBox: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.xs,
  },
  resultBoxSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  resultBoxError: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  resultTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  resultText: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  bannerActive: {
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    borderColor: 'rgba(168, 85, 247, 0.3)',
    borderWidth: 1,
    padding: spacing.sm,
    borderRadius: radius.sm,
    marginTop: spacing.sm,
  },
  bannerActiveText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.accent.purpleLight || '#e9d5ff',
    lineHeight: 15,
  },
  errorsContainer: {
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: spacing.xs,
  },
  errorsTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  errorItem: {
    fontSize: 11,
    color: '#f87171',
    lineHeight: 14,
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
  buttonDisabled: {
    opacity: 0.5,
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
