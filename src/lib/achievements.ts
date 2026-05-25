export const ACHIEVEMENTS = [
  { id: "first_expense",  label: "Primer gasto",            emoji: "🎉", description: "Registraste tu primer gasto" },
  { id: "week_streak_7",  label: "Racha de 7 días",         emoji: "🔥", description: "7 días seguidos registrando gastos" },
  { id: "week_streak_30", label: "Racha de 30 días",        emoji: "💎", description: "30 días seguidos registrando gastos" },
  { id: "budget_keeper",  label: "Guardián del presupuesto", emoji: "🛡️", description: "Un mes completo sin exceder ningún presupuesto" },
  { id: "century",        label: "Centenario",              emoji: "💯", description: "100 gastos registrados" },
  { id: "first_year",     label: "Primer aniversario",      emoji: "🎂", description: "Un año usando ReciboTrack" },
  { id: "saver",          label: "Ahorrador",               emoji: "💰", description: "Tasa de ahorro > 20% por 3 meses" },
] as const

export type AchievementId = typeof ACHIEVEMENTS[number]["id"]
