/**
 * migrate-firestore-to-supabase.ts
 *
 * Migra todos los datos de Firestore a Supabase PostgreSQL.
 * Usa upsert para que sea idempotente (se puede correr múltiples veces sin duplicar).
 *
 * Requisitos:
 *   - FIREBASE_SERVICE_ACCOUNT_JSON en .env.local (JSON del service account de Firebase)
 *   - SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local
 *
 * Uso:
 *   npx tsx scripts/migrate-firestore-to-supabase.ts             # migración real
 *   npx tsx scripts/migrate-firestore-to-supabase.ts --dry-run   # solo contar registros
 *   npx tsx scripts/migrate-firestore-to-supabase.ts --only expenses,categories
 */

import * as fs from "node:fs"
import * as path from "node:path"
import * as crypto from "node:crypto"
import * as admin from "firebase-admin"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

// ── Cargar .env.local ──────────────────────────────────────────────────────────

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env.local")
  if (!fs.existsSync(envPath)) {
    throw new Error(".env.local no encontrado. Ejecuta el script desde la raíz del proyecto.")
  }
  const content = fs.readFileSync(envPath, "utf-8")
  for (const line of content.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eqIdx = trimmed.indexOf("=")
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "")
    if (!process.env[key]) process.env[key] = value
  }
}

// ── Init clientes ──────────────────────────────────────────────────────────────

function initFirebase(): admin.firestore.Firestore {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (!json) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON no configurado en .env.local")
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(json)) })
  }
  return admin.firestore()
}

function initSupabase(): SupabaseClient {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no configurados")
  return createClient(url, key, { auth: { persistSession: false } })
}

// ── Conversión de IDs Firestore → UUID determinístico ─────────────────────────
// Firestore usa strings aleatorios; Supabase espera UUID.
// Usamos SHA-1 del ID original formateado como UUID v5 (determinístico e idempotente).

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function toUUID(firestoreId: string): string {
  if (UUID_RE.test(firestoreId)) return firestoreId.toLowerCase()
  // SHA-1 → 40 hex chars → tomar 32 → formatear como UUID v4
  const hash = crypto.createHash("sha1").update(`recibotrack:${firestoreId}`).digest("hex")
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    "4" + hash.slice(13, 16),        // version 4
    ((parseInt(hash[16], 16) & 0x3) | 0x8).toString(16) + hash.slice(17, 20), // variant
    hash.slice(20, 32),
  ].join("-")
}

// Mantiene un mapeo firestoreId → uuid para referencias cruzadas
const idMap = new Map<string, string>()
function mapId(firestoreId: string): string {
  if (!idMap.has(firestoreId)) idMap.set(firestoreId, toUUID(firestoreId))
  return idMap.get(firestoreId)!
}

// ── Helpers de transformación ──────────────────────────────────────────────────

function tsToIso(val: unknown): string | null {
  if (!val) return null
  if (val instanceof admin.firestore.Timestamp) return val.toDate().toISOString()
  if (val instanceof Date) return val.toISOString()
  if (typeof val === "string") return val
  return null
}

function tsToDate(val: unknown): string | null {
  const iso = tsToIso(val)
  return iso ? iso.slice(0, 10) : null
}

function arr(val: unknown): string[] {
  if (Array.isArray(val)) return val as string[]
  return []
}

function num(val: unknown, fallback = 0): number {
  const n = Number(val)
  return isNaN(n) ? fallback : n
}

function bool(val: unknown, fallback = false): boolean {
  if (typeof val === "boolean") return val
  return fallback
}

// ── Contadores ─────────────────────────────────────────────────────────────────

const counts: Record<string, number> = {}
function inc(table: string, n = 1) { counts[table] = (counts[table] ?? 0) + n }

// ── Upsert helper ──────────────────────────────────────────────────────────────

async function upsert(sb: SupabaseClient, table: string, rows: Record<string, unknown>[], dry: boolean) {
  if (rows.length === 0) return
  inc(table, rows.length)
  if (dry) return
  const { error } = await sb.from(table).upsert(rows, { onConflict: "id" })
  if (error) console.error(`  ✗ ${table}:`, error.message)
}

