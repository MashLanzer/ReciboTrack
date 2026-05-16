import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const { expenses, categories, month } = await req.json()

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return NextResponse.json({ error: "No API key" }, { status: 500 })

    // Preparar resumen de datos para enviar a Gemini (no enviar datos sensibles)
    const summary = {
      totalGastos: expenses.reduce((s: number, e: { total: number }) => s + e.total, 0),
      numTransacciones: expenses.length,
      mes: month,
      topCategorias: categories.slice(0, 5).map((c: { name: string; total: number; delta: number }) => ({
        nombre: c.name,
        total: c.total,
        cambioVsMesAnterior: c.delta,
      })),
      comercioMasFrecuente: expenses.reduce((acc: Record<string, number>, e: { merchant: string }) => {
        acc[e.merchant] = (acc[e.merchant] ?? 0) + 1
        return acc
      }, {}),
    }

    const prompt = `Eres un asistente financiero personal. Analiza estos datos de gastos del mes de ${month} y escribe UN párrafo en español (máximo 120 palabras) que resuma el comportamiento financiero de forma amigable, directa y útil. Menciona lo más destacado: si gastó más o menos que antes, en qué categorías, y una observación constructiva. No uses listas, solo prosa fluida. Datos: ${JSON.stringify(summary)}`

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    )

    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "No se pudo generar el resumen."
    return NextResponse.json({ summary: text })
  } catch {
    return NextResponse.json({ error: "Error generando resumen" }, { status: 500 })
  }
}
