-- ============================================================
-- BuddyRent - Initial Schema
-- Migration: 001_initial_schema.sql
-- Description: Core tables for the platonic paid companionship
--              marketplace (profiles, swipes, matches, bookings,
--              messages, reviews, reports, verifications,
--              notifications) plus supporting indexes.
-- ============================================================

-- ------------------------------------------------------------
-- Extensions
-- ------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";   -- location/geo queries
CREATE EXTENSION IF NOT EXISTS "pg_trgm";   -- trigram text search

-- ------------------------------------------------------------
-- profiles
-- Extends auth.users; a user may be a Seeker, a Buddy, or both.
-- ------------------------------------------------------------
CREATE TABLE profiles (
  id                        UUID          PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name                      TEXT          NOT NULL,
  date_of_birth             DATE          NOT NULL,
  age                       INT           GENERATED ALWAYS AS (DATE_PART('year', AGE(date_of_birth))::INT) STORED,
  bio                       TEXT          DEFAULT '',
  photos                    TEXT[]        DEFAULT '{}',
  activities                TEXT[]        DEFAULT '{}',
  hourly_rate               DECIMAL(10,2),
  role                      TEXT          NOT NULL DEFAULT 'seeker'
                              CHECK (role IN ('buddy', 'seeker', 'both')),
  rating                    DECIMAL(3,2)  DEFAULT 0,
  review_count              INT           DEFAULT 0,
  location                  TEXT,
  latitude                  DECIMAL(9,6),
  longitude                 DECIMAL(9,6),
  is_verified               BOOLEAN       DEFAULT FALSE,
  verification_status       TEXT          DEFAULT 'pending'
                              CHECK (verification_status IN ('pending', 'submitted', 'verified', 'rejected')),
  is_online                 BOOLEAN       DEFAULT FALSE,
  last_seen                 TIMESTAMPTZ   DEFAULT NOW(),
  stripe_customer_id        TEXT,
  stripe_connect_account_id TEXT,
  is_active                 BOOLEAN       DEFAULT TRUE,
  is_banned                 BOOLEAN       DEFAULT FALSE,
  ban_reason                TEXT,
  created_at                TIMESTAMPTZ   DEFAULT NOW(),
  updated_at                TIMESTAMPTZ   DEFAULT NOW()
);

-- ------------------------------------------------------------
-- swipes
-- Records every left / right / super swipe a user makes.
-- A unique constraint prevents duplicate swipes on the same pair.
-- ------------------------------------------------------------
CREATE TABLE swipes (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  swiper_id   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  swiped_id   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  direction   TEXT        NOT NULL CHECK (direction IN ('left', 'right', 'super')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(swiper_id, swiped_id)
);

-- ------------------------------------------------------------
-- matches
-- Created when two users have both swiped right/super on each
-- other. user_id_1 < user_id_2 (enforced by application layer /
-- check_and_create_match function) to guarantee uniqueness.
-- ------------------------------------------------------------
CREATE TABLE matches (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id_1   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_id_2   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id_1, user_id_2)
);

-- ------------------------------------------------------------
-- bookings
-- A seeker hires a buddy for a specific activity, time, and place.
-- Financial breakdown is stored denormalised for audit purposes.
-- ------------------------------------------------------------
CREATE TABLE bookings (
  id                  UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  seeker_id           UUID          NOT NULL REFERENCES profiles(id),
  buddy_id            UUID          NOT NULL REFERENCES profiles(id),
  activity            TEXT          NOT NULL,
  date                DATE          NOT NULL,
  start_time          TIME          NOT NULL,
  end_time            TIME          NOT NULL,
  hours               DECIMAL(4,2)  NOT NULL,
  hourly_rate         DECIMAL(10,2) NOT NULL,
  subtotal            DECIMAL(10,2) NOT NULL,
  platform_fee        DECIMAL(10,2) NOT NULL,
  total_amount        DECIMAL(10,2) NOT NULL,
  buddy_earnings      DECIMAL(10,2) NOT NULL,
  status              TEXT          NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'confirmed', 'active', 'completed',
                                          'cancelled', 'disputed', 'refunded')),
  location            TEXT,
  latitude            DECIMAL(9,6),
  longitude           DECIMAL(9,6),
  notes               TEXT,
  meeting_link        TEXT,
  payment_intent_id   TEXT,
  payment_status      TEXT          DEFAULT 'unpaid'
                        CHECK (payment_status IN ('unpaid', 'paid', 'refunded', 'failed')),
  cancel_reason       TEXT,
  cancelled_by        UUID          REFERENCES profiles(id),
  buddy_confirmed_at  TIMESTAMPTZ,
  seeker_confirmed_at TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ   DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   DEFAULT NOW()
);

