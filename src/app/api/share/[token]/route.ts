/**
 * GET /api/share/[token]
 *
 * Endpoint público para visualizar el resumen de gastos compartido.
 * El token es un base64url con { uid, name, period } — sin firma criptográfica,
 * por lo que la "seguridad" es por oscuridad (solo quien tiene el enlace puede verlo).
 *
 * Devuelve los gastos del mes indicado para el uid del token.
 */

import { NextRequest, NextResponse } from "next/server"
import { Timestamp } from "firebase/firestore"
import { getSupabase } from "@/lib/supabase/server"
import { decodeShareToken } from "@/lib/share-token"
import type { Expense } from "@/types"

type Params = { params: Promise<{ token: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { token } = await params

  const payload = decodeShareToken(token)
  if (!payload) {
    return NextResponse.json({ error: "Token inválido" }, { status: 400 })
  }

  const { uid, period } = payload
  const [year, month] = period.split("-").map(Number)
  if (!year || !month) {
    return NextResponse.json({ error: "Período inválido" }, { status: 400 })
  }

  const start = new Date(year, month - 1, 1).toISOString()
  const end   = new Date(year, month, 0, 23, 59, 59, 999).toISOString()

  const { data: rows, error } = await getSupabase()
    .from("expenses")
    .select("*")
    .eq("uid", uid)
    .eq("archived", false)
    .gte("date", start)
    .lte("date", end)
    .order("date", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const expenses = (rows ?? []).map((row: Record<string, unknown>) => ({
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
    archived:       false,
    flagged:        row.flagged ?? false,
  })) as unknown as Expense[]

  return NextResponse.json(expenses)
}
