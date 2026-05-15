"use client"

import { useState } from "react"
import { useExpenses, useDeleteExpense, useAddExpense } from "@/hooks/use-expenses"
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
import { Search, MoreHorizontal, Trash2, Edit, Copy, Image, ChevronLeft, ChevronRight, Filter, Tag, X, Upload, Sheet, Loader2 } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { useUIStore } from "@/stores/ui-store"
import { ExpenseEditDialog } from "./expense-edit-dialog"
import { CsvImport } from "./csv-import"
import { exportToCSV, exportToPDF } from "./export-utils"
import { exportToGoogleSheets, SheetsRedirectPending } from "@/lib/google-sheets"
import { ReceiptScanner } from "@/components/receipt-scanner/receipt-scanner"
import { SwipeableRow } from "@/components/shared/swipeable-row"

interface Filters {
  search: string
  category: string
  tag: string
  page: number
}

export function ExpenseList() {
  const [filters, setFilters] = useState<Filters>({ search: "", category: "", tag: "", page: 1 })
  const [editExpense, setEditExpense] = useState<Expense | null>(null)
  const [csvOpen, setCsvOpen] = useState(false)
  const [sheetsLoading, setSheetsLoading] = useState(false)

  const { data, isLoading } = useExpenses({
    search: filters.search || undefined,
    category: filters.category || undefined,
    page: filters.tag ? 1 : filters.page, // reset page when filtering by tag
  })
  const { data: categories = [] } = useCategories()
  const deleteExpense = useDeleteExpense()
  const addExpense = useAddExpense()

  // Tag filtering is client-side (not indexed in Firestore)
  const allExpenses = data?.expenses ?? []
  const expenses = filters.tag
    ? allExpenses.filter((e) => e.tags?.includes(filters.tag))
    : allExpenses
  const total = filters.tag ? expenses.length : (data?.total ?? 0)
  const totalPages = Math.ceil(total / EXPENSES_PER_PAGE)

  // Collect all unique tags from loaded expenses for suggestions
  const allTags = [...new Set(allExpenses.flatMap((e) => e.tags ?? []))].sort()

  const grouped = groupByDate(expenses)

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este gasto?")) return
    try {
      await deleteExpense.mutateAsync(id)
      toast.success("Gasto eliminado")
    } catch {
      toast.error("Error al eliminar")
    }
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
      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
            className="pl-9"
          />
        </div>
        <Select
          value={filters.category || "all"}
          onValueChange={(v) => setFilters({ ...filters, category: v === "all" ? "" : v, page: 1 })}
        >
          <SelectTrigger className="w-36">
            <Filter className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
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
        {allTags.length > 0 && (
          <Select
            value={filters.tag || "all"}
            onValueChange={(v) => setFilters({ ...filters, tag: v === "all" ? "" : v, page: 1 })}
          >
            <SelectTrigger className="w-36">
              <Tag className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
              <SelectValue placeholder="Etiqueta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {allTags.map((tag) => (
                <SelectItem key={tag} value={tag}>#{tag}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <div className="flex gap-1.5 flex-wrap">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setCsvOpen(true)}>
            <Upload className="h-3.5 w-3.5" />
            Importar
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportToCSV(expenses)}>CSV</Button>
          <Button variant="outline" size="sm" onClick={() => exportToPDF(expenses, categories)}>PDF</Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleGoogleSheets} disabled={sheetsLoading}>
            {sheetsLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sheet className="h-3.5 w-3.5" />}
            Sheets
          </Button>
        </div>
      </div>

      {/* Tag activo */}
      {filters.tag && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Filtrando por:</span>
          <button
            onClick={() => setFilters({ ...filters, tag: "", page: 1 })}
            className="inline-flex items-center gap-1 text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            #{filters.tag}
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {expenses.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-sm">No hay gastos que coincidan</p>
        </div>
      ) : (
        <>
          {Object.entries(grouped).map(([dateStr, items]) => {
            const dayTotal = items.reduce((acc, e) => acc + e.total, 0)
            return (
              <div key={dateStr}>
                <div className="sticky top-14 md:top-14 z-10 flex items-center justify-between bg-background/95 backdrop-blur py-2 mb-2 border-b">
                  <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{dateStr}</p>
                  <p className="text-xs tabular-nums font-semibold">{formatCurrency(dayTotal)}</p>
                </div>
                <div className="space-y-2">
                  {items.map((expense) => {
                    const cat = categories.find((c) => c.id === expense.category)
                    return (
                      <SwipeableRow
                        key={expense.id}
                        onEdit={() => setEditExpense(expense)}
                        onDelete={() => handleDelete(expense.id)}
                      >
                      <div
                        className="flex items-center gap-3 py-3 px-1 rounded-lg hover:bg-accent/30 transition-colors group"
                      >
                        <div
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base"
                          style={{ backgroundColor: `${cat?.color ?? "#6b7280"}20` }}
                        >
                          {cat?.icon ?? "📦"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{expense.merchant}</p>
                          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                            <p className="text-xs text-muted-foreground">{cat?.name ?? expense.category}</p>
                            {expense.tags?.map((tag) => (
                              <button
                                key={tag}
                                onClick={(e) => { e.stopPropagation(); setFilters((f) => ({ ...f, tag, page: 1 })) }}
                                className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-secondary-foreground font-medium hover:bg-primary hover:text-primary-foreground transition-colors"
                              >
                                #{tag}
                              </button>
                            ))}
                          </div>
                        </div>
                        <p className="tabular-nums text-sm font-semibold shrink-0">
                          {formatCurrency(expense.total, expense.currency)}
                        </p>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
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
                  onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
                  disabled={filters.page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm tabular-nums">
                  {filters.page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
                  disabled={filters.page >= totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <ExpenseEditDialog expense={editExpense} onClose={() => setEditExpense(null)} />
      <CsvImport open={csvOpen} onClose={() => setCsvOpen(false)} />
      <ReceiptScanner />
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

function ExpenseListSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-lg" />
      ))}
    </div>
  )
}
