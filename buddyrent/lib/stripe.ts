import { initStripe as initStripeNative, confirmPayment as confirmStripePayment } from '@stripe/stripe-react-native';
import { supabase } from './supabase';

// ─── Constants ──────────────────────────────────────────────────────────────

const PLATFORM_FEE_PERCENT = 0.2; // 20% platform cut
const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY!;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PaymentIntentResult {
  clientSecret: string;
  paymentIntentId: string;
}

export interface FeeBreakdown {
  subtotal: number;      // hourlyRate * hours, in cents
  platformFee: number;   // 20% of subtotal, in cents
  total: number;         // amount charged to seeker, in cents
  buddyEarnings: number; // subtotal minus platform fee, in cents
}

export interface PayoutRecord {
  id: string;
  amount: number;
  currency: string;
  status: string;
  arrivalDate: string;
  bookingId: string;
}

export interface PaymentMethodInput {
  type: 'Card';
  billingDetails?: {
    name?: string;
    email?: string;
  };
}

// ─── Init ─────────────────────────────────────────────────────────────────────

/**
 * Must be called once at app start (e.g. inside _layout.tsx) before any
 * Stripe operations are performed.
 */
export async function initStripe(): Promise<void> {
  await initStripeNative({
    publishableKey: STRIPE_PUBLISHABLE_KEY,
    merchantIdentifier: 'merchant.com.buddyrent', // for Apple Pay
    urlScheme: 'buddyrent',                        // for 3DS redirects
  });
}

// ─── Fee Calculator ───────────────────────────────────────────────────────────

/**
 * Pure calculation — no network calls.
 * All monetary values are in cents (USD default).
 *
 * @param hourlyRate  Rate in cents per hour
 * @param hours       Number of hours booked
 */
export function calculateFees(hourlyRate: number, hours: number): FeeBreakdown {
  const subtotal = Math.round(hourlyRate * hours);
  const platformFee = Math.round(subtotal * PLATFORM_FEE_PERCENT);
  const total = subtotal; // seeker pays the subtotal; fee comes out of buddy's share
  const buddyEarnings = subtotal - platformFee;

  return { subtotal, platformFee, total, buddyEarnings };
}

// ─── Payment Intent ───────────────────────────────────────────────────────────

/**
 * Creates a Stripe PaymentIntent via a Supabase Edge Function.
 * The edge function runs with the service role key so it can safely call
 * the Stripe secret API.
 *
 * @param amount     Amount in cents
 * @param currency   ISO 4217 lowercase (e.g. "usd")
 * @param bookingId  Used for idempotency and metadata
 */
export async function createPaymentIntent(
  amount: number,
  currency: string,
  bookingId: string,
): Promise<PaymentIntentResult> {
  const { data, error } = await supabase.functions.invoke('create-payment-intent', {
    body: { amount, currency, bookingId },
  });

  if (error) {
    throw new Error(`Failed to create payment intent: ${error.message}`);
  }

  if (!data?.clientSecret || !data?.paymentIntentId) {
    throw new Error('Invalid response from payment intent function');
  }

  return {
    clientSecret: data.clientSecret as string,
    paymentIntentId: data.paymentIntentId as string,
  };
}

// ─── Confirm Payment ──────────────────────────────────────────────────────────

/**
 * Confirms a PaymentIntent using the Stripe React Native SDK.
 * Call this after the user picks / enters their payment method.
 *
 * @param clientSecret    From createPaymentIntent()
 * @param paymentMethod   Payment method details
 */
export async function confirmPayment(
  clientSecret: string,
  paymentMethod: PaymentMethodInput,
): Promise<{ paymentIntentId: string }> {
  const { paymentIntent, error } = await confirmStripePayment(clientSecret, {
    paymentMethodType: paymentMethod.type,
    paymentMethodData: {
      billingDetails: paymentMethod.billingDetails,
    },
  });

  if (error) {
    throw new Error(`Payment confirmation failed: ${error.message}`);
  }

  if (!paymentIntent) {
    throw new Error('No payment intent returned after confirmation');
  }

  if (paymentIntent.status !== 'Succeeded') {
    throw new Error(`Payment ended in unexpected status: ${paymentIntent.status}`);
  }

  return { paymentIntentId: paymentIntent.id };
}

// ─── Connect Account (Buddy Onboarding) ───────────────────────────────────────

/**
 * Creates (or retrieves) a Stripe Connect Express account for the current buddy
 * and returns an onboarding URL they can open in a browser/WebView.
 */
export async function createConnectAccount(): Promise<{ accountId: string; onboardingUrl: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Must be signed in to create a Connect account');
  }

  const { data, error } = await supabase.functions.invoke('create-connect-account', {
    body: { userId: user.id, email: user.email },
  });

  if (error) {
    throw new Error(`Failed to create Connect account: ${error.message}`);
  }

  if (!data?.accountId || !data?.onboardingUrl) {
    throw new Error('Invalid response from connect account function');
  }

  return {
    accountId: data.accountId as string,
    onboardingUrl: data.onboardingUrl as string,
  };
}

// ─── Payout History ───────────────────────────────────────────────────────────

/**
 * Fetches payout history for a buddy from the Supabase Edge Function,
 * which proxies the Stripe Connect payouts list API.
 *
 * @param userId  The buddy's user ID
 */
export async function getPayoutHistory(userId: string): Promise<PayoutRecord[]> {
  const { data, error } = await supabase.functions.invoke('get-payout-history', {
    body: { userId },
  });

  if (error) {
    throw new Error(`Failed to fetch payout history: ${error.message}`);
  }

  if (!Array.isArray(data?.payouts)) {
    return [];
  }

  return (data.payouts as any[]).map((p) => ({
    id: p.id,
    amount: p.amount,
    currency: p.currency,
    status: p.status,
    arrivalDate: p.arrival_date
      ? new Date(p.arrival_date * 1000).toISOString()
      : '',
    bookingId: p.metadata?.booking_id ?? '',
  }));
}
