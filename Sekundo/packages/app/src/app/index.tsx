/**
 * Landing Dashboard — Sekundo
 *
 * Provides a stunning, premium dark-mode interface for managing local events,
 * configuring skeletons, importing CSV files, and sharing links.
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Dashboard() {
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 768;

  // Placeholder state for events list
  const [events] = useState([
    { id: '1', name: 'Weekly Congregation Meeting', frequency: 'weekly', lastRollover: '2026-07-14' },
    { id: '2', name: 'Territory Quadra Distribution', frequency: 'monthly', lastRollover: '2026-07-01' },
  ]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header Section */}
        <View style={styles.header}>
          <Text style={styles.logo}>Sekundo</Text>
          <Text style={styles.tagline}>
            Agnostic skeleton engine for temporal event automation.
          </Text>
        </View>

        {/* Manifesto Card */}
        <View style={styles.manifestoCard}>
          <Text style={styles.manifestoTitle}>Background Melody</Text>
          <Text style={styles.manifestoText}>
            This structure is designed to run silently in the background, serving as a clean framework.
            Write the melody that empowers your day, free from rigid discipline or administrative tracking.
          </Text>
        </View>

        {/* Grid/Layout depending on screen size */}
        <View style={[styles.mainLayout, isLargeScreen && styles.rowLayout]}>
          {/* Quick Actions Column */}
          <View style={[styles.column, isLargeScreen && styles.leftColumn]}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            
            <Pressable style={({ pressed }) => [styles.actionButton, pressed && styles.buttonPressed]}>
              <Text style={styles.actionButtonText}>Create New Event</Text>
              <Text style={styles.actionButtonSub}>Setup a custom skeleton hierarchy</Text>
            </Pressable>

            <Pressable style={({ pressed }) => [styles.actionButton, pressed && styles.buttonPressed]}>
              <Text style={styles.actionButtonText}>Import CSV Template</Text>
              <Text style={styles.actionButtonSub}>Excel or Google Sheets source format</Text>
            </Pressable>

            <Pressable style={({ pressed }) => [styles.actionButton, pressed && styles.buttonPressed]}>
              <Text style={styles.actionButtonText}>Fill PDF Form</Text>
              <Text style={styles.actionButtonSub}>Inject data into coordinate mapping templates</Text>
            </Pressable>
          </View>

          {/* Active Events Column */}
          <View style={[styles.column, isLargeScreen && styles.rightColumn]}>
            <Text style={styles.sectionTitle}>Your Active Skeletons</Text>
            {events.map((event) => (
              <View key={event.id} style={styles.eventCard}>
                <View style={styles.eventInfo}>
                  <Text style={styles.eventName}>{event.name}</Text>
                  <Text style={styles.eventFrequency}>
                    Recurrence: {event.frequency.toUpperCase()} • Last Rollover: {event.lastRollover}
                  </Text>
                </View>
                <Pressable style={styles.viewButton}>
                  <Text style={styles.viewButtonText}>Open</Text>
                </Pressable>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#12151C', // Immersive dark background
  },
  scrollContent: {
    padding: 24,
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    marginBottom: 32,
    marginTop: Platform.OS === 'web' ? 24 : 0,
  },
  logo: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 16,
    color: '#8A94A6',
    marginTop: 8,
    fontWeight: '400',
  },
  manifestoCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 32,
  },
  manifestoTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFB800', // Gold accent
    marginBottom: 8,
  },
  manifestoText: {
    fontSize: 14,
    color: '#A9B4C5',
    lineHeight: 22,
  },
  mainLayout: {
    flexDirection: 'column',
  },
  rowLayout: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  column: {
    flex: 1,
    marginBottom: 32,
  },
  leftColumn: {
    marginRight: 16,
  },
  rightColumn: {
    marginLeft: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  actionButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  buttonPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    transform: [{ scale: 0.99 }],
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  actionButtonSub: {
    fontSize: 12,
    color: '#6F7E94',
    marginTop: 4,
  },
  eventCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  eventInfo: {
    flex: 1,
    marginRight: 16,
  },
  eventName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  eventFrequency: {
    fontSize: 12,
    color: '#8A94A6',
    marginTop: 4,
  },
  viewButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  viewButtonText: {
    color: '#12151C',
    fontWeight: '600',
    fontSize: 14,
  },
});
