/**
 * GET  /api/groups/[id]/wishlist  — Lista ítems del wishlist
 * POST /api/groups/[id]/wishlist  — Agrega un ítem
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

type Params = { params: Promise<{ id: string }> }

function rowToWishlistItem(row: Record<string, unknown>) {
  return {
    id:             row.id as string,
    title:          row.title as string,
    url:            (row.url as string) ?? null,
    estimatedPrice: row.estimated_price != null ? Number(row.estimated_price) : undefined,
    currency:       (row.currency as string) ?? "USD",
    addedBy:        row.added_by as string,
    likes:          (row.likes as string[]) ?? [],
    purchased:      Boolean(row.purchased ?? false),
    purchasedBy:    (row.purchased_by as string) ?? null,
    purchasedAt:    (row.purchased_at as string) ?? null,
    createdAt:      row.created_at as string,
  }
}

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { id: groupId } = await params

  const { data, error } = await getSupabase()
    .from("group_wishlist")
    .select("*")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((data ?? []).map((r) => rowToWishlistItem(r as Record<string, unknown>)))
}

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth
  const { id: groupId } = await params

  let body: { title: string; url?: string; estimatedPrice?: number; currency?: string }
  try { body = (await req.json()) as typeof body }
  catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }) }

  const { data, error } = await getSupabase()
    .from("group_wishlist")
    .insert({
      group_id:        groupId,
      title:           body.title,
      url:             body.url ?? null,
      estimated_price: body.estimatedPrice ?? null,
      currency:        body.currency ?? "USD",
      added_by:        uid,
      likes:           [],
      purchased:       false,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(rowToWishlistItem(data as Record<string, unknown>), { status: 201 })
}
