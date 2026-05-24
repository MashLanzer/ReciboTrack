"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Loader2, Search, Sparkles, X } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { authFetch } from "@/lib/client-fetch"
import type { Expense } from "@/types"
import type { Entity } from "@/hooks/use-entities"

interface QueryResult {
  answer: string
  matchedExpenseIds: string[]
  total: number
  currency: string
  reasoning: string
}

interface Props {
  expenses: Expense[]
  entities: Entity[]
  onResults: (ids: string[]) => void
}

const EXAMPLE_QUERIES = [
  "¿Cuánto gasté en comida este mes?",
  "Muéstrame todos los gastos del proyecto X",
  "¿Qué gasté con Ana en restaurantes?",
  "Gastos deducibles de los últimos 3 meses",
]

export function GraphQueryInput({ expenses, entities, onResults }: Props) {
  const [query, setQuery]     = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState<QueryResult | null>(null)
  const [error, setError]     = useState<string | null>(null)

  async function handleSearch(q?: string) {
    const searchQuery = (q ?? query).trim()
    if (!searchQuery) return

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      // Build compact expense data for the API (avoid huge payloads)
      const expenseData = expenses.slice(0, 500).map((e) => ({
        id:       e.id,
        merchant: e.merchant,
        date:     (e.date as { toDate?: () => Date }).toDate?.()?.toISOString?.() ?? new Date().toISOString(),
        category: e.category ?? "otros",
        total:    e.total,
        currency: e.currency,
        notes:    e.notes || undefined,
        tags:     e.tags?.length ? e.tags : undefined,
        project:  e.project || undefined,
      }))

      const entityData = entities.map((en) => ({
        id:   en.id,
        type: en.type,
        name: en.name,
      }))

      const res = await authFetch("/api/graph-query", { question: searchQuery, expenses: expenseData, entities: entityData })

      if (!res.ok) throw new Error("Error en la consulta")

      const data = await res.json() as QueryResult
      setResult(data)
      onResults(data.matchedExpenseIds ?? [])
    } catch {
      setError("No se pudo procesar la consulta. Verifica tu conexión.")
    } finally {
      setLoading(false)
    }
  }

  function clear() {
    setQuery("")
    setResult(null)
    setError(null)
    onResults([])
  }

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/60" />
          <Input
            className="pl-9 pr-8 h-10"
            placeholder="Pregunta sobre tus gastos en lenguaje natural…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          {query && (
            <button type="button" onClick={clear}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <Button onClick={() => handleSearch()} disabled={loading || !query.trim()} className="h-10 px-4 gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Consultar
        </Button>
      </div>

      {/* Example queries */}
      {!result && !loading && (
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLE_QUERIES.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => { setQuery(q); handleSearch(q) }}
              className="text-xs rounded-full border px-2.5 py-1 text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="rounded-xl border bg-card p-4 space-y-2">
          <div className="flex items-start gap-2">
            <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium">{result.answer}</p>
              {result.matchedExpenseIds.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {result.matchedExpenseIds.length} gasto{result.matchedExpenseIds.length !== 1 ? "s" : ""} encontrados
                  {result.total > 0 && ` · Total: ${formatCurrency(result.total, result.currency)}`}
                </p>
              )}
            </div>
            <button type="button" onClick={clear} className="text-muted-foreground hover:text-foreground shrink-0">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  )
}
