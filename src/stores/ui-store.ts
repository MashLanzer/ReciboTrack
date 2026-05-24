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
    }),
    {
      name: "recibotrack-ui",
      // Only persist the account preference, not transient UI state
      partialize: (state) => ({ activeAccount: state.activeAccount }),
    }
  )
)
