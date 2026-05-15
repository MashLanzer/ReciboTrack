"use client"

import { createWorker } from "tesseract.js"
import type { OcrResultInput } from "@/lib/firebase/schemas"
import type { ReceiptItem } from "@/types"

// ─── Text extraction ────────────────────────────────────────────────────────

export async function runReceiptOcr(
  image: File | Blob,
  onProgress?: (pct: number) => void
): Promise<OcrResultInput> {
  // Tesseract runs entirely in the browser — no server, no API key needed
  const worker = await createWorker(["spa", "eng"], 1, {
    logger: (m) => {
      if (m.status === "recognizing text" && onProgress) {
        onProgress(Math.round(m.progress * 100))
      }
    },
  })

  try {
    const { data } = await worker.recognize(image)
    return parseReceiptText(data.text)
  } finally {
    await worker.terminate()
  }
}

// ─── Parsing ────────────────────────────────────────────────────────────────

function parseReceiptText(raw: string): OcrResultInput {
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 1)

  const text = raw // keep full text for regex searches

  // ── Currency ──────────────────────────────────────────────────────────────
  let currency = "USD"
  if (/bs\.?f?s?\.?|bolivar/i.test(text)) currency = "VES"
  else if (/€|eur(?!\w)/i.test(text)) currency = "EUR"
  else if (/£|gbp(?!\w)/i.test(text)) currency = "GBP"
  else if (/cop(?!\w)/i.test(text)) currency = "COP"
  else if (/mxn(?!\w)|pesos?\s+mex/i.test(text)) currency = "MXN"

  // ── Amount parser (handles US and European formats) ───────────────────────
  function parseAmount(str: string): number | null {
    // Remove currency symbols and spaces
    const clean = str.replace(/[$€£BsS\/\.]{0,2}\s*/g, "").trim()
    if (!clean) return null

    // European: 1.234,56 → 1234.56
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(clean)) {
      return parseFloat(clean.replace(/\./g, "").replace(",", "."))
    }
    // Comma decimal: 1234,56
    if (/^\d+(,\d{1,2})$/.test(clean)) {
      return parseFloat(clean.replace(",", "."))
    }
    // Standard: 1,234.56 or 1234.56
    const n = parseFloat(clean.replace(/,/g, ""))
    return isNaN(n) ? null : n
  }

  // Extract first number from a line
  function extractLineAmount(line: string): number | null {
    const match = line.match(/([\d]{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?|\d+[.,]\d{1,2}|\d+)(?:\s*$|\s+[A-Z]{0,3}$)/)
    if (!match) return null
    return parseAmount(match[1])
  }

  // ── Total / Subtotal / Tax ─────────────────────────────────────────────────
  let total: number | null = null
  let subtotal: number | null = null
  let tax: number | null = null

  for (const line of lines) {
    const lo = line.toLowerCase()
    const amt = extractLineAmount(line)
    if (amt === null || amt <= 0) continue

    if (/gran\s*total|grand\s*total|total\s*a\s*pagar|importe\s*total|amount\s*due|total\s*due|net\s*amount|monto\s*total/i.test(lo)) {
      total = amt
    } else if (/^total\b|total\s*[:=]/i.test(lo) && total === null) {
      total = amt
    } else if (/sub[\s\-]?total/i.test(lo)) {
      subtotal = amt
    } else if (/\b(i\.?v\.?a\.?|tax|impuesto|igv|iva)\b/i.test(lo)) {
      tax = amt
    }
  }

  // Fallback total: largest number in the doc that appears near "total"
  if (total === null) {
    let max = 0
    for (const line of lines) {
      const amt = extractLineAmount(line)
      if (amt && amt > max) max = amt
    }
    if (max > 0) total = max
  }

  // Derive subtotal from total - tax if missing
  if (subtotal === null && total !== null && tax !== null) {
    subtotal = parseFloat((total - tax).toFixed(2))
  }

  // ── Date ──────────────────────────────────────────────────────────────────
  let date: string | null = null

  const dateRegexes: [RegExp, (m: RegExpMatchArray) => Date][] = [
    // ISO: 2024-01-31
    [/\b(\d{4}[-\/]\d{2}[-\/]\d{2})\b/, (m) => new Date(m[1])],
    // DD/MM/YYYY or DD-MM-YYYY
    [/\b(\d{2})[-\/](\d{2})[-\/](\d{4})\b/, (m) => new Date(`${m[3]}-${m[2]}-${m[1]}`)],
    // MM/DD/YYYY (US)
    [/\b(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})\b/, (m) => {
      const d1 = new Date(`${m[3]}-${m[1].padStart(2,"0")}-${m[2].padStart(2,"0")}`)
      const d2 = new Date(`${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`)
      // Prefer DD/MM if day > 12
      return parseInt(m[1]) > 12 ? d2 : d1
    }],
    // DD/MM/YY
    [/\b(\d{2})[-\/](\d{2})[-\/](\d{2})\b/, (m) => new Date(`20${m[3]}-${m[2]}-${m[1]}`)],
  ]

  outer:
  for (const line of lines) {
    for (const [rx, builder] of dateRegexes) {
      const m = line.match(rx)
      if (m) {
        const d = builder(m)
        if (!isNaN(d.getTime()) && d.getFullYear() >= 2000 && d.getFullYear() <= 2100) {
          date = d.toISOString().split("T")[0]
          break outer
        }
      }
    }
  }

  if (!date) date = new Date().toISOString().split("T")[0]

  // ── Merchant ───────────────────────────────────────────────────────────────
  // Usually the first meaningful line: not an address, not a date, not a number
  let merchant: string | null = null

  const skipLine = /^(\d+|tel[ef]?:|phone:|fax:|www\.|http|rif:|nit:|ruc:|cif:|fecha|date|hora|time|factura|invoice|recibo|receipt|ticket|cajero|caja|aten|cashier|\*+|={3,}|-{3,})/i

  for (const line of lines.slice(0, 10)) {
    if (line.length < 3) continue
    if (skipLine.test(line)) continue
    if (/^\d[\d\s\-\.\/]*$/.test(line)) continue // pure numbers
    if (dateRegexes.some(([rx]) => rx.test(line))) continue // date line
    merchant = line
    break
  }

  // ── Payment method ─────────────────────────────────────────────────────────
  let paymentMethod: string | null = null
  if (/visa(?!\s*electron)/i.test(text)) paymentMethod = "Tarjeta de crédito"
  else if (/master\s*card|amex|american\s*express/i.test(text)) paymentMethod = "Tarjeta de crédito"
  else if (/visa\s*electron|maestro|débito|debito|debit/i.test(text)) paymentMethod = "Tarjeta de débito"
  else if (/efectivo|cash|contado/i.test(text)) paymentMethod = "Efectivo"
  else if (/pago\s*m[oó]vil|pagom[oó]vil/i.test(text)) paymentMethod = "Pago Móvil"
  else if (/zelle/i.test(text)) paymentMethod = "Zelle"
  else if (/transferencia|transfer\b/i.test(text)) paymentMethod = "Transferencia"

  // ── Category ───────────────────────────────────────────────────────────────
  let category: OcrResultInput["category"] = "otros"

  const cats: [RegExp, OcrResultInput["category"]][] = [
    [/farmacia|pharmacy|drug\s*store|medicament|clinica|hospital|salud|laborat/i, "salud"],
    [/super\s*mercado|supermercado|supermarket|abastos|grocery|walmart|makro|bodeg/i, "supermercado"],
    [/restauran|rest\.\s|pizz|burger|kfc|mcdon|subway|comida|food|cafet|panaderia|bakery|taqueria|sushi|chino/i, "comida"],
    [/gasolinera|gas\s*station|combustible|gasolina|fuel|shell|pdvsa|repsol|bp\b|texaco/i, "combustible"],
    [/metro|taxi|uber|cabify|bus\b|transporte|estacion|terminal|avion|aerolinea/i, "transporte"],
    [/cine|cinema|theatre|teatro|netflix|spotify|steam|ocio|entretenim|juego|game/i, "ocio"],
    [/electricidad|agua\b|gas\b|internet|telefon|cantv|movistar|digitel|corpoelec|servicio|factura/i, "servicios"],
    [/ferreteria|mueble|hogar|home\b|ikea|decoraci|mantenimiento/i, "hogar"],
  ]

  for (const [rx, cat] of cats) {
    if (rx.test(text)) { category = cat; break }
  }

  // ── Line items ─────────────────────────────────────────────────────────────
  const items: ReceiptItem[] = []
  // Lines that look like: "Producto nombre    12.50"
  const itemRx = /^(.{3,35}?)\s{2,}(\d[\d.,]+)\s*$/

  // Skip header/footer lines
  const skipItem = /total|subtotal|impuesto|tax|iva|igv|descuento|discount|cambio|change|pago|vuelto|propina|tip|gracias|thank|rif|fecha|hora|cajero/i

  for (const line of lines) {
    if (skipItem.test(line)) continue
    const m = line.match(itemRx)
    if (!m) continue
    const price = parseAmount(m[2])
    if (!price || price <= 0) continue
    if (total && price >= total) continue // skip if it looks like a total line
    items.push({ name: m[1].trim(), price, quantity: 1 })
  }

  return {
    merchant,
    date,
    items,
    subtotal,
    tax,
    total,
    paymentMethod,
    reference: null,
    category,
    currency,
  }
}
