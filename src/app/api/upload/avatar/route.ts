/**
 * POST /api/upload/avatar
 *
 * Sube una imagen de perfil a Supabase Storage (bucket "avatars").
 * Devuelve la URL pública del archivo subido.
 *
 * Body: FormData con campo "file" (image/jpeg | image/png | image/webp)
 * Headers: Authorization: Bearer <Firebase ID token>
 *
 * Respuesta: { url: string }
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

const BUCKET = "avatars"
const MAX_SIZE = 5 * 1024 * 1024 // 5 MB
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"])

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
    return NextResponse.json({ error: "Tipo de archivo no permitido. Usa JPEG, PNG o WebP." }, { status: 400 })
  }

  const arrayBuffer = await file.arrayBuffer()
  if (arrayBuffer.byteLength > MAX_SIZE) {
    return NextResponse.json({ error: "La imagen no puede superar 5 MB" }, { status: 413 })
  }

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg"
  // Siempre el mismo path por usuario → upsert automático (no acumula archivos viejos)
  const path = `${uid}/avatar.${ext}`

  const sb = getSupabase()
  const { error } = await sb.storage
    .from(BUCKET)
    .upload(path, arrayBuffer, {
      contentType: file.type,
      upsert: true,       // sobreescribe si ya existe
      cacheControl: "3600",
    })

  if (error) {
    console.error("[upload/avatar]", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // URL pública (bucket público → no necesita signing)
  const { data: urlData } = sb.storage.from(BUCKET).getPublicUrl(path)

  // Actualizar photo_url en la tabla profiles
  await sb.from("profiles").update({ photo_url: urlData.publicUrl }).eq("uid", uid)

  return NextResponse.json({ url: urlData.publicUrl })
}
