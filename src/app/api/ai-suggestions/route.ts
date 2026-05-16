import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const { expenses } = await req.json()

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return NextResponse.json({ error: "No API key" }, { status: 500 })

    // Build summary for the prompt — no raw sensitive data
    const summary = {
      totalGastos: expenses.reduce((s: number, e: { total: number }) => s + e.total, 0),
      numTransacciones: expenses.length,
      porCategoria: expenses.reduce((acc: Record<string, number>, e: { category: string; total: number }) => {
        acc[e.category] = (acc[e.category] ?? 0) + e.total
        return acc
      }, {}),
      comerciosMasFrecuentes: Object.entries(
        expenses.reduce((acc: Record<string, number>, e: { merchant: string }) => {
          acc[e.merchant] = (acc[e.merchant] ?? 0) + 1
          return acc
        }, {})
      )
        .sort((a, b) => (b[1] as number) - (a[1] as number))
        .slice(0, 5)
        .map(([merchant, count]) => ({ merchant, count })),
    }

    const prompt = `Eres un asesor financiero personal. Basándote en estos datos de gastos de los últimos 3 meses, genera EXACTAMENTE 3 sugerencias de ahorro concretas, accionables y realistas en español. Cada sugerencia debe tener: título corto (max 5 palabras) y descripción (max 30 palabras) con un ahorro estimado en euros/mes si es posible. Responde SOLO con JSON válido: [{"titulo": "...", "descripcion": "...", "ahorroEstimado": 50}]. Datos: ${JSON.stringify(summary)}`

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    )

    const data = await response.json()
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]"

    // Strip markdown fences if Gemini wraps the JSON
    const clean = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim()

    let suggestions: unknown[]
    try {
      suggestions = JSON.parse(clean) as unknown[]
    } catch {
      suggestions = []
    }

    return NextResponse.json({ suggestions })
  } catch {
    return NextResponse.json({ error: "Error generando sugerencias" }, { status: 500 })
  }
}
