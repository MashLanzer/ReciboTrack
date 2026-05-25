"use client"

import type { ReactNode } from "react"
import { usePlan } from "@/hooks/use-plan"

function UpgradePrompt({ feature }: { feature: string }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 p-6 text-center space-y-3">
      <div className="text-3xl">⭐</div>
      <p className="font-bold text-sm">Función Pro</p>
      <p className="text-xs text-muted-foreground">{feature} está disponible en el plan Pro</p>
      <button className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground">
        Actualizar a Pro
      </button>
    </div>
  )
}

export function ProGate({ feature, children }: { feature: string; children: ReactNode }) {
  const { data } = usePlan()
  if (data?.plan === "pro") return <>{children}</>
  return <UpgradePrompt feature={feature} />
}
