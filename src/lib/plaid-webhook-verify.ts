/**
 * Verificación de webhooks de Plaid según el spec oficial:
 *   https://plaid.com/docs/api/webhooks/webhook-verification/
 *
 * Flow:
 *   1. Plaid manda un header `Plaid-Verification` con un JWT firmado ES256.
 *   2. El JWT contiene { kid } en el header — el ID de la clave pública.
 *   3. Pedimos la clave a /webhook_verification_key/get pasando ese kid.
 *      (cacheamos en memoria; las claves rotan pero el kid cambia con ellas)
 *   4. Verificamos el JWT con esa clave.
 *   5. El payload del JWT incluye `request_body_sha256` — debe coincidir con
 *      sha256(rawBody) para confirmar que el body no fue alterado.
 *   6. `iat` debe ser reciente (< 5 min) para mitigar replay attacks.
 */
import { jwtVerify, importJWK, decodeProtectedHeader, type JWK } from "jose"
import crypto from "node:crypto"
import { getPlaid } from "@/lib/plaid"

// Cache simple: kid → JWK (las claves rotan ocasionalmente; cuando ocurra,
// vendrá un kid nuevo y haremos el fetch).
const keyCache = new Map<string, JWK>()

const MAX_AGE_SECONDS = 5 * 60  // 5 min

export interface VerifyResult {
  ok:    true
  body:  string
}

export interface VerifyError {
  ok:     false
  reason: string
}

/**
 * Verifica el webhook. Devuelve `ok: true` con el body raw si la firma es
 * válida, o `ok: false` con la razón si no.
 */
export async function verifyPlaidWebhook(
  rawBody: string,
  verificationHeader: string | null,
): Promise<VerifyResult | VerifyError> {
  if (!verificationHeader) {
    return { ok: false, reason: "missing Plaid-Verification header" }
  }

  let kid: string
  try {
    const header = decodeProtectedHeader(verificationHeader)
    if (header.alg !== "ES256") return { ok: false, reason: `unexpected alg: ${header.alg}` }
    if (!header.kid) return { ok: false, reason: "missing kid in JWT header" }
    kid = header.kid
  } catch {
    return { ok: false, reason: "malformed JWT" }
  }

  // Cargar la clave (cache hit o fetch a Plaid)
  let jwk = keyCache.get(kid)
  if (!jwk) {
    try {
      const res = await getPlaid().webhookVerificationKeyGet({ key_id: kid })
      // SDK devuelve `key` ya en formato JWK. El tipo del SDK es WebhookVerificationKey.
      jwk = res.data.key as unknown as JWK
      keyCache.set(kid, jwk)
    } catch (err) {
      return { ok: false, reason: `failed to fetch verification key: ${String(err)}` }
    }
  }

  // Verificar firma del JWT
  let payload: { iat?: number; request_body_sha256?: string }
  try {
    const keyLike = await importJWK(jwk, "ES256")
    const result = await jwtVerify(verificationHeader, keyLike, { algorithms: ["ES256"] })
    payload = result.payload as typeof payload
  } catch (err) {
    return { ok: false, reason: `JWT signature invalid: ${String(err)}` }
  }

  // Verificar iat reciente (antireplay)
  if (typeof payload.iat !== "number") return { ok: false, reason: "missing iat" }
  const ageSec = Math.floor(Date.now() / 1000) - payload.iat
  if (ageSec > MAX_AGE_SECONDS) return { ok: false, reason: `webhook too old (${ageSec}s)` }
  if (ageSec < -60)             return { ok: false, reason: "webhook from the future" }

  // Verificar SHA-256 del body
  if (typeof payload.request_body_sha256 !== "string") {
    return { ok: false, reason: "missing request_body_sha256" }
  }
  const expected = crypto.createHash("sha256").update(rawBody).digest("hex")
  // Comparación constante para evitar timing attacks
  const a = Buffer.from(expected)
  const b = Buffer.from(payload.request_body_sha256)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: "body sha256 mismatch" }
  }

  return { ok: true, body: rawBody }
}
