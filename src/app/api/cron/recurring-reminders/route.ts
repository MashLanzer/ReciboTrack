/**
 * GET /api/cron/recurring-reminders
 *
 * Vercel Cron endpoint — se llama automáticamente a las 09:00 UTC cada día.
 * Configuración en vercel.json:
 *   "crons": [{ "path": "/api/cron/recurring-reminders", "schedule": "0 9 * * *" }]
 *
 * Requiere las siguientes variables de entorno en Vercel:
 *   FIREBASE_SERVICE_ACCOUNT_JSON  — JSON completo de la cuenta de servicio de Firebase
 *   VAPID_PUBLIC_KEY               — Clave pública VAPID (generar con: npx web-push generate-vapid-keys)
 *   VAPID_PRIVATE_KEY              — Clave privada VAPID
 *   VAPID_SUBJECT                  — Email de contacto: mailto:tu@email.com
 *   CRON_SECRET                    — Token secreto para verificar que la llamada viene de Vercel
 *
 * Qué hace:
 *   1. Itera todos los usuarios que tienen suscripción push guardada (users/{uid}/meta/pushSub)
 *   2. Para cada usuario, lee sus pagos recurrentes (users/{uid}/recurring)
 *   3. Encuentra los que vencen en los próximos 2 días
 *   4. Envía una notificación push por cada uno que no haya sido notificado hoy
 */

import { NextRequest, NextResponse } from "next/server"
import webpush from "web-push"
import { getAdminDb } from "@/lib/firebase/admin"

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

function daysUntil(ts: unknown): number {
  let date: Date | null = null
  if (ts && typeof ts === "object" && "toDate" in ts) {
    date = (ts as { toDate(): Date }).toDate()
  } else if (typeof ts === "string") {
    date = new Date(ts)
  }
  if (!date) return Infinity
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const due = new Date(date)
  due.setHours(0, 0, 0, 0)
  return Math.round((due.getTime() - now.getTime()) / 86_400_000)
}

function todayKey(): string {
  return new Date().toISOString().split("T")[0]
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // Verificar que la llamada viene de Vercel Cron (o es una prueba manual con el secret)
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

  const db = getAdminDb()
  const today = todayKey()

  let notified = 0
  let skipped = 0
  let errors = 0

  // 1. Obtener todos los documentos pushSub (collection group query)
  const pushSubDocs = await db.collectionGroup("meta").where("endpoint", ">", "").get()

  for (const pushDoc of pushSubDocs.docs) {
    // Solo procesar docs que están en users/{uid}/meta/pushSub
    const pathParts = pushDoc.ref.path.split("/")
    if (pathParts.length !== 4 || pathParts[2] !== "meta" || pathParts[3] !== "pushSub") continue

    const uid = pathParts[1]
    const subData = pushDoc.data() as {
      endpoint: string
      keys?: { p256dh: string; auth: string }
      expirationTime?: number | null
    }

    // Verificar que la suscripción no haya expirado
    if (subData.expirationTime && Date.now() > subData.expirationTime) {
      skipped++
      continue
    }

    const pushSub: webpush.PushSubscription = {
      endpoint: subData.endpoint,
      keys: subData.keys ?? { p256dh: "", auth: "" },
    }

    // 2. Leer los pagos recurrentes del usuario
    const recurringSnap = await db
      .collection(`users/${uid}/recurring`)
      .where("active", "!=", false)
      .get()

    for (const recDoc of recurringSnap.docs) {
      const item = recDoc.data() as {
        merchant?: string
        total?: number
        currency?: string
        nextDueDate?: unknown
        notifiedOn?: string  // ISO date — última vez que se notificó este ítem
      }

      const days = daysUntil(item.nextDueDate)
      if (days < 0 || days > 2) continue // Solo los próximos 2 días

      // Evitar duplicar la notificación de hoy
      if (item.notifiedOn === today) { skipped++; continue }

      const merchant = item.merchant ?? "Pago recurrente"
      const amount   = item.total?.toFixed(2) ?? "?"
      const currency = item.currency ?? ""
      const dayLabel = days === 0 ? "hoy" : days === 1 ? "mañana" : `en ${days} días`

      const payload = JSON.stringify({
        title: `🔔 Pago recurrente ${dayLabel}: ${merchant}`,
        body:  `Vence ${dayLabel} · ${amount} ${currency}`,
        url:   "/recurring",
        tag:   `recurring-${recDoc.id}-${today}`,
      })

      try {
        await webpush.sendNotification(pushSub, payload)
        // Marcar como notificado hoy para no repetir
        await recDoc.ref.update({ notifiedOn: today })
        notified++
      } catch (err) {
        errors++
        // Si el endpoint ya no es válido (410 Gone), limpiar la suscripción
        if (err instanceof webpush.WebPushError && err.statusCode === 410) {
          await pushDoc.ref.delete()
        }
      }
    }
  }

  return NextResponse.json({
    ok: true,
    date: today,
    notified,
    skipped,
    errors,
  })
}
