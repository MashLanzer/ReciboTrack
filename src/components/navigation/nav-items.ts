import { LayoutDashboard, Receipt, BarChart2, Users, RefreshCw, PiggyBank, Tag, TrendingUp, Briefcase, Target, Plane, Zap, UserCheck, Star, Map, Network, Repeat, Share2, FileText, Sparkles } from "lucide-react"

export type NavItem = { href: string; label: string; icon: React.ElementType }

/** Items principales — aparecen siempre visibles en nav */
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard",  label: "Dashboard",    icon: LayoutDashboard },
  { href: "/expenses",   label: "Gastos",        icon: Receipt },
  { href: "/analytics",  label: "Análisis",      icon: BarChart2 },
  { href: "/groups",     label: "Grupos",        icon: Users },
]

/** Items agrupados por sección — aparecen en el panel "Más" */
export const MORE_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Finanzas",
    items: [
      { href: "/income",            label: "Ingresos",     icon: TrendingUp },
      { href: "/recurring",         label: "Recurrentes",  icon: RefreshCw },
      { href: "/recurring-income",  label: "Ing. Recur.",  icon: Repeat },
      { href: "/budgets",   label: "Presupuestos", icon: PiggyBank },
      { href: "/goals",     label: "Metas",        icon: Target },
      { href: "/trips",     label: "Viajes",       icon: Plane },
    ],
  },
  {
    label: "Organización",
    items: [
      { href: "/categories",   label: "Categorías",   icon: Tag },
      { href: "/quick-access", label: "Acc. Rápidos", icon: Star },
      { href: "/clients",      label: "Clientes",     icon: UserCheck },
      { href: "/projects",     label: "Proyectos",    icon: Briefcase },
      { href: "/workspaces",   label: "Espacios",     icon: Share2 },
    ],
  },
  {
    label: "Herramientas",
    items: [
      { href: "/map",             label: "Mapa",            icon: Map },
      { href: "/graph",           label: "Grafo",           icon: Network },
      { href: "/automations",     label: "Automatizaciones", icon: Zap },
      { href: "/reports/monthly", label: "Reportes",        icon: FileText },
    ],
  },
  {
    label: "Cuenta",
    items: [
      { href: "/pricing", label: "Planes", icon: Sparkles },
    ],
  },
]

/** Flat list for active-state detection (backwards compat) */
export const MORE_ITEMS: NavItem[] = MORE_GROUPS.flatMap((g) => g.items)
