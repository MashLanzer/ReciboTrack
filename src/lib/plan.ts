import { getSupabase } from "@/lib/supabase/server"
export type { Plan, PlanLimits, PlanPricing } from "@/lib/plan-config"
export { PLAN_LIMITS, PLAN_PRICING, planHasAccess } from "@/lib/plan-config"

import type { Plan } from "@/lib/plan-config"
import { planHasAccess, PLAN_LIMITS } from "@/lib/plan-config"

/**
 * Devuelve el plan vigente del usuario, mirando el flag `plan` + expiración.
 * Si plan_expires_at pasó, degrada a 'free'.
 */
export async function getUserPlan(uid: string): Promise<Plan> {
  const supabase = getSupabase()
  const { data } = await supabase
    .from("profiles")
    .select("plan, plan_expires_at")
    .eq("uid", uid)
    .single()
  if (!data) return "free"
  const p = data.plan as Plan
  if (p === "pro" || p === "premium") {
    if (data.plan_expires_at && new Date(data.plan_expires_at) < new Date()) return "free"
    return p
  }
  return "free"
}

/**
 * Throws con status 402 si el usuario no tiene al menos el tier requerido.
 * Para usar en route handlers:
 *
 *   try { await requirePlan(uid, "premium") }
 *   catch (e) { return NextResponse.json({ error: "..." }, { status: 402 }) }
 */
export async function requirePlan(uid: string, required: Plan): Promise<void> {
  const plan = await getUserPlan(uid)
  if (!planHasAccess(plan, required)) {
    const err = new Error(`Plan ${required} required (current: ${plan})`)
    ;(err as Error & { status?: number; required?: Plan; current?: Plan }).status   = 402
    ;(err as Error & { status?: number; required?: Plan; current?: Plan }).required = required
    ;(err as Error & { status?: number; required?: Plan; current?: Plan }).current  = plan
    throw err
  }
}

/** Atajo: requiere al menos Pro (Pro o Premium). */
export async function requirePro(uid: string): Promise<void> {
  return requirePlan(uid, "pro")
}

/** Atajo: requiere Premium. */
export async function requirePremium(uid: string): Promise<void> {
  return requirePlan(uid, "premium")
}

/** Devuelve los límites efectivos del usuario, sin extra DB roundtrip si ya tienes el plan. */
export function getPlanLimits(plan: Plan) {
  return PLAN_LIMITS[plan]
}
