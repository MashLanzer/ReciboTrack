"use client"

import { useCategoryLimits } from "@/hooks/use-category-limits"

/** Componente invisible que vigila los límites de gasto por categoría */
export function CategoryLimitsWatcher() {
  useCategoryLimits()
  return null
}
