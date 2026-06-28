/**
 * useSubscription Hook — Assistente Moeda (Native Platform)
 *
 * RevenueCat SDK integration for managing subscription state and checkout flows on iOS and Android.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
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
}

const SubscriptionContext = createContext<SubscriptionContextState | null>(null);

const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY || '';

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [isPro, setIsPro] = useState(false);
  const [subscriptionType, setSubscriptionType] = useState<'monthly' | 'yearly' | null>(null);
  const [rcPackages, setRcPackages] = useState<SubscriptionPackage[]>([]);
  const [rcConsumables, setRcConsumables] = useState<SubscriptionPackage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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

  const updateProStatus = useCallback((customerInfo: any) => {
    if (customerInfo && customerInfo.entitlements && customerInfo.entitlements.active) {
      const activeEntitlements = customerInfo.entitlements.active;
      const proEntitlement = activeEntitlements['pro'];
      if (proEntitlement) {
        setIsPro(true);
        const prodId = (proEntitlement.productIdentifier || '').toLowerCase();
        if (prodId.includes('year') || prodId.includes('anual')) {
          setSubscriptionType('yearly');
        } else {
          setSubscriptionType('monthly');
        }
        return;
      }
    }
    setIsPro(false);
    setSubscriptionType(null);
  }, []);

  const fetchOfferings = useCallback(async () => {
    try {
      const offerings = await Purchases.getOfferings();
      if (offerings.current !== null && offerings.current.availablePackages.length > 0) {
        const filtered = offerings.current.availablePackages
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
        setRcPackages(filtered);
      }

      // Consumables offerings
      const tokenOffering = offerings.all['Tokens'] || offerings.all['tokens'];
      if (tokenOffering && tokenOffering.availablePackages.length > 0) {
        const mappedConsumables = tokenOffering.availablePackages.map((pkg: any) => ({
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
        setRcConsumables(mappedConsumables);
      } else {
        if (offerings.current !== null) {
          const customPkgs = offerings.current.availablePackages
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
          setRcConsumables(customPkgs);
        }
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
      const active = !!customerInfo.entitlements.active['pro'];
      setIsPro(active);
      if (active) {
        const prodId = (packageToBuy.product?.identifier || '').toLowerCase();
        if (prodId.includes('year') || prodId.includes('anual') || packageToBuy.packageType === 'YEARLY') {
          setSubscriptionType('yearly');
        } else {
          setSubscriptionType('monthly');
        }
      } else {
        setSubscriptionType(null);
      }
      return active;
    } catch (e: any) {
      if (!e.userCancelled) {
        Alert.alert('Erro', e.message || 'Erro ao processar compra.');
      }
      return false;
    }
  }, []);

  const restorePurchases = useCallback(async (): Promise<boolean> => {
    try {
      const customerInfo = await Purchases.restorePurchases();
      const active = !!customerInfo.entitlements.active['pro'];
      setIsPro(active);
      if (active) {
        const proEntitlement = customerInfo.entitlements.active['pro'];
        const prodId = (proEntitlement.productIdentifier || '').toLowerCase();
        if (prodId.includes('year') || prodId.includes('anual')) {
          setSubscriptionType('yearly');
        } else {
          setSubscriptionType('monthly');
        }
      } else {
        setSubscriptionType(null);
      }
      Alert.alert(
        'Restauração de Compra',
        active ? 'Sua assinatura Pro foi restaurada com sucesso!' : 'Nenhuma assinatura Pro activa foi localizada.'
      );
      return active;
    } catch (e: any) {
      Alert.alert('Erro', e.message || 'Falha ao restaurar compras.');
      return false;
    }
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
    packages: rcPackages,
    consumables: rcConsumables,
    isLoading,
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
