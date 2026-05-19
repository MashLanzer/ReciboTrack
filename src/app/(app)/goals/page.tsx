import { GoalsClient } from "@/components/goals/goals-client"
import { ErrorBoundary } from "@/components/ui/error-boundary"

export default function GoalsPage() {
  // #19 — ErrorBoundary para capturar errores de renderizado en GoalsClient
  return (
    <ErrorBoundary label="Metas">
      <GoalsClient />
    </ErrorBoundary>
  )
}
