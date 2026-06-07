import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import {
  createPaymentIntent,
  confirmPayment,
  calculateFees,
  type PaymentMethodInput,
} from '../lib/stripe';
import type { Booking, BookingStatus, Review } from '../types';

// ─── Input Types ──────────────────────────────────────────────────────────────

export interface CreateBookingInput {
  buddyId: string;
  /** Activity label, e.g. "Hiking", "Board Games" */
  activity: string;
  /** ISO 8601 date string (YYYY-MM-DD) */
  date: string;
  /** "HH:mm" 24-hour local time */
  startTime: string;
  /** "HH:mm" 24-hour local time */
  endTime: string;
  /** Duration in decimal hours, e.g. 1.5 */
  hours: number;
  /** Buddy's hourly rate in cents */
  hourlyRate: number;
  /** Free-text meeting location */
  location: string;
  notes?: string;
}

export interface SubmitReviewInput {
  rating: 1 | 2 | 3 | 4 | 5;
  comment: string;
}

// ─── Store Types ──────────────────────────────────────────────────────────────

interface BookingState {
  bookings: Booking[];
  activeBooking: Booking | null;
  isLoading: boolean;
  error: string | null;
}

interface BookingActions {
  createBooking(data: CreateBookingInput): Promise<{ bookingId: string; clientSecret: string }>;
  confirmBooking(bookingId: string, paymentMethod: PaymentMethodInput): Promise<void>;
  cancelBooking(bookingId: string, reason: string): Promise<void>;
  completeBooking(bookingId: string): Promise<void>;
  loadMyBookings(userId: string, role: 'seeker' | 'buddy'): Promise<void>;
  loadBookingById(id: string): Promise<void>;
  submitReview(bookingId: string, rating: 1 | 2 | 3 | 4 | 5, comment: string): Promise<void>;
  createVideoCallLink(bookingId: string): Promise<string>;
  clearError(): void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Map a raw Supabase bookings row (with joined profiles) to our typed Booking. */
function rowToBooking(data: any): Booking {
  return {
    id: data.id,
    seekerId: data.seeker_id,
    buddyId: data.buddy_id,
    activity: data.activity,
    date: data.date,
    startTime: data.start_time,
    endTime: data.end_time,
    hours: data.hours,
    totalAmount: data.total_amount,
    platformFee: data.platform_fee,
    buddyEarnings: data.buddy_earnings,
    status: data.status as BookingStatus,
    location: data.location ?? '',
    notes: data.notes ?? '',
    meetingLink: data.meeting_link ?? null,
    seekerProfile: data.seeker_profile ?? null,
    buddyProfile: data.buddy_profile ?? null,
    createdAt: data.created_at,
  };
}

/** Fetch a single booking row with hydrated seeker/buddy profiles. */
async function fetchBooking(id: string): Promise<Booking | null> {
  const { data, error } = await supabase
    .from('bookings')
    .select(
      `
      *,
      seeker_profile:profiles!bookings_seeker_id_fkey(*),
      buddy_profile:profiles!bookings_buddy_id_fkey(*)
      `,
    )
    .eq('id', id)
    .single();

  if (error || !data) return null;
  return rowToBooking(data);
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useBookingStore = create<BookingState & BookingActions>(
  (set, get) => ({
    // ── initial state ────────────────────────────────────────────────────────
    bookings: [],
    activeBooking: null,
    isLoading: false,
    error: null,

    // ── actions ──────────────────────────────────────────────────────────────

    clearError() {
      set({ error: null });
    },

    /**
     * Step 1 of the booking flow: insert a pending booking row and create a
     * Stripe PaymentIntent.  Returns the bookingId + clientSecret so the UI
     * can display the Stripe payment sheet.
     */
    async createBooking(input) {
      set({ isLoading: true, error: null });
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const fees = calculateFees(input.hourlyRate, input.hours);

        // Insert the booking row in "pending" status.
        const { data: row, error: insertError } = await supabase
          .from('bookings')
          .insert({
            seeker_id: user.id,
            buddy_id: input.buddyId,
            activity: input.activity,
            date: input.date,
            start_time: input.startTime,
            end_time: input.endTime,
            hours: input.hours,
            total_amount: fees.total,
            platform_fee: fees.platformFee,
            buddy_earnings: fees.buddyEarnings,
            status: 'pending' satisfies BookingStatus,
            location: input.location,
            notes: input.notes ?? '',
            created_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (insertError || !row) {
          throw insertError ?? new Error('Failed to create booking row');
        }

        // Create a Stripe PaymentIntent tied to this booking.
        const { clientSecret } = await createPaymentIntent(
          fees.total,
          'usd',
          row.id as string,
        );

        // Store the payment-intent client secret on the booking row.
        await supabase
          .from('bookings')
          .update({ stripe_client_secret: clientSecret })
          .eq('id', row.id);

        const booking = await fetchBooking(row.id as string);
        set((state) => ({
          bookings: booking
            ? [booking, ...state.bookings]
            : state.bookings,
          activeBooking: booking,
          isLoading: false,
        }));

        return { bookingId: row.id as string, clientSecret };
      } catch (err: any) {
        set({ isLoading: false, error: err?.message ?? 'Failed to create booking' });
        throw err;
      }
    },

    /**
     * Step 2: charge the card and transition booking to "confirmed".
     */
    async confirmBooking(bookingId, paymentMethod) {
      set({ isLoading: true, error: null });
      try {
        // Retrieve the client secret stored during createBooking.
        const { data: row, error: fetchError } = await supabase
          .from('bookings')
          .select('stripe_client_secret')
          .eq('id', bookingId)
          .single();

        if (fetchError || !row?.stripe_client_secret) {
          throw fetchError ?? new Error('No client secret found for booking');
        }

        await confirmPayment(row.stripe_client_secret as string, paymentMethod);

        const { error: updateError } = await supabase
          .from('bookings')
          .update({ status: 'confirmed' satisfies BookingStatus })
          .eq('id', bookingId);

        if (updateError) throw updateError;

        const booking = await fetchBooking(bookingId);
        set((state) => ({
          bookings: state.bookings.map((b) =>
            b.id === bookingId && booking ? booking : b,
          ),
          activeBooking:
            state.activeBooking?.id === bookingId
              ? (booking ?? state.activeBooking)
              : state.activeBooking,
          isLoading: false,
        }));
      } catch (err: any) {
        set({ isLoading: false, error: err?.message ?? 'Payment confirmation failed' });
        throw err;
      }
    },

    async cancelBooking(bookingId, reason) {
      set({ isLoading: true, error: null });
      try {
        const { error } = await supabase
          .from('bookings')
          .update({
            status: 'cancelled' satisfies BookingStatus,
            cancellation_reason: reason,
            cancelled_at: new Date().toISOString(),
          })
          .eq('id', bookingId);

        if (error) throw error;

        const booking = await fetchBooking(bookingId);
        set((state) => ({
          bookings: state.bookings.map((b) =>
            b.id === bookingId && booking ? booking : b,
          ),
          activeBooking:
            state.activeBooking?.id === bookingId
              ? (booking ?? state.activeBooking)
              : state.activeBooking,
          isLoading: false,
        }));
      } catch (err: any) {
        set({ isLoading: false, error: err?.message ?? 'Failed to cancel booking' });
        throw err;
      }
    },

    async completeBooking(bookingId) {
      set({ isLoading: true, error: null });
      try {
        const { error } = await supabase
          .from('bookings')
          .update({
            status: 'completed' satisfies BookingStatus,
            completed_at: new Date().toISOString(),
          })
          .eq('id', bookingId);

        if (error) throw error;

        const booking = await fetchBooking(bookingId);
        set((state) => ({
          bookings: state.bookings.map((b) =>
            b.id === bookingId && booking ? booking : b,
          ),
          activeBooking:
            state.activeBooking?.id === bookingId
              ? (booking ?? state.activeBooking)
              : state.activeBooking,
          isLoading: false,
        }));
      } catch (err: any) {
        set({ isLoading: false, error: err?.message ?? 'Failed to complete booking' });
        throw err;
      }
    },

    async loadMyBookings(userId, role) {
      set({ isLoading: true, error: null });
      try {
        const column = role === 'seeker' ? 'seeker_id' : 'buddy_id';

        const { data, error } = await supabase
          .from('bookings')
          .select(
            `
            *,
            seeker_profile:profiles!bookings_seeker_id_fkey(*),
            buddy_profile:profiles!bookings_buddy_id_fkey(*)
            `,
          )
          .eq(column, userId)
          .order('created_at', { ascending: false });

        if (error) throw error;

        const bookings = (data ?? []).map(rowToBooking);
        set({ bookings, isLoading: false });
      } catch (err: any) {
        set({ isLoading: false, error: err?.message ?? 'Failed to load bookings' });
        throw err;
      }
    },

    async loadBookingById(id) {
      set({ isLoading: true, error: null });
      try {
        const booking = await fetchBooking(id);
        if (!booking) throw new Error(`Booking ${id} not found`);

        set((state) => {
          const exists = state.bookings.some((b) => b.id === id);
          return {
            bookings: exists
              ? state.bookings.map((b) => (b.id === id ? booking : b))
              : [booking, ...state.bookings],
            activeBooking: booking,
            isLoading: false,
          };
        });
      } catch (err: any) {
        set({ isLoading: false, error: err?.message ?? 'Failed to load booking' });
        throw err;
      }
    },

    async submitReview(bookingId, rating, comment) {
      set({ isLoading: true, error: null });
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        // Determine who is being reviewed.
        const booking = get().bookings.find((b) => b.id === bookingId)
          ?? (await fetchBooking(bookingId));
        if (!booking) throw new Error('Booking not found');

        const revieweeId =
          booking.seekerId === user.id ? booking.buddyId : booking.seekerId;

        const { error } = await supabase.from('reviews').insert({
          booking_id: bookingId,
          reviewer_id: user.id,
          reviewee_id: revieweeId,
          rating,
          comment,
          created_at: new Date().toISOString(),
        });

        if (error) throw error;

        // Recalculate the reviewee's average rating via RPC (if defined) or inline.
        await supabase.rpc('refresh_profile_rating', { p_user_id: revieweeId });

        set({ isLoading: false });
      } catch (err: any) {
        set({ isLoading: false, error: err?.message ?? 'Failed to submit review' });
        throw err;
      }
    },

    /**
     * Generates (or retrieves) a Daily.co video-call room for the booking and
     * persists the URL on the booking row.  Returns the room URL.
     */
    async createVideoCallLink(bookingId) {
      set({ isLoading: true, error: null });
      try {
        // Check if a link already exists.
        const { data: row, error: fetchError } = await supabase
          .from('bookings')
          .select('meeting_link')
          .eq('id', bookingId)
          .single();

        if (fetchError) throw fetchError;
        if (row?.meeting_link) {
          set({ isLoading: false });
          return row.meeting_link as string;
        }

        // Invoke a Supabase Edge Function that calls the Daily.co REST API.
        const { data, error } = await supabase.functions.invoke('create-video-room', {
          body: { bookingId },
        });

        if (error) throw new Error(`Failed to create video room: ${error.message}`);
        if (!data?.roomUrl) throw new Error('No room URL returned from video function');

        const roomUrl = data.roomUrl as string;

        // Persist the link on the booking row.
        await supabase
          .from('bookings')
          .update({ meeting_link: roomUrl })
          .eq('id', bookingId);

        // Update local state.
        set((state) => ({
          bookings: state.bookings.map((b) =>
            b.id === bookingId ? { ...b, meetingLink: roomUrl } : b,
          ),
          activeBooking:
            state.activeBooking?.id === bookingId
              ? { ...state.activeBooking, meetingLink: roomUrl }
              : state.activeBooking,
          isLoading: false,
        }));

        return roomUrl;
      } catch (err: any) {
        set({ isLoading: false, error: err?.message ?? 'Failed to create video call link' });
        throw err;
      }
    },
  }),
);
