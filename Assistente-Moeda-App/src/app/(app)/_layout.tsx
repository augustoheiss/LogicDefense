/**
 * App Group Layout — Assistente Moeda
 *
 * Container for the main app area. This is a Stack that holds:
 *   - (tabs) — Bottom tab navigator (main screens)
 *   - ai-chat — Full-screen AI chat (modal)
 *   - add-row — Add new entry (modal)
 */

import { Stack } from 'expo-router';
import { colors } from '@/theme/colors';

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background.primary },
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="chat"
        options={{
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
    </Stack>
  );
}
