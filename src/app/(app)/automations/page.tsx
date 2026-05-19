"use client"

import { AutomationsClient } from "@/components/automations/automations-client"
import { ErrorBoundary } from "@/components/ui/error-boundary"

export default function AutomationsPage() {
  // #19 — ErrorBoundary para capturar errores de renderizado en AutomationsClient
  return (
    <ErrorBoundary label="Automatizaciones">
      <AutomationsClient />
    </ErrorBoundary>
  )
}
