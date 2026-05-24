import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

type Params = { params: Promise<{ id: string }> }

const TRACKED_FIELDS = ["merchant", "category", "total", "notes", "account", "currency"] as const
type TrackedField = typeof TRACKED_FIELDS[number]

// ── PATCH ─────────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth
  const { id } = await params

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 })
  }

  const supabase = getSupabase()

  const { data: current } = await supabase
    .from("expenses")
    .select("merchant, category, total, notes, account, currency")
    .eq("id", id)
    .eq("uid", uid)
    .single()

  const allowed: Record<string, string> = {
    merchant:        "merchant",
    date:            "date",
    items:           "items",
    subtotal:        "subtotal",
    tax:             "tax",
    total:           "total",
    paymentMethod:   "payment_method",
    reference:       "reference",
    category:        "category",
    currency:        "currency",
    notes:           "notes",
    tags:            "tags",
    receiptImageUrl: "receipt_image_url",
    account:         "account",
    project:         "project",
    privacy:         "privacy",
    archived:        "archived",
    flagged:         "flagged",
    flaggedAt:       "flagged_at",
    recurringId:     "recurring_id",
    cityName:        "geo_city",
    countryCode:     "geo_country_code",
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const [camel, snake] of Object.entries(allowed)) {
    if (camel in body) patch[snake] = body[camel]
  }
  if ("geo" in body) {
    const geo = body.geo as { lat?: number; lng?: number; accuracy?: number } | null
    patch.geo_lat      = geo?.lat ?? null
    patch.geo_lng      = geo?.lng ?? null
    patch.geo_accuracy = geo?.accuracy ?? null
  }

  const { error } = await supabase
    .from("expenses")
    .update(patch)
    .eq("id", id)
    .eq("uid", uid)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (current) {
    const historyRows = TRACKED_FIELDS
      .filter((field: TrackedField) => {
        const incoming = body[field]
        return incoming !== undefined && String(current[field] ?? "") !== String(incoming)
      })
      .map((field: TrackedField) => ({
        expense_id: id,
        uid,
        field,
        old_value: String(current[field] ?? ""),
        new_value: String(body[field] ?? ""),
      }))

    if (historyRows.length > 0) {
      await supabase.from("expense_history").insert(historyRows)
    }
  }

  return NextResponse.json({ ok: true })
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth
  const { id } = await params

  const { error } = await getSupabase()
    .from("expenses")
    .delete()
    .eq("id", id)
    .eq("uid", uid)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
