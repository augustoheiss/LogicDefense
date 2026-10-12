/**
 * Page: create-event
 *
 * Visual builder card to configure name, frequency and rules
 * for a new Local-First Event template container.
 */

import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, Pressable, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useLocalEvent } from '../hooks/useLocalEvent';
import { engineRegistry, type Frequency, type EngineId } from '@sekundo/core';

export default function CreateEvent() {
  const router = useRouter();
  const { addEvent } = useLocalEvent();

  const [name, setName] = useState('');
  const [frequency, setFrequency] = useState<Frequency>('weekly');
  const [selectedEngine, setSelectedEngine] = useState<EngineId>('territory_logistics');

  const availableEngines = engineRegistry.list();

  const handleCreate = async () => {
    if (!name.trim()) return;
    await addEvent(name, frequency, ['01'], selectedEngine); // Add '01' as default root path key
    router.replace('/');
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
              Escolha a Lei Universal (Engine) e a cadência temporal do seu esqueleto.
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

            {/* Universal Engine Selector */}
            <Text style={[styles.label, { marginTop: 24 }]}>LEI UNIVERSAL (ENGINE ATIVA)</Text>
            <Text style={styles.helperText}>
              Define as regras, cálculos de métricas e visualizações deste evento.
            </Text>
            {availableEngines.map((engine) => (
              <Pressable
                key={engine.id}
                onPress={() => setSelectedEngine(engine.id)}
                style={[
                  styles.cardOption,
                  selectedEngine === engine.id && styles.cardOptionActive,
                ]}
              >
                <View style={styles.radioRow}>
                  <View
                    style={[
                      styles.radio,
                      selectedEngine === engine.id && styles.radioActive,
                    ]}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optionLabel}>{engine.name}</Text>
                    <Text style={styles.optionDesc}>{engine.description}</Text>
                  </View>
                </View>
              </Pressable>
            ))}

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

            {/* Submit */}
            <Pressable
              onPress={handleCreate}
              disabled={!name.trim()}
              style={({ pressed }) => [
                styles.submitButton,
                !name.trim() && styles.submitDisabled,
                pressed && styles.submitPressed,
              ]}
            >
              <Text style={styles.submitText}>Criar Evento com Esta Engine</Text>
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
    maxWidth: 540,
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
  helperText: {
    color: '#6F7E94',
    fontSize: 12,
    marginBottom: 10,
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
});
