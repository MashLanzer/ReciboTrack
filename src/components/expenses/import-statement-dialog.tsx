"use client"

import { useState, useCallback, useRef } from "react"
import { useAddExpense } from "@/hooks/use-expenses"
import { CURRENCIES } from "@/lib/constants"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { Upload, CheckCircle2, ArrowRight, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"

// ─── Types ───────────────────────────────────────────────────────────────────

interface ParsedRow {
  raw: string[]
  date: Date | null
  description: string
  amount: number | null
  selected: boolean
}

type Step = "upload" | "map" | "preview" | "importing" | "done"

interface ColumnMap {
  date: number | null
  description: number | null
  amount: number | null
}

// ─── CSV parser ───────────────────────────────────────────────────────────────

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim())
      current = ""
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}

function parseCsv(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .filter(l => l.trim())
    .map(parseCsvLine)
}

// ─── Date parsers ─────────────────────────────────────────────────────────────

function parseDate(s: string): Date | null {
  s = s.trim()
  // YYYY-MM-DD
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (m) {
    const d = new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]))
    if (!isNaN(d.getTime())) return d
  }
  // DD/MM/YYYY
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) {
    // Try DD/MM/YYYY first, then MM/DD/YYYY
    const d = new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]))
    if (!isNaN(d.getTime()) && d.getMonth() === parseInt(m[2]) - 1) return d
    const d2 = new Date(parseInt(m[3]), parseInt(m[1]) - 1, parseInt(m[2]))
    if (!isNaN(d2.getTime())) return d2
  }
  // MM/DD/YYYY
  m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
  if (m) {
    const d = new Date(parseInt(m[3]), parseInt(m[1]) - 1, parseInt(m[2]))
    if (!isNaN(d.getTime())) return d
  }
  // Try native Date parse as fallback
  const d = new Date(s)
  if (!isNaN(d.getTime())) return d
  return null
}

function parseAmount(s: string): number | null {
  // Remove currency symbols, spaces
  const cleaned = s.replace(/[^0-9.,\-]/g, "").trim()
  if (!cleaned) return null
  // Handle comma as decimal: if last comma is at position -3 and there's no dot after it
  const lastComma = cleaned.lastIndexOf(",")
  const lastDot = cleaned.lastIndexOf(".")
  let normalized = cleaned
  if (lastComma > lastDot) {
    // European format: 1.234,56 -> 1234.56
    normalized = cleaned.replace(/\./g, "").replace(",", ".")
  } else {
    // Remove thousand separators (commas before dot)
    normalized = cleaned.replace(/,/g, "")
  }
  const n = parseFloat(normalized)
  return isNaN(n) ? null : n
}

// ─── Auto-detect column types ─────────────────────────────────────────────────

function autoDetect(rows: string[][], hasHeader: boolean): ColumnMap {
  const sampleRows = rows.slice(hasHeader ? 1 : 0, (hasHeader ? 1 : 0) + 5)
  if (sampleRows.length === 0 || sampleRows[0].length === 0) {
    return { date: null, description: null, amount: null }
  }
  const colCount = sampleRows[0].length
  const dateCol: number[] = []
  const amountCol: number[] = []
  const textCol: number[] = []

  for (let c = 0; c < colCount; c++) {
    let dateLike = 0
    let numLike = 0
    let textLike = 0
    for (const row of sampleRows) {
      const val = row[c] ?? ""
      if (parseDate(val)) dateLike++
      if (parseAmount(val) !== null && !parseDate(val)) numLike++
      if (isNaN(parseFloat(val.replace(/[^0-9.]/g, "")))) textLike++
    }
    if (dateLike >= sampleRows.length * 0.6) dateCol.push(c)
    else if (numLike >= sampleRows.length * 0.6) amountCol.push(c)
    else if (textLike >= sampleRows.length * 0.6) textCol.push(c)
  }

  return {
    date: dateCol[0] ?? null,
    description: textCol[0] ?? null,
    amount: amountCol[amountCol.length - 1] ?? null,
  }
}

// ─── Main dialog ──────────────────────────────────────────────────────────────

