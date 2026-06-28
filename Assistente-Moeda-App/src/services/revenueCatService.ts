import Purchases, { PurchasesOffering, PurchasesPackage, CustomerInfo } from 'react-native-purchases';
import { Platform } from 'react-native';

const REVENUECAT_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY || '';

export async function initRevenueCat() {
  if (Platform.OS === 'web') return;
  try {
    Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
    Purchases.configure({ apiKey: REVENUECAT_API_KEY });
  } catch (e) {
    console.error("Failed to initialize RevenueCat:", e);
  }
}

export async function fetchOfferings() {
  if (Platform.OS === 'web') return { current: null, all: {} };
  try {
    const offerings = await Purchases.getOfferings();
    return offerings;
  } catch (e) {
    console.error("Failed to fetch RevenueCat offerings:", e);
  }
  return { current: null, all: {} };
}

export async function purchasePackage(rcPackage: PurchasesPackage): Promise<CustomerInfo | null> {
  if (Platform.OS === 'web') return null;
  try {
    const packageToBuy = (rcPackage as any)._rcOriginalPackage || rcPackage;
    const { customerInfo } = await Purchases.purchasePackage(packageToBuy);
    return customerInfo;
  } catch (e: any) {
    if (!e.userCancelled) {
      console.error("Purchase Error:", e);
      throw e;
    }
    return null;
  }
}
