/**
 * useSubscription Hook — Assistente Moeda (Native Platform)
 *
 * RevenueCat SDK integration for managing subscription state and checkout flows on iOS and Android.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Platform, Alert } from 'react-native';
import Purchases from 'react-native-purchases';
import { useAuthContext } from './useAuth';

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
  _rcOriginalPackage?: any;
}

export interface SubscriptionContextState {
  isPro: boolean;
  subscriptionType: 'monthly' | 'yearly' | null;
  packages: SubscriptionPackage[];
  consumables: SubscriptionPackage[];
  isLoading: boolean;
  isProcessing: boolean;
  purchasePackage: (pkg: any) => Promise<string | null>;
  restorePurchases: () => Promise<boolean>;
  showPaywall: boolean;
  setShowPaywall: (show: boolean) => void;
  toggleProMock: () => void;
  expirationDate: string | null;
  /** Find a specific package by its RevenueCat identifier (e.g. 'moeda_tokens_100k') */
  getPackageByIdentifier: (identifier: string) => SubscriptionPackage | undefined;
}

const SubscriptionContext = createContext<SubscriptionContextState | null>(null);

const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY || '';
const APPLE_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_APPLE_KEY || '';

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [isPro, setIsPro] = useState(false);
  const [subscriptionType, setSubscriptionType] = useState<'monthly' | 'yearly' | null>(null);
  const [expirationDate, setExpirationDate] = useState<string | null>(null);
  const [rcPackages, setRcPackages] = useState<SubscriptionPackage[]>([]);
  const [rcConsumables, setRcConsumables] = useState<SubscriptionPackage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);

  const auth = useAuthContext();

  const isReviewer = useMemo(() => {
    return Boolean(
      (auth.profile as any)?.is_reviewer === true ||
      process.env.EXPO_PUBLIC_REVIEWER_MODE === 'true'
    );
  }, [auth.profile]);

  const isPremiumUser = auth.profile?.premiumTier === 'premium';
  const effectiveIsPro = isReviewer ? true : (isPro || isPremiumUser);
  const effectiveSubscriptionType = isReviewer ? 'yearly' : (subscriptionType || (auth.profile?.subscriptionType as 'monthly' | 'yearly') || (isPremiumUser ? 'monthly' : null));
  const effectiveExpirationDate = isReviewer ? null : (expirationDate || auth.profile?.subscriptionExpiresAt || null);

  const isReconciling = useRef(false);
  const rcConfiguredRef = useRef(false);

  const syncStates = useCallback(async (active: boolean, _plan: 'monthly' | 'yearly' | null) => {
    if (auth.mode !== 'authenticated' || !auth.user || isReconciling.current) return;
    if (active && auth.profile?.premiumTier !== 'premium') {
      isReconciling.current = true;
      try {
        await auth.refreshProfile();
      } finally {
        isReconciling.current = false;
      }
    }
  }, [auth.mode, auth.user, auth.profile, auth.refreshProfile]);

  useEffect(() => {
    if (auth.mode === 'authenticated' && auth.user) {
      syncStates(isPro, subscriptionType);
    }
  }, [auth.mode, auth.user?.id, isPro, subscriptionType, syncStates]);

  const updateProStatus = useCallback((customerInfo: any) => {
    if (customerInfo && customerInfo.entitlements && customerInfo.entitlements.active) {
      const activeEntitlements = customerInfo.entitlements.active;
      const proEntitlement = activeEntitlements['pro'];
      if (proEntitlement) {
        setIsPro(true);
        // Extract expirationDate directly from the RevenueCat entitlement object
        const rcExpirationDate = proEntitlement.expirationDate || null;
        setExpirationDate(rcExpirationDate);
        const prodId = (proEntitlement.productIdentifier || '').toLowerCase();
        // Explicit matching: compound production identifiers support
        if (prodId.includes('anual') || prodId.includes('year') || prodId.includes('moeda-pro-anual')) {
          setSubscriptionType('yearly');
        } else if (prodId.includes('mensal') || prodId.includes('month') || prodId.includes('moeda-pro-mensal')) {
          setSubscriptionType('monthly');
        } else {
          // Fallback: default to monthly for any other subscription product
          setSubscriptionType('monthly');
        }
        return;
      }
    }
    setIsPro(false);
    setSubscriptionType(null);
    setExpirationDate(null);
  }, []);

  const fetchOfferings = useCallback(async () => {
    if (!rcConfiguredRef.current) {
      setIsLoading(false);
      return;
    }
    try {
      const offerings = await Purchases.getOfferings();
      const currentOffering = offerings.current;

      if (currentOffering !== null && currentOffering.availablePackages.length > 0) {
        const allPackages = currentOffering.availablePackages;

        // ── Clean bucket split from the 'default' offering ──────────────
        // Bucket 1: Subscriptions (MONTHLY / YEARLY / ANNUAL)
        const subscriptions = allPackages
          .filter((pkg: any) => pkg.packageType === 'MONTHLY' || pkg.packageType === 'YEARLY' || pkg.packageType === 'ANNUAL')
          .map((pkg: any) => ({
            identifier: pkg.identifier,
            packageType: pkg.packageType === 'ANNUAL' ? 'YEARLY' : pkg.packageType,
            product: {
              priceString: pkg.product.priceString,
              price: pkg.product.price,
              title: pkg.product.title,
              description: pkg.product.description,
            },
            _rcOriginalPackage: pkg,
          }));

        // Bucket 2: Consumables (CUSTOM packages like 'moeda_tokens_100k')
        const consumables = allPackages
          .filter((pkg: any) => pkg.packageType !== 'MONTHLY' && pkg.packageType !== 'YEARLY' && pkg.packageType !== 'ANNUAL')
          .map((pkg: any) => ({
            identifier: pkg.identifier,
            packageType: pkg.packageType,
            product: {
              priceString: pkg.product.priceString,
              price: pkg.product.price,
              title: pkg.product.title,
              description: pkg.product.description,
            },
            _rcOriginalPackage: pkg,
          }));

        console.log(`[RevenueCat] Fetched ${subscriptions.length} subscription(s) and ${consumables.length} consumable(s) from 'default' offering`);
        setRcPackages(subscriptions);
        setRcConsumables(consumables);
      }
    } catch (e) {
      console.warn('Failed to fetch RevenueCat offerings:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    async function init() {
      if (Platform.OS === 'web') {
        setIsLoading(false);
        return;
      }
      const apiKey = (Platform.OS === 'ios' ? APPLE_API_KEY : GOOGLE_API_KEY).trim();
      if (!apiKey || apiKey.includes('placeholder')) {
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          console.info('[RevenueCat] API key not set — running in Local-First License mode.');
        }
        setIsLoading(false);
        return;
      }
      try {
        const isDev = typeof __DEV__ !== 'undefined' && __DEV__;
        Purchases.setLogLevel(isDev ? Purchases.LOG_LEVEL.DEBUG : Purchases.LOG_LEVEL.WARN);
        Purchases.configure({ apiKey });
        rcConfiguredRef.current = true;

        // Register Listener
        const listener = (info: any) => {
          updateProStatus(info);
        };
        Purchases.addCustomerInfoUpdateListener(listener);

        // Get initial status
        const customerInfo = await Purchases.getCustomerInfo();
        updateProStatus(customerInfo);
      } catch (e) {
        console.warn('RevenueCat config error:', e);
      }
      if (rcConfiguredRef.current) {
        await fetchOfferings();
      } else {
        setIsLoading(false);
      }
    }
    init();
  }, [updateProStatus, fetchOfferings]);

  const purchasePackage = useCallback(async (pkg: any): Promise<string | null> => {
    if (!rcConfiguredRef.current) {
      Alert.alert('Indisponível', 'O serviço de assinaturas da loja não está configurado neste ambiente.');
      return null;
    }
    setIsProcessing(true);
    try {
      const packageToBuy = pkg._rcOriginalPackage || pkg;
      const { customerInfo, transaction } = await Purchases.purchasePackage(packageToBuy);
      const activeEntitlements = customerInfo.entitlements.active;
      const proEntitlement = activeEntitlements['pro'];
      const active = !!proEntitlement;
      setIsPro(active);
      if (active) {
        // Extract expirationDate directly from the RevenueCat entitlement object (no any cast)
        const rcExpirationDate = proEntitlement.expirationDate || null;
        setExpirationDate(rcExpirationDate);
        
        const prodId = (packageToBuy.product?.identifier || '').toLowerCase();
        if (prodId.includes('anual') || prodId.includes('year') || prodId.includes('moeda-pro-anual')) {
          setSubscriptionType('yearly');
        } else {
          setSubscriptionType('monthly');
        }
      } else {
        setSubscriptionType(null);
        setExpirationDate(null);
      }

      // Return unique transaction identifier for idempotency checks
      const txId = transaction?.transactionIdentifier || `rc_tx_${Date.now()}`;
      return txId;
    } catch (e: any) {
      if (!e.userCancelled) {
        Alert.alert('Erro', e.message || 'Erro ao processar compra.');
      }
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const restorePurchases = useCallback(async (): Promise<boolean> => {
    if (!rcConfiguredRef.current) {
      Alert.alert('Indisponível', 'O serviço de assinaturas da loja não está configurado neste ambiente.');
      return false;
    }
    setIsProcessing(true);
    try {
      const customerInfo = await Purchases.restorePurchases();
      const activeEntitlements = customerInfo.entitlements.active;
      const proEntitlement = activeEntitlements['pro'];
      const active = !!proEntitlement;
      setIsPro(active);
      if (active) {
        // Extract expirationDate directly from the RevenueCat entitlement object (no any cast)
        const rcExpirationDate = proEntitlement.expirationDate || null;
        setExpirationDate(rcExpirationDate);
        const prodId = (proEntitlement.productIdentifier || '').toLowerCase();
        if (prodId.includes('anual') || prodId.includes('year') || prodId.includes('moeda-pro-anual')) {
          setSubscriptionType('yearly');
        } else {
          setSubscriptionType('monthly');
        }
      } else {
        setSubscriptionType(null);
        setExpirationDate(null);
      }

      Alert.alert(
        'Restauração de Compra',
        active ? 'Sua assinatura Pro foi restaurada com sucesso!' : 'Nenhuma assinatura Pro activa foi localizada.'
      );
      return active;
    } catch (e: any) {
      Alert.alert('Erro', e.message || 'Falha ao restaurar compras.');
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const toggleProMock = useCallback(() => {
    setIsPro((prev) => {
      const next = !prev;
      setSubscriptionType(next ? 'yearly' : null);
      setExpirationDate(next ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() : null);
      return next;
    });
  }, []);

  /** Find a specific package by its RevenueCat identifier across both buckets */
  const getPackageByIdentifier = useCallback((identifier: string): SubscriptionPackage | undefined => {
    return (
      rcPackages.find((p) => p.identifier === identifier) ||
      rcConsumables.find((p) => p.identifier === identifier)
    );
  }, [rcPackages, rcConsumables]);

  const value: SubscriptionContextState = {
    isPro: effectiveIsPro,
    subscriptionType: effectiveSubscriptionType,
    packages: rcPackages,
    consumables: rcConsumables,
    isLoading,
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
