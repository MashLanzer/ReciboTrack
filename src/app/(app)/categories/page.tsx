import { CategoriesManager } from "@/components/expenses/categories-manager"

export default function CategoriesPage() {
  return (
    <div className="container max-w-2xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="font-serif text-2xl">Categorías</h1>
        <p className="text-sm text-muted-foreground mt-1">Gestiona las categorías de tus gastos</p>
      </div>
      <CategoriesManager />
    </div>
  )
}
