/**
 * useSubscription Hook — Assistente Moeda (Web Platform Override)
 *
 * Dedicated mockup provider for Web environments to avoid loading native RevenueCat binaries
 * which causes static bundling errors in Metro.
 */

import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
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
  };
}

export interface SubscriptionContextState {
  isPro: boolean;
  subscriptionType: 'monthly' | 'yearly' | null;
  packages: SubscriptionPackage[];
  consumables: SubscriptionPackage[];
  isLoading: boolean;
  purchasePackage: (pkg: any) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  showPaywall: boolean;
  setShowPaywall: (show: boolean) => void;
  toggleProMock: () => void;
}

const SubscriptionContext = createContext<SubscriptionContextState | null>(null);

const MOCK_PACKAGES: SubscriptionPackage[] = [
  {
    identifier: 'mock_monthly',
    packageType: 'MONTHLY',
    product: {
      priceString: 'R$ 20,00',
      price: 20.00,
      title: 'Mensal',
      description: 'Acesso mensal completo ao Assistente Moeda Pro',
    },
  },
  {
    identifier: 'mock_yearly',
    packageType: 'YEARLY',
    product: {
      priceString: 'R$ 120,00',
      price: 120.00,
      title: 'Anual',
      description: 'Acesso anual completo ao Assistente Moeda Pro',
    },
  },
];

const MOCK_CONSUMABLES: SubscriptionPackage[] = [
  {
    identifier: 'mock_tokens_100k',
    packageType: 'CUSTOM',
    product: {
      priceString: 'R$ 9,90',
      price: 9.90,
      title: 'Recarga 100k Tokens',
      description: 'Adiciona 100.000 tokens de saldo no Motor de IA',
    },
  },
];

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [isPro, setIsPro] = useState(false);
  const [subscriptionType, setSubscriptionType] = useState<'monthly' | 'yearly' | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);

  const auth = useAuthContext();

  const isAdmin = useMemo(() => {
    return !!(
      auth.user?.email && (
        auth.user.email.toLowerCase() === 'augustoheiss@gmail.com' ||
        auth.user.email.toLowerCase() === 'augusto@heisslab.com.br' ||
        auth.user.email.toLowerCase() === 'ceo@heisslab.com.br' ||
        (process.env.EXPO_PUBLIC_ADMIN_EMAIL && auth.user.email.toLowerCase() === process.env.EXPO_PUBLIC_ADMIN_EMAIL.toLowerCase())
      )
    );
  }, [auth.user]);

  const effectiveIsPro = isAdmin ? true : isPro;
  const effectiveSubscriptionType = isAdmin ? 'yearly' : subscriptionType;

  const purchasePackage = useCallback(async (pkg: any): Promise<boolean> => {
    const userId = auth.user?.id;
    const success = await webPurchase(pkg, userId);
    return success;
  }, [auth.user]);

  const restorePurchases = useCallback(async (): Promise<boolean> => {
    setIsPro(true);
    setSubscriptionType('yearly');
    window.alert('Sucesso: Assinatura Pro restaurada no simulador web!');
    return true;
  }, []);

  const toggleProMock = useCallback(() => {
    setIsPro((prev) => {
      const next = !prev;
      setSubscriptionType(next ? 'yearly' : null);
      return next;
    });
  }, []);

  const value: SubscriptionContextState = {
    isPro: effectiveIsPro,
    subscriptionType: effectiveSubscriptionType,
    packages: MOCK_PACKAGES,
    consumables: MOCK_CONSUMABLES,
    isLoading: false,
    purchasePackage,
    restorePurchases,
    showPaywall,
    setShowPaywall,
    toggleProMock,
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
