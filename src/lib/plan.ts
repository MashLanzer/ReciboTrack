import { getSupabase } from "@/lib/supabase/server"

export type Plan = "free" | "pro"

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

export const PLAN_LIMITS = {
  free: { maxExpenses: 100, csvExport: false, pdfReport: false, workspaces: 0, forecast: false },
  pro:  { maxExpenses: Infinity, csvExport: true, pdfReport: true, workspaces: 3, forecast: true },
} as const
