import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { AiSummarySchema } from "@/lib/api-schemas"

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
const MODEL    = "llama-3.3-70b-versatile"

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, "ai")
  if (auth instanceof NextResponse) return auth

  try {
    const body = await req.json()
    const parsed = AiSummarySchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })
    const { expenses, categories, month } = parsed.data

    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) return NextResponse.json({ error: "GROQ_API_KEY no configurada" }, { status: 500 })

    // Build a compact, privacy-safe summary for the prompt
    const totalGastos   = (expenses as { total: number }[]).reduce((s, e) => s + e.total, 0)
    const numTx         = (expenses as unknown[]).length
    const promedioTx    = numTx > 0 ? totalGastos / numTx : 0

    const topCats = (categories as { name: string; total: number; delta: number }[])
      .slice(0, 6)
      .map(c => ({
        categoria: c.name,
        total: Math.round(c.total * 100) / 100,
        cambioVsMesAnterior: c.delta != null ? `${c.delta > 0 ? "+" : ""}${Math.round(c.delta)}%` : "—",
      }))

    const merchantCount: Record<string, number> = {}
    ;(expenses as { merchant: string }[]).forEach(e => {
      merchantCount[e.merchant] = (merchantCount[e.merchant] ?? 0) + 1
    })
    const topMerchants = Object.entries(merchantCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([m, c]) => `${m} (${c}x)`)

    const payload = {
      mes:         month,
      totalGastos: `$${Math.round(totalGastos * 100) / 100}`,
      transacciones: numTx,
      promedioPorTransaccion: `$${Math.round(promedioTx * 100) / 100}`,
      topCategorias: topCats,
      comerciosMasVisitados: topMerchants,
    }

    const systemPrompt = `Eres un asesor financiero personal amigable y directo. Analizas datos de gastos reales y ofreces resúmenes concisos, personalizados y accionables en español.`

    const userPrompt = `Analiza estos datos de gastos del mes de ${month} y escribe UN único párrafo en español (entre 80 y 130 palabras) que:
- Resuma el gasto total y las categorías principales
- Mencione si gastó más o menos que el mes anterior (usa los % de cambio)
- Destaque el comercio más frecuentado
- Termine con UNA observación constructiva o consejo concreto

Escribe en tono natural, cercano y útil. Sin listas, solo prosa fluida. Sin saludos ni despedidas.

Datos: ${JSON.stringify(payload)}`

    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: userPrompt   },
        ],
        temperature: 0.65,
        max_tokens:  300,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      console.error("[ai-summary] Groq error:", JSON.stringify(data))
      return NextResponse.json({ error: data.error?.message ?? "Error de Groq" }, { status: 502 })
    }

    const text: string | undefined = data.choices?.[0]?.message?.content
    if (!text) {
      console.error("[ai-summary] Empty response:", JSON.stringify(data))
      return NextResponse.json({ error: "Respuesta vacía de Groq" }, { status: 502 })
    }

    return NextResponse.json({ summary: text.trim() })
  } catch (err) {
    console.error("[ai-summary] Unexpected error:", err)
    return NextResponse.json({ error: "Error generando resumen" }, { status: 500 })
  }
}
