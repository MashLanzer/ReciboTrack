"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { useExpenses, useDeleteExpense, useAddExpense, useUpdateExpense, type ExpenseSort } from "@/hooks/use-expenses"
import { useCategories } from "@/hooks/use-categories"
import { formatCurrency, formatDate, toDate } from "@/lib/utils"
import { EXPENSES_PER_PAGE } from "@/lib/constants"
import type { Expense } from "@/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { Search, MoreHorizontal, Trash2, Edit, Copy, Image, ChevronLeft, ChevronRight, Filter, Tag, X, Upload, Sheet, Loader2, CalendarRange, Calendar, CheckSquare, Square, CheckCheck, LayoutList, Layers, Receipt, SlidersHorizontal, ChevronDown } from "lucide-react"
import { startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, subDays, format as fmtDate, parseISO, isValid } from "date-fns"
import { ExpenseEditDialog } from "./expense-edit-dialog"
import { ExpenseDetailDialog } from "./expense-detail-dialog"
import { CsvImport } from "./csv-import"
import { exportToCSV, exportToPDF } from "./export-utils"
import { exportToGoogleSheets, SheetsRedirectPending } from "@/lib/google-sheets"
import { SwipeableRow } from "@/components/shared/swipeable-row"
import { useUIStore } from "@/stores/ui-store"
import { AccountBadge } from "@/components/shared/account-switcher"

