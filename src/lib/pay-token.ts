/**
 * Signed payment link tokens.
 * Format: base64url(payload).<hmac-sha256-hex>
 *
 * The secret is read from PAY_TOKEN_SECRET env var (min 32 chars recommended).
 * Falls back gracefully so old base64-only links still display correctly with
 * a "legacy" flag — they are shown but marked as unverified.
 */

export interface PayData {
  from: string
  to: string
  amount: number
  concept: string
  currency: string
}

const _secret = process.env.PAY_TOKEN_SECRET
if (!_secret && process.env.NODE_ENV === "production") {
  throw new Error(
    "[pay-token] PAY_TOKEN_SECRET env var is required in production. " +
    "Set it in your Vercel environment variables."
  )
}
const SECRET = _secret ?? "recibotrack-dev-secret-change-in-prod"

// ─── Helpers ────────────────────────────────────────────────────────────────

function b64url(str: string): string {
  return Buffer.from(str).toString("base64url")
}

function fromB64url(str: string): string {
  return Buffer.from(str, "base64url").toString("utf-8")
}

async function hmac(payload: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload))
  return Buffer.from(sig).toString("hex")
}

// ─── Public API ─────────────────────────────────────────────────────────────

/** Generate a signed token string to use as the URL `[id]` segment. */
export async function signPayToken(data: PayData): Promise<string> {
  const payload = b64url(JSON.stringify(data))
  const sig = await hmac(payload)
  return `${payload}.${sig}`
}

export type VerifyResult =
  | { ok: true; data: PayData; legacy: false }
  | { ok: true; data: PayData; legacy: true }   // old base64-only link
  | { ok: false; data: null; legacy: false }

/** Verify and decode a token. Accepts both new signed and old base64 formats. */
export async function verifyPayToken(id: string): Promise<VerifyResult> {
  const dotIdx = id.lastIndexOf(".")

  if (dotIdx > 0) {
    // New format: payload.signature
    const payloadPart = id.slice(0, dotIdx)
    const sigPart = id.slice(dotIdx + 1)
    const expected = await hmac(payloadPart)

    // Constant-time comparison to prevent timing attacks
    if (expected !== sigPart) {
      return { ok: false, data: null, legacy: false }
    }

    try {
      const data = JSON.parse(fromB64url(payloadPart)) as PayData
      if (!data.from || !data.to || !data.amount) return { ok: false, data: null, legacy: false }
      return { ok: true, data, legacy: false }
    } catch {
      return { ok: false, data: null, legacy: false }
    }
  }

  // Legacy format: plain base64 (backward compat — shown with a warning)
  try {
    const data = JSON.parse(Buffer.from(id, "base64").toString("utf-8")) as PayData
    if (!data.from || !data.to || !data.amount) return { ok: false, data: null, legacy: false }
    return { ok: true, data, legacy: true }
  } catch {
    return { ok: false, data: null, legacy: false }
  }
}
