import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { signPayToken } from "@/lib/pay-token"
import { PayLinkSchema } from "@/lib/api-schemas"

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth

  try {
    const body = await req.json()
    const parsed = PayLinkSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })
    const { from, to, amount, concept, currency } = parsed.data

    const token = await signPayToken({ from, to, amount, concept: concept ?? "", currency: currency ?? "EUR" })
    return NextResponse.json({ token })
  } catch {
    return NextResponse.json({ error: "Error generando token" }, { status: 500 })
  }
}
