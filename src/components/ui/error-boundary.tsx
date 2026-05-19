"use client"

import { Component, type ReactNode } from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Props {
  children: ReactNode
  /** Short label shown in the error card, e.g. "Gráfico de flujo" */
  label?: string
  /** Compact variant — smaller card for inline components */
  compact?: boolean
}

interface State {
  error: Error | null
}

/**
 * Catches rendering errors in children and shows an inline recovery card.
 * Reset by clicking "Reintentar" — remounts the subtree via key change.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  reset = () => this.setState({ error: null })

  render() {
    if (!this.state.error) return this.props.children

    const { label = "Este componente", compact = false } = this.props

    if (compact) {
      return (
        <div className="flex items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3">
          <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
          <p className="flex-1 text-xs text-destructive/80">
            {label} no se pudo cargar
          </p>
          <button
            onClick={this.reset}
            className="text-xs font-semibold text-destructive underline-offset-2 hover:underline shrink-0"
          >
            Reintentar
          </button>
        </div>
      )
    }

    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-destructive/20 bg-destructive/5 px-5 py-8 text-center animate-[fadeSlideUp_0.25s_ease-out_both]">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-destructive/10">
          <AlertTriangle className="h-5 w-5 text-destructive" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">
            {label} no se pudo cargar
          </p>
          <p className="text-xs text-muted-foreground max-w-[240px]">
            Ocurrió un error inesperado. Puedes intentarlo de nuevo o continuar usando otras secciones.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={this.reset}
          className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Reintentar
        </Button>
      </div>
    )
  }
}
