import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  let body: { ids?: unknown }
  try {
    body = (await req.json()) as { ids?: unknown }
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 })
  }

  const ids = body.ids
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids requerido" }, { status: 400 })
  }

  const sb = getSupabase()
  const { error } = await sb
    .from("expenses")
    .delete()
    .in("id", ids)
    .eq("uid", uid)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ deleted: ids.length })
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  let body: { ids?: unknown; updates?: { category?: string; tags?: string[]; archived?: boolean } }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 })
  }

  const ids = body.ids
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids requerido" }, { status: 400 })
  }

  const updates = body.updates ?? {}
  const snakeUpdates: Record<string, unknown> = {}
  if (updates.category !== undefined) snakeUpdates.category = updates.category
  if (updates.tags !== undefined)     snakeUpdates.tags = updates.tags
  if (updates.archived !== undefined) snakeUpdates.archived = updates.archived

  if (Object.keys(snakeUpdates).length === 0) {
    return NextResponse.json({ error: "Sin campos a actualizar" }, { status: 400 })
  }

  snakeUpdates.updated_at = new Date().toISOString()

  const sb = getSupabase()
  const { error } = await sb
    .from("expenses")
    .update(snakeUpdates)
    .in("id", ids)
    .eq("uid", uid)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ updated: ids.length })
}
