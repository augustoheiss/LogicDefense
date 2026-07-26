import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { useCoinDB } from '../hooks/useCoinDB';
import { parseCSVText } from '../utils/csvEngine';

interface CSVImporterProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function CSVImporter({ onSuccess, onCancel }: CSVImporterProps) {
  const { activeTable, addRows, updateActiveSectors, updateGoals } = useCoinDB() as any;
  const [csvText, setCsvText] = useState('');
  const [errorLogs, setErrorLogs] = useState<string[]>([]);
  const [statusMsg, setStatusMsg] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleImport = async () => {
    if (!activeTable) {
      setErrorLogs(['Nenhuma planilha ativa selecionada.']);
      return;
    }

    if (!csvText.trim()) {
      setErrorLogs(['Por favor, cole um conteúdo CSV válido.']);
      return;
    }

    setIsProcessing(true);
    setErrorLogs([]);
    setStatusMsg('');

    try {
      const parsed = parseCSVText(csvText);

      if (parsed.errors.length > 0) {
        setErrorLogs(parsed.errors);
      }

      if (parsed.rows.length === 0) {
        setStatusMsg('Falha: Nenhum registro válido pôde ser importado.');
        setIsProcessing(false);
        return;
      }

      // Add to store in-place
      await addRows(parsed.rows);

      if (parsed.metadata?.tableGoals) {
        await updateGoals(parsed.metadata.tableGoals);
      }

      // Trigger dynamic activeSectors toggles
      const currentActiveSectors = activeTable.activeSectors || ['personal_finance'];
      const sectorsToActivate = parsed.detectedSectors.filter(
        (sec) => !currentActiveSectors.includes(sec)
      );

      if (sectorsToActivate.length > 0) {
        const nextSectors = Array.from(new Set([...currentActiveSectors, ...sectorsToActivate]));
        await updateActiveSectors(nextSectors);
        setStatusMsg(
          `Sucesso: ${parsed.rows.length} linhas importadas! Setores auto-ativados: ${sectorsToActivate.join(', ')}`
        );
      } else {
        setStatusMsg(`Sucesso: ${parsed.rows.length} linhas importadas na planilha ativa!`);
      }

      setCsvText('');
      if (onSuccess) {
        setTimeout(onSuccess, 1500);
      }
    } catch (err: any) {
      const errMsg = err.message || 'Falha ao processar o arquivo CSV';
      setErrorLogs([`Erro geral de importação: ${errMsg}`]);
      if (Platform.OS === 'web') {
        window.alert(`Erro na Importação: ${errMsg}`);
      } else {
        Alert.alert('Erro na Importação', errMsg);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>📥 Importador de Planilha In-Place CSV</Text>
      <Text style={styles.description}>
        Cole os registros CSV abaixo. Os dados serão consolidados diretamente na sua planilha ativa{' '}
        <Text style={{ fontWeight: '700', color: colors.accent.purple }}>
          "{activeTable?.name || 'Sem Tabela Active'}"
        </Text>
        . Padrões de setores serão auto-detectados para habilitar as ferramentas adequadas.
      </Text>

      <TextInput
        style={styles.codeTextarea}
        multiline
        value={csvText}
        onChangeText={setCsvText}
        placeholder="date,value,description,entryType,category,tags,metadata_json&#10;2026-07-21,150.00,Combustivel Posto,expense,Transporte,cpk,{}"
        placeholderTextColor={colors.text.disabled}
        editable={!isProcessing}
      />

      <View style={styles.actionRow}>
        <Pressable
          style={[styles.actionBtn, isProcessing && styles.disabledBtn]}
          onPress={handleImport}
          disabled={isProcessing}
        >
          <Text style={styles.actionBtnText}>
            {isProcessing ? 'Processando...' : '🚀 Consolidação In-Place'}
          </Text>
        </Pressable>
        {onCancel && (
          <Pressable
            style={[styles.actionBtn, { backgroundColor: colors.background.tertiary }]}
            onPress={onCancel}
            disabled={isProcessing}
          >
            <Text style={styles.actionBtnText}>Cancelar</Text>
          </Pressable>
        )}
      </View>

      {statusMsg !== '' && (
        <View style={styles.statusBanner}>
          <Text style={styles.statusText}>{statusMsg}</Text>
        </View>
      )}

      {errorLogs.length > 0 && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorHeader}>Erros/Alertas de Reconciliação ({errorLogs.length}):</Text>
          <ScrollView style={styles.errorScroll}>
            {errorLogs.map((log, index) => (
              <Text key={index} style={styles.errorLogText}>
                • {log}
              </Text>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background.primary,
    borderColor: colors.border.default,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
  },
  description: {
    fontSize: 11,
    color: colors.text.secondary,
    lineHeight: 15,
  },
  codeTextarea: {
    backgroundColor: '#0d1117',
    borderColor: colors.border.default,
    borderWidth: 1,
    borderRadius: radius.sm,
    color: '#a5d6ff',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 10,
    padding: spacing.sm,
    height: 150,
    textAlignVertical: 'top',
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: colors.accent.purple,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledBtn: {
    backgroundColor: colors.background.tertiary,
    opacity: 0.6,
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.primary,
  },
  statusBanner: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderColor: 'rgba(16, 185, 129, 0.25)',
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  statusText: {
    fontSize: 11,
    color: colors.success.main,
    fontWeight: '600',
    textAlign: 'center',
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    borderColor: 'rgba(239, 68, 68, 0.25)',
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: spacing.sm,
    gap: 4,
  },
  errorHeader: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.danger.main,
  },
  errorScroll: {
    maxHeight: 100,
  },
  errorLogText: {
    fontSize: 9,
    color: colors.text.secondary,
    lineHeight: 12,
  },
});
