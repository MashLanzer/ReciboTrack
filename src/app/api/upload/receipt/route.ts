/**
 * POST /api/upload/receipt
 *
 * Sube una imagen de recibo a Supabase Storage (bucket "receipts", privado).
 * Devuelve una signed URL válida por 1 año para mostrar el recibo en la UI.
 *
 * Body: FormData con campo "file" (image/jpeg | image/png | image/webp | application/pdf)
 *       y campo opcional "expenseId" (string) para organizar por gasto
 * Headers: Authorization: Bearer <Firebase ID token>
 *
 * Respuesta: { url: string, path: string }
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

const BUCKET = "receipts"
const MAX_SIZE = 15 * 1024 * 1024 // 15 MB
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"])
const SIGNED_URL_EXPIRY = 60 * 60 * 24 * 365 // 1 año en segundos

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: "FormData inválido" }, { status: 400 })
  }

  const file = formData.get("file")
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "Campo 'file' requerido" }, { status: 400 })
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Tipo de archivo no permitido" }, { status: 400 })
  }

  const arrayBuffer = await file.arrayBuffer()
  if (arrayBuffer.byteLength > MAX_SIZE) {
    return NextResponse.json({ error: "El archivo no puede superar 15 MB" }, { status: 413 })
  }

  const expenseId = formData.get("expenseId") as string | null
  const ext = file.type === "application/pdf" ? "pdf"
    : file.type === "image/png" ? "png"
    : file.type === "image/webp" ? "webp"
    : "jpg"

  const filename = expenseId ? `${expenseId}.${ext}` : `${Date.now()}.${ext}`
  const path = `${uid}/${filename}`

  const sb = getSupabase()
  const { error } = await sb.storage
    .from(BUCKET)
    .upload(path, arrayBuffer, {
      contentType: file.type,
      upsert: true,
      cacheControl: "86400",
    })

  if (error) {
    console.error("[upload/receipt]", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Signed URL válida por 1 año (bucket privado)
  const { data: signedData, error: signError } = await sb.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_EXPIRY)

  if (signError || !signedData) {
    return NextResponse.json({ error: "No se pudo generar la URL firmada" }, { status: 500 })
  }

  return NextResponse.json({ url: signedData.signedUrl, path })
}
