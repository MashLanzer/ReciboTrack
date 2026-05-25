import { NextRequest, NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase/server"

type Params = { params: Promise<{ token: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { token } = await params
  const sb = getSupabase()

  const { data: share, error: shareError } = await sb
    .from("invoice_shares")
    .select("uid, project_id, expires_at")
    .eq("token", token)
    .single()

  if (shareError || !share) {
    return NextResponse.json({ error: "Factura expirada o no encontrada" }, { status: 410 })
  }

  if (share.expires_at && new Date(share.expires_at) < new Date()) {
    return NextResponse.json({ error: "Factura expirada o no encontrada" }, { status: 410 })
  }

  const [projectResult, expensesResult] = await Promise.all([
    sb
      .from("projects")
      .select(`*, clients!left(name, email, phone)`)
      .eq("id", share.project_id)
      .eq("uid", share.uid)
      .single(),
    sb
      .from("expenses")
      .select("*")
      .eq("uid", share.uid)
      .eq("project_id", share.project_id)
      .order("date", { ascending: false }),
  ])

  if (projectResult.error || !projectResult.data) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 })
  }

  const row = projectResult.data as Record<string, unknown> & {
    clients?: { name: string; email?: string | null; phone?: string | null } | null
  }

  const project = {
    id:          row.id,
    name:        row.name,
    clientId:    row.client_id ?? null,
    clientName:  row.clients?.name ?? null,
    clientEmail: row.clients?.email ?? null,
    clientPhone: row.clients?.phone ?? null,
    description: row.description ?? null,
    budget:      row.budget ? Number(row.budget) : null,
    currency:    row.currency ?? "USD",
    status:      row.status ?? "active",
    color:       row.color ?? "#6366f1",
    createdAt:   row.created_at,
    updatedAt:   row.updated_at,
  }

  const client = project.clientName
    ? { name: project.clientName, email: project.clientEmail, phone: project.clientPhone }
    : null

  const expenses = (expensesResult.data ?? []).map((e: Record<string, unknown>) => ({
    id:            e.id,
    merchant:      e.merchant,
    date:          e.date,
    items:         e.items ?? [],
    subtotal:      Number(e.subtotal),
    tax:           Number(e.tax),
    total:         Number(e.total),
    paymentMethod: e.payment_method ?? null,
    reference:     e.reference ?? null,
    category:      e.category,
    currency:      e.currency,
    notes:         e.notes ?? "",
    tags:          e.tags ?? [],
    createdAt:     e.created_at,
    updatedAt:     e.updated_at,
  }))

  return NextResponse.json({ project, client, expenses })
}