async function upsertPk(sb: SupabaseClient, table: string, rows: Record<string, unknown>[], pk: string, dry: boolean) {
  if (rows.length === 0) return
  inc(table, rows.length)
  if (dry) return
  const { error } = await sb.from(table).upsert(rows, { onConflict: pk })
  if (error) console.error(`  ✗ ${table}:`, error.message)
}

// ── Migración por colección ────────────────────────────────────────────────────

async function migrateUserDirectory(db: admin.firestore.Firestore, sb: SupabaseClient, dry: boolean) {
  console.log("  → user_directory")
  const snap = await db.collection("userDirectory").get()
  const rows = snap.docs.map((d) => {
    const data = d.data()
    return {
      email:        d.id,
      uid:          data.uid ?? "",
      display_name: data.displayName ?? null,
      photo_url:    data.photoURL ?? null,
      updated_at:   tsToIso(data.updatedAt) ?? new Date().toISOString(),
    }
  })
  await upsertPk(sb, "user_directory", rows, "email", dry)
}

async function migrateProfile(uid: string, data: Record<string, unknown>, sb: SupabaseClient, dry: boolean) {
  const row = {
    uid,
    display_name:      data.displayName ?? null,
    email:             data.email ?? null,
    photo_url:         data.photoURL ?? null,
    default_currency:  data.defaultCurrency ?? "USD",
    ui_prefs:          (data.uiPrefs as object) ?? {},
    webhook_url:       data.webhookUrl ?? null,
    webhook_events:    arr(data.webhookEvents),
    created_at:        tsToIso(data.createdAt) ?? new Date().toISOString(),
    updated_at:        tsToIso(data.updatedAt) ?? new Date().toISOString(),
  }
  await upsertPk(sb, "profiles", [row], "uid", dry)
}

async function migrateExpenses(uid: string, db: admin.firestore.Firestore, sb: SupabaseClient, dry: boolean) {
  const snap = await db.collection(`users/${uid}/expenses`).get()
  const rows = snap.docs.map((d) => {
    const e = d.data()
    return {
      id:                mapId(d.id),
      uid,
      account:           e.account ?? "personal",
      merchant:          e.merchant ?? "",
      date:              tsToIso(e.date) ?? new Date().toISOString(),
      items:             (e.items as object[]) ?? [],
      subtotal:          num(e.subtotal),
      tax:               num(e.tax),
      total:             num(e.total),
      payment_method:    e.paymentMethod ?? null,
      reference:         e.reference ?? null,
      category:          e.category ?? "otros",
      currency:          e.currency ?? "USD",
      notes:             e.notes ?? "",
      tags:              arr(e.tags),
      receipt_image_url: e.receiptImageUrl ?? null,
      project:           e.project ?? null,
      privacy:           e.privacy ?? "private",
      archived:          bool(e.archived),
      flagged:           bool(e.flagged),
      flagged_at:        tsToIso(e.flaggedAt),
      recurring_id:      e.recurringId ?? null,
      // Geo
      geo_lat:           e.geo?.lat ?? null,
      geo_lng:           e.geo?.lng ?? null,
      geo_accuracy:      e.geo?.accuracy ?? null,
      geo_city:          e.cityName ?? null,
      geo_country_code:  e.countryCode ?? null,
      created_at:        tsToIso(e.createdAt) ?? new Date().toISOString(),
      updated_at:        tsToIso(e.updatedAt) ?? new Date().toISOString(),
    }
  })
  await upsert(sb, "expenses", rows, dry)
}

async function migrateCategories(uid: string, db: admin.firestore.Firestore, sb: SupabaseClient, dry: boolean) {
  const snap = await db.collection(`users/${uid}/categories`).get()
  const rows = snap.docs.map((d) => {
    const c = d.data()
    return {
      id:         d.id,   // slug TEXT (ej: "combustible") — no UUID
      uid,
      name:       c.name ?? "",
      icon:       c.icon ?? null,
      color:      c.color ?? null,
      emoji:      c.emoji ?? null,
      is_default: bool(c.isDefault),
      created_at: tsToIso(c.createdAt) ?? new Date().toISOString(),
    }
  })
  await upsert(sb, "categories", rows, dry)
}

