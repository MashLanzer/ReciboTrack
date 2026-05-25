import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

type Params = { params: Promise<{ id: string }> }

// ── PATCH — actualizar webhook ────────────────────────────────────────────────

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth
  const { id } = await params

  let body: { enabled?: boolean; url?: string; events?: string[]; secret?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 })
  }

  if (body.url !== undefined) {
    try {
      const parsed = new URL(body.url)
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return NextResponse.json({ error: "La URL debe ser http o https" }, { status: 400 })
      }
    } catch {
      return NextResponse.json({ error: "URL inválida" }, { status: 400 })
    }
  }

  const patch: Record<string, unknown> = {}
  if (body.enabled !== undefined) patch.enabled = body.enabled
  if (body.url     !== undefined) patch.url     = body.url
  if (body.events  !== undefined) patch.events  = body.events
  if (body.secret  !== undefined) patch.secret  = body.secret

  const sb = getSupabase()
  const { error } = await sb
    .from("webhooks")
    .update(patch)
    .eq("id", id)
    .eq("uid", uid)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// ── DELETE — eliminar webhook ─────────────────────────────────────────────────

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth
  const { id } = await params

  const { error } = await getSupabase()
    .from("webhooks")
    .delete()
    .eq("id", id)
    .eq("uid", uid)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
