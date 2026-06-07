-- ============================================================
-- BuddyRent - Seed Data
-- File: seed.sql
-- Description: 5 sample buddy profiles for local development
--              and testing. UUIDs are fixed so they can be
--              referenced predictably in other seed/test files.
-- ============================================================

-- ------------------------------------------------------------
-- NOTE: In a real Supabase project, auth.users rows must be
-- inserted via the Supabase Admin API or the Supabase dashboard
-- before these profile rows can satisfy the FK constraint.
-- For local development with `supabase start`, you can use the
-- service-role key to bypass RLS and insert directly.
--
-- These UUIDs must match the IDs that Supabase assigns to the
-- corresponding auth.users records. Replace with real auth UUIDs
-- after you have seeded auth.users in your local environment.
-- ------------------------------------------------------------

-- Convenience: wrap in a transaction so seeds are atomic
BEGIN;

-- ============================================================
-- Buddy 1 – Maya Chen (hiking & photography)
-- ============================================================
INSERT INTO profiles (
  id,
  name,
  date_of_birth,
  bio,
  photos,
  activities,
  hourly_rate,
  role,
  rating,
  review_count,
  location,
  latitude,
  longitude,
  is_verified,
  verification_status,
  is_online,
  last_seen,
  is_active,
  created_at,
  updated_at
) VALUES (
  '11111111-0000-0000-0000-000000000001',
  'Maya Chen',
  '1997-04-12',
  'Hey! I''m Maya — a nature lover and amateur photographer based in San Francisco. I''m your ideal companion for weekend hikes, botanical garden strolls, or exploring local farmers'' markets. I keep every outing light, fun, and platonic. Let''s make memories!',
  ARRAY[
    'https://storage.example.com/avatars/maya1.jpg',
    'https://storage.example.com/avatars/maya2.jpg'
  ],
  ARRAY['hiking', 'photography', 'farmers markets', 'botanical gardens', 'coffee shop chats'],
  35.00,
  'buddy',
  4.92,
  47,
  'San Francisco, CA',
  37.774929,
  -122.419418,
  TRUE,
  'verified',
  TRUE,
  NOW() - INTERVAL '5 minutes',
  TRUE,
  NOW() - INTERVAL '6 months',
  NOW() - INTERVAL '1 day'
);

-- ============================================================
-- Buddy 2 – Jordan Rivera (gaming & board games)
-- ============================================================
INSERT INTO profiles (
  id,
  name,
  date_of_birth,
  bio,
  photos,
  activities,
  hourly_rate,
  role,
  rating,
  review_count,
  location,
  latitude,
  longitude,
  is_verified,
  verification_status,
  is_online,
  last_seen,
  is_active,
  created_at,
  updated_at
) VALUES (
  '22222222-0000-0000-0000-000000000002',
  'Jordan Rivera',
  '1995-09-30',
  'Board game enthusiast, amateur chef, and your go-to gaming companion. Whether it''s a competitive night of Catan, a chill escape room, or testing a new restaurant in the Mission, I''m always down. I bring good vibes and zero drama.',
  ARRAY[
    'https://storage.example.com/avatars/jordan1.jpg',
    'https://storage.example.com/avatars/jordan2.jpg',
    'https://storage.example.com/avatars/jordan3.jpg'
  ],
  ARRAY['board games', 'escape rooms', 'video games', 'cooking classes', 'trivia nights'],
  30.00,
  'buddy',
  4.78,
  32,
  'San Francisco, CA',
  37.759703,
  -122.414926,
  TRUE,
  'verified',
  FALSE,
  NOW() - INTERVAL '2 hours',
  TRUE,
  NOW() - INTERVAL '8 months',
  NOW() - INTERVAL '3 days'
);

-- ============================================================
-- Buddy 3 – Priya Sharma (museums & art galleries)
-- ============================================================
INSERT INTO profiles (
  id,
  name,
  date_of_birth,
  bio,
  photos,
  activities,
  hourly_rate,
  role,
  rating,
  review_count,
  location,
  latitude,
  longitude,
  is_verified,
  verification_status,
  is_online,
  last_seen,
  is_active,
  created_at,
  updated_at
) VALUES (
  '33333333-0000-0000-0000-000000000003',
  'Priya Sharma',
  '1999-01-18',
  'Art historian by education, culture enthusiast by heart. I love slow mornings at SFMOMA, afternoon gallery hops in the Tenderloin, and animated conversations about literally anything creative. Fluent in English and Hindi. Happy to be your friendly SF cultural guide!',
  ARRAY[
    'https://storage.example.com/avatars/priya1.jpg',
    'https://storage.example.com/avatars/priya2.jpg'
  ],
  ARRAY['art galleries', 'museums', 'theatre', 'poetry readings', 'architecture walks'],
  40.00,
  'buddy',
  4.95,
  61,
  'San Francisco, CA',
  37.785834,
  -122.401267,
  TRUE,
  'verified',
  FALSE,
  NOW() - INTERVAL '30 minutes',
  TRUE,
  NOW() - INTERVAL '1 year',
  NOW() - INTERVAL '6 hours'
);

