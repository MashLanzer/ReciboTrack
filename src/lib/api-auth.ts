/**
 * api-auth.ts — Server-side authentication & rate limiting for API routes.
 *
 * Authentication: verifica el Firebase ID token adjunto en el header
 *   Authorization: Bearer <idToken>
 * usando la Firebase REST API (accounts:lookup), sin necesitar Service Account.
 *
 * Rate limiting: ventana deslizante en memoria (Map). Se reinicia cuando el
 * servidor se reinicia — suficiente para producción serverless con Vercel
 * (cada instancia tiene su propio Map).
 */

import { NextRequest, NextResponse } from "next/server"

// ─── Rate limit store ────────────────────────────────────────────────────────

interface RateRecord {
  timestamps: number[] // epoch ms de cada request
}

const store = new Map<string, RateRecord>()

/** Limits by route group (requests per window) */
const LIMITS: Record<string, { maxReqs: number; windowMs: number }> = {
  ai:  { maxReqs: 20, windowMs: 60_000 }, // AI routes: 20 req/min
  ocr: { maxReqs: 10, windowMs: 60_000 }, // OCR route: 10 req/min
  pay: { maxReqs: 30, windowMs: 60_000 }, // Pay-link:  30 req/min
}

/**
 * Check and update rate limit for a given key (uid + route group).
 * Returns true if the request is allowed, false if rate-limited.
 */
function checkRateLimit(uid: string, group: keyof typeof LIMITS): boolean {
  const limit = LIMITS[group]
  const key = `${uid}:${group}`
  const now = Date.now()
  const windowStart = now - limit.windowMs

  let record = store.get(key)
  if (!record) {
    record = { timestamps: [] }
    store.set(key, record)
  }

  // Slide the window — remove old timestamps
  record.timestamps = record.timestamps.filter(ts => ts > windowStart)

  if (record.timestamps.length >= limit.maxReqs) {
    return false // Rate limited
  }

  record.timestamps.push(now)
  return true
}

// ─── Token verification via Firebase REST API ────────────────────────────────

interface FirebaseTokenInfo {
  localId: string // Firebase UID
  email?: string
  emailVerified?: boolean
}

interface FirebaseLookupResponse {
  users?: FirebaseTokenInfo[]
  error?: { message: string }
}

/**
 * Verifies a Firebase ID token using the REST accounts:lookup endpoint.
 * Returns the uid on success, null on failure.
 *
 * Note: This validates the token is current and the user exists in Firebase.
 * It does NOT re-validate the JWT signature (that's done by Firebase's servers).
 */
async function verifyFirebaseToken(idToken: string): Promise<string | null> {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  if (!apiKey) {
    console.error("[api-auth] NEXT_PUBLIC_FIREBASE_API_KEY not set")
    return null
  }

  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
        // Timeout: 5s — don't block the request too long
        signal: AbortSignal.timeout(5_000),
      }
    )

    const data = (await res.json()) as FirebaseLookupResponse

    if (!res.ok || data.error) {
      // Common errors: TOKEN_EXPIRED, USER_NOT_FOUND, INVALID_ID_TOKEN
      return null
    }

    const user = data.users?.[0]
    return user?.localId ?? null
  } catch (err) {
    console.error("[api-auth] Token verification failed:", err)
    return null
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export type RateLimitGroup = keyof typeof LIMITS

export interface AuthResult {
  uid: string
}

/**
 * Authenticates the request and checks rate limit.
 *
 * Usage in a route:
 *   const auth = await requireAuth(req, "ai")
 *   if (auth instanceof NextResponse) return auth
 *   // auth.uid is now available
 *
 * @param req   - The incoming NextRequest
 * @param group - Rate limit group: "ai" | "ocr" | "pay"
 * @returns AuthResult on success, NextResponse (401 or 429) on failure
 */
export async function requireAuth(
  req: NextRequest,
  group: RateLimitGroup
): Promise<AuthResult | NextResponse> {
  // 1. Extract Bearer token
  const authHeader = req.headers.get("authorization") ?? ""
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null

  if (!token) {
    return NextResponse.json(
      { error: "No autorizado. Debes iniciar sesión." },
      { status: 401 }
    )
  }

  // 2. Verify the token with Firebase
  const uid = await verifyFirebaseToken(token)
  if (!uid) {
    return NextResponse.json(
      { error: "Sesión inválida o expirada. Vuelve a iniciar sesión." },
      { status: 401 }
    )
  }

  // 3. Check rate limit
  const allowed = checkRateLimit(uid, group)
  if (!allowed) {
    const limit = LIMITS[group]
    return NextResponse.json(
      { error: `Límite de peticiones alcanzado. Máximo ${limit.maxReqs} por minuto.` },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(limit.windowMs / 1000)) },
      }
    )
  }

  return { uid }
}
