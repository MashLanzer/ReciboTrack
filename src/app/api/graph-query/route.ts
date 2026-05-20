/**
 * Natural Language → Expense Graph Query
 * Uses Groq (same as other AI routes) to parse the question and filter expenses.
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
const MODEL    = "llama-3.3-70b-versatile"

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, "ai")
  if (auth instanceof NextResponse) return auth

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

    // Build compact data summary — truncate free-text fields to avoid sending
    // excessive PII to the LLM and to keep token usage low.
    const expenseSummary = expenses.slice(0, 200).map((e) => {
      // Merchant: trim to 40 chars (enough to identify, less to expose)
      const merchant = (e.merchant ?? "").slice(0, 40)
      // Notes: first 60 chars only (context for queries, not full content)
      const notesPart = e.notes ? ` | notas: ${e.notes.slice(0, 60)}` : ""
      // Tags: max 5 tags, each max 20 chars
      const tagsPart = e.tags?.length
        ? ` | tags: ${e.tags.slice(0, 5).map(t => t.slice(0, 20)).join(",")}`
        : ""
      // Project label (no ID, just name)
      const projectPart = e.project ? ` | proyecto: ${String(e.project).slice(0, 30)}` : ""
      // Persons: first names only, max 5
      const personsPart = e.persons?.length
        ? ` | con: ${e.persons.slice(0, 5).map(p => String(p).split(" ")[0]).join(",")}`
        : ""
      return `[${e.id}] ${e.date.slice(0, 10)} | ${merchant} | ${e.category} | ${e.total} ${e.currency}` +
        notesPart + tagsPart + projectPart + personsPart
    }).join("\n")

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
