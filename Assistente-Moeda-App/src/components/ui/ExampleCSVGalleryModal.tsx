import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import {
  EXAMPLE_CSV_PROFILES,
  ExampleCSVProfile,
} from '../../data/exampleCsvProfiles';
import { parseCSVText } from '../../utils/csvEngine';
import { detectSectorsFromRows } from '../../utils/sectorTagDetector';
import { shareCSVText } from '../../services/exportService';
import {
  TableRow,
  TableGoals,
  DynamicTableSchema,
  InvestorProfileConfig,
  DashboardConfig,
  SectorSimulationParams,
} from '../../core/types';

export interface ExampleCSVGalleryModalProps {
  visible: boolean;
  onClose: () => void;
  initialProfileId?: string;
  onImportExample: (payload: {
    rows: (TableRow | Omit<TableRow, 'id'>)[];
    tableId?: string;
    apiKey?: string;
    lastEventSeq?: number;
    name?: string;
    description?: string;
    goals?: TableGoals;
    mode?: 'new' | 'replace' | 'merge';
    schema?: DynamicTableSchema;
    investorProfile?: InvestorProfileConfig;
    activeSectors?: string[];
    dashboardConfig?: DashboardConfig;
    sectorParams?: SectorSimulationParams;
  }) => Promise<any>;
  onOpenCustomImporter?: (prefillCsv?: string) => void;
  onOpenLiveSynthesis?: () => void;
}

type ViewTab = 'guide' | 'backup_v3' | 'simple_csv' | 'ai_prompt';

