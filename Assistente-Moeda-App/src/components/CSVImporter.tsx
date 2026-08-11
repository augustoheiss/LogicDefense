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
  const { importSpreadsheet, activeTable, updateActiveSectors } = useCoinDB() as any;
  const [csvText, setCsvText] = useState('');
  const [errorLogs, setErrorLogs] = useState<string[]>([]);
  const [statusMsg, setStatusMsg] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleImport = async (importMode: 'merge' | 'replace' = 'merge') => {
    if (!csvText.trim()) {
      setErrorLogs(['Por favor, cole um conteúdo CSV válido.']);
      return;
    }

    setIsProcessing(true);
    setErrorLogs([]);
    setStatusMsg('');

    try {
      console.log('[CSV Import Step 1]: Raw text length', csvText.length, 'mode:', importMode);
      const parsed = parseCSVText(csvText);
      console.log('[CSV Import Step 2]: Parsed output', parsed);

      if (parsed.errors.length > 0) {
        setErrorLogs(parsed.errors);
        setIsProcessing(false);
        return;
      }

      if (parsed.rows.length === 0) {
        setErrorLogs(['Nenhuma linha de transação foi encontrada no CSV.']);
        setIsProcessing(false);
        return;
      }

      // Commit rows, name, description, goals, tableId, apiKey, and lastEventSeq in ONE ATOMIC OPERATION
      const importRes = await importSpreadsheet({
        rows: parsed.rows,
        tableId: parsed.metadata?.tableId,
        apiKey: parsed.metadata?.apiKey,
        lastEventSeq: parsed.metadata?.lastEventSeq,
        name: parsed.metadata?.name,
        description: parsed.metadata?.description,
        goals: parsed.metadata?.tableGoals,
        mode: importMode,
      });

      if (parsed.detectedSectors && parsed.detectedSectors.length > 0) {
        try {
          await updateActiveSectors(parsed.detectedSectors);
        } catch (secErr) {
          console.warn('[Import Warning]: Skipped sectors update', secErr);
        }
      }

      // Trigger dynamic activeSectors toggles
      const currentActiveSectors = activeTable?.activeSectors || ['personal_finance'];
      const sectorsToActivate = parsed.detectedSectors.filter(
        (sec) => !currentActiveSectors.includes(sec)
      );

      if (sectorsToActivate.length > 0) {
        const nextSectors = Array.from(new Set([...currentActiveSectors, ...sectorsToActivate]));
        await updateActiveSectors(nextSectors);
      }

      setCsvText('');

      // 1. Close modal FIRST so React commits state and re-renders main screen
      if (onSuccess) {
        onSuccess();
      }

      // 2. Trigger completion alert AFTER modal closes and render cycle flushes
      setTimeout(() => {
        const activeTableName = parsed.metadata?.name || activeTable?.name || 'Ativa';
        const successTitle = 'Importação Concluída! 🎉';
        const modeLabel = importMode === 'merge' ? 'acumuladas' : 'carregadas (substituição)';
        let successMsg = `Sucesso! ${parsed.rows.length} transações foram ${modeLabel} na planilha "${activeTableName}".`;
        if (importRes?.keyWasAutoRenewed) {
          successMsg += '\n\n🔑 Planilha restaurada com sucesso! Uma nova Chave API ativa foi gerada para este ambiente.';
        }

        if (Platform.OS === 'web') {
          window.alert(`${successTitle}\n\n${successMsg}`);
        } else {
          Alert.alert(successTitle, successMsg);
        }
      }, 100);
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
        Cole os registros CSV abaixo. Escolha se deseja{' '}
        <Text style={{ fontWeight: '700', color: colors.accent.purple }}>Acumular (Mesclar)</Text> com as entradas existentes ou{' '}
        <Text style={{ fontWeight: '700', color: colors.info.main }}>Substituir</Text> a planilha ativa{' '}
        <Text style={{ fontWeight: '700', color: colors.accent.purple }}>
          "{activeTable?.name || 'Sem Tabela Ativa'}"
        </Text>.
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
          onPress={() => handleImport('merge')}
          disabled={isProcessing}
        >
          <Text style={styles.actionBtnText}>
            {isProcessing ? 'Processando...' : '➕ Acumular Entradas'}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.actionBtn, { backgroundColor: colors.info.main }, isProcessing && styles.disabledBtn]}
          onPress={() => handleImport('replace')}
          disabled={isProcessing}
        >
          <Text style={styles.actionBtnText}>
            {isProcessing ? 'Processando...' : '🔄 Substituir Planilha'}
          </Text>
        </Pressable>
        {onCancel && (
          <Pressable
            style={[styles.actionBtn, { backgroundColor: colors.background.tertiary, flex: 0.7 }]}
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