async function migrateBudgets(uid: string, db: admin.firestore.Firestore, sb: SupabaseClient, dry: boolean) {
  const snap = await db.collection(`users/${uid}/budgets`).get()
  const rows = snap.docs.map((d) => {
    const b = d.data()
    return {
      id:            mapId(d.id),
      uid,
      category_id:   b.categoryId ?? b.category ?? "",
      monthly_limit: num(b.monthlyLimit ?? b.limit),
      currency:      b.currency ?? "USD",
      created_at:    tsToIso(b.createdAt) ?? new Date().toISOString(),
    }
  })
  await upsert(sb, "budgets", rows, dry)
}

async function migrateRecurring(uid: string, db: admin.firestore.Firestore, sb: SupabaseClient, dry: boolean) {
  const snap = await db.collection(`users/${uid}/recurring`).get()
  const rows = snap.docs.map((d) => {
    const r = d.data()
    return {
      id:                      mapId(d.id),
      uid,
      merchant:                r.merchant ?? "",
      category:                r.category ?? null,
      subtotal:                num(r.subtotal),
      tax:                     num(r.tax),
      total:                   num(r.total),
      payment_method:          r.paymentMethod ?? null,
      currency:                r.currency ?? "USD",
      notes:                   r.notes ?? "",
      tags:                    arr(r.tags),
      frequency:               r.frequency ?? "monthly",
      next_due_date:           tsToDate(r.nextDueDate),
      active:                  bool(r.active, true),
      notified_on:             tsToDate(r.notifiedOn),
      last_linked_expense_id:  r.lastLinkedExpenseId ?? null,
      last_linked_at:          tsToIso(r.lastLinkedAt),
      created_at:              tsToIso(r.createdAt) ?? new Date().toISOString(),
    }
  })
  await upsert(sb, "recurring", rows, dry)
}

async function migrateGoals(uid: string, db: admin.firestore.Firestore, sb: SupabaseClient, dry: boolean) {
  const snap = await db.collection(`users/${uid}/goals`).get()
  const rows = snap.docs.map((d) => {
    const g = d.data()
    return {
      id:             mapId(d.id),
      uid,
      type:           g.type ?? "saving",
      name:           g.name ?? "",
      target_amount:  num(g.targetAmount),
      current_amount: num(g.currentAmount),
      currency:       g.currency ?? "USD",
      deadline:       tsToDate(g.deadline),
      is_active:      bool(g.isActive, true),
      created_at:     tsToIso(g.createdAt) ?? new Date().toISOString(),
    }
  })
  await upsert(sb, "goals", rows, dry)
}

async function migrateTravelBudgets(uid: string, db: admin.firestore.Firestore, sb: SupabaseClient, dry: boolean) {
  const snap = await db.collection(`users/${uid}/travelBudgets`).get()
  const rows = snap.docs.map((d) => {
    const t = d.data()
    return {
      id:          mapId(d.id),
      uid,
      name:        t.name ?? "",
      emoji:       t.emoji ?? null,
      total_limit: num(t.totalLimit ?? t.budget),
      currency:    t.currency ?? "USD",
      start_date:  tsToDate(t.startDate) ?? new Date().toISOString().slice(0,10),
      end_date:    tsToDate(t.endDate) ?? new Date().toISOString().slice(0,10),
      tags:        arr(t.tags),
      created_at:  tsToIso(t.createdAt) ?? new Date().toISOString(),
    }
  })
  await upsert(sb, "travel_budgets", rows, dry)
}

async function migrateIncome(uid: string, db: admin.firestore.Firestore, sb: SupabaseClient, dry: boolean) {
  const snap = await db.collection(`users/${uid}/income`).get()
  const rows = snap.docs.map((d) => {
    const i = d.data()
    return {
      id:         mapId(d.id),
      uid,
      date:       tsToDate(i.date) ?? new Date().toISOString().slice(0,10),
      category:   i.category ?? null,
      amount:     num(i.amount),
      source:     i.source ?? null,
      notes:      i.notes ?? null,
      recurring:  bool(i.recurring),
      created_at: tsToIso(i.createdAt) ?? new Date().toISOString(),
    }
  })
  await upsert(sb, "income", rows, dry)
}

