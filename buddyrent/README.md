# BuddyRent 🤝

> **Real plans. Real connections. 100% platonic.**

BuddyRent is a platonic paid companionship marketplace for young adults (18-35) in the United States. Think Tinder meets TaskRabbit — users swipe to find "Buddies" to hire by the hour for social activities, hobbies, and everyday experiences. Nothing romantic, nothing sexual. Just genuine human connection, paid fairly.

---

## 🎯 Concept

Inspired by Japan's "Rental Friend" (Rentaru Furendo) culture, BuddyRent brings the concept to a Gen Z American audience. Whether you want someone to hike with, explore a museum, hit the gym, or help you settle into a new city — BuddyRent makes it easy to find and pay for real companionship.

**Tagline:** *"Never do it alone."*

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile Framework | React Native + Expo SDK ~52 |
| Navigation | Expo Router v4 (file-based) |
| Styling | NativeWind v4 (TailwindCSS) |
| State Management | Zustand v5 |
| Backend/Database | Supabase (PostgreSQL + Auth + Storage + Realtime) |
| Payments | Stripe (Connect for payouts) |
| Video Calls | Daily.co |
| Language | TypeScript (strict) |
| Animations | React Native Reanimated v3 |
| Gestures | React Native Gesture Handler |

---

## 📁 Project Structure

```
buddyrent/
├── app/                          # Expo Router screens
│   ├── _layout.tsx               # Root layout (GestureHandler + Stripe + SafeArea)
│   ├── index.tsx                 # Auth redirect
│   ├── (auth)/                   # Unauthenticated screens
│   │   ├── welcome.tsx           # Landing screen
│   │   ├── login.tsx             # Sign in
│   │   ├── register.tsx          # Sign up
│   │   └── onboarding/           # 4-step profile setup
│   │       ├── index.tsx         # Step 1: Photos + bio
│   │       ├── step2.tsx         # Step 2: Role selection
│   │       ├── step3.tsx         # Step 3: Activities
│   │       └── step4.tsx         # Step 4: ID verification
│   ├── (tabs)/                   # Authenticated main app
│   │   ├── discover.tsx          # Swipe deck (main screen)
│   │   ├── matches.tsx           # Matches + conversations
│   │   ├── bookings.tsx          # Upcoming + past bookings
│   │   ├── messages/
│   │   │   ├── index.tsx         # Conversations list
│   │   │   └── [id].tsx          # Chat screen
│   │   └── profile/
│   │       ├── index.tsx         # Own profile
│   │       └── edit.tsx          # Edit profile
│   └── booking/
│       ├── [id].tsx              # Booking detail
│       └── confirm.tsx           # Payment confirmation
├── components/
│   ├── ui/                       # Reusable primitives
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Avatar.tsx
│   │   └── Badge.tsx
│   ├── SwipeCard.tsx             # Tinder-like card
│   ├── SwipeDeck.tsx             # Card stack manager
│   ├── ProfileCard.tsx           # Match list item
│   ├── BookingModal.tsx          # Book a buddy sheet
│   ├── ActivityBadge.tsx         # Activity pill tag
│   └── ChatBubble.tsx            # Chat message bubble
├── lib/
│   ├── supabase.ts               # Supabase client
│   ├── stripe.ts                 # Stripe helpers
│   └── utils.ts                  # Utility functions
├── stores/
│   ├── authStore.ts              # Auth + profile state
│   ├── discoverStore.ts          # Swipe/discover state
│   └── bookingStore.ts           # Bookings state
├── hooks/
│   └── useAuth.ts                # Auth hook with realtime subscription
├── types/
│   └── index.ts                  # TypeScript interfaces
├── constants/
│   ├── colors.ts                 # Color palette
│   ├── activities.ts             # 43+ activity categories
│   └── config.ts                 # App configuration
└── supabase/
    ├── migrations/
    │   ├── 001_initial_schema.sql
    │   ├── 002_rls_policies.sql
    │   └── 003_functions.sql
    └── seed.sql
```

---

## 🎨 Design System

### Colors
| Token | Hex | Usage |
|-------|-----|-------|
| Primary | `#FF6B35` | CTAs, active states, branding |
| Secondary | `#4ECDC4` | Accents, success states |
| Surface | `#FAFAFA` | Screen backgrounds |
| Card | `#FFFFFF` | Card backgrounds |
| Text Primary | `#1A1A2E` | Main text |
| Text Secondary | `#6B7280` | Subtitles, metadata |
| Accent | `#A855F7` | Premium features |

### Typography
- **Headings:** Poppins (600/700)
- **Body:** Inter (400/500)

### Swipe Cards
- Like → Green overlay + "LIKE" stamp (right swipe)
- Nope → Red overlay + "NOPE" stamp (left swipe)
- Super Like → Blue overlay + "SUPER" stamp (up swipe)

---

## 🗄 Database Schema (Supabase)

