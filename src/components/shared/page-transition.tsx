"use client"

import { usePathname } from "next/navigation"

/**
 * Wraps page content with a fade+slide-up animation on every route change.
 * Uses `key={pathname}` so React remounts the div on navigation, re-triggering the CSS animation.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <div key={pathname} className="animate-[fadeSlideUp_0.18s_ease-out_both]">
      {children}
    </div>
  )
}
