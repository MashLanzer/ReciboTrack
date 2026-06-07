/**
 * Application-wide configuration constants for BuddyRent.
 * All monetary values are in USD unless otherwise noted.
 */

// ─── Pricing & Fees ──────────────────────────────────────────────────────────

/** Percentage of each booking total retained by the platform (0–100). */
export const PLATFORM_FEE_PERCENT = 20;

/** Minimum hourly rate a buddy can set, in USD. */
export const MIN_HOURLY_RATE = 15;

/** Maximum hourly rate a buddy can set, in USD. */
export const MAX_HOURLY_RATE = 100;

// ─── User Age Rules ───────────────────────────────────────────────────────────

/** Absolute minimum age for registration (enforced server-side). */
export const MIN_AGE = 18;

/**
 * Absolute maximum age for registration (enforced server-side).
 * Note: marketing materials display the range as 18–35.
 */
export const MAX_AGE = 30;

/** Age range shown to users in the UI (may differ from enforced limits). */
export const DISPLAY_AGE_RANGE = '18–35';

// ─── Booking Rules ───────────────────────────────────────────────────────────

/**
 * Minimum number of hours in advance a booking must be made.
 * Prevents last-minute bookings that buddies can't prepare for.
 */
export const BOOKING_ADVANCE_HOURS = 2;

/** Maximum duration for a single booking session, in hours. */
export const MAX_BOOKING_HOURS = 8;

/** Minimum duration for a single booking session, in hours. */
export const MIN_BOOKING_HOURS = 1;

// ─── Verification ────────────────────────────────────────────────────────────

/**
 * When true, buddies must complete a short live video verification call
 * before their profile is made visible to seekers.
 */
export const VIDEO_CALL_REQUIRED = true;

/** Number of photos each user must upload during onboarding. */
export const REQUIRED_PHOTO_COUNT = 2;

/** Maximum number of profile photos a user can upload. */
export const MAX_PHOTO_COUNT = 6;

// ─── App Identity ─────────────────────────────────────────────────────────────

export const APP_NAME = 'BuddyRent';

export const SUPPORT_EMAIL = 'support@buddyrent.com';

export const APP_TAGLINE = 'Find your perfect activity buddy';

export const PRIVACY_POLICY_URL = 'https://buddyrent.com/privacy';

export const TERMS_OF_SERVICE_URL = 'https://buddyrent.com/terms';

// ─── Pagination ──────────────────────────────────────────────────────────────

/** Default number of profiles returned per discover page. */
export const PROFILES_PER_PAGE = 20;

/** Default number of messages loaded per chat page. */
export const MESSAGES_PER_PAGE = 30;

/** Default number of bookings loaded per page in history views. */
export const BOOKINGS_PER_PAGE = 15;

// ─── Matching ────────────────────────────────────────────────────────────────

/** Default maximum radius (km) for nearby buddy discovery. */
export const DEFAULT_SEARCH_RADIUS_KM = 50;

/** Maximum allowed search radius (km). */
export const MAX_SEARCH_RADIUS_KM = 200;

// ─── Computed helpers ─────────────────────────────────────────────────────────

/**
 * Given a total booking amount in USD, returns the platform fee and buddy
 * earnings split (all values in USD, rounded to 2 decimal places).
 *
 * @example
 * calculateSplit(100) // { platformFee: 20, buddyEarnings: 80, total: 100 }
 */
export function calculateSplit(totalAmountUsd: number): {
  platformFee: number;
  buddyEarnings: number;
  total: number;
} {
  const platformFee = parseFloat(
    ((totalAmountUsd * PLATFORM_FEE_PERCENT) / 100).toFixed(2)
  );
  const buddyEarnings = parseFloat((totalAmountUsd - platformFee).toFixed(2));
  return { platformFee, buddyEarnings, total: totalAmountUsd };
}

/**
 * Calculate the total booking cost from an hourly rate and number of hours.
 */
export function calculateBookingTotal(
  hourlyRateUsd: number,
  hours: number
): number {
  return parseFloat((hourlyRateUsd * hours).toFixed(2));
}