export function ExpenseList() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Read filters from URL
  const search = searchParams.get("q") ?? ""
  const category = searchParams.get("cat") ?? ""
  const activeTags = (searchParams.get("tags") ?? "").split(",").filter(Boolean)
  const page = parseInt(searchParams.get("page") ?? "1", 10)
  const fromStr = searchParams.get("from") ?? ""
  const toStr = searchParams.get("to") ?? ""
  const sort = (searchParams.get("sort") ?? "date_desc") as ExpenseSort
  const groupBy = (searchParams.get("group") ?? "date") as "date" | "cat"

  // Parse date range from URL strings
  const startDate = fromStr && isValid(parseISO(fromStr)) ? parseISO(fromStr) : undefined
  const endDate = toStr && isValid(parseISO(toStr)) ? parseISO(toStr) : undefined

  // Local search state — debounced 300ms before updating the URL
  const [searchInput, setSearchInput] = useState(search)
  useEffect(() => { setSearchInput(search) }, [search])
  useEffect(() => {
    const t = setTimeout(() => { if (searchInput !== search) setParams({ q: searchInput }) }, 300)
    return () => clearTimeout(t)
  }, [searchInput]) // eslint-disable-line react-hooks/exhaustive-deps

  const [editExpense, setEditExpense] = useState<Expense | null>(null)
  const [detailExpense, setDetailExpense] = useState<Expense | null>(null)
  const [csvOpen, setCsvOpen] = useState(false)
  const [sheetsLoading, setSheetsLoading] = useState(false)
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkCatOpen, setBulkCatOpen] = useState(false)
  const [bulkCatValue, setBulkCatValue] = useState("")
  const [filtersOpen, setFiltersOpen] = useState(false)
  const { activeAccount } = useUIStore()

  // ── Undo-delete tracking ────────────────────────────────────────────────────
  // IDs hidden optimistically while deletion is pending (within undo window)
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(new Set())
  // Map of id → timeout handle so we can cancel on undo
  const deleteTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  // Update URL params helper — resets to page 1 unless page is explicitly set
  const setParams = useCallback((updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, val] of Object.entries(updates)) {
      if (val === null || val === "") params.delete(key)
      else params.set(key, val)
    }
    if (!("page" in updates)) params.delete("page")
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }, [searchParams, router, pathname])

  const { data: categories = [] } = useCategories()

  // #8 — Validate category from URL against known categories; ignore unknown ones
  const knownCategoryIds = new Set(categories.map(c => c.id))
  const validCategory = category && knownCategoryIds.has(category) ? category : undefined

  const { data, isLoading } = useExpenses({
    search: search || undefined,
    category: validCategory,
    startDate,
    endDate,
    tags: activeTags.length > 0 ? activeTags : undefined,  // #11 — server-side tag filter
    page,
    sort,
    account: activeAccount,
  })
  const deleteExpense = useDeleteExpense()
  const addExpense = useAddExpense()
  const updateExpense = useUpdateExpense()

  // Tags now filtered server-side — no client-side re-filter needed
  const allTags = data?.allTags ?? []
  const allExpenses = (data?.expenses ?? []).filter((e) => !pendingDeleteIds.has(e.id))
  const expenses = allExpenses
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / EXPENSES_PER_PAGE)

  function toggleTag(tag: string) {
    const next = activeTags.includes(tag)
      ? activeTags.filter((t) => t !== tag)
      : [...activeTags, tag]
    setParams({ tags: next.join(",") || null })
  }

  const grouped = groupBy === "cat" ? groupByCategory(expenses, categories) : groupByDate(expenses)

  const hasActiveFilters = !!(search || category || activeTags.length > 0 || fromStr || toStr || sort !== "date_desc")

  const activeFilterCount = [
    !!category,
    activeTags.length > 0,
    !!(fromStr || toStr),
    sort !== "date_desc",
    groupBy !== "date",
  ].filter(Boolean).length

  // Open filter panel automatically when URL already has filters
  useEffect(() => {
    if (activeFilterCount > 0) setFiltersOpen(true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // #13 — Restore sort from localStorage when not present in URL
  useEffect(() => {
    if (!searchParams.get("sort")) {
      const saved = localStorage.getItem("rt-expense-sort") as ExpenseSort | null
      const valid: ExpenseSort[] = ["date_desc", "date_asc", "amount_desc", "amount_asc"]
      if (saved && valid.includes(saved) && saved !== "date_desc") {
        setParams({ sort: saved })
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Bulk selection helpers ────────────────────────────────────────────────
  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function selectAll() {
    setSelectedIds(new Set(expenses.map((e) => e.id)))
  }

  function clearSelection() {
    setSelectedIds(new Set())
  }

  function exitSelectMode() {
    setSelectMode(false)
    setSelectedIds(new Set())
  }

  const selectedExpenses = expenses.filter((e) => selectedIds.has(e.id))

  function scheduleDelete(ids: string[]) {
    // Optimistically hide items
    setPendingDeleteIds((prev) => {
      const next = new Set(prev)
      ids.forEach((id) => next.add(id))
      return next
    })

    const label = ids.length === 1 ? "Gasto eliminado" : `${ids.length} gastos eliminados`

    const toastId = toast(label, {
      duration: 5000,
      action: {
        label: "Deshacer",
        onClick: () => {
          // Cancel all pending timers for these ids
          ids.forEach((id) => {
            const timer = deleteTimers.current.get(id)
            if (timer) { clearTimeout(timer); deleteTimers.current.delete(id) }
          })
          // Restore items
          setPendingDeleteIds((prev) => {
            const next = new Set(prev)
            ids.forEach((id) => next.delete(id))
            return next
          })
          toast.dismiss(toastId)
          toast.info("Eliminación cancelada")
        },
      },
    })

    // Schedule actual deletion after 5 s
    ids.forEach((id) => {
      const timer = setTimeout(async () => {
        deleteTimers.current.delete(id)
        try {
          await deleteExpense.mutateAsync(id)
        } catch {
          // Restore item on error
          setPendingDeleteIds((prev) => { const next = new Set(prev); next.delete(id); return next })
          toast.error("Error al eliminar el gasto")
        }
        setPendingDeleteIds((prev) => { const next = new Set(prev); next.delete(id); return next })
      }, 5000)
      deleteTimers.current.set(id, timer)
    })
  }

  function handleBulkDelete() {
    const ids = [...selectedIds]
    exitSelectMode()
    scheduleDelete(ids)
  }

  async function handleBulkCategory(categoryId: string) {
    const ids = [...selectedIds]
    setBulkCatOpen(false)
    exitSelectMode()
    await Promise.all(ids.map((id) => updateExpense.mutateAsync({ id, input: { category: categoryId } })))
    toast.success(`Categoría actualizada en ${ids.length} gasto${ids.length !== 1 ? "s" : ""}`)
  }

  function applyPreset(preset: string) {
    const now = new Date()
    let from: Date, to: Date
    switch (preset) {
      case "this-month":
        from = startOfMonth(now); to = endOfMonth(now); break
      case "last-month": {
        const prev = subMonths(now, 1)
        from = startOfMonth(prev); to = endOfMonth(prev); break
      }
      case "last-30":
        from = subDays(now, 30); to = now; break
      case "last-90":
        from = subDays(now, 90); to = now; break
      case "this-year":
        from = startOfYear(now); to = endOfYear(now); break
      default: return
    }
    setParams({ from: fmtDate(from, "yyyy-MM-dd"), to: fmtDate(to, "yyyy-MM-dd") })
    setDatePickerOpen(false)
  }

  function dateRangeLabel() {
    if (!fromStr && !toStr) return null
    if (fromStr && toStr) return `${fromStr} → ${toStr}`
    if (fromStr) return `Desde ${fromStr}`
    return `Hasta ${toStr}`
  }

  function handleDelete(id: string) {
    // Close detail dialog if open for this expense
    if (detailExpense?.id === id) setDetailExpense(null)
    scheduleDelete([id])
  }

  async function handleGoogleSheets() {
    setSheetsLoading(true)
    try {
      const url = await exportToGoogleSheets(expenses, categories)
      window.open(url, "_blank")
      toast.success("Hoja de cálculo creada en Google Drive")
    } catch (err) {
      if (err instanceof SheetsRedirectPending) {
        // El navegador bloqueó el popup — se redirigió a Google OAuth.
        // Al volver, la página se refresca y se retoma el export automáticamente.
        toast.info("Redirigiendo a Google para autorizar acceso...")
        return
      }
      toast.error(err instanceof Error ? err.message : "Error exportando a Google Sheets")
    } finally {
      setSheetsLoading(false)
    }
  }

  async function handleDuplicate(expense: Expense) {
    try {
      await addExpense.mutateAsync({
        merchant: expense.merchant,
        date: new Date(),
        items: expense.items,
        subtotal: expense.subtotal,
        tax: expense.tax,
        total: expense.total,
        paymentMethod: expense.paymentMethod,
        reference: null,
        category: expense.category,
        currency: expense.currency,
        notes: expense.notes,
        tags: expense.tags,
        receiptImageUrl: null,
      })
      toast.success("Gasto duplicado")
    } catch {
      toast.error("Error al duplicar")
    }
  }

  if (isLoading) return <ExpenseListSkeleton />

  return (
    <div className="space-y-4">
      {/* ── Row 1: Search + Filter toggle + Export ─────────────────────── */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar comercio, etiqueta, artículo..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        {/* Filter toggle */}
        <Button
          variant={filtersOpen || activeFilterCount > 0 ? "default" : "outline"}
          size="sm"
          className="gap-1.5 shrink-0 h-9 px-3"
          onClick={() => setFiltersOpen((o) => !o)}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="h-4 px-1 text-[10px] bg-background/20 text-inherit border-0">
              {activeFilterCount}
            </Badge>
          )}
        </Button>

        {/* Export + actions overflow */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 w-9 p-0 shrink-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)} className="gap-2">
              <CheckSquare className="h-4 w-4" />
              {selectMode ? "Cancelar selección" : "Seleccionar varios"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setCsvOpen(true)} className="gap-2">
              <Upload className="h-4 w-4" />
              Importar CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={async () => {
              const tid = toast.loading("Generando CSV...")
              await new Promise(r => setTimeout(r, 30))
              exportToCSV(expenses, { start: startDate, end: endDate })
              toast.dismiss(tid)
              toast.success("CSV descargado")
            }} className="gap-2">
              <Sheet className="h-4 w-4" />
              Exportar CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={async () => {
              const tid = toast.loading("Generando PDF...")
              await exportToPDF(expenses, categories, { start: startDate, end: endDate })
              toast.dismiss(tid)
              toast.success("PDF descargado")
            }} className="gap-2">
              <Image className="h-4 w-4" />
              Exportar PDF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleGoogleSheets} disabled={sheetsLoading} className="gap-2">
              {sheetsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sheet className="h-4 w-4" />}
              Google Sheets
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ── Row 2: Collapsible filters ────────────────────────────────── */}
      {filtersOpen && (
        <div className="flex gap-2 flex-wrap items-center">
          {/* Category */}
          <Select
            value={category || "all"}
            onValueChange={(v) => setParams({ cat: v === "all" ? null : v })}
          >
            <SelectTrigger className={`h-8 w-36 text-xs ${category ? "border-primary text-primary" : ""}`}>
              <Filter className="h-3 w-3 mr-1 text-muted-foreground" />
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.icon} {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Tags */}
          {allTags.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className={`h-8 gap-1.5 text-xs ${activeTags.length > 0 ? "border-primary text-primary" : ""}`}>
                  <Tag className="h-3 w-3" />
                  Etiquetas
                  {activeTags.length > 0 && (
                    <Badge variant="secondary" className="ml-0.5 h-4 px-1 text-[10px]">{activeTags.length}</Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-60 overflow-y-auto">
                {allTags.map((tag) => (
                  <DropdownMenuItem key={tag} onClick={() => toggleTag(tag)} className="gap-2 cursor-pointer">
                    <div className={`h-3.5 w-3.5 rounded-sm border flex items-center justify-center transition-colors ${activeTags.includes(tag) ? "bg-primary border-primary" : "border-muted-foreground"}`}>
                      {activeTags.includes(tag) && <span className="text-[8px] text-primary-foreground font-bold">✓</span>}
                    </div>
                    #{tag}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Date range */}
          <DropdownMenu open={datePickerOpen} onOpenChange={setDatePickerOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className={`h-8 gap-1.5 text-xs ${(fromStr || toStr) ? "border-primary text-primary" : ""}`}>
                <CalendarRange className="h-3 w-3" />
                {(fromStr || toStr) ? "Rango activo" : "Fechas"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-60 p-3 space-y-3">
              <div className="space-y-1">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide px-1">Presets</p>
                <div className="grid grid-cols-2 gap-1">
                  {[
                    { key: "this-month", label: "Este mes" },
                    { key: "last-month", label: "Mes pasado" },
                    { key: "last-30", label: "Últimos 30d" },
                    { key: "last-90", label: "Últimos 90d" },
                    { key: "this-year", label: "Este año" },
                  ].map(({ key, label }) => (
                    <button key={key} onClick={() => applyPreset(key)}
                      className="text-xs px-2 py-1.5 rounded-md border hover:bg-accent transition-colors text-left">
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <DropdownMenuSeparator />
              <div className="space-y-1.5">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide px-1">Personalizado</p>
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <Input type="date" value={fromStr} max={toStr || undefined}
                    onChange={(e) => setParams({ from: e.target.value || null })}
                    className="h-7 text-xs flex-1" />
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <Input type="date" value={toStr} min={fromStr || undefined}
                    onChange={(e) => setParams({ to: e.target.value || null })}
                    className="h-7 text-xs flex-1" />
                </div>
                {(fromStr || toStr) && (
                  <Button variant="ghost" size="sm" className="w-full h-7 text-xs text-destructive hover:text-destructive"
                    onClick={() => { setParams({ from: null, to: null }); setDatePickerOpen(false) }}>
                    <X className="h-3 w-3 mr-1" /> Quitar fechas
                  </Button>
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Sort */}
          <Select
            value={sort}
            onValueChange={(v) => {
              localStorage.setItem("rt-expense-sort", v)  // #13 — persist
              setParams({ sort: v === "date_desc" ? null : v })
            }}
          >
            <SelectTrigger className={`h-8 w-36 text-xs ${sort !== "date_desc" ? "border-primary text-primary" : ""}`}>
              <SelectValue placeholder="Ordenar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date_desc">Más reciente</SelectItem>
              <SelectItem value="date_asc">Más antiguo</SelectItem>
              <SelectItem value="amount_desc">Mayor monto</SelectItem>
              <SelectItem value="amount_asc">Menor monto</SelectItem>
            </SelectContent>
          </Select>

          {/* Group-by */}
          <Button
            variant={groupBy === "cat" ? "default" : "outline"}
            size="sm"
            className="h-8 gap-1.5 text-xs shrink-0"
            onClick={() => setParams({ group: groupBy === "cat" ? null : "cat" })}
          >
            <Layers className="h-3 w-3" />
            {groupBy === "cat" ? "Por categoría" : "Por fecha"}
          </Button>

          {/* Clear all */}
          {hasActiveFilters && (
            <button
              onClick={() => router.replace(pathname)}
              className="text-xs text-muted-foreground hover:text-destructive transition-colors underline-offset-2 hover:underline ml-auto"
            >
              Limpiar
            </button>
          )}
        </div>
      )}

      {/* Active filter pills */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Filtros activos:</span>
          {search && (
            <button
              onClick={() => setParams({ q: null })}
              className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-1 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors"
            >
              <Search className="h-2.5 w-2.5" />
              {search}
              <X className="h-2.5 w-2.5" />
            </button>
          )}
          {category && (() => {
            const cat = categories.find((c) => c.id === category)
            return (
              <button
                onClick={() => setParams({ cat: null })}
                className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-1 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors"
              >
                {cat?.icon} {cat?.name ?? category}
                <X className="h-2.5 w-2.5" />
              </button>
            )
          })()}
          {activeTags.map((tag) => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-1 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors"
            >
              #{tag}
              <X className="h-2.5 w-2.5" />
            </button>
          ))}
          {dateRangeLabel() && (
            <button
              onClick={() => setParams({ from: null, to: null })}
              className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-1 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors"
            >
              <CalendarRange className="h-2.5 w-2.5" />
              {dateRangeLabel()}
              <X className="h-2.5 w-2.5" />
            </button>
          )}
          <button
            onClick={() => router.replace(pathname)}
            className="text-xs text-muted-foreground hover:text-destructive transition-colors underline-offset-2 hover:underline"
          >
            Limpiar todo
          </button>
        </div>
      )}

      {expenses.length === 0 ? (
        hasActiveFilters ? (
          /* Filtered to zero — help user reset */
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center">
              <Search className="h-6 w-6 text-muted-foreground/60" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Ningún gasto coincide con estos filtros</p>
              <p className="text-xs text-muted-foreground">Prueba a ampliar el rango de fechas o limpiar la búsqueda</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => router.replace(pathname)}>
              Limpiar todos los filtros
            </Button>
          </div>
        ) : (
          /* No expenses at all — first-time user */
          <div className="flex flex-col items-center justify-center py-20 gap-5 text-center">
            <div className="h-16 w-16 rounded-3xl bg-primary/10 flex items-center justify-center">
              <Receipt className="h-7 w-7 text-primary" />
            </div>
            <div className="space-y-1.5 max-w-[260px]">
              <p className="font-semibold text-base">Aún no tienes gastos</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Escanea un recibo o añade tu primer gasto manualmente para empezar a controlar tus finanzas.
              </p>
            </div>
          </div>
        )
      ) : (
        <>
          {/* Select mode: select-all bar */}
          {selectMode && (
            <div className="flex items-center justify-between px-1 py-2 rounded-lg bg-muted/40 border">
              <span className="text-xs text-muted-foreground">
                {selectedIds.size} de {expenses.length} seleccionados
              </span>
              <div className="flex gap-2">
                {selectedIds.size < expenses.length ? (
                  <button onClick={selectAll} className="text-xs text-primary hover:underline flex items-center gap-1">
                    <CheckCheck className="h-3.5 w-3.5" /> Todos
                  </button>
                ) : (
                  <button onClick={clearSelection} className="text-xs text-muted-foreground hover:underline">
                    Ninguno
                  </button>
                )}
              </div>
            </div>
          )}

          {Object.entries(grouped).map(([groupKey, items]) => {
            const groupTotal = items.reduce((acc, e) => acc + e.total, 0)
            // For category grouping, find the category to show its icon in the header
            const groupCat = groupBy === "cat" ? categories.find((c) => c.id === groupKey) : null
            return (
              <div key={groupKey}>
                <div className="sticky top-14 md:top-14 z-10 flex items-center justify-between bg-background/95 backdrop-blur py-2 mb-2 border-b">
                  <div className="flex items-center gap-2">
                    {groupCat && (
                      <span className="text-sm">{groupCat.icon}</span>
                    )}
                    <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                      {groupCat ? groupCat.name : groupKey}
                    </p>
                    <span className="text-[10px] text-muted-foreground/60 font-normal normal-case tracking-normal">
                      {items.length} gasto{items.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <p className="text-xs tabular-nums font-semibold">{formatCurrency(groupTotal)}</p>
                </div>
                <div className="space-y-2">
                  {items.map((expense) => {
                    const cat = categories.find((c) => c.id === expense.category)
                    return (
                      <SwipeableRow
                        key={expense.id}
                        onEdit={() => setEditExpense(expense)}
                        onDelete={() => handleDelete(expense.id)}
                        disabled={selectMode}
                      >
                      <div
                        className={`flex items-center gap-3 py-3 px-1 rounded-lg transition-colors group cursor-pointer ${
                          selectMode && selectedIds.has(expense.id)
                            ? "bg-primary/8 hover:bg-primary/12"
                            : "hover:bg-accent/30"
                        }`}
                        onClick={() => selectMode ? toggleSelect(expense.id) : setDetailExpense(expense)}
                      >
                        {/* Checkbox (select mode only) */}
                        {selectMode && (
                          <div className="shrink-0 text-primary">
                            {selectedIds.has(expense.id)
                              ? <CheckSquare className="h-5 w-5" />
                              : <Square className="h-5 w-5 text-muted-foreground" />}
                          </div>
                        )}

                        <div
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base"
                          style={{ backgroundColor: `${cat?.color ?? "#6b7280"}20` }}
                        >
                          {cat?.icon ?? "📦"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{expense.merchant}</p>
                          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                            <p className="text-xs text-muted-foreground">
                              {groupBy === "cat"
                                ? formatDate(toDate(expense.date), "dd MMM")
                                : (cat?.name ?? expense.category)}
                            </p>
                            {!selectMode && expense.tags?.map((tag) => (
                              <button
                                key={tag}
                                onClick={(e) => { e.stopPropagation(); toggleTag(tag) }}
                                className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium transition-colors ${activeTags.includes(tag) ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground"}`}
                              >
                                #{tag}
                              </button>
                            ))}
                            {(expense.items?.length ?? 0) > 0 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                                {expense.items.length} art.
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="tabular-nums text-sm font-semibold shrink-0">
                          {formatCurrency(expense.total, expense.currency)}
                        </p>
                        {!selectMode && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setDetailExpense(expense)}>
                                <Edit className="h-4 w-4" />
                                Ver detalle
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setEditExpense(expense)}>
                                <Edit className="h-4 w-4" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDuplicate(expense)}>
                                <Copy className="h-4 w-4" />
                                Duplicar
                              </DropdownMenuItem>
                              {expense.receiptImageUrl && (
                                <DropdownMenuItem asChild>
                                  <a href={expense.receiptImageUrl} target="_blank" rel="noopener noreferrer">
                                    <Image className="h-4 w-4" />
                                    Ver foto
                                  </a>
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => handleDelete(expense.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                                Eliminar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                      </SwipeableRow>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-sm text-muted-foreground">{total} gastos en total</p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setParams({ page: String(page - 1) })}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm tabular-nums">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setParams({ page: String(page + 1) })}
                  disabled={page >= totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <ExpenseDetailDialog
        expense={detailExpense}
        category={categories.find((c) => c.id === detailExpense?.category)}
        onClose={() => setDetailExpense(null)}
        onEdit={() => { setEditExpense(detailExpense); setDetailExpense(null) }}
        onDelete={() => detailExpense && handleDelete(detailExpense.id)}
      />
      <ExpenseEditDialog expense={editExpense} onClose={() => setEditExpense(null)} />
      <CsvImport open={csvOpen} onClose={() => setCsvOpen(false)} />

      {/* ── Sticky bulk action bar ── */}
      {selectMode && selectedIds.size > 0 && (
        <div className="fixed bottom-16 md:bottom-4 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-2 bg-foreground text-background rounded-2xl px-4 py-3 shadow-2xl border border-foreground/10">
            <span className="text-sm font-medium tabular-nums">
              {selectedIds.size} seleccionado{selectedIds.size !== 1 ? "s" : ""}
            </span>
            <span className="text-foreground/30 select-none">·</span>
            <span className="text-sm font-semibold tabular-nums">
              {formatCurrency(selectedExpenses.reduce((s, e) => s + e.total, 0))}
            </span>
            <div className="flex gap-1.5 ml-1">
              <Button
                size="sm"
                variant="secondary"
                className="h-8 text-xs gap-1.5 bg-background/15 hover:bg-background/25 text-background border-0"
                onClick={() => setBulkCatOpen(true)}
              >
                <Tag className="h-3.5 w-3.5" />
                Categoría
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="h-8 text-xs gap-1.5 bg-background/15 hover:bg-background/25 text-background border-0"
                onClick={async () => {
                  const tid = toast.loading("Generando CSV...")
                  await new Promise(r => setTimeout(r, 30))
                  exportToCSV(selectedExpenses, { start: startDate, end: endDate })
                  toast.dismiss(tid)
                  toast.success("CSV descargado")
                }}
              >
                CSV
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="h-8 text-xs gap-1.5 bg-background/15 hover:bg-background/25 text-background border-0"
                onClick={async () => {
                  const tid = toast.loading("Generando PDF...")
                  await exportToPDF(selectedExpenses, categories, { start: startDate, end: endDate })
                  toast.dismiss(tid)
                  toast.success("PDF descargado")
                }}
              >
                PDF
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="h-8 text-xs gap-1.5 bg-destructive/80 hover:bg-destructive text-white border-0"
                onClick={handleBulkDelete}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Eliminar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk category dialog ── */}
      {bulkCatOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setBulkCatOpen(false)} />
          <div className="relative bg-background rounded-2xl border shadow-2xl p-5 w-full max-w-xs space-y-3">
            <p className="text-sm font-semibold">
              Cambiar categoría — {selectedIds.size} gasto{selectedIds.size !== 1 ? "s" : ""}
            </p>
            <Select value={bulkCatValue} onValueChange={setBulkCatValue}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona categoría..." />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setBulkCatOpen(false)}>
                Cancelar
              </Button>
              <Button
                className="flex-1"
                disabled={!bulkCatValue}
                onClick={() => bulkCatValue && handleBulkCategory(bulkCatValue)}
              >
                Aplicar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function groupByDate(expenses: Expense[]): Record<string, Expense[]> {
  const grouped: Record<string, Expense[]> = {}
  for (const expense of expenses) {
    const key = formatDate(toDate(expense.date), "EEEE, dd MMM yyyy")
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(expense)
  }
  return grouped
}

function groupByCategory(expenses: Expense[], categories: { id: string; name: string }[]): Record<string, Expense[]> {
  // Sort categories by total spend descending so highest comes first
  const grouped: Record<string, Expense[]> = {}
  for (const expense of expenses) {
    const key = expense.category
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(expense)
  }
  // Re-order entries: categories with most total spend first
  return Object.fromEntries(
    Object.entries(grouped).sort((a, b) => {
      const totalA = a[1].reduce((s, e) => s + e.total, 0)
      const totalB = b[1].reduce((s, e) => s + e.total, 0)
      return totalB - totalA
    })
  )
}

function ExpenseListSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-lg" />
      ))}
    </div>
  )
}
