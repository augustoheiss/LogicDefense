/**
 * Page: ics-command.tsx — Sekundo
 *
 * Posto de Comando de Incidentes (FEMA NIMS / ICS Command Board)
 *
 * Implementa:
 * 1. Mapeamento hierárquico estrito das seções de Comando e Estado-Maior Geral.
 * 2. Cálculo dinâmico da complexidade relacional de Graicunas: R = n * (2^(n-1) + n - 1).
 * 3. Alertas de violação da Amplitude de Controle (Span of Control NIMS: 3 a 7 subordinados).
 * 4. Painel de canais de rádio táticos e contagem de efetivo mobilizado.
 *
 * Skills: agency-backend-architect, agency-frontend-developer, agency-ui-designer
 */

import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useLocalEvent } from '../hooks/useLocalEvent';
import { useSkeleton } from '../hooks/useSkeleton';
import {
  calculateGraicunasComplexity,
  type SkeletonNode,
  type ICSRoleType,
  type ICSNodeMeta,
} from '@sekundo/core';

export default function ICSCommandConsole() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const eventId = id || '';

  const { events } = useLocalEvent();
  const { tree, flatRegistry } = useSkeleton(eventId);
  const currentEvent = events.find((e) => e.config.id === eventId);

  const [selectedOperationalPeriod, setSelectedOperationalPeriod] = useState<string>('OP-01 (08:00 - 20:00)');

  // Build tree or default emergency command structure if tree is empty
  const commandTree: SkeletonNode[] = useMemo(() => {
    if (tree && tree.length > 0) return tree;

    // Default FEMA NIMS ICS sample hierarchy
    return [
      {
        key: '01',
        type: 'header',
        label: 'Comandante do Incidente (Incident Commander)',
        value: 'Operador Comando 01',
        email: 'comando01@operacoes.local',
        meta: {
          icsRole: 'INCIDENT_COMMANDER',
          allocatedPersonnel: 1,
          radioChannel: 'CH-01 (Comando Geral)',
          operationalPeriod: 'OP-01',
        },
        children: [
          {
            key: '01.01',
            type: 'slot',
            label: 'Oficial de Segurança (Safety Officer)',
            value: 'Oficial Segurança 02',
            email: 'seguranca02@operacoes.local',
            meta: {
              icsRole: 'SAFETY_OFFICER',
              allocatedPersonnel: 3,
              radioChannel: 'CH-02 (Segurança)',
            },
            children: [],
          },
          {
            key: '01.02',
            type: 'slot',
            label: 'Oficial de Informações Públicas (PIO)',
            value: 'Oficial Comunicação 03',
            email: 'comunicacao03@operacoes.local',
            meta: {
              icsRole: 'PUBLIC_INFO_OFFICER',
              allocatedPersonnel: 4,
              radioChannel: 'CH-03 (Mídia)',
            },
            children: [],
          },
          {
            key: '01.03',
            type: 'header',
            label: 'Seção de Operações (Operations Section)',
            value: 'Coord. Operações 04',
            email: 'operacoes04@operacoes.local',
            meta: {
              icsRole: 'OPERATIONS',
              allocatedPersonnel: 32,
              radioChannel: 'CH-04 (Operações Táticas)',
            },
            children: [
              {
                key: '01.03.01',
                type: 'slot',
                label: 'Divisão Alfa (Resgate e Triagem)',
                value: 'Líder Divisão Alfa 05',
                email: 'alfa05@operacoes.local',
                meta: {
                  icsRole: 'DIVISION',
                  allocatedPersonnel: 12,
                  radioChannel: 'CH-04A',
                },
                children: [],
              },
              {
                key: '01.03.02',
                type: 'slot',
                label: 'Divisão Bravo (Contenção Perimetral)',
                value: 'Líder Divisão Bravo 06',
                email: 'bravo06@operacoes.local',
                meta: {
                  icsRole: 'DIVISION',
                  allocatedPersonnel: 10,
                  radioChannel: 'CH-04B',
                },
                children: [],
              },
              {
                key: '01.03.03',
                type: 'slot',
                label: 'Equipe de Intervenção Rápida (Strike Team)',
                value: 'Líder Equipe Tática 07',
                email: 'tatica07@operacoes.local',
                meta: {
                  icsRole: 'STRIKE_TEAM',
                  allocatedPersonnel: 10,
                  radioChannel: 'CH-04C',
                },
                children: [],
              },
            ],
          },
          {
            key: '01.04',
            type: 'header',
            label: 'Seção de Planejamento (Planning Section)',
            value: 'Coord. Planejamento 08',
            email: 'planejamento08@operacoes.local',
            meta: {
              icsRole: 'PLANNING',
              allocatedPersonnel: 8,
              radioChannel: 'CH-05 (Planejamento)',
            },
            children: [],
          },
          {
            key: '01.05',
            type: 'header',
            label: 'Seção de Logística (Logistics Section)',
            value: 'Coord. Logística 09',
            email: 'logistica09@operacoes.local',
            meta: {
              icsRole: 'LOGISTICS',
              allocatedPersonnel: 18,
              radioChannel: 'CH-06 (Suprimentos)',
            },
            children: [],
          },
        ],
      },
    ];
  }, [tree]);

  // Compute metrics and Graicunas span of control
  const icsAnalysis = useMemo(() => {
    let totalUnits = 0;
    let totalPersonnel = 0;
    let breaches = 0;
    let maxComplexity = 0;

    function walk(node: SkeletonNode) {
      totalUnits++;
      const meta = (node.meta || {}) as ICSNodeMeta;
      totalPersonnel += meta.allocatedPersonnel || 1;

      const subCount = (node.children || []).length;
      if (subCount > 0) {
        const comp = calculateGraicunasComplexity(subCount);
        if (comp > maxComplexity) maxComplexity = comp;
        if (subCount > 7) {
          breaches++;
        }
        for (const child of node.children) {
          walk(child);
        }
      }
    }

    for (const root of commandTree) {
      walk(root);
    }

    return {
      totalUnits,
      totalPersonnel,
      breaches,
      maxComplexity,
      isSpanHealthy: breaches === 0,
    };
  }, [commandTree]);

  // Role color classifier
  const getRoleBadgeColor = (role?: ICSRoleType) => {
    switch (role) {
      case 'INCIDENT_COMMANDER':
        return '#1E40AF'; // Dark Blue
      case 'SAFETY_OFFICER':
      case 'PUBLIC_INFO_OFFICER':
      case 'LIAISON_OFFICER':
        return '#0284C7'; // Cyan
      case 'OPERATIONS':
      case 'DIVISION':
      case 'STRIKE_TEAM':
      case 'TASK_FORCE':
      case 'BRANCH':
        return '#DC2626'; // Red
      case 'PLANNING':
        return '#D97706'; // Gold/Amber
      case 'LOGISTICS':
        return '#EA580C'; // Orange
      case 'FINANCE':
        return '#16A34A'; // Green
      default:
        return '#475569';
    }
  };

  // Recursive Tree Node Renderer
  const renderNode = (node: SkeletonNode, level: number = 0) => {
    const meta = (node.meta || {}) as ICSNodeMeta;
    const subCount = (node.children || []).length;
    const graicunas = subCount > 0 ? calculateGraicunasComplexity(subCount) : 0;
    const isBreach = subCount > 7;
    const badgeColor = getRoleBadgeColor(meta.icsRole);

    return (
      <View key={node.key} style={[styles.nodeCard, { marginLeft: level * 24 }]}>
        <View style={styles.nodeHeaderRow}>
          <View style={styles.nodeLeft}>
            <View style={[styles.roleBadge, { backgroundColor: badgeColor }]}>
              <Text style={styles.roleBadgeText}>
                {meta.icsRole || 'NÓ TÁTICO'}
              </Text>
            </View>
            <Text style={styles.pathKeyText}>{node.key}</Text>
          </View>

          <View style={styles.personnelBadge}>
            <Text style={styles.personnelText}>
              👥 Efetivo: {meta.allocatedPersonnel || 1}
            </Text>
          </View>
        </View>

        <Text style={styles.nodeTitle}>{node.label || node.value}</Text>
        {node.value && node.label !== node.value && (
          <Text style={styles.nodeLeader}>Oficial Responsável: {node.value}</Text>
        )}

        {meta.radioChannel && (
          <View style={styles.radioRow}>
            <Text style={styles.radioText}>📻 Rádio: {meta.radioChannel}</Text>
          </View>
        )}

        {/* Graicunas Span of Control Indicator for supervisory nodes */}
        {subCount > 0 && (
          <View
            style={[
              styles.spanBox,
              isBreach ? styles.spanBoxBreach : styles.spanBoxHealthy,
            ]}
          >
            <Text style={styles.spanTitle}>
              {isBreach
                ? `⚠️ ALERTA NIMS: Sobrecarga de Amplitude (${subCount} subordinados)`
                : `✅ Amplitude NIMS Saudável (${subCount} subordinados)`}
            </Text>
            <Text style={styles.spanDetail}>
              Graicunas R = {graicunas} relações potenciais | Equilíbrio ideal: 3 a 7
            </Text>
          </View>
        )}

        {/* Render children */}
        {node.children && node.children.length > 0 && (
          <View style={styles.childrenContainer}>
            {node.children.map((child) => renderNode(child, level + 1))}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header Bar */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Voltar</Text>
          </Pressable>
          <View style={{ flexShrink: 1 }}>
            <Text style={styles.headerTitle}>Posto de Comando de Incidentes (ICS / NIMS)</Text>
            <Text style={styles.headerSubtitle}>
              {currentEvent ? currentEvent.config.name : 'Sekundo Emergency Management'}
            </Text>
          </View>
        </View>

        <View style={styles.periodBadge}>
          <Text style={styles.periodLabel}>PERÍODO OPERACIONAL</Text>
          <Text style={styles.periodValue}>{selectedOperationalPeriod}</Text>
        </View>
      </View>

      {/* Telemetry Strip */}
      <View style={styles.telemetryBar}>
        <View style={styles.telemetryItem}>
          <Text style={styles.telemetryLabel}>UNIDADES TÁTICAS</Text>
          <Text style={styles.telemetryValue}>{icsAnalysis.totalUnits}</Text>
        </View>

        <View style={styles.telemetryItem}>
          <Text style={styles.telemetryLabel}>EFETIVO TOTAL ALOCADO</Text>
          <Text style={styles.telemetryValue}>{icsAnalysis.totalPersonnel}</Text>
        </View>

        <View style={styles.telemetryItem}>
          <Text style={styles.telemetryLabel}>COMPLEXIDADE GRAICUNAS (MÁX)</Text>
          <Text style={styles.telemetryValue}>R = {icsAnalysis.maxComplexity}</Text>
        </View>

        <View style={styles.telemetryItem}>
          <Text style={styles.telemetryLabel}>AMPLITUDE DE CONTROLE</Text>
          <View
            style={[
              styles.healthBadge,
              icsAnalysis.isSpanHealthy ? styles.healthBadgeOk : styles.healthBadgeWarning,
            ]}
          >
            <Text style={styles.healthBadgeText}>
              {icsAnalysis.isSpanHealthy
                ? '✅ SAUDÁVEL (N <= 7)'
                : `⚠️ ${icsAnalysis.breaches} SOBRECARGA(S)`}
            </Text>
          </View>
        </View>
      </View>

      {/* Main Hierarchy Tree Scroll */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.treeWrapper}>
          <Text style={styles.sectionHeading}>Organograma Operacional de Campo:</Text>
          {commandTree.map((root) => renderNode(root, 0))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1120',
  },
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    backgroundColor: '#0F172A',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
  },
  backBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#1E293B',
  },
  backBtnText: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '600',
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
  },
  periodBadge: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'flex-start',
  },
  periodLabel: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '700',
  },
  periodValue: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700',
  },
  telemetryBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    gap: 16,
  },
  telemetryItem: {
    flexDirection: 'column',
  },
  telemetryLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 2,
  },
  telemetryValue: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '800',
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  healthBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  healthBadgeOk: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  healthBadgeWarning: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  healthBadgeText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '800',
  },
  scrollContent: {
    padding: 20,
  },
  treeWrapper: {
    maxWidth: 900,
    width: '100%',
    alignSelf: 'center',
  },
  sectionHeading: {
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 16,
  },
  nodeCard: {
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 12,
  },
  nodeHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  nodeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  roleBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  pathKeyText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  personnelBadge: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  personnelText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '600',
  },
  nodeTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
  },
  nodeLeader: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  radioRow: {
    marginTop: 6,
  },
  radioText: {
    color: '#FCD34D',
    fontSize: 11,
    fontWeight: '600',
  },
  spanBox: {
    marginTop: 10,
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  spanBoxHealthy: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderColor: '#10B981',
  },
  spanBoxBreach: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: '#EF4444',
  },
  spanTitle: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '700',
  },
  spanDetail: {
    color: '#94A3B8',
    fontSize: 10,
    marginTop: 2,
  },
  childrenContainer: {
    marginTop: 10,
  },
});
