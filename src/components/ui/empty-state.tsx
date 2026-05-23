import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"
import { Button } from "./button"

interface EmptyStateAction {
  label: string
  onClick: () => void
  icon?: React.ReactNode
  variant?: "default" | "outline" | "ghost"
}

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  actions?: EmptyStateAction[]
  compact?: boolean
  className?: string
}

/**
 * Empty state component — consistent illustration-style empty state for all pages.
 *
 * Usage:
 * ```tsx
 * <EmptyState
 *   icon={Receipt}
 *   title="Sin gastos registrados"
 *   description="Empieza añadiendo tu primer gasto"
 *   actions={[{ label: "Añadir gasto", onClick: () => setOpen(true), icon: <Plus className="h-4 w-4" /> }]}
 * />
 * ```
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  actions = [],
  compact = false,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center text-center",
      compact ? "py-8 px-4 gap-2" : "py-14 px-6 gap-4",
      className,
    )}>
      {/* Icon container with layered rings for depth */}
      <div className="relative mb-1">
        <div className={cn(
          "rounded-full bg-muted/40",
          compact ? "h-12 w-12" : "h-16 w-16",
        )}>
          <div className={cn(
            "absolute inset-0 rounded-full bg-muted/60 scale-[0.82]",
          )} />
          <div className="absolute inset-0 flex items-center justify-center">
            <Icon className={cn(
              "text-muted-foreground/70",
              compact ? "h-5 w-5" : "h-7 w-7",
            )} strokeWidth={1.5} />
          </div>
        </div>
      </div>

      {/* Text */}
      <div className={compact ? "space-y-0.5" : "space-y-1.5"}>
        <p className={cn(
          "font-semibold",
          compact ? "text-sm" : "text-base",
        )}>
          {title}
        </p>
        {description && (
          <p className={cn(
            "text-muted-foreground",
            compact ? "text-xs" : "text-sm",
          )}>
            {description}
          </p>
        )}
      </div>

      {/* Actions */}
      {actions.length > 0 && (
        <div className={cn(
          "flex flex-wrap justify-center",
          compact ? "gap-2 mt-1" : "gap-3 mt-2",
        )}>
          {actions.map((action, i) => (
            <Button
              key={i}
              variant={action.variant ?? (i === 0 ? "default" : "outline")}
              size={compact ? "sm" : "default"}
              onClick={action.onClick}
              className="gap-2"
            >
              {action.icon}
              {action.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}
