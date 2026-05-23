"use client"

import { useState, useEffect, useCallback } from "react"
import { ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { haptic } from "@/lib/haptic"

const SHOW_AFTER_PX = 320   // threshold scroll to show the button
const HIDE_AFTER_PX = 80    // hide again when near the top

/**
 * Floating scroll-to-top button — appears when scrolled > 320px,
 * positioned above the mobile nav bar.
 * Respects safe-area-inset-bottom and the 80px nav height.
 */
export function ScrollToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let ticking = false

    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        const y = window.scrollY
        setVisible(y > SHOW_AFTER_PX)
        ticking = false
      })
    }

    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const scrollTop = useCallback(() => {
    haptic.light()
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [])

  return (
    <button
      aria-label="Volver al inicio"
      onClick={scrollTop}
      className={cn(
        "fixed right-4 z-30 md:hidden",
        "h-10 w-10 rounded-full shadow-lg",
        "bg-background/90 backdrop-blur-sm border border-border",
        "flex items-center justify-center text-foreground",
        "transition-all duration-300 ease-out",
        visible
          ? "opacity-100 translate-y-0 pointer-events-auto"
          : "opacity-0 translate-y-4 pointer-events-none",
      )}
      style={{
        bottom: "calc(5rem + env(safe-area-inset-bottom, 0px) + 0.5rem)",
      }}
    >
      <ChevronUp className="h-5 w-5" />
    </button>
  )
}
