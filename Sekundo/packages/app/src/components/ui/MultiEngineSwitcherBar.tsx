import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';

export interface MultiEngineSwitcherBarProps {
  eventId?: string;
  activeRoute:
    | 'home'
    | 'schedule-hub'
    | 'territory-checklist'
    | 'territory-map'
    | 'studio'
    | 'skeleton-editor'
    | 'hoje'
    | 'coin'
    | 'csv-import'
    | 'create-event';
  activeEngines?: string[];
  onOpenPrivileges?: () => void;
  participantsCount?: number;
}

interface EngineIconButtonSpec {
  id: string;
  icon: string;
  shortLabel: string;
  title: string;
  routeKey: MultiEngineSwitcherBarProps['activeRoute'] | 'privileges';
  accentColor: string;
  badge?: string | number;
  onPress: () => void;
}

/**
 * `<MultiEngineSwitcherBar />`
 *
 * Compact Icon-Only Multi-Engine Switcher (`36x36px` buttons, zero verbose labels)
 * so that importing a single CSV Geral lets the user jump between:
 * - 📅 Engine de Programação & WhatsApp
 * - 📋 Engine de Territórios (Prancheta de Campo)
 * - 🗺️ Engine de Territórios (Mapa CAD 2D)
 * - 🛡️ Engine de Privilégios & Rotação
 * - 🖋️ Engine Documental YAML ⇄ PDF
 * - 🌳 Editor Multi-Engine
 * - ☀️ Cockpit Hoje
 * - 🪙 Engine Financeira (Assistente Moeda)
 */
export function MultiEngineSwitcherBar({
  eventId,
  activeRoute,
  onOpenPrivileges,
  participantsCount,
}: MultiEngineSwitcherBarProps) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isCompactMobile = width < 600;
  const query = eventId ? `?id=${encodeURIComponent(eventId)}` : '';

  const items: EngineIconButtonSpec[] = [
    {
      id: 'nav-home',
      icon: '🏠',
      shortLabel: 'Início',
      title: 'Painel Principal (Home)',
      routeKey: 'home',
      accentColor: '#FFB800',
      onPress: () => router.push('/' as any),
    },
    {
      id: 'nav-schedule',
      icon: '📅',
      shortLabel: 'Escala',
      title: 'Engine de Programação & WhatsApp',
      routeKey: 'schedule-hub',
      accentColor: '#38BDF8',
      onPress: () => router.push(`/schedule-hub${query}` as any),
    },
    {
      id: 'nav-territory-checklist',
      icon: '📋',
      shortLabel: 'Campo',
      title: 'Engine de Territórios (Prancheta de Campo)',
      routeKey: 'territory-checklist',
      accentColor: '#10B981',
      onPress: () => router.push(`/territory-checklist${query}` as any),
    },
    {
      id: 'nav-territory-map',
      icon: '🗺️',
      shortLabel: 'Mapa',
      title: 'Engine de Territórios (Mapa CAD 2D)',
      routeKey: 'territory-map',
      accentColor: '#34D399',
      onPress: () => router.push(`/territory-map${query}` as any),
    },
    {
      id: 'nav-privileges',
      icon: '🛡️',
      shortLabel: 'Equipe',
      title: 'Engine de Privilégios & Rotação Justa',
      routeKey: 'privileges',
      accentColor: '#A855F7',
      badge: participantsCount,
      onPress: () => {
        if (onOpenPrivileges) {
          onOpenPrivileges();
        } else {
          router.push(`/schedule-hub${query ? `${query}&openPrivileges=1` : '?openPrivileges=1'}` as any);
        }
      },
    },
    {
      id: 'nav-studio',
      icon: '🖋️',
      shortLabel: 'PDF',
      title: 'Estúdio Documental YAML ⇄ PDF',
      routeKey: 'studio',
      accentColor: '#F59E0B',
      onPress: () => router.push(`/studio${query}` as any),
    },
    {
      id: 'nav-skeleton',
      icon: '🌳',
      shortLabel: 'Árvore',
      title: 'Editor Multi-Engine de Esqueleto',
      routeKey: 'skeleton-editor',
      accentColor: '#60A5FA',
      onPress: () => router.push(`/skeleton-editor${query}` as any),
    },
    {
      id: 'nav-hoje',
      icon: '☀️',
      shortLabel: 'Hoje',
      title: 'Cockpit Hoje & Rituais',
      routeKey: 'hoje',
      accentColor: '#FBBF24',
      onPress: () => router.push('/hoje' as any),
    },
    {
      id: 'nav-coin',
      icon: '🪙',
      shortLabel: 'Moeda',
      title: 'Engine Financeira (Assistente Moeda)',
      routeKey: 'coin',
      accentColor: '#10B981',
      onPress: () => router.push('/coin' as any),
    },
  ];

  return (
    <View style={styles.container} testID="multi-engine-switcher-bar">
      {items.map((item) => {
        const isCurrent = item.routeKey === activeRoute;
        const webTitleProps = Platform.OS === 'web' ? ({ title: item.title } as any) : {};
        return (
          <Pressable
            key={item.id}
            testID={`engine-switch-${item.id}`}
            accessibilityRole="button"
            accessibilityLabel={item.title}
            onPress={item.onPress}
            {...webTitleProps}
            style={[
              styles.iconBtn,
              isCurrent && {
                borderColor: item.accentColor,
                backgroundColor: 'rgba(56, 189, 248, 0.18)',
              },
            ]}
          >
            <Text style={styles.iconGlyph}>{item.icon}</Text>
            {isCompactMobile ? (
              <Text style={styles.shortLabelText} numberOfLines={1}>
                {item.shortLabel}
              </Text>
            ) : null}
            {isCurrent ? (
              <View style={[styles.activeDot, { backgroundColor: item.accentColor }]} />
            ) : null}
            {item.badge !== undefined ? (
              <View style={[styles.badgePill, { borderColor: item.accentColor }]}>
                <Text style={styles.badgeText}>{String(item.badge)}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  iconBtn: {
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.24)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  iconGlyph: {
    fontSize: 15,
    textAlign: 'center',
  },
  shortLabelText: {
    fontSize: 9,
    color: '#94A3B8',
    fontWeight: '700',
    marginTop: 1,
  },
  activeDot: {
    position: 'absolute',
    bottom: 2,
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  badgePill: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderRadius: 7,
    paddingHorizontal: 3,
    minWidth: 14,
    alignItems: 'center',
  },
  badgeText: {
    color: '#F8FAFC',
    fontSize: 8,
    fontWeight: '800',
  },
});
