"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { useHasPlan, usePlan } from "@/hooks/use-plan"
import type { Plan } from "@/lib/plan-config"

interface UpgradePromptProps {
  feature:  string
  required: Plan
}

function UpgradePrompt({ feature, required }: UpgradePromptProps) {
  const label = required === "premium" ? "Premium" : "Pro"
  const icon  = required === "premium" ? "👑" : "⚡"
  return (
    <div className="rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 p-6 text-center space-y-3">
      <div className="text-3xl">{icon}</div>
      <p className="font-bold text-sm">Función {label}</p>
      <p className="text-xs text-muted-foreground">{feature} está disponible en el plan {label}</p>
      <Link href="/pricing" className="inline-block rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground">
        Ver planes
      </Link>
    </div>
  )
}

/**
 * Gate visual para features paginadas detrás de un plan.
 *
 *   <ProGate feature="Exportación CSV">    {/* default: required="pro" *}
 *     <ExportButton />
 *   </ProGate>
 *
 *   <ProGate feature="Bank sync" required="premium">
 *     <BanksList />
 *   </ProGate>
 *
 * Si el usuario tiene plan suficiente, renderiza children. Si no, muestra
 * el prompt de upgrade.
 */
export function ProGate({
  feature,
  children,
  required = "pro",
}: {
  feature:    string
  children:   ReactNode
  required?:  Plan
}) {
  const hasAccess = useHasPlan(required)
  const { data } = usePlan()

  // Mientras carga el plan, no mostramos nada (evita flash del upgrade prompt)
  if (!data) return null

  if (hasAccess) return <>{children}</>
  return <UpgradePrompt feature={feature} required={required} />
}
