"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { useAuth } from "@/hooks/use-auth"
import { useAddExpense } from "@/hooks/use-expenses"
import { useUIStore } from "@/stores/ui-store"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Upload, Loader2, CheckCircle2, X, ScanLine, Plus, RefreshCw, ImageIcon } from "lucide-react"
import { useCategories } from "@/hooks/use-categories"
import { useAddRecurring } from "@/hooks/use-recurring"
import { PAYMENT_METHODS, CURRENCIES } from "@/lib/constants"
import type { OcrResultInput } from "@/lib/firebase/schemas"
import type { ReceiptItem, RecurringFrequency } from "@/types"
import { runReceiptOcr } from "@/lib/ocr/tesseract"
import imageCompression from "browser-image-compression"
import { cn } from "@/lib/utils"
import { CameraCapture } from "./camera-capture"

type Step = "upload" | "camera" | "processing" | "confirm"

interface FormData {
  merchant: string
  date: string
  total: string
  subtotal: string
  tax: string
  category: string
  paymentMethod: string
  currency: string
  reference: string
  notes: string
  tags: string[]
  isRecurring: boolean
  recurringFrequency: RecurringFrequency
}

const RECURRING_LABELS: Record<RecurringFrequency, string> = {
  weekly: "Semanal",
  biweekly: "Quincenal",
  monthly: "Mensual",
  yearly: "Anual",
}

