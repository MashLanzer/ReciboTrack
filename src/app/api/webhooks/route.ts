import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

// ── GET — listar webhooks del usuario ─────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  const sb = getSupabase()
  const { data, error } = await sb
    .from("webhooks")
    .select("*")
    .eq("uid", uid)
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// ── POST — crear webhook ──────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  let body: { url?: string; secret?: string; events?: string[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 })
  }

  if (!body.url) {
    return NextResponse.json({ error: "La URL es requerida" }, { status: 400 })
  }

  // Validar formato de URL
  try {
    const parsed = new URL(body.url)
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return NextResponse.json({ error: "La URL debe ser http o https" }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: "URL inválida" }, { status: 400 })
  }

  const sb = getSupabase()
  const { data, error } = await sb
    .from("webhooks")
    .insert({
      uid,
      url:     body.url,
      secret:  body.secret ?? null,
      events:  body.events ?? ["expense.created", "expense.updated"],
      enabled: true,
    })
    .select("id")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data?.id }, { status: 201 })
}
