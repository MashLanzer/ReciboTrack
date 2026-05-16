"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

export type ActiveAccount = "personal" | "business"

interface UIStore {
  scannerOpen: boolean
  quickAddOpen: boolean
  editExpenseId: string | null
  sharedFile: File | null
  commandOpen: boolean
  activeAccount: ActiveAccount
  setScannerOpen: (open: boolean) => void
  setQuickAddOpen: (open: boolean) => void
  setEditExpenseId: (id: string | null) => void
  setSharedFile: (file: File | null) => void
  setCommandOpen: (open: boolean) => void
  setActiveAccount: (account: ActiveAccount) => void
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      scannerOpen: false,
      quickAddOpen: false,
      editExpenseId: null,
      sharedFile: null,
      commandOpen: false,
      activeAccount: "personal",
      setScannerOpen: (open) => set({ scannerOpen: open }),
      setQuickAddOpen: (open) => set({ quickAddOpen: open }),
      setEditExpenseId: (id) => set({ editExpenseId: id }),
      setSharedFile: (file) => set({ sharedFile: file }),
      setCommandOpen: (open) => set({ commandOpen: open }),
      setActiveAccount: (account) => set({ activeAccount: account }),
    }),
    {
      name: "recibotrack-ui",
      // Only persist the account preference, not transient UI state
      partialize: (state) => ({ activeAccount: state.activeAccount }),
    }
  )
)
