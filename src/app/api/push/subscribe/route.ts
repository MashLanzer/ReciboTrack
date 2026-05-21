/**
 * POST   /api/push/subscribe  — guarda la suscripción push en Supabase
 * DELETE /api/push/subscribe  — elimina la suscripción push
 *
 * La suscripción se guarda en la tabla push_subscriptions.
 * El cron /api/cron/recurring-reminders la usa para enviar notificaciones.
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 })
  }

  const sub = body as Record<string, unknown>
  if (typeof sub.endpoint !== "string" || !sub.endpoint) {
    return NextResponse.json({ error: "Suscripción push inválida" }, { status: 400 })
  }

  const keys = sub.keys as Record<string, string> | undefined

  // Primero asegurarse de que el perfil existe (FK constraint)
  await getSupabase()
    .from("profiles")
    .upsert({ uid, updated_at: new Date().toISOString() }, { onConflict: "uid" })

  const { error } = await getSupabase()
    .from("push_subscriptions")
    .upsert({
      uid,
      endpoint:        sub.endpoint,
      p256dh:          keys?.p256dh ?? null,
      auth_key:        keys?.auth ?? null,
      expiration_time: sub.expirationTime != null ? Number(sub.expirationTime) : null,
      created_at:      new Date().toISOString(),
    }, { onConflict: "uid" })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  const { error } = await getSupabase()
    .from("push_subscriptions")
    .delete()
    .eq("uid", uid)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
