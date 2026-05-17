"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useUIStore } from "@/stores/ui-store"
import { useAddIncome } from "@/hooks/use-income"
import { CURRENCIES } from "@/lib/constants"
import { TrendingUp } from "lucide-react"

const INCOME_SOURCES = ["Nómina", "Freelance", "Alquiler", "Inversiones", "Venta", "Otro"]

function emptyForm() {
  return {
    amount: "",
    currency: "USD",
    source: "Nómina",
    description: "",
    date: new Date().toISOString().split("T")[0],
    recurring: false,
    account: "personal" as "personal" | "business",
  }
}

export function AddIncomeDialog() {
  const { incomeAddOpen, setIncomeAddOpen } = useUIStore()
  const addIncome = useAddIncome()
  const [form, setForm] = useState(emptyForm)

  function handleClose() {
    setIncomeAddOpen(false)
    setForm(emptyForm())
  }

  async function handleSave() {
    const amount = parseFloat(form.amount)
    if (!amount || amount <= 0) return
    await addIncome.mutateAsync({
      amount,
      currency: form.currency,
      source: form.source,
      description: form.description || undefined,
      date: new Date(form.date + "T12:00:00"),
      recurring: form.recurring,
      account: form.account,
    })
    handleClose()
  }

  return (
    <Dialog open={incomeAddOpen} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-600" />
            Añadir ingreso
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Amount + Currency */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Monto *</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                className="tabular-nums"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Moneda</Label>
              <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Source */}
          <div className="space-y-1.5">
            <Label>Fuente</Label>
            <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {INCOME_SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <Label>Fecha</Label>
            <Input
              type="date"
              value={form.date}
              min="2010-01-01"
              max={new Date().toISOString().split("T")[0]}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label>Descripción <span className="text-muted-foreground font-normal">(opcional)</span></Label>
            <Input
              placeholder="Salario enero, proyecto X..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          {/* Recurring + Account row */}
          <div className="flex items-center justify-between rounded-xl border px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">Recurrente</p>
              <p className="text-[11px] text-muted-foreground">Se repite cada mes</p>
            </div>
            <Switch
              checked={form.recurring}
              onCheckedChange={(v) => setForm({ ...form, recurring: v })}
            />
          </div>

          {/* Save */}
          <Button
            className="w-full"
            onClick={handleSave}
            disabled={addIncome.isPending || !form.amount || parseFloat(form.amount) <= 0}
          >
            Guardar ingreso
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
