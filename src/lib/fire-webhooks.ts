import { getSupabase } from "@/lib/supabase/server"

export async function fireWebhooks(uid: string, event: string, payload: object) {
  const supabase = getSupabase()
  const { data: webhooks } = await supabase
    .from("webhooks")
    .select("*")
    .eq("uid", uid)
    .eq("enabled", true)
    .contains("events", [event])

  if (!webhooks?.length) return

  await Promise.allSettled(webhooks.map(async (wh: Record<string, unknown>) => {
    const body = JSON.stringify({ event, payload, timestamp: new Date().toISOString() })
    const headers: Record<string, string> = { "Content-Type": "application/json" }
    if (wh.secret) headers["X-Webhook-Secret"] = wh.secret as string
    try {
      const res = await fetch(wh.url as string, { method: "POST", headers, body, signal: AbortSignal.timeout(5000) })
      await supabase.from("webhooks").update({ last_fired: new Date().toISOString(), last_status: res.status }).eq("id", wh.id)
    } catch {
      await supabase.from("webhooks").update({ last_fired: new Date().toISOString(), last_status: 0 }).eq("id", wh.id)
    }
  }))
}
