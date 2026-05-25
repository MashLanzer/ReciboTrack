"use client"

import { useState } from "react"
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts"
import { KeyboardShortcutsOverlay } from "@/components/shared/keyboard-shortcuts-overlay"

interface KeyboardShortcutsProviderProps {
  children: React.ReactNode
}

export function KeyboardShortcutsProvider({ children }: KeyboardShortcutsProviderProps) {
  const [helpOpen, setHelpOpen] = useState(false)

  useKeyboardShortcuts({ onOpenHelp: () => setHelpOpen((o) => !o) })

  return (
    <>
      <KeyboardShortcutsOverlay open={helpOpen} onOpenChange={setHelpOpen} />
      {children}
    </>
  )
}
