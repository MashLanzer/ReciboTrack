import { getSupabase } from "@/lib/supabase/server"
import { differenceInMonths, subDays, format } from "date-fns"

export async function checkAndGrantAchievements(uid: string) {
  const supabase = getSupabase()

  // Count total expenses
  const { count } = await supabase
    .from("expenses")
    .select("*", { count: "exact", head: true })
    .eq("uid", uid)

  const toGrant: string[] = []
  if ((count ?? 0) >= 1)   toGrant.push("first_expense")
  if ((count ?? 0) >= 100) toGrant.push("century")

  // Check profile for streak and age
  const { data: profile } = await supabase
    .from("profiles")
    .select("created_at, current_streak, longest_streak, last_expense_date")
    .eq("uid", uid)
    .single()

  if (profile) {
    const ageMonths = differenceInMonths(new Date(), new Date(profile.created_at))
    if (ageMonths >= 12) toGrant.push("first_year")
    if ((profile.current_streak ?? 0) >= 7)  toGrant.push("week_streak_7")
    if ((profile.current_streak ?? 0) >= 30) toGrant.push("week_streak_30")

    // Update streak
    const today     = format(new Date(), "yyyy-MM-dd")
    const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd")
    let newStreak = profile.current_streak ?? 0
    if (profile.last_expense_date === yesterday) {
      newStreak = (profile.current_streak ?? 0) + 1
    } else if (profile.last_expense_date !== today) {
      newStreak = 1
    }
    const longestStreak = Math.max(newStreak, profile.longest_streak ?? 0)
    await supabase
      .from("profiles")
      .update({ last_expense_date: today, current_streak: newStreak, longest_streak: longestStreak })
      .eq("uid", uid)
  }

  // Grant new achievements (upsert ignores duplicates due to UNIQUE constraint)
  for (const achievement of toGrant) {
    await supabase
      .from("user_achievements")
      .upsert({ uid, achievement }, { onConflict: "uid,achievement", ignoreDuplicates: true })
  }
}
