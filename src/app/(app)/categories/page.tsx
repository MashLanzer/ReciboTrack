import { CategoriesManager } from "@/components/expenses/categories-manager"
import { CategoryRules } from "@/components/categories/category-rules"
import { CategoryLimitsSettings } from "@/components/expenses/category-limits-settings"
import { ErrorBoundary } from "@/components/ui/error-boundary"

export default function CategoriesPage() {
  return (
    <div className="container max-w-2xl mx-auto px-4 py-6 space-y-8">
      <div>
        <h1 className="font-serif text-2xl">Categorías</h1>
        <p className="text-sm text-muted-foreground mt-1">Gestiona las categorías y reglas automáticas</p>
      </div>

      {/* #19 — ErrorBoundary por sección para aislar fallos */}
      <ErrorBoundary label="Gestor de categorías">
        <CategoriesManager />
      </ErrorBoundary>

      <div className="border-t pt-6">
        <ErrorBoundary label="Reglas de categorías" compact>
          <CategoryRules />
        </ErrorBoundary>
      </div>

      <div className="border-t pt-6">
        <ErrorBoundary label="Límites por categoría" compact>
          <CategoryLimitsSettings />
        </ErrorBoundary>
      </div>
    </div>
  )
}
