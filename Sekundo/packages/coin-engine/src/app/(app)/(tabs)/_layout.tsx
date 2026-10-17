/**
 * Tab Navigator Layout — Assistente Moeda
 *
 * Bottom tab bar with 4 tabs:
 *   📋 Planilha (Spreadsheet) — default
 *   📊 Métricas (Metrics)
 *   📈 Gráficos (Charts)
 *   ⚙️ Ajustes (Settings)
 *
 * Design: Translucent dark tab bar matching the app's premium aesthetic.
 */

import { Tabs, usePathname, useRouter } from 'expo-router';
import { Text, StyleSheet, Platform, View, Pressable, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@coin/theme/colors';
import { spacing, radius } from '@coin/theme/spacing';
import { TimeMachineBar } from '@coin/components/ui/TimeMachineBar';
import { UniversalHeaderSheetBar } from '@coin/components/ui/UniversalHeaderSheetBar';
import { ErrorBoundary } from '@coin/components/ui/ErrorBoundary';
import { useCoinDB } from '@coin/hooks/useCoinDB';
import { useWebKeyboardShortcuts } from '@coin/hooks/useWebKeyboardShortcuts';

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <Text style={[styles.icon, focused && styles.iconFocused]}>
      {emoji}
    </Text>
  );
}

const NAV_ITEMS = [
  { name: 'index',        route: '/coin',              title: 'Hoje',        emoji: '🏠', subtitle: 'Resumo & Saúde' },
  { name: 'transactions', route: '/coin/transactions', title: 'Lançamentos', emoji: '📋', subtitle: 'Planilha Local' },
  { name: 'metrics',      route: '/coin/metrics',      title: 'Métricas',    emoji: '📊', subtitle: 'Setores & Índices' },
  { name: 'charts',       route: '/coin/charts',       title: 'Gráficos',    emoji: '📈', subtitle: 'Evolução & Pizza' },
  { name: 'settings',     route: '/coin/settings',     title: 'Ajustes',     emoji: '⚙️', subtitle: 'Backup & Módulos' },
] as const;

