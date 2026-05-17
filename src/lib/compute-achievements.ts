/**
 * Gamification: compute unlocked achievements from user data.
 */

export interface Achievement {
  id: string
  emoji: string
  title: string
  description: string
  unlocked: boolean
}

export interface AchievementInput {
  totalExpenses: number
  totalGroups: number
  totalGoals: number
  completedGoals: number
  recurringCount: number
  hasExportedPDF: boolean
  hasWebhook: boolean
  hasBudget: boolean
  streakDays: number // consecutive days with at least one expense
}

export function computeAchievements(input: AchievementInput): Achievement[] {
  const {
    totalExpenses,
    totalGroups,
    totalGoals,
    completedGoals,
    recurringCount,
    hasExportedPDF,
    hasWebhook,
    hasBudget,
    streakDays,
  } = input

  return [
    {
      id: "first_expense",
      emoji: "🎉",
      title: "Primer recibo",
      description: "Registra tu primer gasto",
      unlocked: totalExpenses >= 1,
    },
    {
      id: "ten_expenses",
      emoji: "📊",
      title: "Analista junior",
      description: "Registra 10 gastos",
      unlocked: totalExpenses >= 10,
    },
    {
      id: "fifty_expenses",
      emoji: "🔥",
      title: "Racha imparable",
      description: "Registra 50 gastos",
      unlocked: totalExpenses >= 50,
    },
    {
      id: "hundred_expenses",
      emoji: "💯",
      title: "Centenario",
      description: "Registra 100 gastos",
      unlocked: totalExpenses >= 100,
    },
    {
      id: "five_hundred_expenses",
      emoji: "🏆",
      title: "Maestro del gasto",
      description: "Registra 500 gastos",
      unlocked: totalExpenses >= 500,
    },
    {
      id: "first_group",
      emoji: "👥",
      title: "Trabajo en equipo",
      description: "Únete o crea tu primer grupo",
      unlocked: totalGroups >= 1,
    },
    {
      id: "three_groups",
      emoji: "🌐",
      title: "Organizador nato",
      description: "Participa en 3 grupos",
      unlocked: totalGroups >= 3,
    },
    {
      id: "first_goal",
      emoji: "🎯",
      title: "Empezando a ahorrar",
      description: "Crea tu primera meta de ahorro",
      unlocked: totalGoals >= 1,
    },
    {
      id: "goal_completed",
      emoji: "✅",
      title: "Meta alcanzada",
      description: "Completa una meta de ahorro",
      unlocked: completedGoals >= 1,
    },
    {
      id: "three_goals_completed",
      emoji: "🌟",
      title: "Ahorrador constante",
      description: "Completa 3 metas de ahorro",
      unlocked: completedGoals >= 3,
    },
    {
      id: "recurring_setup",
      emoji: "🔄",
      title: "Automatizador",
      description: "Configura un gasto recurrente",
      unlocked: recurringCount >= 1,
    },
    {
      id: "pdf_export",
      emoji: "📄",
      title: "Contador digital",
      description: "Exporta tu primer PDF",
      unlocked: hasExportedPDF,
    },
    {
      id: "webhook",
      emoji: "⚡",
      title: "Power user",
      description: "Configura un webhook personal",
      unlocked: hasWebhook,
    },
    {
      id: "budget_set",
      emoji: "💰",
      title: "Presupuestador",
      description: "Define un presupuesto mensual",
      unlocked: hasBudget,
    },
    {
      id: "streak_7",
      emoji: "📅",
      title: "Semana perfecta",
      description: "Registra gastos 7 días seguidos",
      unlocked: streakDays >= 7,
    },
    {
      id: "streak_30",
      emoji: "🗓️",
      title: "Mes impecable",
      description: "Registra gastos 30 días seguidos",
      unlocked: streakDays >= 30,
    },
  ]
}
