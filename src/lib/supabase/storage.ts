/**
 * supabase/storage.ts — Helpers CLIENT-SIDE para Supabase Storage.
 *
 * Estos helpers llaman a las API routes de Next.js (server-side),
 * que a su vez usan la service role key para escribir en Supabase Storage.
 *
 * NUNCA importes el cliente Supabase con service role key desde aquí.
 */

/**
 * Sube una imagen de avatar al bucket "avatars".
 * Llama a POST /api/upload/avatar.
 *
 * @param file    Archivo de imagen seleccionado por el usuario
 * @param idToken Firebase ID token del usuario autenticado
 * @returns URL pública del avatar subido
 */
export async function uploadAvatar(file: File, idToken: string): Promise<string> {
  const formData = new FormData()
  formData.append("file", file)

  const res = await fetch("/api/upload/avatar", {
    method: "POST",
    headers: { Authorization: `Bearer ${idToken}` },
    body: formData,
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Error desconocido" }))
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`)
  }

  const data = await res.json() as { url: string }
  return data.url
}

/**
 * Sube una imagen de recibo al bucket "receipts" (privado).
 * Llama a POST /api/upload/receipt.
 *
 * @param file       Archivo de imagen o PDF
 * @param idToken    Firebase ID token del usuario autenticado
 * @param expenseId  ID del gasto asociado (opcional, para naming consistente)
 * @returns Signed URL del recibo (válida 1 año) y path en el bucket
 */
export async function uploadReceipt(
  file: File,
  idToken: string,
  expenseId?: string,
): Promise<{ url: string; path: string }> {
  const formData = new FormData()
  formData.append("file", file)
  if (expenseId) formData.append("expenseId", expenseId)

  const res = await fetch("/api/upload/receipt", {
    method: "POST",
    headers: { Authorization: `Bearer ${idToken}` },
    body: formData,
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Error desconocido" }))
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`)
  }

  return res.json() as Promise<{ url: string; path: string }>
}
