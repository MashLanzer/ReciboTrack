"use client"

import { useRef, useCallback, useState } from "react"
import { useExpenses, useDeleteExpense, type ExpenseSort } from "@/hooks/use-expenses"
import { useCategories } from "@/hooks/use-categories"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ExpensesGrid } from "./expenses-grid"
import { Search, ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react"
import { EXPENSES_PER_PAGE } from "@/lib/constants"
import { useUIStore } from "@/stores/ui-store"
import { toast } from "sonner"
import { isValid, parseISO } from "date-fns"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"

export function ExpenseGridView() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const search = searchParams.get("q") ?? ""
  const category = searchParams.get("cat") ?? ""
  const page = parseInt(searchParams.get("page") ?? "1", 10)
  const sort = (searchParams.get("sort") ?? "date_desc") as ExpenseSort
  const fromStr = searchParams.get("from") ?? ""
  const toStr = searchParams.get("to") ?? ""

  const startDate = fromStr && isValid(parseISO(fromStr)) ? parseISO(fromStr) : undefined
  const endDate = toStr && isValid(parseISO(toStr)) ? parseISO(toStr) : undefined

  const [searchInput, setSearchInput] = useState(search)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { activeAccount } = useUIStore()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const setParams = useCallback((updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, val] of Object.entries(updates)) {
      if (val === null || val === "") params.delete(key)
      else params.set(key, val)
    }
    if (!("page" in updates)) params.delete("page")
    // preserve grid view param
    params.set("view", "grid")
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }, [searchParams, router, pathname])

  const { data: categories = [] } = useCategories()
  const { data, isLoading } = useExpenses({
    search: search || undefined,
    category: category || undefined,
    startDate,
    endDate,
    page,
    sort,
    account: activeAccount,
  })
  const deleteExpense = useDeleteExpense()

  const expenses = data?.expenses ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / EXPENSES_PER_PAGE)

  function handleSearchChange(val: string) {
    setSearchInput(val)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => setParams({ q: val || null }), 300)
  }

  function handleDelete(id: string) {
    setDeleteTarget(id)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    try {
      await deleteExpense.mutateAsync(deleteTarget)
      toast.success("Gasto eliminado")
    } catch {
      toast.error("Error al eliminar")
    }
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {Array.from({ length: 12 }, (_, i) => (
          <Skeleton key={i} className="h-36 rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <>
    <ConfirmDialog
      open={!!deleteTarget}
      onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}
      title="¿Eliminar este gasto?"
      description="Esta acción no se puede deshacer."
      confirmLabel="Eliminar"
      onConfirm={confirmDelete}
    />
    <div className="space-y-4">
      {/* Search + filter bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Button
          variant={filtersOpen ? "default" : "outline"}
          size="sm"
          className="h-9 px-3 shrink-0"
          onClick={() => setFiltersOpen((o) => !o)}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
        </Button>
      </div>

      {filtersOpen && (
        <div className="flex gap-2 flex-wrap">
          <Select value={category || "all"} onValueChange={(v) => setParams({ cat: v === "all" ? null : v })}>
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={sort}
            onValueChange={(v) => setParams({ sort: v === "date_desc" ? null : v })}
          >
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue placeholder="Ordenar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date_desc">Más reciente</SelectItem>
              <SelectItem value="date_asc">Más antiguo</SelectItem>
              <SelectItem value="amount_desc">Mayor monto</SelectItem>
              <SelectItem value="amount_asc">Menor monto</SelectItem>
              <SelectItem value="merchant_asc">Comercio A-Z</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <ExpensesGrid expenses={expenses} categories={categories} onDelete={handleDelete} />

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">{total} gastos</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setParams({ page: String(page - 1) })} disabled={page === 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm tabular-nums">{page} / {totalPages}</span>
            <Button variant="outline" size="icon" onClick={() => setParams({ page: String(page + 1) })} disabled={page >= totalPages}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
    </>
  )
}
