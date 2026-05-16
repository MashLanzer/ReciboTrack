import { LayoutDashboard, Receipt, BarChart2, Users, RefreshCw, PiggyBank, Tag, TrendingUp, Briefcase } from "lucide-react"

/** Items principales — aparecen siempre visibles en nav */
export const NAV_ITEMS = [
  { href: "/dashboard",  label: "Dashboard",    icon: LayoutDashboard },
  { href: "/expenses",   label: "Gastos",        icon: Receipt },
  { href: "/analytics",  label: "Análisis",      icon: BarChart2 },
  { href: "/groups",     label: "Grupos",        icon: Users },
]

/** Items agrupados — aparecen en el dropdown "Más" */
export const MORE_ITEMS = [
  { href: "/income",     label: "Ingresos",     icon: TrendingUp },
  { href: "/recurring",  label: "Recurrentes",  icon: RefreshCw },
  { href: "/budgets",    label: "Presupuestos", icon: PiggyBank },
  { href: "/categories", label: "Categorías",   icon: Tag },
  { href: "/projects",   label: "Proyectos",    icon: Briefcase },
]
