"use client"

import { create } from "zustand"

interface UIStore {
  scannerOpen: boolean
  editExpenseId: string | null
  sharedFile: File | null
  commandOpen: boolean
  setScannerOpen: (open: boolean) => void
  setEditExpenseId: (id: string | null) => void
  setSharedFile: (file: File | null) => void
  setCommandOpen: (open: boolean) => void
}

export const useUIStore = create<UIStore>((set) => ({
  scannerOpen: false,
  editExpenseId: null,
  sharedFile: null,
  commandOpen: false,
  setScannerOpen: (open) => set({ scannerOpen: open }),
  setEditExpenseId: (id) => set({ editExpenseId: id }),
  setSharedFile: (file) => set({ sharedFile: file }),
  setCommandOpen: (open) => set({ commandOpen: open }),
}))
