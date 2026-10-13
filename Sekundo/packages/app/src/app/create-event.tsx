/**
 * Page: create-event
 *
 * Visual builder card to configure name, frequency, and rules
 * for a new Local-First Event template container.
 * Supports Multi-Engine selection and Auto-Detection via CSV!
 */

import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, Pressable, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useLocalEvent } from '../hooks/useLocalEvent';
import { engineRegistry, detectEnginesFromCSV, parseCSV, type Frequency, type EngineId } from '@sekundo/core';
import * as storage from '../storage/localStorage';

export default function CreateEvent() {
  const router = useRouter();
  const { addEvent } = useLocalEvent();

  const [name, setName] = useState('');
  const [frequency, setFrequency] = useState<Frequency>('weekly');
  const [selectedEngines, setSelectedEngines] = useState<EngineId[]>(['territory_logistics']);
  const [autoDetectNotice, setAutoDetectNotice] = useState<string | null>(null);
  const [uploadedCsvText, setUploadedCsvText] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const availableEngines = engineRegistry.list();

  const toggleEngine = (id: EngineId) => {
    if (selectedEngines.includes(id)) {
      if (selectedEngines.length > 1) {
        setSelectedEngines(selectedEngines.filter((e) => e !== id));
      }
    } else {
      setSelectedEngines([...selectedEngines, id]);
    }
  };

  const handleCreate = async () => {
    const trimmed = name.trim();
    let finalName = trimmed;

    if (!finalName) {
      if (uploadedFileName) {
        finalName = uploadedFileName.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
        finalName = finalName.charAt(0).toUpperCase() + finalName.slice(1);
      } else {
        setValidationError('⚠️ Por favor, informe um nome para o evento no campo acima para continuar.');
        return;
      }
    }

    setValidationError(null);
    const state = await addEvent(finalName, frequency, ['01'], selectedEngines);

    // If CSV was provided during creation, commit it immediately!
    if (uploadedCsvText) {
      try {
        const parsed = parseCSV(uploadedCsvText);
        await storage.saveSkeleton(state.config.id, parsed);

        const hasCoords = parsed.some((r: any) => {
          try {
            const meta = r._meta_json ? JSON.parse(r._meta_json) : {};
            return (meta.lat && meta.lng) || (r.lat && r.lng);
          } catch {
            return false;
          }
        });

        if (hasCoords) {
          router.replace(`/territory-map?id=${state.config.id}`);
          return;
        }
      } catch (err) {
        console.warn('[Sekundo] Erro ao salvar CSV na criação:', err);
      }
    }

    router.replace(`/skeleton-editor?id=${state.config.id}`);
  };

  const handleCsvAutoDetect = (e: any) => {
    const file = e.target?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setUploadedCsvText(text);
      setUploadedFileName(file.name);
      const report = detectEnginesFromCSV(text);
      if (report.suggestedEngines.length > 0) {
        setSelectedEngines(report.suggestedEngines);
      }

      // Auto-suggest event name from file name or first root row
      if (!name.trim()) {
        try {
          const parsed = parseCSV(text);
          const rootItem = parsed.find((r: any) => r._type === 'root' || r._type === 'header');
          if (rootItem && rootItem.label) {
            setName(rootItem.label);
          } else {
            const cleanFileName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
            setName(cleanFileName.charAt(0).toUpperCase() + cleanFileName.slice(1));
          }
        } catch {
          const cleanFileName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
          setName(cleanFileName.charAt(0).toUpperCase() + cleanFileName.slice(1));
        }
      }
      setAutoDetectNotice(`✅ Arquivo "${file.name}" carregado! ${report.summary}`);
      setValidationError(null);
    };
    reader.readAsText(file);
  };

  const frequencies: { key: Frequency; label: string; desc: string }[] = [
    { key: 'weekly', label: 'Semanal', desc: 'Ciclos que se repetem a cada 7 dias' },
    { key: 'monthly', label: 'Mensal', desc: 'Ciclos mensais de acompanhamento e rollover' },
    { key: 'annual', label: 'Anual', desc: 'Eventos ou campanhas de longa duração' },
    { key: 'once', label: 'Único / Fixo', desc: 'Evento pontual em data determinada' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.wrapper}>
          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <Text style={styles.backButtonText}>← Voltar ao Início</Text>
            </Pressable>
            <Text style={styles.title}>Novo Evento ou Projeto</Text>
            <Text style={styles.subtitle}>
              Escolha uma ou mais Leis Universais (Engines) e a cadência temporal do seu esqueleto.
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <Text style={styles.label}>NOME DO EVENTO / PROJETO</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Territórios Ferraz de Vasconcelos ou Reunião Semanal"
              placeholderTextColor="#4F5E74"
              value={name}
              onChangeText={setName}
              autoFocus
            />

            {/* Universal Engine Selector & Multi-Engine Choice */}
            <View style={{ marginTop: 24, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.label}>LEIS UNIVERSAIS ATIVAS (ENGINES)</Text>
              <View style={styles.multiBadge}>
                <Text style={styles.multiBadgeText}>Múltiplas Escolhas</Text>
              </View>
            </View>
            <Text style={styles.helperText}>
              Você pode selecionar mais de uma Engine para o mesmo evento (ex: Território + Escala).
            </Text>

            {/* Auto Detect via CSV Button (Web) */}
            {Platform.OS === 'web' && (
              <View style={styles.autoDetectBox}>
                <label style={styles.autoDetectLabel as any}>
                  ✨ Auto-Detectar Engines a partir de um CSV
                  <input
                    type="file"
                    accept=".csv"
                    style={{ display: 'none' }}
                    onChange={handleCsvAutoDetect}
                  />
                </label>
                {autoDetectNotice && (
                  <Text style={styles.autoDetectNotice}>{autoDetectNotice}</Text>
                )}
              </View>
            )}

            {availableEngines.map((engine) => {
              const isChecked = selectedEngines.includes(engine.id);
              return (
                <Pressable
                  key={engine.id}
                  onPress={() => toggleEngine(engine.id)}
                  style={[
                    styles.cardOption,
                    isChecked && styles.cardOptionActive,
                  ]}
                >
                  <View style={styles.radioRow}>
                    <View
                      style={[
                        styles.checkbox,
                        isChecked && styles.checkboxActive,
                      ]}
                    >
                      {isChecked && <Text style={styles.checkmarkText}>✓</Text>}
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={styles.optionLabel}>{engine.name}</Text>
                        {isChecked && (
                          <View style={styles.activePill}>
                            <Text style={styles.activePillText}>Ativa</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.optionDesc}>{engine.description}</Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}

            <Text style={[styles.label, { marginTop: 24 }]}>CADÊNCIA TEMPORAL (FREQUÊNCIA)</Text>
            {frequencies.map((freq) => (
              <Pressable
                key={freq.key}
                onPress={() => setFrequency(freq.key)}
                style={[
                  styles.cardOption,
                  frequency === freq.key && styles.cardOptionActive,
                ]}
              >
                <View style={styles.radioRow}>
                  <View
                    style={[
                      styles.radio,
                      frequency === freq.key && styles.radioActive,
                    ]}
                  />
                  <View>
                    <Text style={styles.optionLabel}>{freq.label}</Text>
                    <Text style={styles.optionDesc}>{freq.desc}</Text>
                  </View>
                </View>
              </Pressable>
            ))}

            {/* Validation notice if any */}
            {validationError && (
              <View style={styles.errorBox}>
                <Text style={styles.errorBoxText}>{validationError}</Text>
              </View>
            )}

            {/* Submit */}
            <Pressable
              onPress={handleCreate}
              style={({ pressed }) => [
                styles.submitButton,
                pressed && styles.submitPressed,
              ]}
            >
              <Text style={styles.submitText}>
                {uploadedCsvText
                  ? `✨ Criar Evento & Ingerir CSV (${uploadedFileName || 'Planilha'})`
                  : `Criar Evento (${selectedEngines.length} ${selectedEngines.length === 1 ? 'Engine Ativa' : 'Engines Ativas'})`}
              </Text>
            </Pressable>

            {/* Direct CSV Import Link */}
            <Pressable
              onPress={() => router.push('/csv-import')}
              style={styles.directImportLink}
            >
              <Text style={styles.directImportLinkText}>
                📂 Ou importe diretamente pela Central de Modelos CSV →
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#12151C',
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  wrapper: {
    width: '100%',
    maxWidth: 580,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  header: {
    marginBottom: 24,
  },
  backButton: {
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    color: '#8A94A6',
    fontSize: 14,
    fontWeight: '500',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: '#6F7E94',
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  form: {
    width: '100%',
  },
  label: {
    color: '#8A94A6',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 6,
  },
  multiBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  multiBadgeText: {
    color: '#60A5FA',
    fontSize: 10,
    fontWeight: '600',
  },
  helperText: {
    color: '#6F7E94',
    fontSize: 12,
    marginBottom: 10,
  },
  autoDetectBox: {
    backgroundColor: 'rgba(59, 130, 246, 0.06)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
    padding: 12,
    marginBottom: 14,
  },
  autoDetectLabel: {
    color: '#93C5FD',
    fontSize: 13,
    fontWeight: '600',
    cursor: 'pointer' as any,
  },
  autoDetectNotice: {
    color: '#10B981',
    fontSize: 12,
    marginTop: 6,
    fontWeight: '500',
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    color: '#FFFFFF',
    padding: 14,
    fontSize: 15,
  },
  cardOption: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: 14,
    marginBottom: 10,
  },
  cardOptionActive: {
    borderColor: '#FFB800',
    backgroundColor: 'rgba(255, 184, 0, 0.04)',
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#4F5E74',
    marginRight: 12,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  checkboxActive: {
    borderColor: '#FFB800',
    backgroundColor: '#FFB800',
  },
  checkmarkText: {
    color: '#12151C',
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 16,
  },
  activePill: {
    backgroundColor: 'rgba(255, 184, 0, 0.15)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  activePillText: {
    color: '#FFB800',
    fontSize: 10,
    fontWeight: '700',
  },
  radio: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#4F5E74',
    marginRight: 12,
    marginTop: 2,
  },
  radioActive: {
    borderColor: '#FFB800',
    backgroundColor: '#FFB800',
  },
  optionLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  optionDesc: {
    color: '#8A94A6',
    fontSize: 12,
    marginTop: 3,
    lineHeight: 16,
  },
  submitButton: {
    backgroundColor: '#FFB800',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  submitDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  submitPressed: {
    opacity: 0.9,
  },
  submitText: {
    color: '#12151C',
    fontWeight: '700',
    fontSize: 16,
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: '#EF4444',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    marginBottom: 4,
  },
  errorBoxText: {
    color: '#F87171',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  directImportLink: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginTop: -8,
    marginBottom: 10,
  },
  directImportLinkText: {
    color: '#FFB800',
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
