"use client"

import { useRef, useState, useEffect, useCallback } from "react"
import { useCategories } from "@/hooks/use-categories"
import { useExpensesForMonth } from "@/hooks/use-expenses"
import { formatCurrency, cn } from "@/lib/utils"
import type { CategoryDoc } from "@/types"

interface CashtagInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  id?: string
}

interface CashtagPopover {
  category: CategoryDoc
  spent: number
  budget?: number
  recentMerchants: string[]
}

export function CashtagInput({ value, onChange, placeholder, className, id }: CashtagInputProps) {
  const { data: categories = [] } = useCategories()
  const now = new Date()
  const { data: monthExpenses = [] } = useExpensesForMonth(now.getFullYear(), now.getMonth() + 1)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [suggestions, setSuggestions] = useState<CategoryDoc[]>([])
  const [suggestionAnchor, setSuggestionAnchor] = useState<{ query: string; start: number } | null>(null)
  const [selectedSuggIdx, setSelectedSuggIdx] = useState(0)
  const [popover, setPopover] = useState<CashtagPopover | null>(null)
  const [popoverAnchor, setPopoverAnchor] = useState<{ x: number; y: number } | null>(null)

  // Detect $word patterns as user types
  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value
    onChange(val)

    const pos = e.target.selectionStart ?? 0
    // Find $ before cursor
    const before = val.slice(0, pos)
    const match = before.match(/\$(\w*)$/)
    if (match) {
      const query = match[1].toLowerCase()
      const filtered = categories.filter((c) =>
        c.name.toLowerCase().includes(query) || c.id.toLowerCase().includes(query)
      )
      setSuggestions(filtered.slice(0, 5))
      setSuggestionAnchor({ query: match[1], start: pos - match[0].length })
      setSelectedSuggIdx(0)
    } else {
      setSuggestions([])
      setSuggestionAnchor(null)
    }
  }

  function insertSuggestion(cat: CategoryDoc) {
    if (!suggestionAnchor) return
    const before = value.slice(0, suggestionAnchor.start)
    const after = value.slice(suggestionAnchor.start + suggestionAnchor.query.length + 1) // +1 for $
    const newValue = `${before}$${cat.id}${after}`
    onChange(newValue)
    setSuggestions([])
    setSuggestionAnchor(null)
    textareaRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (suggestions.length === 0) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setSelectedSuggIdx((i) => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setSelectedSuggIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault()
      if (suggestions[selectedSuggIdx]) insertSuggestion(suggestions[selectedSuggIdx])
    } else if (e.key === "Escape") {
      setSuggestions([])
    }
  }

  // Build rendered display with $category chips
  const parts = value.split(/(\$\w+)/g)

  function handleCashtagClick(
    e: React.MouseEvent<HTMLSpanElement>,
    catId: string
  ) {
    const cat = categories.find((c) => c.id === catId)
    if (!cat) return
    const spent = monthExpenses
      .filter((ex) => ex.category === catId)
      .reduce((s, ex) => s + ex.total, 0)
    const recentMerchants = monthExpenses
      .filter((ex) => ex.category === catId)
      .slice(0, 3)
      .map((ex) => ex.merchant)
    setPopover({ category: cat, spent, recentMerchants })
    const rect = e.currentTarget.getBoundingClientRect()
    setPopoverAnchor({ x: rect.left, y: rect.bottom + 4 })
  }

  // Close popover on outside click
  useEffect(() => {
    function onClickOutside() { setPopover(null) }
    if (popover) document.addEventListener("click", onClickOutside)
    return () => document.removeEventListener("click", onClickOutside)
  }, [popover])

  return (
    <div className="relative">
      {/* Preview layer with chips */}
      {value && (
        <div className="text-sm px-3 py-2 min-h-[2.5rem] flex flex-wrap gap-0.5 items-baseline">
          {parts.map((part, i) => {
            if (part.startsWith("$")) {
              const catId = part.slice(1)
              const cat = categories.find((c) => c.id === catId)
              if (cat) {
                return (
                  <span
                    key={i}
                    onClick={(e) => handleCashtagClick(e, catId)}
                    className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 px-1.5 py-0 text-[11px] font-semibold cursor-pointer hover:bg-primary/20 transition-colors"
                  >
                    {cat.icon} {cat.name}
                  </span>
                )
              }
            }
            return <span key={i}>{part}</span>
          })}
        </div>
      )}

      {/* Actual textarea */}
      <textarea
        ref={textareaRef}
        id={id}
        value={value}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        placeholder={placeholder ?? "Escribe $categoria para vincular..."}
        rows={2}
        className={cn(
          "w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none",
          value ? "opacity-0 absolute inset-0" : "",
          className
        )}
      />

      {/* Suggestion dropdown */}
      {suggestions.length > 0 && (
        <div className="absolute z-50 left-0 top-full mt-1 w-48 rounded-xl border bg-popover shadow-lg overflow-hidden">
          {suggestions.map((cat, i) => (
            <button
              key={cat.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); insertSuggestion(cat) }}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors",
                i === selectedSuggIdx ? "bg-accent" : "hover:bg-accent/50"
              )}
            >
              <span>{cat.icon}</span>
              <span className="font-medium">{cat.name}</span>
              <span className="ml-auto text-[10px] text-muted-foreground">${cat.id}</span>
            </button>
          ))}
        </div>
      )}

      {/* Cashtag popover */}
      {popover && popoverAnchor && (
        <div
          className="fixed z-50 rounded-xl border bg-popover shadow-lg p-3 space-y-1.5 min-w-[180px]"
          style={{ left: popoverAnchor.x, top: popoverAnchor.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-sm font-bold flex items-center gap-1.5">
            {popover.category.icon} {popover.category.name}
          </p>
          <p className="text-xs text-muted-foreground">
            Este mes: <span className="font-semibold text-foreground">{formatCurrency(popover.spent)}</span>
          </p>
          {popover.recentMerchants.length > 0 && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Últimos</p>
              {popover.recentMerchants.map((m, i) => (
                <p key={i} className="text-xs truncate">{m}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
