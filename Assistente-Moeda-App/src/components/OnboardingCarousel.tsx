/**
 * OnboardingCarousel — Premium FTUE for Assistente Moeda
 *
 * A cinematic 3-slide swipeable carousel that introduces the app's
 * core value proposition before the user ever sees a login form.
 *
 * Features:
 *   - Reanimated parallax: text fades + icon scales per slide
 *   - Animated dot indicators with interpolated colors
 *   - Haptic feedback (Light) on every slide transition
 *   - LinearGradient backgrounds per slide
 *   - SafeAreaView for notch/home-bar respect
 *   - Fully tokenised: typography, colors, spacing — no magic numbers
 */

import { useRef, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
  useWindowDimensions,
  type ViewToken,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  type SharedValue,
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  interpolate,
  interpolateColor,
  withSpring,
  withTiming,
  Extrapolation,
  FadeIn,
  FadeInDown,
} from 'react-native-reanimated';
import { useHaptics, ImpactFeedbackStyle } from '@/hooks/useHaptics';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';

// ── Slide data ─────────────────────────────────────────────────────

interface SlideData {
  id: string;
  icon: string;
  title: string;
  description: string;
  gradientColors: readonly [string, string, string];
}

const SLIDES: SlideData[] = [
  {
    id: 'finance',
    icon: '🪙',
    title: 'Controle Total\ndas Finanças',
    description:
      'Registre receitas, despesas e fluxo de caixa em um painel intuitivo e elegante.',
    gradientColors: [colors.background.primary, '#0f0a1e', colors.background.primary],
  },
  {
    id: 'ai-engine',
    icon: '🧠',
    title: 'Motor de IA\nGod Mode',
    description:
      'Análise inteligente que calcula, prevê cenários financeiros e te dá superpoderes.',
    gradientColors: [colors.background.primary, '#1a0a2e', colors.background.primary],
  },
  {
    id: 'cloud-sync',
    icon: '☁️',
    title: 'Sincronize Entre\nDispositivos',
    description:
      'Crie uma conta para manter seus dados seguros na nuvem. Ou comece sem conta.',
    gradientColors: [colors.background.primary, '#0a1628', colors.background.primary],
  },
];

const SLIDE_COUNT = SLIDES.length;

// ── Component ──────────────────────────────────────────────────────

interface OnboardingCarouselProps {
  onComplete: () => void;
}

export function OnboardingCarousel({ onComplete }: OnboardingCarouselProps) {
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { impact } = useHaptics();
  const flatListRef = useRef<FlatList<SlideData>>(null);

  // Shared value tracking scroll position for interpolation
  const scrollX = useSharedValue(0);
  // Track current index for the CTA button text
  const currentIndex = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        const newIndex = viewableItems[0].index;
        if (newIndex !== currentIndex.value) {
          currentIndex.value = newIndex;
          impact(ImpactFeedbackStyle.Light);
        }
      }
    },
  ).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const handleNext = useCallback(() => {
    const nextIdx = Math.round(scrollX.value / screenWidth) + 1;
    if (nextIdx < SLIDE_COUNT) {
      flatListRef.current?.scrollToIndex({ index: nextIdx, animated: true });
    } else {
      onComplete();
    }
  }, [screenWidth, onComplete, scrollX]);

  // ── Render ───────────────────────────────────────────────────

  const renderSlide = useCallback(
    ({ item, index }: { item: SlideData; index: number }) => (
      <SlideItem
        item={item}
        index={index}
        scrollX={scrollX}
        screenWidth={screenWidth}
      />
    ),
    [scrollX, screenWidth],
  );

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[colors.background.primary, '#0f0a1e', colors.background.primary]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Skip button */}
      <Animated.View
        entering={FadeIn.delay(600).duration(400)}
        style={[styles.skipContainer, { top: insets.top + spacing.md }]}
      >
        <Pressable
          onPress={onComplete}
          hitSlop={spacing.md}
          style={({ pressed }) => [
            styles.skipButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.skipText}>Pular</Text>
        </Pressable>
      </Animated.View>

      {/* Slides */}
      <Animated.FlatList
        ref={flatListRef as any}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(_, index) => ({
          length: screenWidth,
          offset: screenWidth * index,
          index,
        })}
      />

      {/* Bottom controls: dots + CTA */}
      <Animated.View
        entering={FadeInDown.delay(400).duration(500)}
        style={[styles.bottomControls, { paddingBottom: insets.bottom + spacing.xxl }]}
      >
        {/* Dot indicators */}
        <View style={styles.dotsContainer}>
          {SLIDES.map((_, i) => (
            <DotIndicator
              key={i}
              index={i}
              scrollX={scrollX}
              screenWidth={screenWidth}
            />
          ))}
        </View>

        {/* CTA Button */}
        <CTAButton
          scrollX={scrollX}
          screenWidth={screenWidth}
          onPress={handleNext}
        />
      </Animated.View>
    </View>
  );
}

