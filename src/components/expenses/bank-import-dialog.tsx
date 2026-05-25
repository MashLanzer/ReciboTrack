"use client"

import { useState, useRef, useCallback } from "react"
import { useBankImport } from "@/hooks/use-bank-import"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { CollapsibleContent, CollapsibleChevron } from "@/components/ui/collapsible"
import { toast } from "sonner"
import { Building2, Upload, Loader2, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface BankImportDialogProps {
  open: boolean
  onClose: () => void
}

const BANK_FORMATS = [
  {
    value: "generic",
    label: "Genérico",
    columns: "Date, Description, Amount",
    hint: "Columnas: Date, Description, Amount (positivo=ingreso, negativo=gasto)",
  },
  {
    value: "bbva",
    label: "BBVA",
    columns: "Fecha, Concepto, Importe",
    hint: "Columnas: Fecha, Concepto, Importe",
  },
  {
    value: "santander",
    label: "Santander",
    columns: "Fecha, Descripcion, Cargo, Abono",
    hint: "Columnas: Fecha, Descripcion, Cargo, Abono",
  },
  {
    value: "banamex",
    label: "Banamex",
    columns: "Fecha, Descripcion, Retiros, Depositos",
    hint: "Columnas: Fecha, Descripcion, Retiros, Depositos",
  },
]

const CURRENCIES = ["MXN", "USD", "EUR", "ARS", "COP"]

function parseCSVPreview(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length === 0) return { headers: [], rows: [] }

  function parseLine(line: string): string[] {
    const result: string[] = []
    let current = ""
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
        else inQuotes = !inQuotes
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

  const headers = parseLine(lines[0])
  const rows = lines.slice(1, 4).map(parseLine)
  return { headers, rows }
}

export function BankImportDialog({ open, onClose }: BankImportDialogProps) {
  const { importFile, importing } = useBankImport()

  const [dragOver, setDragOver] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [bankFormat, setBankFormat] = useState("generic")
  const [currency, setCurrency] = useState("MXN")
  const [preview, setPreview] = useState<{ headers: string[]; rows: string[][] } | null>(null)
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null)
  const [hintOpen, setHintOpen] = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)

  function reset() {
    setFile(null)
    setPreview(null)
    setResult(null)
    setHintOpen(false)
    if (fileRef.current) fileRef.current.value = ""
  }

  function handleClose() {
    reset()
    onClose()
  }

  const processFile = useCallback((f: File) => {
    if (!f.name.match(/\.csv$/i)) {
      toast.error("Selecciona un archivo CSV")
      return
    }
    setFile(f)
    setResult(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      setPreview(parseCSVPreview(text))
    }
    reader.readAsText(f, "UTF-8")
  }, [])

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) processFile(f)
  }

  async function handleImport() {
    if (!file) return
    try {
      const data = await importFile(file, bankFormat, currency)
      setResult(data)
      if (data.imported > 0) {
        toast.success(`Se importaron ${data.imported} gastos`)
      } else {
        toast.error("No se importó ningún gasto")
      }
    } catch {
      toast.error("Error al importar el archivo")
    }
  }

  const selectedFormat = BANK_FORMATS.find((f) => f.value === bankFormat) ?? BANK_FORMATS[0]

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Importar extracto bancario
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors",
              dragOver
                ? "border-foreground bg-accent"
                : file
                ? "border-primary/50 bg-primary/5"
                : "border-border hover:border-foreground/40 hover:bg-accent/50"
            )}
          >
            <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
            {file ? (
              <p className="text-sm font-medium">{file.name}</p>
            ) : (
              <>
                <p className="text-sm font-medium">Arrastra tu CSV o haz clic</p>
                <p className="text-xs text-muted-foreground mt-1">Exporta el extracto de tu banco como CSV</p>
              </>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f) }}
          />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Formato de banco</Label>
              <Select value={bankFormat} onValueChange={setBankFormat}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BANK_FORMATS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Moneda</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <button
              type="button"
              onClick={() => setHintOpen((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <CollapsibleChevron open={hintOpen} className="h-3.5 w-3.5" />
              Ver ejemplo de formato — {selectedFormat.label}
            </button>
            <CollapsibleContent open={hintOpen} className="pt-2">
              <div className="rounded-lg bg-muted/50 border px-3 py-2 text-xs text-muted-foreground font-mono">
                {selectedFormat.hint}
                <div className="mt-1 text-[10px] opacity-70">
                  {selectedFormat.columns}
                </div>
              </div>
            </CollapsibleContent>
          </div>

          {preview && preview.headers.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Vista previa (primeras 3 filas)</p>
              <div className="overflow-auto rounded-lg border">
                <table className="w-full text-xs">
                  <thead className="bg-muted">
                    <tr>
                      {preview.headers.map((h, i) => (
                        <th key={i} className="text-left px-2 py-1.5 font-mono text-[10px] text-muted-foreground whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row, i) => (
                      <tr key={i} className="border-t">
                        {row.map((cell, j) => (
                          <td key={j} className="px-2 py-1.5 max-w-[120px] truncate text-muted-foreground">{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {result && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary">{result.imported} importados</Badge>
                {result.skipped > 0 && (
                  <Badge variant="outline" className="text-muted-foreground">{result.skipped} omitidos</Badge>
                )}
              </div>
              {result.errors.length > 0 && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-destructive">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    {result.errors.length} errores
                  </div>
                  <ul className="text-xs text-destructive/80 space-y-0.5 max-h-24 overflow-auto">
                    {result.errors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            {file && (
              <Button variant="outline" size="sm" onClick={reset}>
                Cambiar archivo
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleImport}
              disabled={!file || importing}
            >
              {importing && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Importar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
