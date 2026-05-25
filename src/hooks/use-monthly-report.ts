"use client"

import { useQuery } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-client"
import { useAuth } from "./use-auth"

export interface ReportExpense {
  id:            string
  merchant:      string
  date:          string
  total:         number
  paymentMethod: string | null
  notes:         string
  account:       string
}

export interface ReportCategory {
  name:       string
  amount:     number
  percentage: number
  budget:     number | null
  expenses:   ReportExpense[]
}

export interface MonthlyReport {
  year:        number
  month:       number
  totalSpent:  number
  totalIncome: number
  netBalance:  number
  currency:    string
  categories:  ReportCategory[]
}

export function useMonthlyReport(year: number, month: number) {
  const { user } = useAuth()
  return useQuery<MonthlyReport>({
    queryKey: ["monthly-report", year, month, user?.uid],
    enabled:  !!user && year > 0 && month > 0,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const res = await apiFetch(`/api/reports/monthly?year=${year}&month=${month}`)
      if (!res.ok) throw new Error("Error cargando reporte mensual")
      return res.json() as Promise<MonthlyReport>
    },
  })
}
