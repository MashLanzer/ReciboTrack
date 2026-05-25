import { NextRequest, NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase/server"

type Params = { params: Promise<{ token: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { token } = await params
  const sb = getSupabase()

  const { data: share, error: shareError } = await sb
    .from("invoice_shares")
    .select("project_id, expires_at")
    .eq("token", token)
    .single()

  if (shareError || !share) {
    return NextResponse.json({ error: "Enlace no encontrado" }, { status: 404 })
  }

  if (share.expires_at && new Date(share.expires_at) < new Date()) {
    return NextResponse.json({ error: "El enlace ha expirado" }, { status: 410 })
  }

  const projectId = share.project_id as string

  const [projectResult, expensesResult] = await Promise.all([
    sb.from("projects").select(`*, clients!left(name)`).eq("id", projectId).single(),
    sb.from("expenses").select("*").eq("project_id", projectId).order("date", { ascending: false }),
  ])

  if (projectResult.error) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 })
  }

  const row = projectResult.data as Record<string, unknown> & { clients?: { name: string } | null }
  const project = {
    id: row.id, name: row.name, clientId: row.client_id ?? null,
    clientName: row.clients?.name ?? null, description: row.description ?? null,
    budget: row.budget ? Number(row.budget) : null, currency: row.currency ?? "USD",
    status: row.status ?? "active", color: row.color ?? "#6366f1",
    createdAt: row.created_at, updatedAt: row.updated_at,
  }

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