-- ------------------------------------------------------------
-- messages
-- Chat messages scoped to a match. booking_request messages
-- carry structured data in the metadata JSONB column.
-- ------------------------------------------------------------
CREATE TABLE messages (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id      UUID        NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  sender_id     UUID        NOT NULL REFERENCES profiles(id),
  content       TEXT        NOT NULL,
  message_type  TEXT        DEFAULT 'text'
                  CHECK (message_type IN ('text', 'booking_request', 'system')),
  metadata      JSONB,
  is_read       BOOLEAN     DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- reviews
-- Left after a completed booking. One review per booking per side
-- (reviewer + booking combination is unique).
-- ------------------------------------------------------------
CREATE TABLE reviews (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id   UUID        NOT NULL REFERENCES bookings(id),
  reviewer_id  UUID        NOT NULL REFERENCES profiles(id),
  reviewee_id  UUID        NOT NULL REFERENCES profiles(id),
  rating       INT         NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment      TEXT,
  is_public    BOOLEAN     DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(booking_id, reviewer_id)
);

-- ------------------------------------------------------------
-- reports
-- Moderation reports filed by users against other users.
-- ------------------------------------------------------------
CREATE TABLE reports (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id  UUID        NOT NULL REFERENCES profiles(id),
  reported_id  UUID        NOT NULL REFERENCES profiles(id),
  reason       TEXT        NOT NULL
                 CHECK (reason IN (
                   'inappropriate_content', 'harassment', 'spam',
                   'romantic_advance', 'fake_profile', 'no_show', 'other'
                 )),
  description  TEXT,
  status       TEXT        DEFAULT 'pending'
                 CHECK (status IN ('pending', 'reviewing', 'resolved', 'dismissed')),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- identity_verifications
-- Government-ID + selfie verification for buddy safety.
-- ------------------------------------------------------------
CREATE TABLE identity_verifications (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID        NOT NULL REFERENCES profiles(id) UNIQUE,
  id_photo_url  TEXT,
  selfie_url    TEXT,
  status        TEXT        DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by   UUID        REFERENCES profiles(id),
  review_notes  TEXT,
  submitted_at  TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at   TIMESTAMPTZ
);

-- ------------------------------------------------------------
-- notifications
-- In-app notification feed per user.
-- ------------------------------------------------------------
CREATE TABLE notifications (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type       TEXT        NOT NULL,
  title      TEXT        NOT NULL,
  body       TEXT        NOT NULL,
  data       JSONB,
  is_read    BOOLEAN     DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Indexes
-- ============================================================

-- profiles
CREATE INDEX idx_profiles_location   ON profiles(latitude, longitude);
CREATE INDEX idx_profiles_role       ON profiles(role);
CREATE INDEX idx_profiles_verified   ON profiles(is_verified);
CREATE INDEX idx_profiles_active     ON profiles(is_active, is_banned);
CREATE INDEX idx_profiles_name_trgm  ON profiles USING GIN (name gin_trgm_ops);
CREATE INDEX idx_profiles_bio_trgm   ON profiles USING GIN (bio gin_trgm_ops);

-- swipes
CREATE INDEX idx_swipes_swiper  ON swipes(swiper_id);
CREATE INDEX idx_swipes_swiped  ON swipes(swiped_id);

-- matches
CREATE INDEX idx_matches_users    ON matches(user_id_1, user_id_2);
CREATE INDEX idx_matches_user1    ON matches(user_id_1);
CREATE INDEX idx_matches_user2    ON matches(user_id_2);

-- bookings
CREATE INDEX idx_bookings_seeker  ON bookings(seeker_id);
CREATE INDEX idx_bookings_buddy   ON bookings(buddy_id);
CREATE INDEX idx_bookings_status  ON bookings(status);
CREATE INDEX idx_bookings_date    ON bookings(date);

-- messages
CREATE INDEX idx_messages_match   ON messages(match_id, created_at);
CREATE INDEX idx_messages_sender  ON messages(sender_id);

-- reviews
CREATE INDEX idx_reviews_reviewee ON reviews(reviewee_id);
CREATE INDEX idx_reviews_booking  ON reviews(booking_id);

-- notifications
CREATE INDEX idx_notifications_user    ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_unread  ON notifications(user_id, is_read) WHERE is_read = FALSE;
