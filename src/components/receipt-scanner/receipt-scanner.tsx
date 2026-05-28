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
import { Upload, Loader2, CheckCircle2, X, ScanLine, Plus, RefreshCw, ImageIcon, FileText, Bookmark, BookmarkCheck, Trash2, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, MapPin, Navigation, Globe } from "lucide-react"
import { useCategories } from "@/hooks/use-categories"
import { useAddRecurring } from "@/hooks/use-recurring"
import { useDeleteExpense } from "@/hooks/use-expenses"
import { addMonths, addWeeks, addYears } from "date-fns"
import { useTemplates, useAddTemplate, useDeleteTemplate, useIncrementTemplateUse } from "@/hooks/use-templates"
import { PAYMENT_METHODS, CURRENCIES } from "@/lib/constants"
import { getLastCurrency, getLastPaymentMethod, setLastCurrency, setLastPaymentMethod } from "@/lib/last-used"
import { authFetch } from "@/lib/client-fetch"
import type { OcrResultInput } from "@/lib/firebase/schemas"
import type { ReceiptItem, RecurringFrequency } from "@/types"
import { runReceiptOcr as runTesseract } from "@/lib/ocr/tesseract"
import { pdfFirstPageToBlob, pdfToStitchedImage } from "@/lib/ocr/pdf-utils"
import imageCompression from "browser-image-compression"
import heic2any from "heic2any"
import { cn, formatCurrency } from "@/lib/utils"
import { uploadReceipt } from "@/lib/supabase/storage"
import { CameraCapture } from "./camera-capture"
import { useDuplicateDetector } from "@/hooks/use-duplicate-detector"
import { CategorySuggestion } from "@/components/shared/category-suggestion"
import { useCategoryRules, applyRules } from "@/hooks/use-category-rules"
import { useUIStore } from "@/stores/ui-store"
import { usePlan } from "@/hooks/use-plan"

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
  project: string
  privacy: "private" | "public"
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
  const { checkDuplicate } = useDuplicateDetector()
  const addExpense = useAddExpense()
  const deleteExpense = useDeleteExpense()
  const addRecurring = useAddRecurring()
  const addTemplate = useAddTemplate()
  const deleteTemplate = useDeleteTemplate()
  const incrementTemplateUse = useIncrementTemplateUse()

  const { data: planData } = usePlan()
  const canOcr = planData?.canOcr ?? true            // optimista mientras carga
  const ocrUsed  = planData?.ocrScansThisMonth ?? 0
  const ocrLimit = planData?.limits?.ocrScansPerMonth ?? Infinity
  const isPlanFree = planData?.plan === "free"

  const [step, setStep] = useState<Step>("upload")
  // Sub-step within the "confirm" wizard (1 = what, 2 = how much, 3 = review)
  const [confirmStep, setConfirmStep] = useState<1 | 2 | 3>(1)
  const [prevConfirmStep, setPrevConfirmStep] = useState<1 | 2 | 3>(1)
  const [dragOver, setDragOver] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [allItems, setAllItems] = useState<ReceiptItem[]>([])
  const [scanCount, setScanCount] = useState(0)
  const [ocrProgress, setOcrProgress] = useState(0)
  const [ocrEngine, setOcrEngine] = useState<"gemini" | "groq" | "tesseract" | null>(null)  // #21
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(["basic"]))
  const [tagInput, setTagInput] = useState("")
  const [form, setForm] = useState<FormData>({
    merchant: "", date: "", total: "", subtotal: "", tax: "",
    category: "otros", paymentMethod: getLastPaymentMethod(), currency: getLastCurrency(),
    reference: "", notes: "", tags: [], isRecurring: false,
    recurringFrequency: "monthly", project: "", privacy: "private",
  })

  // Geolocation
  const [geo, setGeo] = useState<{ lat: number; lng: number; address?: string } | null>(null)
  const [geoLoading, setGeoLoading] = useState(false)

  // Receipt file (stored after processing, uploaded on confirm)
  const [receiptFile, setReceiptFile] = useState<File | Blob | null>(null)

  // Per-item category assignment for item split
  const [itemCategories, setItemCategories] = useState<Record<number, string>>({})
  const [splitSaving, setSplitSaving] = useState(false)

  // Template save dialog
  const [templateDialog, setTemplateDialog] = useState(false)
  const [templateName, setTemplateName] = useState("")
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null)

  // Duplicate confirmation dialog
  const [dupDialog, setDupDialog] = useState(false)
  const [dupInfo, setDupInfo] = useState<{ merchant: string; total: number } | null>(null)
  const [pendingExpense, setPendingExpense] = useState<Parameters<typeof addExpense.mutateAsync>[0] | null>(null)

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
    setConfirmStep(1)
    setPrevConfirmStep(1)
    setImageUrl(null)
    setAllItems([])
    setItemCategories({})
    setScanCount(0)
    setOcrProgress(0)
    setOcrEngine(null)
    setOpenSections(new Set(["basic"]))
    setTagInput("")
    setTemplateDialog(false)
    setTemplateName("")
    setActiveTemplateId(null)
    setGeo(null)
    setGeoLoading(false)
    setReceiptFile(null)
    setForm({
      merchant: "", date: "", total: "", subtotal: "", tax: "",
      category: "otros", paymentMethod: "", currency: "USD",
      reference: "", notes: "", tags: [], isRecurring: false,
      recurringFrequency: "monthly", project: "", privacy: "private",
    })
  }

  function toggleSection(id: string) {
    setOpenSections((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  /** Capture geolocation via browser GPS */
  async function captureGeo() {
    if (!navigator.geolocation) {
      toast.error("Tu navegador no soporta geolocalización")
      return
    }
    setGeoLoading(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = parseFloat(pos.coords.latitude.toFixed(6))
        const lng = parseFloat(pos.coords.longitude.toFixed(6))
        setGeo({ lat, lng })
        setGeoLoading(false)
        // Optional: reverse geocode using a free API
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`)
          if (r.ok) {
            const d = await r.json() as { display_name?: string }
            if (d.display_name) {
              setGeo({ lat, lng, address: d.display_name.split(",").slice(0, 3).join(", ") })
            }
          }
        } catch { /* address not critical */ }
      },
      (err) => {
        setGeoLoading(false)
        if (err.code === 1) toast.error("Permiso de ubicación denegado")
        else toast.error("No se pudo obtener la ubicación")
      },
      { timeout: 10_000, enableHighAccuracy: true }
    )
  }

  /** Navigate between confirm wizard sub-steps with direction tracking */
  function goToConfirmStep(next: 1 | 2 | 3) {
    setPrevConfirmStep(confirmStep)
    setConfirmStep(next)
  }

  /** #22 — Date range validation */
  function isValidDate(dateStr: string): boolean {
    if (!dateStr) return false
    const d = new Date(dateStr)
    const year = d.getFullYear()
    return !isNaN(d.getTime()) && year >= 2000 && year <= 2030
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
      // Merge totals from additional scan — round to 2 decimals to avoid float drift
      const round2 = (n: number) => Math.round(n * 100) / 100
      setForm((f) => {
        const newTotal    = round2((parseFloat(f.total)    || 0) + (data.total    ?? 0))
        const newTax      = round2((parseFloat(f.tax)      || 0) + (data.tax      ?? 0))
        const newSubtotal = round2((parseFloat(f.subtotal) || 0) + (data.subtotal ?? 0))
        // Guarantee subtotal + tax = total to avoid internal inconsistency
        const correctedSubtotal = newSubtotal > 0 ? newSubtotal : round2(newTotal - newTax)
        return {
          ...f,
          total:    newTotal.toFixed(2),
          tax:      newTax.toFixed(2),
          subtotal: correctedSubtotal.toFixed(2),
        }
      })
    }
    setScanCount((n) => n + 1)
  }

  async function processFile(rawFile: File, isAdditional = false) {
    // Bloquear si el plan free agotó sus escaneos OCR
    if (!canOcr) {
      toast.error(`Límite de ${ocrLimit} escaneos OCR del mes alcanzado. Actualiza a Pro para escaneos ilimitados.`)
      return
    }

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
      // Store file reference for later upload to Supabase Storage
      if (!isAdditional) {
        setReceiptFile(fileToProcess)
      }

      // Gemini primero -> Groq segundo -> Tesseract último
      const data = await runApiOcr(fileToProcess as File)

      populateForm(data, isAdditional)
      // Start wizard from step 1 on a fresh scan; keep current step on additional scans
      if (!isAdditional) {
        setConfirmStep(1)
        setPrevConfirmStep(1)
      }
      setStep("confirm")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error procesando el recibo")
      setStep(scanCount > 0 ? "confirm" : "upload")
    }
  }

  // Llama al API route de Gemini/Groq con fallback a Tesseract
  // Siempre recibe una imagen (los PDFs ya fueron convertidos antes de llegar aquí)
  async function runApiOcr(file: File): Promise<OcrResultInput> {
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

    // 1. Intentar con Gemini (controlador independiente)
    try {
      const geminiCtrl = new AbortController()
      const geminiTimeout = setTimeout(() => geminiCtrl.abort(), 30_000)
      try {
        const res = await authFetch("/api/ocr", { base64, mediaType, provider: "gemini" }, { signal: geminiCtrl.signal })
        clearTimeout(geminiTimeout)
        if (res.ok) {
          setOcrEngine("gemini")
          return await res.json() as OcrResultInput
        }
        const errBody = await res.json().catch(() => ({})) as Record<string, unknown>
        console.warn(`[OCR] Gemini ${res.status}:`, errBody)
        if (res.status === 429 || String(errBody?.error).includes("quota")) {
          // Quota exceeded → skip Groq (same keys), go to Tesseract
          clearTimeout(geminiTimeout)
          toast.info("Cuota de IA agotada — usando OCR local")
          setOcrEngine("tesseract")
          return runTesseract(file, setOcrProgress)
        }
      } catch (err) {
        clearTimeout(geminiTimeout)
        const isAbort = err instanceof Error && err.name === "AbortError"
        console.warn(isAbort ? "[OCR] Gemini timeout" : "[OCR] Gemini error", err)
      }
    } catch { /* ignore setup errors */ }

    // 2. Intentar con Groq (controlador independiente)
    try {
      const groqCtrl = new AbortController()
      const groqTimeout = setTimeout(() => groqCtrl.abort(), 30_000)
      try {
        const res = await authFetch("/api/ocr", { base64, mediaType, provider: "groq" }, { signal: groqCtrl.signal })
        clearTimeout(groqTimeout)
        if (res.ok) {
          setOcrEngine("groq")
          return await res.json() as OcrResultInput
        }
        const errBody = await res.json().catch(() => ({})) as Record<string, unknown>
        console.warn(`[OCR] Groq ${res.status}:`, errBody)
      } catch (err) {
        clearTimeout(groqTimeout)
        const isAbort = err instanceof Error && err.name === "AbortError"
        console.warn(isAbort ? "[OCR] Groq timeout" : "[OCR] Groq error", err)
      }
    } catch { /* ignore setup errors */ }

    // 3. Fallback final a Tesseract (Local)
    console.info("[OCR] Fallback a Tesseract OCR local")
    toast.info("Usando OCR local — puede tardar un poco más")
    setOcrEngine("tesseract")
    return runTesseract(file, setOcrProgress)
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

  const MAX_TAGS = 10

  function addTag() {
    const t = tagInput.trim().toLowerCase()
    if (!t || form.tags.includes(t)) { setTagInput(""); return }
    if (form.tags.length >= MAX_TAGS) {
      toast.error(`Máximo ${MAX_TAGS} etiquetas por gasto`)
      setTagInput("")
      return
    }
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
    setConfirmStep(1)
    setPrevConfirmStep(1)
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

  /** Parse a "yyyy-MM-dd" string as a LOCAL date (avoids UTC shift). */
  function parseLocalDate(dateStr: string): Date {
    const [y, m, d] = dateStr.split("-").map(Number)
    return new Date(y, m - 1, d)
  }

  async function handleConfirm() {
    const parsedTotal = parseFloat(form.total)
    if (!parsedTotal || parsedTotal <= 0) {
      toast.error("El importe debe ser mayor que cero")
      return
    }
    if (form.date && !isValidDate(form.date)) {
      toast.error("Fecha inválida — debe estar entre 2000 y 2030")
      return
    }
    try {
      // Upload receipt image to Supabase Storage if available
      let receiptImageUrl: string | null = null
      if (receiptFile && user) {
        try {
          const idToken = await user.getIdToken()
          const fileToUpload = receiptFile instanceof File
            ? receiptFile
            : new File([receiptFile], "receipt.jpg", { type: "image/jpeg" })
          const { url } = await uploadReceipt(fileToUpload, idToken)
          receiptImageUrl = url
        } catch (err) {
          console.warn("[Receipt upload]", err)
          // Non-fatal — save expense without the image URL
        }
      }

      const expenseData = {
        merchant: form.merchant || "Sin nombre",
        date: form.date ? parseLocalDate(form.date) : new Date(),
        items: allItems,
        subtotal: parseFloat(form.subtotal) || 0,
        tax: parseFloat(form.tax) || 0,
        total: parsedTotal,
        paymentMethod: form.paymentMethod || null,
        reference: form.reference || null,
        category: form.category,
        currency: form.currency,
        notes: form.notes,
        tags: form.tags,
        receiptImageUrl,
        account: activeAccount,
        project: form.project || undefined,
        privacy: form.privacy,
        geo: geo ? { lat: geo.lat, lng: geo.lng } : undefined,
      }

      const dup = checkDuplicate({ merchant: expenseData.merchant, total: expenseData.total })
      if (dup) {
        // Block the save — show confirmation dialog
        setPendingExpense(expenseData)
        setDupInfo({ merchant: dup.merchant, total: dup.total })
        setDupDialog(true)
        return
      }

      await saveExpense(expenseData)
    } catch {
      toast.error("Error al guardar el gasto")
    }
  }

  /** Core save — shared by normal confirm and "save anyway" after dup warning. */
  async function saveExpense(expenseData: Parameters<typeof addExpense.mutateAsync>[0]) {
    setLastCurrency(form.currency)
    setLastPaymentMethod(form.paymentMethod)
    await addExpense.mutateAsync(expenseData)

    if (form.isRecurring) {
      const now = new Date()
      const nextDue =
        form.recurringFrequency === "weekly"   ? addWeeks(now, 1) :
        form.recurringFrequency === "biweekly" ? addWeeks(now, 2) :
        form.recurringFrequency === "monthly"  ? addMonths(now, 1) :
        addYears(now, 1)

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
  }

  // Save each OCR item as a separate expense — with full rollback on partial failure
  async function handleSplitByItems() {
    if (allItems.length === 0) return
    setSplitSaving(true)
    const baseDate = form.date ? parseLocalDate(form.date) : new Date()
    const createdIds: string[] = []

    try {
      for (let i = 0; i < allItems.length; i++) {
        const item = allItems[i]
        const cat  = itemCategories[i] ?? form.category
        const total = Math.round(item.price * item.quantity * 100) / 100
        if (total <= 0) continue            // skip zero/negative items
        const id = await addExpense.mutateAsync({
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
          project: form.project || undefined,
          privacy: form.privacy,
          geo: geo ? { lat: geo.lat, lng: geo.lng } : undefined,
        })
        createdIds.push(id)
      }
      toast.success(`${createdIds.length} gastos separados guardados`)
      handleClose()
    } catch {
      // Rollback: delete all expenses created so far
      if (createdIds.length > 0) {
        await Promise.allSettled(createdIds.map(id => deleteExpense.mutateAsync(id)))
        toast.error("Error al guardar — se revirtieron los gastos creados")
      } else {
        toast.error("Error al guardar los gastos")
      }
    } finally {
      setSplitSaving(false)
    }
  }

  const isSaving = addExpense.isPending || addRecurring.isPending

  return (
    <>
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
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
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

            {/* OCR quota badge — solo visible en plan free */}
            {isPlanFree && (
              <div className={cn(
                "flex items-center justify-between rounded-lg px-3 py-2 text-xs",
                canOcr
                  ? "bg-muted text-muted-foreground"
                  : "bg-destructive/10 text-destructive border border-destructive/30"
              )}>
                <span>
                  {canOcr
                    ? `Escaneos OCR: ${ocrUsed} / ${ocrLimit} este mes`
                    : `Límite de ${ocrLimit} escaneos alcanzado`}
                </span>
                {!canOcr && (
                  <a
                    href="/pricing"
                    className="font-semibold underline underline-offset-2 ml-2 hover:opacity-80"
                    onClick={() => setScannerOpen(false)}
                  >
                    Actualizar plan
                  </a>
                )}
              </div>
            )}

            {/* Drop zone — desktop */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => canOcr ? fileInputRef.current?.click() : undefined}
              className={cn(
                "border-2 border-dashed rounded-xl p-8 text-center transition-colors",
                canOcr ? "cursor-pointer" : "cursor-not-allowed opacity-50",
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
                disabled={!canOcr}
                onClick={() => canOcr && galleryInputRef.current?.click()}
              >
                <ImageIcon className="h-4 w-4" />
                Galería
              </Button>
              <Button
                variant="outline"
                className="gap-2 h-11"
                disabled={!canOcr}
                onClick={() => canOcr && setStep("camera")}
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
                  ? `Extrayendo texto con OCR local... ${ocrProgress}%`
                  : ocrEngine === "tesseract"
                  ? "Procesando con Tesseract OCR..."
                  : ocrEngine === "groq"
                  ? "Procesando con Groq Llama 3.2..."
                  : "Procesando con IA (Gemini/Groq)..."}
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

        {/* CONFIRM — 3-step wizard */}
        {step === "confirm" && (() => {
          // Determine slide direction for CSS animation
          const slideIn  = confirmStep > prevConfirmStep ? "slide-in-from-right" : "slide-in-from-left"
          const animKey  = confirmStep  // changing key re-mounts for animation

          const cat = categories.find((c) => c.id === form.category)

          return (
            <div className="space-y-3">
              {/* ── Progress indicator ── */}
              <div className="flex items-center justify-between px-0.5">
                <span className="text-xs text-muted-foreground font-mono">
                  {confirmStep} / 3
                </span>
                <div className="flex gap-1.5">
                  {([1, 2, 3] as const).map((n) => (
                    <button
                      key={n}
                      onClick={() => goToConfirmStep(n)}
                      className={cn(
                        "h-2 rounded-full transition-all duration-300",
                        n === confirmStep
                          ? "w-6 bg-primary"
                          : n < confirmStep
                          ? "w-2 bg-primary/50"
                          : "w-2 bg-muted-foreground/25"
                      )}
                    />
                  ))}
                </div>
                <span className="text-xs font-medium text-muted-foreground">
                  {confirmStep === 1 ? "¿Qué compraste?" : confirmStep === 2 ? "¿Cuánto gastaste?" : "Revisar y guardar"}
                </span>
              </div>

              {/* ── Animated step content ── */}
              <div className="overflow-hidden">
                <div
                  key={animKey}
                  className={cn(
                    "space-y-3 max-h-[55vh] overflow-y-auto pr-1",
                    "animate-in duration-200 fade-in",
                    slideIn
                  )}
                >
                  {/* ════════════════════════════════════════
                      STEP 1 — ¿Qué compraste?
                      Merchant · Date · Category · Notes (optional)
                  ════════════════════════════════════════ */}
                  {confirmStep === 1 && (
                    <div className="space-y-4">
                      {/* Merchant — large, autofocused */}
                      <div className="space-y-1.5">
                        <Label className="text-sm font-semibold">Comercio</Label>
                        <Input
                          value={form.merchant}
                          onChange={(e) => setForm({ ...form, merchant: e.target.value })}
                          placeholder="¿Dónde compraste?"
                          className="h-11 text-base"
                          autoFocus
                        />
                      </div>

                      {/* Date */}
                      <div className="space-y-1.5">
                        <Label>Fecha</Label>
                        <Input
                          type="date"
                          value={form.date}
                          min="2000-01-01"
                          max="2030-12-31"
                          onChange={(e) => setForm({ ...form, date: e.target.value })}
                        />
                        {form.date && !isValidDate(form.date) && (
                          <p className="text-[10px] text-destructive">Fecha inválida — debe estar entre 2000 y 2030</p>
                        )}
                      </div>

                      {/* Category */}
                      <div className="space-y-1.5">
                        <Label>Categoría</Label>
                        <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                          <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {categories.map((c) => (
                              <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <CategorySuggestion
                          merchant={form.merchant}
                          currentCategory={form.category}
                          onAccept={(c) => setForm((f) => ({ ...f, category: c }))}
                        />
                      </div>

                      {/* Notes + Project + Geo — collapsible */}
                      <div className="rounded-lg border overflow-hidden">
                        <button
                          type="button"
                          onClick={() => toggleSection("notes1")}
                          className="w-full flex items-center justify-between py-2 px-3 text-xs font-mono uppercase tracking-widest text-muted-foreground bg-muted/30 hover:bg-muted/50 transition-colors"
                        >
                          <span>Detalles adicionales</span>
                          {openSections.has("notes1") ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </button>
                        {openSections.has("notes1") && (
                          <div className="p-3 border-t space-y-3">
                            <div className="space-y-1.5">
                              <Label className="text-xs text-muted-foreground">Notas</Label>
                              <Input
                                value={form.notes}
                                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                                placeholder="Notas opcionales..."
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs text-muted-foreground">Proyecto</Label>
                              <Input
                                value={form.project}
                                onChange={(e) => setForm({ ...form, project: e.target.value })}
                                placeholder="Nombre del proyecto (opcional)"
                              />
                            </div>
                            {/* Geolocation capture */}
                            <div className="space-y-1.5">
                              <Label className="text-xs text-muted-foreground">Ubicación</Label>
                              {geo ? (
                                <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs">
                                  <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
                                  <span className="flex-1 truncate text-foreground">
                                    {geo.address ?? `${geo.lat}, ${geo.lng}`}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setGeo(null)}
                                    className="shrink-0 text-muted-foreground hover:text-destructive"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="w-full gap-2 h-9 text-xs"
                                  onClick={captureGeo}
                                  disabled={geoLoading}
                                >
                                  {geoLoading
                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    : <Navigation className="h-3.5 w-3.5" />}
                                  {geoLoading ? "Obteniendo ubicación..." : "Capturar ubicación GPS"}
                                </Button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ════════════════════════════════════════
                      STEP 2 — ¿Cuánto gastaste?
                      Total · Currency · Subtotal+Tax (collapsible) · Payment
                  ════════════════════════════════════════ */}
                  {confirmStep === 2 && (
                    <div className="space-y-4">
                      {/* Total — large, prominent */}
                      <div className="space-y-1.5">
                        <Label className="text-sm font-semibold">Total</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-sm">
                            {form.currency}
                          </span>
                          <Input
                            type="number" inputMode="decimal"
                            step="0.01"
                            value={form.total}
                            onChange={(e) => setForm({ ...form, total: e.target.value })}
                            className="pl-14 h-14 text-2xl font-semibold tabular-nums"
                            autoFocus
                            placeholder="0.00"
                          />
                        </div>
                      </div>

                      {/* Currency */}
                      <div className="space-y-1.5">
                        <Label>Moneda</Label>
                        <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                          <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Payment method */}
                      <div className="space-y-1.5">
                        <Label>Método de pago</Label>
                        <Select
                          value={form.paymentMethod || "__none__"}
                          onValueChange={(v) => setForm({ ...form, paymentMethod: v === "__none__" ? "" : v })}
                        >
                          <SelectTrigger className="h-10"><SelectValue placeholder="Sin especificar" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Sin especificar</SelectItem>
                            {PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Desglose — collapsible */}
                      <div className="rounded-lg border overflow-hidden">
                        <button
                          type="button"
                          onClick={() => toggleSection("breakdown")}
                          className="w-full flex items-center justify-between py-2 px-3 text-xs font-mono uppercase tracking-widest text-muted-foreground bg-muted/30 hover:bg-muted/50 transition-colors"
                        >
                          <span>🧾 Desglose (subtotal + impuesto)</span>
                          {openSections.has("breakdown") ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </button>
                        {openSections.has("breakdown") && (
                          <div className="p-3 grid grid-cols-2 gap-3 border-t">
                            <div className="space-y-1.5">
                              <Label>Subtotal</Label>
                              <Input type="number" inputMode="decimal" step="0.01" value={form.subtotal}
                                onChange={(e) => setForm({ ...form, subtotal: e.target.value })} className="tabular-nums" />
                            </div>
                            <div className="space-y-1.5">
                              <Label>IVA / Impuesto</Label>
                              <Input type="number" inputMode="decimal" step="0.01" value={form.tax}
                                onChange={(e) => setForm({ ...form, tax: e.target.value })} className="tabular-nums" />
                            </div>
                            <div className="col-span-2 space-y-1.5">
                              <Label>Referencia</Label>
                              <Input value={form.reference}
                                onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="Nº transacción" />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ════════════════════════════════════════
                      STEP 3 — Revisar y guardar
                      Summary card · Tags · Receipt image · Save button
                  ════════════════════════════════════════ */}
                  {confirmStep === 3 && (
                    <div className="space-y-4">
                      {/* OCR engine badge + confidence */}
                      {ocrEngine && (() => {
                        const populated = [form.merchant, form.date, form.total, form.category, form.currency].filter(Boolean).length
                        const pct = populated / 5
                        const totalNum = parseFloat(form.total) || 0
                        const isHighConf = (ocrEngine === "gemini" || ocrEngine === "groq") && pct === 1 && totalNum > 0
                        const isMedConf  = (ocrEngine === "gemini" || ocrEngine === "groq") && pct < 1
                        const confidence = isHighConf
                          ? { icon: "🟢", label: "Alta confianza", color: "text-green-700 dark:text-green-400" }
                          : isMedConf
                          ? { icon: "🟡", label: "Confianza media — revisa los campos", color: "text-warning" }
                          : { icon: "🔴", label: "Baja confianza — verifica los datos", color: "text-destructive" }
                        return (
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span className={cn(
                              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted font-mono border",
                              ocrEngine === "gemini"
                                ? "border-green-500/20 text-green-700 dark:text-green-400"
                                : ocrEngine === "groq"
                                ? "border-warning/20 text-warning"
                                : "border-warning/20 text-warning"
                            )}>
                              {ocrEngine === "gemini" ? "✨ Gemini 2.0 Flash" : ocrEngine === "groq" ? "🚀 Groq Llama 3.2" : "🔤 Tesseract OCR"}
                            </span>
                            <span className={cn("font-medium", confidence.color)}>
                              {confidence.icon} {confidence.label}
                            </span>
                          </div>
                        )
                      })()}

                      {/* Summary card */}
                      <div className="rounded-xl border bg-card p-4 space-y-3">
                        <div className="flex items-start gap-3">
                          <div
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xl"
                            style={{ backgroundColor: `${cat?.color ?? "#6b7280"}20` }}
                          >
                            {cat?.icon ?? "📦"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-base truncate">{form.merchant || "Sin nombre"}</p>
                            <p className="text-xs text-muted-foreground">{cat?.name ?? form.category} · {form.date || "Sin fecha"}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xl font-bold tabular-nums">
                              {form.total ? `${form.currency} ${parseFloat(form.total).toFixed(2)}` : "—"}
                            </p>
                            {form.paymentMethod && (
                              <p className="text-xs text-muted-foreground">{form.paymentMethod}</p>
                            )}
                          </div>
                        </div>
                        {form.notes && (
                          <p className="text-xs text-muted-foreground border-t pt-2">{form.notes}</p>
                        )}
                        {(form.project || geo) && (
                          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground border-t pt-2">
                            {form.project && (
                              <span className="flex items-center gap-1">
                                <FileText className="h-3 w-3" /> {form.project}
                              </span>
                            )}
                            {geo && (
                              <span className="flex items-center gap-1 max-w-[200px] truncate">
                                <MapPin className="h-3 w-3 shrink-0" />
                                {geo.address ?? `${geo.lat}, ${geo.lng}`}
                              </span>
                            )}
                          </div>
                        )}
                        {(parseFloat(form.subtotal) > 0 || parseFloat(form.tax) > 0) && (
                          <div className="flex gap-4 text-xs text-muted-foreground border-t pt-2">
                            {parseFloat(form.subtotal) > 0 && (
                              <span>Subtotal: {form.currency} {parseFloat(form.subtotal).toFixed(2)}</span>
                            )}
                            {parseFloat(form.tax) > 0 && (
                              <span>Impuesto: {form.currency} {parseFloat(form.tax).toFixed(2)}</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Receipt image preview */}
                      {imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={imageUrl} alt="Recibo" className="w-full max-h-40 object-contain rounded-lg bg-muted" />
                      ) : scanCount > 0 ? (
                        <div className="w-full h-14 rounded-lg bg-muted flex items-center justify-center gap-2 text-muted-foreground text-sm">
                          <FileText className="h-5 w-5" />
                          PDF cargado
                        </div>
                      ) : null}

                      {/* Tags */}
                      <div className="space-y-1.5">
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

                      {/* Recurring toggle */}
                      <div className="rounded-lg border overflow-hidden">
                        <button
                          type="button"
                          onClick={() => toggleSection("recurring3")}
                          className="w-full flex items-center justify-between py-2 px-3 text-xs font-mono uppercase tracking-widest text-muted-foreground bg-muted/30 hover:bg-muted/50 transition-colors"
                        >
                          <span>⚙️ Opciones avanzadas</span>
                          {openSections.has("recurring3") ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </button>
                        {openSections.has("recurring3") && (
                          <div className="border-t p-3 space-y-3">
                            {/* Privacy */}
                            <div className="space-y-1.5">
                              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                                <Globe className="h-3 w-3" /> Privacidad
                              </Label>
                              <Select
                                value={form.privacy}
                                onValueChange={(v) => setForm({ ...form, privacy: v as "private" | "public" })}
                              >
                                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="private">🔒 Privado (solo tú)</SelectItem>
                                  <SelectItem value="public">🌐 Público (círculo de confianza)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={form.isRecurring}
                                onChange={(e) => setForm({ ...form, isRecurring: e.target.checked })}
                                className="rounded"
                              />
                              <span className="text-sm font-medium">Marcar como gasto recurrente</span>
                            </label>
                            {form.isRecurring && (
                              <Select
                                value={form.recurringFrequency}
                                onValueChange={(v) => setForm({ ...form, recurringFrequency: v as RecurringFrequency })}
                              >
                                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {(Object.entries(RECURRING_LABELS) as [RecurringFrequency, string][]).map(([v, l]) => (
                                    <SelectItem key={v} value={v}>{l}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                            {/* Items split (if applicable) */}
                            {allItems.length > 1 && (
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
                            )}
                          </div>
                        )}
                      </div>

                      {/* Save as template */}
                      <div className="flex gap-2">
                        {activeTemplateId ? (
                          <Button variant="outline" size="sm" className="gap-1.5 text-primary border-primary/40 flex-1" disabled>
                            <BookmarkCheck className="h-3.5 w-3.5" />
                            Plantilla activa
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm" className="gap-1.5 flex-1"
                            onClick={() => { setTemplateName(form.merchant); setTemplateDialog(true) }}>
                            <Bookmark className="h-3.5 w-3.5" />
                            Guardar plantilla
                          </Button>
                        )}
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
                </div>
              </div>

              {/* ── Navigation: Back / Next / Save ── */}
              <div className="flex items-center gap-2 pt-1">
                {/* Left side: Back or rescan options */}
                {confirmStep === 1 ? (
                  <div className="flex gap-1.5">
                    <Button variant="outline" size="sm" className="gap-1 h-9 px-2.5"
                      onClick={() => { setStep("upload"); setConfirmStep(1); setPrevConfirmStep(1) }}>
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span className="hidden xs:inline">Reintentar</span>
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1 h-9 px-2.5"
                      onClick={() => galleryInputRef.current?.click()}>
                      <ImageIcon className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1 h-9 px-2.5"
                      onClick={() => setStep("camera")}>
                      <ScanLine className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" className="gap-1.5 h-9"
                    onClick={() => goToConfirmStep((confirmStep - 1) as 1 | 2 | 3)}>
                    <ChevronLeft className="h-4 w-4" />
                    Atrás
                  </Button>
                )}

                <div className="flex-1" />

                {/* Right side: Next or Save */}
                {confirmStep < 3 ? (
                  <Button
                    size="sm"
                    className="gap-1.5 h-9 px-4"
                    onClick={() => goToConfirmStep((confirmStep + 1) as 2 | 3)}
                  >
                    Siguiente
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button className="gap-1.5 h-9 px-5" onClick={handleConfirm} disabled={isSaving}>
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Guardar gasto
                  </Button>
                )}
              </div>
            </div>
          )
        })()}
      </DialogContent>
    </Dialog>

    {/* ── Duplicate confirmation dialog ─────────────────────────────── */}
    {dupDialog && dupInfo && (
      <Dialog open={dupDialog} onOpenChange={(o) => { if (!o) { setDupDialog(false); setPendingExpense(null) } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Posible duplicado</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <p className="text-sm text-muted-foreground">
              Ya registraste <span className="font-semibold text-foreground">{formatCurrency(dupInfo.total)}</span> en{" "}
              <span className="font-semibold text-foreground">{dupInfo.merchant}</span> esta semana.
              ¿Es un gasto distinto?
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => { setDupDialog(false); setPendingExpense(null) }}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1"
                onClick={async () => {
                  setDupDialog(false)
                  if (pendingExpense) {
                    try { await saveExpense(pendingExpense) }
                    catch { toast.error("Error al guardar el gasto") }
                    setPendingExpense(null)
                  }
                }}
              >
                Guardar igualmente
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )}
    </>
  )
}
