/**
 * encryption.ts — AES-256-GCM helpers para encriptar datos sensibles
 * que viven en la DB (ej: Plaid access_tokens).
 *
 * Key: env var ENCRYPTION_KEY, 32 bytes en base64. Generar con:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 *
 * Formato del ciphertext almacenado: base64(iv | authTag | ciphertext)
 *   - iv: 12 bytes (recomendación NIST para GCM)
 *   - authTag: 16 bytes (default GCM)
 *   - ciphertext: rest
 *
 * Backward compat: maybeDecrypt() detecta si el valor es texto plano
 * (legacy) y lo devuelve tal cual. Esto permite migrar tokens viejos
 * lazily en cada read sin necesidad de migration en DB.
 */
import crypto from "node:crypto"

const ALGORITHM = "aes-256-gcm"
const IV_BYTES   = 12
const TAG_BYTES  = 16

let _keyCache: Buffer | null = null

function getKey(): Buffer {
  if (_keyCache) return _keyCache
  const k = process.env.ENCRYPTION_KEY
  if (!k) {
    throw new Error("[encryption] ENCRYPTION_KEY env var not set. Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"")
  }
  const buf = Buffer.from(k, "base64")
  if (buf.length !== 32) {
    throw new Error(`[encryption] ENCRYPTION_KEY must be 32 bytes (got ${buf.length}). Regenerate with the command in the README.`)
  }
  _keyCache = buf
  return buf
}

/** Encripta `plaintext` y devuelve el ciphertext serializable. */
export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(IV_BYTES)
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv)
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, enc]).toString("base64")
}

/** Decripta un ciphertext generado por encrypt(). Lanza si está corrupto. */
export function decrypt(ciphertext: string): string {
  const data = Buffer.from(ciphertext, "base64")
  if (data.length < IV_BYTES + TAG_BYTES) {
    throw new Error("[encryption] ciphertext too short")
  }
  const iv  = data.subarray(0, IV_BYTES)
  const tag = data.subarray(IV_BYTES, IV_BYTES + TAG_BYTES)
  const enc = data.subarray(IV_BYTES + TAG_BYTES)
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8")
}

/**
 * Detecta si un valor probablemente es un Plaid access_token en texto plano
 * (legacy) versus uno encriptado. Plaid tokens siempre empiezan con
 * "access-" seguido del environment (sandbox / development / production).
 *
 * Esta heurística es suficiente para nuestros migration lazy — un ciphertext
 * base64 jamás empezará con "access-".
 */
export function looksLikePlaintextPlaidToken(value: string): boolean {
  return typeof value === "string" && value.startsWith("access-")
}

/**
 * Decripta si parece encriptado, retorna tal cual si parece plano.
 * Útil para reads donde queremos backward compat con tokens viejos.
 */
export function maybeDecrypt(value: string): string {
  if (looksLikePlaintextPlaidToken(value)) return value
  return decrypt(value)
}
