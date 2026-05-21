/**
 * PATCH /api/groups/[id]/wishlist/[itemId]  — Actualiza ítem (like, purchase)
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

type Params = { params: Promise<{ id: string; itemId: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth
  const { id: groupId, itemId } = await params

  let body: Record<string, unknown>
  try { body = (await req.json()) as Record<string, unknown> }
  catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }) }

  const sb = getSupabase()

  // Operación like: toggle
  if ("liked" in body) {
    const liked = Boolean(body.liked)

    // Leer likes actuales
    const { data } = await sb
      .from("group_wishlist")
      .select("likes")
      .eq("id", itemId)
      .eq("group_id", groupId)
      .single()

    const currentLikes = ((data as Record<string, unknown> | null)?.likes as string[]) ?? []
    const newLikes = liked
      ? [...new Set([...currentLikes, uid])]
      : currentLikes.filter((u) => u !== uid)

    const { error } = await sb
      .from("group_wishlist")
      .update({ likes: newLikes })
      .eq("id", itemId)
      .eq("group_id", groupId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // Operación purchase
  const patch: Record<string, unknown> = {}
  if ("purchased" in body) patch.purchased = body.purchased
  if ("purchasedBy" in body) patch.purchased_by = body.purchasedBy
  if ("purchasedAt" in body) patch.purchased_at = body.purchasedAt

  const { error } = await sb
    .from("group_wishlist")
    .update(patch)
    .eq("id", itemId)
    .eq("group_id", groupId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
