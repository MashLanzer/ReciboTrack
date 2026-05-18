"use client"

import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

/**
 * Animates height from 0 → auto using the CSS grid-template-rows trick.
 * No JS measurement needed, works with any content height.
 *
 * Usage:
 *   <CollapsibleContent open={isOpen}>
 *     <div>...content...</div>
 *   </CollapsibleContent>
 */
export function CollapsibleContent({
  open,
  children,
  className,
}: {
  open: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "grid transition-[grid-template-rows] duration-300 ease-out",
        open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
      )}
    >
      {/* overflow-hidden clips content when height is 0; min-h-0 lets grid compress it */}
      <div className="overflow-hidden min-h-0">
        <div className={className}>{children}</div>
      </div>
    </div>
  )
}

/**
 * Chevron icon that rotates 180° when `open` is true.
 * Drop-in replacement for the ChevronDown / ChevronUp swap pattern.
 */
export function CollapsibleChevron({
  open,
  className,
}: {
  open: boolean
  className?: string
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn(
        "transition-transform duration-300 ease-out",
        open ? "rotate-180" : "rotate-0",
        className
      )}
      aria-hidden
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}
