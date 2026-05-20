"use client"

import { useState } from "react"
import { Bell, BellOff, Check } from "lucide-react"
import { toast } from "sonner"
import { useUserSettings, useUpdateUserSettings } from "@/hooks/use-user-settings"
import { requestNotificationPermission } from "@/hooks/use-notifications"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface ToggleRowProps {
  label: string
  description?: string
  checked: boolean
  onCheckedChange: (v: boolean) => void
  disabled?: boolean
}

function ToggleRow({ label, description, checked, onCheckedChange, disabled }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className={cn("text-sm font-medium", disabled && "text-muted-foreground")}>{label}</p>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-label={label}
      />
    </div>
  )
}

export function NotificationSettingsCard() {
  const { data: settings, isLoading } = useUserSettings()
  const update = useUpdateUserSettings()
  const [requesting, setRequesting] = useState(false)

  async function handleMasterToggle(enabled: boolean) {
    if (enabled) {
      setRequesting(true)
      const granted = await requestNotificationPermission()
      setRequesting(false)
      if (!granted) {
        toast.error("Notificaciones bloqueadas", {
          description: "Actívalas en los ajustes de tu navegador y recarga la página.",
          duration: 6000,
        })
        return
      }
    }
    await update.mutateAsync({ notificationsEnabled: enabled })
    toast.success(enabled ? "Notificaciones activadas" : "Notificaciones desactivadas")
  }

  async function handleToggle(key: "notifyRecurring" | "notifyWeeklySummary", value: boolean) {
    await update.mutateAsync({ [key]: value })
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-16 w-full rounded-2xl" />
      </div>
    )
  }

  const masterEnabled = settings?.notificationsEnabled ?? false
  const browserSupport = typeof window !== "undefined" && "Notification" in window

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Bell className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-semibold text-base">Notificaciones</h2>
      </div>

      <div className="rounded-2xl border bg-card divide-y">
        {/* Master toggle */}
        <div className="px-4 py-3">
          <ToggleRow
            label="Activar notificaciones"
            description={
              !browserSupport
                ? "Tu navegador no admite notificaciones"
                : masterEnabled
                ? "Recibirás alertas de presupuesto y recordatorios"
                : "Activa para recibir alertas en este dispositivo"
            }
            checked={masterEnabled}
            onCheckedChange={(v) => void handleMasterToggle(v)}
            disabled={!browserSupport || requesting || update.isPending}
          />
          {browserSupport && masterEnabled && Notification.permission === "granted" && (
            <p className="text-[11px] text-emerald-600 flex items-center gap-1 mt-1.5">
              <Check className="h-3 w-3" />
              Permiso concedido
            </p>
          )}
        </div>

        {/* Sub-options — only shown when master is on */}
        {masterEnabled && (
          <>
            <div className="px-4 py-3">
              <ToggleRow
                label="Gastos recurrentes"
                description="Aviso cuando vence un gasto recurrente"
                checked={settings?.notifyRecurring ?? true}
                onCheckedChange={(v) => void handleToggle("notifyRecurring", v)}
                disabled={update.isPending}
              />
            </div>
            <div className="px-4 py-3">
              <ToggleRow
                label="Resumen semanal"
                description="Resumen de gastos cada domingo"
                checked={settings?.notifyWeeklySummary ?? false}
                onCheckedChange={(v) => void handleToggle("notifyWeeklySummary", v)}
                disabled={update.isPending}
              />
            </div>
          </>
        )}
      </div>

      {!masterEnabled && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <BellOff className="h-3.5 w-3.5 shrink-0" />
          <span>Las alertas de presupuesto también se muestran en la app aunque las notificaciones estén desactivadas.</span>
        </div>
      )}
    </div>
  )
}
