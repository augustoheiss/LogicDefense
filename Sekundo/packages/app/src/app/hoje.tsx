/**
 * Page: hoje
 *
 * Sekundo — AutoCAD-Style Cockpit Hoje & Compositor (`100dvh`, Zero Roll-Down).
 *
 * Features:
 * - Zero Vertical Roll-Down (`100dvh`, `overflow: hidden`) and zero horizontal overflow on Mobile (`390×844`).
 * - Compact AutoCAD Selector Buttons for:
 *   [01 📅 Compromissos do Dia] [02 💬 Mensagens WhatsApp] [03 📄 Documentos & PDF]
 *   [04 🗺️ Territórios Vencendo] [05 🛡️ Rituais Governados] [06 🧩 Compositor sekundo.app.yaml]
 * - Direct Import & Export of the Unified Master CSV (`CSV Geral`).
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  DEFAULT_SEKUNDO_APP_YAML,
  parseAppManifestYaml,
  computeHojeCockpitSummary,
  buildProgramacaoReuniaoRegistry,
  buildTerritoriosS13HistoricalRegistry,
  writeUnifiedOutput,
  exportOmniCsvBundle,
  importOmniCsvBundle,
} from '@sekundo/core';
import { loadAppManifestYaml, saveAppManifestYaml } from '../storage/localStorage';
import { deliverFile } from '../utils/deliverFile';
import { useLocalEvent } from '../hooks/useLocalEvent';
import { MultiEngineSwitcherBar } from '../components/ui/MultiEngineSwitcherBar';
import {
  exportFullSiteOmniCsvFromStorage,
  commitOmniCsvBundleToStorage,
} from '../storage/omniStorageBridge';

type HojeCadToolId =
  | 'compromissos'
  | 'mensagens'
  | 'documentos'
  | 'territorios'
  | 'rituais'
  | 'compositor';

export default function HojeCockpitScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 860;
  const { events, addEvent } = useLocalEvent();

  const [manifestYaml, setManifestYaml] = useState<string>(DEFAULT_SEKUNDO_APP_YAML);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [confirmedRitualId, setConfirmedRitualId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<HojeCadToolId>('compromissos');

  useEffect(() => {
    loadAppManifestYaml().then((saved) => {
      if (saved && saved.trim().length > 0) {
        setManifestYaml(saved);
      }
    });
  }, []);

  const handleYamlChange = (next: string) => {
    setManifestYaml(next);
    saveAppManifestYaml(next).catch(() => {});
  };

  const combinedRegistry = useMemo(() => {
    const reuniao = buildProgramacaoReuniaoRegistry();
    const territorios = buildTerritoriosS13HistoricalRegistry();
    return [...reuniao, ...territorios];
  }, []);

  const { manifest, parseErr } = useMemo(() => {
    try {
      return { manifest: parseAppManifestYaml(manifestYaml), parseErr: null };
    } catch (err: any) {
      return {
        manifest: parseAppManifestYaml(DEFAULT_SEKUNDO_APP_YAML),
        parseErr: err?.message ?? 'Erro no YAML do Compositor',
      };
    }
  }, [manifestYaml]);

  const summary = useMemo(
    () => computeHojeCockpitSummary(manifest, combinedRegistry),
    [manifest, combinedRegistry]
  );

  const handleRunOutput = async (
    kind: 'pdf' | 'whatsapp' | 'csv' | 'yaml',
    template?: string
  ) => {
    try {
      const isTerritorios =
        template?.toLowerCase().includes('territorio') ||
        template?.toLowerCase().includes('s13');
      const targetReg = isTerritorios
        ? buildTerritoriosS13HistoricalRegistry()
        : buildProgramacaoReuniaoRegistry();

      const out = await writeUnifiedOutput(kind, {
        registry: targetReg,
        eventName: manifest.app,
        options: { template },
      });

      const ext =
        kind === 'pdf'
          ? 'pdf'
          : kind === 'whatsapp'
          ? 'whatsapp.txt'
          : kind === 'yaml'
          ? 'data.yaml'
          : 'csv';
      const mime =
        kind === 'pdf'
          ? 'application/pdf'
          : kind === 'yaml'
          ? 'text/yaml;charset=utf-8'
          : 'text/plain;charset=utf-8';
      const fileName = `${(template || manifest.app).trim()}.${ext}`;
      await deliverFile(out, fileName, mime);
      setStatusMsg(`✅ Saída gerada: ${fileName}`);
    } catch (err: any) {
      setStatusMsg(`❌ Erro: ${err?.message ?? err}`);
    }
  };

  const handleExecuteRitual = async (fazer: string, ritualId: string) => {
    if (confirmedRitualId !== ritualId) {
      setConfirmedRitualId(ritualId);
      setStatusMsg(
        `🛡️ Governança Humana: Clique novamente em "${fazer}" para confirmar a execução.`
      );
      return;
    }
    setConfirmedRitualId(null);
    const [kindRaw, tplRaw] = fazer.split(':');
    const kind = (
      ['pdf', 'whatsapp', 'csv', 'yaml'].includes(kindRaw) ? kindRaw : 'whatsapp'
    ) as 'pdf' | 'whatsapp' | 'csv' | 'yaml';
    await handleRunOutput(kind, tplRaw);
  };

  const handleExportOmniCsv = async () => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      await saveAppManifestYaml(manifestYaml);
      const csv = await exportFullSiteOmniCsvFromStorage(events);
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sekundo_omni_geral_salvo_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setStatusMsg('🌐 CSV Geral salvo no site exportado!');
    }
  };

  const handleExportSampleOmniCsv = () => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const csv = exportOmniCsvBundle({ hojeManifestYaml: manifestYaml });
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'sekundo_omni_exemplo.csv';
      a.click();
      URL.revokeObjectURL(url);
      setStatusMsg('🧪 CSV Geral de Exemplo baixado!');
    }
  };

  const handleImportOmniCsv = () => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.csv';
      input.onchange = async (e: any) => {
        const file = e.target?.files?.[0];
        if (!file) return;
        const text = await file.text();
        const bundle = importOmniCsvBundle(text);
        if (bundle.hojeManifestYaml) {
          handleYamlChange(bundle.hojeManifestYaml);
        }
        await commitOmniCsvBundleToStorage(bundle, {
          rawCsvText: text,
          existingEvents: events,
          addEvent,
        });
        setStatusMsg(`✅ CSV Geral "${file.name}" importado em todas as Engines!`);
      };
      input.click();
    }
  };

  const cadTools: Array<{
    id: HojeCadToolId;
    code: string;
    label: string;
    count: string;
    color: string;
  }> = [
    {
      id: 'compromissos',
      code: '01',
      label: '📅 Dia',
      count: `${summary.compromissosDoDia.length}`,
      color: '#2563EB',
    },
    {
      id: 'mensagens',
      code: '02',
      label: '💬 WhatsApp',
      count: `${summary.mensagensAEnviar.length}`,
      color: '#10B981',
    },
    {
      id: 'documentos',
      code: '03',
      label: '📄 PDF',
      count: `${summary.documentosAImprimir.length}`,
      color: '#D97706',
    },
    {
      id: 'territorios',
      code: '04',
      label: '🗺️ Setores',
      count: `${summary.territoriosVencendo.length}`,
      color: '#0D9488',
    },
    {
      id: 'rituais',
      code: '05',
      label: '🛡️ Rituais',
      count: `${manifest.rituais.length}`,
      color: '#7C3AED',
    },
    {
      id: 'compositor',
      code: '06',
      label: '🧩 YAML',
      count: 'app.yaml',
      color: '#BE123C',
    },
  ];

  return (
    <SafeAreaView style={styles.cadViewport}>
      {/* Top AutoCAD Icon-Only Ribbon (Zero Horizontal Overflow on 390px Mobile!) */}
      <View style={styles.topRibbon}>
        <MultiEngineSwitcherBar activeEngine="hoje" />

        <View style={styles.headerActions}>
          <TouchableOpacity
            testID="hoje-export-omni-btn"
            style={[styles.cadBtn, styles.cadBtnPurple]}
            onPress={handleExportOmniCsv}
            accessibilityLabel="Baixar CSV Geral"
            {...({ title: 'Baixar CSV Geral (Estado Salvo no Site)' } as any)}
          >
            <Text style={styles.cadBtnText}>🌐</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="hoje-sample-omni-btn"
            style={styles.cadBtn}
            onPress={handleExportSampleOmniCsv}
            accessibilityLabel="Baixar CSV Geral de Exemplo"
            {...({ title: 'Baixar CSV Geral de Exemplo' } as any)}
          >
            <Text style={styles.cadBtnText}>🧪</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="hoje-import-omni-btn"
            style={[styles.cadBtn, styles.cadBtnBlue]}
            onPress={handleImportOmniCsv}
            accessibilityLabel="Importar CSV Geral"
            {...({ title: 'Importar CSV Geral' } as any)}
          >
            <Text style={styles.cadBtnText}>📥</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="hoje-quick-any-pdf-btn"
            style={styles.cadBtn}
            onPress={() => router.push('/pdf-forms' as any)}
            accessibilityLabel="Central de Formulários PDF"
            {...({ title: 'Central de Formulários PDF' } as any)}
          >
            <Text style={styles.cadBtnText}>📄</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="hoje-open-studio-btn"
            style={[styles.cadBtn, styles.cadBtnEmerald]}
            onPress={() => router.push('/studio' as any)}
            accessibilityLabel="Estúdio YAML PDF"
            {...({ title: 'Estúdio YAML ⇄ PDF' } as any)}
          >
            <Text style={styles.cadBtnText}>🖋️</Text>
          </TouchableOpacity>
        </View>
      </View>

      {(statusMsg || parseErr) && (
        <View style={styles.banner} testID="hoje-status-banner">
          <Text style={styles.bannerText} numberOfLines={1}>
            {parseErr ? `⚠️ ${parseErr}` : statusMsg}
          </Text>
        </View>
      )}

      {/* Main Split Workspace (Zero Vertical Roll-Down!) */}
      <View
        style={[
          styles.workspaceSplit,
          { flexDirection: isDesktop ? 'row' : 'column' },
        ]}
      >
        {/* Left: Compact Matrix of 6 CAD Buttons */}
        <View style={[styles.matrixPanel, { flex: isDesktop ? 1 : undefined }]}>
          <View style={styles.toolsGrid}>
            {cadTools.map((tool) => {
              const active = activeTool === tool.id;
              return (
                <TouchableOpacity
                  key={tool.id}
                  onPress={() => setActiveTool(tool.id)}
                  style={[
                    styles.toolButton,
                    { borderLeftColor: tool.color },
                    active && styles.toolButtonActive,
                  ]}
                >
                  <View style={styles.toolHeaderRow}>
                    <Text style={styles.toolCode}>[{tool.code}]</Text>
                    <Text style={styles.toolCount}>{tool.count}</Text>
                  </View>
                  <Text style={styles.toolLabel} numberOfLines={1}>
                    {tool.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Right: On-Demand Technical Inspector */}
        <View style={[styles.inspectorPanel, { flex: isDesktop ? 1.35 : 1 }]}>
          {activeTool === 'compromissos' && (
            <View style={{ gap: 6 }}>
              <Text style={styles.inspectorTitle}>
                📅 COMPROMISSOS DO DIA ({summary.compromissosDoDia.length})
              </Text>
              <View style={styles.compactItemsGrid}>
                {summary.compromissosDoDia.slice(0, 6).map((item) => (
                  <View key={item.key} style={styles.compactItemCard}>
                    <Text style={styles.compactItemWho} numberOfLines={1}>
                      👤 {item.assignee}
                    </Text>
                    <Text style={styles.compactItemSub} numberOfLines={1}>
                      [{item.key}] {item.partTitle}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {activeTool === 'mensagens' && (
            <View style={{ gap: 6 }}>
              <Text style={styles.inspectorTitle}>
                💬 MENSAGENS A ENVIAR ({summary.mensagensAEnviar.length})
              </Text>
              <View style={styles.compactItemsGrid}>
                {summary.mensagensAEnviar.slice(0, 6).map((msg, idx) => (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => handleRunOutput('whatsapp', 'quadro_semanal')}
                    style={styles.compactItemCard}
                  >
                    <Text style={styles.compactItemWho} numberOfLines={1}>
                      📲 {msg.recipient}
                    </Text>
                    <Text style={styles.compactItemSub} numberOfLines={1}>
                      {msg.summary}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {activeTool === 'documentos' && (
            <View style={{ gap: 6 }}>
              <Text style={styles.inspectorTitle}>
                📄 SAÍDAS & IMPRESSÃO PDF COMPLETA ({summary.documentosAImprimir.length})
              </Text>
              <View style={styles.compactItemsGrid}>
                {summary.documentosAImprimir.map((doc, idx) => (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => handleRunOutput(doc.kind, doc.template)}
                    style={styles.compactItemCard}
                  >
                    <Text style={styles.compactItemWho} numberOfLines={1}>
                      🖨️ {doc.kind.toUpperCase()}: {doc.template || doc.pranchetaNome}
                    </Text>
                    <Text style={styles.compactItemSub} numberOfLines={1}>
                      Clique para gerar/baixar folha completa
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {activeTool === 'territorios' && (
            <View style={{ gap: 6 }}>
              <Text style={styles.inspectorTitle}>
                🗺️ TERRITÓRIOS VENCENDO ({summary.territoriosVencendo.length})
              </Text>
              <View style={styles.compactItemsGrid}>
                {summary.territoriosVencendo.slice(0, 6).map((t) => (
                  <View key={t.territoryNumber} style={styles.compactItemCard}>
                    <Text style={styles.compactItemWho} numberOfLines={1}>
                      Setor {t.territoryNumber} — {t.label}
                    </Text>
                    <Text style={styles.compactItemSub}>
                      {t.daysSinceCompleted} dias desde conclusão ({t.percent}%)
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {activeTool === 'rituais' && (
            <View style={{ gap: 6 }} testID="hoje-rituais-section">
              <Text style={styles.inspectorTitle}>
                🛡️ RITUAIS GOVERNADOS (Human-in-the-Loop)
              </Text>
              <View style={styles.compactItemsGrid}>
                {manifest.rituais.map((r, i) => {
                  const rId = r.id || `ritual_${i}`;
                  const isArmed = confirmedRitualId === rId;
                  return (
                    <View key={rId} style={styles.compactItemCard}>
                      <Text style={styles.compactItemWho}>⏰ {r.quando}</Text>
                      <Text style={styles.compactItemSub}>⚡ {r.fazer}</Text>
                      <TouchableOpacity
                        testID={`ritual-exec-btn-${i}`}
                        style={[
                          styles.cadBtn,
                          isArmed ? styles.cadBtnEmerald : styles.cadBtnBlue,
                          { marginTop: 4 },
                        ]}
                        onPress={() => handleExecuteRitual(r.fazer, rId)}
                      >
                        <Text style={styles.cadBtnText}>
                          {isArmed ? '✅ Confirmar Agora' : '▶ Executar Ritual'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {activeTool === 'compositor' && (
            <View style={{ flex: 1, gap: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={styles.inspectorTitle}>
                  🧩 COMPOSITOR DECLARATIVO (sekundo.app.yaml)
                </Text>
                <TouchableOpacity
                  style={styles.cadBtn}
                  onPress={() => handleYamlChange(DEFAULT_SEKUNDO_APP_YAML)}
                >
                  <Text style={styles.cadBtnText}>↺ Restaurar</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                testID="hoje-manifest-editor"
                style={styles.yamlEditor}
                multiline
                value={manifestYaml}
                onChangeText={handleYamlChange}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  cadViewport: {
    flex: 1,
    height: Platform.OS === 'web' ? ('100dvh' as any) : '100%',
    maxHeight: Platform.OS === 'web' ? ('100dvh' as any) : '100%',
    backgroundColor: '#060A12',
    overflow: 'hidden',
  },
  topRibbon: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    gap: 6,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  title: {
    fontSize: 12,
    fontWeight: '900',
    color: '#F8FAFC',
    flexShrink: 1,
  },
  headerActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  cadBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 5,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  cadBtnBlue: {
    backgroundColor: '#1D4ED8',
    borderColor: '#60A5FA',
  },
  cadBtnPurple: {
    backgroundColor: '#6D28D9',
    borderColor: '#A78BFA',
  },
  cadBtnEmerald: {
    backgroundColor: '#059669',
    borderColor: '#34D399',
  },
  cadBtnText: {
    color: '#F8FAFC',
    fontSize: 10.5,
    fontWeight: '800',
  },
  banner: {
    backgroundColor: '#1E3A8A',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#3B82F6',
  },
  bannerText: {
    color: '#E0F2FE',
    fontSize: 11,
    fontWeight: '700',
  },
  workspaceSplit: {
    flex: 1,
    padding: 8,
    gap: 8,
    overflow: 'hidden',
  },
  matrixPanel: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 8,
    overflow: 'hidden',
  },
  panelHint: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 6,
  },
  toolsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  toolButton: {
    width: '48.5%',
    minWidth: 140,
    backgroundColor: '#0B1120',
    borderRadius: 6,
    borderWidth: 1,
    borderLeftWidth: 4,
    borderColor: '#1E293B',
    padding: 7,
  },
  toolButtonActive: {
    backgroundColor: '#1E3A8A',
    borderColor: '#60A5FA',
  },
  toolHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  toolCode: {
    color: '#38BDF8',
    fontSize: 9.5,
    fontWeight: '900',
  },
  toolCount: {
    color: '#94A3B8',
    fontSize: 9.5,
    fontWeight: '700',
  },
  toolLabel: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },
  inspectorPanel: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 8,
    overflow: 'hidden',
  },
  inspectorTitle: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '900',
  },
  compactItemsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  compactItemCard: {
    width: '48.5%',
    minWidth: 140,
    backgroundColor: '#0B1120',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 7,
  },
  compactItemWho: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '800',
  },
  compactItemSub: {
    color: '#94A3B8',
    fontSize: 10,
    marginTop: 2,
  },
  yamlEditor: {
    flex: 1,
    backgroundColor: '#020617',
    color: '#A7F3D0',
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
    fontSize: 11,
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
    textAlignVertical: 'top',
  },
});
