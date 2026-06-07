/**
 * Design-system colour tokens for BuddyRent.
 * Values mirror tailwind.config.js so both RN styles and class names stay in sync.
 */

export const Colors = {
  // ─── Brand: Primary (Warm Orange) ────────────────────────────────────────
  primary: {
    DEFAULT: '#FF6B35',
    50:  '#FFF3EE',
    100: '#FFE4D4',
    200: '#FFC4A3',
    300: '#FF9E6E',
    400: '#FF8250',
    500: '#FF6B35',
    600: '#E5521C',
    700: '#C44016',
    800: '#A33212',
    900: '#7D250D',
  },

  // ─── Brand: Secondary (Teal) ─────────────────────────────────────────────
  secondary: {
    DEFAULT: '#4ECDC4',
    50:  '#EDFCFB',
    100: '#D0F7F5',
    200: '#A1EFEB',
    300: '#6DE4DF',
    400: '#4ECDC4',
    500: '#2DB8AE',
    600: '#1E9B92',
    700: '#197D76',
    800: '#155F5A',
    900: '#0F4542',
  },

  // ─── Surfaces & Backgrounds ──────────────────────────────────────────────
  surface: '#FAFAFA',
  card:    '#FFFFFF',
  overlay: 'rgba(0, 0, 0, 0.5)',

  // ─── Typography ──────────────────────────────────────────────────────────
  textPrimary:   '#1A1A2E',
  textSecondary: '#6B7280',
  textDisabled:  '#9CA3AF',
  textInverse:   '#FFFFFF',

  // ─── Semantic / Utility ──────────────────────────────────────────────────
  accent:  '#A855F7',
  success: '#10B981',
  error:   '#EF4444',
  warning: '#F59E0B',
  info:    '#3B82F6',

  // ─── Neutrals ────────────────────────────────────────────────────────────
  gray: {
    50:  '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
  },

  // ─── Borders ─────────────────────────────────────────────────────────────
  border:        '#E5E7EB',
  borderFocused: '#FF6B35',

  // ─── Stars / Rating ──────────────────────────────────────────────────────
  star:    '#FBBF24',
  starOff: '#D1D5DB',

  // ─── Status indicators ───────────────────────────────────────────────────
  online:  '#10B981',
  offline: '#9CA3AF',

  // ─── Transparent ─────────────────────────────────────────────────────────
  transparent: 'transparent',
} as const;

// Convenience aliases for the most-used tokens
export const {
  primary,
  secondary,
  surface,
  card,
  textPrimary,
  textSecondary,
  accent,
  success,
  error,
  warning,
} = Colors;

export type ColorToken = typeof Colors;
export default Colors;
