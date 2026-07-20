/**
 * Page: pdf-mapper (Mobile Native Fallback)
 *
 * Strict fallback notifying the user that interactive PDF coordinate
 * mapping is optimized exclusively for desktop screens.
 */

import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

export default function MobilePDFMapper() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.icon}>🖥️</Text>
        <Text style={styles.title}>Desktop Only Feature</Text>
        <Text style={styles.text}>
          Interactive coordinate canvas structural mapping is optimized exclusively for desktop web screens
          to ensure precise pixel placement.
        </Text>
        <Text style={styles.subText}>
          Mobile platforms support PDF viewing and field injection using pre-mapped coordinates.
        </Text>

        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Return to Editor</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#12151C',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  icon: {
    fontSize: 48,
    marginBottom: 20,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },
  text: {
    color: '#D1D5DB',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 16,
  },
  subText: {
    color: '#6F7E94',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 28,
  },
  backBtn: {
    backgroundColor: '#FFB800',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    width: '100%',
    alignItems: 'center',
  },
  backBtnText: {
    color: '#12151C',
    fontWeight: '700',
    fontSize: 14,
  },
});
