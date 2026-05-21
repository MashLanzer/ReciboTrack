/**
 * Helpers para llamadas autenticadas a los API routes de Next.js.
 * Usa el Firebase ID token del usuario actual como Bearer token.
 */

import { getFirebaseAuth } from "@/lib/firebase/client"
import { Timestamp } from "firebase/firestore"

/** Obtiene el ID token del usuario autenticado */
export async function getAuthToken(): Promise<string> {
  const auth = getFirebaseAuth()
  const user = auth.currentUser
  if (!user) throw new Error("No autenticado")
  return user.getIdToken()
}

/** Fetch autenticado con Bearer token */
export async function apiFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getAuthToken()
  return fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  })
}

/** Convierte un ISO string de fecha a Firebase Timestamp */
export function isoToTimestamp(iso: string | null | undefined): Timestamp {
  if (!iso) return Timestamp.now()
  return Timestamp.fromDate(new Date(iso))
}

/** Convierte un Date a ISO string para enviar a la API */
export function dateToIso(date: Date | string): string {
  if (typeof date === "string") return date
  return date.toISOString()
}
