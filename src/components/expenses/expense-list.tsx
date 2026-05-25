"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { useExpenses, useDeleteExpense, useAddExpense, useUpdateExpense, type ExpenseSort } from "@/hooks/use-expenses"
import { useCategories } from "@/hooks/use-categories"
import { formatCurrency, formatDate, toDate, cn } from "@/lib/utils"
import { haptic } from "@/lib/haptic"
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { Search, MoreHorizontal, Trash2, Edit, Copy, Image, ChevronLeft, ChevronRight, Filter, Tag, X, Upload, Sheet, Loader2, CalendarRange, Calendar, CheckSquare, Square, CheckCheck, Layers, Receipt, SlidersHorizontal, ChevronDown, ScanLine, PenLine, Plus, Scissors, LayoutList, LayoutGrid } from "lucide-react"
import { startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, subDays, format as fmtDate, parseISO, isValid, isToday, isYesterday } from "date-fns"
import { es } from "date-fns/locale"
import { ExpenseEditDialog } from "./expense-edit-dialog"
import { ExpenseDetailDialog } from "./expense-detail-dialog"
import { SplitExpenseDialog } from "./split-expense-dialog"
import { CsvImport } from "./csv-import"
import { exportToCSV, exportToPDF } from "./export-utils"
import { ExportDateRangeDialog } from "./export-date-range-dialog"
import { exportToGoogleSheets, SheetsRedirectPending } from "@/lib/google-sheets"
import { SwipeableRow } from "@/components/shared/swipeable-row"
import { MobileActionSheet } from "@/components/ui/mobile-action-sheet"
import { useUIStore } from "@/stores/ui-store"
import { AccountBadge } from "@/components/shared/account-switcher"
import { useUserSettings, useUpdateUserSettings } from "@/hooks/use-user-settings"
import { useUIPrefs } from "@/hooks/use-ui-prefs"
import { BulkActionsBar } from "./bulk-actions-bar"

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
  const [splitExpense, setSplitExpense] = useState<Expense | null>(null)
  const [csvOpen, setCsvOpen] = useState(false)
  const [sheetsLoading, setSheetsLoading] = useState(false)
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const { activeAccount, setScannerOpen, setQuickAddOpen, expenseViewMode, setExpenseViewMode } = useUIStore()

  // ── Touch device detection (for filter sheet vs inline panel) ──────────
  const [isTouchDevice, setIsTouchDevice] = useState(false)
  useEffect(() => {
    setIsTouchDevice(window.matchMedia("(hover: none) and (pointer: coarse)").matches)
  }, [])

  // ── Swipe hint — shown once per session on the first row ────────────────
  const [showSwipeHint, setShowSwipeHint] = useState(false)
  useEffect(() => {
    try {
      if (!sessionStorage.getItem("rbt_swipe_hint_seen")) {
        setShowSwipeHint(true)
        sessionStorage.setItem("rbt_swipe_hint_seen", "1")
      }
    } catch { /* ignore */ }
  }, [])

  // ── Compact mode — sincronizado con Firestore (compactView en UserSettings) ─
  const { data: settings } = useUserSettings()
  const updateSettings = useUpdateUserSettings()
  const [compactMode, setCompactMode] = useState(expenseViewMode === "compact")
  // Sync initial value from Firestore settings (cross-device), store takes precedence if set
  useEffect(() => {
    if (settings?.compactView !== undefined) {
      const storeCompact = expenseViewMode === "compact"
      setCompactMode(storeCompact || settings.compactView)
    }
  }, [settings?.compactView, expenseViewMode])
  function toggleCompact() {
    const next = !compactMode
    setCompactMode(next)
    setExpenseViewMode(next ? "compact" : "card")
    void updateSettings.mutate({ compactView: next })
  }

  // ── Undo-delete tracking ────────────────────────────────────────────────────
  // exitingIds: currently playing the exit animation (still in DOM, 280ms)
  const [exitingIds, setExitingIds] = useState<Set<string>>(new Set())
  // pendingDeleteIds: hidden from DOM, awaiting undo window to expire (5 s)
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(new Set())
  // Map of id → delete-API timeout handle (cancelled on undo)
  const deleteTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  // Map of id → animation timeout handle (cancelled on fast undo)
  const animTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  // ── Long-press → enter select mode ──────────────────────────────────────
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressStart = useRef<{ x: number; y: number } | null>(null)

  // #1 — Limpiar todos los timers pendientes al desmontar el componente
  // Evita memory leaks y actualizaciones de estado en componentes ya desmontados
  useEffect(() => {
    return () => {
      deleteTimers.current.forEach((timer) => clearTimeout(timer))
      deleteTimers.current.clear()
      animTimers.current.forEach((timer) => clearTimeout(timer))
      animTimers.current.clear()
      if (longPressTimer.current) clearTimeout(longPressTimer.current)
    }
  }, [])

  // #3 — Salir del modo selección múltiple con la tecla Escape
  useEffect(() => {
    if (!selectMode) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") exitSelectMode()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [selectMode]) // eslint-disable-line react-hooks/exhaustive-deps

  function onRowTouchStart(e: React.TouchEvent, id: string) {
    if (selectMode) return
    longPressStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    longPressTimer.current = setTimeout(() => {
      navigator.vibrate?.(40)   // haptic feedback on Android
      setSelectMode(true)
      setSelectedIds(new Set([id]))
      longPressStart.current = null
    }, 300) // #21 — reducido de 420ms a 300ms (estándar mobile)
  }

  function onRowTouchMove(e: React.TouchEvent) {
    if (!longPressStart.current || !longPressTimer.current) return
    const dx = Math.abs(e.touches[0].clientX - longPressStart.current.x)
    const dy = Math.abs(e.touches[0].clientY - longPressStart.current.y)
    if (dx > 8 || dy > 8) {                       // moved → cancel long-press
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
      longPressStart.current = null
    }
  }

  function onRowTouchEnd() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    longPressStart.current = null
  }

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

  const { data, isLoading, isFetching } = useExpenses({
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
    haptic.light()
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

  // ── Restore sort from Firestore uiPrefs when not present in URL ────────────
  const { prefs: uiPrefs, setPref: setUIPref } = useUIPrefs()
  useEffect(() => {
    if (!searchParams.get("sort")) {
      const saved = uiPrefs.expenseSort as ExpenseSort
      const valid: ExpenseSort[] = ["date_desc", "date_asc", "amount_desc", "amount_asc", "merchant_asc", "merchant_desc", "category_asc"]
      if (saved && valid.includes(saved) && saved !== "date_desc") {
        setParams({ sort: saved })
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uiPrefs.expenseSort])

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

  function toggleGroup(groupItems: Expense[]) {
    const allSelected = groupItems.every((e) => selectedIds.has(e.id))
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allSelected) {
        groupItems.forEach((e) => next.delete(e.id))
      } else {
        groupItems.forEach((e) => next.add(e.id))
      }
      return next
    })
  }

  const selectedExpenses = expenses.filter((e) => selectedIds.has(e.id))

  function scheduleDelete(ids: string[]) {
    // ① Start exit animation (item stays in DOM for 280 ms)
    setExitingIds((prev) => {
      const next = new Set(prev)
      ids.forEach((id) => next.add(id))
      return next
    })

    // ② After animation completes, remove from DOM
    ids.forEach((id) => {
      const aTimer = setTimeout(() => {
        animTimers.current.delete(id)
        setPendingDeleteIds((prev) => { const next = new Set(prev); next.add(id); return next })
        setExitingIds((prev) => { const next = new Set(prev); next.delete(id); return next })
      }, 280)
      animTimers.current.set(id, aTimer)
    })

    const label = ids.length === 1 ? "Gasto eliminado" : `${ids.length} gastos eliminados`

    const toastId = toast(label, {
      duration: 5000,
      action: {
        label: "Deshacer",
        onClick: () => {
          // Cancel animation + API timers
          ids.forEach((id) => {
            const aTimer = animTimers.current.get(id)
            if (aTimer) { clearTimeout(aTimer); animTimers.current.delete(id) }
            const dTimer = deleteTimers.current.get(id)
            if (dTimer) { clearTimeout(dTimer); deleteTimers.current.delete(id) }
          })
          // Restore items from both sets
          setExitingIds((prev) => {
            const next = new Set(prev)
            ids.forEach((id) => next.delete(id))
            return next
          })
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

    // ③ Schedule actual API deletion after 5 s
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
      {/* #23 — Background refetch indicator */}
      {isFetching && !isLoading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Actualizando...
        </div>
      )}
      {/* ── Sticky search + filter bar ───────────────────────────────────
           Uses negative horizontal margin + matching padding to extend the
           background edge-to-edge even inside the page's px-4 container.    */}
      <div className="sticky top-14 z-20 -mx-4 px-4 pt-1 pb-3 bg-background/95 backdrop-blur-sm border-b border-border/40 space-y-2">
      {/* Row 1: Search + Filter toggle + Export */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input type="search"
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
          onClick={() => { haptic.light(); setFiltersOpen((o) => !o) }}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="h-4 px-1 text-[10px] bg-background/20 text-inherit border-0">
              {activeFilterCount}
            </Badge>
          )}
        </Button>

        {/* Vista compacta / normal toggle */}
        <Button
          variant={compactMode ? "default" : "outline"}
          size="sm"
          className="h-9 w-9 p-0 shrink-0"
          title={compactMode ? "Vista normal" : "Vista compacta"}
          onClick={() => { haptic.light(); toggleCompact() }}
        >
          {compactMode ? <LayoutList className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
        </Button>

        {/* Actions + view overflow */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 w-9 p-0 shrink-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground py-1">Selección</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)} className="gap-2">
              <CheckSquare className="h-4 w-4" />
              {selectMode ? "Cancelar selección" : "Seleccionar varios"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground py-1">Vista</DropdownMenuLabel>
            <DropdownMenuItem onClick={toggleCompact} className="gap-2">
              <span className={cn(
                "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border transition-colors",
                compactMode ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/40"
              )}>
                {compactMode && <CheckCheck className="h-3 w-3" />}
              </span>
              Vista compacta
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground py-1">Datos</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => setCsvOpen(true)} className="gap-2">
              <Upload className="h-4 w-4" />
              Importar CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setExportDialogOpen(true)} className="gap-2">
              <Sheet className="h-4 w-4" />
              Exportar...
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleGoogleSheets} disabled={sheetsLoading} className="gap-2">
              {sheetsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sheet className="h-4 w-4" />}
              Google Sheets
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ── Row 2: Filters — bottom sheet on mobile, inline on desktop ────── */}

      {/* MOBILE: filter bottom sheet overlay */}
      {filtersOpen && isTouchDevice && (
        <div className="fixed inset-0 z-50" onClick={() => setFiltersOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-150" />
          <div
            className="absolute bottom-0 left-0 right-0 bg-background rounded-t-3xl shadow-2xl max-h-[82vh] overflow-y-auto animate-in slide-in-from-bottom duration-250"
            style={{ paddingBottom: "env(safe-area-inset-bottom, 16px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1 w-10 rounded-full bg-muted-foreground/25" />
            </div>
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-1 pb-3">
              <p className="text-base font-semibold">Filtros</p>
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="tabular-nums">{activeFilterCount} activos</Badge>
              )}
            </div>

            <div className="px-4 space-y-4 pb-4">
              {/* Category */}
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Categoría</p>
                <Select value={category || "all"} onValueChange={(v) => { haptic.light(); setParams({ cat: v === "all" ? null : v }) }}>
                  <SelectTrigger className={`h-11 ${category ? "border-primary text-primary" : ""}`}>
                    <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                    <SelectValue placeholder="Todas las categorías" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las categorías</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.icon} {cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Sort */}
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ordenar por</p>
                <Select value={sort} onValueChange={(v) => { haptic.light(); setUIPref("expenseSort", v); setParams({ sort: v === "date_desc" ? null : v }) }}>
                  <SelectTrigger className={`h-11 ${sort !== "date_desc" ? "border-primary text-primary" : ""}`}>
                    <SelectValue placeholder="Ordenar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date_desc">Más reciente</SelectItem>
                    <SelectItem value="date_asc">Más antiguo</SelectItem>
                    <SelectItem value="amount_desc">Mayor monto</SelectItem>
                    <SelectItem value="amount_asc">Menor monto</SelectItem>
                    <SelectItem value="merchant_asc">Comercio A→Z</SelectItem>
                    <SelectItem value="merchant_desc">Comercio Z→A</SelectItem>
                    <SelectItem value="category_asc">Categoría A→Z</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Group-by */}
              <div className="flex items-center justify-between rounded-xl border px-4 py-3">
                <div>
                  <p className="text-sm font-medium">Agrupar por categoría</p>
                  <p className="text-xs text-muted-foreground">En vez de por fecha</p>
                </div>
                <button
                  onClick={() => { haptic.light(); setParams({ group: groupBy === "cat" ? null : "cat" }) }}
                  className={`relative h-6 w-11 rounded-full transition-colors ${groupBy === "cat" ? "bg-primary" : "bg-muted"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${groupBy === "cat" ? "translate-x-5" : "translate-x-0"}`} />
                </button>
              </div>

              {/* Date presets */}
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rango de fechas</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { key: "this-month", label: "Este mes" },
                    { key: "last-month", label: "Mes pasado" },
                    { key: "last-30",    label: "30 días" },
                    { key: "last-90",    label: "90 días" },
                    { key: "this-year",  label: "Este año" },
                  ].map(({ key, label }) => (
                    <button key={key} onClick={() => { haptic.light(); applyPreset(key) }}
                      className="text-xs px-2 py-2.5 rounded-lg border hover:bg-accent transition-colors font-medium min-h-[44px]">
                      {label}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground px-1">Desde</p>
                    <Input type="date" value={fromStr} max={toStr || undefined}
                      onChange={(e) => setParams({ from: e.target.value || null })}
                      className="h-10 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground px-1">Hasta</p>
                    <Input type="date" value={toStr} min={fromStr || undefined}
                      onChange={(e) => setParams({ to: e.target.value || null })}
                      className="h-10 text-sm" />
                  </div>
                </div>
                {(fromStr || toStr) && (
                  <button onClick={() => setParams({ from: null, to: null })}
                    className="text-xs text-destructive flex items-center gap-1 px-1">
                    <X className="h-3 w-3" /> Quitar fechas
                  </button>
                )}
              </div>

              {/* Tags */}
              {allTags.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Etiquetas</p>
                  <div className="flex flex-wrap gap-2">
                    {allTags.map((tag) => (
                      <button key={tag} onClick={() => toggleTag(tag)}
                        className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors ${
                          activeTags.includes(tag)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background border-border text-foreground"
                        }`}>
                        #{tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom actions */}
            <div className="px-4 pb-2 space-y-2 border-t pt-3">
              {activeFilterCount > 0 && (
                <Button variant="outline" className="w-full h-11" onClick={() => { router.replace(pathname); setFiltersOpen(false) }}>
                  <X className="h-4 w-4 mr-2" /> Limpiar filtros
                </Button>
              )}
              <Button className="w-full h-11" onClick={() => setFiltersOpen(false)}>
                Aplicar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* DESKTOP: inline collapsible panel */}
      {filtersOpen && !isTouchDevice && (
        <div className="flex gap-2 flex-wrap items-center">
          {/* Category */}
          <Select
            value={category || "all"}
            onValueChange={(v) => { haptic.light(); setParams({ cat: v === "all" ? null : v }) }}
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
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">Presets</p>
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
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">Personalizado</p>
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
              haptic.light()
              setUIPref("expenseSort", v)   // C-1: persist en Firestore (cross-device)
              setParams({ sort: v === "date_desc" ? null : v })
            }}
          >
            <SelectTrigger className={`h-8 w-40 text-xs ${sort !== "date_desc" ? "border-primary text-primary" : ""}`}>
              <SelectValue placeholder="Ordenar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date_desc">Más reciente</SelectItem>
              <SelectItem value="date_asc">Más antiguo</SelectItem>
              <SelectItem value="amount_desc">Mayor monto</SelectItem>
              <SelectItem value="amount_asc">Menor monto</SelectItem>
              <SelectItem value="merchant_asc">Comercio A→Z</SelectItem>
              <SelectItem value="merchant_desc">Comercio Z→A</SelectItem>
              <SelectItem value="category_asc">Categoría A→Z</SelectItem>
            </SelectContent>
          </Select>

          {/* Group-by */}
          <Button
            variant={groupBy === "cat" ? "default" : "outline"}
            size="sm"
            className="h-8 gap-1.5 text-xs shrink-0"
            onClick={() => { haptic.light(); setParams({ group: groupBy === "cat" ? null : "cat" }) }}
          >
            <Layers className="h-3 w-3" />
            {groupBy === "cat" ? "Por categoría" : "Por fecha"}
          </Button>

        </div>
      )}{/* /DESKTOP inline filters */}

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
      </div> {/* /sticky search + filter bar */}

      {expenses.length === 0 ? (
        hasActiveFilters ? (
          /* ── Filtered to zero ── */
          <div className="text-center py-12 space-y-3">
            <p className="text-4xl">🔍</p>
            <p className="font-semibold text-base">Sin resultados</p>
            <p className="text-sm text-muted-foreground">
              Ningún gasto coincide con los filtros actuales
            </p>
            <Button variant="outline" size="sm" onClick={() => {
              router.push(pathname)  // clear all filters
            }}>
              Quitar filtros
            </Button>
          </div>
        ) : (
          /* ── No expenses at all ── */
          <div className="text-center py-14 space-y-4">
            <p className="text-5xl">🧾</p>
            <div className="space-y-1">
              <p className="font-semibold text-base">Sin gastos registrados</p>
              <p className="text-sm text-muted-foreground">
                Empieza añadiendo tu primer gasto
              </p>
            </div>
            <div className="flex gap-3 justify-center pt-1">
              <Button onClick={() => setScannerOpen(true)} className="gap-2">
                <ScanLine className="h-4 w-4" />
                Escanear recibo
              </Button>
              <Button variant="outline" onClick={() => setQuickAddOpen(true)} className="gap-2">
                <PenLine className="h-4 w-4" />
                Añadir manual
              </Button>
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

          {Object.entries(grouped).map(([groupKey, items], groupIdx) => {
            const groupTotal = items.reduce((acc, e) => acc + e.total, 0)
            // For category grouping, find the category to show its icon in the header
            const groupCat = groupBy === "cat" ? categories.find((c) => c.id === groupKey) : null
            return (
              <div key={groupKey}>
                <div className="flex items-center gap-2 py-2 mb-2 sticky top-[var(--list-toolbar-h,8rem)] z-10 bg-background/95 backdrop-blur-sm -mx-1 px-1">
                  <div className="h-px flex-1 bg-border/50" />
                  <div className="flex items-center gap-1.5 shrink-0">
                    {selectMode && (
                      <button
                        onClick={() => toggleGroup(items)}
                        className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
                        aria-label={items.every((e) => selectedIds.has(e.id)) ? "Deseleccionar grupo" : "Seleccionar grupo"}
                      >
                        {items.every((e) => selectedIds.has(e.id))
                          ? <CheckSquare className="h-4 w-4 text-primary" />
                          : <Square className="h-4 w-4" />}
                      </button>
                    )}
                    {groupCat && <span className="text-sm">{groupCat.icon}</span>}
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      {groupCat ? groupCat.name : groupKey}
                    </p>
                    <span className="text-[10px] tabular-nums bg-muted text-muted-foreground/70 px-1.5 py-0.5 rounded-full font-medium">
                      {items.length}
                    </span>
                  </div>
                  <div className="h-px flex-1 bg-border/50" />
                  <p className="text-xs tabular-nums font-bold text-foreground/60 shrink-0">{formatCurrency(groupTotal)}</p>
                </div>
                <div className="space-y-2">
                  {items.map((expense, itemIdx) => {
                    const cat = categories.find((c) => c.id === expense.category)
                    const isFirstRow = groupIdx === 0 && itemIdx === 0
                    const staggerIdx = groupIdx * 20 + itemIdx
                    return (
                      <div key={expense.id} className={exitingIds.has(expense.id) ? "item-exiting" : undefined}>
                      <SwipeableRow
                        onEdit={() => setEditExpense(expense)}
                        onDelete={() => handleDelete(expense.id)}
                        disabled={selectMode}
                        showHint={showSwipeHint && isFirstRow && !selectMode}
                      >
                      <div
                        className={`stagger-item flex items-center gap-3 ${compactMode ? "py-2.5" : "py-3"} px-3 rounded-lg transition-all duration-150 group cursor-pointer border-l-[3px] ${
                          selectMode && selectedIds.has(expense.id)
                            ? "bg-primary/8 hover:bg-primary/12"
                            : "hover:bg-muted/50 hover:shadow-sm"
                        }`}
                        style={{ "--i": staggerIdx, borderLeftColor: cat?.color ?? "transparent", ...(compactMode ? { minHeight: 44 } : {}) } as React.CSSProperties}
                        onClick={() => selectMode ? toggleSelect(expense.id) : setDetailExpense(expense)}
                        onTouchStart={(e) => onRowTouchStart(e, expense.id)}
                        onTouchMove={onRowTouchMove}
                        onTouchEnd={onRowTouchEnd}
                      >
                        {/* Checkbox (select mode only) — key changes on toggle → remount → CSS pop */}
                        {selectMode && (
                          <div
                            key={`chk-${expense.id}-${selectedIds.has(expense.id)}`}
                            className={cn(
                              "shrink-0 check-pop",
                              selectedIds.has(expense.id) ? "text-primary" : "text-muted-foreground"
                            )}
                          >
                            {selectedIds.has(expense.id)
                              ? <CheckSquare className="h-5 w-5" />
                              : <Square className="h-5 w-5" />}
                          </div>
                        )}

                        <div
                          className={`flex ${compactMode ? "h-7 w-7 text-sm" : "h-9 w-9 text-base"} shrink-0 items-center justify-center rounded-lg`}
                          style={{ backgroundColor: `${cat?.color ?? "#6b7280"}20` }}
                        >
                          {cat?.icon ?? "📦"}
                        </div>

                        {compactMode ? (
                          /* ── Compact row: single line ── */
                          <p className="flex-1 min-w-0 text-sm truncate">
                            <span className="font-medium">{expense.merchant}</span>
                            <span className="text-muted-foreground"> · {cat?.name ?? expense.category} · {formatDate(toDate(expense.date), "dd MMM")}</span>
                          </p>
                        ) : (
                          /* ── Normal mode: two lines ── */
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{expense.merchant}</p>
                            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                {groupBy !== "cat" && cat?.color && (
                                  <span
                                    className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
                                    style={{ backgroundColor: cat.color }}
                                  />
                                )}
                                {groupBy === "cat"
                                  ? formatDate(toDate(expense.date), "dd MMM")
                                  : (cat?.name ?? expense.category)}
                              </p>
                              {!selectMode && expense.tags?.map((tag) => (
                                <button
                                  key={tag}
                                  onClick={(e) => { e.stopPropagation(); toggleTag(tag) }}
                                  className={`text-xs px-1.5 py-0.5 rounded-full font-medium transition-colors ${activeTags.includes(tag) ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground"}`}
                                >
                                  #{tag}
                                </button>
                              ))}
                              {expense.recurringId && (
                                <span
                                  className="text-xs px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium"
                                  title="Gasto recurrente"
                                >
                                  ↻ Recurrente
                                </span>
                              )}
                              {expense.flagged && (
                                <span
                                  className="text-xs px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium"
                                  title="Marcado para revisar"
                                >
                                  ⚑ Revisar
                                </span>
                              )}
                              {expense.receiptImageUrl && (
                                <span
                                  className="text-xs px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground"
                                  title="Tiene foto de recibo"
                                >
                                  📎 Foto
                                </span>
                              )}
                              {(expense.items?.length ?? 0) > 0 && (
                                <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                                  {expense.items.length} art.
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        <p className="tabular-nums text-sm font-bold shrink-0 text-destructive">
                          -{formatCurrency(expense.total, expense.currency)}
                        </p>
                        {!selectMode && (
                          <MobileActionSheet
                            trigger={
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 touch-target opacity-40 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            }
                            actions={[
                              { label: "Ver detalle", icon: <Receipt className="h-5 w-5" />, onClick: () => setDetailExpense(expense) },
                              { label: "Editar", icon: <Edit className="h-5 w-5" />, onClick: () => setEditExpense(expense) },
                              { label: "Duplicar", icon: <Copy className="h-5 w-5" />, onClick: () => handleDuplicate(expense) },
                              { label: "Dividir", icon: <Scissors className="h-5 w-5" />, onClick: () => setSplitExpense(expense) },
                              ...(expense.receiptImageUrl ? [{
                                label: "Ver foto",
                                icon: <Image className="h-5 w-5" />,
                                onClick: () => window.open(expense.receiptImageUrl!, "_blank"),
                              }] : []),
                              { label: "Eliminar", icon: <Trash2 className="h-5 w-5" />, onClick: () => handleDelete(expense.id), destructive: true, separator: true },
                            ]}
                          />
                        )}
                      </div>
                      </SwipeableRow>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-sm text-muted-foreground">
                {(page - 1) * EXPENSES_PER_PAGE + 1}–{Math.min(page * EXPENSES_PER_PAGE, total)} de {total} gastos
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10"
                  onClick={() => {
                    setParams({ page: String(page - 1) })
                    window.scrollTo({ top: 0, behavior: "smooth" })
                  }}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm tabular-nums font-medium">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10"
                  onClick={() => {
                    setParams({ page: String(page + 1) })
                    window.scrollTo({ top: 0, behavior: "smooth" })
                  }}
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
      {splitExpense && (
        <SplitExpenseDialog
          expense={splitExpense}
          open={!!splitExpense}
          onClose={() => setSplitExpense(null)}
        />
      )}
      <CsvImport open={csvOpen} onClose={() => setCsvOpen(false)} />
      <ExportDateRangeDialog
        open={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        expenses={expenses}
        categories={categories}
      />

      {/* ── Bulk action bar ── */}
      {selectMode && (
        <BulkActionsBar
          selectedIds={[...selectedIds]}
          onClear={exitSelectMode}
          onDeleted={() => {
            exitSelectMode()
          }}
        />
      )}
    </div>
  )
}

function groupByDate(expenses: Expense[]): Record<string, Expense[]> {
  const grouped: Record<string, Expense[]> = {}
  for (const expense of expenses) {
    const d = toDate(expense.date)
    let key: string
    if (isToday(d)) {
      key = "Hoy"
    } else if (isYesterday(d)) {
      key = "Ayer"
    } else {
      key = fmtDate(d, "EEEE, dd MMM yyyy", { locale: es })
    }
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
    <div className="space-y-4">
      {/* Search bar skeleton */}
      <Skeleton className="h-9 w-full rounded-lg" />
      {/* Group 1 */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 py-2">
          <div className="h-px flex-1 bg-border/50" />
          <Skeleton className="h-3.5 w-16 rounded" />
          <div className="h-px flex-1 bg-border/50" />
          <Skeleton className="h-3.5 w-14 rounded" />
        </div>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-3 px-3 rounded-lg border-l-[3px] border-l-muted">
            <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-32 rounded" />
              <Skeleton className="h-3 w-20 rounded" />
            </div>
            <Skeleton className="h-4 w-14 rounded" />
          </div>
        ))}
      </div>
      {/* Group 2 */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 py-2">
          <div className="h-px flex-1 bg-border/50" />
          <Skeleton className="h-3.5 w-24 rounded" />
          <div className="h-px flex-1 bg-border/50" />
          <Skeleton className="h-3.5 w-14 rounded" />
        </div>
        {[...Array(2)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-3 px-3 rounded-lg border-l-[3px] border-l-muted">
            <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-40 rounded" />
              <Skeleton className="h-3 w-16 rounded" />
            </div>
            <Skeleton className="h-4 w-12 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}
