// ─── Role & Status Enums ────────────────────────────────────────────────────

export type UserRole = 'buddy' | 'seeker' | 'both';

export type VerificationStatus = 'pending' | 'verified' | 'rejected';

export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'completed'
  | 'cancelled'
  | 'disputed';

export type ActivityCategory =
  | 'outdoor'
  | 'social'
  | 'fitness'
  | 'entertainment'
  | 'food'
  | 'learning'
  | 'practical';

// ─── Core Entities ──────────────────────────────────────────────────────────

export interface Profile {
  /** UUID from auth.users */
  id: string;
  /** Matches auth.users.id */
  userId: string;
  name: string;
  age: number;
  bio: string;
  /** Ordered array of photo storage URLs */
  photos: string[];
  /** Activity IDs this user offers / enjoys */
  activities: string[];
  /** Hourly rate in USD; null when the user is seeker-only */
  hourlyRate: number | null;
  role: UserRole;
  /** Average star rating 1–5 */
  rating: number;
  reviewCount: number;
  /** Human-readable city / neighbourhood */
  location: string;
  isVerified: boolean;
  verificationStatus: VerificationStatus;
  isOnline: boolean;
  lastSeen: string; // ISO 8601
  createdAt: string; // ISO 8601
}

export interface Match {
  id: string;
  userId1: string;
  userId2: string;
  createdAt: string; // ISO 8601
  /** Hydrated profile of the *other* user in the match context */
  profile: Profile;
}

export interface Booking {
  id: string;
  seekerId: string;
  buddyId: string;
  activity: string;
  /** ISO 8601 date string (YYYY-MM-DD) */
  date: string;
  /** "HH:mm" 24-hour local time */
  startTime: string;
  /** "HH:mm" 24-hour local time */
  endTime: string;
  /** Duration in hours (decimal allowed, e.g. 1.5) */
  hours: number;
  /** Total charged to seeker in USD cents */
  totalAmount: number;
  /** Platform fee portion in USD cents */
  platformFee: number;
  /** Buddy's net earnings in USD cents */
  buddyEarnings: number;
  status: BookingStatus;
  /** Free-text meeting location or address */
  location: string;
  notes: string;
  /** Daily.co / video-call room URL, populated after confirmation */
  meetingLink: string | null;
  /** Hydrated seeker profile */
  seekerProfile: Profile;
  /** Hydrated buddy profile */
  buddyProfile: Profile;
  createdAt: string; // ISO 8601
}

export interface Message {
  id: string;
  matchId: string;
  senderId: string;
  content: string;
  createdAt: string; // ISO 8601
  isRead: boolean;
}

export interface Review {
  id: string;
  bookingId: string;
  reviewerId: string;
  revieweeId: string;
  /** Integer 1–5 */
  rating: 1 | 2 | 3 | 4 | 5;
  comment: string;
  createdAt: string; // ISO 8601
}

export interface Activity {
  id: string;
  name: string;
  emoji: string;
  category: ActivityCategory;
}

// ─── Auth & Session ──────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  createdAt: string;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: AuthUser;
}

// ─── API / Store Helpers ─────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// ─── UI Helpers ──────────────────────────────────────────────────────────────

export interface FilterOptions {
  activities?: string[];
  minRate?: number;
  maxRate?: number;
  maxDistanceKm?: number;
  minRating?: number;
  verifiedOnly?: boolean;
  onlineOnly?: boolean;
}

export interface SwipeAction {
  direction: 'left' | 'right' | 'up';
  profileId: string;
}

export type NotificationType =
  | 'new_match'
  | 'booking_request'
  | 'booking_confirmed'
  | 'booking_cancelled'
  | 'booking_completed'
  | 'new_message'
  | 'new_review'
  | 'verification_update'
  | 'payment_received';

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
}
