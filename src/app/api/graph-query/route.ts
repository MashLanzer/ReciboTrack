/**
 * Natural Language → Expense Graph Query
 * Uses Groq (same as other AI routes) to parse the question and filter expenses.
 */

import { NextRequest, NextResponse } from "next/server"

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
const MODEL    = "llama-3.3-70b-versatile"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      question: string
      expenses: Array<{
        id: string; merchant: string; date: string; category: string
        total: number; currency: string; notes?: string; tags?: string[]
        project?: string; persons?: string[]
      }>
      entities: Array<{ id: string; type: string; name: string }>
    }

    const { question, expenses, entities } = body

    if (!question?.trim()) {
      return NextResponse.json({ error: "Question is required" }, { status: 400 })
    }

    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "GROQ_API_KEY no configurada" }, { status: 500 })
    }

    // Build compact data summary
    const expenseSummary = expenses.slice(0, 200).map((e) => (
      `[${e.id}] ${e.date.slice(0, 10)} | ${e.merchant} | ${e.category} | ${e.total} ${e.currency}` +
      (e.notes ? ` | notas: ${e.notes}` : "") +
      (e.tags?.length ? ` | tags: ${e.tags.join(",")}` : "") +
      (e.project ? ` | proyecto: ${e.project}` : "") +
      (e.persons?.length ? ` | con: ${e.persons.join(",")}` : "")
    )).join("\n")

    const entitySummary = entities.map((e) => `[${e.id}] ${e.type}: ${e.name}`).join("\n")

    const systemPrompt = `Eres un asistente de finanzas personales. Recibirás una lista de gastos y una pregunta en español.
Tu tarea es identificar qué gastos responden a la pregunta y devolver un JSON.

Responde SIEMPRE con un JSON válido con esta estructura exacta (sin texto adicional):
{
  "answer": "respuesta concisa en español, 1-2 frases",
  "matchedExpenseIds": ["id1", "id2"],
  "total": 123.45,
  "currency": "USD",
  "reasoning": "breve explicación del filtrado"
}

Si no hay coincidencias, devuelve matchedExpenseIds: [] y explícalo en answer.`

    const userMessage = `Pregunta: "${question}"

GASTOS (formato: [id] fecha | comercio | categoría | monto moneda):
${expenseSummary}

ENTIDADES:
${entitySummary || "(ninguna)"}`

    const res = await fetch(GROQ_URL, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:       MODEL,
        max_tokens:  1024,
        temperature: 0.1,
        messages: [
          { role: "system",  content: systemPrompt },
          { role: "user",    content: userMessage },
        ],
      }),
    })

    if (!res.ok) {
      return NextResponse.json({ error: "Error del LLM" }, { status: 502 })
    }

    const data = await res.json() as {
      choices: Array<{ message: { content: string } }>
    }

    const text = data.choices[0]?.message?.content ?? ""

    // Extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({
        answer:            "No pude interpretar la pregunta. Inténtalo con otras palabras.",
        matchedExpenseIds: [],
        total:             0,
        currency:          "USD",
        reasoning:         "parse error",
      })
    }

    const result = JSON.parse(jsonMatch[0]) as {
      answer: string
      matchedExpenseIds: string[]
      total: number
      currency: string
      reasoning: string
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error("[graph-query]", err)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
