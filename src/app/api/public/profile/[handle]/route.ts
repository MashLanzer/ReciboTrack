import { NextRequest, NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase/server"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  const { handle } = await params

  const { data, error } = await getSupabase()
    .from("profiles")
    .select("display_name, photo_url, handle, created_at")
    .ilike("handle", handle)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: "Perfil no encontrado" }, { status: 404 })
  }

  return NextResponse.json(data)
}
