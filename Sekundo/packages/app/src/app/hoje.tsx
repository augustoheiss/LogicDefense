import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
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
} from '@sekundo/core';
import { loadAppManifestYaml, saveAppManifestYaml } from '../storage/localStorage';
import { deliverFile } from '../utils/deliverFile';
import { HojeWidgetsGrid } from '../components/hoje/HojeWidgetsGrid';

export default function HojeCockpitScreen() {
  const router = useRouter();
  const [manifestYaml, setManifestYaml] = useState<string>(DEFAULT_SEKUNDO_APP_YAML);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [confirmedRitualId, setConfirmedRitualId] = useState<string | null>(null);

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
      setStatusMsg(`Saída gerada com sucesso: ${fileName}`);
    } catch (err: any) {
      setStatusMsg(`Erro ao gerar saída: ${err?.message ?? err}`);
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

  const showWidget = (id: string) => manifest.hoje.mostrar.includes(id as any);

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            testID="hoje-back-btn"
            style={styles.backBtn}
            onPress={() => (router.canGoBack() ? router.back() : router.push('/'))}
          >
            <Text style={styles.backBtnText}>← Painel</Text>
          </TouchableOpacity>
          <View>
            <Text style={styles.title} testID="hoje-app-title">
              ☀️ Hoje — {manifest.app}
            </Text>
            <Text style={styles.subtitle}>
              Cockpit Logístico Pessoal & Compositor Declarativo (sekundo.app.yaml)
            </Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            testID="hoje-quick-any-pdf-btn"
            style={styles.anyPdfBtn}
            onPress={() => router.push('/pdf-forms' as any)}
          >
            <Text style={styles.studioBtnText}>📄 Preencher PDF Avulso</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="hoje-open-studio-btn"
            style={styles.studioBtn}
            onPress={() => router.push('/studio' as any)}
          >
            <Text style={styles.studioBtnText}>🖋️ Abrir Estúdio YAML ⇄ PDF</Text>
          </TouchableOpacity>
        </View>
      </View>

      {(statusMsg || parseErr) && (
        <View style={styles.banner} testID="hoje-status-banner">
          <Text style={styles.bannerText}>{parseErr ? `⚠️ ${parseErr}` : statusMsg}</Text>
        </View>
      )}

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <HojeWidgetsGrid
          summary={summary}
          showWidget={showWidget}
          onRunOutput={handleRunOutput}
          onOpenStudioPreset={(preset) =>
            router.push({ pathname: '/studio', params: { preset } } as any)
          }
        />

        {/* Rituais com Governança Humana (confirmar: true) */}
        <View style={styles.sectionCard} testID="hoje-rituais-section">
          <Text style={styles.cardTitle}>
            🛡️ Rituais Declarativos (Governança Human-in-the-Loop)
          </Text>
          <Text style={styles.sectionDesc}>
            Todo ritual exige confirmação explícita (`confirmar: true`) antes de disparar qualquer saída.
          </Text>
          <View style={styles.rituaisRow}>
            {manifest.rituais.map((r, i) => {
              const rId = r.id || `ritual_${i}`;
              const isArmed = confirmedRitualId === rId;
              return (
                <View key={rId} style={styles.ritualCard}>
                  <Text style={styles.ritualWhen}>⏰ Quando: {r.quando}</Text>
                  <Text style={styles.ritualWhat}>⚡ Fazer: {r.fazer}</Text>
                  <Text style={styles.ritualGuard}>
                    {r.confirmar ? '🔒 confirmar: true (Ativo)' : '🔓 Direto'}
                  </Text>
                  <TouchableOpacity
                    testID={`ritual-exec-btn-${i}`}
                    style={[styles.ritualBtn, isArmed && styles.ritualBtnArmed]}
                    onPress={() => handleExecuteRitual(r.fazer, rId)}
                  >
                    <Text style={styles.ritualBtnText}>
                      {isArmed ? '✅ Confirmar Execução Agora' : '▶ Executar Ritual'}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </View>

        {/* Live Composer Editor (sekundo.app.yaml) */}
        <View style={styles.sectionCard}>
          <View style={styles.composerHeader}>
            <Text style={styles.cardTitle}>
              🧩 Compositor de Aplicativo (`sekundo.app.yaml`)
            </Text>
            <TouchableOpacity
              style={styles.resetBtn}
              onPress={() => handleYamlChange(DEFAULT_SEKUNDO_APP_YAML)}
            >
              <Text style={styles.resetBtnText}>↺ Restaurar Padrão</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.sectionDesc}>
            Edite o manifesto abaixo para montar suas pranchetas, saídas e widgets do Cockpit Hoje em tempo real:
          </Text>
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0B1120' },
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    gap: 10,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  backBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  backBtnText: { color: '#94A3B8', fontSize: 12, fontWeight: '600' },
  title: { color: '#F8FAFC', fontSize: 18, fontWeight: '800' },
  subtitle: { color: '#94A3B8', fontSize: 11 },
  anyPdfBtn: {
    backgroundColor: '#0F766E',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  studioBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  studioBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  banner: {
    backgroundColor: '#1E3A8A',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  bannerText: { color: '#DBEAFE', fontSize: 12, fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 16 },
  cardTitle: { color: '#F8FAFC', fontSize: 14, fontWeight: '700', marginBottom: 10 },
  sectionCard: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  sectionDesc: { color: '#94A3B8', fontSize: 11, marginBottom: 10 },
  rituaisRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  ritualCard: {
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 12,
    minWidth: 240,
    borderWidth: 1,
    borderColor: '#334155',
  },
  ritualWhen: { color: '#93C5FD', fontSize: 12, fontWeight: '700', marginBottom: 2 },
  ritualWhat: { color: '#F8FAFC', fontSize: 12, fontFamily: 'monospace', marginBottom: 4 },
  ritualGuard: { color: '#34D399', fontSize: 10, marginBottom: 8 },
  ritualBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  ritualBtnArmed: { backgroundColor: '#D97706' },
  ritualBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  composerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resetBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 5,
  },
  resetBtnText: { color: '#CBD5E1', fontSize: 11 },
  yamlEditor: {
    backgroundColor: '#090D16',
    color: '#E2E8F0',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    minHeight: 220,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    textAlignVertical: 'top',
  },
});
