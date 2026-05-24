"use client"

import { useState, useRef, useCallback, useMemo } from "react"
import { useAddExpense } from "@/hooks/use-expenses"
import { useCategories } from "@/hooks/use-categories"
import { useCategoryRules, applyRules } from "@/hooks/use-category-rules"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Upload, Loader2, FileText, Check, X, AlertCircle, Sparkles } from "lucide-react"
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
  let cleaned = raw.replace(/[^0-9.,\-]/g, "").trim()
  if (!cleaned) return null

  if (/^\d{1,3}(\.\d{3})*(,\d+)?$/.test(cleaned)) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".")
  } else if (/^\d{1,3}(,\d{3})*(\.\d+)?$/.test(cleaned)) {
    cleaned = cleaned.replace(/,/g, "")
  } else if (/^\d+,\d{1,2}$/.test(cleaned)) {
    cleaned = cleaned.replace(",", ".")
  }

  const num = parseFloat(cleaned)
  return isNaN(num) ? null : Math.abs(num)
}

function parseDate(raw: string): Date | null {
  if (!raw) return null
  const cleaned = raw.trim()

  const formats = [
    /^(\d{4})-(\d{1,2})-(\d{1,2})/,
    /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/,
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})/,
    /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/,
  ]

  let m = cleaned.match(formats[0])
  if (m) {
    const d = new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]))
    if (!isNaN(d.getTime())) return d
  }

  m = cleaned.match(formats[1])
  if (m) {
    const day = parseInt(m[1]), month = parseInt(m[2]), year = parseInt(m[3])
    if (month <= 12) {
      const d = new Date(year, month - 1, day)
      if (!isNaN(d.getTime())) return d
    }
  }

  const native = new Date(cleaned)
  if (!isNaN(native.getTime())) return native

  return null
}

// ─── Bank profiles ─────────────────────────────────────────────────────────────

type ColumnRole = "date" | "merchant" | "amount" | "debit" | "credit" | "category" | "notes" | "ignore"

interface BankProfile {
  name: string
  flag: string
  /** Maps each expected column header pattern (lowercase) to a role */
  columns: { pattern: RegExp; role: ColumnRole }[]
  /** Default currency for this bank */
  defaultCurrency?: string
  /** Tags to add on import */
  tags?: string[]
}

const BANK_PROFILES: BankProfile[] = [
  {
    name: "BBVA",
    flag: "🏦",
    defaultCurrency: "EUR",
    columns: [
      { pattern: /fecha.*operac|f\.operac/i, role: "date" },
      { pattern: /fecha.*valor|f\.valor/i, role: "ignore" },
      { pattern: /concepto|descripci/i, role: "merchant" },
      { pattern: /movimiento|importe/i, role: "amount" },
      { pattern: /disponible|saldo/i, role: "ignore" },
    ],
  },
  {
    name: "Santander",
    flag: "🏦",
    defaultCurrency: "EUR",
    columns: [
      { pattern: /fecha/i, role: "date" },
      { pattern: /concepto|comercio/i, role: "merchant" },
      { pattern: /cargo|débito|importe negativo/i, role: "debit" },
      { pattern: /abono|crédito|importe positivo/i, role: "credit" },
      { pattern: /saldo/i, role: "ignore" },
    ],
  },
  {
    name: "N26",
    flag: "🇩🇪",
    defaultCurrency: "EUR",
    columns: [
      { pattern: /date/i, role: "date" },
      { pattern: /payee|merchant name/i, role: "merchant" },
      { pattern: /account number/i, role: "ignore" },
      { pattern: /transaction type/i, role: "notes" },
      { pattern: /payment reference/i, role: "notes" },
      { pattern: /amount.*eur|amount/i, role: "amount" },
      { pattern: /amount.*foreign/i, role: "ignore" },
      { pattern: /exchange rate/i, role: "ignore" },
    ],
  },
  {
    name: "Revolut",
    flag: "🟣",
    defaultCurrency: "USD",
    columns: [
      { pattern: /^date$/i, role: "ignore" },
      { pattern: /completed date|started date/i, role: "date" },
      { pattern: /description/i, role: "merchant" },
      { pattern: /paid out|money out/i, role: "debit" },
      { pattern: /paid in|money in/i, role: "credit" },
      { pattern: /amount/i, role: "amount" },
      { pattern: /currency/i, role: "ignore" },
      { pattern: /balance/i, role: "ignore" },
      { pattern: /category/i, role: "category" },
      { pattern: /type/i, role: "notes" },
    ],
  },
  {
    name: "Wise",
    flag: "🌐",
    defaultCurrency: "USD",
    columns: [
      { pattern: /transfer.*id|id/i, role: "ignore" },
      { pattern: /date/i, role: "date" },
      { pattern: /merchant|payee|description/i, role: "merchant" },
      { pattern: /amount/i, role: "amount" },
      { pattern: /currency/i, role: "ignore" },
      { pattern: /exchange rate/i, role: "ignore" },
      { pattern: /reference/i, role: "notes" },
      { pattern: /batch/i, role: "ignore" },
    ],
  },
]

