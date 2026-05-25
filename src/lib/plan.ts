import { getSupabase } from "@/lib/supabase/server"
export type { Plan } from "@/lib/plan-config"
export { PLAN_LIMITS } from "@/lib/plan-config"

import type { Plan } from "@/lib/plan-config"

export async function getUserPlan(uid: string): Promise<Plan> {
  const supabase = getSupabase()
  const { data } = await supabase
    .from("profiles")
    .select("plan, plan_expires_at")
    .eq("uid", uid)
    .single()
  if (!data) return "free"
  if (data.plan === "pro") {
    if (data.plan_expires_at && new Date(data.plan_expires_at) < new Date()) return "free"
    return "pro"
  }
  return "free"
}