// ── Slide Item ──────────────────────────────────────────────────────

interface SlideItemProps {
  item: SlideData;
  index: number;
  scrollX: SharedValue<number>;
  screenWidth: number;
}

function SlideItem({ item, index, scrollX, screenWidth }: SlideItemProps) {
  const inputRange = [
    (index - 1) * screenWidth,
    index * screenWidth,
    (index + 1) * screenWidth,
  ];

  const iconStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      scrollX.value,
      inputRange,
      [0.5, 1, 0.5],
      Extrapolation.CLAMP,
    );
    const opacity = interpolate(
      scrollX.value,
      inputRange,
      [0, 1, 0],
      Extrapolation.CLAMP,
    );
    return { transform: [{ scale }], opacity };
  });

  const titleStyle = useAnimatedStyle(() => {
    const translateY = interpolate(
      scrollX.value,
      inputRange,
      [40, 0, -40],
      Extrapolation.CLAMP,
    );
    const opacity = interpolate(
      scrollX.value,
      inputRange,
      [0, 1, 0],
      Extrapolation.CLAMP,
    );
    return { transform: [{ translateY }], opacity };
  });

  const descStyle = useAnimatedStyle(() => {
    const translateY = interpolate(
      scrollX.value,
      inputRange,
      [60, 0, -60],
      Extrapolation.CLAMP,
    );
    const opacity = interpolate(
      scrollX.value,
      inputRange,
      [0, 1, 0],
      Extrapolation.CLAMP,
    );
    return { transform: [{ translateY }], opacity };
  });

  return (
    <View style={[styles.slide, { width: screenWidth }]}>
      <LinearGradient
        colors={item.gradientColors as any}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      <View style={styles.slideContent}>
        {/* Icon with glow ring */}
        <Animated.View style={[styles.iconContainer, iconStyle]}>
          <View style={styles.iconGlow}>
            <Text style={styles.iconText}>{item.icon}</Text>
          </View>
        </Animated.View>

        {/* Title */}
        <Animated.Text style={[styles.slideTitle, titleStyle]}>
          {item.title}
        </Animated.Text>

        {/* Description */}
        <Animated.Text style={[styles.slideDescription, descStyle]}>
          {item.description}
        </Animated.Text>
      </View>
    </View>
  );
}

// ── Dot Indicator ──────────────────────────────────────────────────

interface DotIndicatorProps {
  index: number;
  scrollX: SharedValue<number>;
  screenWidth: number;
}

function DotIndicator({ index, scrollX, screenWidth }: DotIndicatorProps) {
  const inputRange = [
    (index - 1) * screenWidth,
    index * screenWidth,
    (index + 1) * screenWidth,
  ];

  const dotStyle = useAnimatedStyle(() => {
    const width = interpolate(
      scrollX.value,
      inputRange,
      [8, 28, 8],
      Extrapolation.CLAMP,
    );
    const opacity = interpolate(
      scrollX.value,
      inputRange,
      [0.3, 1, 0.3],
      Extrapolation.CLAMP,
    );
    const backgroundColor = interpolateColor(
      scrollX.value,
      inputRange,
      ['rgba(255,255,255,0.25)', colors.accent.purple, 'rgba(255,255,255,0.25)'],
    );

    return { width, opacity, backgroundColor };
  });

  return <Animated.View style={[styles.dot, dotStyle]} />;
}

// ── CTA Button ─────────────────────────────────────────────────────

interface CTAButtonProps {
  scrollX: SharedValue<number>;
  screenWidth: number;
  onPress: () => void;
}

