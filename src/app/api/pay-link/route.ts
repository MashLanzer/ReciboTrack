import { NextRequest, NextResponse } from "next/server"
import { signPayToken } from "@/lib/pay-token"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { from, to, amount, concept, currency } = body

    if (!from || !to || !amount) {
      return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 })
    }

    const token = await signPayToken({ from, to, amount, concept: concept ?? "", currency: currency ?? "EUR" })
    return NextResponse.json({ token })
  } catch {
    return NextResponse.json({ error: "Error generando token" }, { status: 500 })
  }
}