export function ReceiptScanner() {
  const { scannerOpen, setScannerOpen, sharedFile, setSharedFile } = useUIStore()
  const { user } = useAuth()
  const { data: categories = [] } = useCategories()
  const addExpense = useAddExpense()
  const addRecurring = useAddRecurring()

  const [step, setStep] = useState<Step>("upload")
  const [dragOver, setDragOver] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [allItems, setAllItems] = useState<ReceiptItem[]>([])
  const [scanCount, setScanCount] = useState(0)
  const [ocrProgress, setOcrProgress] = useState(0)
  const [tagInput, setTagInput] = useState("")
  const [form, setForm] = useState<FormData>({
    merchant: "", date: "", total: "", subtotal: "", tax: "",
    category: "otros", paymentMethod: "", currency: "USD",
    reference: "", notes: "", tags: [], isRecurring: false,
    recurringFrequency: "monthly",
  })

  const fileInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  // Auto-process file shared via Web Share Target
  useEffect(() => {
    if (scannerOpen && sharedFile) {
      setSharedFile(null)
      processFile(sharedFile, false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scannerOpen, sharedFile])

  function resetState() {
    setStep("upload")
    setImageUrl(null)
    setAllItems([])
    setScanCount(0)
    setOcrProgress(0)
    setTagInput("")
    setForm({
      merchant: "", date: "", total: "", subtotal: "", tax: "",
      category: "otros", paymentMethod: "", currency: "USD",
      reference: "", notes: "", tags: [], isRecurring: false,
      recurringFrequency: "monthly",
    })
  }

  function handleClose() {
    setScannerOpen(false)
    setTimeout(resetState, 300)
  }

  function populateForm(data: OcrResultInput, isAdditional = false) {
    const newItems = data.items ?? []
    setAllItems((prev) => [...prev, ...newItems])

    if (!isAdditional) {
      setForm((f) => ({
        ...f,
        merchant: data.merchant ?? "",
        date: data.date ?? new Date().toISOString().split("T")[0],
        total: data.total?.toString() ?? "",
        subtotal: data.subtotal?.toString() ?? "",
        tax: data.tax?.toString() ?? "",
        category: data.category ?? "otros",
        paymentMethod: data.paymentMethod ?? "",
        currency: data.currency ?? "USD",
        reference: data.reference ?? "",
      }))
    } else {
      // Merge totals from additional scan
      setForm((f) => ({
        ...f,
        total: ((parseFloat(f.total) || 0) + (data.total ?? 0)).toFixed(2),
        subtotal: ((parseFloat(f.subtotal) || 0) + (data.subtotal ?? 0)).toFixed(2),
        tax: ((parseFloat(f.tax) || 0) + (data.tax ?? 0)).toFixed(2),
      }))
    }
    setScanCount((n) => n + 1)
  }

  async function processFile(file: File, isAdditional = false) {
    if (!file.type.startsWith("image/")) {
      toast.error("Solo se aceptan imágenes")
      return
    }

    setStep("processing")
    setOcrProgress(0)

    try {
      // Compress before OCR to reduce memory usage
      let compressed: File
      try {
        compressed = await imageCompression(file, {
          maxWidthOrHeight: 1800,
          useWebWorker: true,
          maxSizeMB: 3,
        })
      } catch {
        compressed = await imageCompression(file, {
          maxWidthOrHeight: 1800,
          useWebWorker: false,
          maxSizeMB: 3,
        })
      }

      if (!isAdditional) {
        setImageUrl(URL.createObjectURL(compressed))
      }

      // OCR runs entirely in the browser — no server, no API key
      const data: OcrResultInput = await runReceiptOcr(compressed, setOcrProgress)

      populateForm(data, isAdditional)
      setStep("confirm")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error procesando el recibo")
      setStep(scanCount > 0 ? "confirm" : "upload")
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processFile(file, scanCount > 0)
    e.target.value = ""
  }

  function handleGalleryInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processFile(file, scanCount > 0)
    e.target.value = ""
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file, scanCount > 0)
  }

  function addTag() {
    const t = tagInput.trim().toLowerCase()
    if (!t || form.tags.includes(t)) { setTagInput(""); return }
    setForm((f) => ({ ...f, tags: [...f.tags, t] }))
    setTagInput("")
  }

  function removeTag(tag: string) {
    setForm((f) => ({ ...f, tags: f.tags.filter((t) => t !== tag) }))
  }

  async function handleConfirm() {
    try {
      const expenseData = {
        merchant: form.merchant || "Sin nombre",
        date: new Date(form.date + "T12:00:00"),
        items: allItems,
        subtotal: parseFloat(form.subtotal) || 0,
        tax: parseFloat(form.tax) || 0,
        total: parseFloat(form.total) || 0,
        paymentMethod: form.paymentMethod || null,
        reference: form.reference || null,
        category: form.category,
        currency: form.currency,
        notes: form.notes,
        tags: form.tags,
        receiptImageUrl: null, // No se guardan fotos
      }

      await addExpense.mutateAsync(expenseData)

      if (form.isRecurring) {
        const nextDue = new Date()
        if (form.recurringFrequency === "weekly") nextDue.setDate(nextDue.getDate() + 7)
        else if (form.recurringFrequency === "biweekly") nextDue.setDate(nextDue.getDate() + 14)
        else if (form.recurringFrequency === "monthly") nextDue.setMonth(nextDue.getMonth() + 1)
        else if (form.recurringFrequency === "yearly") nextDue.setFullYear(nextDue.getFullYear() + 1)

        await addRecurring.mutateAsync({
          merchant: expenseData.merchant,
          category: expenseData.category,
          subtotal: expenseData.subtotal,
          tax: expenseData.tax,
          total: expenseData.total,
          paymentMethod: expenseData.paymentMethod,
          currency: expenseData.currency,
          notes: expenseData.notes,
          tags: expenseData.tags,
          frequency: form.recurringFrequency,
          nextDueDate: nextDue,
        })
        toast.success("Gasto guardado como recurrente")
      } else {
        toast.success("Gasto guardado")
      }
      handleClose()
    } catch {
      toast.error("Error al guardar el gasto")
    }
  }

  const isSaving = addExpense.isPending || addRecurring.isPending

  return (
    <Dialog open={scannerOpen} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === "upload" && "Escanear recibo"}
            {step === "camera" && "Cámara"}
            {step === "processing" && "Leyendo recibo..."}
            {step === "confirm" && (scanCount > 1 ? `Confirmar datos (${scanCount} scans)` : "Confirmar datos")}
          </DialogTitle>
        </DialogHeader>

        {/* UPLOAD */}
        {step === "upload" && (
          <div className="space-y-3">
            {/* Drop zone — desktop */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors",
                dragOver ? "border-foreground bg-accent" : "border-border hover:border-foreground/40 hover:bg-accent/50"
              )}
            >
              <Upload className="h-7 w-7 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium">Arrastra una foto aquí</p>
              <p className="text-xs text-muted-foreground mt-1">o elige una opción abajo</p>
            </div>

            {/* inputs ocultos */}
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileInput} className="hidden" />
            {/* gallery: sin capture para forzar galería en móvil */}
            <input ref={galleryInputRef} type="file" accept="image/*" onChange={handleGalleryInput} className="hidden" />

            {/* Botones de acción */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="gap-2 h-11"
                onClick={() => galleryInputRef.current?.click()}
              >
                <ImageIcon className="h-4 w-4" />
                Galería
              </Button>
              <Button
                variant="outline"
                className="gap-2 h-11"
                onClick={() => setStep("camera")}
              >
                <ScanLine className="h-4 w-4" />
                Cámara en vivo
              </Button>
            </div>
          </div>
        )}

        {/* CAMERA */}
        {step === "camera" && (
          <CameraCapture
            onCapture={(file) => processFile(file, scanCount > 0)}
            onCancel={() => setStep(scanCount > 0 ? "confirm" : "upload")}
          />
        )}

        {/* PROCESSING */}
        {step === "processing" && (
          <div className="space-y-4 py-2">
            {imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="Recibo" className="w-full max-h-48 object-contain rounded-lg" />
            )}
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              <span>
                {ocrProgress > 0
                  ? `Extrayendo texto... ${ocrProgress}%`
                  : "Cargando motor de reconocimiento..."}
              </span>
            </div>
            {/* Progress bar */}
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300 rounded-full"
                style={{ width: `${ocrProgress || 5}%` }}
              />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        )}

        {/* CONFIRM */}
        {step === "confirm" && (
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            {imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="Recibo" className="w-full max-h-28 object-contain rounded-lg bg-muted" />
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Comercio</Label>
                <Input value={form.merchant} onChange={(e) => setForm({ ...form, merchant: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Fecha</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Total</Label>
                <Input type="number" step="0.01" value={form.total}
                  onChange={(e) => setForm({ ...form, total: e.target.value })} className="tabular-nums" />
              </div>
              <div className="space-y-1.5">
                <Label>Subtotal</Label>
                <Input type="number" step="0.01" value={form.subtotal}
                  onChange={(e) => setForm({ ...form, subtotal: e.target.value })} className="tabular-nums" />
              </div>
              <div className="space-y-1.5">
                <Label>Impuestos</Label>
                <Input type="number" step="0.01" value={form.tax}
                  onChange={(e) => setForm({ ...form, tax: e.target.value })} className="tabular-nums" />
              </div>
              <div className="space-y-1.5">
                <Label>Categoría</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.icon} {cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Moneda</Label>
                <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Método de pago</Label>
                <Select value={form.paymentMethod || "__none__"}
                  onValueChange={(v) => setForm({ ...form, paymentMethod: v === "__none__" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Sin especificar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin especificar</SelectItem>
                    {PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Referencia</Label>
                <Input value={form.reference}
                  onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="Nº transacción" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Notas</Label>
                <Input value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notas opcionales..." />
              </div>

              {/* Tags */}
              <div className="col-span-2 space-y-1.5">
                <Label>Etiquetas</Label>
                <div className="flex gap-2">
                  <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag() } }}
                    placeholder="trabajo, viaje, deducible..."
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" size="icon" onClick={addTag}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {form.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {form.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="gap-1 cursor-pointer"
                        onClick={() => removeTag(tag)}>
                        {tag} <X className="h-3 w-3" />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Gasto recurrente */}
              <div className="col-span-2 rounded-lg border p-3 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isRecurring}
                    onChange={(e) => setForm({ ...form, isRecurring: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm font-medium">Gasto recurrente</span>
                </label>
                {form.isRecurring && (
                  <Select
                    value={form.recurringFrequency}
                    onValueChange={(v) => setForm({ ...form, recurringFrequency: v as RecurringFrequency })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.entries(RECURRING_LABELS) as [RecurringFrequency, string][]).map(([v, l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            {/* Acciones */}
            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm" className="gap-1.5"
                onClick={() => { if (step === "confirm") setStep("upload") }}>
                <RefreshCw className="h-3.5 w-3.5" />
                Reintentar
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5"
                onClick={() => galleryInputRef.current?.click()}>
                <ImageIcon className="h-3.5 w-3.5" />
                Galería
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5"
                onClick={() => setStep("camera")}>
                <ScanLine className="h-3.5 w-3.5" />
                Cámara
              </Button>
              <Button className="flex-1" onClick={handleConfirm} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Guardar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