function CTAButton({ scrollX, screenWidth, onPress }: CTAButtonProps) {
  const { impact } = useHaptics();

  // Determine if we're on the last slide for label text
  const isLastSlide = () => {
    const idx = Math.round(scrollX.value / screenWidth);
    return idx >= SLIDE_COUNT - 1;
  };

  const handlePress = () => {
    impact(ImpactFeedbackStyle.Medium);
    onPress();
  };

  // Animate button glow on last slide
  const buttonGlowStyle = useAnimatedStyle(() => {
    const progress = interpolate(
      scrollX.value,
      [0, (SLIDE_COUNT - 1) * screenWidth],
      [0, 1],
      Extrapolation.CLAMP,
    );
    const shadowOpacity = interpolate(progress, [0, 1], [0, 0.6]);
    return {
      shadowColor: colors.accent.purple,
      shadowOpacity,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 0 },
    };
  });

  return (
    <Animated.View style={buttonGlowStyle}>
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [
          styles.ctaButton,
          pressed && styles.ctaPressed,
        ]}
      >
        <LinearGradient
          colors={[colors.accent.purple, colors.accent.purpleHover]}
          style={styles.ctaGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <CTALabel scrollX={scrollX} screenWidth={screenWidth} />
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

/** Animated label that transitions between "Próximo" and "Começar" */
function CTALabel({
  scrollX,
  screenWidth,
}: {
  scrollX: SharedValue<number>;
  screenWidth: number;
}) {
  const lastSlideStart = (SLIDE_COUNT - 1) * screenWidth;

  const nextStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollX.value,
      [lastSlideStart - screenWidth * 0.5, lastSlideStart],
      [1, 0],
      Extrapolation.CLAMP,
    );
    const translateY = interpolate(
      scrollX.value,
      [lastSlideStart - screenWidth * 0.5, lastSlideStart],
      [0, -20],
      Extrapolation.CLAMP,
    );
    return { opacity, transform: [{ translateY }], position: 'absolute' as const };
  });

  const startStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollX.value,
      [lastSlideStart - screenWidth * 0.5, lastSlideStart],
      [0, 1],
      Extrapolation.CLAMP,
    );
    const translateY = interpolate(
      scrollX.value,
      [lastSlideStart - screenWidth * 0.5, lastSlideStart],
      [20, 0],
      Extrapolation.CLAMP,
    );
    return { opacity, transform: [{ translateY }], position: 'absolute' as const };
  });

  return (
    <View style={styles.ctaLabelContainer}>
      <Animated.Text style={[styles.ctaText, nextStyle]}>
        Próximo →
      </Animated.Text>
      <Animated.Text style={[styles.ctaText, startStyle]}>
        Começar ✨
      </Animated.Text>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },

  // Skip
  skipContainer: {
    position: 'absolute',
    right: spacing.xxl,
    zIndex: 10,
  },
  skipButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  skipText: {
    color: colors.text.tertiary,
    fontSize: typography.label.fontSize,
    fontWeight: typography.label.fontWeight,
  },
  pressed: {
    opacity: 0.6,
  },

  // Slide
  slide: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slideContent: {
    alignItems: 'center',
    paddingHorizontal: spacing.xxxl,
    gap: spacing.xxl,
  },

  // Icon
  iconContainer: {
    marginBottom: spacing.lg,
  },
  iconGlow: {
    width: 120,
    height: 120,
    borderRadius: radius.full,
    backgroundColor: colors.accent.purpleLight,
    borderWidth: 1,
    borderColor: colors.accent.purpleBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: 56,
  },

  // Text
  slideTitle: {
    fontSize: typography.h1.fontSize,
    lineHeight: typography.h1.lineHeight,
    fontWeight: typography.h1.fontWeight,
    letterSpacing: typography.h1.letterSpacing,
    color: colors.text.primary,
    textAlign: 'center',
  },
  slideDescription: {
    fontSize: typography.bodyLarge.fontSize,
    lineHeight: typography.bodyLarge.lineHeight,
    fontWeight: typography.bodyLarge.fontWeight,
    color: colors.text.secondary,
    textAlign: 'center',
    maxWidth: 300,
  },

  // Bottom controls
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: spacing.xxl,
    paddingHorizontal: spacing.xxl,
  },

  // Dots
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dot: {
    height: 8,
    borderRadius: radius.full,
  },

  // CTA
  ctaButton: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    width: '100%',
    minWidth: 300,
  },
  ctaGradient: {
    paddingVertical: spacing.lg + spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
  },
  ctaPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  ctaLabelContainer: {
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ctaText: {
    color: '#fff',
    fontSize: typography.bodyLarge.fontSize,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
