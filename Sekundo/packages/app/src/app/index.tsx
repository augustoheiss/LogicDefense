/**
 * Landing Dashboard — Sekundo
 *
 * Immersive, premium dark-mode console for temporal event templates.
 * Loads events dynamically from useLocalEvent.
 */

import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useLocalEvent } from '../hooks/useLocalEvent';
import { engineRegistry } from '@sekundo/core';

export default function Dashboard() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 768;

  const { events, loading, deleteEventState } = useLocalEvent();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFB800" />
      </View>
    );
  }

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

            <Pressable
              onPress={() => router.push('/create-event')}
              style={({ pressed }) => [styles.actionButton, pressed && styles.buttonPressed]}
            >
              <Text style={styles.actionButtonText}>Create New Event</Text>
              <Text style={styles.actionButtonSub}>Setup a custom skeleton hierarchy</Text>
            </Pressable>

            <Pressable
              onPress={() => router.push('/csv-import')}
              style={({ pressed }) => [styles.actionButton, pressed && styles.buttonPressed]}
            >
              <Text style={styles.actionButtonText}>Import CSV Template</Text>
              <Text style={styles.actionButtonSub}>Excel or Google Sheets source format</Text>
            </Pressable>
          </View>

          {/* Active Events Column */}
          <View style={[styles.column, isLargeScreen && styles.rightColumn]}>
            <Text style={styles.sectionTitle}>Your Active Skeletons</Text>
            
            {events.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No events configured yet.</Text>
                <Text style={styles.emptySub}>Click "Create New Event" to get started.</Text>
              </View>
            ) : (
              events.map((event) => {
                const engine = engineRegistry.get(event.config.engineId);
                return (
                  <View key={event.config.id} style={styles.eventCard}>
                    <View style={styles.eventInfo}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
                        <Text style={styles.eventName}>{event.config.name}</Text>
                        <View style={styles.engineBadge}>
                          <Text style={styles.engineBadgeText}>{engine.name}</Text>
                        </View>
                      </View>
                      <Text style={styles.eventFrequency}>
                        Recurrence: {event.config.frequency.toUpperCase()} • Roots:{' '}
                        {event.config.skeletonRoots.join(', ') || 'None'}
                      </Text>
                    </View>
                    <View style={styles.cardActions}>
                      {event.config.engineId === 'territory_logistics' && (
                        <>
                          <Pressable
                            onPress={() => router.push(`/territory-checklist?id=${event.config.id}`)}
                            style={[
                              styles.openButton,
                              {
                                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                                borderWidth: 1,
                                borderColor: '#10B981',
                              },
                            ]}
                          >
                            <Text style={[styles.openButtonText, { color: '#10B981' }]}>📋 Campo</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => router.push(`/territory-map?id=${event.config.id}`)}
                            style={[
                              styles.openButton,
                              {
                                backgroundColor: 'rgba(59, 130, 246, 0.15)',
                                borderWidth: 1,
                                borderColor: '#3B82F6',
                              },
                            ]}
                          >
                            <Text style={[styles.openButtonText, { color: '#60A5FA' }]}>🗺️ Mapa</Text>
                          </Pressable>
                        </>
                      )}
                      {event.config.engineId === 'roster_assignments' && (
                        <Pressable
                          onPress={() => router.push(`/roster-swap?id=${event.config.id}`)}
                          style={[
                            styles.openButton,
                            {
                              backgroundColor: 'rgba(16, 185, 129, 0.15)',
                              borderWidth: 1,
                              borderColor: '#10B981',
                            },
                          ]}
                        >
                          <Text style={[styles.openButtonText, { color: '#10B981' }]}>🔄 Trocas</Text>
                        </Pressable>
                      )}
                      {event.config.engineId === 'live_production_ros' && (
                        <Pressable
                          onPress={() => router.push(`/run-of-show?id=${event.config.id}`)}
                          style={[
                            styles.openButton,
                            {
                              backgroundColor: 'rgba(239, 68, 68, 0.15)',
                              borderWidth: 1,
                              borderColor: '#EF4444',
                            },
                          ]}
                        >
                          <Text style={[styles.openButtonText, { color: '#FCA5A5' }]}>⏱️ Régie</Text>
                        </Pressable>
                      )}
                      {event.config.engineId === 'tournament_pairings' && (
                        <Pressable
                          onPress={() => router.push(`/tournament-bracket?id=${event.config.id}`)}
                          style={[
                            styles.openButton,
                            {
                              backgroundColor: 'rgba(245, 158, 11, 0.15)',
                              borderWidth: 1,
                              borderColor: '#F59E0B',
                            },
                          ]}
                        >
                          <Text style={[styles.openButtonText, { color: '#FCD34D' }]}>🏆 Torneio</Text>
                        </Pressable>
                      )}
                      {event.config.engineId === 'incident_command' && (
                        <Pressable
                          onPress={() => router.push(`/ics-command?id=${event.config.id}`)}
                          style={[
                            styles.openButton,
                            {
                              backgroundColor: 'rgba(59, 130, 246, 0.15)',
                              borderWidth: 1,
                              borderColor: '#3B82F6',
                            },
                          ]}
                        >
                          <Text style={[styles.openButtonText, { color: '#93C5FD' }]}>🛡️ ICS</Text>
                        </Pressable>
                      )}
                      <Pressable
                        onPress={() => router.push(`/pdf-forms?id=${event.config.id}`)}
                        style={[
                          styles.openButton,
                          {
                            backgroundColor: 'rgba(255, 184, 0, 0.12)',
                            borderWidth: 1,
                            borderColor: '#FFB800',
                          },
                        ]}
                      >
                        <Text style={[styles.openButtonText, { color: '#FFB800' }]}>📄 PDF</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => router.push(`/skeleton-editor?id=${event.config.id}`)}
                        style={styles.openButton}
                      >
                        <Text style={styles.openButtonText}>Editar</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => deleteEventState(event.config.id)}
                        style={styles.deleteButton}
                      >
                        <Text style={styles.deleteButtonText}>✕</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })
            )}
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
  loadingContainer: {
    flex: 1,
    backgroundColor: '#12151C',
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 12,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  buttonPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
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
  emptyCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  emptyText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  emptySub: {
    color: '#6F7E94',
    fontSize: 13,
    marginTop: 6,
  },
  eventCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
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
  engineBadge: {
    backgroundColor: 'rgba(255, 184, 0, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 184, 0, 0.3)',
  },
  engineBadgeText: {
    color: '#FFB800',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  eventFrequency: {
    fontSize: 12,
    color: '#8A94A6',
    marginTop: 4,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  openButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 8,
  },
  openButtonText: {
    color: '#12151C',
    fontWeight: '600',
    fontSize: 14,
  },
  deleteButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
    padding: 8,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '600',
  },
});