-- ============================================================
-- Buddy 4 – Marcus Williams (fitness & outdoor sports)
-- ============================================================
INSERT INTO profiles (
  id,
  name,
  date_of_birth,
  bio,
  photos,
  activities,
  hourly_rate,
  role,
  rating,
  review_count,
  location,
  latitude,
  longitude,
  is_verified,
  verification_status,
  is_online,
  last_seen,
  is_active,
  created_at,
  updated_at
) VALUES (
  '44444444-0000-0000-0000-000000000004',
  'Marcus Williams',
  '1993-06-05',
  'Certified personal trainer and outdoor sports fanatic. I can be your workout accountability buddy, your cycling partner on the Embarcadero, or your beach volleyball teammate. I keep things energetic, safe, and 100% professional. New to SF? I''ll show you the best outdoor spots.',
  ARRAY[
    'https://storage.example.com/avatars/marcus1.jpg',
    'https://storage.example.com/avatars/marcus2.jpg',
    'https://storage.example.com/avatars/marcus3.jpg'
  ],
  ARRAY['fitness', 'cycling', 'beach volleyball', 'rock climbing', 'yoga', 'running'],
  45.00,
  'buddy',
  4.85,
  53,
  'Oakland, CA',
  37.804363,
  -122.271111,
  TRUE,
  'verified',
  TRUE,
  NOW() - INTERVAL '10 minutes',
  TRUE,
  NOW() - INTERVAL '5 months',
  NOW() - INTERVAL '2 hours'
);

-- ============================================================
-- Buddy 5 – Sofia Torres (foodie tours & language exchange)
-- ============================================================
INSERT INTO profiles (
  id,
  name,
  date_of_birth,
  bio,
  photos,
  activities,
  hourly_rate,
  role,
  rating,
  review_count,
  location,
  latitude,
  longitude,
  is_verified,
  verification_status,
  is_online,
  last_seen,
  is_active,
  created_at,
  updated_at
) VALUES (
  '55555555-0000-0000-0000-000000000005',
  'Sofia Torres',
  '2000-11-22',
  'Foodie, language nerd, and chronic over-orderer at dim sum. I am the perfect companion for restaurant adventures, grocery market tours, or practising conversational Spanish/Portuguese. I''ll always know the hidden gem on the menu. LGBTQ+ friendly and neurodivergent-affirming.',
  ARRAY[
    'https://storage.example.com/avatars/sofia1.jpg',
    'https://storage.example.com/avatars/sofia2.jpg'
  ],
  ARRAY['food tours', 'language exchange', 'cooking', 'karaoke', 'salsa dancing', 'thrift shopping'],
  32.00,
  'buddy',
  4.70,
  28,
  'San Jose, CA',
  37.338207,
  -121.886330,
  FALSE,
  'submitted',
  FALSE,
  NOW() - INTERVAL '1 day',
  TRUE,
  NOW() - INTERVAL '3 months',
  NOW() - INTERVAL '1 week'
);

-- ============================================================
-- Sample reviews for Maya (buddy 1) from a seeker placeholder
-- UUID 99999999-0000-0000-0000-000000000099 represents a seeker
-- whose auth row and profile must also be seeded separately.
-- ============================================================

-- Bookings must exist before reviews; insert a completed booking first.
INSERT INTO bookings (
  id,
  seeker_id,
  buddy_id,
  activity,
  date,
  start_time,
  end_time,
  hours,
  hourly_rate,
  subtotal,
  platform_fee,
  total_amount,
  buddy_earnings,
  status,
  location,
  latitude,
  longitude,
  payment_intent_id,
  payment_status,
  buddy_confirmed_at,
  seeker_confirmed_at,
  completed_at,
  created_at,
  updated_at
) VALUES (
  'aaaaaaaa-0000-0000-0000-000000000001',
  '99999999-0000-0000-0000-000000000099',  -- placeholder seeker
  '11111111-0000-0000-0000-000000000001',  -- Maya
  'hiking',
  '2026-05-10',
  '09:00',
  '12:00',
  3.00,
  35.00,
  105.00,
  15.75,
  120.75,
  89.25,
  'completed',
  'Lands End Trail, San Francisco, CA',
  37.780815,
  -122.508236,
  'pi_test_abc123',
  'paid',
  NOW() - INTERVAL '30 days',
  NOW() - INTERVAL '30 days',
  NOW() - INTERVAL '29 days',
  NOW() - INTERVAL '31 days',
  NOW() - INTERVAL '29 days'
);

INSERT INTO reviews (
  id,
  booking_id,
  reviewer_id,
  reviewee_id,
  rating,
  comment,
  is_public,
  created_at
) VALUES (
  'bbbbbbbb-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  '99999999-0000-0000-0000-000000000099',
  '11111111-0000-0000-0000-000000000001',
  5,
  'Maya was an absolute delight! She knew every trail, kept a comfortable pace, and her photography tips were a bonus. Felt completely safe and had a genuinely great time. Already planning to book again.',
  TRUE,
  NOW() - INTERVAL '28 days'
);

COMMIT;
