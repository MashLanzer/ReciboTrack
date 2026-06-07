-- ============================================================
-- BuddyRent - Row Level Security Policies
-- Migration: 002_rls_policies.sql
-- Description: Enables RLS on every table and defines the
--              fine-grained access policies that enforce the
--              data-ownership model.
-- ============================================================

-- ============================================================
-- profiles
-- · Anyone can read active, non-banned profiles (discovery).
-- · Each user has full read/write access to their own row.
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Public can see active, non-banned profiles
CREATE POLICY "profiles_public_read"
  ON profiles FOR SELECT
  USING (is_active = TRUE AND is_banned = FALSE);

-- A user can always read their own profile (even if inactive/banned)
CREATE POLICY "profiles_own_read"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- A user can insert only their own profile row
CREATE POLICY "profiles_own_insert"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- A user can update only their own profile row
CREATE POLICY "profiles_own_update"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- A user can delete only their own profile row
CREATE POLICY "profiles_own_delete"
  ON profiles FOR DELETE
  USING (auth.uid() = id);

-- ============================================================
-- swipes
-- · Users can insert/read only their own swipes.
-- ============================================================
ALTER TABLE swipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "swipes_own_insert"
  ON swipes FOR INSERT
  WITH CHECK (auth.uid() = swiper_id);

CREATE POLICY "swipes_own_read"
  ON swipes FOR SELECT
  USING (auth.uid() = swiper_id);

-- ============================================================
-- matches
-- · Only the two matched users can see the match record.
-- ============================================================
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "matches_participants_read"
  ON matches FOR SELECT
  USING (
    auth.uid() = user_id_1
    OR auth.uid() = user_id_2
  );

-- Matches are created by the check_and_create_match() function
-- which runs as SECURITY DEFINER; direct inserts are restricted
-- to the function context (no user-facing insert policy needed).

-- ============================================================
-- messages
-- · Only participants of the related match can read or insert.
-- ============================================================
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages_participants_read"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM matches
      WHERE matches.id = messages.match_id
        AND (matches.user_id_1 = auth.uid() OR matches.user_id_2 = auth.uid())
    )
  );

CREATE POLICY "messages_participants_insert"
  ON messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM matches
      WHERE matches.id = match_id
        AND (matches.user_id_1 = auth.uid() OR matches.user_id_2 = auth.uid())
    )
  );

-- Allow sender to update their own message (e.g. mark delivered)
CREATE POLICY "messages_sender_update"
  ON messages FOR UPDATE
  USING (auth.uid() = sender_id)
  WITH CHECK (auth.uid() = sender_id);

-- ============================================================
-- bookings
-- · Both the seeker and the buddy can read their own bookings.
-- · Only the seeker may create a booking.
-- · Both seeker and buddy may update (e.g., confirm/cancel).
-- ============================================================
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bookings_parties_read"
  ON bookings FOR SELECT
  USING (
    auth.uid() = seeker_id
    OR auth.uid() = buddy_id
  );

CREATE POLICY "bookings_seeker_insert"
  ON bookings FOR INSERT
  WITH CHECK (auth.uid() = seeker_id);

CREATE POLICY "bookings_parties_update"
  ON bookings FOR UPDATE
  USING (
    auth.uid() = seeker_id
    OR auth.uid() = buddy_id
  )
  WITH CHECK (
    auth.uid() = seeker_id
    OR auth.uid() = buddy_id
  );

-- ============================================================
-- reviews
-- · Anyone can read public reviews.
-- · A reviewer can insert exactly one review per booking
--   (the unique constraint on (booking_id, reviewer_id)
--    enforces the one-review-per-side rule at the DB level).
-- ============================================================
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reviews_public_read"
  ON reviews FOR SELECT
  USING (is_public = TRUE);

-- A reviewer can always re-read their own reviews (even private)
CREATE POLICY "reviews_own_read"
  ON reviews FOR SELECT
  USING (auth.uid() = reviewer_id);

-- Reviewer must be a party to the completed booking
CREATE POLICY "reviews_reviewer_insert"
  ON reviews FOR INSERT
  WITH CHECK (
    auth.uid() = reviewer_id
    AND EXISTS (
      SELECT 1 FROM bookings
      WHERE bookings.id = booking_id
        AND bookings.status = 'completed'
        AND (bookings.seeker_id = auth.uid() OR bookings.buddy_id = auth.uid())
    )
  );

-- Reviewer can update their own review (e.g., edit comment)
CREATE POLICY "reviews_reviewer_update"
  ON reviews FOR UPDATE
  USING (auth.uid() = reviewer_id)
  WITH CHECK (auth.uid() = reviewer_id);

-- ============================================================
-- reports
-- · Users can only read and insert their own reports.
-- ============================================================
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reports_own_read"
  ON reports FOR SELECT
  USING (auth.uid() = reporter_id);

CREATE POLICY "reports_own_insert"
  ON reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

-- ============================================================
-- identity_verifications
-- · A user can read and manage only their own verification record.
-- ============================================================
ALTER TABLE identity_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "verifications_own_read"
  ON identity_verifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "verifications_own_insert"
  ON identity_verifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "verifications_own_update"
  ON identity_verifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- notifications
-- · Users can only read and update their own notifications.
-- ============================================================
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_own_read"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Allow users to mark their own notifications as read
CREATE POLICY "notifications_own_update"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Notifications are inserted by server-side functions/edge
-- functions running with the service role key; no user-facing
-- insert policy is intentionally provided.
