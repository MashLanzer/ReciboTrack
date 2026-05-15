"use client"

import { useMerchantSuggestion } from "@/hooks/use-merchant-suggestion"
import { useCategories } from "@/hooks/use-categories"
import { Sparkles } from "lucide-react"

interface Props {
  merchant: string
  currentCategory: string
  onAccept: (category: string) => void
}

/**
 * Shows a small "Sugerido: <category>" chip when the merchant has been
 * categorised before. Clicking it applies the suggested category.
 * Renders nothing if:
 *  - merchant < 3 chars
 *  - already on the suggested category
 *  - no match found
 */
export function CategorySuggestion({ merchant, currentCategory, onAccept }: Props) {
  const { data: suggested, isFetching } = useMerchantSuggestion(merchant)
  const { data: categories = [] } = useCategories()

  if (!suggested || suggested === currentCategory || isFetching) return null

  const cat = categories.find((c) => c.id === suggested)
  if (!cat) return null

  return (
    <button
      type="button"
      onClick={() => onAccept(suggested)}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-primary/30 bg-primary/5 text-primary text-[11px] font-medium hover:bg-primary/15 transition-colors"
    >
      <Sparkles className="h-3 w-3" />
      Sugerido: {cat.icon} {cat.name}
    </button>
  )
}
