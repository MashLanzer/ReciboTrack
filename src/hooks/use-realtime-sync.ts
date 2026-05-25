"use client"
import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useAuth } from "./use-auth"
import { supabaseClient } from "@/lib/supabase/client"

export function useRealtimeSync() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const uid = user?.uid

  useEffect(() => {
    if (!uid) return

    const channel = supabaseClient
      .channel(`realtime-${uid}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "expenses",
        filter: `uid=eq.${uid}`,
      }, () => {
        qc.invalidateQueries({ queryKey: ["expenses"] })
      })
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "income",
        filter: `uid=eq.${uid}`,
      }, () => {
        qc.invalidateQueries({ queryKey: ["income"] })
      })
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "budgets",
        filter: `uid=eq.${uid}`,
      }, () => {
        qc.invalidateQueries({ queryKey: ["budgets"] })
      })
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "recurring",
        filter: `uid=eq.${uid}`,
      }, () => {
        qc.invalidateQueries({ queryKey: ["recurring"] })
      })
      .subscribe()

    return () => {
      supabaseClient.removeChannel(channel)
    }
  }, [uid, qc])
}
