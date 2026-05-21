/**
 * POST /api/user-lookup
 *
 * Busca un usuario en el directorio público por email.
 * Devuelve { uid, displayName, photoURL } si existe, o 404 si no.
 *
 * El directorio se construye automáticamente cuando cada usuario inicia sesión:
 * el cliente escribe su propio documento en userDirectory/{base64email}.
 *
 * Autenticación: requiere ID token válido (el que busca debe estar autenticado).
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getAdminDb } from "@/lib/firebase/admin"

interface LookupBody {
  email: string
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, "ai") // rate-limit moderado
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

  // Clave del directorio: base64 del email (para evitar / en el path de Firestore)
  const key = Buffer.from(email).toString("base64url")

  try {
    const db = getAdminDb()
    const snap = await db.doc(`userDirectory/${key}`).get()

    if (!snap.exists) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })
    }

    const data = snap.data() as {
      uid: string
      displayName?: string
      photoURL?: string
    }

    return NextResponse.json({
      uid:         data.uid,
      displayName: data.displayName ?? email.split("@")[0],
      photoURL:    data.photoURL ?? null,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