async function migrateTrustedCircle(uid: string, db: admin.firestore.Firestore, sb: SupabaseClient, dry: boolean) {
  const snap = await db.collection(`users/${uid}/trustedCircle`).get()
  const rows = snap.docs.map((d) => {
    const m = d.data()
    return {
      id:                  mapId(d.id),
      owner_uid:           uid,
      member_uid:          m.memberUid ?? null,
      email:               m.email ?? "",
      display_name:        m.displayName ?? null,
      can_see_full_budget: bool(m.canSeeFullBudget),
      linked:              bool(m.linked),
      added_at:            tsToIso(m.addedAt) ?? new Date().toISOString(),
    }
  })
  await upsert(sb, "trusted_circle", rows, dry)
}

async function migrateQuickExpenses(uid: string, db: admin.firestore.Firestore, sb: SupabaseClient, dry: boolean) {
  const snap = await db.collection(`users/${uid}/quickExpenses`).get()
  const rows = snap.docs.map((d) => {
    const q = d.data()
    return {
      id:             mapId(d.id),
      uid,
      label:          q.label ?? "",
      merchant:       q.merchant ?? null,
      amount:         num(q.amount),
      category:       q.category ?? null,
      currency:       q.currency ?? "USD",
      payment_method: q.paymentMethod ?? null,
      tags:           arr(q.tags),
      icon:           q.icon ?? null,
      sort_order:     num(q.order ?? q.sortOrder),
      created_at:     tsToIso(q.createdAt) ?? new Date().toISOString(),
    }
  })
  await upsert(sb, "quick_expenses", rows, dry)
}

async function migrateCategoryRules(uid: string, db: admin.firestore.Firestore, sb: SupabaseClient, dry: boolean) {
  const snap = await db.collection(`users/${uid}/categoryRules`).get()
  const rows = snap.docs.map((d) => {
    const r = d.data()
    return {
      id:          mapId(d.id),
      uid,
      name:        r.name ?? null,
      field:       r.field ?? "merchant",
      operator:    r.operator ?? "contains",
      value:       r.value ?? "",
      category_id: r.categoryId ?? r.category ?? "",
      sort_order:  num(r.order ?? r.sortOrder),
      enabled:     bool(r.enabled, true),
      created_at:  tsToIso(r.createdAt) ?? new Date().toISOString(),
    }
  })
  await upsert(sb, "category_rules", rows, dry)
}

async function migrateClients(uid: string, db: admin.firestore.Firestore, sb: SupabaseClient, dry: boolean) {
  const snap = await db.collection(`users/${uid}/clients`).get()
  const rows = snap.docs.map((d) => {
    const c = d.data()
    return {
      id:         mapId(d.id),
      uid,
      name:       c.name ?? "",
      email:      c.email ?? null,
      phone:      c.phone ?? null,
      notes:      c.notes ?? null,
      color:      c.color ?? null,
      is_active:  bool(c.isActive, true),
      created_at: tsToIso(c.createdAt) ?? new Date().toISOString(),
    }
  })
  await upsert(sb, "clients", rows, dry)
}

async function migrateTemplates(uid: string, db: admin.firestore.Firestore, sb: SupabaseClient, dry: boolean) {
  const snap = await db.collection(`users/${uid}/templates`).get()
  const rows = snap.docs.map((d) => {
    const t = d.data()
    return {
      id:             mapId(d.id),
      uid,
      merchant:       t.merchant ?? "",
      category:       t.category ?? null,
      subtotal:       num(t.subtotal),
      tax:            num(t.tax),
      total:          num(t.total),
      payment_method: t.paymentMethod ?? null,
      currency:       t.currency ?? "USD",
      notes:          t.notes ?? "",
      tags:           arr(t.tags),
      use_count:      num(t.useCount),
      created_at:     tsToIso(t.createdAt) ?? new Date().toISOString(),
    }
  })
  await upsert(sb, "templates", rows, dry)
}

async function migrateAutomations(uid: string, db: admin.firestore.Firestore, sb: SupabaseClient, dry: boolean) {
  const snap = await db.collection(`users/${uid}/automations`).get()
  const rows = snap.docs.map((d) => {
    const a = d.data()
    return {
      id:               mapId(d.id),
      uid,
      name:             a.name ?? "",
      enabled:          bool(a.enabled, true),
      trigger:          a.trigger ?? "expense_over",
      trigger_value:    num(a.triggerValue),
      trigger_category: a.triggerCategory ?? null,
      action:           a.action ?? "notification",
      action_value:     a.actionValue ?? null,
      last_fired_at:    tsToIso(a.lastFiredAt),
      created_at:       tsToIso(a.createdAt) ?? new Date().toISOString(),
    }
  })
  await upsert(sb, "automations", rows, dry)
}

