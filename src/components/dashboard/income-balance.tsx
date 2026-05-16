"use client"

import { useState } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { TrendingUp, TrendingDown, Scale, Plus, Trash2 } from "lucide-react"
import { useIncome, useAddIncome, useDeleteIncome } from "@/hooks/use-income"
import { useExpensesForMonth } from "@/hooks/use-expenses"
import { useUIStore } from "@/stores/ui-store"
import { formatCurrency, cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"

const INCOME_SOURCES = ["Nómina", "Freelance", "Alquiler", "Inversiones", "Otro"] as const

interface AddIncomeFormProps {
  onSuccess: () => void
}

function AddIncomeForm({ onSuccess }: AddIncomeFormProps) {
  const addIncome = useAddIncome()
  const [source, setSource] = useState("Nómina")
  const [amount, setAmount] = useState("")
  const [currency, setCurrency] = useState("USD")
  const [description, setDescription] = useState("")
  const [recurring, setRecurring] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = parseFloat(amount.replace(",", "."))
    if (!parsed || isNaN(parsed) || parsed <= 0) return
    await addIncome.mutateAsync({
      amount: parsed,
      currency,
      source,
      description: description.trim() || undefined,
      date: new Date(),
      recurring,
    })
    onSuccess()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      <div className="space-y-1.5">
        <Label htmlFor="income-source">Origen</Label>
        <Select value={source} onValueChange={setSource}>
          <SelectTrigger id="income-source">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {INCOME_SOURCES.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="income-amount">Importe</Label>
          <Input
            id="income-amount"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="income-currency">Moneda</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger id="income-currency">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["USD", "EUR", "MXN", "COP", "ARS", "CLP", "PEN"].map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="income-description">Descripción (opcional)</Label>
        <Input
          id="income-description"
          placeholder="Ej. Sueldo febrero, Proyecto X…"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={recurring}
          onChange={(e) => setRecurring(e.target.checked)}
          className="rounded border-border"
        />
        <span className="text-sm">Ingreso recurrente mensual</span>
      </label>

      <Button type="submit" className="w-full" disabled={addIncome.isPending}>
        {addIncome.isPending ? "Guardando…" : "Añadir ingreso"}
      </Button>
    </form>
  )
}

interface IncomeBalanceProps {
  year?: number
  month?: number
}

export function IncomeBalance({ year, month }: IncomeBalanceProps) {
  const now = new Date()
  const y = year ?? now.getFullYear()
  const m = month ?? now.getMonth() + 1

  const { activeAccount } = useUIStore()
  const { data: incomeList = [], isLoading: incomeLoading } = useIncome(y, m)
  const { data: expenses = [], isLoading: expensesLoading } = useExpensesForMonth(y, m)

  const deleteIncome = useDeleteIncome()
  const [dialogOpen, setDialogOpen] = useState(false)

  // Filter expenses by active account (same logic as dashboard-stats)
  const filteredExpenses = expenses.filter((e) => {
    if (activeAccount === "business") return e.account === "business"
    return !e.account || e.account === "personal"
  })

  const totalIncome = incomeList.reduce((s, inc) => s + inc.amount, 0)
  const totalExpenses = filteredExpenses.reduce((s, e) => s + (e.total || 0), 0)
  const balance = totalIncome - totalExpenses
  const spentPct = totalIncome > 0 ? Math.min((totalExpenses / totalIncome) * 100, 100) : 0
  const isPositive = balance >= 0

  const monthLabel = format(new Date(y, m - 1), "MMMM yyyy", { locale: es })

  if (incomeLoading || expensesLoading) {
    return (
      <Card>
        <CardContent className="pt-5 pb-5">
          <div className="h-24 animate-pulse rounded-lg bg-muted" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Scale className="h-4 w-4 text-muted-foreground" />
            Ingresos y Balance — {monthLabel}
          </CardTitle>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="icon" variant="outline" className="h-7 w-7">
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Añadir ingreso</DialogTitle>
              </DialogHeader>
              <AddIncomeForm onSuccess={() => setDialogOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* KPI triple */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="space-y-0.5">
            <div className="flex items-center justify-center gap-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              <TrendingUp className="h-3 w-3 text-green-600" />
              Ingresos
            </div>
            <p className="tabular-nums text-sm font-bold text-green-600">
              {formatCurrency(totalIncome)}
            </p>
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center justify-center gap-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              <TrendingDown className="h-3 w-3 text-destructive" />
              Gastos
            </div>
            <p className="tabular-nums text-sm font-bold text-destructive">
              {formatCurrency(totalExpenses)}
            </p>
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center justify-center gap-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              <Scale className="h-3 w-3" />
              Balance
            </div>
            <p className={cn("tabular-nums text-sm font-bold", isPositive ? "text-green-600" : "text-destructive")}>
              {formatCurrency(Math.abs(balance))}
            </p>
          </div>
        </div>

        {/* Net balance highlight */}
        {totalIncome > 0 && (
          <div className={cn(
            "rounded-lg px-4 py-3 text-center space-y-0.5",
            isPositive ? "bg-green-500/10" : "bg-destructive/10"
          )}>
            <p className={cn("text-2xl font-bold tabular-nums", isPositive ? "text-green-600" : "text-destructive")}>
              {isPositive ? "+" : "-"}{formatCurrency(Math.abs(balance))}
            </p>
            <p className={cn("text-xs font-medium", isPositive ? "text-green-700 dark:text-green-400" : "text-destructive")}>
              {isPositive
                ? `✓ Estás ahorrando ${formatCurrency(balance)} este mes`
                : `⚠ Gastas más de lo que ingresas`}
            </p>
          </div>
        )}

        {/* Spending progress bar */}
        {totalIncome > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
              <span>Gastado {spentPct.toFixed(1)}% del ingreso</span>
              <span>{formatCurrency(totalExpenses)} / {formatCurrency(totalIncome)}</span>
            </div>
            <Progress
              value={spentPct}
              className={cn("h-2", spentPct > 90 ? "[&>div]:bg-destructive" : spentPct > 70 ? "[&>div]:bg-amber-500" : "[&>div]:bg-green-500")}
            />
          </div>
        )}

        {/* Income list */}
        {incomeList.length > 0 ? (
          <div className="space-y-1 border-t pt-3">
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
              Ingresos del mes
            </p>
            {incomeList.map((inc) => (
              <div key={inc.id} className="flex items-center gap-3 py-1.5 group">
                <div className="h-7 w-7 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                  <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-medium truncate">{inc.source}</p>
                    {inc.recurring && (
                      <span className="text-[9px] bg-muted text-muted-foreground px-1 py-0.5 rounded-full shrink-0">
                        Recurrente
                      </span>
                    )}
                  </div>
                  {inc.description && (
                    <p className="text-[10px] text-muted-foreground truncate">{inc.description}</p>
                  )}
                </div>
                <p className="text-xs font-semibold tabular-nums text-green-600 shrink-0">
                  +{formatCurrency(inc.amount, inc.currency)}
                </p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteIncome.mutate(inc.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="border-t pt-4 text-center space-y-2 py-2">
            <TrendingUp className="h-8 w-8 mx-auto text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Sin ingresos registrados este mes</p>
            <p className="text-[11px] text-muted-foreground/70">
              Añade tus ingresos para ver tu balance real
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
