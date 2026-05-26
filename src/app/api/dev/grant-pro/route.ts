/**
 * POST /api/dev/grant-pro
 *
 * ⚠️ DEV-ONLY — Concede Pro permanentemente al usuario autenticado, sin pasar
 * por Stripe. Pensado para probar features Pro (bank sync, etc.) durante el
 * desarrollo sin necesidad de pagar.
 *
 * Doble protección:
 *   1. Requiere Firebase auth normal (no anónimos).
 *   2. El UID autenticado debe COINCIDIR EXACTAMENTE con la env var
 *      NEXT_PUBLIC_DEV_PRO_GRANT_UID. Solo un UID puede usar este endpoint.
 *
 * Para deshabilitar: borrar la env var de Vercel.
 */
import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth

  const allowedUid = process.env.NEXT_PUBLIC_DEV_PRO_GRANT_UID
  if (!allowedUid || allowedUid !== auth.uid) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const { error } = await getSupabase()
    .from("profiles")
    .update({
      plan:             "pro",
      plan_expires_at:  null,
      updated_at:       new Date().toISOString(),
    })
    .eq("uid", auth.uid)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
