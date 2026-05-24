"use client"

import { useState, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Sparkles, Loader2, SendHorizonal, X } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { authFetch } from "@/lib/client-fetch"

interface Message {
  role: "user" | "assistant"
  text: string
}

interface AskFinanceProps {
  /** Compact data snapshot passed to the AI for context */
  context: {
    monthTotal: number
    prevMonthTotal: number
    topCategories: { name: string; total: number }[]
    savingsRate?: number
    currency?: string
  }
}

const SUGGESTED = [
  "¿En qué categoría gasto más?",
  "¿Cómo puedo ahorrar más este mes?",
  "¿Mi tendencia es buena o mala?",
  "Recomiéndame un presupuesto mensual",
]

export function AskFinance({ context }: AskFinanceProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function ask(question: string) {
    if (!question.trim()) return
    const userMsg: Message = { role: "user", text: question }
    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setLoading(true)

    try {
      const res = await authFetch("/api/ask-finance", { question, context })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setMessages((prev) => [...prev, { role: "assistant", text: data.answer ?? "Sin respuesta" }])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al consultar IA")
      setMessages((prev) => prev.slice(0, -1))
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    ask(input)
  }

  return (
    <Card className="border-primary/20 overflow-hidden">
      {/* Gradient header strip */}
      <div className="bg-gradient-to-r from-primary/8 to-primary/4 border-b border-primary/10 px-4 pt-4 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Sparkles className="h-4.5 w-4.5 text-primary h-[18px] w-[18px]" />
          </div>
          <div>
            <CardTitle className="text-sm font-bold flex items-center gap-1.5">
              Asesor Financiero IA
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Pregunta cualquier cosa sobre tus finanzas</p>
          </div>
        </div>
      </div>

      <CardContent className="space-y-3 pt-3">
        {/* Conversation */}
        {messages.length > 0 && (
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-xl px-3 py-2 text-xs leading-relaxed animate-[fadeSlideUp_0.2s_ease-out_both]",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground ml-8"
                    : "bg-muted text-foreground mr-8"
                )}
              >
                {msg.text}
              </div>
            ))}
            {loading && (
              <div className="bg-muted rounded-xl px-3 py-2 text-xs mr-8 flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Pensando...
              </div>
            )}
          </div>
        )}

        {/* Suggestions (only if no messages yet) */}
        {messages.length === 0 && (
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED.map((s) => (
              <button
                key={s}
                onClick={() => ask(s)}
                disabled={loading}
                className="text-xs px-3 py-1.5 rounded-full border border-primary/20 bg-primary/5 hover:bg-primary/10 hover:border-primary/40 transition-all text-foreground font-medium"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Clear */}
        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
          >
            <X className="h-3 w-3" /> Limpiar conversación
          </button>
        )}

        {/* Input */}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribe tu pregunta..."
            className="h-9 text-sm"
            disabled={loading}
          />
          <Button type="submit" size="sm" className="h-9 px-3 shrink-0" disabled={loading || !input.trim()}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <SendHorizonal className="h-3.5 w-3.5" />}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
