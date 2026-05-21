/**
 * GET  /api/portals  — Lista portales del usuario
 * POST /api/portals  — Crea un portal
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

function rowToPortal(row: Record<string, unknown>, ownerName: string) {
  return {
    id:             row.id,
    name:           row.name,
    token:          row.token,
    role:           row.role ?? "custom",
    permissions:    row.permissions ?? {},
    expiresAt:      row.expires_at ?? null,
    revoked:        row.revoked ?? false,
    lastAccessedAt: row.last_accessed_at ?? null,
    accessCount:    Number(row.access_count ?? 0),
    targetLabel:    row.target_label ?? "",
    ownerUid:       row.uid,
    ownerName:      row.owner_name ?? ownerName,
    createdAt:      row.created_at,
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  const { data: rows, error } = await getSupabase()
    .from("portals")
    .select("*")
    .eq("uid", uid)
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((rows ?? []).map((row: Record<string, unknown>) => rowToPortal(row, "")))
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  let body: Record<string, unknown>
  try { body = (await req.json()) as Record<string, unknown> }
  catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }) }

  const { data, error } = await getSupabase()
    .from("portals")
    .insert({
      uid,
      token:           body.token,
      name:            body.name ?? null,
      role:            body.role ?? "custom",
      permissions:     body.permissions ?? {},
      expires_at:      body.expiresAt ?? null,
      revoked:         false,
      last_accessed_at: null,
      access_count:    0,
      target_label:    body.targetLabel ?? "",
      owner_name:      body.ownerName ?? "",
      created_at:      new Date().toISOString(),
    })
    .select("id").single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data?.id }, { status: 201 })
}
