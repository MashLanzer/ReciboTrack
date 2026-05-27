/**
 * POST /api/dev/grant-pro
 * Body: { plan?: "pro" | "premium" }
 *
 * ⚠️ DEV-ONLY — Concede Pro o Premium permanentemente al usuario
 * autenticado, sin pasar por Stripe. Pensado para probar features de
 * pago durante el desarrollo.
 *
 * Doble protección:
 *   1. Requiere Firebase auth normal.
 *   2. El UID autenticado debe COINCIDIR EXACTAMENTE con la env var
 *      NEXT_PUBLIC_DEV_PRO_GRANT_UID. Solo un UID puede usar este endpoint.
 *
 * Para deshabilitar: borrar la env var de Vercel.
 *
 * El nombre del endpoint conserva "grant-pro" por compat — acepta plan
 * vía body. Default = "premium" (el tier más alto, para que test de
 * features siempre tenga acceso a todo).
 */
import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"
import type { Plan } from "@/lib/plan-config"

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth

  const allowedUid = process.env.NEXT_PUBLIC_DEV_PRO_GRANT_UID
  if (!allowedUid || allowedUid !== auth.uid) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  // Plan deseado (default: premium para tener acceso a todo en dev)
  let plan: Plan = "premium"
  try {
    const body = await req.json() as { plan?: Plan }
    if (body.plan === "pro" || body.plan === "premium" || body.plan === "free") {
      plan = body.plan
    }
  } catch { /* no body, usar default */ }

  const { error } = await getSupabase()
    .from("profiles")
    .update({
      plan,
      plan_expires_at:  null,
      updated_at:       new Date().toISOString(),
    })
    .eq("uid", auth.uid)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, plan })
}
