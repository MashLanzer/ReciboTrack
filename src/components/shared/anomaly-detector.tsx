"use client"

import { useAnomalyDetector } from "@/hooks/use-anomaly-detector"

/** Componente invisible que activa el detector de gastos anómalos */
export function AnomalyDetector() {
  useAnomalyDetector()
  return null
}
