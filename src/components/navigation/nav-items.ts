import { LayoutDashboard, Receipt, PiggyBank, Tag, BarChart2 } from "lucide-react"

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/expenses", label: "Gastos", icon: Receipt },
  { href: "/analytics", label: "Análisis", icon: BarChart2 },
  { href: "/budgets", label: "Presupuestos", icon: PiggyBank },
  { href: "/categories", label: "Categorías", icon: Tag },
]
