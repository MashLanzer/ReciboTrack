"use client"

/**
 * MobileActionSheet — en dispositivos táctiles muestra un sheet desde abajo
 * con botones grandes (44px mínimo) en vez de un dropdown pequeño.
 * En desktop se comporta como un DropdownMenu normal.
 *
 * Uso:
 * ```tsx
 * <MobileActionSheet
 *   trigger={<Button variant="ghost" size="icon"><MoreHorizontal /></Button>}
 *   title="Acciones"                // opcional
 *   actions={[
 *     { label: "Editar", icon: <Edit />, onClick: () => {} },
 *     { label: "Eliminar", icon: <Trash2 />, onClick: () => {}, destructive: true },
 *   ]}
 * />
 * ```
 */

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu"

export interface ActionItem {
  label: string
  icon?: React.ReactNode
  onClick: () => void
  destructive?: boolean
  disabled?: boolean
  separator?: boolean   // show separator BEFORE this item
}

interface Props {
  trigger: React.ReactNode
  actions: ActionItem[]
  title?: string
  /** Override touch detection — useful for testing */
  forceSheet?: boolean
}

function useIsTouch() {
  const [isTouch, setIsTouch] = useState(false)
  useEffect(() => {
    setIsTouch(window.matchMedia("(hover: none) and (pointer: coarse)").matches)
  }, [])
  return isTouch
}

export function MobileActionSheet({ trigger, actions, title, forceSheet }: Props) {
  const isTouch = useIsTouch()
  const useSheet = forceSheet ?? isTouch

  const [open, setOpen] = useState(false)

  if (!useSheet) {
    // ── Desktop: standard dropdown ─────────────────────────────────────────
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {actions.map((action, i) => (
            <span key={i}>
              {action.separator && i > 0 && <DropdownMenuSeparator />}
              <DropdownMenuItem
                onClick={action.onClick}
                disabled={action.disabled}
                className={action.destructive ? "text-destructive focus:text-destructive" : ""}
              >
                {action.icon}
                {action.label}
              </DropdownMenuItem>
            </span>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  // ── Mobile: bottom sheet ───────────────────────────────────────────────
  return (
    <>
      {/* Trigger */}
      <span onClick={() => setOpen(true)}>{trigger}</span>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50"
          onClick={() => setOpen(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-150" />

          {/* Sheet */}
          <div
            className={cn(
              "absolute bottom-0 left-0 right-0 bg-background rounded-t-2xl shadow-2xl",
              "animate-in slide-in-from-bottom duration-250",
            )}
            style={{ paddingBottom: "env(safe-area-inset-bottom, 16px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1 w-10 rounded-full bg-muted-foreground/25" />
            </div>

            {/* Title */}
            {title && (
              <p className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {title}
              </p>
            )}

            {/* Actions */}
            <div className="px-2 pb-2 space-y-0.5">
              {actions.map((action, i) => (
                <span key={i}>
                  {action.separator && i > 0 && (
                    <div className="h-px bg-border my-1.5 mx-2" />
                  )}
                  <button
                    disabled={action.disabled}
                    onClick={() => { setOpen(false); action.onClick() }}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium",
                      "transition-colors active:scale-[0.98] active:bg-muted",
                      "min-h-[52px]",              // touch-friendly
                      action.destructive
                        ? "text-destructive hover:bg-destructive/8"
                        : "text-foreground hover:bg-muted",
                      action.disabled && "opacity-50 pointer-events-none",
                    )}
                  >
                    {action.icon && (
                      <span className={cn(
                        "h-5 w-5 shrink-0",
                        action.destructive ? "text-destructive" : "text-muted-foreground",
                      )}>
                        {action.icon}
                      </span>
                    )}
                    {action.label}
                  </button>
                </span>
              ))}
            </div>

            {/* Cancel button */}
            <div className="px-2 pb-2">
              <button
                onClick={() => setOpen(false)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl
                  text-sm font-semibold bg-muted hover:bg-muted/80 transition-colors min-h-[52px]"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
