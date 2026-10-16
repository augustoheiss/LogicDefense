/**
 * Component: CosmicBackground
 *
 * Transcendent celestial backdrop for Sekundo.
 *
 * Visual Layers:
 * 1. Deep Space Void (#0A0C12 base)
 * 2. High-res Primordial Cosmos Wallpaper (Fixed, Opacity ~0.26):
 *    - Left: Primordial unified Earth (Pangaea before division) with pure protective canopy atmosphere.
 *    - Center: Translucent Sekundo sacred chronos emblem & infinity loop.
 *    - Right: Radiant golden sun, planetary orbits, and spiral galaxies.
 * 3. Reactive Scroll Parallax:
 *    - Orbital rotation of celestial bodies based on scroll position.
 *    - Gentle chromatic hue-shift as the user scrolls deeper into events.
 * 4. Starfield & Cosmic Dust Animation:
 *    - Ethereal twinkling stars and orbiting particle points on left/right edges.
 *
 * Zero interference: pointer-events: none, zIndex: -1.
 */

import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Image, Platform } from 'react-native';

const cosmicWallpaper = require('../../../assets/images/cosmic-wallpaper.jpg');

export function CosmicBackground() {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    // Ensure body and React Navigation screen wrappers are transparent to reveal cosmos
    if (typeof document !== 'undefined') {
      const styleId = 'sekundo-cosmic-transparency';
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.innerHTML = `
          body, #root {
            background-color: #0C0E15 !important;
          }
          div[style*="background-color:rgba(242,242,242"],
          div[style*="background-color: rgb(242, 242, 242)"],
          div[style*="background-color:#f2f2f2"],
          div[style*="background-color: #f2f2f2"] {
            background-color: transparent !important;
          }
        `;
        document.head.appendChild(style);
      }
    }

    let ticking = false;
    const handleScroll = (e: any) => {
      const currentY =
        (e?.target && typeof e.target.scrollTop === 'number' ? e.target.scrollTop : 0) ||
        window.scrollY ||
        document.documentElement.scrollTop ||
        0;

      if (!ticking) {
        window.requestAnimationFrame(() => {
          setScrollY(currentY);
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    return () => window.removeEventListener('scroll', handleScroll, { capture: true } as any);
  }, []);

  // Smooth, subtle celestial parallax (very distant starfield: low movement factor)
  const parallaxOffsetY = -((scrollY * 0.04) % 35);

  return (
    <View style={styles.fixedContainer} pointerEvents="none">
      {/* 1. Base dark obsidian cosmic void */}
      <View style={styles.voidBase} />

      {/* 2. Main Neutral Deep Space Starfield (Subtle, crisp, zero bright planets/suns) */}
      <Image
        source={cosmicWallpaper}
        style={[
          styles.wallpaperImage,
          {
            opacity: 0.22,
            transform: [
              { translateY: parallaxOffsetY },
              { scale: 1.02 },
            ],
            ...(Platform.OS === 'web'
              ? ({
                  willChange: 'transform',
                  transition: 'transform 0.1s ease-out',
                } as any)
              : {}),
          },
        ]}
        resizeMode="cover"
      />

      {/* 3. Center Vignette & Reading Contrast Protector (Ensures 100% card & text legibility) */}
      <View
        style={[
          styles.centerContrastWash,
          Platform.OS === 'web'
            ? ({
                backgroundImage:
                  'radial-gradient(ellipse at center, rgba(7, 9, 14, 0.25) 0%, rgba(7, 9, 14, 0.70) 100%)',
              } as any)
            : null,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fixedContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    zIndex: -1,
  },
  voidBase: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#07090E',
  },
  wallpaperImage: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  centerContrastWash: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(7, 9, 14, 0.35)', // Fallback for native and dark mode baseline
  },
});

