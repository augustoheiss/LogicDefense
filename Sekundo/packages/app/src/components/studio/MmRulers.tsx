import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Line, Text as SvgText, G, Rect } from 'react-native-svg';
import { mmToPx } from '@sekundo/core';

interface RulerProps {
  widthMm: number;
  heightMm: number;
  zoom?: number;
}

export const RULER_THICKNESS = 22;

export function MmTopRuler({ widthMm, zoom = 1 }: { widthMm: number; zoom?: number }) {
  const widthPx = mmToPx(widthMm, zoom);
  const ticks: number[] = [];
  for (let mm = 0; mm <= widthMm; mm += 5) {
    ticks.push(mm);
  }

  return (
    <View style={[styles.topRulerContainer, { width: widthPx, height: RULER_THICKNESS }]}>
      <Svg width={widthPx} height={RULER_THICKNESS}>
        <Rect x={0} y={0} width={widthPx} height={RULER_THICKNESS} fill="#1E293B" />
        {ticks.map((mm) => {
          const x = mmToPx(mm, zoom);
          const isMajor = mm % 10 === 0;
          return (
            <G key={`top-tick-${mm}`}>
              <Line
                x1={x}
                y1={isMajor ? 6 : 14}
                x2={x}
                y2={RULER_THICKNESS}
                stroke={isMajor ? '#94A3B8' : '#475569'}
                strokeWidth={1}
              />
              {isMajor && mm > 0 && (
                <SvgText
                  x={x + 2}
                  y={12}
                  fill="#CBD5E1"
                  fontSize={8}
                  fontFamily="monospace"
                >
                  {mm}
                </SvgText>
              )}
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

export function MmLeftRuler({ heightMm, zoom = 1 }: { heightMm: number; zoom?: number }) {
  const heightPx = mmToPx(heightMm, zoom);
  const ticks: number[] = [];
  for (let mm = 0; mm <= heightMm; mm += 5) {
    ticks.push(mm);
  }

  return (
    <View style={[styles.leftRulerContainer, { width: RULER_THICKNESS, height: heightPx }]}>
      <Svg width={RULER_THICKNESS} height={heightPx}>
        <Rect x={0} y={0} width={RULER_THICKNESS} height={heightPx} fill="#1E293B" />
        {ticks.map((mm) => {
          const y = mmToPx(mm, zoom);
          const isMajor = mm % 10 === 0;
          return (
            <G key={`left-tick-${mm}`}>
              <Line
                x1={isMajor ? 6 : 14}
                y1={y}
                x2={RULER_THICKNESS}
                y2={y}
                stroke={isMajor ? '#94A3B8' : '#475569'}
                strokeWidth={1}
              />
              {isMajor && mm > 0 && (
                <SvgText
                  x={2}
                  y={y - 2}
                  fill="#CBD5E1"
                  fontSize={7.5}
                  fontFamily="monospace"
                >
                  {mm}
                </SvgText>
              )}
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

export function MmGridSvgLayer({ widthMm, heightMm }: RulerProps) {
  const vLines: number[] = [];
  const hLines: number[] = [];
  for (let x = 5; x < widthMm; x += 5) vLines.push(x);
  for (let y = 5; y < heightMm; y += 5) hLines.push(y);

  return (
    <G>
      {vLines.map((x) => {
        const isMajor = x % 10 === 0;
        return (
          <Line
            key={`grid-v-${x}`}
            x1={x}
            y1={0}
            x2={x}
            y2={heightMm}
            stroke={isMajor ? '#E2E8F0' : '#F1F5F9'}
            strokeWidth={isMajor ? 0.25 : 0.12}
          />
        );
      })}
      {hLines.map((y) => {
        const isMajor = y % 10 === 0;
        return (
          <Line
            key={`grid-h-${y}`}
            x1={0}
            y1={y}
            x2={widthMm}
            y2={y}
            stroke={isMajor ? '#E2E8F0' : '#F1F5F9'}
            strokeWidth={isMajor ? 0.25 : 0.12}
          />
        );
      })}
    </G>
  );
}

const styles = StyleSheet.create({
  topRulerContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    overflow: 'hidden',
  },
  leftRulerContainer: {
    borderRightWidth: 1,
    borderRightColor: '#334155',
    overflow: 'hidden',
  },
});
