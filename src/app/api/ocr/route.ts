import { GoogleGenerativeAI } from "@google/generative-ai"
import { NextResponse } from "next/server"

const MODEL = "gemini-2.0-flash"

const PROMPT = `Eres un experto en extracción de datos de documentos financieros: recibos físicos, facturas electrónicas, comprobantes de pago online, tickets, y cualquier tipo de documento de gasto. Especializados en Latinoamérica pero manejas documentos de cualquier país.

La imagen puede contener VARIAS PÁGINAS DE UN PDF unidas verticalmente. Analiza TODO el contenido de arriba a abajo.

Responde ÚNICAMENTE con JSON válido. Cero texto adicional, cero markdown.

{
  "merchant": "nombre del negocio/empresa que recibió el pago (no el procesador de pagos)",
  "date": "YYYY-MM-DD o null",
  "total": número (monto total final pagado),
  "subtotal": número o null,
  "tax": número o null,
  "currency": "USD | EUR | VES | COP | MXN | PEN | ARS | BRL | CLP",
  "paymentMethod": "Efectivo | Tarjeta de crédito | Tarjeta de débito | Transferencia | Zelle | Pago Móvil | null",
  "reference": "código de transacción/autorización (string o null)",
  "category": "comida | supermercado | combustible | transporte | salud | ocio | servicios | hogar | otros",
  "items": [{"name": "descripción", "price": número, "quantity": número}]
}

═══ REGLAS POR TIPO DE DOCUMENTO ═══

COMPROBANTES DE PAGO ONLINE (PayPal, Stripe, CardConnect, Mercado Pago, etc.):
- merchant: busca "Merchant:", "Pay To:", "Vendedor:", "Description:", "Order from:", "Paid to:" — ESE es el comercio real, NO el nombre del procesador (CardConnect, Stripe, PayPal no son el comercio)
- reference: el "Transaction ID", "Order #", "Confirmation #", "Auth Code", "Approval Code"
- paymentMethod: casi siempre "Tarjeta de crédito" o "Tarjeta de débito"
- date: busca "Date:", "Transaction Date:", "Payment Date:", "Fecha:"
- total: busca "Amount:", "Total:", "Amount Paid:", "Grand Total:"

FACTURAS ELECTRÓNICAS (XML, PDF de empresa):
- merchant: el nombre en "Emisor:", "Razón Social:", "From:", "Sold By:", o el encabezado de la empresa
- reference: "Factura N°", "Invoice #", "Folio:", "N° Comprobante"
- tax: busca IVA, VAT, TAX, ITBIS, IGV — es el monto del impuesto, no el porcentaje

RECIBOS FÍSICOS (tickets de caja, restaurantes, supermercados):
- merchant: nombre del negocio en la parte superior del ticket (logo textual, nombre grande)
- NO uses dirección, teléfono, RIF/NIT como nombre del comercio
- items: extrae productos con precio si son visibles

RECIBOS VENEZOLANOS:
- Moneda: Bs, Bs.S, Bs.D, VES → VES
- Los montos pueden ser muy grandes (100000+) — son normales en bolívares
- Pago Móvil es método común
- Pueden tener monto en USD Y en Bs — usa el que aparezca como total final

═══ EXTRACCIÓN DE FECHA ═══
Busca exhaustivamente: "Date", "Fecha", "Emisión", "F. Emisión", cualquier patrón de fecha.
Formatos: DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, "15 May 2024", "May 15, 2024", "15-05-24"
Si hay varias fechas, usa la de la transacción (no fechas de vencimiento).

═══ EXTRACCIÓN DE MONTO ═══
Total: "TOTAL", "GRAND TOTAL", "AMOUNT DUE", "AMOUNT PAID", "Total a Pagar", "Monto Total"
El total es el número final más grande asociado a estas palabras.
NO confundas con: números de tarjeta, códigos de autorización, números de teléfono.

═══ MÉTODO DE PAGO ═══
Visa/MC/Amex sin "débito" → "Tarjeta de crédito"
Visa Débito/Electron/Maestro/Debit → "Tarjeta de débito"
Efectivo/Cash/Contado → "Efectivo"
Pago Móvil/PagoMóvil → "Pago Móvil"
Zelle → "Zelle"
Wire/Transfer/Transferencia → "Transferencia"

═══ REFERENCIA ═══
Prioridad: Transaction ID > Authorization Code > Confirmation Number > Order # > Voucher # > Lote
Incluye solo el número/código, no la etiqueta. Máximo 30 caracteres.

═══ CATEGORÍA ═══
comida: restaurantes, delivery, fast food, cafés, bares con comida
supermercado: supermercados, abastos, tiendas de conveniencia, farmacias mixtas
combustible: gasolineras, estaciones de servicio, diesel
transporte: Uber, taxi, metro, bus, aerolíneas, parking, peajes, cabify
salud: farmacias (medicamentos), clínicas, hospitales, laboratorios, dentistas
ocio: cines, streaming, videojuegos, parques, conciertos, eventos
servicios: electricidad, agua, gas doméstico, internet, telefonía, seguros, bancos, suscripciones
hogar: ferreterías, muebles, electrodomésticos, decoración, mantenimiento
otros: todo lo que no encaje arriba

Si no puedes determinar un campo con certeza razonable → null (nunca inventes).`

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY no configurada" }, { status: 500 })
    }

    const { base64, mediaType } = await req.json() as { base64: string; mediaType: string }

    if (!base64 || !mediaType) {
      return NextResponse.json({ error: "Faltan parámetros: base64 y mediaType" }, { status: 400 })
    }

    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]
    const safeType = validTypes.includes(mediaType) ? mediaType : "image/jpeg"

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      model: MODEL,
      generationConfig: {
        temperature: 0.1,      // Baja temperatura = más preciso, menos creativo
        topP: 0.8,
        maxOutputTokens: 2048,
      },
    })

    const result = await model.generateContent([
      PROMPT,
      {
        inlineData: {
          mimeType: safeType as "image/jpeg" | "image/png" | "image/webp" | "image/heic" | "image/heif",
          data: base64,
        },
      },
    ])

    const text = result.response.text().trim()

    // Limpiar posibles bloques de markdown que Gemini a veces añade
    const clean = text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim()

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(clean) as Record<string, unknown>
    } catch {
      console.error("[OCR] JSON parse failed, raw response:", clean.slice(0, 200))
      return NextResponse.json({
        merchant: null, date: null, total: null, subtotal: null,
        tax: null, currency: "USD", paymentMethod: null, reference: null,
        category: "otros", items: [],
      })
    }

    // Post-procesado: validar y sanear datos antes de devolver
    const sanitized = sanitizeOcrResult(parsed)
    return NextResponse.json(sanitized)

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error interno"

    // Quota excedida → el cliente hará fallback a Tesseract
    if (message.includes("429") || message.includes("quota") || message.includes("RESOURCE_EXHAUSTED")) {
      return NextResponse.json({ error: "quota_exceeded" }, { status: 429 })
    }

    console.error("[OCR] Error:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// Valida y sanea el resultado de Gemini para evitar datos inválidos
function sanitizeOcrResult(raw: Record<string, unknown>): Record<string, unknown> {
  const VALID_CATEGORIES = ["comida", "supermercado", "combustible", "transporte", "salud", "ocio", "servicios", "hogar", "otros"]
  const VALID_CURRENCIES = ["USD", "EUR", "VES", "COP", "MXN", "PEN", "ARS", "BRL", "CLP", "GBP"]
  const VALID_PAYMENT = ["Efectivo", "Tarjeta de crédito", "Tarjeta de débito", "Transferencia", "Zelle", "Pago Móvil"]

  // Merchant: string limpio, max 80 chars
  let merchant = typeof raw.merchant === "string" ? raw.merchant.trim().slice(0, 80) : null
  if (!merchant || merchant.toLowerCase() === "null") merchant = null

  // Date: validar formato YYYY-MM-DD
  let date: string | null = null
  if (typeof raw.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.date)) {
    const d = new Date(raw.date)
    if (!isNaN(d.getTime()) && d.getFullYear() >= 2000 && d.getFullYear() <= 2100) {
      date = raw.date
    }
  }

  // Amounts: números positivos, máx razonable por moneda
  const toPositiveNumber = (v: unknown): number | null => {
    const n = typeof v === "number" ? v : parseFloat(String(v))
    return isNaN(n) || n <= 0 ? null : parseFloat(n.toFixed(2))
  }

  let total = toPositiveNumber(raw.total)
  let subtotal = toPositiveNumber(raw.subtotal)
  let tax = toPositiveNumber(raw.tax)

  // Coherencia: subtotal + tax ≈ total (con margen del 5%)
  if (total && subtotal && tax) {
    const computed = parseFloat((subtotal + tax).toFixed(2))
    const diff = Math.abs(computed - total) / total
    if (diff > 0.05) {
      // Si no cuadra, recalcular subtotal
      subtotal = parseFloat((total - tax).toFixed(2))
    }
  } else if (total && tax && !subtotal) {
    subtotal = parseFloat((total - tax).toFixed(2))
  }

  // Currency
  const currency = VALID_CURRENCIES.includes(String(raw.currency)) ? String(raw.currency) : "USD"

  // Payment method
  const paymentMethod = VALID_PAYMENT.includes(String(raw.paymentMethod)) ? String(raw.paymentMethod) : null

  // Reference: solo si parece un código real (4+ dígitos/chars)
  let reference: string | null = null
  if (typeof raw.reference === "string" && raw.reference.trim().length >= 4) {
    reference = raw.reference.trim().slice(0, 50)
  }

  // Category
  const category = VALID_CATEGORIES.includes(String(raw.category)) ? String(raw.category) : "otros"

  // Items: filtrar los que tengan nombre y precio válido
  const rawItems = Array.isArray(raw.items) ? raw.items : []
  const items = rawItems
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      name: String(item.name ?? "").trim().slice(0, 60),
      price: toPositiveNumber(item.price) ?? 0,
      quantity: toPositiveNumber(item.quantity) ?? 1,
    }))
    .filter((item) => item.name.length > 0 && item.price > 0)

  return { merchant, date, total, subtotal, tax, currency, paymentMethod, reference, category, items }
}