interface Props {
  open: boolean
  onClose: () => void
}

export function ImportStatementDialog({ open, onClose }: Props) {
  const addExpense = useAddExpense()

  const [step, setStep] = useState<Step>("upload")
  const [rawRows, setRawRows] = useState<string[][]>([])
  const [hasHeader, setHasHeader] = useState(true)
  const [colMap, setColMap] = useState<ColumnMap>({ date: null, description: null, amount: null })
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [currency, setCurrency] = useState("USD")
  const [importCount, setImportCount] = useState(0)
  const [importTotal, setImportTotal] = useState(0)
  const [dragging, setDragging] = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)

  function reset() {
    setStep("upload")
    setRawRows([])
    setColMap({ date: null, description: null, amount: null })
    setParsedRows([])
    setImportCount(0)
    setImportTotal(0)
    setCurrency("USD")
  }

  function handleClose() {
    reset()
    onClose()
  }

  function processFile(file: File) {
    if (!file.name.endsWith(".csv") && file.type !== "text/csv") {
      toast.error("Solo se aceptan archivos CSV")
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const rows = parseCsv(text)
      if (rows.length < 2) { toast.error("El CSV está vacío o tiene muy pocas filas"); return }
      setRawRows(rows)
      const detected = autoDetect(rows, true)
      setColMap(detected)
      setStep("map")
    }
    reader.readAsText(file, "utf-8")
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  const dataRows = hasHeader ? rawRows.slice(1) : rawRows
  const headers = hasHeader ? rawRows[0] ?? [] : rawRows[0]?.map((_, i) => `Columna ${i + 1}`) ?? []
  const sampleRows = rawRows.slice(0, hasHeader ? 4 : 3)

  function buildParsedRows() {
    return dataRows.map(row => {
      const dateStr = colMap.date !== null ? (row[colMap.date] ?? "") : ""
      const desc = colMap.description !== null ? (row[colMap.description] ?? "").trim() : ""
      const amtStr = colMap.amount !== null ? (row[colMap.amount] ?? "") : ""
      const date = parseDate(dateStr)
      const amount = parseAmount(amtStr)
      return {
        raw: row,
        date,
        description: desc.slice(0, 50),
        amount: amount !== null ? Math.abs(amount) : null,
        selected: date !== null && amount !== null && desc.length > 0,
      }
    })
  }

  function goToPreview() {
    if (colMap.date === null || colMap.description === null || colMap.amount === null) {
      toast.error("Selecciona las columnas de fecha, descripción e importe")
      return
    }
    setParsedRows(buildParsedRows())
    setStep("preview")
  }

  function toggleRow(idx: number) {
    setParsedRows(prev => prev.map((r, i) => i === idx ? { ...r, selected: !r.selected } : r))
  }

  async function handleImport() {
    const toImport = parsedRows.filter(r => r.selected && r.date && r.amount !== null)
    if (toImport.length === 0) { toast.error("No hay filas seleccionadas"); return }
    setImportTotal(toImport.length)
    setImportCount(0)
    setStep("importing")

    let imported = 0
    for (const row of toImport) {
      try {
        await addExpense.mutateAsync({
          merchant: row.description || "Importado",
          date: row.date!,
          total: row.amount!,
          subtotal: row.amount!,
          tax: 0,
          items: [],
          paymentMethod: null,
          reference: null,
          category: "otros",
          currency,
          notes: "",
          tags: [],
          receiptImageUrl: null,
        })
        imported++
        setImportCount(imported)
      } catch {
        // continue
      }
    }
    setStep("done")
    setImportCount(imported)
    setImportTotal(toImport.length)
  }

  const colOptions = [
    { value: "__none__", label: "— No usar —" },
    ...headers.map((h, i) => ({ value: String(i), label: h || `Columna ${i + 1}` })),
  ]

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) handleClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Importar extracto CSV
          </DialogTitle>
        </DialogHeader>

        {/* ── Step: upload ── */}
        {step === "upload" && (
          <div className="space-y-4">
            <div
              className={cn(
                "border-2 border-dashed rounded-2xl p-10 text-center transition-colors cursor-pointer",
                dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
              )}
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
              <p className="font-medium">Arrastra un archivo CSV aquí</p>
              <p className="text-sm text-muted-foreground mt-1">o haz clic para seleccionar</p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleFileInput}
              />
            </div>
          </div>
        )}

        {/* ── Step: map ── */}
        {step === "map" && (
          <div className="space-y-4">
            {/* Preview table */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Vista previa ({rawRows.length - (hasHeader ? 1 : 0)} filas)
              </p>
              <div className="overflow-x-auto rounded-lg border text-xs">
                <table className="w-full">
                  <tbody>
                    {sampleRows.map((row, ri) => (
                      <tr key={ri} className={cn(
                        ri === 0 && hasHeader ? "bg-muted font-medium" : "border-t"
                      )}>
                        {row.map((cell, ci) => (
                          <td key={ci} className="px-2 py-1.5 truncate max-w-[100px]">{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Currency */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1 block">Moneda de los gastos</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasHeader}
                    onChange={e => setHasHeader(e.target.checked)}
                    className="rounded"
                  />
                  Primera fila es cabecera
                </label>
              </div>
            </div>

            {/* Column mapping */}
            <div className="space-y-2">
              <p className="text-xs font-medium">Mapear columnas</p>
              {(["date", "description", "amount"] as const).map(field => (
                <div key={field} className="grid grid-cols-2 gap-2 items-center">
                  <Label className="text-xs capitalize">
                    {field === "date" ? "Fecha" : field === "description" ? "Descripción" : "Importe"}
                  </Label>
                  <Select
                    value={colMap[field] !== null ? String(colMap[field]) : "__none__"}
                    onValueChange={v => setColMap(m => ({ ...m, [field]: v === "__none__" ? null : parseInt(v) }))}
                  >
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {colOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <Button className="w-full gap-1.5" onClick={goToPreview}>
              Previsualizar <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* ── Step: preview ── */}
        {step === "preview" && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              {parsedRows.filter(r => r.selected).length} de {parsedRows.length} filas seleccionadas para importar
            </p>
            <div className="max-h-72 overflow-y-auto rounded-lg border text-xs divide-y">
              {parsedRows.map((row, i) => (
                <label
                  key={i}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors",
                    row.selected ? "bg-background hover:bg-accent/30" : "bg-muted/30 opacity-60"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={row.selected}
                    onChange={() => toggleRow(i)}
                  />
                  <span className="truncate flex-1">{row.description || <em className="text-muted-foreground">sin descripción</em>}</span>
                  <span className="text-muted-foreground shrink-0">
                    {row.date ? row.date.toLocaleDateString("es") : <span className="text-destructive">fecha inválida</span>}
                  </span>
                  <span className={cn("tabular-nums font-medium shrink-0", row.amount === null && "text-destructive")}>
                    {row.amount !== null ? row.amount.toFixed(2) : "?"}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep("map")}>Atrás</Button>
              <Button
                className="flex-1 gap-1.5"
                onClick={handleImport}
                disabled={parsedRows.filter(r => r.selected).length === 0}
              >
                Importar {parsedRows.filter(r => r.selected).length} gastos
              </Button>
            </div>
          </div>
        )}

        {/* ── Step: importing ── */}
        {step === "importing" && (
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <p className="text-sm">Importando gastos...</p>
            </div>
            <Progress value={importTotal > 0 ? (importCount / importTotal) * 100 : 0} className="h-2" />
            <p className="text-center text-xs text-muted-foreground tabular-nums">
              {importCount} de {importTotal} importados
            </p>
          </div>
        )}

        {/* ── Step: done ── */}
        {step === "done" && (
          <div className="space-y-4 py-4 text-center">
            <CheckCircle2 className="h-12 w-12 mx-auto text-green-500" />
            <div>
              <p className="font-semibold text-lg">{importCount} gastos importados</p>
              <p className="text-sm text-muted-foreground mt-1">
                Los gastos ya aparecen en tu historial
              </p>
            </div>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={handleClose}>Cerrar</Button>
              <Button asChild onClick={handleClose}>
                <Link href="/expenses">Ver gastos</Link>
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
