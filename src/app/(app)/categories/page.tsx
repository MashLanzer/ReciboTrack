import { CategoriesManager } from "@/components/expenses/categories-manager"
import { CategoryRules } from "@/components/categories/category-rules"

export default function CategoriesPage() {
  return (
    <div className="container max-w-2xl mx-auto px-4 py-6 space-y-8">
      <div>
        <h1 className="font-serif text-2xl">Categorías</h1>
        <p className="text-sm text-muted-foreground mt-1">Gestiona las categorías y reglas automáticas</p>
      </div>
      <CategoriesManager />
      <div className="border-t pt-6">
        <CategoryRules />
      </div>
    </div>
  )
}
