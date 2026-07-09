/**
 * useSubscription Hook — Assistente Moeda (Web Platform Override)
 *
 * Dedicated mockup provider for Web environments to avoid loading native RevenueCat binaries
 * which causes static bundling errors in Metro.
 */

import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthContext } from './useAuth';
import { purchasePackage as webPurchase } from '../services/revenueCatService.web';

export interface SubscriptionPackage {
  identifier: string;
  packageType: string;
  product: {
    priceString: string;
    price: number;
    title: string;
    description: string;
    expirationDate?: string | null;
  };
}

export interface SubscriptionContextState {
  isPro: boolean;
  subscriptionType: 'monthly' | 'yearly' | null;
  packages: SubscriptionPackage[];
  consumables: SubscriptionPackage[];
  isLoading: boolean;
  isProcessing: boolean;
  purchasePackage: (pkg: any) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  showPaywall: boolean;
  setShowPaywall: (show: boolean) => void;
  toggleProMock: () => void;
  expirationDate: string | null;
  /** Find a specific package by its RevenueCat identifier (e.g. 'moeda_tokens_100k') */
  getPackageByIdentifier: (identifier: string) => SubscriptionPackage | undefined;
}

const SubscriptionContext = createContext<SubscriptionContextState | null>(null);

const MOCK_PACKAGES: SubscriptionPackage[] = Platform.OS === 'web' ? [
  {
    identifier: 'moeda_pro:moeda-pro-mensal',
    packageType: 'MONTHLY',
    product: {
      priceString: 'R$ 20,00',
      price: 20.00,
      title: 'Mensal',
      description: 'Acesso mensal completo ao Assistente Moeda Pro',
      expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
  },
  {
    identifier: 'moeda_pro:moeda-pro-anual',
    packageType: 'YEARLY',
    product: {
      priceString: 'R$ 120,00',
      price: 120.00,
      title: 'Anual',
      description: 'Acesso anual completo ao Assistente Moeda Pro',
      expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    },
  },
] : [];

const MOCK_CONSUMABLES: SubscriptionPackage[] = Platform.OS === 'web' ? [
  {
    identifier: 'moeda_tokens_100k',
    packageType: 'CUSTOM',
    product: {
      priceString: 'R$ 9,90',
      price: 9.90,
      title: 'Recarga 100k Tokens',
      description: 'Adiciona 100.000 tokens de saldo no Motor de IA',
      expirationDate: null,
    },
  },
] : [];

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [isPro, setIsPro] = useState(false);
  const [subscriptionType, setSubscriptionType] = useState<'monthly' | 'yearly' | null>(null);
  const [expirationDate, setExpirationDate] = useState<string | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const auth = useAuthContext();
  const router = useRouter();

  const isReviewer = useMemo(() => {
    return !!(
      auth.user?.email && auth.user.email.toLowerCase() === 'augustotester@gmail.com'
    );
  }, [auth.user]);

  const isPremiumUser = auth.profile?.premiumTier === 'premium';
  const effectiveIsPro = isReviewer ? true : (isPro || isPremiumUser);
  const effectiveSubscriptionType = isReviewer ? 'yearly' : (subscriptionType || (auth.profile?.subscriptionType as 'monthly' | 'yearly') || (isPremiumUser ? 'monthly' : null));
  const effectiveExpirationDate = isReviewer ? null : (expirationDate || auth.profile?.subscriptionExpiresAt || null);

  const purchasePackage = useCallback(async (pkg: any): Promise<boolean> => {
    const userId = auth.user?.id;
    if (!userId) {
      if (typeof window !== 'undefined') {
        window.alert("Você precisa estar conectado para realizar uma recarga ou assinatura.");
        window.location.href = '/login';
      }
      return false;
    }
    setIsProcessing(true);
    try {
      // 1-second latency simulation for redirection to allow UI to render processing state
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const success = await webPurchase(pkg, userId);
      if (success) {
        // Forcefully refresh Supabase profile
        await auth.refreshProfile();
      }
      return success;
    } finally {
      setIsProcessing(false);
    }
  }, [auth.user, auth.refreshProfile]);

  const restorePurchases = useCallback(async (): Promise<boolean> => {
    setIsProcessing(true);
    try {
      setIsPro(true);
      setSubscriptionType('yearly');
      setExpirationDate(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString());
      
      // Forcefully refresh Supabase profile
      await auth.refreshProfile();
      
      window.alert('Sucesso: Assinatura Pro restaurada no simulador web!');
      return true;
    } finally {
      setIsProcessing(false);
    }
  }, [auth.refreshProfile]);

  const toggleProMock = useCallback(() => {
    setIsPro((prev) => {
      const next = !prev;
      setSubscriptionType(next ? 'yearly' : null);
      setExpirationDate(next ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() : null);
      return next;
    });
  }, []);

  const getPackageByIdentifier = useCallback((identifier: string): SubscriptionPackage | undefined => {
    return (
      MOCK_PACKAGES.find((p) => p.identifier === identifier) ||
      MOCK_CONSUMABLES.find((p) => p.identifier === identifier)
    );
  }, []);

  const value: SubscriptionContextState = {
    isPro: effectiveIsPro,
    subscriptionType: effectiveSubscriptionType,
    packages: MOCK_PACKAGES,
    consumables: MOCK_CONSUMABLES,
    isLoading: false,
    isProcessing,
    purchasePackage,
    restorePurchases,
    showPaywall,
    setShowPaywall,
    toggleProMock,
    expirationDate: effectiveExpirationDate,
    getPackageByIdentifier,
  };

  return React.createElement(SubscriptionContext.Provider, { value }, children);
}

export function useSubscription(): SubscriptionContextState {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}
