"use client"
import { useAuth } from "./use-auth"

export function useExportExpensesCSV() {
  const { user } = useAuth()

  return async (filters?: { startDate?: string; endDate?: string; category?: string; account?: string }) => {
    const params = new URLSearchParams()
    if (filters?.startDate) params.set("startDate", filters.startDate)
    if (filters?.endDate) params.set("endDate", filters.endDate)
    if (filters?.category) params.set("category", filters.category)
    if (filters?.account) params.set("account", filters.account)

    const token = await user?.getIdToken()
    const res = await fetch(`/api/export/expenses?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `gastos-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }
}

export function useOpenInvoice() {
  return (projectId: string) => {
    window.open(`/invoices/${projectId}`, "_blank")
  }
}
