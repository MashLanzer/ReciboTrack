"use client"
import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Sparkles, Loader2, RefreshCw } from "lucide-react"
import { toast } from "sonner"

interface Props {
  expenses: { total: number; merchant: string; category: string }[]
  categoryBreakdown: { name: string; total: number; delta: number }[]
  month: string
}

export function AiMonthlySummary({ expenses, categoryBreakdown, month }: Props) {
  const [summary, setSummary] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [generated, setGenerated] = useState(false)

  async function generate() {
    setLoading(true)
    try {
      const res = await fetch("/api/ai-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expenses, categories: categoryBreakdown, month }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setSummary(data.summary)
      setGenerated(true)
    } catch {
      toast.error("Error al generar el resumen")
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
        {!generated ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <p className="text-xs text-muted-foreground">
              Genera un análisis personalizado de tus gastos de {month} con inteligencia artificial
            </p>
            <Button size="sm" onClick={generate} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {loading ? "Analizando..." : "Generar resumen"}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm leading-relaxed text-foreground/90">{summary}</p>
            <Button variant="ghost" size="sm" onClick={generate} disabled={loading} className="gap-1.5 h-7 text-xs">
              <RefreshCw className="h-3 w-3" /> Regenerar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
