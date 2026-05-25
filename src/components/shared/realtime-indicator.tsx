"use client"
import { useEffect, useState } from "react"
import { supabaseClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

export function RealtimeIndicator() {
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!supabaseClient) return
    const channel = supabaseClient.channel("ping-check")
    channel.subscribe((status) => {
      setConnected(status === "SUBSCRIBED")
    })
    return () => { supabaseClient?.removeChannel(channel) }
  }, [])

  return (
    <div
      className={cn(
        "h-1.5 w-1.5 rounded-full transition-colors",
        connected ? "bg-green-500" : "bg-muted-foreground/30"
      )}
      title={connected ? "Sincronización en tiempo real activa" : "Sin conexión en tiempo real"}
    />
  )
}
