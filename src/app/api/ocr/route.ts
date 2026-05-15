import { GoogleGenerativeAI } from "@google/generative-ai"
import { NextResponse } from "next/server"

const MODEL = "gemini-2.0-flash"

const PROMPT = `Analiza este recibo o factura y extrae los datos. Responde ÚNICAMENTE con un objeto JSON válido, sin markdown, sin bloques de código, sin texto adicional.

Estructura exacta requerida:
{
  "merchant": "nombre del comercio (string o null)",
  "date": "fecha en formato YYYY-MM-DD (string o null)",
  "total": número decimal o null,
  "subtotal": número decimal o null,
  "tax": número decimal de impuestos o null,
  "currency": "código ISO de moneda: USD, EUR, VES, COP, MXN, etc.",
  "paymentMethod": "Efectivo | Tarjeta de crédito | Tarjeta de débito | Transferencia | Zelle | Pago Móvil | null",
  "reference": "número de transacción o referencia (string o null)",
  "category": "una de: comida | supermercado | combustible | transporte | salud | ocio | servicios | hogar | otros",
  "items": [
    { "name": "nombre del producto", "price": número, "quantity": número }
  ]
}

Reglas:
- Si no puedes leer un campo, usa null.
- Los montos deben ser números (no strings).
- La categoría debe ser exactamente una de las opciones dadas.
- items puede ser un array vacío [] si no se distinguen productos individuales.
- No inventes datos que no están en el recibo.`

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

    // Validar que sea una imagen
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]
    const safeType = validTypes.includes(mediaType) ? mediaType : "image/jpeg"

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: MODEL })

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

    let parsed: unknown
    try {
      parsed = JSON.parse(clean)
    } catch {
      // Si Gemini devuelve texto no parseable, devolver estructura vacía
      return NextResponse.json({
        merchant: null, date: null, total: null, subtotal: null,
        tax: null, currency: "USD", paymentMethod: null, reference: null,
        category: "otros", items: [],
      })
    }

    return NextResponse.json(parsed)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error interno"

    // Quota excedida → el cliente hará fallback a Tesseract
    if (message.includes("429") || message.includes("quota")) {
      return NextResponse.json({ error: "quota_exceeded" }, { status: 429 })
    }

    console.error("[OCR] Error:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
