"use client"

import { useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { Command } from "cmdk"
import { useUIStore } from "@/stores/ui-store"
import { useAuth } from "@/hooks/use-auth"
import { useCategories } from "@/hooks/use-categories"
import { useQuery } from "@tanstack/react-query"
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore"
import { getFirebaseDb } from "@/lib/firebase/client"
import { formatCurrency, toDate } from "@/lib/utils"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { DEFAULT_CATEGORIES } from "@/lib/constants"
import type { Expense } from "@/types"
import {
  LayoutDashboard, Receipt, BarChart2, Users, RefreshCw,
  PiggyBank, Tag, ScanLine, Plus, Settings, X,
  ArrowRight, Search,
} from "lucide-react"

// ─── Quick-search hook (last 150 expenses, cached 5 min) ─────────────────────

function useSearchExpenses(enabled: boolean) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ["cmd-expenses", user?.uid],
    enabled: !!user && enabled,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      if (!user) return []
      const col = collection(getFirebaseDb(), "users", user.uid, "expenses")
      const q = query(col, orderBy("date", "desc"), limit(150))
      const snap = await getDocs(q)
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Expense)
    },
  })
}

// ─── Navigation & action definitions ─────────────────────────────────────────

const NAV = [
  { label: "Dashboard",     href: "/dashboard",  icon: LayoutDashboard, keywords: "inicio home resumen" },
  { label: "Gastos",        href: "/expenses",   icon: Receipt,          keywords: "gastos lista recibos" },
  { label: "Análisis",      href: "/analytics",  icon: BarChart2,        keywords: "analisis estadisticas graficas" },
  { label: "Grupos",        href: "/groups",     icon: Users,            keywords: "grupos compartido amigos familia" },
  { label: "Recurrentes",   href: "/recurring",  icon: RefreshCw,        keywords: "recurrentes suscripciones fijos" },
  { label: "Presupuestos",  href: "/budgets",    icon: PiggyBank,        keywords: "presupuestos limite mensual" },
  { label: "Categorías",    href: "/categories", icon: Tag,              keywords: "categorias etiquetas" },
  { label: "Perfil y ajustes", href: "/profile", icon: Settings,         keywords: "perfil ajustes configuracion cuenta" },
]

// ─── Main component ───────────────────────────────────────────────────────────

