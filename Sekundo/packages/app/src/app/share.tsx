/**
 * Page: share
 *
 * Admin interface to generate secure URL-safe encrypted tokens.
 * Computes Horizon Window payload, encrypts it using out-of-band passphrase,
 * and provides a copy-ready shareable URL.
 */

import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useLocalEvent } from '../hooks/useLocalEvent';
import { useSkeleton } from '../hooks/useSkeleton';
import { generateToken, buildShareURL } from '@sekundo/core';
import * as Clipboard from 'expo-clipboard';

export default function ShareEvent() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const eventId = typeof id === 'string' ? id : '';

  const { events } = useLocalEvent();
  const event = events.find((e) => e.config.id === eventId);
  const { flatRegistry, loading: skeletonLoading } = useSkeleton(eventId);

  const [passphrase, setPassphrase] = useState('');
  const [generating, setGenerating] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (skeletonLoading || !event) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFB800" />
      </View>
    );
  }

  const handleGenerateLink = async () => {
    if (!passphrase.trim()) return;
    setGenerating(true);
    setCopied(false);
    try {
      // 1. Generate encrypted Base64URL token
      const token = await generateToken(event, flatRegistry, passphrase);
      
      // 2. Build the full URL
      const appBaseUrl = PlatformShareUrlBase();
      const fullUrl = buildShareURL(appBaseUrl, token);
      
      setShareUrl(fullUrl);
    } catch (err: any) {
      alert('Failed to generate token: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    await Clipboard.setStringAsync(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Editor</Text>
          </Pressable>
          <Text style={styles.title}>Secure Event Sharing</Text>
          <Text style={styles.subtitle}>
            Event: {event.config.name}
          </Text>
        </View>

        {/* Informative Alert */}
        <View style={styles.alertBox}>
          <Text style={styles.alertTitle}>🔒 Out-of-Band Key Policy</Text>
          <Text style={styles.alertText}>
            The decryption passphrase is never embedded in the URL. You must share the password
            with the viewers via a secondary secure channel (e.g. WhatsApp, face-to-face).
          </Text>
        </View>

        {/* Input Form */}
        {!shareUrl ? (
          <View style={styles.form}>
            <Text style={styles.label}>ENTER SECURITY PASSPHRASE</Text>
            <TextInput
              style={styles.input}
              secureTextEntry
              value={passphrase}
              onChangeText={setPassphrase}
              placeholder="e.g. mermão-this-is-the-way-2026"
              placeholderTextColor="#4F5E74"
            />
            <Text style={styles.inputSub}>
              Choose a strong password. This will derive the AES-256 key on the device.
            </Text>

            <Pressable
              onPress={handleGenerateLink}
              disabled={!passphrase.trim() || generating}
              style={[
                styles.primaryBtn,
                (!passphrase.trim() || generating) && styles.btnDisabled,
              ]}
            >
              {generating ? (
                <ActivityIndicator size="small" color="#12151C" />
              ) : (
                <Text style={styles.primaryBtnText}>Encrypt & Generate URL</Text>
              )}
            </Pressable>
          </View>
        ) : (
          <View style={styles.resultContainer}>
            <Text style={styles.label}>YOUR SHARABLE LINK IS READY</Text>
            
            <View style={styles.urlDisplay}>
              <Text style={styles.urlText} numberOfLines={2}>
                {shareUrl}
              </Text>
            </View>

            <View style={styles.resultActions}>
              <Pressable onPress={handleCopy} style={styles.copyBtn}>
                <Text style={styles.copyBtnText}>
                  {copied ? '✓ Copied' : 'Copy to Clipboard'}
                </Text>
              </Pressable>
              
              <Pressable onPress={() => setShareUrl(null)} style={styles.resetBtn}>
                <Text style={styles.resetBtnText}>New Password</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

function PlatformShareUrlBase(): string {
  if (typeof window !== 'undefined') {
    // Matches the current hosting URL (works in local dev, staging, prod)
    return `${window.location.protocol}//${window.location.host}`;
  }
  return 'https://sekundo.app';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#12151C',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#12151C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  header: {
    marginBottom: 24,
  },
  backBtn: {
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  backBtnText: {
    color: '#8A94A6',
    fontSize: 14,
    fontWeight: '500',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    color: '#6F7E94',
    fontSize: 13,
    marginTop: 4,
  },
  alertBox: {
    backgroundColor: 'rgba(255, 184, 0, 0.03)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 184, 0, 0.15)',
    padding: 16,
    marginBottom: 24,
  },
  alertTitle: {
    color: '#FFB800',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  alertText: {
    color: '#A9B4C5',
    fontSize: 12,
    lineHeight: 18,
  },
  form: {
    width: '100%',
  },
  label: {
    color: '#8A94A6',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    color: '#FFFFFF',
    padding: 14,
    fontSize: 16,
  },
  inputSub: {
    color: '#4F5E74',
    fontSize: 12,
    marginTop: 8,
    lineHeight: 16,
    marginBottom: 20,
  },
  primaryBtn: {
    backgroundColor: '#FFB800',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  primaryBtnText: {
    color: '#12151C',
    fontWeight: '700',
    fontSize: 16,
  },
  resultContainer: {
    width: '100%',
  },
  urlDisplay: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 16,
    marginBottom: 20,
  },
  urlText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'monospace',
    lineHeight: 20,
  },
  resultActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  copyBtn: {
    flex: 1.5,
    backgroundColor: '#FFB800',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginRight: 10,
  },
  copyBtnText: {
    color: '#12151C',
    fontWeight: '700',
    fontSize: 14,
  },
  resetBtn: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  resetBtnText: {
    color: '#A9B4C5',
    fontWeight: '600',
    fontSize: 14,
  },
});
