import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';

// ─── Domain Types ─────────────────────────────────────────────────────────────

export type Role = 'seeker' | 'buddy';
export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';

export interface Profile {
  id: string;
  email: string;
  name: string;
  dob: string;           // ISO date string
  role: Role;
  bio: string;
  photos: string[];      // public URLs from Supabase storage
  activities: string[];  // e.g. ['hiking', 'gaming', 'coffee']
  hourlyRate: number;    // in cents; 0 for seekers
  location: string;
  latitude: number | null;
  longitude: number | null;
  verificationStatus: VerificationStatus;
  stripeConnectAccountId: string | null;
  averageRating: number;
  totalReviews: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Store Types ──────────────────────────────────────────────────────────────

interface AuthState {
  user: { id: string; email: string } | null;
  profile: Profile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  verificationStatus: VerificationStatus;
  error: string | null;
}

interface AuthActions {
  signUp(email: string, password: string, name: string, dob: string): Promise<void>;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  updateProfile(updates: Partial<Profile>): Promise<void>;
  uploadPhoto(uri: string, index: number): Promise<string>;
  submitVerification(idPhotoUri: string, selfieUri: string): Promise<void>;
  initialize(): Promise<void>;
  clearError(): void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert a local file URI to a base64 string, then to an ArrayBuffer. */
async function uriToArrayBuffer(uri: string): Promise<ArrayBuffer> {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return decode(base64);
}

/** Derive MIME type from file extension (good-enough for photo uploads). */
function mimeTypeFromUri(uri: string): string {
  const ext = uri.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    heic: 'image/heic',
  };
  return map[ext ?? ''] ?? 'image/jpeg';
}

/** Fetch the profile row for a given user ID. */
async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    email: data.email,
    name: data.name,
    dob: data.dob,
    role: data.role,
    bio: data.bio ?? '',
    photos: data.photos ?? [],
    activities: data.activities ?? [],
    hourlyRate: data.hourly_rate ?? 0,
    location: data.location ?? '',
    latitude: data.latitude ?? null,
    longitude: data.longitude ?? null,
    verificationStatus: data.verification_status ?? 'unverified',
    stripeConnectAccountId: data.stripe_connect_account_id ?? null,
    averageRating: data.average_rating ?? 0,
    totalReviews: data.total_reviews ?? 0,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthState & AuthActions>((set, get) => ({
  // ── initial state ──────────────────────────────────────────────────────────
  user: null,
  profile: null,
  isLoading: false,
  isAuthenticated: false,
  verificationStatus: 'unverified',
  error: null,

  // ── actions ────────────────────────────────────────────────────────────────

  clearError() {
    set({ error: null });
  },

  async initialize() {
    set({ isLoading: true, error: null });
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        set({ isLoading: false, isAuthenticated: false });
        return;
      }

      const user = { id: session.user.id, email: session.user.email! };
      const profile = await fetchProfile(session.user.id);

      set({
        user,
        profile,
        isAuthenticated: true,
        verificationStatus: profile?.verificationStatus ?? 'unverified',
        isLoading: false,
      });
    } catch (err: any) {
      set({ isLoading: false, error: err?.message ?? 'Initialization failed' });
    }
  },

  async signUp(email, password, name, dob) {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      if (!data.user) throw new Error('Sign-up did not return a user');

      // Create initial profile row (trigger may also do this — upsert is safe)
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: data.user.id,
        email,
        name,
        dob,
        role: 'seeker',
        verification_status: 'unverified',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (profileError) throw profileError;

      const profile = await fetchProfile(data.user.id);
      set({
        user: { id: data.user.id, email: data.user.email! },
        profile,
        isAuthenticated: true,
        verificationStatus: 'unverified',
        isLoading: false,
      });
    } catch (err: any) {
      set({ isLoading: false, error: err?.message ?? 'Sign-up failed' });
      throw err;
    }
  },

  async signIn(email, password) {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data.user) throw new Error('Sign-in did not return a user');

