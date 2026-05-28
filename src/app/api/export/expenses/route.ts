import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"
import { requirePro } from "@/lib/plan"

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return ""
  const str = String(value)
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function rowToCsvLine(row: Record<string, unknown>): string {
  const tags = Array.isArray(row.tags) ? (row.tags as string[]).join("; ") : ""
  const fields = [
    row.date,
    row.merchant,
    row.category,
    row.total,
    row.currency,
    row.account,
    row.notes,
    tags,
  ]
  return fields.map(escapeCsv).join(",")
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  // Solo Pro y Premium pueden exportar
  try { await requirePro(uid) }
  catch {
    return NextResponse.json(
      { error: "La exportación CSV requiere el plan Pro. Actualiza en /pricing.", upgrade: "/pricing" },
      { status: 402 },
    )
  }

  const sp = req.nextUrl.searchParams
  const category  = sp.get("category")
  const account   = sp.get("account")
  const startDate = sp.get("startDate")
  const endDate   = sp.get("endDate")

  const sb = getSupabase()
  let q = sb
    .from("expenses")
    .select("date, merchant, category, total, currency, account, notes, tags")
    .eq("uid", uid)
    .eq("archived", false)
    .order("date", { ascending: false })

  if (category)               q = q.eq("category", category)
  if (account && account !== "all") q = q.eq("account", account)
  if (startDate)              q = q.gte("date", startDate)
  if (endDate)                q = q.lte("date", endDate)

  const { data: rows, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const header = "Fecha,Comerciante,Categoría,Total,Moneda,Cuenta,Notas,Etiquetas"
  const lines = (rows ?? []).map(row => rowToCsvLine(row as Record<string, unknown>))
  const csv = [header, ...lines].join("\n")

  const date = new Date().toISOString().slice(0, 10)
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="gastos-${date}.csv"`,
    },
  })
}
