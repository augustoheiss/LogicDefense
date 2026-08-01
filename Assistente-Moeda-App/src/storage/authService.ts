/**
 * Local Auth & License Key Service — Assistente Moeda Mobile
 * Zero Supabase dependency — local storage + license key management.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const LICENSE_STORAGE_KEY = 'coin_license_key';

export type PremiumTier = 'free' | 'premium';

export interface UserProfile {
  id: string;
  displayName: string;
  email: string | null;
  licenseKey: string | null;
  premiumTier: PremiumTier;
  tokenBalance: number;
  tokenCap?: number;
  subscriptionType?: 'monthly' | 'yearly' | null;
  subscriptionExpiresAt?: string | null;
}

export async function getStoredLicenseKey(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(LICENSE_STORAGE_KEY);
  } catch {
    return null;
  }
}

export async function setStoredLicenseKey(key: string): Promise<void> {
  await AsyncStorage.setItem(LICENSE_STORAGE_KEY, key.trim());
}

export async function clearStoredLicenseKey(): Promise<void> {
  await AsyncStorage.removeItem(LICENSE_STORAGE_KEY);
}

export async function validateMobileLicenseKey(key: string, apiBaseUrl: string): Promise<{ valid: boolean; tier: string; balance: number; cap: number; message: string }> {
  try {
    const response = await fetch(`${apiBaseUrl}/api/license/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ license_key: key.trim() }),
    });
    const data = await response.json();
    if (data.valid) {
      await setStoredLicenseKey(key);
      return {
        valid: true,
        tier: data.tier,
        balance: data.token_balance,
        cap: data.token_cap || 1000000,
        message: 'Chave de Licença válida.'
      };
    } else {
      return {
        valid: false,
        tier: 'free',
        balance: 0,
        cap: 1000000,
        message: data.message || 'Chave inválida.'
      };
    }
  } catch (err) {
    return {
      valid: false,
      tier: 'free',
      balance: 0,
      message: 'Erro de conexão com o servidor de licenças.'
    };
  }
}
