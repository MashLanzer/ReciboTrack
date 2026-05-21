/**
 * POST /api/user-lookup
 *
 * Busca un usuario en el directorio público por email.
 * Devuelve { uid, displayName, photoURL } si existe, o 404 si no.
 *
 * El directorio se construye automáticamente cuando cada usuario inicia sesión:
 * POST /api/profile escribe en profiles + user_directory.
 *
 * Autenticación: requiere ID token válido (el que busca debe estar autenticado).
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

interface LookupBody {
  email: string
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, "ai")
  if (auth instanceof NextResponse) return auth

  let body: LookupBody
  try {
    body = (await req.json()) as LookupBody
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 })
  }

  const email = (body.email ?? "").trim().toLowerCase()
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Email inválido" }, { status: 400 })
  }

  const { data, error } = await getSupabase()
    .from("user_directory")
    .select("uid, display_name, photo_url")
    .eq("email", email)
    .single()

  if (error?.code === "PGRST116") {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })
  }
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    uid:         data.uid,
    displayName: data.display_name ?? email.split("@")[0],
    photoURL:    data.photo_url ?? null,
  })
}
