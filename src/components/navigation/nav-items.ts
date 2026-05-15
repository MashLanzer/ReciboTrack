import { LayoutDashboard, Receipt, PiggyBank, Tag, BarChart2, Users } from "lucide-react"

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/expenses", label: "Gastos", icon: Receipt },
  { href: "/analytics", label: "Análisis", icon: BarChart2 },
  { href: "/groups", label: "Grupos", icon: Users },
  { href: "/budgets", label: "Presupuestos", icon: PiggyBank },
  { href: "/categories", label: "Categorías", icon: Tag },
]
