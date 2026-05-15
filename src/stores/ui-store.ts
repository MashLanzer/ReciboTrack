"use client"

import { create } from "zustand"

interface UIStore {
  scannerOpen: boolean
  editExpenseId: string | null
  setScannerOpen: (open: boolean) => void
  setEditExpenseId: (id: string | null) => void
}

export const useUIStore = create<UIStore>((set) => ({
  scannerOpen: false,
  editExpenseId: null,
  setScannerOpen: (open) => set({ scannerOpen: open }),
  setEditExpenseId: (id) => set({ editExpenseId: id }),
}))