async function migratePortals(uid: string, db: admin.firestore.Firestore, sb: SupabaseClient, dry: boolean) {
  const snap = await db.collection(`users/${uid}/portals`).get()
  const rows = snap.docs.map((d) => {
    const p = d.data()
    return {
      id:           mapId(d.id),
      uid,
      token:        p.token ?? d.id,
      name:         p.name ?? null,
      // Schema migración 002: permissions JSONB (fusiona categories + maskAmounts + hideDates)
      role:         p.role ?? "custom",
      permissions:  p.permissions ?? {
        categories:  arr(p.categories),
        maskAmounts: bool(p.maskAmounts),
        hideDates:   bool(p.hideDates),
      },
      revoked:          bool(p.revoked),
      last_accessed_at: tsToIso(p.lastAccessedAt),
      target_label:     p.targetLabel ?? "",
      owner_name:       p.ownerName ?? "",
      expires_at:       tsToIso(p.expiresAt),
      access_count:     num(p.accessCount),
      created_at:       tsToIso(p.createdAt) ?? new Date().toISOString(),
    }
  })
  await upsert(sb, "portals", rows, dry)
}

async function migrateUserMeta(uid: string, db: admin.firestore.Firestore, sb: SupabaseClient, dry: boolean) {
  // Settings
  try {
    const settingsDoc = await db.doc(`users/${uid}/meta/settings`).get()
    if (settingsDoc.exists) {
      const row = { uid, data: settingsDoc.data() ?? {} }
      await upsertPk(sb, "user_settings", [row], "uid", dry)
    }
  } catch { /* meta/settings no existe */ }

  // Push subscription
  try {
    const pushDoc = await db.doc(`users/${uid}/meta/pushSub`).get()
    if (pushDoc.exists) {
      const p = pushDoc.data()!
      const row = {
        uid,
        endpoint:        p.endpoint ?? "",
        p256dh:          p.p256dh ?? null,
        auth_key:        p.auth ?? null,
        expiration_time: p.expirationTime ?? null,
      }
      await upsertPk(sb, "push_subscriptions", [row], "uid", dry)
    }
  } catch { /* no existe */ }

  // Pinned items
  try {
    const pinnedDoc = await db.doc(`users/${uid}/pinnedItems/main`).get()
    if (pinnedDoc.exists) {
      const row = { uid, items: pinnedDoc.data()?.items ?? [] }
      await upsertPk(sb, "pinned_items", [row], "uid", dry)
    }
  } catch { /* no existe */ }

  // Starred
  try {
    const starredDoc = await db.doc(`users/${uid}/starred/main`).get()
    if (starredDoc.exists) {
      const s = starredDoc.data()!
      const row = { uid, categories: arr(s.categories), merchants: arr(s.merchants) }
      await upsertPk(sb, "starred", [row], "uid", dry)
    }
  } catch { /* no existe */ }

  // Watchlist
  try {
    const watchDoc = await db.doc(`users/${uid}/meta/watchlist`).get()
    if (watchDoc.exists) {
      const row = { uid, categories: watchDoc.data()?.categories ?? [] }
      await upsertPk(sb, "watchlist", [row], "uid", dry)
    }
  } catch { /* no existe */ }
}

async function migrateIncomeCat(uid: string, db: admin.firestore.Firestore, sb: SupabaseClient, dry: boolean) {
  const snap = await db.collection(`users/${uid}/incomeCategories`).get()
  const rows = snap.docs.map((d) => {
    const c = d.data()
    return {
      id:         d.id,   // slug TEXT
      uid,
      name:       c.name ?? "",
      emoji:      c.emoji ?? null,
      color:      c.color ?? null,
      created_at: tsToIso(c.createdAt) ?? new Date().toISOString(),
    }
  })
  await upsert(sb, "income_categories", rows, dry)
}