      const profile = await fetchProfile(data.user.id);
      set({
        user: { id: data.user.id, email: data.user.email! },
        profile,
        isAuthenticated: true,
        verificationStatus: profile?.verificationStatus ?? 'unverified',
        isLoading: false,
      });
    } catch (err: any) {
      set({ isLoading: false, error: err?.message ?? 'Sign-in failed' });
      throw err;
    }
  },

  async signOut() {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      set({
        user: null,
        profile: null,
        isAuthenticated: false,
        verificationStatus: 'unverified',
        isLoading: false,
      });
    } catch (err: any) {
      set({ isLoading: false, error: err?.message ?? 'Sign-out failed' });
      throw err;
    }
  },

  async updateProfile(updates) {
    const { user } = get();
    if (!user) throw new Error('Not authenticated');

    set({ isLoading: true, error: null });
    try {
      // Map camelCase Profile fields → snake_case DB columns where needed
      const dbUpdates: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.bio !== undefined) dbUpdates.bio = updates.bio;
      if (updates.role !== undefined) dbUpdates.role = updates.role;
      if (updates.photos !== undefined) dbUpdates.photos = updates.photos;
      if (updates.activities !== undefined) dbUpdates.activities = updates.activities;
      if (updates.hourlyRate !== undefined) dbUpdates.hourly_rate = updates.hourlyRate;
      if (updates.location !== undefined) dbUpdates.location = updates.location;
      if (updates.latitude !== undefined) dbUpdates.latitude = updates.latitude;
      if (updates.longitude !== undefined) dbUpdates.longitude = updates.longitude;

      const { error } = await supabase
        .from('profiles')
        .update(dbUpdates)
        .eq('id', user.id);

      if (error) throw error;

      const refreshed = await fetchProfile(user.id);
      set({
        profile: refreshed,
        verificationStatus: refreshed?.verificationStatus ?? 'unverified',
        isLoading: false,
      });
    } catch (err: any) {
      set({ isLoading: false, error: err?.message ?? 'Profile update failed' });
      throw err;
    }
  },

  async uploadPhoto(uri, index) {
    const { user } = get();
    if (!user) throw new Error('Not authenticated');

    const arrayBuffer = await uriToArrayBuffer(uri);
    const contentType = mimeTypeFromUri(uri);
    const ext = contentType.split('/')[1];
    const path = `${user.id}/photo_${index}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('profile-photos')
      .upload(path, arrayBuffer, { contentType, upsert: true });

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage
      .from('profile-photos')
      .getPublicUrl(path);

    const publicUrl = publicUrlData.publicUrl;

    // Update the photos array in the profile
    const currentPhotos = get().profile?.photos ?? [];
    const updated = [...currentPhotos];
    updated[index] = publicUrl;

    await get().updateProfile({ photos: updated });

    return publicUrl;
  },

  async submitVerification(idPhotoUri, selfieUri) {
    const { user } = get();
    if (!user) throw new Error('Not authenticated');

    set({ isLoading: true, error: null });
    try {
      // Upload ID photo
      const idBuffer = await uriToArrayBuffer(idPhotoUri);
      const idMime = mimeTypeFromUri(idPhotoUri);
      const idExt = idMime.split('/')[1];
      const idPath = `${user.id}/verification/id.${idExt}`;

      const { error: idError } = await supabase.storage
        .from('verification-docs')
        .upload(idPath, idBuffer, { contentType: idMime, upsert: true });
      if (idError) throw idError;

      // Upload selfie
      const selfieBuffer = await uriToArrayBuffer(selfieUri);
      const selfieMime = mimeTypeFromUri(selfieUri);
      const selfieExt = selfieMime.split('/')[1];
      const selfiePath = `${user.id}/verification/selfie.${selfieExt}`;

      const { error: selfieError } = await supabase.storage
        .from('verification-docs')
        .upload(selfiePath, selfieBuffer, { contentType: selfieMime, upsert: true });
      if (selfieError) throw selfieError;

      // Mark profile as pending review
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          verification_status: 'pending',
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);
      if (updateError) throw updateError;

      set((state) => ({
        profile: state.profile
          ? { ...state.profile, verificationStatus: 'pending' }
          : null,
        verificationStatus: 'pending',
        isLoading: false,
      }));
    } catch (err: any) {
      set({ isLoading: false, error: err?.message ?? 'Verification submission failed' });
      throw err;
    }
  },
}));
