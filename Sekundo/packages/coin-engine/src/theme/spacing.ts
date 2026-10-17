/**
 * Spacing Scale — Assistente Moeda Design System
 *
 * 4px base unit system. All spacing values are multiples of 4.
 */

export const spacing = {
  /** 0px */  none: 0,
  /** 2px */  xxs:  2,
  /** 4px */  xs:   4,
  /** 8px */  sm:   8,
  /** 12px */ md:   12,
  /** 16px */ lg:   16,
  /** 20px */ xl:   20,
  /** 24px */ xxl:  24,
  /** 32px */ xxxl: 32,
  /** 40px */ xxxxl:40,
  /** 48px */ huge: 48,
} as const;

export const radius = {
  /** 4px */  xs:   4,
  /** 8px */  sm:   8,
  /** 12px */ md:   12,
  /** 16px */ lg:   16,
  /** 20px */ xl:   20,
  /** 9999px */ full: 9999,
} as const;
