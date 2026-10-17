/**
 * Shadow Tokens — Assistente Moeda Design System
 *
 * Platform-aware shadows: iOS uses shadow* properties, Android uses elevation.
 */

import { Platform, ViewStyle } from 'react-native';

type ShadowStyle = Pick<
  ViewStyle,
  'shadowColor' | 'shadowOffset' | 'shadowOpacity' | 'shadowRadius' | 'elevation'
>;

function createShadow(
  offsetY: number,
  radius: number,
  opacity: number,
  elevation: number,
): ShadowStyle {
  return Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: offsetY },
      shadowOpacity: opacity,
      shadowRadius: radius,
    },
    android: {
      elevation,
    },
    default: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: offsetY },
      shadowOpacity: opacity,
      shadowRadius: radius,
    },
  }) as ShadowStyle;
}

export const shadows = {
  none:   createShadow(0, 0, 0, 0),
  sm:     createShadow(1, 2, 0.15, 2),
  md:     createShadow(2, 4, 0.20, 4),
  lg:     createShadow(4, 8, 0.25, 8),
  xl:     createShadow(8, 16, 0.30, 12),
} as const;
