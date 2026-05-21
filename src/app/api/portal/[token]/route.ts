/**
 * Public Portal API — no authentication required.
 * Returns expense data filtered by portal permissions.
 *
 * Security:
 *  - Token is 48-char hex (192 bits of entropy) — brute-force infeasible
 *  - Permissions are applied SERVER-SIDE — client never sees masked data
 *  - Expiry and revocation checked before returning any data
 *  - CORS restricted to same origin
 */

import { NextRequest, NextResponse } from "next/server"
import { Timestamp } from "firebase/firestore"
import { getSupabase } from "@/lib/supabase/server"
import {
  applyPortalPermissions,
  buildPortalSummary,
  type PortalPermissions,
} from "@/lib/portal-permissions"
import type { Expense } from "@/types"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params

  if (!token || token.length < 32) {
    return NextResponse.json({ error: "Token inválido" }, { status: 400 })
  }

  try {
    const sb = getSupabase()

    // ── Find portal by token ───────────────────────────────────────────────
    const { data: portalData, error: portalError } = await sb
      .from("portals")
      .select("*")
      .eq("token", token)
      .single()

    if (portalError?.code === "PGRST116" || !portalData) {
      return NextResponse.json({ error: "Portal no encontrado" }, { status: 404 })
    }
    if (portalError) {
      return NextResponse.json({ error: portalError.message }, { status: 500 })
    }

    const portal = portalData as Record<string, unknown>

    // ── Validate portal status ─────────────────────────────────────────────
    if (portal.revoked) {
      return NextResponse.json({ error: "Este portal ha sido revocado" }, { status: 403 })
    }

    if (portal.expires_at) {
      const expiresAt = new Date(portal.expires_at as string)
      if (expiresAt < new Date()) {
        return NextResponse.json({ error: "Este portal ha expirado" }, { status: 403 })
      }
    }

    const ownerUid    = portal.uid as string
    const permissions = portal.permissions as PortalPermissions

    // ── Fetch owner's expenses ─────────────────────────────────────────────
    const { data: expRows, error: expError } = await sb
      .from("expenses")
      .select("*")
      .eq("uid", ownerUid)
      .eq("archived", false)
      .order("date", { ascending: false })

    if (expError) {
      return NextResponse.json({ error: expError.message }, { status: 500 })
    }

    // Convert ISO dates to Timestamp so portal-permissions logic works unchanged
    const expenses = (expRows ?? []).map((row: Record<string, unknown>) => ({
      id:             row.id,
      account:        row.account,
      merchant:       row.merchant,
      date:           row.date ? Timestamp.fromDate(new Date(row.date as string)) : Timestamp.now(),
      items:          row.items ?? [],
      subtotal:       Number(row.subtotal),
      tax:            Number(row.tax),
      total:          Number(row.total),
      paymentMethod:  row.payment_method ?? null,
      reference:      row.reference ?? null,
      category:       row.category,
      currency:       row.currency,
      notes:          row.notes ?? "",
      tags:           row.tags ?? [],
      receiptImageUrl: row.receipt_image_url ?? null,
      project:        row.project ?? null,
      privacy:        row.privacy ?? "private",
      archived:       row.archived ?? false,
      flagged:        row.flagged ?? false,
      flaggedAt:      row.flagged_at ? Timestamp.fromDate(new Date(row.flagged_at as string)) : undefined,
      recurringId:    row.recurring_id ?? null,
      createdAt:      row.created_at ? Timestamp.fromDate(new Date(row.created_at as string)) : Timestamp.now(),
      updatedAt:      row.updated_at ? Timestamp.fromDate(new Date(row.updated_at as string)) : Timestamp.now(),
    })) as unknown as Expense[]

    // ── Apply permissions (server-side mask) ───────────────────────────────
    const maskedExpenses = applyPortalPermissions(expenses, permissions)
    const summary        = buildPortalSummary(expenses, permissions)

    // ── Track access (non-blocking) ────────────────────────────────────────
    void sb
      .from("portals")
      .update({
        last_accessed_at: new Date().toISOString(),
        access_count:     Number(portal.access_count ?? 0) + 1,
      })
      .eq("id", portal.id)
      .then(() => {/* non-critical */})

    return NextResponse.json({
      expenses:    maskedExpenses,
      summary,
      permissions,
      portalName:  portal.name as string,
      ownerName:   portal.owner_name as string,
      generatedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error("[portal API]", err)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
