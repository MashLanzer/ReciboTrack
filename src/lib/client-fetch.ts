/**
 * client-fetch.ts — Authenticated fetch wrapper for client-side API calls.
 *
 * Adds the Firebase ID token automatically as `Authorization: Bearer <token>`.
 * Falls back gracefully if the user is not authenticated — a 401 response
 * triggers an automatic redirect to /login so the user can re-authenticate.
 */

import { getFirebaseAuth } from "@/lib/firebase/client"

/**
 * Returns the current user's Firebase ID token, or null if not signed in.
 * Forces a token refresh if the token might be close to expiry (> 55 min old).
 */
async function getIdToken(): Promise<string | null> {
  try {
    const auth = getFirebaseAuth()
    const user = auth.currentUser
    if (!user) return null

    // Check token expiry from the decoded result — force refresh if < 5 min left
    const tokenResult = await user.getIdTokenResult(/* forceRefresh */ false)
    const expiresAt = new Date(tokenResult.expirationTime).getTime()
    const msLeft = expiresAt - Date.now()
    const needsRefresh = msLeft < 5 * 60 * 1000 // < 5 minutes

    return await user.getIdToken(needsRefresh)
  } catch {
    return null
  }
}

/**
 * Redirect to /login preserving the current path as the `from` param.
 * Called automatically when the server returns 401 (token expired/revoked).
 */
function redirectToLogin() {
  if (typeof window === "undefined") return
  const from = encodeURIComponent(window.location.pathname)
  window.location.replace(`/login?from=${from}&reason=session_expired`)
}

/**
 * Authenticated POST to an internal API route.
 *
 * Equivalent to:
 *   fetch(url, { method: "POST", headers: { "Content-Type": "application/json",
 *     "Authorization": "Bearer <token>" }, body: JSON.stringify(data) })
 *
 * @param url     - The API route path (e.g. "/api/ai-summary")
 * @param data    - The JSON body to send
 * @param options - Optional extra fetch options (e.g. { signal })
 * @returns       The fetch Response (same as native fetch)
 */
export async function authFetch(
  url: string,
  data: unknown,
  options?: Pick<RequestInit, "signal">
): Promise<Response> {
  const token = await getIdToken()

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(data),
    ...options,
  })

  // C4: If server returns 401, session is expired or revoked — redirect to login
  if (res.status === 401) {
    redirectToLogin()
  }

  return res
}
