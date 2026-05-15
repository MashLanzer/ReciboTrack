import Anthropic from "@anthropic-ai/sdk"
import { ocrResultSchema, type OcrResultInput } from "@/lib/firebase/schemas"

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 55_000, // 55s — just under the 60s fetch timeout on the client
})

const OCR_PROMPT = `Eres un experto en extracción de datos de recibos. Analiza esta imagen y devuelve ÚNICAMENTE un objeto JSON válido (sin markdown, sin backticks, sin texto adicional) con esta estructura exacta:

{
  "merchant": "nombre del comercio",
  "date": "YYYY-MM-DD",
  "items": [{ "name": "descripción", "price": 0.00, "quantity": 1 }],
  "subtotal": 0.00,
  "tax": 0.00,
  "total": 0.00,
  "paymentMethod": "Visa, Cash, Mastercard, etc",
  "reference": "número de referencia o transacción",
  "category": "una de: combustible, comida, supermercado, transporte, ocio, salud, hogar, servicios, otros",
  "currency": "USD"
}

Reglas: Si un campo no es legible, usa null. Para "category", elige la mejor según los items (si hay "Prepay Fuel" o gasolina → combustible). Los precios son números, no strings. Fecha en formato ISO YYYY-MM-DD. Devuelve SOLO el JSON.`

export async function extractReceiptData(base64Image: string, mediaType: string): Promise<OcrResultInput> {
  const validMediaType = (["image/jpeg", "image/png", "image/gif", "image/webp"] as const).includes(
    mediaType as "image/jpeg"
  )
    ? (mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp")
    : "image/jpeg"

  const response = await client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 1536,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: validMediaType,
              data: base64Image,
            },
          },
          {
            type: "text",
            text: OCR_PROMPT,
          },
        ],
      },
    ],
  })

  const text = response.content[0].type === "text" ? response.content[0].text : ""

  let parsed: unknown
  try {
    parsed = JSON.parse(text.trim())
  } catch {
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error("Claude no devolvió JSON válido")
    parsed = JSON.parse(match[0])
  }

  return ocrResultSchema.parse(parsed)
}
