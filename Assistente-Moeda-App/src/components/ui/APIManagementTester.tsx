/**
 * API Management & Testing Console — Assistente Moeda
 *
 * Área interativa para manuseio, teste e envio em massa de dados via API Pública (OpenAPI 3.1).
 * Suporta modo 'merge' e 'replace', envio por JSON ou CSV bruto e integração com IA Pública.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { typography } from '@/theme/typography';
import { Card } from '@/components/ui/Card';
import {
  DEFAULT_PUBLIC_API_KEY,
  PUBLIC_API_HEADER_NAME,
  DEFAULT_PUBLIC_API_URL,
  LOCAL_PUBLIC_API_URL,
  OPENAPI_SPEC_V1,
  AppendTransactionItem,
} from '@/config/publicApiConfig';
import {
  getAnalysisContext,
  exportSpreadsheetCsv,
  appendToSpreadsheet,
  publicAiAnalyst,
  APIExecutionResult,
} from '@/services/publicApiService';

type ActiveTab = 'context' | 'export' | 'append' | 'spec';

export function APIManagementTester() {
  const [apiKey, setApiKey] = useState(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const activeKey = window.localStorage.getItem('coin_active_api_key');
      if (activeKey && activeKey.startsWith('am_sheet_live_')) {
        return activeKey;
      }
    }
    return DEFAULT_PUBLIC_API_KEY;
  });
  const [baseUrl, setBaseUrl] = useState(DEFAULT_PUBLIC_API_URL);
  const [activeTab, setActiveTab] = useState<ActiveTab>('append');

  React.useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const activeKey = window.localStorage.getItem('coin_active_api_key');
      if (activeKey && activeKey.startsWith('am_sheet_live_')) {
        setApiKey(activeKey);
      }
    }
  }, []);

  // Loading state
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<APIExecutionResult<any> | null>(null);

  // GET /analysis-context states
  const [asOfDate, setAsOfDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // GET /spreadsheet/export states
  const [exportDownload, setExportDownload] = useState(false);

  // POST /spreadsheet/append states (MASS MANIPULATION)
  const [appendMode, setAppendMode] = useState<'merge' | 'replace'>('merge');
  const [inputFormat, setInputFormat] = useState<'json' | 'csv'>('json');
  const [jsonInput, setJsonInput] = useState<string>(
    JSON.stringify(
      [
        {
          date: new Date().toISOString().split('T')[0],
          value: 150.0,
          description: 'Venda Consultoria API Exemplo 1',
          entryType: 'revenue',
          category: 'Serviços',
          tags: 'api_teste,vendas',
          externalId: `ext_test_${Date.now()}_1`,
        },
        {
          date: new Date().toISOString().split('T')[0],
          value: 45.9,
          description: 'Despesa Servidor API Exemplo 2',
          entryType: 'expense',
          category: 'Tecnologia',
          tags: 'api_teste,infra',
          externalId: `ext_test_${Date.now()}_2`,
        },
      ],
      null,
      2
    )
  );
  const [csvInput, setCsvInput] = useState<string>(
    `Data;Valor;Descrição;Tipo;Categoria;Tags;ID_Externo\n${new Date().toISOString().split('T')[0]};299.90;Assinatura SaaS Lote;revenue;Software;lote,api;ext_csv_${Date.now()}`
  );

  // Quick preset generators
  const loadPresetSales = () => {
    const today = new Date().toISOString().split('T')[0];
    const items: AppendTransactionItem[] = [
      { date: today, value: 1250.00, description: 'Venda Licença Anual SaaS', entryType: 'revenue', category: 'Software', tags: 'venda_direta,api_lote', externalId: `sale_${Date.now()}_1` },
      { date: today, value: 450.00, description: 'Consultoria Especializada IA', entryType: 'revenue', category: 'Serviços', tags: 'consultoria,api_lote', externalId: `sale_${Date.now()}_2` },
      { date: today, value: 890.00, description: 'Desenvolvimento de Automação', entryType: 'revenue', category: 'Serviços', tags: 'automacao,n8n', externalId: `sale_${Date.now()}_3` },
      { date: today, value: 150.00, description: 'Suporte Técnico Premium', entryType: 'revenue', category: 'Suporte', tags: 'suporte,mensal', externalId: `sale_${Date.now()}_4` },
      { date: today, value: 3200.00, description: 'Projeto Customizado Backend', entryType: 'revenue', category: 'Projetos', tags: 'backend,api', externalId: `sale_${Date.now()}_5` },
    ];
    setInputFormat('json');
    setJsonInput(JSON.stringify(items, null, 2));
  };

  const loadPresetExpenses = () => {
    const today = new Date().toISOString().split('T')[0];
    const items: AppendTransactionItem[] = [
      { date: today, value: 89.90, description: 'Hospedagem Cloud Render', entryType: 'expense', category: 'Infraestrutura', tags: 'servidor,cloud', externalId: `exp_${Date.now()}_1` },
      { date: today, value: 149.00, description: 'Licença Software Figma', entryType: 'expense', category: 'Ferramentas', tags: 'design,saas', externalId: `exp_${Date.now()}_2` },
      { date: today, value: 350.00, description: 'Campanha Tráfego Pago Meta', entryType: 'expense', category: 'Marketing', tags: 'ads,facebook', externalId: `exp_${Date.now()}_3` },
      { date: today, value: 120.00, description: 'Domínios e SSL Anual', entryType: 'expense', category: 'Infraestrutura', tags: 'web,ssl', externalId: `exp_${Date.now()}_4` },
    ];
    setInputFormat('json');
    setJsonInput(JSON.stringify(items, null, 2));
  };

  const loadPresetCsv = () => {
    const today = new Date().toISOString().split('T')[0];
    const csv = `Data;Valor;Descrição;Tipo;Categoria;Tags;ID_Externo
${today};500.00;Receita Projeto Alfa;revenue;Vendas;lote_csv;csv_1
${today};120.50;Compra Material Escritório;expense;Operacional;lote_csv;csv_2
${today};1500.00;Aporte Sócio Capital;partner_in;Socios;lote_csv;csv_3`;
    setInputFormat('csv');
    setCsvInput(csv);
  };

  // Handlers
  const handleTestConnection = async () => {
    setLoading(true);
    const res = await getAnalysisContext({}, apiKey, baseUrl);
    setLoading(false);
    setLastResult(res);
    if (res.success) {
      Alert.alert('Sucesso!', `Conexão efetuada com sucesso! Latência: ${res.latencyMs}ms`);
    } else {
      Alert.alert('Falha na Conexão', res.error || 'Não foi possível validar a chave.');
    }
  };

  const handleRunGetContext = async () => {
    setLoading(true);
    const res = await getAnalysisContext({ as_of_date: asOfDate, start_date: startDate, end_date: endDate }, apiKey, baseUrl);
    setLoading(false);
    setLastResult(res);
  };

  const handleRunExportCsv = async () => {
    setLoading(true);
    const res = await exportSpreadsheetCsv(exportDownload, apiKey, baseUrl);
    setLoading(false);
    setLastResult(res);
  };

  const handleRunAppendMass = async () => {
    setLoading(true);
    try {
      let payloadPayload: any = { mode: appendMode };

      if (inputFormat === 'json') {
        const parsed = JSON.parse(jsonInput);
        if (!Array.isArray(parsed)) {
          throw new Error('O JSON deve ser um Array de objetos com as transações.');
        }
        payloadPayload.transactions = parsed;
      } else {
        payloadPayload.csvContent = csvInput;
      }

      const res = await appendToSpreadsheet(payloadPayload, apiKey, baseUrl);
      setLoading(false);
      setLastResult(res);

      if (res.success && res.data) {
        Alert.alert(
          'Sucesso no Envio!',
          `Operação concluída em modo '${res.data.mode}'.\nInseridas: ${res.data.insertedCount}\nAtualizadas: ${res.data.updatedCount}\nTotal: ${res.data.totalCount}`
        );
      }
    } catch (err: any) {
      setLoading(false);
      Alert.alert('Erro no Payload', err.message || 'JSON inválido');
    }
  };



  const copyResultToClipboard = async () => {
    if (!lastResult) return;
    const textToCopy = lastResult.rawResponse || JSON.stringify(lastResult, null, 2);
    await Clipboard.setStringAsync(textToCopy);
    Alert.alert('Copiado', 'Resultado copiado para a área de transferência!');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>🔌 API Live Tester & Auto-Manager</Text>
        <Text style={styles.subtitle}>
          Manuseio em massa da planilha via Public API OpenAPI v1.
        </Text>
      </View>

      {/* Connection & Auth Card */}
      <Card style={styles.card}>
        <Text style={styles.cardHeader}>🔑 Autenticação e Configuração do Servidor</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Cabeçalho Obrigatório (Exact Header Name):</Text>
          <View style={styles.badgeReadonly}>
            <Text style={styles.badgeText}>{PUBLIC_API_HEADER_NAME}</Text>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Chave de API Pública (X-Spreadsheet-Key):</Text>
          <TextInput
            style={styles.input}
            value={apiKey}
            onChangeText={setApiKey}
            placeholder="am_sheet_live_..."
            placeholderTextColor={colors.text.disabled}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>URL do Servidor Ativo:</Text>
          <TextInput
            style={styles.input}
            value={baseUrl}
            onChangeText={setBaseUrl}
            placeholder="https://..."
            placeholderTextColor={colors.text.disabled}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.urlPresetsRow}>
          <Pressable
            style={[styles.presetChip, baseUrl === DEFAULT_PUBLIC_API_URL && styles.presetChipActive]}
            onPress={() => setBaseUrl(DEFAULT_PUBLIC_API_URL)}
          >
            <Text style={styles.presetChipText}>🌐 Servidor Render (Live)</Text>
          </Pressable>

          <Pressable
            style={[styles.presetChip, baseUrl === LOCAL_PUBLIC_API_URL && styles.presetChipActive]}
            onPress={() => setBaseUrl(LOCAL_PUBLIC_API_URL)}
          >
            <Text style={styles.presetChipText}>💻 Servidor Local (8000)</Text>
          </Pressable>
        </View>

        <Pressable
          style={({ pressed }) => [styles.btnPrimary, pressed && styles.btnPressed]}
          onPress={handleTestConnection}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.btnPrimaryText}>⚡ Testar Conexão com API</Text>
          )}
        </Pressable>
      </Card>

      {/* Tabs Row */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsRow}>
        <Pressable
          style={[styles.tabButton, activeTab === 'append' && styles.tabButtonActive]}
          onPress={() => setActiveTab('append')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'append' && styles.tabButtonTextActive]}>
            🚀 Envio em Massa
          </Text>
        </Pressable>

        <Pressable
          style={[styles.tabButton, activeTab === 'context' && styles.tabButtonActive]}
          onPress={() => setActiveTab('context')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'context' && styles.tabButtonTextActive]}>
            📊 Contexto (GET)
          </Text>
        </Pressable>

        <Pressable
          style={[styles.tabButton, activeTab === 'export' && styles.tabButtonActive]}
          onPress={() => setActiveTab('export')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'export' && styles.tabButtonTextActive]}>
            📥 Exportar CSV
          </Text>
        </Pressable>

        <Pressable
          style={[styles.tabButton, activeTab === 'spec' && styles.tabButtonActive]}
          onPress={() => setActiveTab('spec')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'spec' && styles.tabButtonTextActive]}>
            📜 OpenAPI Spec
          </Text>
        </Pressable>
      </ScrollView>

      {/* TAB CONTENT 1: MASS APPEND / REPLACE */}
      {activeTab === 'append' && (
        <Card style={styles.card}>
          <Text style={styles.cardHeader}>🚀 Manuseio e Alteração de Planilha em Massa</Text>
          <Text style={styles.description}>
            Endpoint: <Text style={styles.codeText}>POST /api/v1/public/spreadsheet/append</Text>
          </Text>

          {/* Mode Selector */}
          <Text style={styles.sectionLabel}>1. Selecione o Modo de Importação:</Text>
          <View style={styles.toggleGroup}>
            <Pressable
              style={[styles.toggleBtn, appendMode === 'merge' && styles.toggleBtnActive]}
              onPress={() => setAppendMode('merge')}
            >
              <Text style={[styles.toggleBtnText, appendMode === 'merge' && styles.toggleBtnTextActive]}>
                ➕ Merge (Acumular / Manter Existentes)
              </Text>
            </Pressable>

            <Pressable
              style={[styles.toggleBtn, appendMode === 'replace' && styles.toggleBtnDanger]}
              onPress={() => setAppendMode('replace')}
            >
              <Text style={[styles.toggleBtnText, appendMode === 'replace' && styles.toggleBtnTextActive]}>
                ⚠️ Replace (Substituir Planilha Inteira)
              </Text>
            </Pressable>
          </View>

          {/* Format Selector */}
          <Text style={styles.sectionLabel}>2. Formato do Payload:</Text>
          <View style={styles.toggleGroup}>
            <Pressable
              style={[styles.toggleBtn, inputFormat === 'json' && styles.toggleBtnActive]}
              onPress={() => setInputFormat('json')}
            >
              <Text style={[styles.toggleBtnText, inputFormat === 'json' && styles.toggleBtnTextActive]}>
                JSON Array
              </Text>
            </Pressable>

            <Pressable
              style={[styles.toggleBtn, inputFormat === 'csv' && styles.toggleBtnActive]}
              onPress={() => setInputFormat('csv')}
            >
              <Text style={[styles.toggleBtnText, inputFormat === 'csv' && styles.toggleBtnTextActive]}>
                Texto CSV Bruto
              </Text>
            </Pressable>
          </View>

          {/* Quick Presets */}
          <Text style={styles.sectionLabel}>3. Modelos Rápidos para Teste:</Text>
          <View style={styles.presetsContainer}>
            <Pressable style={styles.presetActionBtn} onPress={loadPresetSales}>
              <Text style={styles.presetActionBtnText}>💰 5 Vendas Exemplo</Text>
            </Pressable>
            <Pressable style={styles.presetActionBtn} onPress={loadPresetExpenses}>
              <Text style={styles.presetActionBtnText}>📉 4 Despesas Exemplo</Text>
            </Pressable>
            <Pressable style={styles.presetActionBtn} onPress={loadPresetCsv}>
              <Text style={styles.presetActionBtnText}>📄 CSV 3 Transações</Text>
            </Pressable>
          </View>

          {/* Input Textarea */}
          <Text style={styles.sectionLabel}>
            4. Conteúdo das Transações ({inputFormat.toUpperCase()}):
          </Text>
          {inputFormat === 'json' ? (
            <TextInput
              style={styles.textArea}
              value={jsonInput}
              onChangeText={setJsonInput}
              multiline
              numberOfLines={10}
              autoCapitalize="none"
              autoCorrect={false}
            />
          ) : (
            <TextInput
              style={styles.textArea}
              value={csvInput}
              onChangeText={setCsvInput}
              multiline
              numberOfLines={8}
              autoCapitalize="none"
              autoCorrect={false}
            />
          )}

          <Pressable
            style={({ pressed }) => [styles.btnSuccess, pressed && styles.btnPressed]}
            onPress={handleRunAppendMass}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.btnSuccessText}>
                🚀 Executar Alterações em Massa (API)
              </Text>
            )}
          </Pressable>
        </Card>
      )}

      {/* TAB CONTENT 2: CONTEXT */}
      {activeTab === 'context' && (
        <Card style={styles.card}>
          <Text style={styles.cardHeader}>📊 Contexto Financeiro Estruturado</Text>
          <Text style={styles.description}>
            Endpoint: <Text style={styles.codeText}>GET /api/v1/public/analysis-context</Text>
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>As Of Date (YYYY-MM-DD):</Text>
            <TextInput
              style={styles.input}
              value={asOfDate}
              onChangeText={setAsOfDate}
              placeholder="Ex: 2026-08-08 (Opcional)"
              placeholderTextColor={colors.text.disabled}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Start Date (YYYY-MM-DD):</Text>
            <TextInput
              style={styles.input}
              value={startDate}
              onChangeText={setStartDate}
              placeholder="Ex: 2026-01-01 (Opcional)"
              placeholderTextColor={colors.text.disabled}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>End Date (YYYY-MM-DD):</Text>
            <TextInput
              style={styles.input}
              value={endDate}
              onChangeText={setEndDate}
              placeholder="Ex: 2026-12-31 (Opcional)"
              placeholderTextColor={colors.text.disabled}
            />
          </View>

          <Pressable
            style={({ pressed }) => [styles.btnPrimary, pressed && styles.btnPressed]}
            onPress={handleRunGetContext}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.btnPrimaryText}>🔍 Buscar Contexto Financeiro</Text>
            )}
          </Pressable>
        </Card>
      )}

      {/* TAB CONTENT 3: EXPORT */}
      {activeTab === 'export' && (
        <Card style={styles.card}>
          <Text style={styles.cardHeader}>📥 Exportar Planilha em CSV v2</Text>
          <Text style={styles.description}>
            Endpoint: <Text style={styles.codeText}>GET /api/v1/public/spreadsheet/export</Text>
          </Text>

          <Pressable
            style={styles.checkboxRow}
            onPress={() => setExportDownload(!exportDownload)}
          >
            <Text style={styles.checkboxIcon}>{exportDownload ? '☑️' : '⏹️'}</Text>
            <Text style={styles.checkboxLabel}>
              Solicitar como arquivo de download (.csv)
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.btnPrimary, pressed && styles.btnPressed]}
            onPress={handleRunExportCsv}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.btnPrimaryText}>📥 Exportar Planilha Agora</Text>
            )}
          </Pressable>
        </Card>
      )}

      {/* TAB CONTENT 4: OPENAPI SPEC */}
      {activeTab === 'spec' && (
        <Card style={styles.card}>
          <Text style={styles.cardHeader}>📜 Especificação OpenAPI 3.1.0 Oficial (Integração com IAs Externas)</Text>
          <Text style={styles.description}>
            Conecte IAs externas avançadas (ChatGPT, Claude 3.5, Custom GPTs, n8n) usando esta especificação técnica e sua Chave API. As IAs externas oferecem raciocínio muito superior, automação flexível e comandos avançados.
          </Text>

          <TextInput
            style={styles.textArea}
            value={JSON.stringify(OPENAPI_SPEC_V1, null, 2)}
            editable={false}
            multiline
            numberOfLines={14}
          />

          <Pressable
            style={styles.btnSecondary}
            onPress={async () => {
              await Clipboard.setStringAsync(JSON.stringify(OPENAPI_SPEC_V1, null, 2));
              Alert.alert('Copiado', 'OpenAPI Schema copiado com sucesso!');
            }}
          >
            <Text style={styles.btnSecondaryText}>📋 Copiar OpenAPI JSON Integrador</Text>
          </Pressable>
        </Card>
      )}

      {/* RESULTS / RESPONSE VIEWER PANEL */}
      {lastResult && (
        <Card style={styles.cardResult}>
          <View style={styles.resultHeaderRow}>
            <Text style={styles.resultTitle}>
              {lastResult.success ? '✅ Resposta da API (Sucesso)' : '❌ Resposta da API (Erro)'}
            </Text>
            <Text style={styles.resultBadge}>HTTP {lastResult.status}</Text>
            <Text style={styles.latencyBadge}>{lastResult.latencyMs} ms</Text>
          </View>

          {lastResult.error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorBoxText}>{lastResult.error}</Text>
            </View>
          )}

          {lastResult.data && typeof lastResult.data === 'object' && (
            <View style={styles.dataSummaryBox}>
              {'insertedCount' in (lastResult.data as any) && (
                <Text style={styles.dataSummaryText}>
                  Mode: {(lastResult.data as any).mode} | Inseridos: {(lastResult.data as any).insertedCount} | Atualizados: {(lastResult.data as any).updatedCount} | Total: {(lastResult.data as any).totalCount}
                </Text>
              )}
              {'message' in (lastResult.data as any) && (
                <Text style={styles.dataSummarySub}>{(lastResult.data as any).message}</Text>
              )}
            </View>
          )}

          <ScrollView style={styles.responseScrollView} nestedScrollEnabled>
            <Text style={styles.rawResponseText}>
              {lastResult.rawResponse || JSON.stringify(lastResult.data, null, 2)}
            </Text>
          </ScrollView>

          <Pressable style={styles.copyBtn} onPress={copyResultToClipboard}>
            <Text style={styles.copyBtnText}>📋 Copiar Resposta Bruta</Text>
          </Pressable>
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  content: {
    padding: spacing.md,
    paddingBottom: 40,
  },
  header: {
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  card: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  cardHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  description: {
    fontSize: 13,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  codeText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: colors.accent.purple,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: spacing.sm,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: 4,
  },
  input: {
    backgroundColor: colors.background.secondary,
    color: colors.text.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    fontSize: 13,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  textArea: {
    backgroundColor: colors.background.secondary,
    color: colors.text.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    borderWidth: 1,
    borderColor: colors.border.default,
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: spacing.sm,
  },
  badgeReadonly: {
    backgroundColor: colors.background.tertiary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.success.main,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  urlPresetsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.md,
  },
  presetChip: {
    backgroundColor: colors.background.secondary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  presetChipActive: {
    borderColor: colors.accent.purple,
    backgroundColor: colors.background.tertiary,
  },
  presetChipText: {
    fontSize: 11,
    color: colors.text.primary,
  },
  btnPrimary: {
    backgroundColor: colors.accent.purple,
    paddingVertical: 12,
    borderRadius: radius.sm,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  btnPrimaryText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  btnSuccess: {
    backgroundColor: '#10b981',
    paddingVertical: 14,
    borderRadius: radius.sm,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  btnSuccessText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  btnSecondary: {
    backgroundColor: colors.background.secondary,
    paddingVertical: 10,
    borderRadius: radius.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  btnSecondaryText: {
    color: colors.text.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  btnPressed: {
    opacity: 0.8,
  },
  tabsRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  tabButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.background.secondary,
    marginRight: 8,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  tabButtonActive: {
    backgroundColor: colors.accent.purple,
    borderColor: colors.accent.purple,
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  tabButtonTextActive: {
    color: '#ffffff',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.primary,
    marginTop: spacing.sm,
    marginBottom: 6,
  },
  toggleGroup: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.sm,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
  },
  toggleBtnActive: {
    borderColor: colors.accent.purple,
    backgroundColor: colors.background.tertiary,
  },
  toggleBtnDanger: {
    borderColor: '#ef4444',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  toggleBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  toggleBtnTextActive: {
    color: colors.text.primary,
  },
  presetsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: spacing.sm,
  },
  presetActionBtn: {
    backgroundColor: colors.background.secondary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  presetActionBtnText: {
    fontSize: 11,
    color: colors.text.primary,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: 8,
  },
  checkboxIcon: {
    fontSize: 18,
  },
  checkboxLabel: {
    fontSize: 13,
    color: colors.text.primary,
  },
  cardResult: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.accent.purple,
  },
  resultHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.sm,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
    flex: 1,
  },
  resultBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
    backgroundColor: colors.accent.purple,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  latencyBadge: {
    fontSize: 11,
    color: colors.text.disabled,
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    padding: 10,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  errorBoxText: {
    color: '#fca5a5',
    fontSize: 12,
  },
  dataSummaryBox: {
    backgroundColor: colors.background.tertiary,
    padding: 10,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
  },
  dataSummaryText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.success.main,
  },
  dataSummarySub: {
    fontSize: 11,
    color: colors.text.secondary,
    marginTop: 2,
  },
  responseScrollView: {
    maxHeight: 200,
    backgroundColor: colors.background.secondary,
    padding: 10,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
  },
  rawResponseText: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: colors.text.primary,
  },
  copyBtn: {
    backgroundColor: colors.background.secondary,
    paddingVertical: 8,
    borderRadius: radius.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  copyBtnText: {
    fontSize: 12,
    color: colors.text.primary,
    fontWeight: '600',
  },
});