export default function TabsLayout() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const pathname = usePathname();
  const router = useRouter();
  const db = useCoinDB();

  useWebKeyboardShortcuts({
    onUndo: () => {
      if (db.canUndo) db.undo();
    },
    onRedo: () => {
      if (db.canRedo) db.redo();
    },
    onTogglePrivacy: () => {
      db.togglePrivacyMode();
    },
  });

  const isRouteActive = (name: string) => {
    if (name === 'index') {
      return pathname === '/' || pathname === '/index' || pathname.endsWith('/(tabs)');
    }
    return pathname.includes(`/${name}`);
  };

  const isCadModeOnHome =
    isRouteActive('index') &&
    db.activeTable?.dashboardConfig?.preferredViewMode !== 'cards';

  return (
    <ErrorBoundary fallbackTitle="Erro na Navegação de Abas" componentName="TabsLayout">
      <SafeAreaView style={styles.container} edges={['top']}>
        <TimeMachineBar />
        {!isCadModeOnHome && <UniversalHeaderSheetBar />}
        <View style={styles.mainBody}>
          {/* Desktop Left Navigation Rail (>= 1024px) */}
          {isDesktop && (
            <View style={styles.desktopSidebar}>
              <View style={styles.sidebarSection}>
                <Text style={styles.sidebarSectionTitle}>NAVEGAÇÃO</Text>
                {NAV_ITEMS.map((item) => {
                  const active = isRouteActive(item.name);
                  return (
                    <Pressable
                      key={item.name}
                      style={[styles.sidebarItem, active && styles.sidebarItemActive]}
                      onPress={() => router.push(item.route as any)}
                    >
                      <Text style={styles.sidebarEmoji}>{item.emoji}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.sidebarLabel, active && styles.sidebarLabelActive]}>
                          {item.title}
                        </Text>
                        <Text style={styles.sidebarSublabel} numberOfLines={1}>
                          {item.subtitle}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              {/* Desktop Shortcuts Cheat Sheet */}
              <View style={styles.shortcutsBox}>
                <Text style={styles.shortcutsTitle}>⌨️ ATALHOS WEB</Text>
                <Text style={styles.shortcutLine}>• <Text style={styles.kbd}>Ctrl+Z</Text> Desfazer</Text>
                <Text style={styles.shortcutLine}>• <Text style={styles.kbd}>Ctrl+Y</Text> Refazer</Text>
                <Text style={styles.shortcutLine}>• <Text style={styles.kbd}>Alt+P</Text> Modo Rua 👁️</Text>
                <Text style={styles.shortcutLine}>• <Text style={styles.kbd}>N</Text> Novo Registro</Text>
                <Text style={styles.shortcutLine}>• <Text style={styles.kbd}>/</Text> Buscar na Planilha</Text>
              </View>
            </View>
          )}

          <View style={{ flex: 1 }}>
            <Tabs
              screenOptions={{
                headerShown: false,
                tabBarStyle: isDesktop ? { display: 'none' } : styles.tabBar,
                tabBarActiveTintColor: colors.accent.purple,
                tabBarInactiveTintColor: colors.text.disabled,
                tabBarLabelStyle: styles.tabLabel,
              }}
            >
              <Tabs.Screen
                name="index"
                options={{
                  title: 'Hoje',
                  tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} />,
                }}
              />
              <Tabs.Screen
                name="transactions"
                options={{
                  title: 'Lançamentos',
                  tabBarIcon: ({ focused }) => <TabIcon emoji="📋" focused={focused} />,
                }}
              />
              <Tabs.Screen
                name="metrics"
                options={{
                  title: 'Métricas',
                  tabBarIcon: ({ focused }) => <TabIcon emoji="📊" focused={focused} />,
                }}
              />
              <Tabs.Screen
                name="charts"
                options={{
                  title: 'Gráficos',
                  tabBarIcon: ({ focused }) => <TabIcon emoji="📈" focused={focused} />,
                }}
              />
              <Tabs.Screen
                name="settings"
                options={{
                  title: 'Ajustes',
                  tabBarIcon: ({ focused }) => <TabIcon emoji="⚙️" focused={focused} />,
                }}
              />
            </Tabs>
          </View>
        </View>
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  mainBody: {
    flex: 1,
    flexDirection: 'row',
  },
  desktopSidebar: {
    width: 220,
    backgroundColor: colors.background.secondary,
    borderRightWidth: 1,
    borderRightColor: colors.border.default,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    justifyContent: 'space-between',
  },
  sidebarSection: {
    gap: 4,
  },
  sidebarSectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.text.disabled,
    letterSpacing: 0.8,
    paddingHorizontal: spacing.sm,
    marginBottom: 4,
  },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  sidebarItemActive: {
    backgroundColor: colors.accent.purpleLight,
    borderColor: colors.accent.purpleBorder,
  },
  sidebarEmoji: {
    fontSize: 18,
  },
  sidebarLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  sidebarLabelActive: {
    color: colors.accent.purple,
    fontWeight: '700',
  },
  sidebarSublabel: {
    fontSize: 10,
    color: colors.text.disabled,
  },
  shortcutsBox: {
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: 4,
  },
  shortcutsTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.accent.purple,
    marginBottom: 2,
  },
  shortcutLine: {
    fontSize: 11,
    color: colors.text.secondary,
  },
  kbd: {
    fontWeight: '700',
    color: colors.text.primary,
  },
  tabBar: {
    backgroundColor: colors.background.secondary,
    borderTopColor: colors.border.default,
    borderTopWidth: 1,
    paddingTop: 4,
    height: Platform.OS === 'ios' ? 88 : 64,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  icon: {
    fontSize: 22,
    opacity: 0.5,
  },
  iconFocused: {
    opacity: 1,
  },
});
