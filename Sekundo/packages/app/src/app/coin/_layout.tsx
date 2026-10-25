/**
 * Coin Engine Layout (`/coin/*`) — Assistente Moeda inside Sekundo
 *
 * Mounts the full Assistente Moeda sovereign provider stack:
 * - `<AuthProvider>` (Local-First Guest Mode & License Keys `am_pro_*`)
 * - `<SubscriptionProvider>` (RevenueCat In-App Purchases & Token Credits)
 * - `<CoinDBProvider>` (Local-First `coin_assistant_db`, Undo/Redo, Time Machine, Turso SSE Sync)
 *
 * Plus the Sekundo `<MultiEngineSwitcherBar activeRoute="coin" />` so the user
 * can switch between Sekundo Routines/Territories/Documents and the Financial Engine at any time.
 */

import React from 'react';
import { Tabs, usePathname, useRouter } from 'expo-router';
import {
  Text,
  StyleSheet,
  Platform,
  View,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth, AuthProvider } from '@coin/hooks/useAuth';
import { SubscriptionProvider } from '@coin/hooks/useSubscription';
import { CoinDBProvider, useCoinDB } from '@coin/hooks/useCoinDB';
import { colors } from '@coin/theme/colors';
import { spacing, radius } from '@coin/theme/spacing';
import { TimeMachineBar } from '@coin/components/ui/TimeMachineBar';
import { UniversalHeaderSheetBar } from '@coin/components/ui/UniversalHeaderSheetBar';
import { ErrorBoundary } from '@coin/components/ui/ErrorBoundary';
import { useWebKeyboardShortcuts } from '@coin/hooks/useWebKeyboardShortcuts';
import { MultiEngineSwitcherBar } from '../../components/ui/MultiEngineSwitcherBar';

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return <Text style={[styles.icon, focused && styles.iconFocused]}>{emoji}</Text>;
}

const NAV_ITEMS = [
  { name: 'index',        route: '/coin',              title: 'Hoje',        emoji: '🏠', subtitle: 'Resumo & Saúde' },
  { name: 'transactions', route: '/coin/transactions', title: 'Lançamentos', emoji: '📋', subtitle: 'Planilha Local' },
  { name: 'metrics',      route: '/coin/metrics',      title: 'Métricas',    emoji: '📊', subtitle: 'Setores & Índices' },
  { name: 'charts',       route: '/coin/charts',       title: 'Gráficos',    emoji: '📈', subtitle: 'Evolução & Pizza' },
  { name: 'settings',     route: '/coin/settings',     title: 'Ajustes',     emoji: '⚙️', subtitle: 'API, Turso & Backup' },
] as const;

function CoinEngineShell() {
  const { width } = useWindowDimensions();
  const [isHydrated, setIsHydrated] = React.useState(false);
  React.useEffect(() => {
    setIsHydrated(true);
  }, []);
  const isDesktop = isHydrated && width >= 1024;
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
      return pathname === '/coin' || pathname === '/coin/index';
    }
    return pathname.includes(`/coin/${name}`);
  };

  const isCadModeOnHome =
    isRouteActive('index') &&
    db.activeTable?.dashboardConfig?.preferredViewMode !== 'cards';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Unified Sekundo Multi-Engine Bar + Assistente Moeda Quick Ribbon */}
      <View style={styles.sekundoBridgeHeader} testID="coin-engine-sekundo-header">
        <View style={styles.bridgeTitleRow}>
          <Text style={styles.bridgeBadge}>🪙 ENGINE FINANCEIRA</Text>
          <View style={styles.quickSubRoutes}>
            <Pressable
              testID="coin-quick-api-test"
              style={styles.quickSubBtn}
              onPress={() => router.push('/coin/api-test' as any)}
            >
              <Text style={styles.quickSubBtnText}>🧪 API & Turso</Text>
            </Pressable>
            <Pressable
              testID="coin-quick-chat"
              style={styles.quickSubBtn}
              onPress={() => router.push('/coin/chat' as any)}
            >
              <Text style={styles.quickSubBtnText}>💬 Consultor IA</Text>
            </Pressable>
          </View>
        </View>
        <MultiEngineSwitcherBar activeRoute="coin" />
      </View>

      <TimeMachineBar />
      {!isCadModeOnHome && <UniversalHeaderSheetBar />}

      <View style={styles.mainBody}>
        {/* Desktop Left Navigation Rail (>= 1024px) */}
        {isDesktop && (
          <View style={styles.desktopSidebar}>
            <View style={styles.sidebarSection}>
              <Text style={styles.sidebarSectionTitle}>ASSISTENTE MOEDA</Text>
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

        <View style={{ flex: 1, minHeight: 0 }}>
          <Tabs
            screenOptions={{
              headerShown: false,
              sceneStyle: { flex: 1, backgroundColor: colors.background.primary },
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
            <Tabs.Screen name="chat" options={{ href: null }} />
            <Tabs.Screen name="api-test" options={{ href: null }} />
            <Tabs.Screen name="login" options={{ href: null }} />
            <Tabs.Screen name="register" options={{ href: null }} />
          </Tabs>
        </View>
      </View>
    </SafeAreaView>
  );
}

function CoinProvidersWrapper() {
  const auth = useAuth();
  return (
    <AuthProvider value={auth}>
      <SubscriptionProvider>
        <CoinDBProvider>
          <CoinEngineShell />
        </CoinDBProvider>
      </SubscriptionProvider>
    </AuthProvider>
  );
}

export default function CoinEngineLayout() {
  return (
    <ErrorBoundary fallbackTitle="Erro na Engine Financeira" componentName="CoinEngineLayout">
      <CoinProvidersWrapper />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  sekundoBridgeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    backgroundColor: '#090D16',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(16, 185, 129, 0.28)',
  },
  bridgeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  bridgeBadge: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  quickSubRoutes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quickSubBtn: {
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  quickSubBtnText: {
    color: '#E2E8F0',
    fontSize: 10,
    fontWeight: '700',
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
