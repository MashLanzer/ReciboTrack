import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { AiSuggestionsSchema } from "@/lib/api-schemas"

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
const MODEL    = "llama-3.3-70b-versatile"

interface RawExpense {
  total: number
  merchant: string
  category: string
  paymentMethod?: string
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, "ai")
  if (auth instanceof NextResponse) return auth

  try {
    const body = await req.json()
    const parsed = AiSuggestionsSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })
    const { expenses } = parsed.data as { expenses: RawExpense[] }

    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) return NextResponse.json({ error: "GROQ_API_KEY no configurada" }, { status: 500 })

    // Build compact summary — no raw user data
    const totalGastos = expenses.reduce((s, e) => s + e.total, 0)
    const numTx       = expenses.length

    const porCategoria: Record<string, { total: number; count: number }> = {}
    const porComercio:  Record<string, { total: number; count: number }> = {}
    const porMetodo:    Record<string, number> = {}

    expenses.forEach(e => {
      if (!porCategoria[e.category]) porCategoria[e.category] = { total: 0, count: 0 }
      porCategoria[e.category].total += e.total
      porCategoria[e.category].count++

      if (!porComercio[e.merchant]) porComercio[e.merchant] = { total: 0, count: 0 }
      porComercio[e.merchant].total += e.total
      porComercio[e.merchant].count++

      const m = e.paymentMethod ?? "Sin especificar"
      porMetodo[m] = (porMetodo[m] ?? 0) + 1
    })

    const topCats = Object.entries(porCategoria)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 5)
      .map(([cat, { total, count }]) => ({
        categoria: cat,
        total: Math.round(total * 100) / 100,
        transacciones: count,
        pctTotal: totalGastos > 0 ? `${Math.round((total / totalGastos) * 100)}%` : "0%",
      }))

    const topMerchants = Object.entries(porComercio)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([merchant, { total, count }]) => ({
        comercio: merchant,
        visitas: count,
        totalGastado: Math.round(total * 100) / 100,
      }))

    const payload = {
      periodo:         "últimos 3 meses",
      totalGastado:    `$${Math.round(totalGastos * 100) / 100}`,
      transacciones:   numTx,
      topCategorias:   topCats,
      topComercios:    topMerchants,
      metodosDePago:   porMetodo,
    }

    const systemPrompt = `Eres un asesor financiero personal experto. Generas sugerencias de ahorro concretas, realistas y accionables basadas en patrones de gasto reales. Respondes SOLO en JSON válido, sin texto extra, sin markdown.`

    const userPrompt = `Analiza estos datos de gasto de los últimos 3 meses y genera EXACTAMENTE 3 sugerencias de ahorro personalizadas.

Reglas:
- Cada sugerencia debe ser específica a los datos (menciona categorías o comercios reales del análisis)
- El ahorro estimado debe ser realista (10–30% de lo que se gasta en esa categoría)
- Título: máximo 5 palabras, directo y motivador
- Descripción: máximo 35 palabras, explica el por qué y el cómo
- ahorroEstimado: número entero en la misma moneda (sin símbolo), o null si no aplica

Responde ÚNICAMENTE con JSON válido (array de 3 objetos):
[{"titulo": "...", "descripcion": "...", "ahorroEstimado": 40}]

Datos de gasto: ${JSON.stringify(payload)}`

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
        temperature: 0.5,
        max_tokens:  600,
        response_format: { type: "json_object" },
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      console.error("[ai-suggestions] Groq error:", JSON.stringify(data))
      return NextResponse.json({ error: data.error?.message ?? "Error de Groq" }, { status: 502 })
    }

    const raw: string | undefined = data.choices?.[0]?.message?.content
    if (!raw) {
      console.error("[ai-suggestions] Empty response:", JSON.stringify(data))
      return NextResponse.json({ suggestions: [] })
    }

    // Groq with json_object mode returns valid JSON — parse it
    let suggestions: { titulo: string; descripcion: string; ahorroEstimado?: number }[] = []
    try {
      const parsed = JSON.parse(raw)
      // Groq may wrap the array in an object key
      if (Array.isArray(parsed)) {
        suggestions = parsed
      } else {
        // find the first array value in the object
        const arr = Object.values(parsed).find(Array.isArray)
        suggestions = (arr as typeof suggestions) ?? []
      }
    } catch {
      // Fallback: try stripping markdown fences
      const clean = raw
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim()
      try { suggestions = JSON.parse(clean) } catch { suggestions = [] }
    }

    return NextResponse.json({ suggestions })
  } catch (err) {
    console.error("[ai-suggestions] Unexpected error:", err)
    return NextResponse.json({ error: "Error generando sugerencias" }, { status: 500 })
  }
}
