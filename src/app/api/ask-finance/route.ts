import { NextRequest, NextResponse } from "next/server"

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
const MODEL    = "llama-3.3-70b-versatile"

export async function POST(req: NextRequest) {
  try {
    const { question, context } = await req.json()

    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) return NextResponse.json({ error: "GROQ_API_KEY no configurada" }, { status: 500 })

    if (!question || typeof question !== "string") {
      return NextResponse.json({ error: "Pregunta inválida" }, { status: 400 })
    }

    const systemPrompt = `Eres un asesor financiero personal experto, amigable y directo.
Respondes en español, de forma concisa (máximo 120 palabras) y accionable.
Tienes acceso a datos financieros reales del usuario.
Nunca inventes cifras que no estén en los datos. Si no tienes suficiente info, dilo brevemente y ofrece consejo general.`

    const contextStr = JSON.stringify({
      gastoMesActual: context?.monthTotal ?? 0,
      gastoMesAnterior: context?.prevMonthTotal ?? 0,
      topCategorias: context?.topCategories ?? [],
      tasaAhorro: context?.savingsRate ?? null,
      moneda: context?.currency ?? "USD",
    })

    const userPrompt = `Contexto financiero del usuario: ${contextStr}

Pregunta del usuario: "${question}"

Responde de forma directa, concisa y útil. Máximo 120 palabras.`

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
        temperature: 0.7,
        max_tokens:  250,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      console.error("[ask-finance] Groq error:", JSON.stringify(data))
      return NextResponse.json({ error: data.error?.message ?? "Error de Groq" }, { status: 502 })
    }

    const text: string | undefined = data.choices?.[0]?.message?.content
    if (!text) {
      console.error("[ask-finance] Empty response:", JSON.stringify(data))
      return NextResponse.json({ error: "Respuesta vacía" }, { status: 502 })
    }

    return NextResponse.json({ answer: text.trim() })
  } catch (err) {
    console.error("[ask-finance] Unexpected error:", err)
    return NextResponse.json({ error: "Error al procesar la consulta" }, { status: 500 })
  }
}
