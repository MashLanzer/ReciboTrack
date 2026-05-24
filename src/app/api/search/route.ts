import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  const { searchParams } = new URL(req.url)
  const q = (searchParams.get("q") ?? "").trim()

  if (q.length < 2) {
    return NextResponse.json({ results: { expenses: [], clients: [], projects: [], recurring: [] }, total: 0 })
  }

  const [expenses, clients, projects, recurring] = await Promise.all([
    getSupabase()
      .from("expenses")
      .select("id, merchant, category, total, currency, date")
      .eq("uid", uid)
      .ilike("merchant", `%${q}%`)
      .order("date", { ascending: false })
      .limit(5),
    getSupabase()
      .from("clients")
      .select("id, name, email")
      .eq("uid", uid)
      .ilike("name", `%${q}%`)
      .limit(3),
    getSupabase()
      .from("projects")
      .select("id, name, status, color")
      .eq("uid", uid)
      .ilike("name", `%${q}%`)
      .limit(3),
    getSupabase()
      .from("recurring")
      .select("id, merchant, category, total, currency")
      .eq("uid", uid)
      .ilike("merchant", `%${q}%`)
      .limit(3),
  ])

  const expensesData = expenses.data ?? []
  const clientsData = clients.data ?? []
  const projectsData = projects.data ?? []
  const recurringData = recurring.data ?? []

  const total = expensesData.length + clientsData.length + projectsData.length + recurringData.length

  return NextResponse.json({
    results: {
      expenses: expensesData,
      clients: clientsData,
      projects: projectsData,
      recurring: recurringData,
    },
    total,
  })
}
