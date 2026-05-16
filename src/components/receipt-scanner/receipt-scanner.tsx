"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { useAuth } from "@/hooks/use-auth"
import { useAddExpense } from "@/hooks/use-expenses"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Upload, Loader2, CheckCircle2, X, ScanLine, Plus, RefreshCw, ImageIcon, FileText, Bookmark, BookmarkCheck, Trash2 } from "lucide-react"
import { useCategories } from "@/hooks/use-categories"
import { useAddRecurring } from "@/hooks/use-recurring"
import { useTemplates, useAddTemplate, useDeleteTemplate, useIncrementTemplateUse } from "@/hooks/use-templates"
import { PAYMENT_METHODS, CURRENCIES } from "@/lib/constants"
import type { OcrResultInput } from "@/lib/firebase/schemas"
import type { ReceiptItem, RecurringFrequency } from "@/types"
import { runReceiptOcr as runTesseract } from "@/lib/ocr/tesseract"
import { pdfFirstPageToBlob, pdfToStitchedImage } from "@/lib/ocr/pdf-utils"
import imageCompression from "browser-image-compression"
import heic2any from "heic2any"
import { cn } from "@/lib/utils"
import { CameraCapture } from "./camera-capture"
import { CategorySuggestion } from "@/components/shared/category-suggestion"
import { useCategoryRules, applyRules } from "@/hooks/use-category-rules"
import { useUIStore } from "@/stores/ui-store"

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
  const { data: categoryRules = [] } = useCategoryRules()
  const { data: templates = [] } = useTemplates()
  const { activeAccount } = useUIStore()
  const addExpense = useAddExpense()
  const addRecurring = useAddRecurring()
  const addTemplate = useAddTemplate()
  const deleteTemplate = useDeleteTemplate()
  const incrementTemplateUse = useIncrementTemplateUse()

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

  // Per-item category assignment for item split
  const [itemCategories, setItemCategories] = useState<Record<number, string>>({})
  const [splitSaving, setSplitSaving] = useState(false)

  // Template save dialog
  const [templateDialog, setTemplateDialog] = useState(false)
  const [templateName, setTemplateName] = useState("")
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null)

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
    setItemCategories({})
    setScanCount(0)
    setOcrProgress(0)
    setTagInput("")
    setTemplateDialog(false)
    setTemplateName("")
    setActiveTemplateId(null)
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
        category: applyRules(categoryRules, {
          merchant: data.merchant ?? "",
          amount: data.total ?? 0,
          notes: "",
        }) ?? data.category ?? "otros",
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

  async function processFile(rawFile: File, isAdditional = false) {
    // Detectar HEIC por extensión también (algunos navegadores reportan type vacío)
    const isHeic =
      rawFile.type === "image/heic" ||
      rawFile.type === "image/heif" ||
      /\.(heic|heif)$/i.test(rawFile.name)

    const isPdf = rawFile.type === "application/pdf"
    const isImage = rawFile.type.startsWith("image/") || isHeic

    if (!isImage && !isPdf) {
      toast.error("Solo se aceptan imágenes (JPG, PNG, HEIC) o PDFs")
      return
    }

    setStep("processing")
    setOcrProgress(0)

    try {
      // Convertir HEIC a JPEG antes de cualquier otra operación
      // (los navegadores en Windows/Android no pueden leer HEIC nativamente)
      let file = rawFile
      if (isHeic) {
        try {
          const converted = await heic2any({ blob: rawFile, toType: "image/jpeg", quality: 0.92 })
          const blob = Array.isArray(converted) ? converted[0] : converted
          file = new File([blob], rawFile.name.replace(/\.heic?$/i, ".jpg"), { type: "image/jpeg" })
        } catch {
          toast.error("No se pudo convertir el archivo HEIC. Intenta exportarlo como JPG desde tu dispositivo.")
          setStep("upload")
          return
        }
      }

      let fileToProcess: File | Blob = file
      let previewUrl: string | null = null

      if (isPdf) {
        // Preview: solo la primera página (rápido, para mostrar al usuario)
        // OCR: todas las páginas unidas (para que Gemini vea el documento completo)
        const [previewBlob, ocrBlob] = await Promise.all([
          pdfFirstPageToBlob(file),
          pdfToStitchedImage(file),
        ])
        previewUrl = URL.createObjectURL(previewBlob)
        fileToProcess = new File([ocrBlob], "receipt-pdf.jpg", { type: "image/jpeg" })
      } else {
        // Imágenes: comprimir para balance calidad/tamaño
        let compressed: File
        try {
          compressed = await imageCompression(file, {
            maxWidthOrHeight: 2400,
            useWebWorker: true,
            maxSizeMB: 4,
            initialQuality: 0.9,
          })
        } catch {
          compressed = await imageCompression(file, {
            maxWidthOrHeight: 2400,
            useWebWorker: false,
            maxSizeMB: 4,
            initialQuality: 0.9,
          })
        }
        fileToProcess = compressed
        previewUrl = URL.createObjectURL(compressed)
      }

      if (!isAdditional && previewUrl) {
        setImageUrl(previewUrl)
      }

      // Gemini primero (soporta imágenes Y PDFs nativamente)
      // Fallback a Tesseract solo si no hay internet o quota excedida
      const data = await runGeminiOcr(fileToProcess as File)

      populateForm(data, isAdditional)
      setStep("confirm")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error procesando el recibo")
      setStep(scanCount > 0 ? "confirm" : "upload")
    }
  }

  // Llama al API route de Gemini con fallback a Tesseract
  // Siempre recibe una imagen (los PDFs ya fueron convertidos antes de llegar aquí)
  async function runGeminiOcr(file: File): Promise<OcrResultInput> {
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const result = reader.result as string
        const b64 = result.includes(",") ? result.split(",")[1] : result
        if (b64) resolve(b64)
        else reject(new Error("No se pudo leer el archivo"))
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

    const mediaType = file.type || "image/jpeg"
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 35_000)

    try {
      const res = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64, mediaType }),
        signal: controller.signal,
      })

      if (res.status === 429 || !res.ok) {
        if (res.status !== 429) toast.info("Gemini no disponible, usando OCR local...")
        return runTesseract(file, setOcrProgress)
      }

      return await res.json() as OcrResultInput
    } catch {
      toast.info("Sin conexión, usando OCR local...")
      return runTesseract(file, setOcrProgress)
    } finally {
      clearTimeout(timeout)
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
    if (!file) return
    const isHeic = /\.(heic|heif)$/i.test(file.name) || file.type === "image/heic" || file.type === "image/heif"
    const valid = file.type.startsWith("image/") || file.type === "application/pdf" || isHeic
    if (!valid) { toast.error("Solo se aceptan imágenes (JPG, PNG, HEIC) o PDFs"); return }
    processFile(file, scanCount > 0)
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

  function applyTemplate(tpl: typeof templates[number]) {
    const today = new Date().toISOString().split("T")[0]
    setForm((f) => ({
      ...f,
      merchant: tpl.merchant,
      total: tpl.total.toString(),
      subtotal: tpl.subtotal.toString(),
      tax: tpl.tax.toString(),
      category: tpl.category,
      paymentMethod: tpl.paymentMethod ?? "",
      currency: tpl.currency,
      notes: tpl.notes,
      tags: tpl.tags,
      date: f.date || today,
    }))
    setActiveTemplateId(tpl.id)
    incrementTemplateUse.mutate(tpl.id)
    setStep("confirm")
  }

  async function handleSaveTemplate() {
    if (!templateName.trim()) return
    const cat = categories.find((c) => c.id === form.category)
    try {
      await addTemplate.mutateAsync({
        name: templateName.trim(),
        merchant: form.merchant || "Sin nombre",
        category: form.category,
        total: parseFloat(form.total) || 0,
        subtotal: parseFloat(form.subtotal) || 0,
        tax: parseFloat(form.tax) || 0,
        paymentMethod: form.paymentMethod || null,
        currency: form.currency,
        notes: form.notes,
        tags: form.tags,
      })
      toast.success("Plantilla guardada")
      setTemplateDialog(false)
      setTemplateName("")
    } catch {
      toast.error("Error al guardar la plantilla")
    }
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
        receiptImageUrl: null,
        account: activeAccount,
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

  // Save each OCR item as a separate expense
  async function handleSplitByItems() {
    if (allItems.length === 0) return
    setSplitSaving(true)
    let ok = 0
    const baseDate = form.date ? new Date(form.date + "T12:00:00") : new Date()
    for (let i = 0; i < allItems.length; i++) {
      const item = allItems[i]
      const cat = itemCategories[i] ?? form.category
      const total = item.price * item.quantity
      try {
        await addExpense.mutateAsync({
          merchant: item.name || form.merchant || "Ítem",
          date: baseDate,
          items: [item],
          subtotal: total,
          tax: 0,
          total,
          paymentMethod: form.paymentMethod || null,
          reference: form.reference || null,
          category: cat,
          currency: form.currency,
          notes: form.notes,
          tags: [...form.tags, "division-recibo"],
          receiptImageUrl: null,
        })
        ok++
      } catch { /* continue */ }
    }
    setSplitSaving(false)
    if (ok > 0) {
      toast.success(`${ok} gastos separados guardados`)
      handleClose()
    } else {
      toast.error("Error al guardar los gastos")
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
            {/* Plantillas de acceso rápido */}
            {templates.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                  Acceso rápido
                </p>
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {templates.map((tpl) => {
                    const cat = categories.find((c) => c.id === tpl.category)
                    return (
                      <div key={tpl.id} className="relative shrink-0 group">
                        <button
                          onClick={() => applyTemplate(tpl)}
                          className="flex flex-col items-start gap-0.5 px-3 py-2 rounded-xl border bg-card hover:bg-accent hover:border-primary transition-colors text-left min-w-[100px] max-w-[140px]"
                        >
                          <span className="text-lg leading-none">{cat?.icon ?? "📦"}</span>
                          <span className="text-xs font-medium truncate w-full mt-1">{tpl.name}</span>
                          <span className="text-[10px] text-muted-foreground tabular-nums">{tpl.currency} {tpl.total.toFixed(2)}</span>
                        </button>
                        {/* Delete button */}
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteTemplate.mutate(tpl.id) }}
                          className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-destructive text-white items-center justify-center hidden group-hover:flex shadow-sm"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    )
                  })}
                </div>
                <div className="h-px bg-border" />
              </div>
            )}

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
              <p className="text-sm font-medium">Arrastra una foto o PDF aquí</p>
              <p className="text-xs text-muted-foreground mt-1">JPG, PNG, HEIC, WEBP, PDF — o elige una opción abajo</p>
            </div>

            {/* inputs ocultos — accept explícito para HEIC y PDF */}
            <input ref={fileInputRef} type="file" accept="image/*,.heic,.heif,application/pdf" onChange={handleFileInput} className="hidden" />
            <input ref={galleryInputRef} type="file" accept="image/*,.heic,.heif,application/pdf" onChange={handleGalleryInput} className="hidden" />

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
                  : "Analizando recibo con IA..."}
              </span>
            </div>
            {ocrProgress > 0 && (
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300 rounded-full"
                  style={{ width: `${ocrProgress}%` }}
                />
              </div>
            )}
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
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="Recibo" className="w-full max-h-28 object-contain rounded-lg bg-muted" />
            ) : (
              <div className="w-full h-16 rounded-lg bg-muted flex items-center justify-center gap-2 text-muted-foreground text-sm">
                <FileText className="h-5 w-5" />
                PDF cargado
              </div>
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
                <CategorySuggestion
                  merchant={form.merchant}
                  currentCategory={form.category}
                  onAccept={(cat) => setForm((f) => ({ ...f, category: cat }))}
                />
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

              {/* División por ítems del recibo */}
              {allItems.length > 1 && (
                <div className="col-span-2 rounded-lg border p-3 space-y-2.5">
                  <p className="text-xs font-semibold flex items-center gap-1.5">
                    <span>🧾</span>
                    Dividir por ítems ({allItems.length} detectados)
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Asigna categorías individuales y guarda cada ítem como gasto separado
                  </p>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {allItems.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{item.name}</p>
                          <p className="text-muted-foreground tabular-nums">
                            {item.quantity > 1 ? `${item.quantity}× ` : ""}{form.currency} {(item.price * item.quantity).toFixed(2)}
                          </p>
                        </div>
                        <Select
                          value={itemCategories[idx] ?? form.category}
                          onValueChange={v => setItemCategories(prev => ({ ...prev, [idx]: v }))}
                        >
                          <SelectTrigger className="h-7 text-xs w-28 shrink-0">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map(c => (
                              <SelectItem key={c.id} value={c.id} className="text-xs">{c.icon} {c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full gap-1.5 text-xs"
                    onClick={handleSplitByItems}
                    disabled={splitSaving}
                  >
                    {splitSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    Guardar {allItems.length} gastos separados
                  </Button>
                </div>
              )}

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
            <div className="flex gap-2 pt-1 flex-wrap">
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
              {/* Save as template */}
              {activeTemplateId ? (
                <Button variant="outline" size="sm" className="gap-1.5 text-primary border-primary/40"
                  disabled>
                  <BookmarkCheck className="h-3.5 w-3.5" />
                  Plantilla activa
                </Button>
              ) : (
                <Button variant="outline" size="sm" className="gap-1.5"
                  onClick={() => { setTemplateName(form.merchant); setTemplateDialog(true) }}>
                  <Bookmark className="h-3.5 w-3.5" />
                  Guardar plantilla
                </Button>
              )}
              <Button className="flex-1 min-w-[80px]" onClick={handleConfirm} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Guardar
              </Button>
            </div>

            {/* Save-template mini dialog */}
            {templateDialog && (
              <div className="rounded-lg border bg-card p-3 space-y-2 shadow-sm">
                <p className="text-xs font-medium">Nombre de la plantilla</p>
                <div className="flex gap-2">
                  <Input
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSaveTemplate() } }}
                    placeholder="Ej: Café del trabajo"
                    className="h-8 text-sm flex-1"
                    autoFocus
                  />
                  <Button size="sm" className="h-8 px-3" onClick={handleSaveTemplate}
                    disabled={addTemplate.isPending || !templateName.trim()}>
                    {addTemplate.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Guardar"}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 px-2"
                    onClick={() => { setTemplateDialog(false); setTemplateName("") }}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Guarda comercio, categoría, monto y método de pago para acceso rápido
                </p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
