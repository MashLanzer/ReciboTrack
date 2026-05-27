/**
 * GET  /api/workspaces  — Lista espacios que el usuario posee o a los que pertenece
 * POST /api/workspaces  — Crea un nuevo espacio compartido
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"
import { getUserPlan, PLAN_LIMITS } from "@/lib/plan"

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  const sb = getSupabase()

  // Espacios que el usuario posee
  const { data: owned, error: ownedError } = await sb
    .from("workspaces")
    .select("*, workspace_members(count)")
    .eq("owner_uid", uid)
    .order("created_at", { ascending: false })

  if (ownedError) return NextResponse.json({ error: ownedError.message }, { status: 500 })

  // Espacios de los que es miembro (pero no propietario)
  const { data: memberRows, error: memberError } = await sb
    .from("workspace_members")
    .select("workspace_id, workspaces(*)")
    .eq("uid", uid)
    .neq("workspaces.owner_uid", uid)

  if (memberError) return NextResponse.json({ error: memberError.message }, { status: 500 })

  const memberOf = (memberRows ?? [])
    .map((r) => Array.isArray(r.workspaces) ? r.workspaces[0] : r.workspaces)
    .filter(Boolean)

  const ownedFormatted = (owned ?? []).map((w) => ({
    ...w,
    memberCount: (w.workspace_members as unknown as { count: number }[])?.[0]?.count ?? 0,
    role: "owner",
  }))

  const memberFormatted = (memberOf as Record<string, unknown>[]).map((w) => ({
    ...w,
    memberCount: 0,
    role: "member",
  }))

  return NextResponse.json({ workspaces: [...ownedFormatted, ...memberFormatted] })
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  let body: { name?: string }
  try {
    body = (await req.json()) as { name?: string }
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 })
  }

  const name = body.name?.trim()
  if (!name) return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 })

  const sb = getSupabase()

  // Enforce el límite de workspaces según el plan
  const userPlan = await getUserPlan(uid)
  const maxWorkspaces = PLAN_LIMITS[userPlan].maxWorkspaces
  if (Number.isFinite(maxWorkspaces)) {
    const { count } = await sb
      .from("workspaces")
      .select("*", { count: "exact", head: true })
      .eq("owner_uid", uid)
    if ((count ?? 0) >= maxWorkspaces) {
      const upsell = userPlan === "free"
        ? "Actualiza a Pro para crear hasta 3 workspaces o Premium para ilimitados."
        : "Actualiza a Premium para workspaces ilimitados."
      return NextResponse.json(
        {
          error:   `Has alcanzado el límite de ${maxWorkspaces} workspaces del plan ${userPlan}. ${upsell}`,
          upgrade: "/pricing",
          limit:   maxWorkspaces,
        },
        { status: 402 },
      )
    }
  }

  // Crear el espacio
  const { data: workspace, error: wsError } = await sb
    .from("workspaces")
    .insert({ name, owner_uid: uid })
    .select("*")
    .single()

  if (wsError) return NextResponse.json({ error: wsError.message }, { status: 500 })

  // Añadir al propietario como miembro con rol "owner"
  const { error: memberError } = await sb
    .from("workspace_members")
    .insert({ workspace_id: workspace.id, uid, role: "owner" })

  if (memberError) {
    // Rollback: eliminar el espacio si no se pudo insertar el miembro
    await sb.from("workspaces").delete().eq("id", workspace.id)
    return NextResponse.json({ error: memberError.message }, { status: 500 })
  }

  return NextResponse.json({ workspace }, { status: 201 })
}
