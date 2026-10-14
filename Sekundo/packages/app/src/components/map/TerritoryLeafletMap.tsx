/**
 * Component: TerritoryLeafletMap (native fallback)
 *
 * The interactive map is web-only for now; native builds show a short notice.
 * The web implementation lives in `TerritoryLeafletMap.web.tsx` (resolved by Metro).
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { TerritoryLeafletMapProps } from './mapTypes';

export function TerritoryLeafletMap(_props: TerritoryLeafletMapProps) {
  return (
    <View style={styles.box}>
      <Text style={styles.text}>Visualização de mapas disponível no navegador Web.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  text: { color: '#8A94A6', fontSize: 13, textAlign: 'center' },
});
