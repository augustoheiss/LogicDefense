/**
 * useSubscription Hook — Assistente Moeda (Native Platform)
 *
 * RevenueCat SDK integration for managing subscription state and checkout flows on iOS and Android.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Platform, Alert } from 'react-native';
import Purchases from 'react-native-purchases';
import { useAuthContext } from './useAuth';
import { supabase } from '../lib/supabase';

export interface SubscriptionPackage {
  identifier: string;
  packageType: string;
  product: {
    priceString: string;
    price: number;
    title: string;
    description: string;
  };
  _rcOriginalPackage?: any;
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
  expirationDate: string | null;
  /** Find a specific package by its RevenueCat identifier (e.g. 'moeda_tokens_100k') */
  getPackageByIdentifier: (identifier: string) => SubscriptionPackage | undefined;
}

const SubscriptionContext = createContext<SubscriptionContextState | null>(null);

const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY || '';

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [isPro, setIsPro] = useState(false);
  const [subscriptionType, setSubscriptionType] = useState<'monthly' | 'yearly' | null>(null);
  const [expirationDate, setExpirationDate] = useState<string | null>(null);
  const [rcPackages, setRcPackages] = useState<SubscriptionPackage[]>([]);
  const [rcConsumables, setRcConsumables] = useState<SubscriptionPackage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showPaywall, setShowPaywall] = useState(false);

  const auth = useAuthContext();

  const isReviewer = useMemo(() => {
    return !!(
      auth.user?.email && auth.user.email.toLowerCase() === 'augustotester@gmail.com'
    );
  }, [auth.user]);

  const isPremiumUser = auth.profile?.premiumTier === 'premium';
  const effectiveIsPro = isReviewer ? true : (isPro || isPremiumUser);
  const effectiveSubscriptionType = isReviewer ? 'yearly' : (subscriptionType || (auth.profile?.subscriptionType as 'monthly' | 'yearly') || (isPremiumUser ? 'monthly' : null));
  const effectiveExpirationDate = isReviewer ? null : (expirationDate || auth.profile?.subscriptionExpiresAt || null);

  const isReconciling = useRef(false);

  const syncStates = useCallback(async (active: boolean, plan: 'monthly' | 'yearly' | null) => {
    if (auth.mode !== 'authenticated' || !auth.user || isReconciling.current) return;

    const isDbPremium = auth.profile?.premiumTier === 'premium';
    const dbExpiresAt = auth.profile?.subscriptionExpiresAt;
    
    // Check if Stripe is active (expires in the future or no expiration date set yet)
    let isStripeActive = false;
    if (dbExpiresAt) {
      try {
        isStripeActive = new Date(dbExpiresAt).getTime() > Date.now();
      } catch (e) {
        console.warn('Error parsing expiration date:', e);
      }
    } else if (isDbPremium) {
      isStripeActive = true; // Lifetime/admin bypass
    }

    if (active) {
      // Case 1: RevenueCat is active but DB is free. Upgrade DB.
      if (!isDbPremium) {
        console.log('Reconciler: RevenueCat active but DB free. Upgrading DB...');
        isReconciling.current = true;
        try {
          const { error: profileErr } = await supabase
            .from('profiles')
            .update({
              premium_tier: 'premium',
              subscription_expires_at: expirationDate, // Send direct timestamp from RevenueCat
              updated_at: new Date().toISOString()
            })
            .eq('id', auth.user.id);

          if (profileErr) throw profileErr;

          const { error: settingsErr } = await supabase
            .from('user_settings')
            .update({
              subscription_type: plan || 'monthly',
              expires_at: expirationDate, // Send direct timestamp directly to user_settings
              updated_at: new Date().toISOString()
            })
            .eq('id', auth.user.id);

          if (settingsErr) throw settingsErr;

          await auth.refreshProfile();
        } catch (e) {
          console.error('Reconciler: Failed to upgrade DB:', e);
        } finally {
          isReconciling.current = false;
        }
      }
    } else {
      // Case 2: RevenueCat is inactive, DB says premium, and Stripe is NOT active. Downgrade DB.
      if (isDbPremium && !isStripeActive) {
        console.log('Reconciler: RevenueCat inactive and no Stripe fallback. Downgrading DB...');
        isReconciling.current = true;
        try {
          const { error: profileErr } = await supabase
            .from('profiles')
            .update({
              premium_tier: 'free',
              subscription_expires_at: null,
              updated_at: new Date().toISOString()
            })
            .eq('id', auth.user.id);

          if (profileErr) throw profileErr;

          const { error: settingsErr } = await supabase
            .from('user_settings')
            .update({
              subscription_type: 'free',
              expires_at: null,
              updated_at: new Date().toISOString()
            })
            .eq('id', auth.user.id);

          if (settingsErr) throw settingsErr;

          await auth.refreshProfile();
        } catch (e) {
          console.error('Reconciler: Failed to downgrade DB:', e);
        } finally {
          isReconciling.current = false;
        }
      }
    }
  }, [auth.mode, auth.user?.id, auth.profile, expirationDate, auth.refreshProfile]);

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
        // Extract expiresDate or expirationDate directly from the RevenueCat entitlement object
        const rcExpirationDate = proEntitlement.expiresDate || proEntitlement.expirationDate || null;
        setExpirationDate(rcExpirationDate);
        const prodId = (proEntitlement.productIdentifier || '').toLowerCase();
        // Explicit matching: 'moeda-pro-anual' → yearly, 'moeda-pro-mensal' → monthly
        if (prodId.includes('anual') || prodId.includes('year')) {
          setSubscriptionType('yearly');
        } else if (prodId.includes('mensal') || prodId.includes('month')) {
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
    try {
      const offerings = await Purchases.getOfferings();
      const currentOffering = offerings.current;

      if (currentOffering !== null && currentOffering.availablePackages.length > 0) {
        const allPackages = currentOffering.availablePackages;

        // ── Clean bucket split from the 'default' offering ──────────────
        // Bucket 1: Subscriptions (MONTHLY / YEARLY)
        const subscriptions = allPackages
          .filter((pkg: any) => pkg.packageType === 'MONTHLY' || pkg.packageType === 'YEARLY')
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

        // Bucket 2: Consumables (CUSTOM packages like 'moeda_tokens_100k')
        const consumables = allPackages
          .filter((pkg: any) => pkg.packageType !== 'MONTHLY' && pkg.packageType !== 'YEARLY')
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
      try {
        Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
        if (Platform.OS === 'android') {
          Purchases.configure({ apiKey: GOOGLE_API_KEY });
        } else if (Platform.OS === 'ios') {
          Purchases.configure({ apiKey: GOOGLE_API_KEY });
        } else {
          Purchases.configure({ apiKey: GOOGLE_API_KEY });
        }

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
      await fetchOfferings();
    }
    init();
  }, [updateProStatus, fetchOfferings]);

  const purchasePackage = useCallback(async (pkg: any): Promise<boolean> => {
    try {
      const packageToBuy = pkg._rcOriginalPackage || pkg;
      const { customerInfo } = await Purchases.purchasePackage(packageToBuy);
      const activeEntitlements = customerInfo.entitlements.active;
      const proEntitlement = activeEntitlements['pro'];
      const active = !!proEntitlement;
      setIsPro(active);
      if (active) {
        // Extract expiresDate or expirationDate directly from the RevenueCat entitlement object
        const rcExpirationDate = (proEntitlement as any).expiresDate || proEntitlement.expirationDate || null;
        setExpirationDate(rcExpirationDate);
        
        const prodId = (packageToBuy.product?.identifier || '').toLowerCase();
        if (prodId.includes('year') || prodId.includes('anual') || packageToBuy.packageType === 'YEARLY') {
          setSubscriptionType('yearly');
        } else {
          setSubscriptionType('monthly');
        }
      } else {
        setSubscriptionType(null);
        setExpirationDate(null);
      }

      // Active purchase trigger fallback: refresh Supabase state
      await auth.refreshProfile();

      return active;
    } catch (e: any) {
      if (!e.userCancelled) {
        Alert.alert('Erro', e.message || 'Erro ao processar compra.');
      }
      return false;
    }
  }, [auth.refreshProfile]);

  const restorePurchases = useCallback(async (): Promise<boolean> => {
    try {
      const customerInfo = await Purchases.restorePurchases();
      const activeEntitlements = customerInfo.entitlements.active;
      const proEntitlement = activeEntitlements['pro'];
      const active = !!proEntitlement;
      setIsPro(active);
      if (active) {
        // Extract expiresDate or expirationDate directly from the RevenueCat entitlement object
        const rcExpirationDate = (proEntitlement as any).expiresDate || proEntitlement.expirationDate || null;
        setExpirationDate(rcExpirationDate);
        const prodId = (proEntitlement.productIdentifier || '').toLowerCase();
        if (prodId.includes('year') || prodId.includes('anual')) {
          setSubscriptionType('yearly');
        } else {
          setSubscriptionType('monthly');
        }
      } else {
        setSubscriptionType(null);
        setExpirationDate(null);
      }

      // Active purchase trigger fallback: refresh Supabase state
      await auth.refreshProfile();

      Alert.alert(
        'Restauração de Compra',
        active ? 'Sua assinatura Pro foi restaurada com sucesso!' : 'Nenhuma assinatura Pro activa foi localizada.'
      );
      return active;
    } catch (e: any) {
      Alert.alert('Erro', e.message || 'Falha ao restaurar compras.');
      return false;
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
