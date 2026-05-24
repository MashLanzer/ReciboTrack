"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { Expense } from "@/types"
import type { CategoryDoc } from "@/types"
import { formatCurrency, formatDate } from "@/lib/utils"
import {
  Edit, Trash2, ExternalLink, CreditCard, Hash, FileText,
  Tag, Calendar, ShoppingCart, Receipt, Flag, RefreshCw,
} from "lucide-react"

interface Props {
  expense: Expense | null
  category: CategoryDoc | undefined
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
}

export function ExpenseDetailDialog({ expense, category, onClose, onEdit, onDelete }: Props) {
  if (!expense) return null

  const hasItems = (expense.items?.length ?? 0) > 0
  const hasTax = expense.tax > 0
  const hasSubtotal = expense.subtotal > 0 && expense.subtotal !== expense.total

  return (
    <Dialog open={!!expense} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
        {/* Top color stripe */}
        <div
          className="absolute top-0 left-0 right-0 h-1 z-10"
          style={{ backgroundColor: category?.color ?? "#6b7280" }}
        />

        {/* Header with category colour accent */}
        <div
          className="px-5 pt-6 pb-4 relative"
          style={{ background: `${category?.color ?? "#6b7280"}12` }}
        >
          <DialogHeader className="mb-0">
            <div className="flex items-start gap-3">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl mt-0.5"
                style={{ backgroundColor: `${category?.color ?? "#6b7280"}25` }}
              >
                {category?.icon ?? "📦"}
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-base font-semibold leading-tight text-left">
                  {expense.merchant}
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {category?.name ?? expense.category}
                </p>
                {/* Status badges */}
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {expense.recurringId && (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                      <RefreshCw className="h-2.5 w-2.5" /> Recurrente
                    </span>
                  )}
                  {expense.flagged && (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium">
                      <Flag className="h-2.5 w-2.5" /> Para revisar
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-2xl font-black tabular-nums leading-tight text-destructive">
                  -{formatCurrency(expense.total, expense.currency)}
                </p>
                <p className="text-xs text-muted-foreground font-medium">{expense.currency}</p>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Body */}
        <div className="overflow-y-auto max-h-[60vh] px-5 py-4 space-y-4">

          {/* Date + payment method */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-muted/40 px-3 py-2.5 space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Fecha
              </p>
              <p className="text-sm font-semibold">{formatDate(expense.date.toDate(), "dd MMM yyyy")}</p>
            </div>
            {expense.paymentMethod && (
              <div className="rounded-xl bg-muted/40 px-3 py-2.5 space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                  <CreditCard className="h-3 w-3" /> Pago
                </p>
                <p className="text-sm font-semibold">{expense.paymentMethod}</p>
              </div>
            )}
          </div>

          {/* Amount breakdown */}
          {(hasSubtotal || hasTax) && (
            <div className="rounded-lg border bg-muted/30 divide-y text-sm overflow-hidden">
              {hasSubtotal && (
                <div className="flex justify-between px-3 py-2">
                  <span className="text-muted-foreground text-xs">Subtotal</span>
                  <span className="tabular-nums text-xs">{formatCurrency(expense.subtotal, expense.currency)}</span>
                </div>
              )}
              {hasTax && (
                <div className="flex justify-between px-3 py-2">
                  <span className="text-muted-foreground text-xs">Impuestos</span>
                  <span className="tabular-nums text-xs">{formatCurrency(expense.tax, expense.currency)}</span>
                </div>
              )}
              <div className="flex justify-between px-3 py-3 bg-primary/8 font-bold">
                <span className="text-sm">Total</span>
                <span className="tabular-nums text-sm">{formatCurrency(expense.total, expense.currency)}</span>
              </div>
            </div>
          )}

          {/* Reference */}
          {expense.reference && (
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                <Hash className="h-3 w-3" /> Referencia
              </p>
              <p className="text-sm font-mono">{expense.reference}</p>
            </div>
          )}

          {/* Notes */}
          {expense.notes && (
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                <FileText className="h-3 w-3" /> Notas
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">{expense.notes}</p>
            </div>
          )}

          {/* Tags */}
          {(expense.tags?.length ?? 0) > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                <Tag className="h-3 w-3" /> Etiquetas
              </p>
              <div className="flex flex-wrap gap-1.5">
                {expense.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">#{tag}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Line items */}
          {hasItems && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                <ShoppingCart className="h-3 w-3" /> Artículos ({expense.items.length})
              </p>
              <div className="rounded-lg border overflow-hidden divide-y text-xs">
                {expense.items.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2">
                    <span className="flex-1 truncate">{item.name}</span>
                    <span className="text-muted-foreground shrink-0">×{item.quantity}</span>
                    <span className="tabular-nums font-medium shrink-0">
                      {formatCurrency(item.price * item.quantity, expense.currency)}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between px-3 py-2 bg-muted/40 font-semibold">
                  <span>{expense.items.length} art.</span>
                  <span className="tabular-nums">
                    {formatCurrency(
                      expense.items.reduce((s, it) => s + it.price * it.quantity, 0),
                      expense.currency
                    )}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Receipt image */}
          {expense.receiptImageUrl && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                <Receipt className="h-3 w-3" /> Comprobante
              </p>
              <a
                href={expense.receiptImageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block group relative rounded-xl overflow-hidden border bg-muted/20"
              >
                <img
                  src={expense.receiptImageUrl}
                  alt="Comprobante"
                  className="w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                  style={{ maxHeight: 280 }}
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200 flex items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/60 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5">
                    <ExternalLink className="h-3 w-3" />
                    Ver completo
                  </div>
                </div>
              </a>
            </div>
          )}

          {/* Timestamps */}
          <div className="pt-1 border-t text-xs text-muted-foreground space-y-0.5">
            <p>Creado {formatDate(expense.createdAt.toDate(), "dd MMM yyyy · HH:mm")}</p>
            {expense.updatedAt && expense.updatedAt.seconds !== expense.createdAt.seconds && (
              <p>Editado {formatDate(expense.updatedAt.toDate(), "dd MMM yyyy · HH:mm")}</p>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex gap-2 px-5 py-4 border-t bg-card">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/8"
            onClick={() => { onClose(); onDelete() }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Eliminar
          </Button>
          <Button
            size="sm"
            className="flex-1 gap-1.5 h-10 rounded-xl font-semibold"
            onClick={() => { onClose(); onEdit() }}
          >
            <Edit className="h-4 w-4" />
            Editar gasto
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
