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

import { Tabs } from 'expo-router';
import { Text, StyleSheet, Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';
import { TimeMachineBar } from '@/components/ui/TimeMachineBar';
import { UniversalHeaderSheetBar } from '@/components/ui/UniversalHeaderSheetBar';

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <Text style={[styles.icon, focused && styles.iconFocused]}>
      {emoji}
    </Text>
  );
}

import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

export default function TabsLayout() {
  return (
    <ErrorBoundary fallbackTitle="Erro na Navegação de Abas" componentName="TabsLayout">
      <SafeAreaView style={styles.container} edges={['top']}>
        <TimeMachineBar />
        <UniversalHeaderSheetBar />
        <View style={{ flex: 1 }}>
          <Tabs
          screenOptions={{
            headerShown: false,
            tabBarStyle: styles.tabBar,
            tabBarActiveTintColor: colors.accent.purple,
            tabBarInactiveTintColor: colors.text.disabled,
            tabBarLabelStyle: styles.tabLabel,
          }}
        >
          <Tabs.Screen
            name="index"
            options={{
              title: 'Planilha',
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
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
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
