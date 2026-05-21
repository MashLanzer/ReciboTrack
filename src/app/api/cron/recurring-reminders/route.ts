/**
 * GET /api/cron/recurring-reminders
 *
 * Vercel Cron endpoint — se llama automáticamente a las 09:00 UTC cada día.
 * Configuración en vercel.json:
 *   "crons": [{ "path": "/api/cron/recurring-reminders", "schedule": "0 9 * * *" }]
 *
 * Requiere las siguientes variables de entorno en Vercel:
 *   SUPABASE_URL                   — URL del proyecto Supabase
 *   SUPABASE_SERVICE_ROLE_KEY      — Clave de servicio de Supabase
 *   VAPID_PUBLIC_KEY               — Clave pública VAPID
 *   VAPID_PRIVATE_KEY              — Clave privada VAPID
 *   VAPID_SUBJECT                  — Email de contacto: mailto:tu@email.com
 *   CRON_SECRET                    — Token secreto para verificar que la llamada viene de Vercel
 *
 * Qué hace:
 *   1. Lee todos los usuarios con suscripción push guardada (push_subscriptions)
 *   2. Para cada usuario, lee sus pagos recurrentes (recurring)
 *   3. Encuentra los que vencen en los próximos 2 días
 *   4. Envía una notificación push por cada uno que no haya sido notificado hoy
 */

import { NextRequest, NextResponse } from "next/server"
import webpush from "web-push"
import { getSupabase } from "@/lib/supabase/server"

// ── VAPID setup ───────────────────────────────────────────────────────────────

const VAPID_PUBLIC_KEY  = process.env.VAPID_PUBLIC_KEY  ?? ""
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? ""
const VAPID_SUBJECT     = process.env.VAPID_SUBJECT     ?? "mailto:admin@recibotrack.app"
const CRON_SECRET       = process.env.CRON_SECRET       ?? ""

function setupVapid() {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    throw new Error("[cron] VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY no configurados")
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysUntil(dateStr: string | null | undefined): number {
  if (!dateStr) return Infinity
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const due = new Date(dateStr)
  due.setHours(0, 0, 0, 0)
  return Math.round((due.getTime() - now.getTime()) / 86_400_000)
}

function todayKey(): string {
  return new Date().toISOString().split("T")[0]
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // Verificar que la llamada viene de Vercel Cron o tiene el secret correcto
  const authHeader = req.headers.get("authorization") ?? ""
  const cronHeader  = req.headers.get("x-vercel-cron-signature") ?? ""

  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}` && !cronHeader) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    setupVapid()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  const sb    = getSupabase()
  const today = todayKey()

  let notified = 0
  let skipped  = 0
  let errors   = 0

  // 1. Obtener todas las suscripciones push activas
  const { data: subs, error: subsError } = await sb
    .from("push_subscriptions")
    .select("uid, endpoint, p256dh, auth_key, expiration_time")

  if (subsError) {
    return NextResponse.json({ error: subsError.message }, { status: 500 })
  }

  for (const sub of subs ?? []) {
    // Verificar que la suscripción no haya expirado
    if (sub.expiration_time && Date.now() > Number(sub.expiration_time)) {
      skipped++
      continue
    }

    const pushSub: webpush.PushSubscription = {
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.p256dh ?? "",
        auth:   sub.auth_key ?? "",
      },
    }

    // 2. Leer los pagos recurrentes activos del usuario
    const { data: items, error: itemsError } = await sb
      .from("recurring")
      .select("id, merchant, total, currency, next_due_date, notified_on")
      .eq("uid", sub.uid)
      .eq("active", true)

    if (itemsError) {
      errors++
      continue
    }

    for (const item of items ?? []) {
      const days = daysUntil(item.next_due_date)
      if (days < 0 || days > 2) continue // Solo los próximos 2 días

      // Evitar duplicar la notificación de hoy
      if (item.notified_on === today) { skipped++; continue }

      const merchant = item.merchant ?? "Pago recurrente"
      const amount   = Number(item.total).toFixed(2)
      const currency = item.currency ?? ""
      const dayLabel = days === 0 ? "hoy" : days === 1 ? "mañana" : `en ${days} días`

      const payload = JSON.stringify({
        title: `🔔 Pago recurrente ${dayLabel}: ${merchant}`,
        body:  `Vence ${dayLabel} · ${amount} ${currency}`,
        url:   "/recurring",
        tag:   `recurring-${item.id}-${today}`,
      })

      try {
        await webpush.sendNotification(pushSub, payload)

        // Marcar como notificado hoy para no repetir
        await sb
          .from("recurring")
          .update({ notified_on: today })
          .eq("id", item.id)

        notified++
      } catch (err) {
        errors++
        // Si el endpoint ya no es válido (410 Gone), limpiar la suscripción
        if (err instanceof webpush.WebPushError && err.statusCode === 410) {
          await sb.from("push_subscriptions").delete().eq("uid", sub.uid)
        }
      }
    }
  }

  return NextResponse.json({ ok: true, date: today, notified, skipped, errors })
}
