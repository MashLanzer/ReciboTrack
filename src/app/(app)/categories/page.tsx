import { CategoriesManager } from "@/components/expenses/categories-manager"
import { CategoryRules } from "@/components/categories/category-rules"
import { CategoryLimitsSettings } from "@/components/expenses/category-limits-settings"
import { ErrorBoundary } from "@/components/ui/error-boundary"
import { Tag } from "lucide-react"

export default function CategoriesPage() {
  return (
    <div className="container max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Tag className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="font-bold text-xl">Categorías</h1>
          <p className="text-xs text-muted-foreground">Gestiona las categorías y reglas automáticas</p>
        </div>
      </div>

      {/* #19 — ErrorBoundary por sección para aislar fallos */}
      <ErrorBoundary label="Gestor de categorías">
        <CategoriesManager />
      </ErrorBoundary>

      <div className="relative pt-6">
        <div className="absolute inset-x-0 top-0 flex items-center gap-3">
          <div className="h-px flex-1 bg-border/60" />
          <span className="shrink-0 text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">Reglas automáticas</span>
          <div className="h-px flex-1 bg-border/60" />
        </div>
        <ErrorBoundary label="Reglas de categorías" compact>
          <CategoryRules />
        </ErrorBoundary>
      </div>

      <div className="relative pt-6">
        <div className="absolute inset-x-0 top-0 flex items-center gap-3">
          <div className="h-px flex-1 bg-border/60" />
          <span className="shrink-0 text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">Límites mensuales</span>
          <div className="h-px flex-1 bg-border/60" />
        </div>
        <ErrorBoundary label="Límites por categoría" compact>
          <CategoryLimitsSettings />
        </ErrorBoundary>
      </div>
    </div>
  )
}
