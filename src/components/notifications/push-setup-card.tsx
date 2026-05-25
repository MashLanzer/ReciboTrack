"use client"

import { Bell, BellOff, Check } from "lucide-react"
import { toast } from "sonner"
import { usePushNotifications } from "@/hooks/use-push-notifications"
import { Button } from "@/components/ui/button"

export function PushSetupCard() {
  const { permission, requestAndSubscribe } = usePushNotifications()

  async function handleActivate() {
    try {
      await requestAndSubscribe()
      if (Notification.permission === "granted") {
        toast.success("Notificaciones push activadas")
      }
    } catch {
      toast.error("Error al activar notificaciones push")
    }
  }

  if (permission === "granted") {
    return (
      <div className="flex items-center gap-2 rounded-xl border bg-emerald-500/10 border-emerald-500/20 px-4 py-3">
        <Check className="h-4 w-4 text-emerald-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Notificaciones push activas</p>
          <p className="text-xs text-emerald-600/80 dark:text-emerald-500/80 mt-0.5">Recibirás alertas en este dispositivo</p>
        </div>
      </div>
    )
  }

  if (permission === "denied") {
    return (
      <div className="flex items-center gap-2 rounded-xl border bg-muted/40 px-4 py-3">
        <BellOff className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Notificaciones bloqueadas</p>
          <p className="text-xs text-muted-foreground mt-0.5">Cambia los permisos en los ajustes del navegador</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border bg-card px-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <Bell className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium">Notificaciones push</p>
          <p className="text-xs text-muted-foreground mt-0.5">Recibe alertas de presupuesto y recordatorios</p>
        </div>
      </div>
      <Button size="sm" variant="outline" className="shrink-0 h-8 text-xs" onClick={handleActivate}>
        Activar
      </Button>
    </div>
  )
}
