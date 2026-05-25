/**
 * GET  /api/expenses/[id]/comments  — List comments for an expense
 * POST /api/expenses/[id]/comments  — Add a comment to an expense
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

type Params = { params: Promise<{ id: string }> }

/** Verify that the expense exists and belongs to the authenticated user. */
async function verifyExpenseOwnership(expenseId: string, uid: string): Promise<boolean> {
  const sb = getSupabase()
  const { data } = await sb
    .from("expenses")
    .select("id")
    .eq("id", expenseId)
    .eq("uid", uid)
    .single()
  return !!data
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  const { id } = await params

  const isOwner = await verifyExpenseOwnership(id, uid)
  if (!isOwner) {
    return NextResponse.json({ error: "Gasto no encontrado" }, { status: 404 })
  }

  const sb = getSupabase()
  const { data, error } = await sb
    .from("expense_comments")
    .select("id, expense_id, uid, body, created_at")
    .eq("expense_id", id)
    .order("created_at", { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ comments: data ?? [] })
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  const { id } = await params

  const isOwner = await verifyExpenseOwnership(id, uid)
  if (!isOwner) {
    return NextResponse.json({ error: "Gasto no encontrado" }, { status: 404 })
  }

  let body: { body?: string }
  try {
    body = (await req.json()) as { body?: string }
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 })
  }

  const commentBody = typeof body.body === "string" ? body.body.trim() : ""
  if (!commentBody) {
    return NextResponse.json({ error: "El comentario no puede estar vacío" }, { status: 400 })
  }
  if (commentBody.length > 1000) {
    return NextResponse.json({ error: "El comentario es demasiado largo (máx. 1000 caracteres)" }, { status: 400 })
  }

  const sb = getSupabase()
  const { data, error } = await sb
    .from("expense_comments")
    .insert({ expense_id: id, uid, body: commentBody })
    .select("id, expense_id, uid, body, created_at")
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ comment: data }, { status: 201 })
}