async function migrateCategoryBudgets(uid: string, db: admin.firestore.Firestore, sb: SupabaseClient, dry: boolean) {
  const snap = await db.collection(`users/${uid}/categoryBudgets`).get()
  const rows = snap.docs.map((d) => {
    const b = d.data()
    const key = d.id // formato: YYYY-MM_categoryId
    const parts = key.split("_")
    return {
      uid,
      budget_key:   key,
      category_id:  parts.slice(1).join("_") || b.categoryId || "",
      month:        parts[0] ?? "",
      limit_amount: num(b.limit ?? b.limitAmount),
      currency:     b.currency ?? "USD",
    }
  })
  if (rows.length === 0) return
  inc("category_budgets", rows.length)
  if (dry) return
  const { error } = await sb.from("category_budgets").upsert(rows, { onConflict: "uid,budget_key" })
  if (error) console.error("  ✗ category_budgets:", error.message)
}

async function migrateEntities(uid: string, db: admin.firestore.Firestore, sb: SupabaseClient, dry: boolean) {
  const snap = await db.collection(`users/${uid}/entities`).get()
  const rows = snap.docs.map((d) => {
    const e = d.data()
    return {
      id:          mapId(d.id),
      uid,
      type:        e.type ?? "merchant",
      name:        e.name ?? "",
      emoji:       e.emoji ?? null,
      color:       e.color ?? null,
      metadata:    (e.metadata as object) ?? {},
      total_spend: num(e.totalSpend),
      occurrences: num(e.occurrences),
      created_at:  tsToIso(e.createdAt) ?? new Date().toISOString(),
    }
  })
  await upsert(sb, "entities", rows, dry)
}

async function migrateEntityEdges(uid: string, db: admin.firestore.Firestore, sb: SupabaseClient, dry: boolean) {
  const snap = await db.collection(`users/${uid}/entityEdges`).get()
  const rows = snap.docs.map((d) => {
    const e = d.data()
    return {
      id:         mapId(d.id),
      uid,
      from_id:    e.fromId ?? "",
      to_id:      e.toId ?? "",
      type:       e.type ?? null,
      expense_id: e.expenseId ?? null,
      weight:     num(e.weight),
      created_at: tsToIso(e.createdAt) ?? new Date().toISOString(),
    }
  })
  await upsert(sb, "entity_edges", rows, dry)
}

// ── Grupos ────────────────────────────────────────────────────────────────────

async function migrateGroups(db: admin.firestore.Firestore, sb: SupabaseClient, dry: boolean) {
  console.log("  → groups (colección raíz)")
  const snap = await db.collection("groups").get()

  for (const d of snap.docs) {
    const g = d.data()
    const groupRow = {
      id:          mapId(d.id),
      name:        g.name ?? "",
      emoji:       g.emoji ?? null,
      currency:    g.currency ?? "USD",
      invite_code: g.inviteCode ?? null,
      members:     (g.members as object[]) ?? [],
      created_by:  g.createdBy ?? "",
      created_at:  tsToIso(g.createdAt) ?? new Date().toISOString(),
    }
    if (!dry) {
      const { error } = await sb.from("groups").upsert([groupRow], { onConflict: "id" })
      if (error) { console.error(`  ✗ groups[${d.id}]:`, error.message); continue }
    }
    inc("groups")

    // Gastos del grupo
    const expSnap = await db.collection(`groups/${d.id}/expenses`).get()
    const expRows = expSnap.docs.map((ed) => {
      const e = ed.data()
      return {
        id:                mapId(ed.id),
        group_id:          mapId(d.id),
        paid_by:           e.paidBy ?? "",
        merchant:          e.merchant ?? "",
        total:             num(e.total),
        currency:          e.currency ?? "USD",
        category:          e.category ?? null,
        split_type:        e.splitType ?? "equal",
        participants:      (e.participants as object[]) ?? [],
        date:              tsToIso(e.date) ?? new Date().toISOString(),
        notes:             e.notes ?? null,
        receipt_image_url: e.receiptImageUrl ?? null,
        created_at:        tsToIso(e.createdAt) ?? new Date().toISOString(),
      }
    })
    await upsert(sb, "group_expenses", expRows, dry)

    // Settlements
    const setSnap = await db.collection(`groups/${d.id}/settlements`).get()
    const setRows = setSnap.docs.map((sd) => {
      const s = sd.data()
      return {
        id:         mapId(sd.id),
        group_id:   mapId(d.id),
        from_uid:   s.fromUid ?? "",
        to_uid:     s.toUid ?? "",
        amount:     num(s.amount),
        currency:   s.currency ?? "USD",
        settled_at: tsToIso(s.settledAt) ?? new Date().toISOString(),
      }
    })
    await upsert(sb, "group_settlements", setRows, dry)
  }
}

