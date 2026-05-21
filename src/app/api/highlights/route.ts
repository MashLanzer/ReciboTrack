/**
 * GET  /api/highlights        — Lista highlights del usuario
 * POST /api/highlights        — Upserta un highlight (clave = type)
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

function rowToHighlight(row: Record<string, unknown>) {
  const meta = (row.metadata as Record<string, unknown>) ?? {}
  return {
    id:          row.key as string,
    type:        row.type as string,
    title:       (meta.title as string) ?? "",
    value:       (meta.value as string) ?? "",
    description: (meta.description as string) ?? undefined,
    date:        row.updated_at as string,
    icon:        (meta.icon as string) ?? "",
    pinned:      Boolean(meta.pinned ?? false),
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  const { data, error } = await getSupabase()
    .from("highlights")
    .select("*")
    .eq("uid", uid)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json((data ?? []).map(rowToHighlight))
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  let body: {
    key: string
    type: string
    title: string
    value: string
    description?: string
    icon: string
    pinned?: boolean
  }
  try { body = (await req.json()) as typeof body }
  catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }) }

  const metadata = {
    title:       body.title,
    value:       body.value,
    description: body.description ?? null,
    icon:        body.icon,
    pinned:      body.pinned ?? false,
  }

  const { error } = await getSupabase()
    .from("highlights")
    .upsert({
      uid,
      key:        body.key,
      type:       body.type,
      metadata,
      updated_at: new Date().toISOString(),
    }, { onConflict: "uid,key" })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
