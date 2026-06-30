/**
 * useHaptics — Platform-safe haptic feedback hook
 *
 * Wraps `expo-haptics` with graceful degradation on web (no-op).
 * Provides three feedback styles:
 *   - impact:      Collision-style tap (Light / Medium / Heavy / Rigid / Soft)
 *   - notification: Outcome feedback (Success / Warning / Error)
 *   - selection:    Subtle tick for selection changes
 *
 * Usage:
 *   const { impact, notification, selection } = useHaptics();
 *   impact(ImpactFeedbackStyle.Medium);
 */

import { useCallback } from 'react';
import { Platform } from 'react-native';
import {
  impactAsync,
  notificationAsync,
  selectionAsync,
  ImpactFeedbackStyle,
  NotificationFeedbackType,
} from 'expo-haptics';

export { ImpactFeedbackStyle, NotificationFeedbackType };

const isNativePlatform = Platform.OS === 'ios' || Platform.OS === 'android';

export function useHaptics() {
  const impact = useCallback(
    (style: ImpactFeedbackStyle = ImpactFeedbackStyle.Medium) => {
      if (isNativePlatform) {
        impactAsync(style).catch(() => {
          /* silently ignore — device may not support haptics */
        });
      }
    },
    [],
  );

  const notification = useCallback(
    (type: NotificationFeedbackType = NotificationFeedbackType.Success) => {
      if (isNativePlatform) {
        notificationAsync(type).catch(() => {});
      }
    },
    [],
  );

  const selection = useCallback(() => {
    if (isNativePlatform) {
      selectionAsync().catch(() => {});
    }
  }, []);

  return { impact, notification, selection } as const;
}
