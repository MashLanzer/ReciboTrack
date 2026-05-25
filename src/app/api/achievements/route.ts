import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"
import { ACHIEVEMENTS } from "@/lib/achievements"

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  const supabase = getSupabase()

  const [achievementsRes, profileRes] = await Promise.all([
    supabase
      .from("user_achievements")
      .select("achievement, earned_at")
      .eq("uid", uid),
    supabase
      .from("profiles")
      .select("current_streak, longest_streak")
      .eq("uid", uid)
      .single(),
  ])

  const earned = (achievementsRes.data ?? []).map((row: { achievement: string; earned_at: string }) => ({
    id: row.achievement,
    earnedAt: row.earned_at,
  }))

  const streak = {
    current: profileRes.data?.current_streak ?? 0,
    longest: profileRes.data?.longest_streak ?? 0,
  }

  // Build full list of all achievements with earned status
  const all = ACHIEVEMENTS.map((a) => ({
    ...a,
    earned: earned.some((e: { id: string }) => e.id === a.id),
    earnedAt: earned.find((e: { id: string }) => e.id === a.id)?.earnedAt ?? null,
  }))

  return NextResponse.json({ earned, all, streak })
}
