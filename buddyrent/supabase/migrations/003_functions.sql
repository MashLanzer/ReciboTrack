-- ============================================================
-- BuddyRent - Database Functions & Triggers
-- Migration: 003_functions.sql
-- Description: Helper functions and triggers that implement
--              core business logic inside the database layer.
-- ============================================================

-- ============================================================
-- 1. updated_at_trigger()
-- Generic trigger function that sets updated_at = NOW()
-- whenever a row is updated. Attach to any table that has
-- an updated_at column.
-- ============================================================
CREATE OR REPLACE FUNCTION updated_at_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Attach to profiles
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION updated_at_trigger();

-- Attach to bookings
CREATE TRIGGER trg_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION updated_at_trigger();

-- ============================================================
-- 2. handle_new_user()
-- Trigger function fired AFTER INSERT on auth.users.
-- Creates the corresponding public profile row using the
-- metadata supplied during sign-up.
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _name TEXT;
  _dob  DATE;
BEGIN
  -- Pull optional metadata provided at sign-up time.
  -- Falls back to safe defaults so the insert never fails.
  _name := COALESCE(
    NEW.raw_user_meta_data ->> 'name',
    split_part(NEW.email, '@', 1)
  );

  _dob := CASE
    WHEN NEW.raw_user_meta_data ->> 'date_of_birth' IS NOT NULL
    THEN (NEW.raw_user_meta_data ->> 'date_of_birth')::DATE
    ELSE '2000-01-01'::DATE   -- placeholder; user must update in onboarding
  END;

  INSERT INTO public.profiles (
    id,
    name,
    date_of_birth,
    role,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    _name,
    _dob,
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'seeker'),
    NOW(),
    NOW()
  );

  RETURN NEW;
END;
$$;