export function ExampleCSVGalleryModal({
  visible,
  onClose,
  initialProfileId,
  onImportExample,
  onOpenCustomImporter,
  onOpenLiveSynthesis,
}: ExampleCSVGalleryModalProps) {
  const [selectedId, setSelectedId] = useState<string>(
    initialProfileId || EXAMPLE_CSV_PROFILES[0].id
  );
  const [activeTab, setActiveTab] = useState<ViewTab>('guide');
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const selectedProfile: ExampleCSVProfile = useMemo(() => {
    return (
      EXAMPLE_CSV_PROFILES.find((p) => p.id === selectedId) ||
      EXAMPLE_CSV_PROFILES[0]
    );
  }, [selectedId]);

  const parsedPreview = useMemo(() => {
    return parseCSVText(selectedProfile.fullBackupV3Csv);
  }, [selectedProfile]);

  const showTemporaryFeedback = (msg: string) => {
    setStatusFeedback(msg);
    setTimeout(() => {
      setStatusFeedback((prev) => (prev === msg ? null : prev));
    }, 4000);
  };

  const handleCopyText = async (text: string, label: string) => {
    try {
      await Clipboard.setStringAsync(text);
      showTemporaryFeedback(`✅ ${label} copiado para a área de transferência!`);
    } catch {
      if (
        Platform.OS === 'web' &&
        typeof navigator !== 'undefined' &&
        navigator.clipboard
      ) {
        await navigator.clipboard.writeText(text);
        showTemporaryFeedback(`✅ ${label} copiado para a área de transferência!`);
      } else {
        Alert.alert('Erro', 'Não foi possível copiar automaticamente.');
      }
    }
  };

  const handleDownloadCsv = async (useCompact: boolean = false) => {
    const csvContent = useCompact
      ? selectedProfile.compactSimpleCsv
      : selectedProfile.fullBackupV3Csv;
    const baseName = selectedProfile.fileName.replace(/\.csv$/i, '');
    const suffix = useCompact ? '_Tabular_Excel' : '';
    await shareCSVText(csvContent, `${baseName}${suffix}`);
    showTemporaryFeedback(
      `📥 Arquivo ${baseName}${suffix}.csv gerado para download/compartilhamento!`
    );
  };

  const executeLoadIntoApp = async (mode: 'new' | 'replace' | 'merge') => {
    setIsBusy(true);
    try {
      const parsed = parseCSVText(selectedProfile.fullBackupV3Csv);
      const detectedSectors = detectSectorsFromRows(parsed.rows);
      const mergedSectors = Array.from(
        new Set([
          ...(parsed.metadata?.activeSectors || selectedProfile.activeSectors || []),
          ...detectedSectors,
        ])
      );

      await onImportExample({
        rows: parsed.rows,
        tableId: mode === 'new' ? undefined : parsed.metadata?.tableId,
        apiKey: undefined, // Sempre gera chave limpa local para a planilha
        lastEventSeq: 0,
        name: parsed.metadata?.name || `${selectedProfile.emoji} ${selectedProfile.title} (Exemplo)`,
        description: parsed.metadata?.description || selectedProfile.subtitle,
        goals: parsed.metadata?.tableGoals,
        mode,
        schema: parsed.metadata?.schema,
        investorProfile: parsed.metadata?.investorProfile,
        activeSectors: mergedSectors,
        dashboardConfig: parsed.metadata?.dashboardConfig,
        sectorParams: parsed.metadata?.sectorParams,
      });

      const actionLabel =
        mode === 'new'
          ? 'Nova planilha de exemplo criada e aberta!'
          : mode === 'replace'
          ? 'Planilha atual substituída pelo exemplo!'
          : 'Linhas de exemplo acumuladas na planilha atual!';

      showTemporaryFeedback(`🎉 ${actionLabel}`);
      setTimeout(() => {
        onClose();
      }, 650);
    } catch (err: any) {
      Alert.alert(
        'Erro ao carregar exemplo',
        err?.message || 'Não foi possível importar a planilha de exemplo.'
      );
    } finally {
      setIsBusy(false);
    }
  };

  const confirmReplaceCurrent = () => {
    const msg = `Deseja substituir os dados da planilha atual pelo modelo "${selectedProfile.title}"?\n\nDica: Se preferir preservar sua planilha atual intacta, use o botão "🆕 Abrir como Nova Planilha".`;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(msg)) {
        executeLoadIntoApp('replace');
      }
    } else {
      Alert.alert('Substituir Planilha Atual?', msg, [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Substituir Atual',
          style: 'destructive',
          onPress: () => executeLoadIntoApp('replace'),
        },
      ]);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>
                📚 Galeria de Modelos CSV por Perfil (8 Exemplos Fictícios)
              </Text>
              <Text style={styles.headerSubtitle}>
                Carregue um perfil de exemplo para testar o app ou baixe modelos CSV em branco/fictícios.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              accessibilityLabel="Fechar galeria de exemplos CSV"
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Privacy Guarantee Banner + Direct Switch to Active Spreadsheet Synthesis */}
          <View style={styles.privacyBanner}>
            <Text style={styles.privacyBannerText}>
              🔒 <Text style={{ fontWeight: '800', color: '#A5B4FC' }}>Galeria de Modelos Fictícios:</Text>{' '}
              Estes 8 modelos contêm apenas dados fictícios de demonstração por profissão.
            </Text>
            {onOpenLiveSynthesis && (
              <TouchableOpacity
                style={{
                  marginTop: 8,
                  backgroundColor: 'rgba(16, 185, 129, 0.2)',
                  borderColor: 'rgba(16, 185, 129, 0.6)',
                  borderWidth: 1,
                  borderRadius: 8,
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  alignItems: 'center',
                }}
                onPress={onOpenLiveSynthesis}
              >
                <Text style={{ color: '#6EE7B7', fontWeight: '800', fontSize: 12 }}>
                  🧠 Quer extrair as Rotas da API e a Síntese da SUA Planilha Atual? Clique Aqui →
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Profile Selector Strip */}
          <View style={styles.selectorWrapper}>
            <Text style={styles.sectionLabel}>
              ESCOLHA O PERFIL DE REFERÊNCIA ({EXAMPLE_CSV_PROFILES.length} MODELOS PRONTOS):
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.profileStrip}
            >
              {EXAMPLE_CSV_PROFILES.map((profile) => {
                const isSelected = profile.id === selectedProfile.id;
                return (
                  <TouchableOpacity
                    key={profile.id}
                    style={[
                      styles.profileChip,
                      isSelected && {
                        borderColor: profile.accentColor,
                        backgroundColor: `${profile.accentColor}22`,
                      },
                    ]}
                    onPress={() => setSelectedId(profile.id)}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.profileChipEmoji}>{profile.emoji}</Text>
                    <View>
                      <Text
                        style={[
                          styles.profileChipCode,
                          isSelected && { color: profile.accentColor },
                        ]}
                      >
                        MODELO #{profile.code}
                      </Text>
                      <Text
                        style={[
                          styles.profileChipTitle,
                          isSelected && styles.profileChipTitleActive,
                        ]}
                      >
                        {profile.shortTitle}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Feedback Toast inside Modal */}
          {statusFeedback && (
            <View style={styles.feedbackToast}>
              <Text style={styles.feedbackToastText}>{statusFeedback}</Text>
            </View>
          )}

          {/* Main Scrollable Content */}
          <ScrollView
            style={styles.bodyScroll}
            contentContainerStyle={styles.bodyScrollContent}
          >
            {/* Selected Profile Card */}
            <View
              style={[
                styles.heroCard,
                { borderColor: `${selectedProfile.accentColor}66` },
              ]}
            >
              <View style={styles.heroHeaderRow}>
                <Text style={styles.heroEmoji}>{selectedProfile.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <View style={styles.fileBadgeRow}>
                    <View
                      style={[
                        styles.codeBadge,
                        { backgroundColor: `${selectedProfile.accentColor}33` },
                      ]}
                    >
                      <Text
                        style={[
                          styles.codeBadgeText,
                          { color: selectedProfile.accentColor },
                        ]}
                      >
                        {selectedProfile.fileName}
                      </Text>
                    </View>
                    <View style={styles.rowsCountBadge}>
                      <Text style={styles.rowsCountBadgeText}>
                        {parsedPreview.rows.length} lançamentos • Preset:{' '}
                        {selectedProfile.presetId.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.heroTitle}>{selectedProfile.title}</Text>
                  <Text style={styles.heroSubtitle}>
                    {selectedProfile.subtitle}
                  </Text>
                </View>
              </View>

              {/* Direct Action Buttons: Test in Spreadsheet */}
              <View style={styles.primaryActionsGrid}>
                <TouchableOpacity
                  style={[
                    styles.primaryActionBtn,
                    { backgroundColor: selectedProfile.accentColor },
                  ]}
                  disabled={isBusy}
                  onPress={() => executeLoadIntoApp('new')}
                >
                  <Text style={styles.primaryActionBtnTitle}>
                    🆕 Abrir como Nova Planilha
                  </Text>
                  <Text style={styles.primaryActionBtnSub}>
                    Cria uma aba separada para você testar gráficos e exportações
                  </Text>
                </TouchableOpacity>

                <View style={styles.secondaryActionsRow}>
                  <TouchableOpacity
                    style={styles.secondaryActionBtn}
                    disabled={isBusy}
                    onPress={() => executeLoadIntoApp('merge')}
                  >
                    <Text style={styles.secondaryActionBtnText}>
                      ➕ Acumular na Atual
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.secondaryActionBtn, styles.replaceActionBtn]}
                    disabled={isBusy}
                    onPress={confirmReplaceCurrent}
                  >
                    <Text style={styles.replaceActionBtnText}>
                      🔄 Substituir Atual
                    </Text>
                  </TouchableOpacity>

                  {onOpenCustomImporter && (
                    <TouchableOpacity
                      style={styles.secondaryActionBtn}
                      disabled={isBusy}
                      onPress={() => {
                        onClose();
                        onOpenCustomImporter(selectedProfile.fullBackupV3Csv);
                      }}
                    >
                      <Text style={styles.secondaryActionBtnText}>
                        ✏️ Editar no Importador
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Export / Download / AI Copy Buttons */}
              <View style={styles.exportActionsRow}>
                <TouchableOpacity
                  style={styles.aiPromptBtn}
                  onPress={() =>
                    handleCopyText(
                      selectedProfile.aiBuilderPrompt,
                      `Prompt + Modelo (${selectedProfile.shortTitle})`
                    )
                  }
                >
                  <Text style={styles.aiPromptBtnText}>
                    🤖 Copiar Prompt + Modelo p/ Sua IA
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.downloadBtn}
                  onPress={() => handleDownloadCsv(false)}
                >
                  <Text style={styles.downloadBtnText}>
                    📥 Baixar .CSV (v3)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.downloadBtn}
                  onPress={() => handleDownloadCsv(true)}
                >
                  <Text style={styles.downloadBtnText}>
                    📊 Baixar p/ Excel
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Sub-navigation Tabs: Guide | Backup v3 CSV | Simple CSV | AI Prompt */}
            <View style={styles.tabBar}>
              <TouchableOpacity
                style={[
                  styles.tabItem,
                  activeTab === 'guide' && styles.tabItemActive,
                ]}
                onPress={() => setActiveTab('guide')}
              >
                <Text
                  style={[
                    styles.tabItemText,
                    activeTab === 'guide' && styles.tabItemTextActive,
                  ]}
                >
                  🧭 O que este exemplo inclui
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.tabItem,
                  activeTab === 'ai_prompt' && styles.tabItemActive,
                ]}
                onPress={() => setActiveTab('ai_prompt')}
              >
                <Text
                  style={[
                    styles.tabItemText,
                    activeTab === 'ai_prompt' && styles.tabItemTextActive,
                  ]}
                >
                  🤖 Prompt p/ Sua IA
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.tabItem,
                  activeTab === 'backup_v3' && styles.tabItemActive,
                ]}
                onPress={() => setActiveTab('backup_v3')}
              >
                <Text
                  style={[
                    styles.tabItemText,
                    activeTab === 'backup_v3' && styles.tabItemTextActive,
                  ]}
                >
                  📦 CSV Completo v3
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.tabItem,
                  activeTab === 'simple_csv' && styles.tabItemActive,
                ]}
                onPress={() => setActiveTab('simple_csv')}
              >
                <Text
                  style={[
                    styles.tabItemText,
                    activeTab === 'simple_csv' && styles.tabItemTextActive,
                  ]}
                >
                  📊 CSV Tabular (Excel)
                </Text>
              </TouchableOpacity>
            </View>

            {/* Tab Content */}
            {activeTab === 'guide' && (
              <View style={styles.guideContainer}>
                <View style={styles.infoBlock}>
                  <Text style={styles.infoBlockTitle}>
                    🎯 Para quem este modelo é ideal:
                  </Text>
                  {selectedProfile.recommendedFor.map((item, idx) => (
                    <Text key={idx} style={styles.bulletText}>
                      • {item}
                    </Text>
                  ))}
                </View>

                <View style={styles.infoBlock}>
                  <Text style={styles.infoBlockTitle}>
                    ⚙️ Recursos e Motores Demonstrados na Planilha:
                  </Text>
                  {selectedProfile.keyFeatures.map((feat, idx) => (
                    <Text key={idx} style={styles.bulletText}>
                      ✓ {feat}
                    </Text>
                  ))}
                </View>

                <View style={styles.infoBlock}>
                  <Text style={styles.infoBlockTitle}>
                    🔁 Ciclo Completo: Testar, Editar e Exportar Novamente
                  </Text>
                  <Text style={styles.stepParagraph}>
                    1. Clique em{' '}
                    <Text style={{ fontWeight: '700', color: '#F8FAFC' }}>
                      🆕 Abrir como Nova Planilha
                    </Text>{' '}
                    acima para carregar os {parsedPreview.rows.length} lançamentos fictícios em uma nova aba.
                  </Text>
                  <Text style={styles.stepParagraph}>
                    2. Navegue pelas abas <Text style={{ fontWeight: '700', color: '#F8FAFC' }}>Hoje</Text>,{' '}
                    <Text style={{ fontWeight: '700', color: '#F8FAFC' }}>Planilha</Text> e{' '}
                    <Text style={{ fontWeight: '700', color: '#F8FAFC' }}>Análises</Text> para ver como os gráficos, metas e simuladores setoriais reagem aos dados.
                  </Text>
                  <Text style={styles.stepParagraph}>
                    3. Na aba <Text style={{ fontWeight: '700', color: '#F8FAFC' }}>Planilha → 📤 Exportar</Text>, você pode exportar essa planilha novamente em{' '}
                    <Text style={{ color: '#93C5FD' }}>Backup Completo (.csv v3)</Text>,{' '}
                    <Text style={{ color: '#93C5FD' }}>CSV Filtrado / Granular</Text>,{' '}
                    <Text style={{ color: '#93C5FD' }}>Agent-Compact (Token-Saver)</Text>,{' '}
                    <Text style={{ color: '#93C5FD' }}>Relatório WhatsApp</Text> ou{' '}
                    <Text style={{ color: '#93C5FD' }}>Demonstrativo PDF</Text>.
                  </Text>
                </View>

                {/* Preview of first 6 rows */}
                <View style={styles.infoBlock}>
                  <Text style={styles.infoBlockTitle}>
                    🔍 Amostra dos Lançamentos Fictícios ({parsedPreview.rows.length} linhas no total):
                  </Text>
                  {parsedPreview.rows.slice(0, 6).map((r, i) => (
                    <View key={i} style={styles.sampleRowItem}>
                      <Text style={styles.sampleRowDate}>{r.date}</Text>
                      <Text
                        style={[
                          styles.sampleRowType,
                          r.entryType === 'revenue'
                            ? { color: '#34D399' }
                            : r.entryType === 'expense'
                            ? { color: '#F87171' }
                            : r.entryType === 'deposit'
                            ? { color: '#60A5FA' }
                            : { color: '#FBBF24' },
                        ]}
                      >
                        {(r.entryType || 'expense').toUpperCase()}
                      </Text>
                      <Text style={styles.sampleRowDesc} numberOfLines={1}>
                        {r.description}
                      </Text>
                      <Text style={styles.sampleRowVal}>
                        R$ {Number(r.value || 0).toFixed(2)}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {activeTab === 'ai_prompt' && (
              <View style={styles.codePreviewBox}>
                <View style={styles.codePreviewHeader}>
                  <Text style={styles.codePreviewTitle}>
                    🤖 Prompt Completo + Modelo ({selectedProfile.shortTitle})
                  </Text>
                  <TouchableOpacity
                    style={styles.copyCodeSmallBtn}
                    onPress={() =>
                      handleCopyText(
                        selectedProfile.aiBuilderPrompt,
                        'Prompt para IA'
                      )
                    }
                  >
                    <Text style={styles.copyCodeSmallBtnText}>
                      📋 Copiar Tudo
                    </Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.codeHelperCaption}>
                  Copie este texto, cole no seu ChatGPT, Claude, Gemini, DeepSeek ou IA local e adicione seus extratos/anotações no final:
                </Text>
                <ScrollView
                  horizontal
                  style={styles.codeHorizontalScroll}
                  contentContainerStyle={{ flexGrow: 1 }}
                >
                  <Text selectable style={styles.monospaceCode}>
                    {selectedProfile.aiBuilderPrompt}
                  </Text>
                </ScrollView>
              </View>
            )}

            {activeTab === 'backup_v3' && (
              <View style={styles.codePreviewBox}>
                <View style={styles.codePreviewHeader}>
                  <Text style={styles.codePreviewTitle}>
                    📦 {selectedProfile.fileName} (Formato Backup v3 Completo)
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      style={styles.copyCodeSmallBtn}
                      onPress={() =>
                        handleCopyText(
                          selectedProfile.fullBackupV3Csv,
                          'CSV Backup v3'
                        )
                      }
                    >
                      <Text style={styles.copyCodeSmallBtnText}>
                        📋 Copiar CSV
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.copyCodeSmallBtn,
                        { backgroundColor: '#1E3A8A' },
                      ]}
                      onPress={() => handleDownloadCsv(false)}
                    >
                      <Text style={styles.copyCodeSmallBtnText}>
                        📥 Baixar
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={styles.codeHelperCaption}>
                  Inclui cabeçalho de metadados, metas globais/anuais, perfil de investidor, setores ativos e linhas:
                </Text>
                <ScrollView
                  horizontal
                  style={styles.codeHorizontalScroll}
                  contentContainerStyle={{ flexGrow: 1 }}
                >
                  <Text selectable style={styles.monospaceCode}>
                    {selectedProfile.fullBackupV3Csv}
                  </Text>
                </ScrollView>
              </View>
            )}

            {activeTab === 'simple_csv' && (
              <View style={styles.codePreviewBox}>
                <View style={styles.codePreviewHeader}>
                  <Text style={styles.codePreviewTitle}>
                    📊 CSV Tabular Simples (Para abrir direto no Excel / Google Sheets)
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      style={styles.copyCodeSmallBtn}
                      onPress={() =>
                        handleCopyText(
                          selectedProfile.compactSimpleCsv,
                          'CSV Tabular'
                        )
                      }
                    >
                      <Text style={styles.copyCodeSmallBtnText}>
                        📋 Copiar CSV
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.copyCodeSmallBtn,
                        { backgroundColor: '#1E3A8A' },
                      ]}
                      onPress={() => handleDownloadCsv(true)}
                    >
                      <Text style={styles.copyCodeSmallBtnText}>
                        📥 Baixar
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={styles.codeHelperCaption}>
                  Contém apenas a linha de colunas e os lançamentos — ideal para editar em planilhas tradicionais e importar de volta:
                </Text>
                <ScrollView
                  horizontal
                  style={styles.codeHorizontalScroll}
                  contentContainerStyle={{ flexGrow: 1 }}
                >
                  <Text selectable style={styles.monospaceCode}>
                    {selectedProfile.compactSimpleCsv}
                  </Text>
                </ScrollView>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  sheet: {
    width: '100%',
    maxWidth: 860,
    maxHeight: '94%',
    backgroundColor: '#0F172A',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1E293B',
    overflow: 'hidden',
    flexShrink: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    backgroundColor: '#0B1120',
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 3,
    lineHeight: 17,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  closeBtnText: {
    color: '#CBD5E1',
    fontSize: 15,
    fontWeight: '700',
  },
  privacyBanner: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(16, 185, 129, 0.25)',
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  privacyBannerText: {
    color: '#D1FAE5',
    fontSize: 11.5,
    lineHeight: 16,
  },
  selectorWrapper: {
    paddingTop: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    backgroundColor: '#0F172A',
  },
  sectionLabel: {
    color: '#94A3B8',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.6,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  profileStrip: {
    paddingHorizontal: 14,
    gap: 8,
  },
  profileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    borderWidth: 1.5,
    borderColor: '#334155',
  },
  profileChipEmoji: {
    fontSize: 20,
  },
  profileChipCode: {
    color: '#94A3B8',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  profileChipTitle: {
    color: '#E2E8F0',
    fontSize: 12.5,
    fontWeight: '700',
  },
  profileChipTitleActive: {
    color: '#FFFFFF',
  },
  feedbackToast: {
    backgroundColor: '#065F46',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#10B981',
  },
  feedbackToastText: {
    color: '#ECFDF5',
    fontSize: 12.5,
    fontWeight: '700',
    textAlign: 'center',
  },
  bodyScroll: {
    flex: 1,
  },
  bodyScrollContent: {
    padding: 16,
    paddingBottom: 28,
    gap: 14,
  },
  heroCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    gap: 12,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  heroEmoji: {
    fontSize: 34,
    marginTop: 2,
  },
  fileBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  codeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  codeBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  rowsCountBadge: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  rowsCountBadgeText: {
    color: '#CBD5E1',
    fontSize: 10.5,
    fontWeight: '700',
  },
  heroTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
  },
  heroSubtitle: {
    color: '#CBD5E1',
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 2,
  },
  primaryActionsGrid: {
    gap: 8,
  },
  primaryActionBtn: {
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  primaryActionBtnTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  primaryActionBtnSub: {
    color: 'rgba(255, 255, 255, 0.88)',
    fontSize: 11,
    marginTop: 2,
  },
  secondaryActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  secondaryActionBtn: {
    flex: 1,
    minWidth: 130,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionBtnText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '700',
  },
  replaceActionBtn: {
    borderColor: 'rgba(245, 158, 11, 0.45)',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
  },
  replaceActionBtnText: {
    color: '#FCD34D',
    fontSize: 12,
    fontWeight: '700',
  },
  exportActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  aiPromptBtn: {
    flex: 2,
    minWidth: 210,
    backgroundColor: '#312E81',
    borderWidth: 1,
    borderColor: '#6366F1',
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiPromptBtnText: {
    color: '#E0E7FF',
    fontSize: 12,
    fontWeight: '800',
  },
  downloadBtn: {
    flex: 1,
    minWidth: 125,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#475569',
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadBtnText: {
    color: '#93C5FD',
    fontSize: 11.5,
    fontWeight: '700',
  },
  tabBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    backgroundColor: '#0B1120',
    padding: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  tabItem: {
    flex: 1,
    minWidth: 130,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabItemActive: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  tabItemText: {
    color: '#94A3B8',
    fontSize: 11.5,
    fontWeight: '700',
  },
  tabItemTextActive: {
    color: '#F8FAFC',
  },
  guideContainer: {
    gap: 12,
  },
  infoBlock: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 13,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 6,
  },
  infoBlockTitle: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 2,
  },
  bulletText: {
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 18,
  },
  stepParagraph: {
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 18,
  },
  sampleRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(51, 65, 85, 0.5)',
  },
  sampleRowDate: {
    color: '#94A3B8',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    width: 78,
  },
  sampleRowType: {
    fontSize: 10,
    fontWeight: '800',
    width: 76,
  },
  sampleRowDesc: {
    flex: 1,
    color: '#E2E8F0',
    fontSize: 11.5,
  },
  sampleRowVal: {
    color: '#F8FAFC',
    fontSize: 11.5,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  codePreviewBox: {
    backgroundColor: '#090D16',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 8,
  },
  codePreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  codePreviewTitle: {
    color: '#F8FAFC',
    fontSize: 12.5,
    fontWeight: '800',
  },
  copyCodeSmallBtn: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  copyCodeSmallBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
  },
  codeHelperCaption: {
    color: '#94A3B8',
    fontSize: 11.5,
  },
  codeHorizontalScroll: {
    maxHeight: 300,
    backgroundColor: '#020617',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  monospaceCode: {
    color: '#A7F3D0',
    fontSize: 11,
    lineHeight: 16,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
