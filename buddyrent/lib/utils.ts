/**
 * Utility functions for BuddyRent
 */

// ─── Class Name Merger ────────────────────────────────────────────────────────

/**
 * Simple class name merger compatible with NativeWind v4.
 * Filters out falsy values and joins with a space.
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

// ─── Currency ────────────────────────────────────────────────────────────────

/**
 * Format a number as USD currency.
 * @example formatCurrency(12.5) → "$12.50"
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// ─── Hours ───────────────────────────────────────────────────────────────────

/**
 * Format a number of hours for display.
 * @example formatHours(2) → "2 hrs"
 * @example formatHours(2.5) → "2.5 hrs"
 * @example formatHours(1) → "1 hr"
 */
export function formatHours(hours: number): string {
  const label = hours === 1 ? 'hr' : 'hrs';
  const display = hours % 1 === 0 ? hours.toString() : hours.toFixed(1);
  return `${display} ${label}`;
}

// ─── Age ─────────────────────────────────────────────────────────────────────

/**
 * Calculate age from a date of birth.
 * @param dob Date object or ISO 8601 string
 */
export function calculateAge(dob: Date | string): number {
  const birthDate = typeof dob === 'string' ? new Date(dob) : dob;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age -= 1;
  }
  return age;
}

// ─── Initials ─────────────────────────────────────────────────────────────────

/**
 * Extract up to two initials from a full name.
 * @example getInitials("John Doe") → "JD"
 * @example getInitials("Madonna") → "M"
 */
export function getInitials(name: string): string {
  if (!name || !name.trim()) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ─── Text ─────────────────────────────────────────────────────────────────────

/**
 * Truncate text to a maximum length, appending "…" if truncated.
 */
export function truncateText(text: string, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1) + '…';
}

// ─── Relative Time ────────────────────────────────────────────────────────────

/**
 * Format a date as a human-friendly relative time string.
 * @example formatRelativeTime(new Date()) → "Just now"
 * @example formatRelativeTime(twoHoursAgo) → "2 hours ago"
 */
export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);

  if (diffSeconds < 30) return 'Just now';
  if (diffSeconds < 60) return `${diffSeconds} seconds ago`;

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return diffMinutes === 1 ? '1 minute ago' : `${diffMinutes} minutes ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return diffDays === 1 ? 'Yesterday' : `${diffDays} days ago`;
  }

  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 5) {
    return diffWeeks === 1 ? '1 week ago' : `${diffWeeks} weeks ago`;
  }

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) {
    return diffMonths === 1 ? '1 month ago' : `${diffMonths} months ago`;
  }

  const diffYears = Math.floor(diffDays / 365);
  return diffYears === 1 ? '1 year ago' : `${diffYears} years ago`;
}

// ─── Distance ────────────────────────────────────────────────────────────────

/**
 * Calculate the great-circle distance between two coordinates using the
 * Haversine formula.
 * @returns Distance in miles (rounded to one decimal place)
 */
export function distanceBetween(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 3958.8; // Earth radius in miles
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}
