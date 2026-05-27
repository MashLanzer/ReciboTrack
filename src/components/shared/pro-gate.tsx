"use client"

import { usePlan } from "@/hooks/use-plan"
import Link from "next/link"
import { Sparkles } from "lucide-react"

function UpgradePrompt({ feature }: { feature: string }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 p-6 text-center space-y-3">
      <div className="text-3xl">⭐</div>
      <p className="font-bold text-sm">Función Pro</p>
      <p className="text-xs text-muted-foreground">{feature} está disponible en el plan Pro</p>
      <Link
        href="/pricing"
        className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        <Sparkles className="h-3.5 w-3.5" />
        Actualizar a Pro — $4.99/mes
      </Link>
    </div>
  )
}

export function ProGate({ feature, children }: { feature: string; children: React.ReactNode }) {
  const { data } = usePlan()
  if (data?.plan === "pro") return <>{children}</>
  return <UpgradePrompt feature={feature} />
}
