"use client"

import { useState, useRef, useCallback } from "react"
import { useAddExpense } from "@/hooks/use-expenses"
import { useCategories } from "@/hooks/use-categories"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Upload, Loader2, FileText, Check, X, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { CURRENCIES } from "@/lib/constants"

// ─── CSV Parser ────────────────────────────────────────────────────────────────

function detectDelimiter(line: string): string {
  const counts = { ",": 0, ";": 0, "\t": 0, "|": 0 }
  for (const ch of line) {
    if (ch in counts) counts[ch as keyof typeof counts]++
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
}

function parseCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === delimiter && !inQuotes) {
      result.push(current.trim())
      current = ""
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}

function parseAmount(raw: string): number | null {
  if (!raw) return null
  // Remove currency symbols, spaces
  let cleaned = raw.replace(/[^0-9.,\-]/g, "").trim()
  if (!cleaned) return null

  // European format: 1.234,56 → 1234.56
  if (/^\d{1,3}(\.\d{3})*(,\d+)?$/.test(cleaned)) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".")
  }
  // US format with commas: 1,234.56 → 1234.56
  else if (/^\d{1,3}(,\d{3})*(\.\d+)?$/.test(cleaned)) {
    cleaned = cleaned.replace(/,/g, "")
  }
  // Simple comma as decimal: 123,45 → 123.45
  else if (/^\d+,\d{1,2}$/.test(cleaned)) {
    cleaned = cleaned.replace(",", ".")
  }

  const num = parseFloat(cleaned)
  return isNaN(num) ? null : Math.abs(num)
}

function parseDate(raw: string): Date | null {
  if (!raw) return null
  const cleaned = raw.trim()

  const formats = [
    // ISO: 2024-01-15
    /^(\d{4})-(\d{1,2})-(\d{1,2})/,
    // DD/MM/YYYY or DD-MM-YYYY
    /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/,
    // MM/DD/YYYY
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})/,
    // DD/MM/YY
    /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/,
  ]

  // Try ISO first
  let m = cleaned.match(formats[0])
  if (m) {
    const d = new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]))
    if (!isNaN(d.getTime())) return d
  }

  // Try DD/MM/YYYY
  m = cleaned.match(formats[1])
  if (m) {
    const day = parseInt(m[1]), month = parseInt(m[2]), year = parseInt(m[3])
    if (month <= 12) {
      const d = new Date(year, month - 1, day)
      if (!isNaN(d.getTime())) return d
    }
  }

  // Native parse as fallback
  const native = new Date(cleaned)
  if (!isNaN(native.getTime())) return native

  return null
}

// ─── Types ─────────────────────────────────────────────────────────────────────

type ColumnRole = "date" | "merchant" | "amount" | "debit" | "credit" | "category" | "notes" | "ignore"

interface ParsedRow {
  date: Date | null
  merchant: string
  amount: number | null
  notes: string
  valid: boolean
}

interface CsvImportProps {
  open: boolean
  onClose: () => void
}

const ROLE_LABELS: Record<ColumnRole, string> = {
  date: "📅 Fecha",
  merchant: "🏪 Comercio",
  amount: "💵 Monto",
  debit: "💸 Débito",
  credit: "✅ Crédito",
  category: "🏷 Categoría",
  notes: "📝 Notas",
  ignore: "— Ignorar",
}

// ─── Auto-detect column roles ──────────────────────────────────────────────────

