import { Platform } from 'react-native';

export async function initRevenueCat() {
  // Web Mockup
}

export async function fetchOfferings() {
  return { current: null, all: {} };
}

export async function purchasePackage(rcPackage: any, userId?: string): Promise<boolean> {
  let paymentLink = '';
  const identifier = rcPackage?.identifier || '';
  const packageType = rcPackage?.packageType || '';

  if (packageType === 'MONTHLY' || identifier === 'moeda_pro:moeda-pro-mensal') {
    paymentLink = process.env.EXPO_PUBLIC_WEB_PAYMENT_LINK_MONTHLY || 'https://buy.stripe.com/mock-monthly';
  } else if (packageType === 'YEARLY' || identifier === 'moeda_pro:moeda-pro-anual') {
    paymentLink = process.env.EXPO_PUBLIC_WEB_PAYMENT_LINK_YEARLY || 'https://buy.stripe.com/mock-yearly';
  } else {
    // Consumable tokens top-up
    paymentLink = process.env.EXPO_PUBLIC_WEB_PAYMENT_LINK_TOKENS || 'https://buy.stripe.com/mock-tokens';
  }

  const url = `${paymentLink}?client_reference_id=${userId || ''}`;
  if (typeof window !== 'undefined') {
    console.log("purchasePackage web: __interceptRedirect flag is:", (window as any).__interceptRedirect);
    if ((window as any).__interceptRedirect) {
      console.log("purchasePackage web: Intercepting redirect URL:", url);
      (window as any).__interceptedRedirectUrl = url;
    } else {
      console.log("purchasePackage web: Navigating to Stripe URL:", url);
      window.location.href = url;
    }
  }
  return false;
}