```
profiles          → User profiles (extends auth.users)
swipes            → Swipe history (left/right/super)
matches           → Mutual right swipes
bookings          → Paid sessions with status tracking
messages          → Real-time chat per match
reviews           → Post-booking ratings (1-5 stars)
reports           → Content moderation
identity_verifications → ID + selfie for safety
notifications     → In-app push notifications
```

---

## 💰 Monetization

### Commission Model
- Platform takes **20%** of every booking
- Buddy keeps **80%** (paid via Stripe Connect)
- Example: $30/hr × 2 hours = $60 → Platform: $12 → Buddy: $48

### Premium Subscription (BuddyRent+)
- Unlimited super likes
- See who liked you first
- Priority in search results
- Advanced filters
- Price: $9.99/month or $49.99/year

### Pricing Tiers for Buddies
- Standard: $15-$50/hr
- Verified Pro: $25-$100/hr

---

## 🔒 Safety & Moderation

1. **Identity Verification** — Government ID + selfie required for all users
2. **Video Call Before Booking** — Mandatory safety call before first booking
3. **Strictly Platonic Policy** — Zero tolerance for romantic/sexual content; instant ban
4. **AI Content Moderation** — Chat scanning for violations
5. **Community Reports** — Easy in-app reporting
6. **Background Check Option** — Premium badge for cleared users
7. **Panic Button** — Emergency contact sharing during sessions
8. **Review System** — Mutual ratings after each booking

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- Expo CLI: `npm install -g expo@latest`
- Supabase account
- Stripe account (with Connect enabled)

### Installation

```bash
# Clone the repo
git clone https://github.com/MashLanzer/BuddyRent.git
cd BuddyRent

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Fill in your Supabase URL, keys, and Stripe key

# Run database migrations
npx supabase db push

# Start the development server
npm start
```

### Supabase Setup

1. Create a new Supabase project
2. Run migrations in order:
   ```bash
   npx supabase db push
   ```
3. Enable Storage and create bucket `avatars` (public) and `verifications` (private)
4. Set up Edge Functions for Stripe webhooks

### Stripe Setup

1. Create a Stripe account with Connect enabled
2. Set `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` in `.env.local`
3. Deploy the `create-payment-intent` Edge Function to Supabase
4. Configure webhook endpoint: `https://your-project.supabase.co/functions/v1/stripe-webhook`

---

## 📱 Key User Flows

### Seeker Flow
1. Sign up → Onboard (role: Seeker) → Verify ID
2. Browse Discover → Swipe right on Buddy
3. Match → Chat → Propose Booking
4. Pay via Stripe → Attend session
5. Review Buddy

### Buddy Flow
1. Sign up → Onboard (role: Buddy, set rate) → Verify ID
2. Complete Stripe Connect onboarding
3. Appear in Discover feed → Get matched
4. Receive booking request → Accept/Decline
5. Attend session → Get paid (T+2 days via Stripe)

---

## 📊 MVP Features (Phase 1)

- [x] User auth (Supabase)
- [x] Profile creation & onboarding
- [x] Tinder-style swipe deck
- [x] Match system
- [x] Real-time chat
- [x] Booking creation & payment (Stripe)
- [x] Review system
- [x] Basic ID verification
- [ ] Push notifications (Expo Notifications)
- [ ] Video pre-booking call (Daily.co)
- [ ] Advanced search filters

## 🗺 Roadmap

| Phase | Timeline | Features |
|-------|----------|----------|
| MVP | Month 1-3 | Core swipe, match, chat, basic booking |
| v1.0 | Month 4-6 | Payments, reviews, ID verify, video call |
| v1.5 | Month 7-9 | Premium subscription, push notifs, AI moderation |
| v2.0 | Month 10-12 | Background checks, group activities, referrals |

---

## ⚖️ Legal

### Terms of Service Key Points
- Must be 18+ to use
- Strictly platonic interactions only
- Zero tolerance for romantic/sexual solicitation
- Users are independent contractors, not employees
- Platform is not liable for in-person interactions
- Users must comply with local laws

### Privacy Policy Key Points
- ID data encrypted + stored securely (not shared)
- Location data used only for proximity matching
- CCPA compliant (California users can delete data)
- No data sold to third parties

### App Store Compliance
- Age rating: 17+ (adult content policy)
- In-app purchases: Stripe/Apple Pay compliant
- Location usage: disclosed in info.plist
- No simulated gambling mechanics

---

## 🌆 Launch Strategy

**Phase 1 Target:** One major college town (e.g., Austin, TX or Boulder, CO)
- Partner with 1-2 university student organizations
- Host "Buddy Connect" events for supply-side recruitment
- TikTok/Instagram content: "Day in the life of a BuddyRent Buddy"
- Referral program: $10 credit for each verified referral

---

## 📧 Contact

- **Support:** support@buddyrent.com
- **Safety:** safety@buddyrent.com
- **Business:** hello@buddyrent.com

---

*BuddyRent is a registered trademark. All companionship services are strictly platonic.*
