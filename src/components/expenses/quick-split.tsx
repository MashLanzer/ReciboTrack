"use client"

import { useState, useMemo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Plus, X, Copy, Share, Link2, QrCode, Loader2 } from "lucide-react"
import { authFetch } from "@/lib/client-fetch"

interface Person {
  name: string
  customAmount: string
}

interface Props {
  open: boolean
  onClose: () => void
  defaultUserName?: string
  initialAmount?: number
  initialDescription?: string
}

function QRModal({ url, label, onClose }: { url: string; label: string; onClose: () => void }) {
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(url)}&size=180x180`
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="rounded-2xl bg-card border p-6 space-y-4 max-w-xs w-full text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-semibold truncate">QR · {label}</p>
        <div className="flex items-center justify-center">
          <img
            src={qrSrc}
            alt={`QR para ${label}`}
            width={180}
            height={180}
            className="rounded-xl border"
          />
        </div>
        <p className="text-[10px] text-muted-foreground break-all">{url}</p>
        <button
          onClick={onClose}
          className="w-full rounded-xl border py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
        >
          Cerrar
        </button>
      </div>
    </div>
  )
}

/** Generate a cryptographically signed pay URL via the /api/pay-link server route */
async function fetchSignedPayUrl(from: string, to: string, amount: number, concept: string, currency: string): Promise<string> {
  try {
    const res = await authFetch("/api/pay-link", { from, to, amount, concept, currency })
    if (res.ok) {
      const data = await res.json() as { url?: string }
      if (data.url) return data.url
    }
  } catch { /* fall through */ }
  // Fallback: plain btoa (unsigned) so the UI still works offline / if auth fails
  const base = typeof window !== "undefined" ? window.location.origin : ""
  return `${base}/pay/${btoa(JSON.stringify({ from, to, amount, concept, currency }))}`
}

export function QuickSplit({ open, onClose, defaultUserName = "Yo", initialAmount, initialDescription }: Props) {
  const [total, setTotal] = useState(initialAmount ? String(initialAmount) : "")
  const [description, setDescription] = useState(initialDescription ?? "")
  const [people, setPeople] = useState<Person[]>([
    { name: defaultUserName, customAmount: "" },
    { name: "", customAmount: "" },
  ])
  const [mode, setMode] = useState<"equal" | "custom">("equal")
  const [qrModal, setQrModal] = useState<{ url: string; label: string } | null>(null)
  // Cache of signed pay URLs: key = `${debtor}-${amount}` → url
  const [payUrls, setPayUrls] = useState<Record<string, string>>({})
  const [generatingUrls, setGeneratingUrls] = useState(false)

  const totalNum = Math.round((parseFloat(total) || 0) * 100) / 100
  const activePeople = people.filter((p) => p.name.trim())

  // Round each share to 2 decimal places; give the remainder to the payer
  const equalShare = useMemo(() => {
    if (activePeople.length === 0 || totalNum === 0) return 0
    return Math.round((totalNum / activePeople.length) * 100) / 100
  }, [activePeople.length, totalNum])

  const customSum = useMemo(
    () => Math.round(
      people.reduce((acc, p) => acc + Math.round((parseFloat(p.customAmount) || 0) * 100) / 100, 0)
      * 100
    ) / 100,
    [people]
  )
  const customOk = Math.abs(customSum - totalNum) < 0.005 || totalNum === 0

  function addPerson() {
    if (people.length >= 6) return
    setPeople((prev) => [...prev, { name: "", customAmount: "" }])
  }

  function removePerson(idx: number) {
    if (people.length <= 2) return
    setPeople((prev) => prev.filter((_, i) => i !== idx))
  }

  function updateName(idx: number, name: string) {
    setPeople((prev) => prev.map((p, i) => i === idx ? { ...p, name } : p))
  }

  function updateAmount(idx: number, amount: string) {
    setPeople((prev) => prev.map((p, i) => i === idx ? { ...p, customAmount: amount } : p))
  }

  // Build result pairs: who owes whom (first person = payer by convention)
  const payer = activePeople[0]
  const debtors = activePeople.slice(1)

  const resultLines = debtors.map((d) => {
    const raw = mode === "equal"
      ? equalShare
      : Math.round((parseFloat(people.find((p) => p.name === d.name)?.customAmount ?? "0") || 0) * 100) / 100
    return `${d.name} le debe a ${payer?.name ?? "?"}: ${raw.toFixed(2)} ${description ? `(${description})` : ""}`
  })

  const summaryText = [
    description ? `Gasto: ${description}` : "",
    `Total: ${totalNum.toFixed(2)}`,
    "",
    ...resultLines,
    "",
    "Generado con ReciboTrack",
  ].filter((l, i, arr) => !(l === "" && arr[i - 1] === "")).join("\n").trim()

  async function handleShare() {
    if (navigator.share) {
      await navigator.share({ title: description || "División de gasto", text: summaryText })
    } else {
      await navigator.clipboard.writeText(summaryText)
      toast.success("Resumen copiado al portapapeles")
    }
  }

  function copyLine(line: string) {
    navigator.clipboard.writeText(line)
    toast.success("Copiado")
  }

  function handleClose() {
    setTotal(initialAmount ? String(initialAmount) : "")
    setDescription(initialDescription ?? "")
    setPeople([{ name: defaultUserName, customAmount: "" }, { name: "", customAmount: "" }])
    setMode("equal")
    onClose()
  }

  return (
    <>
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Dividir gasto</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {/* Amount + Description */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Importe total</Label>
              <Input
                type="number" inputMode="decimal"
                step="0.01"
                placeholder="0.00"
                value={total}
                onChange={(e) => setTotal(e.target.value)}
                className="tabular-nums"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Descripción</Label>
              <Input
                placeholder="Cena, taxi..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          {/* Mode toggle */}
          <div className="grid grid-cols-2 gap-2">
            {(["equal", "custom"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-lg border py-2 text-xs font-medium transition-colors ${mode === m ? "border-foreground bg-accent" : "border-border text-muted-foreground hover:border-muted-foreground"}`}
              >
                {m === "equal" ? "÷ A partes iguales" : "⚖️ Personalizado"}
              </button>
            ))}
          </div>

          {/* People list */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Personas (el primero es quien pagó)</p>
            {people.map((p, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold shrink-0 text-muted-foreground">
                  {idx + 1}
                </div>
                <Input
                  placeholder={idx === 0 ? "Quien pagó" : `Persona ${idx + 1}`}
                  value={p.name}
                  onChange={(e) => updateName(idx, e.target.value)}
                  className="flex-1 h-8 text-sm"
                />
                {mode === "equal" && p.name.trim() && totalNum > 0 && (
                  <span className="text-xs tabular-nums text-muted-foreground shrink-0 w-16 text-right">
                    {equalShare.toFixed(2)}
                  </span>
                )}
                {mode === "custom" && (
                  <Input
                    type="number" inputMode="decimal"
                    step="0.01"
                    min={0}
                    placeholder="0.00"
                    value={p.customAmount}
                    onChange={(e) => updateAmount(idx, e.target.value)}
                    className="w-20 h-8 text-xs tabular-nums text-right"
                  />
                )}
                {people.length > 2 && (
                  <button
                    onClick={() => removePerson(idx)}
                    className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}

            {/* Custom sum validation */}
            {mode === "custom" && totalNum > 0 && (
              <p className={`text-xs tabular-nums font-medium text-right ${customOk ? "text-green-600" : "text-destructive"}`}>
                {customOk
                  ? "✓ Los importes cuadran"
                  : `Diferencia: ${(totalNum - customSum).toFixed(2)}`}
              </p>
            )}

            {people.length < 6 && (
              <Button variant="outline" size="sm" className="w-full gap-1.5 h-7 text-xs" onClick={addPerson}>
                <Plus className="h-3.5 w-3.5" />
                Añadir persona
              </Button>
            )}
          </div>

          {/* Result */}
          {activePeople.length >= 2 && totalNum > 0 && (
            <div className="border rounded-xl p-3 space-y-2 bg-muted/20">
              <p className="text-xs font-medium">Resultado</p>
              {debtors.filter((d) => d.name.trim()).map((d, i) => {
                const amount = mode === "equal"
                  ? equalShare
                  : Math.round((parseFloat(people.find((p) => p.name === d.name)?.customAmount ?? "0") || 0) * 100) / 100
                const line = `${d.name} le debe a ${payer?.name ?? "?"}: ${amount.toFixed(2)}`
                return (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <p className="text-xs flex-1 truncate">{line}</p>
                    <button
                      onClick={() => copyLine(line)}
                      className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                      title="Copiar"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Share button */}
          {activePeople.length >= 2 && totalNum > 0 && (
            <Button className="w-full gap-2" onClick={handleShare}>
              <Share className="h-4 w-4" />
              Compartir resumen
            </Button>
          )}

          {/* Payment links per debtor — signed via /api/pay-link */}
          {activePeople.length >= 2 && totalNum > 0 && payer && (
            <div className="border rounded-xl p-3 space-y-2 bg-muted/20">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium flex items-center gap-1.5">
                  <Link2 className="h-3.5 w-3.5" />
                  Enlace de cobro por persona
                </p>
                {Object.keys(payUrls).length === 0 && (
                  <button
                    onClick={async () => {
                      setGeneratingUrls(true)
                      const urls: Record<string, string> = {}
                      for (const d of debtors.filter((x) => x.name.trim())) {
                        const amt = mode === "equal"
                          ? equalShare
                          : Math.round((parseFloat(people.find(p => p.name === d.name)?.customAmount ?? "0") || 0) * 100) / 100
                        const key = `${d.name}-${amt}`
                        // from = acreedor (payer, quien cobra); to = deudor (d, quien paga)
                        urls[key] = await fetchSignedPayUrl(payer.name, d.name, amt, description, "USD")
                      }
                      setPayUrls(urls)
                      setGeneratingUrls(false)
                    }}
                    disabled={generatingUrls}
                    className="text-[10px] text-primary hover:underline flex items-center gap-1 disabled:opacity-50"
                  >
                    {generatingUrls ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                    {generatingUrls ? "Generando…" : "Generar links"}
                  </button>
                )}
              </div>
              {debtors.filter(d => d.name.trim()).map((d, i) => {
                const amount = mode === "equal"
                  ? equalShare
                  : Math.round((parseFloat(people.find(p => p.name === d.name)?.customAmount ?? "0") || 0) * 100) / 100
                const key = `${d.name}-${amount}`
                const url = payUrls[key]

                const copyPayUrl = async () => {
                  const u = url ?? await fetchSignedPayUrl(payer.name, d.name, amount, description, "USD")
                  await navigator.clipboard.writeText(u)
                  toast.success(`Enlace de ${d.name} copiado`)
                }

                const sharePayUrl = async () => {
                  const u = url ?? await fetchSignedPayUrl(payer.name, d.name, amount, description, "USD")
                  if (navigator.share) {
                    await navigator.share({ title: `Pago de ${description || "gasto"}`, text: `${d.name} te debe ${amount.toFixed(2)}`, url: u })
                  } else {
                    await navigator.clipboard.writeText(u)
                    toast.success("Enlace copiado")
                  }
                }

                return (
                  <div key={i} className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{d.name}</p>
                      <p className="text-[10px] text-muted-foreground tabular-nums">{amount.toFixed(2)}</p>
                    </div>
                    <button
                      onClick={copyPayUrl}
                      className="text-muted-foreground hover:text-foreground transition-colors shrink-0 flex items-center gap-1 text-[10px]"
                      title="Copiar enlace"
                    >
                      <Copy className="h-3 w-3" />
                      Copiar
                    </button>
                    <button
                      onClick={sharePayUrl}
                      className="text-muted-foreground hover:text-foreground transition-colors shrink-0 flex items-center gap-1 text-[10px]"
                      title="Compartir"
                    >
                      <Share className="h-3 w-3" />
                      Compartir
                    </button>
                    {url && (
                      <button
                        onClick={() => setQrModal({ url, label: d.name })}
                        className="text-muted-foreground hover:text-foreground transition-colors shrink-0 flex items-center gap-1 text-[10px]"
                        title="Ver QR"
                      >
                        <QrCode className="h-3 w-3" />
                        QR
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>

    {qrModal && (
      <QRModal
        url={qrModal.url}
        label={qrModal.label}
        onClose={() => setQrModal(null)}
      />
    )}
    </>
  )
}
