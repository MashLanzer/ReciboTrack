/**
 * GET  /api/projects  — List user's projects
 * POST /api/projects  — Create a new project
 */
import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

function rowToProject(row: Record<string, unknown>) {
  return {
    id:          row.id,
    name:        row.name,
    clientId:    row.client_id ?? null,
    clientName:  row.client_name ?? null,  // from join
    description: row.description ?? null,
    budget:      row.budget ? Number(row.budget) : null,
    currency:    row.currency ?? "USD",
    status:      row.status ?? "active",
    color:       row.color ?? "#6366f1",
    createdAt:   row.created_at,
    updatedAt:   row.updated_at,
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  const status = req.nextUrl.searchParams.get("status")  // "active", "archived", "all"

  let q = getSupabase()
    .from("projects")
    .select(`*, clients!left(name)`)
    .eq("uid", uid)
    .order("created_at", { ascending: false })

  if (status && status !== "all") {
    q = q.eq("status", status)
  } else if (!status) {
    q = q.neq("status", "archived")
  }

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(
    (data ?? []).map(row => rowToProject({
      ...row,
      client_name: (row as Record<string, unknown> & { clients?: { name: string } | null }).clients?.name ?? null,
    }))
  )
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  const body = await req.json() as Record<string, unknown>

  const { data, error } = await getSupabase()
    .from("projects")
    .insert({
      uid,
      name:        body.name,
      client_id:   body.clientId ?? null,
      description: body.description ?? null,
      budget:      body.budget ?? null,
      currency:    body.currency ?? "USD",
      status:      body.status ?? "active",
      color:       body.color ?? "#6366f1",
    })
    .select("id").single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id }, { status: 201 })
}
