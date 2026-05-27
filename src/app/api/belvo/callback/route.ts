import { NextRequest, NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase/server"

export async function GET(req: NextRequest) {
  const sp       = req.nextUrl.searchParams
  const linkId   = sp.get("link")
  const uid      = sp.get("uid")
  const institution = sp.get("institution")
  const institutionName = sp.get("institution_name") ?? institution ?? "Banco"

  if (!linkId || !uid) {
    return NextResponse.redirect(new URL("/expenses?bank_error=missing_params", req.url))
  }

  const sb = getSupabase()

  // Save the connection
  await sb.from("bank_connections").upsert({
    uid,
    belvo_link_id: linkId,
    institution: institution ?? "unknown",
    institution_name: institutionName,
    status: "valid",
    last_synced_at: new Date().toISOString(),
  }, { onConflict: "belvo_link_id" })

  // Trigger initial transaction sync
  try {
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? "https://recibotrack.vercel.app"}/api/belvo/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid, linkId }),
    })
  } catch { /* non-fatal */ }

  return NextResponse.redirect(new URL("/expenses?bank_connected=1", req.url))
}
