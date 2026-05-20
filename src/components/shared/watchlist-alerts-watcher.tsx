"use client"

import { useWatchlistAlerts } from "@/hooks/use-watchlist-alerts"

/** Componente invisible que vigila los thresholds de la watchlist de categorías */
export function WatchlistAlertsWatcher() {
  useWatchlistAlerts()
  return null
}
