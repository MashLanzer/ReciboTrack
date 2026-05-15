import { NextRequest, NextResponse } from "next/server"
import { extractReceiptData } from "@/lib/ocr/claude"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { base64?: string; mediaType?: string }

    if (!body.base64 || !body.mediaType) {
      return NextResponse.json({ error: "base64 y mediaType son requeridos" }, { status: 400 })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY no configurada" }, { status: 500 })
    }

    const result = await extractReceiptData(body.base64, body.mediaType)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error procesando el recibo"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
