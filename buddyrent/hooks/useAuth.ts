import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import type { Profile } from '../stores/authStore';

// ─── Return Type ──────────────────────────────────────────────────────────────

export interface UseAuthReturn {
  user: { id: string; email: string } | null;
  profile: Profile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Subscribes to Supabase auth state changes and keeps the Zustand auth store
 * in sync.  Call `initialize()` on mount to rehydrate any persisted session.
 *
 * Returns a stable, memoised slice of the auth store so consumers can
 * subscribe without triggering unnecessary re-renders.
 */
export function useAuth(): UseAuthReturn {
  const initialize = useAuthStore((s) => s.initialize);
  const signOut = useAuthStore((s) => s.signOut);

  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const isLoading = useAuthStore((s) => s.isLoading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    // Rehydrate session from AsyncStorage / Supabase persisted state.
    initialize();

    // Subscribe to future auth state changes (sign-in, sign-out, token refresh).
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      switch (event) {
        case 'SIGNED_IN':
          // initialize() re-fetches the profile so the store stays consistent.
          initialize();
          break;

        case 'SIGNED_OUT':
          // Delegate to the store action so all state is cleared atomically.
          signOut().catch(() => {
            // signOut already clears local state; swallow any network error.
          });
          break;

        case 'TOKEN_REFRESHED':
          // Session is still valid; no store action needed — Supabase client
          // handles the new token internally and AsyncStorage is updated via
          // the persistSession option configured in lib/supabase.ts.
          break;

        default:
          break;
      }
    });

    return () => {
      subscription.unsubscribe();
    };
    // initialize and signOut are stable Zustand action references — safe to
    // include in the dependency array without causing infinite loops.
  }, [initialize, signOut]);

  return { user, profile, isLoading, isAuthenticated };
}
