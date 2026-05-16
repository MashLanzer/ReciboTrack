"use client"

import { useState, useRef, useMemo } from "react"
import { useExpensesForMonth } from "@/hooks/use-expenses"
import { useCategories } from "@/hooks/use-categories"
import { useAuth } from "@/hooks/use-auth"
import { DEFAULT_CATEGORIES } from "@/lib/constants"
import { formatCurrency, toDate } from "@/lib/utils"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { Share2, Download, Loader2, ImageIcon } from "lucide-react"
import { format, subMonths, startOfMonth } from "date-fns"
import { es } from "date-fns/locale"
import { toPng } from "html-to-image"

// ─── Month options (current + last 5) ────────────────────────────────────────

function monthOptions() {
  const now = new Date()
  return Array.from({ length: 6 }, (_, i) => {
    const d = startOfMonth(subMonths(now, i))
    return {
      label: format(d, "MMMM yyyy", { locale: es }),
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      value: `${d.getFullYear()}-${d.getMonth() + 1}`,
    }
  })
}

// ─── Summary card (rendered + captured) ──────────────────────────────────────

interface SummaryCardProps {
  cardRef: React.RefObject<HTMLDivElement | null>
  monthLabel: string
  total: number
  count: number
  topCategories: { name: string; icon: string; amount: number; pct: number; color: string }[]
  userName: string
}

function SummaryCard({ cardRef, monthLabel, total, count, topCategories, userName }: SummaryCardProps) {
  return (
    <div
      ref={cardRef}
      style={{
        width: 380,
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)",
        borderRadius: 24,
        padding: "32px 28px 28px",
        fontFamily: "'Inter', system-ui, sans-serif",
        color: "#f1f5f9",
        boxSizing: "border-box",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Decorative blob */}
      <div style={{
        position: "absolute", top: -60, right: -60,
        width: 200, height: 200,
        background: "radial-gradient(circle, rgba(99,102,241,0.25) 0%, transparent 70%)",
        borderRadius: "50%",
      }} />
      <div style={{
        position: "absolute", bottom: -40, left: -40,
        width: 160, height: 160,
        background: "radial-gradient(circle, rgba(16,185,129,0.2) 0%, transparent 70%)",
        borderRadius: "50%",
      }} />

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, position: "relative" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#94a3b8", marginBottom: 4 }}>
            ReciboTrack
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#cbd5e1", textTransform: "capitalize" }}>
            {monthLabel}
          </div>
        </div>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: "rgba(99,102,241,0.25)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18,
        }}>
          📊
        </div>
      </div>

      {/* Total */}
      <div style={{ marginBottom: 28, position: "relative" }}>
        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6, fontWeight: 500 }}>
          Total gastado
        </div>
        <div style={{ fontSize: 38, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.1, color: "#f8fafc" }}>
          {formatCurrency(total)}
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: "#94a3b8" }}>
          {count} {count === 1 ? "gasto" : "gastos"} · Promedio {count > 0 ? formatCurrency(total / count) : formatCurrency(0)}
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: "rgba(148,163,184,0.12)", marginBottom: 20 }} />

      {/* Top categories */}
      <div style={{ position: "relative" }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#64748b", marginBottom: 14 }}>
          Por categoría
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {topCategories.map((cat) => (
            <div key={cat.name}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 16 }}>{cat.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 500, color: "#e2e8f0" }}>{cat.name}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, color: "#94a3b8" }}>{cat.pct.toFixed(0)}%</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#f1f5f9" }}>
                    {formatCurrency(cat.amount)}
                  </span>
                </div>
              </div>
              {/* Bar */}
              <div style={{ height: 4, borderRadius: 4, background: "rgba(148,163,184,0.12)", overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: `${cat.pct}%`,
                  borderRadius: 4,
                  background: cat.color,
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid rgba(148,163,184,0.12)", display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative" }}>
        <div style={{ fontSize: 11, color: "#475569" }}>
          {userName ? `@${userName.split(" ")[0]}` : "Mi resumen"}
        </div>
        <div style={{ fontSize: 10, color: "#334155", fontWeight: 500 }}>
          recibotrack.app
        </div>
      </div>
    </div>
  )
}

