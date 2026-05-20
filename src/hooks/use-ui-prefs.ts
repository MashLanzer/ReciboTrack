"use client"

/**
 * useUIPrefs — preferencias de interfaz sincronizadas en Firestore
 *
 * Las preferencias se leen de users/{uid}.uiPrefs y se escriben ahí con
 * dot-notation para evitar sobreescribir otros campos del documento.
 *
 * Estrategia:
 *  - Estado local inmediato (sin lag de red) para cada cambio de preferencia
 *  - Escritura a Firestore en segundo plano; falla en silencio si hay sin conexión
 *  - Migración automática desde localStorage la primera vez que se carga
 *  - Mientras no está autenticado, actúa solo con estado local (degradación elegante)
 */

import { useCallback, useEffect, useState } from "react"
import { doc, getDoc, updateDoc } from "firebase/firestore"
import { getFirebaseDb } from "@/lib/firebase/client"
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
 * - `loaded` es false hasta que se ha leído Firestore (evita flash de valor por defecto)
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

  // Cargar desde Firestore al autenticar
  useEffect(() => {
    if (!user?.uid) return
    let cancelled = false

    async function load() {
      const ref = doc(getFirebaseDb(), "users", user!.uid)
      const snap = await getDoc(ref)
      if (cancelled) return

      const data = snap.data() ?? {}
      const stored: Partial<UIPrefs> = data.uiPrefs ?? {}

      // Migrar desde localStorage solo si el campo no existe aún en Firestore
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
        // Persistir los valores migrados en Firestore sin bloquear la UI
        void updateDoc(ref, { uiPrefs: merged }).catch(() => {/* offline */})
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
    const ref = doc(getFirebaseDb(), "users", user.uid)
    // Dot-notation update — solo toca ese campo, no sobreescribe el resto del documento
    void updateDoc(ref, { [`uiPrefs.${key}`]: value }).catch(() => {/* offline */})
  }, [user?.uid])

  return { prefs, setPref, loaded }
}
