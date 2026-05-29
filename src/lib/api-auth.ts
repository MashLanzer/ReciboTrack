/**
 * api-auth.ts — Server-side authentication & rate limiting for API routes.
 *
 * Authentication: verifica el Firebase ID token adjunto en el header
 *   Authorization: Bearer <idToken>
 * usando Firebase Admin SDK (verifyIdToken), que valida el JWT localmente
 * con JWKS cacheados — sin llamada de red en cada request.
 *
 * Rate limiting: ventana deslizante en memoria (Map). Se reinicia cuando el
 * servidor se reinicia — suficiente para producción serverless con Vercel
 * (cada instancia tiene su propio Map).
 *
 * Auto-profile: Tras verificar el token, hace un upsert (ignoreDuplicates)
 * de la fila en `profiles` para garantizar que siempre exista antes de
 * cualquier INSERT en tablas con FK a profiles.
 */

import { NextRequest, NextResponse } from "next/server"
import { getAdminAuth } from "@/lib/firebase/admin"
import { getSupabase } from "@/lib/supabase/server"

// ─── Rate limit store ────────────────────────────────────────────────────────

interface RateRecord {
  timestamps: number[] // epoch ms de cada request
}

const store = new Map<string, RateRecord>()

/** Limits by route group (requests per window) */
const LIMITS: Record<string, { maxReqs: number; windowMs: number }> = {
  ai:  { maxReqs: 20, windowMs: 60_000 }, // AI routes: 20 req/min
  ocr: { maxReqs: 10, windowMs: 60_000 }, // OCR route: 10 req/min
  pay: { maxReqs: 200, windowMs: 60_000 }, // Data routes: 200 req/min
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

// ─── In-memory profile cache (por instancia serverless) ──────────────────────
// Evita hacer upsert en cada GET — solo upserta la primera vez por uid en
// esta instancia (se reinicia en cada cold start, que es suficiente).

const profileCreated = new Set<string>()

// ─── Token verification via Firebase Admin SDK ───────────────────────────────

interface VerifiedToken {
  uid:          string
  email?:       string
  displayName?: string
  photoUrl?:    string
}

/**
 * Verifies a Firebase ID token using the Admin SDK (verifyIdToken).
 * Validates the JWT signature locally with cached JWKS — no network call
 * after the keys are cached (refreshed automatically every ~1h).
 * Returns user info on success, null on failure.
 */
async function verifyFirebaseToken(idToken: string): Promise<VerifiedToken | null> {
  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken)
    return {
      uid:          decoded.uid,
      email:        decoded.email,
      displayName:  decoded.name,   // Firebase Admin: 'name' claim = display name
      photoUrl:     decoded.picture, // Firebase Admin: 'picture' claim = photo URL
    }
  } catch (err) {
    // Common errors: auth/id-token-expired, auth/argument-error, auth/invalid-id-token
    const code = (err as { code?: string }).code ?? ""
    if (!code.includes("expired") && !code.includes("invalid")) {
      console.error("[api-auth] Token verification error:", err)
    }
    return null
  }
}

// ─── Auto-upsert profile ─────────────────────────────────────────────────────

/**
 * Garantiza que el usuario tenga fila en la tabla `profiles`.
 * Usa ON CONFLICT DO NOTHING para que sea un no-op si ya existe.
 * Se hace como máximo una vez por uid por instancia serverless (cache en memoria).
 */
async function ensureProfile(verified: VerifiedToken): Promise<void> {
  if (profileCreated.has(verified.uid)) return  // ya lo comprobamos en esta instancia

  try {
    const now = new Date().toISOString()
    await getSupabase()
      .from("profiles")
      .upsert(
        {
          uid:          verified.uid,
          email:        verified.email        ?? null,
          display_name: verified.displayName  ?? null,
          photo_url:    verified.photoUrl     ?? null,
          updated_at:   now,
          created_at:   now,
        },
        { onConflict: "uid", ignoreDuplicates: true }
      )

    // También actualizar el directorio público (para lookup de Trusted Circle)
    if (verified.email) {
      await getSupabase()
        .from("user_directory")
        .upsert(
          {
            email:        verified.email.toLowerCase(),
            uid:          verified.uid,
            display_name: verified.displayName ?? null,
            photo_url:    verified.photoUrl    ?? null,
            updated_at:   now,
          },
          { onConflict: "email", ignoreDuplicates: true }
        )
    }

    profileCreated.add(verified.uid)
  } catch (err) {
    // No crítico — si falla, el route de datos mostrará el error real
    console.error("[api-auth] ensureProfile failed:", err)
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export type RateLimitGroup = keyof typeof LIMITS

export interface AuthResult {
  uid:         string
  email?:      string
  displayName?: string
}

/**
 * Authenticates the request, auto-creates the profile if needed, and checks
 * rate limit.
 *
 * Usage in a route:
 *   const auth = await requireAuth(req, "pay")
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
  const verified = await verifyFirebaseToken(token)
  if (!verified) {
    return NextResponse.json(
      { error: "Sesión inválida o expirada. Vuelve a iniciar sesión." },
      { status: 401 }
    )
  }

  // 3. Auto-create profile in Supabase (no-op if already exists)
  await ensureProfile(verified)

  // 4. Check rate limit
  const allowed = checkRateLimit(verified.uid, group)
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

  return { uid: verified.uid, email: verified.email, displayName: verified.displayName }
}