export function CommandPalette() {
  const router = useRouter()
  const { commandOpen, setCommandOpen, setScannerOpen } = useUIStore()
  const { data: categories = [] } = useCategories()
  const { data: expenses = [] } = useSearchExpenses(commandOpen)
  const inputRef = useRef<HTMLInputElement>(null)

  const allCats = categories.length > 0 ? categories : DEFAULT_CATEGORIES

  // Keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setCommandOpen(!commandOpen)
      }
      if (e.key === "Escape" && commandOpen) {
        setCommandOpen(false)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [commandOpen, setCommandOpen])

  // Focus input when opened
  useEffect(() => {
    if (commandOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [commandOpen])

  const close = useCallback(() => setCommandOpen(false), [setCommandOpen])

  function go(href: string) {
    router.push(href)
    close()
  }

  function openScanner() {
    setScannerOpen(true)
    close()
  }

  if (!commandOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={close}
        aria-hidden
      />

      {/* Panel */}
      <div className="fixed left-1/2 top-[12%] z-50 w-full max-w-lg -translate-x-1/2 px-4">
        <Command
          className="rounded-2xl border bg-background shadow-2xl overflow-hidden"
          shouldFilter={false}
        >
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <Command.Input
              ref={inputRef}
              placeholder="Buscar gastos, navegar, acciones rápidas..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <button onClick={close} className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
              <X className="h-4 w-4" />
            </button>
          </div>

          <Command.List className="max-h-[60vh] overflow-y-auto p-2 space-y-1">
            <Command.Empty>
              <div className="flex flex-col items-center py-8 text-muted-foreground gap-2">
                <Search className="h-8 w-8 opacity-30" />
                <p className="text-sm">Sin resultados</p>
              </div>
            </Command.Empty>

            {/* ── Quick actions ── */}
            <ActionGroup heading="Acciones rápidas">
              <ActionItem
                icon={<ScanLine className="h-4 w-4" />}
                label="Escanear recibo"
                sub="Abrir scanner con IA"
                value="escanear recibo scanner foto"
                onSelect={openScanner}
              />
              <ActionItem
                icon={<Plus className="h-4 w-4" />}
                label="Nuevo gasto recurrente"
                sub="Ir a Recurrentes"
                value="nuevo recurrente suscripcion"
                onSelect={() => go("/recurring")}
              />
              <ActionItem
                icon={<PiggyBank className="h-4 w-4" />}
                label="Gestionar presupuestos"
                sub="Ver y editar límites mensuales"
                value="presupuesto limite mensual"
                onSelect={() => go("/budgets")}
              />
            </ActionGroup>

            {/* ── Navigation ── */}
            <ActionGroup heading="Navegar">
              {NAV.map(({ label, href, icon: Icon, keywords }) => (
                <ActionItem
                  key={href}
                  icon={<Icon className="h-4 w-4" />}
                  label={label}
                  value={`${label.toLowerCase()} ${keywords} ${href}`}
                  onSelect={() => go(href)}
                  badge={<ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />}
                />
              ))}
            </ActionGroup>

            {/* ── Categories ── */}
            <ActionGroup heading="Categorías">
              {allCats.map((cat) => (
                <ActionItem
                  key={cat.id}
                  icon={<span className="text-base leading-none">{cat.icon}</span>}
                  label={cat.name}
                  sub="Ver gastos de esta categoría"
                  value={`categoria ${cat.name.toLowerCase()} ${cat.id}`}
                  onSelect={() => go(`/expenses?category=${cat.id}`)}
                />
              ))}
            </ActionGroup>

            {/* ── Expense results ── */}
            {expenses.length > 0 && (
              <ActionGroup heading={`Gastos recientes (${expenses.length})`}>
                {expenses.slice(0, 20).map((e) => {
                  const cat = allCats.find((c) => c.id === e.category)
                  return (
                    <ActionItem
                      key={e.id}
                      icon={<span className="text-base leading-none">{cat?.icon ?? "📦"}</span>}
                      label={e.merchant}
                      sub={`${formatCurrency(e.total, e.currency)} · ${format(toDate(e.date), "d MMM yyyy", { locale: es })}`}
                      value={`${e.merchant.toLowerCase()} ${e.category} ${e.notes ?? ""}`}
                      onSelect={() => go("/expenses")}
                    />
                  )
                })}
              </ActionGroup>
            )}
          </Command.List>

          {/* Footer hint */}
          <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/30">
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded border bg-background font-mono text-[10px]">↑↓</kbd>
                navegar
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded border bg-background font-mono text-[10px]">↵</kbd>
                seleccionar
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded border bg-background font-mono text-[10px]">Esc</kbd>
                cerrar
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground">
              <kbd className="px-1.5 py-0.5 rounded border bg-background font-mono text-[10px]">⌘K</kbd>
            </span>
          </div>
        </Command>
      </div>
    </>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ActionGroup({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <Command.Group
      heading={heading}
      className="[&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5"
    >
      {children}
    </Command.Group>
  )
}

function ActionItem({
  icon, label, sub, value, onSelect, badge,
}: {
  icon: React.ReactNode
  label: string
  sub?: string
  value: string
  onSelect: () => void
  badge?: React.ReactNode
}) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer
        data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground
        hover:bg-accent/50 transition-colors"
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-muted-foreground shrink-0">
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{label}</p>
        {sub && <p className="text-[11px] text-muted-foreground truncate">{sub}</p>}
      </div>
      {badge && <span className="shrink-0">{badge}</span>}
    </Command.Item>
  )
}
