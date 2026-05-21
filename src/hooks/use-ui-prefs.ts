"use client"

/**
 * useUIPrefs — preferencias de interfaz sincronizadas en Supabase (profiles.ui_prefs)
 *
 * Estrategia:
 *  - Estado local inmediato (sin lag de red) para cada cambio de preferencia
 *  - Escritura a /api/profile en segundo plano; falla en silencio si hay sin conexión
 *  - Migración automática desde localStorage la primera vez que se carga
 *  - Mientras no está autenticado, actúa solo con estado local (degradación elegante)
 */

import { useCallback, useEffect, useState } from "react"
import { apiFetch } from "@/lib/api-client"
import { useAuth } from "./use-auth"

// ── Tipo de preferencias ──────────────────────────────────────────────────────

export interface UIPrefs {
  feedMode:     "recent" | "smart"
  feedFilter:   string
  dashMode:     "normal" | "quick"
  expensesView: "list" | "cal" | "threads" | "grid"
  expenseSort:  string
}

const DEFAULTS: UIPrefs = {
  feedMode:     "recent",
  feedFilter:   "todos",
  dashMode:     "normal",
  expensesView: "list",
  expenseSort:  "date_desc",
}

// localStorage keys de las versiones anteriores (solo para migración)
const LS_MIGRATION: Record<keyof UIPrefs, string> = {
  feedMode:     "rbt_feed_mode",
  feedFilter:   "rbt_feed_filter",
  dashMode:     "rbt_dash_mode",
  expensesView: "rbt_expenses_view",
  expenseSort:  "rt-expense-sort",
}

// ── Hook ─────────────────────────────────────────────────────────────────────

let globalPrefs: UIPrefs = { ...DEFAULTS }
const listeners = new Set<() => void>()

function notifyListeners() {
  listeners.forEach(fn => fn())
}

/**
 * Hook de preferencias de UI.
 * Retorna `{ prefs, setPref, loaded }`.
 * - `loaded` es false hasta que se ha leído Supabase (evita flash de valor por defecto)
 * - `setPref(key, value)` actualiza el estado local de inmediato y sincroniza en background
 */
export function useUIPrefs() {
  const { user } = useAuth()
  const [prefs, setPrefsLocal] = useState<UIPrefs>({ ...globalPrefs })
  const [loaded, setLoaded] = useState(false)

  // Suscribirse a cambios globales (varios componentes comparten la misma instancia)
  useEffect(() => {
    const update = () => setPrefsLocal({ ...globalPrefs })
    listeners.add(update)
    return () => { listeners.delete(update) }
  }, [])

  // Cargar desde Supabase (vía /api/profile) al autenticar
  useEffect(() => {
    if (!user?.uid) return
    let cancelled = false

    async function load() {
      const res = await apiFetch("/api/profile")
      if (cancelled) return

      let stored: Partial<UIPrefs> = {}
      if (res.ok) {
        const data = await res.json() as Record<string, unknown> | null
        stored = (data?.ui_prefs as Partial<UIPrefs>) ?? {}
      }

      // Migrar desde localStorage solo si el campo no existe aún en Supabase
      const migrated: Partial<UIPrefs> = {}
      let hasMigration = false

      try {
        for (const [key, lsKey] of Object.entries(LS_MIGRATION) as [keyof UIPrefs, string][]) {
          if (!(key in stored)) {
            const val = localStorage.getItem(lsKey)
            if (val) {
              (migrated as Record<string, string>)[key] = val
              hasMigration = true
              localStorage.removeItem(lsKey)
            }
          }
        }
      } catch { /* Safari privado / sin localStorage */ }

      const merged: UIPrefs = { ...DEFAULTS, ...stored, ...migrated }

      if (hasMigration) {
        // Persistir los valores migrados en Supabase sin bloquear la UI
        void apiFetch("/api/profile", {
          method: "PATCH",
          body: JSON.stringify({ uiPrefs: merged }),
        }).catch(() => {/* offline */})
      }

      if (!cancelled) {
        globalPrefs = merged
        notifyListeners()
        setLoaded(true)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [user?.uid])

  // Escribir una preferencia individual
  const setPref = useCallback(<K extends keyof UIPrefs>(key: K, value: UIPrefs[K]) => {
    globalPrefs = { ...globalPrefs, [key]: value }
    notifyListeners()

    if (!user?.uid) return
    // Mandamos el objeto completo porque /api/profile PATCH hace update de la columna entera
    void apiFetch("/api/profile", {
      method: "PATCH",
      body: JSON.stringify({ uiPrefs: globalPrefs }),
    }).catch(() => {/* offline */})
  }, [user?.uid])

  return { prefs, setPref, loaded }
}
