/**
 * Page: create-event
 *
 * Visual builder card to configure name, frequency and rules
 * for a new Local-First Event template container.
 */

import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, Pressable, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useLocalEvent } from '../hooks/useLocalEvent';
import type { Frequency } from '@sekundo/core';

export default function CreateEvent() {
  const router = useRouter();
  const { addEvent } = useLocalEvent();

  const [name, setName] = useState('');
  const [frequency, setFrequency] = useState<Frequency>('weekly');

  const handleCreate = async () => {
    if (!name.trim()) return;
    await addEvent(name, frequency, ['01']); // Add '01' as default root path key
    router.replace('/');
  };

  const frequencies: { key: Frequency; label: string; desc: string }[] = [
    { key: 'weekly', label: 'Weekly', desc: 'Schedules that repeat every 7 days' },
    { key: 'monthly', label: 'Monthly', desc: 'Schedules that repeat on a monthly cycle' },
    { key: 'annual', label: 'Annual', desc: 'Complex year-long schedules' },
    { key: 'once', label: 'One-Time', desc: 'Single fixed-date event' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.wrapper}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </Pressable>
          <Text style={styles.title}>New Event Container</Text>
          <Text style={styles.subtitle}>Setup the temporal settings for your template</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Text style={styles.label}>EVENT NAME</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Weekly Congregation Meeting"
            placeholderTextColor="#4F5E74"
            value={name}
            onChangeText={setName}
            autoFocus
          />

          <Text style={[styles.label, { marginTop: 24 }]}>FREQUENCY STYLE</Text>
          {frequencies.map((freq) => (
            <Pressable
              key={freq.key}
              onPress={() => setFrequency(freq.key)}
              style={[styles.freqCard, frequency === freq.key && styles.freqCardActive]}
            >
              <View style={styles.radioRow}>
                <View style={[styles.radio, frequency === freq.key && styles.radioActive]} />
                <View>
                  <Text style={styles.freqLabel}>{freq.label}</Text>
                  <Text style={styles.freqDesc}>{freq.desc}</Text>
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
            <Text style={styles.submitText}>Initialize Event</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#12151C',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  wrapper: {
    width: '100%',
    maxWidth: 500,
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
  },
  form: {
    width: '100%',
  },
  label: {
    color: '#8A94A6',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    color: '#FFFFFF',
    padding: 14,
    fontSize: 16,
  },
  freqCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: 14,
    marginBottom: 12,
  },
  freqCardActive: {
    borderColor: '#FFB800',
    backgroundColor: 'rgba(255, 184, 0, 0.03)',
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radio: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#4F5E74',
    marginRight: 12,
  },
  radioActive: {
    borderColor: '#FFB800',
    backgroundColor: '#FFB800',
  },
  freqLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  freqDesc: {
    color: '#6F7E94',
    fontSize: 12,
    marginTop: 2,
  },
  submitButton: {
    backgroundColor: '#FFB800',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
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
