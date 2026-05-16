"use client"
import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Sparkles, Loader2, RefreshCw } from "lucide-react"
import { toast } from "sonner"

interface Suggestion {
  titulo: string
  descripcion: string
  ahorroEstimado?: number
}

interface Props {
  expenses3months: { total: number; merchant: string; category: string }[]
}

export function AiSuggestions({ expenses3months }: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [generated, setGenerated] = useState(false)

  async function generate() {
    setLoading(true)
    try {
      const res = await fetch("/api/ai-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expenses: expenses3months }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setSuggestions(data.suggestions ?? [])
      setGenerated(true)
    } catch (err) {
      toast.error("Error al generar sugerencias", {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <span>💡</span>
          Sugerencias de ahorro personalizadas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!generated && !loading ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <p className="text-xs text-muted-foreground">
              Analiza tus gastos de los últimos 3 meses y obtén sugerencias de ahorro personalizadas
            </p>
            <Button size="sm" onClick={generate} className="gap-2">
              <Sparkles className="h-4 w-4" />
              Generar sugerencias
            </Button>
          </div>
        ) : loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border p-3 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {suggestions.map((s, i) => (
              <div key={i} className="rounded-xl border bg-muted/20 p-3 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-bold leading-snug">💡 {s.titulo}</p>
                  {s.ahorroEstimado != null && s.ahorroEstimado > 0 && (
                    <span className="shrink-0 inline-flex items-center rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-semibold text-green-700 dark:text-green-400 whitespace-nowrap">
                      Ahorra ~{s.ahorroEstimado}€/mes
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{s.descripcion}</p>
              </div>
            ))}
            <Button variant="ghost" size="sm" onClick={generate} disabled={loading} className="gap-1.5 h-7 text-xs">
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              Regenerar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