function guessRole(header: string, sampleValues: string[]): ColumnRole {
  const h = header.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  if (/fecha|date|dia|when|time/.test(h)) return "date"
  if (/comercio|merchant|descripcion|description|concepto|detalle|payee|beneficiario/.test(h)) return "merchant"
  if (/debito|debit|cargo|salida/.test(h)) return "debit"
  if (/credito|credit|abono|entrada/.test(h)) return "credit"
  if (/monto|amount|importe|total|valor|price/.test(h)) return "amount"
  if (/categoria|category/.test(h)) return "category"
  if (/nota|note|referencia|ref|comentario/.test(h)) return "notes"

  // Guess by values
  const nonEmpty = sampleValues.filter(Boolean)
  if (nonEmpty.every((v) => parseDate(v) !== null)) return "date"
  if (nonEmpty.every((v) => parseAmount(v) !== null)) return "amount"
  return "ignore"
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function CsvImport({ open, onClose }: CsvImportProps) {
  const addExpense = useAddExpense()
  const { data: categories = [] } = useCategories()

  const [dragOver, setDragOver] = useState(false)
  const [headers, setHeaders] = useState<string[]>([])
  const [rawRows, setRawRows] = useState<string[][]>([])
  const [roles, setRoles] = useState<ColumnRole[]>([])
  const [defaultCurrency, setDefaultCurrency] = useState("USD")
  const [defaultCategory, setDefaultCategory] = useState("otros")
  const [importing, setImporting] = useState(false)
  const [imported, setImported] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function reset() {
    setHeaders([])
    setRawRows([])
    setRoles([])
    setImported(false)
  }

  function handleClose() {
    reset()
    onClose()
  }

  const processFile = useCallback((file: File) => {
    if (!file.name.match(/\.(csv|txt|tsv)$/i) && file.type !== "text/csv") {
      toast.error("Selecciona un archivo CSV")
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const lines = text.split(/\r?\n/).filter((l) => l.trim())
      if (lines.length < 2) { toast.error("El archivo está vacío o tiene solo una fila"); return }

      const delimiter = detectDelimiter(lines[0])
      const parsedHeaders = parseCSVLine(lines[0], delimiter)
      const parsedRows = lines.slice(1).map((l) => parseCSVLine(l, delimiter))

      const detectedRoles: ColumnRole[] = parsedHeaders.map((h, i) => {
        const samples = parsedRows.slice(0, 5).map((r) => r[i] ?? "")
        return guessRole(h, samples)
      })

      setHeaders(parsedHeaders)
      setRawRows(parsedRows)
      setRoles(detectedRoles)
    }
    reader.readAsText(file, "UTF-8")
  }, [])

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  // Build parsed preview rows from current role mapping
  const parsedRows: ParsedRow[] = rawRows.slice(0, 200).map((row) => {
    let date: Date | null = null
    let merchant = ""
    let amount: number | null = null
    let notes = ""

    roles.forEach((role, i) => {
      const val = row[i] ?? ""
      if (role === "date" && !date) date = parseDate(val)
      if (role === "merchant" && !merchant) merchant = val
      if (role === "amount" && amount === null) amount = parseAmount(val)
      if (role === "debit" && amount === null) amount = parseAmount(val)
      if (role === "credit" && amount === null) {
        const v = parseAmount(val)
        if (v) amount = v
      }
      if (role === "notes") notes = val
    })

    return {
      date,
      merchant: merchant || "Sin nombre",
      amount,
      notes,
      valid: date !== null && amount !== null && amount > 0,
    }
  })

  const validRows = parsedRows.filter((r) => r.valid)

  async function handleImport() {
    if (validRows.length === 0) { toast.error("No hay filas válidas para importar"); return }
    setImporting(true)

    let success = 0
    let failed = 0

    // Import in batches of 10 to avoid overwhelming Firestore
    for (let i = 0; i < validRows.length; i += 10) {
      const batch = validRows.slice(i, i + 10)
      await Promise.allSettled(
        batch.map(async (row) => {
          try {
            await addExpense.mutateAsync({
              merchant: row.merchant,
              date: row.date!,
              items: [],
              subtotal: row.amount!,
              tax: 0,
              total: row.amount!,
              paymentMethod: null,
              reference: null,
              category: defaultCategory,
              currency: defaultCurrency,
              notes: row.notes,
              tags: ["importado-csv"],
              receiptImageUrl: null,
            })
            success++
          } catch {
            failed++
          }
        })
      )
    }

    setImporting(false)
    if (success > 0) {
      toast.success(`${success} gastos importados${failed > 0 ? ` (${failed} fallaron)` : ""}`)
      setImported(true)
    } else {
      toast.error("No se pudo importar ningún gasto")
    }
  }

  const hasFile = headers.length > 0

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Importar desde CSV bancario
          </DialogTitle>
        </DialogHeader>

        {imported ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="h-14 w-14 rounded-full bg-green-500/10 flex items-center justify-center">
              <Check className="h-7 w-7 text-green-600" />
            </div>
            <div className="text-center">
              <p className="font-semibold">{validRows.length} gastos importados</p>
              <p className="text-sm text-muted-foreground mt-1">Se añadió la etiqueta "importado-csv" a todos</p>
            </div>
            <Button onClick={handleClose}>Cerrar</Button>
          </div>
        ) : !hasFile ? (
          // ── Upload zone ──
          <div className="space-y-4">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors",
                dragOver ? "border-foreground bg-accent" : "border-border hover:border-foreground/40 hover:bg-accent/50"
              )}
            >
              <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
              <p className="font-medium text-sm">Arrastra tu CSV o haz clic</p>
              <p className="text-xs text-muted-foreground mt-1">Exporta el extracto de tu banco como CSV y súbelo aquí</p>
            </div>
            <input ref={fileRef} type="file" accept=".csv,.txt,.tsv" onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f) }} className="hidden" />

            <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Bancos compatibles:</p>
              <p>✓ Bancos de Venezuela, Latinoamérica, EE.UU. y Europa</p>
              <p>✓ Detecta automáticamente: fecha, comercio, monto</p>
              <p>✓ Formatos: coma, punto y coma, tabulación</p>
            </div>
          </div>
        ) : (
          // ── Column mapping + preview ──
          <div className="flex flex-col gap-4 overflow-hidden">
            {/* Column roles */}
            <div>
              <p className="text-xs font-medium mb-2 text-muted-foreground">Asigna cada columna ({headers.length} detectadas)</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {headers.map((h, i) => (
                  <div key={i} className="space-y-1">
                    <p className="text-[11px] font-mono text-muted-foreground truncate" title={h}>{h}</p>
                    <Select value={roles[i]} onValueChange={(v) => {
                      const next = [...roles]
                      next[i] = v as ColumnRole
                      setRoles(next)
                    }}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.entries(ROLE_LABELS) as [ColumnRole, string][]).map(([v, l]) => (
                          <SelectItem key={v} value={v} className="text-xs">{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>

            {/* Defaults */}
            <div className="flex gap-3">
              <div className="flex-1 space-y-1">
                <p className="text-xs text-muted-foreground">Moneda por defecto</p>
                <Select value={defaultCurrency} onValueChange={setDefaultCurrency}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-xs text-muted-foreground">Categoría por defecto</p>
                <Select value={defaultCategory} onValueChange={setDefaultCategory}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => <SelectItem key={c.id} value={c.id} className="text-xs">{c.icon} {c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Preview table */}
            <div className="overflow-auto rounded-lg border flex-1 min-h-0" style={{ maxHeight: "28vh" }}>
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted">
                  <tr>
                    <th className="text-left px-3 py-2 font-mono text-[10px] text-muted-foreground">Estado</th>
                    <th className="text-left px-3 py-2 font-mono text-[10px] text-muted-foreground">Fecha</th>
                    <th className="text-left px-3 py-2 font-mono text-[10px] text-muted-foreground">Comercio</th>
                    <th className="text-right px-3 py-2 font-mono text-[10px] text-muted-foreground">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.slice(0, 50).map((row, i) => (
                    <tr key={i} className={cn("border-t", !row.valid && "opacity-40")}>
                      <td className="px-3 py-1.5">
                        {row.valid
                          ? <Check className="h-3 w-3 text-green-600" />
                          : <X className="h-3 w-3 text-destructive" />}
                      </td>
                      <td className="px-3 py-1.5 text-muted-foreground">
                        {row.date ? row.date.toLocaleDateString("es") : "—"}
                      </td>
                      <td className="px-3 py-1.5 truncate max-w-[140px]">{row.merchant}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums font-medium">
                        {row.amount != null ? `${defaultCurrency} ${row.amount.toFixed(2)}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary + actions */}
            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{validRows.length} válidos</Badge>
                {parsedRows.length - validRows.length > 0 && (
                  <Badge variant="outline" className="text-muted-foreground">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {parsedRows.length - validRows.length} ignorados
                  </Badge>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={reset}>Cambiar archivo</Button>
                <Button size="sm" onClick={handleImport} disabled={importing || validRows.length === 0}>
                  {importing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Importar {validRows.length} gastos
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
