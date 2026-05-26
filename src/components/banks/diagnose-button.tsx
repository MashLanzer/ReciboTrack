"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Loader2, FlaskConical, CheckCircle2, XCircle, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { apiFetch } from "@/lib/api-client"

interface TestResult {
  name:   string
  status: "pass" | "fail" | "skip"
  detail: string
  ms?:    number
}

interface DiagnoseResponse {
  ok:      boolean
  summary: string
  stats:   Record<string, string | number>
  tests:   TestResult[]
}

/**
 * Botón "Ejecutar diagnóstico". Solo visible al UID dev permitido (lo gatea
 * el padre). Click → llama /api/dev/plaid-diagnose → muestra dialog con
 * resultados pass/fail.
 */
export function DiagnoseButton() {
  const [running, setRunning]   = useState(false)
  const [result,  setResult]    = useState<DiagnoseResponse | null>(null)
  const [open,    setOpen]      = useState(false)

  async function run() {
    setRunning(true)
    setResult(null)
    setOpen(true)
    try {
      const res = await apiFetch("/api/dev/plaid-diagnose", { method: "POST" })
      const data = await res.json() as DiagnoseResponse & { error?: string }
      if (!res.ok) {
        toast.error(data.error ?? "Error en diagnóstico")
        setOpen(false)
        return
      }
      setResult(data)
    } catch (err) {
      toast.error((err as Error).message)
      setOpen(false)
    } finally {
      setRunning(false)
    }
  }

  return (
    <>
      <Button onClick={run} disabled={running} variant="outline" className="w-full gap-2 border-dashed border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10">
        {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
        {running ? "Ejecutando tests (puede tardar ~15s)…" : "Ejecutar diagnóstico (DEV)"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-amber-500" />
              Diagnóstico Plaid
            </DialogTitle>
            <DialogDescription>
              {result?.summary ?? "Ejecutando suite de pruebas contra Plaid Sandbox…"}
            </DialogDescription>
          </DialogHeader>

          {running && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {result && (
            <div className="space-y-3 mt-2">
              {result.tests.map((t, i) => (
                <div key={i} className={`rounded-lg border p-3 space-y-1 ${
                  t.status === "pass" ? "border-green-500/30 bg-green-500/5" :
                  t.status === "fail" ? "border-destructive/30 bg-destructive/5" :
                  "border-muted bg-muted/20"
                }`}>
                  <div className="flex items-start gap-2">
                    {t.status === "pass" ? <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0 mt-0.5" /> :
                     t.status === "fail" ? <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" /> :
                     <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{t.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 break-words">{t.detail}</p>
                    </div>
                    {t.ms != null && (
                      <span className="text-[10px] text-muted-foreground font-mono shrink-0">{t.ms}ms</span>
                    )}
                  </div>
                </div>
              ))}

              {result.stats && Object.keys(result.stats).length > 0 && (
                <div className="rounded-lg border bg-muted/20 p-3 space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Stats DB</p>
                  {Object.entries(result.stats).map(([k, v]) => (
                    <div key={k} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{k}</span>
                      <span className="font-mono font-semibold">{String(v)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
