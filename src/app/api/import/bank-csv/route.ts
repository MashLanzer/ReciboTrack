import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
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

function parseDate(raw: string): string | null {
  const cleaned = raw.trim()
  if (!cleaned) return null

  const ddmmyyyy = cleaned.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (ddmmyyyy) {
    const day = ddmmyyyy[1].padStart(2, "0")
    const month = ddmmyyyy[2].padStart(2, "0")
    const year = ddmmyyyy[3]
    const d = new Date(`${year}-${month}-${day}`)
    if (!isNaN(d.getTime())) return `${year}-${month}-${day}`
  }

  const yyyymmdd = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (yyyymmdd) {
    const year = yyyymmdd[1]
    const month = yyyymmdd[2].padStart(2, "0")
    const day = yyyymmdd[3].padStart(2, "0")
    const d = new Date(`${year}-${month}-${day}`)
    if (!isNaN(d.getTime())) return `${year}-${month}-${day}`
  }

  const mmddyyyy = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (mmddyyyy) {
    const month = mmddyyyy[1].padStart(2, "0")
    const day = mmddyyyy[2].padStart(2, "0")
    const year = mmddyyyy[3]
    const d = new Date(`${year}-${month}-${day}`)
    if (!isNaN(d.getTime())) return `${year}-${month}-${day}`
  }

  const native = new Date(cleaned)
  if (!isNaN(native.getTime())) {
    return native.toISOString().split("T")[0]
  }

  return null
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
  return isNaN(num) ? null : num
}

interface RowResult {
  date: string | null
  merchant: string
  total: number | null
}

function parseGeneric(headers: string[], row: string[]): RowResult {
  const idx = (names: string[]) => {
    for (const name of names) {
      const i = headers.findIndex(h => h.toLowerCase().trim() === name.toLowerCase())
      if (i !== -1) return i
    }
    return -1
  }

  const dateIdx = idx(["date", "fecha"])
  const descIdx = idx(["description", "descripcion", "merchant", "concepto"])
  const amountIdx = idx(["amount", "importe", "monto"])

  const dateRaw = dateIdx >= 0 ? row[dateIdx] ?? "" : ""
  const merchant = descIdx >= 0 ? row[descIdx] ?? "" : ""
  const amountRaw = amountIdx >= 0 ? row[amountIdx] ?? "" : ""

  const amount = parseAmount(amountRaw)
  return {
    date: parseDate(dateRaw),
    merchant: merchant.trim(),
    total: amount !== null ? Math.abs(amount) : null,
  }
}

function parseBBVA(headers: string[], row: string[]): RowResult {
  const idx = (names: string[]) => {
    for (const name of names) {
      const i = headers.findIndex(h => h.toLowerCase().includes(name.toLowerCase()))
      if (i !== -1) return i
    }
    return -1
  }

  const dateIdx = idx(["fecha"])
  const descIdx = idx(["concepto"])
  const amountIdx = idx(["importe"])

  return {
    date: parseDate(row[dateIdx] ?? ""),
    merchant: (row[descIdx] ?? "").trim(),
    total: (() => {
      const v = parseAmount(row[amountIdx] ?? "")
      return v !== null ? Math.abs(v) : null
    })(),
  }
}

function parseSantander(headers: string[], row: string[]): RowResult {
  const idx = (names: string[]) => {
    for (const name of names) {
      const i = headers.findIndex(h => h.toLowerCase().includes(name.toLowerCase()))
      if (i !== -1) return i
    }
    return -1
  }

  const dateIdx = idx(["fecha"])
  const descIdx = idx(["descripcion", "descripción"])
  const cargoIdx = idx(["cargo"])
  const abonoIdx = idx(["abono"])

  const cargo = parseAmount(row[cargoIdx] ?? "")
  const abono = parseAmount(row[abonoIdx] ?? "")
  const total = cargo !== null && cargo > 0 ? cargo : abono !== null && abono > 0 ? abono : null

  return {
    date: parseDate(row[dateIdx] ?? ""),
    merchant: (row[descIdx] ?? "").trim(),
    total: total !== null ? Math.abs(total) : null,
  }
}

function parseBanamex(headers: string[], row: string[]): RowResult {
  const idx = (names: string[]) => {
    for (const name of names) {
      const i = headers.findIndex(h => h.toLowerCase().includes(name.toLowerCase()))
      if (i !== -1) return i
    }
    return -1
  }

  const dateIdx = idx(["fecha"])
  const descIdx = idx(["descripcion", "descripción"])
  const retirosIdx = idx(["retiros"])
  const depositosIdx = idx(["depositos", "depósitos"])

  const retiros = parseAmount(row[retirosIdx] ?? "")
  const depositos = parseAmount(row[depositosIdx] ?? "")
  const total = retiros !== null && retiros > 0 ? retiros : depositos !== null && depositos > 0 ? depositos : null

  return {
    date: parseDate(row[dateIdx] ?? ""),
    merchant: (row[descIdx] ?? "").trim(),
    total: total !== null ? Math.abs(total) : null,
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: "FormData inválido" }, { status: 400 })
  }

  const file = formData.get("file") as File | null
  const bankFormat = (formData.get("bankFormat") as string | null) ?? "generic"
  const currency = (formData.get("currency") as string | null) ?? "MXN"

  if (!file) {
    return NextResponse.json({ error: "No se proporcionó archivo" }, { status: 400 })
  }

  let text: string
  try {
    text = await file.text()
  } catch {
    return NextResponse.json({ error: "No se pudo leer el archivo" }, { status: 400 })
  }

  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) {
    return NextResponse.json({ error: "El archivo está vacío o no tiene datos" }, { status: 400 })
  }

  const headers = parseCSVLine(lines[0])
  const dataLines = lines.slice(1)

  const sb = getSupabase()
  const now = new Date().toISOString()

  let imported = 0
  let skipped = 0
  const errors: string[] = []

  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i]
    if (!line.trim()) { skipped++; continue }

    const row = parseCSVLine(line)

    let parsed: RowResult
    try {
      if (bankFormat === "bbva") {
        parsed = parseBBVA(headers, row)
      } else if (bankFormat === "santander") {
        parsed = parseSantander(headers, row)
      } else if (bankFormat === "banamex") {
        parsed = parseBanamex(headers, row)
      } else {
        parsed = parseGeneric(headers, row)
      }
    } catch (err) {
      errors.push(`Fila ${i + 2}: error al analizar — ${String(err)}`)
      skipped++
      continue
    }

    if (!parsed.date) {
      errors.push(`Fila ${i + 2}: fecha inválida`)
      skipped++
      continue
    }

    if (parsed.total === null || parsed.total <= 0) {
      skipped++
      continue
    }

    if (!parsed.merchant) {
      errors.push(`Fila ${i + 2}: descripción vacía`)
      skipped++
      continue
    }

    const { error } = await sb.from("expenses").insert({
      uid,
      account: "personal",
      merchant: parsed.merchant,
      date: parsed.date,
      items: [],
      subtotal: parsed.total,
      tax: 0,
      total: parsed.total,
      payment_method: null,
      reference: null,
      category: "Importado",
      currency,
      notes: "",
      tags: ["importado-banco"],
      receipt_image_url: null,
      project: null,
      project_id: null,
      privacy: "private",
      archived: false,
      flagged: false,
      created_at: now,
      updated_at: now,
    })

    if (error) {
      errors.push(`Fila ${i + 2}: ${error.message}`)
      skipped++
    } else {
      imported++
    }
  }

  return NextResponse.json({ imported, skipped, errors })
}
