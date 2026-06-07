import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types';

// ─── Filter Types ─────────────────────────────────────────────────────────────

export interface DiscoverFilters {
  /** User's current latitude (for distance calculation) */
  latitude?: number;
  /** User's current longitude (for distance calculation) */
  longitude?: number;
  /** Maximum distance radius in kilometres */
  maxDistance: number;
  minAge: number;
  maxAge: number;
  /** Activity IDs to filter by; empty array = no filter */
  activities: string[];
  /** Maximum hourly rate in cents; 0 = no limit */
  maxHourlyRate: number;
  /** Filter to 'buddy', 'seeker', or 'both' */
  role: 'buddy' | 'seeker' | 'both';
}

const DEFAULT_FILTERS: DiscoverFilters = {
  maxDistance: 50,
  minAge: 18,
  maxAge: 99,
  activities: [],
  maxHourlyRate: 0,
  role: 'buddy',
};

// ─── Swipe record (persisted to DB) ──────────────────────────────────────────

type SwipeType = 'like' | 'pass' | 'super_like';

// ─── Store Types ──────────────────────────────────────────────────────────────

interface DiscoverState {
  profiles: Profile[];
  currentIndex: number;
  isLoading: boolean;
  filters: DiscoverFilters;
  error: string | null;
}

interface DiscoverActions {
  loadProfiles(userId: string): Promise<void>;
  swipeRight(profileId: string): Promise<void>;
  swipeLeft(profileId: string): Promise<void>;
  superLike(profileId: string): Promise<void>;
  checkMatch(userId1: string, userId2: string): Promise<boolean>;
  updateFilters(filters: Partial<DiscoverFilters>): void;
  resetProfiles(): void;
  clearError(): void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Map a raw Supabase profiles row to our typed Profile. */
function rowToProfile(data: any): Profile {
  return {
    id: data.id,
    userId: data.id,
    name: data.name ?? '',
    age: data.age ?? 0,
    bio: data.bio ?? '',
    photos: data.photos ?? [],
    activities: data.activities ?? [],
    hourlyRate: data.hourly_rate ?? null,
    role: data.role ?? 'seeker',
    rating: data.average_rating ?? 0,
    reviewCount: data.total_reviews ?? 0,
    location: data.location ?? '',
    isVerified: data.verification_status === 'verified',
    verificationStatus: data.verification_status ?? 'pending',
    isOnline: data.is_online ?? false,
    lastSeen: data.last_seen ?? new Date().toISOString(),
    createdAt: data.created_at ?? new Date().toISOString(),
  };
}

/**
 * Records a swipe action in the `swipes` table.
 * The table is expected to have columns: swiper_id, swipee_id, type, created_at.
 */
async function recordSwipe(
  swiperId: string,
  swipeeId: string,
  type: SwipeType,
): Promise<void> {
  const { error } = await supabase.from('swipes').upsert(
    {
      swiper_id: swiperId,
      swipee_id: swipeeId,
      type,
      created_at: new Date().toISOString(),
    },
    { onConflict: 'swiper_id,swipee_id' },
  );

  if (error) {
    throw new Error(`Failed to record swipe: ${error.message}`);
  }
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useDiscoverStore = create<DiscoverState & DiscoverActions>(
  (set, get) => ({
    // ── initial state ────────────────────────────────────────────────────────
    profiles: [],
    currentIndex: 0,
    isLoading: false,
    filters: DEFAULT_FILTERS,
    error: null,

    // ── actions ──────────────────────────────────────────────────────────────

    clearError() {
      set({ error: null });
    },

    updateFilters(partialFilters) {
      set((state) => ({
        filters: { ...state.filters, ...partialFilters },
      }));
    },

    resetProfiles() {
      set({ profiles: [], currentIndex: 0 });
    },

    async loadProfiles(userId) {
      const { filters } = get();
      set({ isLoading: true, error: null });

      try {
        // 1. Collect IDs already swiped by this user.
        const { data: swipedRows, error: swipedError } = await supabase
          .from('swipes')
          .select('swipee_id')
          .eq('swiper_id', userId);

        if (swipedError) throw swipedError;

        const swipedIds: string[] = (swipedRows ?? []).map(
          (r: any) => r.swipee_id as string,
        );

        // Never show the current user's own card.
        const excludedIds = [...new Set([userId, ...swipedIds])];

        // 2. Build the base query.
        let query = supabase
          .from('profiles')
          .select('*')
          .not('id', 'in', `(${excludedIds.join(',')})`)
          .eq('verification_status', 'verified')
          .gte('age', filters.minAge)
          .lte('age', filters.maxAge)
          .order('is_online', { ascending: false })
          .order('average_rating', { ascending: false })
          .limit(50);

        // 3. Optional filters.
        if (filters.role !== 'both') {
          // 'both' role profiles also match buddy/seeker filters
          query = query.in('role', [filters.role, 'both']);
        }

        if (filters.activities.length > 0) {
          // Profiles whose activities array overlaps with the filter set.
          query = query.overlaps('activities', filters.activities);
        }

        if (filters.maxHourlyRate > 0) {
          query = query.lte('hourly_rate', filters.maxHourlyRate);
        }

        const { data, error } = await query;
        if (error) throw error;

        let profiles: Profile[] = (data ?? []).map(rowToProfile);

        // 4. Client-side distance filter when coordinates are available.
        if (
          filters.latitude !== undefined &&
          filters.longitude !== undefined &&
          filters.maxDistance > 0
        ) {
          const { latitude, longitude, maxDistance } = filters;
          profiles = profiles.filter((p) => {
            const raw = data?.find((r: any) => r.id === p.id);
            if (!raw?.latitude || !raw?.longitude) return true; // include if unknown
            const dist = haversineKm(latitude, longitude, raw.latitude, raw.longitude);
            return dist <= maxDistance;
          });
        }

        set({ profiles, currentIndex: 0, isLoading: false });
      } catch (err: any) {
        set({ isLoading: false, error: err?.message ?? 'Failed to load profiles' });
        throw err;
      }
    },

    async swipeRight(profileId) {
      const { profiles, currentIndex } = get();
      const currentUser = await supabase.auth.getUser();
      const userId = currentUser.data.user?.id;
      if (!userId) throw new Error('Not authenticated');

      // Optimistically advance the card stack.
      set({ currentIndex: currentIndex + 1 });

      try {
        await recordSwipe(userId, profileId, 'like');
        // Check for a mutual match and create a match record if so.
        const matched = await get().checkMatch(userId, profileId);
        if (matched) {
          await supabase.from('matches').insert({
            user_id_1: userId,
            user_id_2: profileId,
            created_at: new Date().toISOString(),
          });
        }
      } catch (err: any) {
        // Roll back optimistic advance on failure.
        set({ currentIndex, error: err?.message ?? 'Swipe right failed' });
        throw err;
      }
    },

    async swipeLeft(profileId) {
      const { currentIndex } = get();
      const currentUser = await supabase.auth.getUser();
      const userId = currentUser.data.user?.id;
      if (!userId) throw new Error('Not authenticated');

      set({ currentIndex: currentIndex + 1 });

      try {
        await recordSwipe(userId, profileId, 'pass');
      } catch (err: any) {
        set({ currentIndex, error: err?.message ?? 'Swipe left failed' });
        throw err;
      }
    },

    async superLike(profileId) {
      const { currentIndex } = get();
      const currentUser = await supabase.auth.getUser();
      const userId = currentUser.data.user?.id;
      if (!userId) throw new Error('Not authenticated');

      set({ currentIndex: currentIndex + 1 });

      try {
        await recordSwipe(userId, profileId, 'super_like');
        // Super likes always create a one-way match (seeker can book without mutual like)
        const matched = await get().checkMatch(userId, profileId);
        if (matched) {
          await supabase.from('matches').insert({
            user_id_1: userId,
            user_id_2: profileId,
            is_super_like: true,
            created_at: new Date().toISOString(),
          });
        }
      } catch (err: any) {
        set({ currentIndex, error: err?.message ?? 'Super like failed' });
        throw err;
      }
    },

    async checkMatch(userId1, userId2) {
      // A match exists when userId2 has swiped right (like or super_like) on userId1.
      const { data, error } = await supabase
        .from('swipes')
        .select('type')
        .eq('swiper_id', userId2)
        .eq('swipee_id', userId1)
        .in('type', ['like', 'super_like'])
        .maybeSingle();

      if (error) {
        throw new Error(`Match check failed: ${error.message}`);
      }

      return data !== null;
    },
  }),
);

// ─── Utility ──────────────────────────────────────────────────────────────────

/** Haversine great-circle distance in kilometres. */
function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
