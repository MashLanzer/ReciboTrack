/**
 * POST /api/push/subscribe  — guarda la suscripción push del usuario en Firestore
 * DELETE /api/push/subscribe — elimina la suscripción push
 *
 * La suscripción se guarda en users/{uid}/meta/pushSub
 * El cron /api/cron/recurring-reminders la usa para enviar notificaciones.
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getAdminDb } from "@/lib/firebase/admin"

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, "pay") // reuse rate limit group
  if (auth instanceof NextResponse) return auth

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 })
  }

  // Validar mínimamente que tiene la forma de una PushSubscription
  const sub = body as Record<string, unknown>
  if (typeof sub.endpoint !== "string" || !sub.endpoint) {
    return NextResponse.json({ error: "Suscripción push inválida" }, { status: 400 })
  }

  try {
    const db = getAdminDb()
    await db
      .doc(`users/${auth.uid}/meta/pushSub`)
      .set({ ...sub, savedAt: new Date().toISOString() })

    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth

  try {
    const db = getAdminDb()
    await db.doc(`users/${auth.uid}/meta/pushSub`).delete()
    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
