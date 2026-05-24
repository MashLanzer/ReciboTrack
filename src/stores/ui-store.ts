"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Expense } from "@/types"

export type ActiveAccount = "personal" | "business"

interface UIStore {
  scannerOpen: boolean
  quickAddOpen: boolean
  incomeAddOpen: boolean
  editExpenseId: string | null
  editExpense: Expense | null
  sharedFile: File | null
  commandOpen: boolean
  activeAccount: ActiveAccount
  roundupExpense: Expense | null
  setScannerOpen: (open: boolean) => void
  setQuickAddOpen: (open: boolean) => void
  setIncomeAddOpen: (open: boolean) => void
  setEditExpenseId: (id: string | null) => void
  setEditExpense: (expense: Expense | null) => void
  setSharedFile: (file: File | null) => void
  setCommandOpen: (open: boolean) => void
  setActiveAccount: (account: ActiveAccount) => void
  setRoundupExpense: (expense: Expense | null) => void
  balanceHidden: boolean
  toggleBalanceHidden: () => void
  expenseViewMode: "card" | "compact"
  setExpenseViewMode: (mode: "card" | "compact") => void
  // Vacation mode (NOT persisted — resets on page refresh)
  vacationMode: { active: boolean; endsAt: number | null }
  isVacationActive: boolean
  setVacationMode: (days: number | null) => void
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      scannerOpen: false,
      quickAddOpen: false,
      incomeAddOpen: false,
      editExpenseId: null,
      editExpense: null,
      sharedFile: null,
      commandOpen: false,
      activeAccount: "personal",
      roundupExpense: null,
      setScannerOpen: (open) => set({ scannerOpen: open }),
      setQuickAddOpen: (open) => set({ quickAddOpen: open }),
      setIncomeAddOpen: (open) => set({ incomeAddOpen: open }),
      setEditExpenseId: (id) => set({ editExpenseId: id }),
      setEditExpense: (expense) => set({ editExpense: expense }),
      setSharedFile: (file) => set({ sharedFile: file }),
      setCommandOpen: (open) => set({ commandOpen: open }),
      setActiveAccount: (account) => set({ activeAccount: account }),
      setRoundupExpense: (expense) => set({ roundupExpense: expense }),
      balanceHidden: false,
      toggleBalanceHidden: () => set((s) => ({ balanceHidden: !s.balanceHidden })),
      expenseViewMode: "card",
      setExpenseViewMode: (mode) => set({ expenseViewMode: mode }),
      // Vacation mode (NOT persisted — resets on page refresh)
      vacationMode: { active: false, endsAt: null },
      isVacationActive: false,
      setVacationMode: (days) => set(() => {
        if (days === null) {
          return { vacationMode: { active: false, endsAt: null }, isVacationActive: false }
        }
        const endsAt = Date.now() + days * 86400000
        return { vacationMode: { active: true, endsAt }, isVacationActive: true }
      }),
    }),
    {
      name: "recibotrack-ui",
      // Only persist the account preference and view mode, not transient UI state
      partialize: (state) => ({ activeAccount: state.activeAccount, expenseViewMode: state.expenseViewMode }),
    }
  )
)
