import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  const body = (await req.json()) as { projectId?: string; expiresInDays?: number }
  const { projectId, expiresInDays = 30 } = body

  if (!projectId) {
    return NextResponse.json({ error: "projectId requerido" }, { status: 400 })
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

  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + expiresInDays)

  const { data: share, error: insertError } = await sb
    .from("invoice_shares")
    .insert({ uid, project_id: projectId, expires_at: expiresAt.toISOString() })
    .select("token, expires_at")
    .single()

  if (insertError || !share) {
    return NextResponse.json({ error: insertError?.message ?? "Error al crear el enlace" }, { status: 500 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? `https://${req.headers.get("host")}`
  const shareUrl = `${baseUrl}/share/invoice/${share.token}`

  return NextResponse.json({ token: share.token, shareUrl, expiresAt: share.expires_at })
}