// ── Runner principal ───────────────────────────────────────────────────────────

const ALL_COLLECTIONS = [
  "profiles", "user_directory", "expenses", "categories", "budgets",
  "recurring", "goals", "travel_budgets", "income", "income_categories",
  "trusted_circle", "quick_expenses", "category_rules", "category_budgets",
  "clients", "templates", "automations", "portals", "user_settings",
  "push_subscriptions", "pinned_items", "starred", "watchlist",
  "entities", "entity_edges", "groups",
]

async function main() {
  const args = process.argv.slice(2)
  const dry = args.includes("--dry-run")
  const onlyArg = args.find((a) => a.startsWith("--only"))
  const only = onlyArg ? onlyArg.split("=")[1]?.split(",") ?? [] : []

  const skip = (col: string) => only.length > 0 && !only.includes(col)

  console.log(`\n🚀 Migración Firestore → Supabase ${dry ? "(DRY RUN — sin escrituras)" : "(REAL)"}\n`)

  loadEnv()
  const db = initFirebase()
  const sb = initSupabase()

  // Directorio de usuarios
  if (!skip("user_directory")) await migrateUserDirectory(db, sb, dry)

  // Grupos (colección raíz, sin UID de usuario)
  if (!skip("groups")) await migrateGroups(db, sb, dry)

  // Leer todos los UIDs de la colección users/
  console.log("  → Leyendo usuarios en Firestore…")
  const usersSnap = await db.collection("users").get()
  console.log(`  → ${usersSnap.docs.length} usuario(s) encontrado(s)\n`)

  for (const userDoc of usersSnap.docs) {
    const uid = userDoc.id
    const data = userDoc.data()
    console.log(`  👤 ${uid}`)

    if (!skip("profiles")) await migrateProfile(uid, data, sb, dry)
    if (!skip("expenses")) await migrateExpenses(uid, db, sb, dry)
    if (!skip("categories")) await migrateCategories(uid, db, sb, dry)
    if (!skip("budgets")) await migrateBudgets(uid, db, sb, dry)
    if (!skip("recurring")) await migrateRecurring(uid, db, sb, dry)
    if (!skip("goals")) await migrateGoals(uid, db, sb, dry)
    if (!skip("travel_budgets")) await migrateTravelBudgets(uid, db, sb, dry)
    if (!skip("income")) await migrateIncome(uid, db, sb, dry)
    if (!skip("income_categories")) await migrateIncomeCat(uid, db, sb, dry)
    if (!skip("trusted_circle")) await migrateTrustedCircle(uid, db, sb, dry)
    if (!skip("quick_expenses")) await migrateQuickExpenses(uid, db, sb, dry)
    if (!skip("category_rules")) await migrateCategoryRules(uid, db, sb, dry)
    if (!skip("category_budgets")) await migrateCategoryBudgets(uid, db, sb, dry)
    if (!skip("clients")) await migrateClients(uid, db, sb, dry)
    if (!skip("templates")) await migrateTemplates(uid, db, sb, dry)
    if (!skip("automations")) await migrateAutomations(uid, db, sb, dry)
    if (!skip("portals")) await migratePortals(uid, db, sb, dry)
    if (!skip("user_settings") || !skip("push_subscriptions") || !skip("pinned_items") || !skip("starred") || !skip("watchlist")) {
      await migrateUserMeta(uid, db, sb, dry)
    }
    if (!skip("entities")) await migrateEntities(uid, db, sb, dry)
    if (!skip("entity_edges")) await migrateEntityEdges(uid, db, sb, dry)
  }

  console.log("\n✅ Resumen de registros procesados:")
  let total = 0
  for (const [table, count] of Object.entries(counts).sort()) {
    console.log(`   ${table.padEnd(25)} ${count}`)
    total += count
  }
  console.log(`   ${"TOTAL".padEnd(25)} ${total}`)
  if (dry) console.log("\n⚠️  DRY RUN: ningún dato fue escrito en Supabase.")
  else console.log("\n🎉 Migración completada.")
}

main().catch((err) => {
  console.error("\n💥 Error fatal:", err)
  process.exit(1)
})