// ─── Bar colours cycle ────────────────────────────────────────────────────────

const BAR_COLORS = [
  "#6366f1", // indigo
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ec4899", // pink
  "#3b82f6", // blue
]

// ─── Main dialog ──────────────────────────────────────────────────────────────

export function ShareSummary({ className }: { className?: string }) {
  const [open, setOpen] = useState(false)
  const [generating, setGenerating] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  const options = useMemo(() => monthOptions(), [])
  const [selected, setSelected] = useState(options[0].value)

  const selectedOption = options.find((o) => o.value === selected) ?? options[0]

  const { data: expenses = [], isLoading } = useExpensesForMonth(
    selectedOption.year,
    selectedOption.month,
  )
  const { data: categoriesData = [] } = useCategories()
  const { user } = useAuth()
  const allCats = categoriesData.length > 0 ? categoriesData : DEFAULT_CATEGORIES

  // ── Compute summary data ────────────────────────────────────────────────────
  const { total, topCategories } = useMemo(() => {
    const total = expenses.reduce((a, b) => a + b.total, 0)
    const catMap = new Map<string, number>()
    for (const e of expenses) {
      catMap.set(e.category, (catMap.get(e.category) ?? 0) + e.total)
    }
    const sorted = [...catMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)

    const topCategories = sorted.map(([catId, amount], i) => {
      const cat = allCats.find((c) => c.id === catId)
      return {
        name: cat?.name ?? catId,
        icon: cat?.icon ?? "📦",
        amount,
        pct: total > 0 ? (amount / total) * 100 : 0,
        color: BAR_COLORS[i % BAR_COLORS.length],
      }
    })

    return { total, topCategories }
  }, [expenses, allCats])

  // ── Capture & share ─────────────────────────────────────────────────────────

  async function captureImage(): Promise<Blob> {
    if (!cardRef.current) throw new Error("No card ref")
    const dataUrl = await toPng(cardRef.current, {
      cacheBust: true,
      pixelRatio: 2,
    })
    const res = await fetch(dataUrl)
    return res.blob()
  }

  async function handleShare() {
    setGenerating(true)
    try {
      const blob = await captureImage()
      const file = new File([blob], `resumen-${selected}.png`, { type: "image/png" })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Mi resumen de ${selectedOption.label} — ReciboTrack`,
        })
      } else {
        // Fallback: download
        downloadBlob(blob)
        toast.success("Imagen guardada")
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== "AbortError") {
        toast.error("Error al compartir")
      }
    } finally {
      setGenerating(false)
    }
  }

  async function handleDownload() {
    setGenerating(true)
    try {
      const blob = await captureImage()
      downloadBlob(blob)
      toast.success("Imagen descargada")
    } catch {
      toast.error("Error al generar imagen")
    } finally {
      setGenerating(false)
    }
  }

  function downloadBlob(blob: Blob) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `resumen-${selected}.png`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className={cn("gap-2", className)}
      >
        <Share2 className="h-4 w-4" />
        Compartir resumen
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4" />
              Resumen mensual
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Month selector */}
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="capitalize">
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Card preview — always rendered so ref is stable */}
            <div
              className={cn(
                "flex justify-center transition-opacity",
                isLoading ? "opacity-50" : "opacity-100"
              )}
            >
              <div className="rounded-2xl overflow-hidden shadow-xl scale-90 origin-top">
                <SummaryCard
                  cardRef={cardRef}
                  monthLabel={selectedOption.label}
                  total={total}
                  count={expenses.length}
                  topCategories={topCategories}
                  userName={user?.displayName ?? user?.email ?? ""}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={handleDownload}
                disabled={generating || isLoading}
              >
                {generating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Descargar
              </Button>
              <Button
                className="flex-1 gap-2"
                onClick={handleShare}
                disabled={generating || isLoading}
              >
                {generating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Share2 className="h-4 w-4" />
                )}
                Compartir
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