-- Wire trigger to auth.users
CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- 3. check_and_create_match(p_user_a UUID, p_user_b UUID)
-- Called after a right/super swipe is recorded.
-- Checks whether a mutual swipe exists; if so, creates the
-- match record (normalising the ID pair so user_id_1 < user_id_2)
-- and returns the new match id, or NULL if no match yet.
-- ============================================================
CREATE OR REPLACE FUNCTION check_and_create_match(
  p_user_a UUID,
  p_user_b UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _lower_id  UUID;
  _upper_id  UUID;
  _match_id  UUID;
BEGIN
  -- Check that the other party has also swiped right/super on p_user_a
  IF NOT EXISTS (
    SELECT 1 FROM swipes
    WHERE swiper_id = p_user_b
      AND swiped_id = p_user_a
      AND direction IN ('right', 'super')
  ) THEN
    RETURN NULL;  -- No mutual like yet
  END IF;

  -- Normalise pair so the UNIQUE constraint is reliable
  IF p_user_a < p_user_b THEN
    _lower_id := p_user_a;
    _upper_id := p_user_b;
  ELSE
    _lower_id := p_user_b;
    _upper_id := p_user_a;
  END IF;

  -- Insert the match; ignore if it already exists (idempotent)
  INSERT INTO matches (user_id_1, user_id_2)
  VALUES (_lower_id, _upper_id)
  ON CONFLICT (user_id_1, user_id_2) DO NOTHING
  RETURNING id INTO _match_id;

  -- If the conflict path fired, look up the existing match id
  IF _match_id IS NULL THEN
    SELECT id INTO _match_id
    FROM matches
    WHERE user_id_1 = _lower_id
      AND user_id_2 = _upper_id;
  END IF;

  RETURN _match_id;
END;
$$;

-- ============================================================
-- 4. update_profile_rating(p_user_id UUID)
-- Recalculates a buddy's average rating and review count from
-- all public reviews where they are the reviewee.
-- Called automatically by a trigger on the reviews table.
-- ============================================================
CREATE OR REPLACE FUNCTION update_profile_rating(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _avg_rating    DECIMAL(3,2);
  _review_count  INT;
BEGIN
  SELECT
    COALESCE(ROUND(AVG(rating)::NUMERIC, 2), 0),
    COUNT(*)
  INTO _avg_rating, _review_count
  FROM reviews
  WHERE reviewee_id = p_user_id
    AND is_public = TRUE;

  UPDATE profiles
  SET
    rating       = _avg_rating,
    review_count = _review_count,
    updated_at   = NOW()
  WHERE id = p_user_id;
END;
$$;

-- Trigger wrapper so rating updates happen automatically
CREATE OR REPLACE FUNCTION trg_reviews_update_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- On INSERT or UPDATE recalculate the reviewee's rating
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM update_profile_rating(NEW.reviewee_id);
  END IF;
  -- On DELETE also recalculate (rating may drop)
  IF TG_OP = 'DELETE' THEN
    PERFORM update_profile_rating(OLD.reviewee_id);
  END IF;
  RETURN NULL;  -- AFTER trigger; return value is ignored for row triggers
END;
$$;

CREATE TRIGGER trg_reviews_rating_sync
  AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH ROW EXECUTE FUNCTION trg_reviews_update_rating();

-- ============================================================
-- 5. get_discover_profiles(p_user_id, p_limit, p_offset)
-- Returns paginated profiles that the requesting user has
-- NOT yet swiped on, excluding themselves, inactive accounts,
-- and banned accounts.
-- Results are ordered by approximate distance (Euclidean on
-- lat/lng — accurate enough for discovery; switch to PostGIS
-- ST_Distance for production geo precision).
-- ============================================================
CREATE OR REPLACE FUNCTION get_discover_profiles(
  p_user_id UUID,
  p_limit   INT     DEFAULT 20,
  p_offset  INT     DEFAULT 0
)
RETURNS TABLE (
  id            UUID,
  name          TEXT,
  age           INT,
  bio           TEXT,
  photos        TEXT[],
  activities    TEXT[],
  hourly_rate   DECIMAL(10,2),
  role          TEXT,
  rating        DECIMAL(3,2),
  review_count  INT,
  location      TEXT,
  latitude      DECIMAL(9,6),
  longitude     DECIMAL(9,6),
  is_verified   BOOLEAN,
  is_online     BOOLEAN,
  distance_km   FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_lat  DECIMAL(9,6);
  _user_lng  DECIMAL(9,6);
BEGIN
  -- Fetch the requesting user's coordinates for distance ordering
  SELECT p.latitude, p.longitude
  INTO _user_lat, _user_lng
  FROM profiles p
  WHERE p.id = p_user_id;

  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.age,
    p.bio,
    p.photos,
    p.activities,
    p.hourly_rate,
    p.role,
    p.rating,
    p.review_count,
    p.location,
    p.latitude,
    p.longitude,
    p.is_verified,
    p.is_online,
    -- Approximate distance in km.
    -- NULL-safe: if either side has no coords, distance is NULL (sorted last).
    CASE
      WHEN _user_lat IS NOT NULL
       AND _user_lng IS NOT NULL
       AND p.latitude  IS NOT NULL
       AND p.longitude IS NOT NULL
      THEN
        -- 111.32 km per degree of latitude; longitude degrees shrink with cos(lat)
        SQRT(
          POWER((_user_lat - p.latitude) * 111.32, 2) +
          POWER((_user_lng - p.longitude) * 111.32
                * COS(RADIANS((_user_lat + p.latitude) / 2.0)), 2)
        )
      ELSE NULL
    END::FLOAT AS distance_km
  FROM profiles p
  WHERE
    p.id        != p_user_id     -- exclude self
    AND p.is_active = TRUE
    AND p.is_banned = FALSE
    -- Exclude profiles already swiped by this user in either direction
    AND NOT EXISTS (
      SELECT 1 FROM swipes s
      WHERE s.swiper_id = p_user_id
        AND s.swiped_id = p.id
    )
  ORDER BY
    distance_km ASC NULLS LAST,
    p.rating    DESC,
    p.created_at DESC
  LIMIT  p_limit
  OFFSET p_offset;
END;
$$;
