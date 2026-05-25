import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  const body = await req.json() as { projectId?: string; expiresInDays?: number }
  const { projectId, expiresInDays } = body

  if (!projectId) {
    return NextResponse.json({ error: "projectId es obligatorio" }, { status: 400 })
  }

  const sb = getSupabase()

  const { data: project, error: projectError } = await sb
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("uid", uid)
    .single()

  if (projectError || !project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 })
  }

  const days = typeof expiresInDays === "number" && expiresInDays > 0 ? expiresInDays : 30
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()

  const { data: share, error: insertError } = await sb
    .from("invoice_shares")
    .insert({ uid, project_id: projectId, expires_at: expiresAt })
    .select("token, expires_at")
    .single()

  if (insertError || !share) {
    return NextResponse.json({ error: "Error al crear el link" }, { status: 500 })
  }

  const origin = new URL(req.url).origin
  const shareUrl = `${origin}/share/invoice/${share.token}`

  return NextResponse.json({ token: share.token, shareUrl, expiresAt: share.expires_at })
}
