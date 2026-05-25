/**
 * GET  /api/categories  — Lista categorías del usuario (o DEFAULT si no tiene ninguna)
 * POST /api/categories  — Crea una nueva categoría
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

const DEFAULT_CATEGORIES = [
  { id: "combustible", name: "Combustible", icon: "⛽",  color: "#f97316", is_default: true },
  { id: "comida",      name: "Comida",      icon: "🍔",  color: "#eab308", is_default: true },
  { id: "supermercado",name: "Supermercado",icon: "🛒",  color: "#22c55e", is_default: true },
  { id: "transporte",  name: "Transporte",  icon: "🚗",  color: "#3b82f6", is_default: true },
  { id: "ocio",        name: "Ocio",        icon: "🎮",  color: "#a855f7", is_default: true },
  { id: "salud",       name: "Salud",       icon: "💊",  color: "#ef4444", is_default: true },
  { id: "hogar",       name: "Hogar",       icon: "🏠",  color: "#06b6d4", is_default: true },
  { id: "servicios",   name: "Servicios",   icon: "💡",  color: "#f59e0b", is_default: true },
  { id: "otros",       name: "Otros",       icon: "📦",  color: "#6b7280", is_default: true },
]

function rowToCategory(row: Record<string, unknown>) {
  return {
    id:        row.id,
    name:      row.name,
    icon:      row.icon ?? "",
    color:     row.color ?? "#6b7280",
    emoji:     row.emoji ?? null,
    isDefault: row.is_default ?? false,
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  const sb = getSupabase()
  const { data: rows, error } = await sb
    .from("categories")
    .select("*")
    .eq("uid", uid)
    .order("sort_order", { ascending: true })
    .order("name")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Si no tiene categorías, hacer upsert de las por defecto
  if (!rows || rows.length === 0) {
    const toInsert = DEFAULT_CATEGORIES.map(cat => ({
      id:         cat.id,           // mismo id string que en Firestore
      uid,
      name:       cat.name,
      icon:       cat.icon,
      color:      cat.color,
      is_default: cat.is_default,
      created_at: new Date().toISOString(),
    }))

    const { data: inserted, error: insErr } = await sb
      .from("categories")
      .upsert(toInsert, { onConflict: "id" })
      .select("*")

    if (insErr) {
      // Fallback: devolver las por defecto sin persistir
      return NextResponse.json(DEFAULT_CATEGORIES.map(c => ({
        id: c.id, name: c.name, icon: c.icon, color: c.color, isDefault: c.is_default, emoji: null,
      })))
    }

    return NextResponse.json((inserted ?? []).map(rowToCategory))
  }

  return NextResponse.json(rows.map(rowToCategory))
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 })
  }

  const { data, error } = await getSupabase()
    .from("categories")
    .insert({
      uid,
      name:       body.name,
      icon:       body.icon ?? null,
      color:      body.color ?? "#6b7280",
      emoji:      body.emoji ?? null,
      is_default: false,
      created_at: new Date().toISOString(),
    })
    .select("id")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ id: data?.id }, { status: 201 })
}
