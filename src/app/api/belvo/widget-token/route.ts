import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"

const BELVO_BASE = process.env.BELVO_ENV === "production"
  ? "https://api.belvo.com"
  : "https://sandbox.belvo.com"

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  const id     = process.env.BELVO_SECRET_ID
  const secret = process.env.BELVO_SECRET_PASSWORD

  if (!id || !secret) {
    return NextResponse.json({ error: "Belvo no configurado. Contacta al administrador." }, { status: 503 })
  }

  const credentials = Buffer.from(`${id}:${secret}`).toString("base64")

  try {
    const res = await fetch(`${BELVO_BASE}/api/token/`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id,
        scopes: "read_institutions,read_accounts,read_transactions",
        widget: {
          callback_urls: {
            success: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://recibotrack.vercel.app"}/api/belvo/callback?uid=${uid}`,
            exit: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://recibotrack.vercel.app"}/expenses`,
          },
        },
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as Record<string, unknown>
      console.error("[Belvo] widget token error:", err)
      return NextResponse.json({ error: "Error al conectar con Belvo" }, { status: 500 })
    }

    const data = await res.json() as { access: string }
    return NextResponse.json({ token: data.access })
  } catch (err) {
    console.error("[Belvo] fetch error:", err)
    return NextResponse.json({ error: "Error de red al conectar con Belvo" }, { status: 500 })
  }
}
