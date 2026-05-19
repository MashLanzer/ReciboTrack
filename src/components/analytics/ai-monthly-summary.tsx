"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button }   from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Sparkles, RefreshCw } from "lucide-react"
import { toast } from "sonner"

interface Props {
  expenses: { total: number; merchant: string; category: string }[]
  categoryBreakdown: { name: string; total: number; delta: number }[]
  month: string
}

// ─── Pulsing skeleton while AI generates ─────────────────────────────────────

function AISkeleton() {
  return (
    <div className="space-y-3 py-1" aria-busy aria-label="Generando resumen…">
      {/* Simulated text lines at varying widths */}
      <div className="space-y-2">
        <Skeleton className="h-3.5 w-full rounded-md" />
        <Skeleton className="h-3.5 w-[90%] rounded-md" />
        <Skeleton className="h-3.5 w-[95%] rounded-md" />
        <Skeleton className="h-3.5 w-[75%] rounded-md" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3.5 w-full rounded-md" />
        <Skeleton className="h-3.5 w-[85%] rounded-md" />
        <Skeleton className="h-3.5 w-[60%] rounded-md" />
      </div>
      <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 pt-1">
        <Sparkles className="h-3 w-3 animate-pulse text-primary" />
        Analizando tus gastos con IA…
      </p>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function AiMonthlySummary({ expenses, categoryBreakdown, month }: Props) {
  const [summary,   setSummary]   = useState<string>("")
  const [loading,   setLoading]   = useState(false)
  const [generated, setGenerated] = useState(false)

  async function generate() {
    setLoading(true)
    setGenerated(false)   // reset so fade-in fires again on regeneration
    try {
      const res  = await fetch("/api/ai-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expenses, categories: categoryBreakdown, month }),
      })
      const data = await res.json()
      if (data.error)   throw new Error(data.error)
      if (!data.summary) throw new Error("Respuesta vacía")
      setSummary(data.summary)
      setGenerated(true)
    } catch (err) {
      toast.error("Error al generar el resumen", {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Resumen del mes con IA
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">

        {/* ── Loading skeleton ───────────────────────────────────────────── */}
        {loading && <AISkeleton />}

        {/* ── Idle — generate button ─────────────────────────────────────── */}
        {!loading && !generated && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <p className="text-xs text-muted-foreground">
              Genera un análisis personalizado de tus gastos de {month} con inteligencia artificial
            </p>
            <Button size="sm" onClick={generate} className="gap-2">
              <Sparkles className="h-4 w-4" />
              Generar resumen
            </Button>
          </div>
        )}

        {/* ── Summary — fades in when ready ──────────────────────────────── */}
        {!loading && generated && (
          <div className="space-y-3 animate-[fadeSlideUp_0.35s_ease-out_both]">
            <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line">
              {summary}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={generate}
              className="gap-1.5 h-7 text-xs"
            >
              <RefreshCw className="h-3 w-3" />
              Regenerar
            </Button>
          </div>
        )}

      </CardContent>
    </Card>
  )
}
