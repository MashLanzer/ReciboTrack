import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 })
  }

  const { credentialId, publicKey, deviceName } = body as {
    credentialId?: string
    publicKey?: string
    deviceName?: string
  }

  if (!credentialId || !publicKey) {
    return NextResponse.json({ error: "credentialId y publicKey son requeridos" }, { status: 400 })
  }

  const { error } = await getSupabase()
    .from("passkeys")
    .upsert(
      {
        uid,
        credential_id: credentialId,
        public_key:    publicKey,
        counter:       0,
        device_name:   deviceName ?? "Dispositivo",
        created_at:    new Date().toISOString(),
      },
      { onConflict: "credential_id" }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
