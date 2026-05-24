/**
 * GET    /api/projects/[id]           — Get project + its expenses
 * PATCH  /api/projects/[id]           — Update project
 * DELETE /api/projects/[id]           — Delete project (expenses lose project_id)
 */
import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth
  const { id } = await params

  const sb = getSupabase()
  const [projectResult, expensesResult] = await Promise.all([
    sb.from("projects").select(`*, clients!left(name)`).eq("id", id).eq("uid", uid).single(),
    sb.from("expenses").select("*").eq("uid", uid).eq("project_id", id).order("date", { ascending: false }),
  ])

  if (projectResult.error) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const row = projectResult.data as Record<string, unknown> & { clients?: { name: string } | null }
  const project = {
    id: row.id, name: row.name, clientId: row.client_id ?? null,
    clientName: row.clients?.name ?? null, description: row.description ?? null,
    budget: row.budget ? Number(row.budget) : null, currency: row.currency ?? "USD",
    status: row.status ?? "active", color: row.color ?? "#6366f1",
    createdAt: row.created_at, updatedAt: row.updated_at,
  }

  // Map expenses to camelCase
  const expenses = (expensesResult.data ?? []).map((e: Record<string, unknown>) => ({
    id:              e.id,
    account:         e.account,
    merchant:        e.merchant,
    date:            e.date,
    items:           e.items ?? [],
    subtotal:        Number(e.subtotal),
    tax:             Number(e.tax),
    total:           Number(e.total),
    paymentMethod:   e.payment_method ?? null,
    reference:       e.reference ?? null,
    category:        e.category,
    currency:        e.currency,
    notes:           e.notes ?? "",
    tags:            e.tags ?? [],
    receiptImageUrl: e.receipt_image_url ?? null,
    project:         e.project ?? null,
    projectId:       e.project_id ?? null,
    privacy:         e.privacy ?? "private",
    archived:        e.archived ?? false,
    flagged:         e.flagged ?? false,
    flaggedAt:       e.flagged_at ?? null,
    recurringId:     e.recurring_id ?? null,
    createdAt:       e.created_at,
    updatedAt:       e.updated_at,
    geo:             e.geo_lat != null
      ? { lat: Number(e.geo_lat), lng: Number(e.geo_lng), accuracy: e.geo_accuracy != null ? Number(e.geo_accuracy) : undefined }
      : undefined,
    cityName:    e.geo_city ?? null,
    countryCode: e.geo_country_code ?? null,
  }))

  return NextResponse.json({ project, expenses })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth
  const { id } = await params
  const body = await req.json() as Record<string, unknown>

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.name        !== undefined) updates.name        = body.name
  if (body.clientId    !== undefined) updates.client_id   = body.clientId
  if (body.description !== undefined) updates.description = body.description
  if (body.budget      !== undefined) updates.budget      = body.budget
  if (body.currency    !== undefined) updates.currency    = body.currency
  if (body.status      !== undefined) updates.status      = body.status
  if (body.color       !== undefined) updates.color       = body.color

  const { error } = await getSupabase().from("projects").update(updates).eq("id", id).eq("uid", uid)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth
  const { id } = await params

  // Unlink expenses first (set project_id to NULL)
  await getSupabase().from("expenses").update({ project_id: null }).eq("project_id", id).eq("uid", uid)
  const { error } = await getSupabase().from("projects").delete().eq("id", id).eq("uid", uid)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
