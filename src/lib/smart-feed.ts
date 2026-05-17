import type { Expense } from "@/types"
import { differenceInDays } from "date-fns"

// Client-side AI ranking for expenses (no external API needed)
// Scoring algorithm:
// - Recent (last 3 days): +30 points
// - High amount (>2x daily avg): +25 points
// - Unflagged + uncategorized: +20 points
// - New merchant (first time): +15 points
// - Has privacy="group": +10 points
// - Recurring pattern match: -10 points (less surprising)

function expDate(e: Expense): Date {
  return (e.date as { toDate(): Date }).toDate()
}

export interface ScoredExpense extends Expense {
  _score: number
}

export function rankExpenses(
  expenses: Expense[],
  dailyAvg: number,
  knownMerchants: Set<string>
): ScoredExpense[] {
  const now = new Date()

  // Build merchant frequency map for recurring detection
  const merchantFreq = new Map<string, number>()
  for (const e of expenses) {
    const key = e.merchant.trim().toLowerCase()
    merchantFreq.set(key, (merchantFreq.get(key) ?? 0) + 1)
  }

  const scored: ScoredExpense[] = expenses.map((e) => {
    let score = 0
    const d = expDate(e)
    const daysAgo = differenceInDays(now, d)

    // Recent: last 3 days
    if (daysAgo <= 3) score += 30

    // High amount: >2x daily avg
    if (dailyAvg > 0 && e.total > dailyAvg * 2) score += 25

    // Unflagged + uncategorized (still "otros" category)
    if (!e.flagged && (!e.category || e.category === "otros")) score += 20

    // New merchant (first time seen in this expense set vs known merchants)
    const merchantKey = e.merchant.trim().toLowerCase()
    if (!knownMerchants.has(merchantKey)) score += 15

    // Group privacy
    if (e.privacy === "group") score += 10

    // Recurring pattern (merchant appears 3+ times in set): less interesting
    if ((merchantFreq.get(merchantKey) ?? 0) >= 3) score -= 10

    return { ...e, _score: score }
  })

  return scored.sort((a, b) => b._score - a._score).slice(0, 8)
}
