"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useUIStore } from "@/stores/ui-store"

interface UseKeyboardShortcutsOptions {
  onOpenHelp: () => void
}

export function useKeyboardShortcuts({ onOpenHelp }: UseKeyboardShortcutsOptions) {
  const router = useRouter()
  const { setQuickAddOpen, setCommandOpen } = useUIStore()

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // Ignore modifier combos
      if (event.metaKey || event.ctrlKey || event.altKey) return

      // Ignore when focus is inside editable elements
      const target = event.target as HTMLElement
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return
      }

      switch (event.key) {
        case "n":
        case "N":
          event.preventDefault()
          setQuickAddOpen(true)
          break
        case "s":
        case "S":
          event.preventDefault()
          setCommandOpen(true)
          break
        case "b":
        case "B":
          event.preventDefault()
          router.push("/budgets")
          break
        case "r":
        case "R":
          event.preventDefault()
          router.push("/recurring")
          break
        case "?":
          event.preventDefault()
          onOpenHelp()
          break
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [router, setQuickAddOpen, setCommandOpen, onOpenHelp])
}
