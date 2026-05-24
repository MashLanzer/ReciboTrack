"use client"

import { useState } from "react"
import { useExpenseAuditLog } from "@/hooks/use-groups"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { History, Plus, Pencil, Trash2 } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"

interface AuditLogButtonProps {
  groupId: string
  expenseId: string
  merchant: string
  /** Controlled mode: if provided, the internal open state is ignored */
  open?: boolean
  onOpenChange?: (v: boolean) => void
}

function AuditLogDialog({
  open,
  onOpenChange,
  groupId,
  expenseId,
  merchant,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  groupId: string | null
  expenseId: string | null
  merchant: string
}) {
  const { data: log = [], isLoading } = useExpenseAuditLog(
    open ? groupId : null,
    open ? expenseId : null,
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <History className="h-4 w-4" />
            Historial · {merchant}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2 mt-2">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 rounded-lg" />)}
          </div>
        ) : log.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <History className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Sin historial de cambios</p>
            <p className="text-xs mt-1">Los cambios futuros se registrarán aquí</p>
          </div>
        ) : (
          <div className="space-y-1 mt-1 max-h-80 overflow-y-auto">
            {log.map(entry => {
              const Icon = entry.action === "created" ? Plus
                : entry.action === "deleted" ? Trash2
                : Pencil
              const color = entry.action === "created" ? "text-green-600"
                : entry.action === "deleted" ? "text-destructive"
                : "text-warning"
              return (
                <div key={entry.id} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/20">
                  <div className={`mt-0.5 ${color}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{entry.summary}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {entry.byName} · {format(entry.timestamp.toDate(), "d MMM yyyy HH:mm", { locale: es })}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function AuditLogButton({ groupId, expenseId, merchant, open: openProp, onOpenChange }: AuditLogButtonProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = openProp !== undefined
  const open = isControlled ? openProp : internalOpen
  const setOpen = isControlled ? (onOpenChange ?? (() => {})) : setInternalOpen

  return (
    <>
      {!isControlled && (
        <button
          onClick={(e) => { e.stopPropagation(); setOpen(true) }}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded"
          title="Ver historial de cambios"
        >
          <History className="h-3 w-3" />
          Historial
        </button>
      )}
      <AuditLogDialog
        open={open}
        onOpenChange={setOpen}
        groupId={groupId}
        expenseId={expenseId}
        merchant={merchant}
      />
    </>
  )
}

/** Standalone dialog — use when you want to control open state externally */
export function AuditLogDialog2({
  open,
  onOpenChange,
  groupId,
  expenseId,
  merchant,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  groupId: string
  expenseId: string
  merchant: string
}) {
  return (
    <AuditLogDialog
      open={open}
      onOpenChange={onOpenChange}
      groupId={groupId}
      expenseId={expenseId}
      merchant={merchant}
    />
  )
}