interface MatchedProfile {
  profile: BankProfile
  score: number
}

function detectBankProfile(headers: string[]): BankProfile | null {
  const results: MatchedProfile[] = BANK_PROFILES.map((profile) => {
    let score = 0
    for (const header of headers) {
      for (const col of profile.columns) {
        if (col.pattern.test(header)) { score++; break }
      }
    }
    return { profile, score }
  })

  const best = results.sort((a, b) => b.score - a.score)[0]
  // Require at least 2 matching columns
  return best.score >= 2 ? best.profile : null
}

function applyBankProfile(headers: string[], profile: BankProfile): ColumnRole[] {
  return headers.map((header) => {
    for (const col of profile.columns) {
      if (col.pattern.test(header)) return col.role
    }
    return guessRole(header, [])
  })
}

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ParsedRow {
  date: Date | null
  merchant: string
  amount: number | null
  notes: string
  category: string | null   // auto-categorized via rules
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

  const nonEmpty = sampleValues.filter(Boolean)
  if (nonEmpty.every((v) => parseDate(v) !== null)) return "date"
  if (nonEmpty.every((v) => parseAmount(v) !== null)) return "amount"
  return "ignore"
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function CsvImport({ open, onClose }: CsvImportProps) {
  const addExpense = useAddExpense()
  const { data: categories = [] } = useCategories()
  const { data: rules = [] } = useCategoryRules()

  const [dragOver, setDragOver] = useState(false)
  const [headers, setHeaders] = useState<string[]>([])
  const [rawRows, setRawRows] = useState<string[][]>([])
  const [roles, setRoles] = useState<ColumnRole[]>([])
  const [detectedBank, setDetectedBank] = useState<BankProfile | null>(null)
  const [defaultCurrency, setDefaultCurrency] = useState("USD")
  const [defaultCategory, setDefaultCategory] = useState("otros")
  const [importing, setImporting] = useState(false)
  const [imported, setImported] = useState(false)
  const [importedCount, setImportedCount] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)

  function reset() {
    setHeaders([])
    setRawRows([])
    setRoles([])
    setDetectedBank(null)
    setImported(false)
    setImportedCount(0)
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

      // Try bank profile detection first
      const bankProfile = detectBankProfile(parsedHeaders)

      let detectedRoles: ColumnRole[]
      if (bankProfile) {
        detectedRoles = applyBankProfile(parsedHeaders, bankProfile)
        setDetectedBank(bankProfile)
        if (bankProfile.defaultCurrency) setDefaultCurrency(bankProfile.defaultCurrency)
      } else {
        detectedRoles = parsedHeaders.map((h, i) => {
          const samples = parsedRows.slice(0, 5).map((r) => r[i] ?? "")
          return guessRole(h, samples)
        })
        setDetectedBank(null)
      }

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

  // Build parsed preview rows from current role mapping + auto-categorize
  const parsedRows: ParsedRow[] = useMemo(() => {
    return rawRows.slice(0, 200).map((row) => {
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

      const autoCategory = rules.length > 0
        ? applyRules(rules, { merchant, amount: amount ?? 0, notes })
        : null

      return {
        date,
        merchant: merchant || "Sin nombre",
        amount,
        notes,
        category: autoCategory,
        valid: date !== null && amount !== null && amount > 0,
      }
    })
  }, [rawRows, roles, rules])

  const validRows = parsedRows.filter((r) => r.valid)
  const autoCatCount = validRows.filter((r) => r.category !== null).length

  async function handleImport() {
    if (validRows.length === 0) { toast.error("No hay filas válidas para importar"); return }
    setImporting(true)

    let success = 0
    let failed = 0
    const importTags = ["importado-csv", ...(detectedBank ? [`banco-${detectedBank.name.toLowerCase()}`] : [])]

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
              category: row.category ?? defaultCategory,
              currency: defaultCurrency,
              notes: row.notes,
              tags: importTags,
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
      setImportedCount(success)
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
              <p className="font-semibold">{importedCount} gastos importados</p>
              {autoCatCount > 0 && (
                <p className="text-sm text-muted-foreground mt-1">
                  <Sparkles className="h-3 w-3 inline mr-1" />
                  {autoCatCount} categorizados automáticamente
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">Etiqueta "importado-csv" añadida a todos</p>
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

            <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1.5">
              <p className="font-medium text-foreground">Detección automática de bancos:</p>
              <div className="flex flex-wrap gap-1.5">
                {BANK_PROFILES.map(b => (
                  <span key={b.name} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border bg-background text-xs">
                    {b.flag} {b.name}
                  </span>
                ))}
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border bg-background text-xs">
                  + cualquier banco
                </span>
              </div>
              <p>Formatos: coma · punto y coma · tabulación · pipe</p>
            </div>
          </div>
        ) : (
          // ── Column mapping + preview ──
          <div className="flex flex-col gap-4 overflow-hidden">
            {/* Bank detected banner */}
            {detectedBank && (
              <div className="flex items-center gap-2 rounded-lg bg-primary/10 border border-primary/20 px-3 py-2">
                <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                <p className="text-xs font-medium text-primary">
                  Formato {detectedBank.flag} {detectedBank.name} detectado — columnas asignadas automáticamente
                </p>
              </div>
            )}

            {/* Auto-cat info */}
            {rules.length > 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-muted/50 border px-3 py-2">
                <Sparkles className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <p className="text-xs text-muted-foreground">
                  Reglas de categorización activas — {autoCatCount}/{validRows.length} gastos se categorizarán automáticamente
                </p>
              </div>
            )}

            {/* Column roles */}
            <div>
              <p className="text-xs font-medium mb-2 text-muted-foreground">Asigna cada columna ({headers.length} detectadas)</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {headers.map((h, i) => (
                  <div key={i} className="space-y-1">
                    <p className="text-xs font-mono text-muted-foreground truncate" title={h}>{h}</p>
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
                    <th className="text-left px-3 py-2 font-mono text-[10px] text-muted-foreground">Ok</th>
                    <th className="text-left px-3 py-2 font-mono text-[10px] text-muted-foreground">Fecha</th>
                    <th className="text-left px-3 py-2 font-mono text-[10px] text-muted-foreground">Comercio</th>
                    <th className="text-left px-3 py-2 font-mono text-[10px] text-muted-foreground">Categoría</th>
                    <th className="text-right px-3 py-2 font-mono text-[10px] text-muted-foreground">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.slice(0, 50).map((row, i) => {
                    const cat = categories.find(c => c.id === (row.category ?? defaultCategory))
                    return (
                      <tr key={i} className={cn("border-t", !row.valid && "opacity-40")}>
                        <td className="px-3 py-1.5">
                          {row.valid
                            ? <Check className="h-3 w-3 text-green-600" />
                            : <X className="h-3 w-3 text-destructive" />}
                        </td>
                        <td className="px-3 py-1.5 text-muted-foreground whitespace-nowrap">
                          {row.date ? row.date.toLocaleDateString("es") : "—"}
                        </td>
                        <td className="px-3 py-1.5 truncate max-w-[120px]">{row.merchant}</td>
                        <td className="px-3 py-1.5">
                          <span className={cn(
                            "inline-flex items-center gap-0.5 text-[10px]",
                            row.category ? "text-primary font-medium" : "text-muted-foreground"
                          )}>
                            {cat ? `${cat.icon} ${cat.name}` : "—"}
                            {row.category && <Sparkles className="h-2.5 w-2.5" />}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums font-medium whitespace-nowrap">
                          {row.amount != null ? `${defaultCurrency} ${row.amount.toFixed(2)}` : "—"}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Summary + actions */}
            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary">{validRows.length} válidos</Badge>
                {parsedRows.length - validRows.length > 0 && (
                  <Badge variant="outline" className="text-muted-foreground">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {parsedRows.length - validRows.length} ignorados
                  </Badge>
                )}
                {autoCatCount > 0 && (
                  <Badge variant="outline" className="text-primary border-primary/30">
                    <Sparkles className="h-2.5 w-2.5 mr-1" />
                    {autoCatCount} auto-cat
                  </Badge>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={reset}>Cambiar archivo</Button>
                <Button size="sm" onClick={handleImport} disabled={importing || validRows.length === 0}>
                  {importing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Importar {validRows.length}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
