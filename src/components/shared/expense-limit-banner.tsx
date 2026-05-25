"use client"

import { useState, useEffect } from "react"
import { usePlan } from "@/hooks/use-plan"
import { X } from "lucide-react"

const DISMISSED_KEY = "expense_limit_banner_dismissed"

export function ExpenseLimitBanner() {
  const { data } = usePlan()
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (typeof window !== "undefined") {
      setDismissed(sessionStorage.getItem(DISMISSED_KEY) === "1")
    }
  }, [])

  if (!data || data.plan === "pro" || dismissed) return null

  const { expensesThisMonth, limits } = data
  const maxExpenses = limits.maxExpenses as number
  const usagePct = (expensesThisMonth / maxExpenses) * 100

  if (usagePct < 80) return null

  function handleDismiss() {
    setDismissed(true)
    if (typeof window !== "undefined") {
      sessionStorage.setItem(DISMISSED_KEY, "1")
    }
  }

  return (
    <div className="rounded-2xl border border-warning/30 bg-warning/5 px-4 py-3 flex items-start gap-3">
      <span className="text-lg shrink-0">⚠️</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold">Límite de gastos gratuitos</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Has registrado <strong>{expensesThisMonth}</strong> de {maxExpenses} gastos gratuitos.
          Actualiza a Pro para gastos ilimitados.
        </p>
        <button className="mt-2 rounded-lg bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">
          Actualizar a Pro
        </button>
      </div>
      <button
        onClick={handleDismiss}
        aria-label="Cerrar aviso"
        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors mt-0.5"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
