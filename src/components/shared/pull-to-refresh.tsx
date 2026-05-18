"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { cn } from "@/lib/utils"

const THRESHOLD  = 60   // px (post-resistance) that triggers refresh
const RESISTANCE = 0.38 // damping so it feels like rubber
const TOP_NAV_H  = 56   // px — matches TopNav height

// Spinner SVG: partial arc that rotates as you pull, then spins on refresh
function PTRSpinner({ progress, spinning }: { progress: number; spinning: boolean }) {
  const rotation = progress * 300  // 0 → 300° as you pull

  return (
    <svg
      width="18" height="18" viewBox="0 0 18 18" fill="none"
      className={cn(spinning && "animate-spin")}
      style={spinning ? undefined : { transform: `rotate(${rotation}deg)`, transition: "transform 0.08s linear" }}
    >
      {/* Track */}
      <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="2" strokeOpacity="0.2" />
      {/* Arc fill — grows with progress */}
      <circle
        cx="9" cy="9" r="7"
        stroke="currentColor" strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={`${2 * Math.PI * 7}`}
        strokeDashoffset={`${2 * Math.PI * 7 * (1 - (spinning ? 0.25 : Math.max(progress, 0.05)))}`}
        style={{ transition: "stroke-dashoffset 0.08s linear" }}
        transform="rotate(-90 9 9)"
      />
    </svg>
  )
}

export function PullToRefresh() {
  const qc = useQueryClient()
  const [phase, setPhase] = useState<"idle" | "pulling" | "ready" | "refreshing">("idle")
  const [pullY, setPullY] = useState(0)

  const startYRef  = useRef<number | null>(null)
  const pullYRef   = useRef(0)
  const phaseRef   = useRef<typeof phase>("idle")

  // Keep phaseRef in sync so touch handlers read latest value
  useEffect(() => { phaseRef.current = phase }, [phase])

  const trigger = useCallback(async () => {
    setPhase("refreshing")
    setPullY(THRESHOLD * 0.6)  // snap indicator to a fixed resting spot
    await qc.invalidateQueries()
    await new Promise(r => setTimeout(r, 700))
    setPhase("idle")
    setPullY(0)
    pullYRef.current = 0
  }, [qc])

  useEffect(() => {
    function scrollTop() {
      return Math.max(document.documentElement.scrollTop, document.body.scrollTop)
    }

    function onTouchStart(e: TouchEvent) {
      if (phaseRef.current === "refreshing") return
      if (scrollTop() > 8) return  // only fire from the very top
      startYRef.current = e.touches[0].clientY
    }

    function onTouchMove(e: TouchEvent) {
      if (startYRef.current === null || phaseRef.current === "refreshing") return
      if (scrollTop() > 8) { startYRef.current = null; return }

      const raw = e.touches[0].clientY - startYRef.current
      if (raw <= 0) return  // not a downward pull

      const clamped = raw * RESISTANCE
      pullYRef.current = clamped
      setPullY(clamped)
      setPhase(clamped >= THRESHOLD ? "ready" : "pulling")
    }

    function onTouchEnd() {
      if (startYRef.current === null) return
      startYRef.current = null
      if (pullYRef.current >= THRESHOLD) {
        trigger()
      } else {
        setPhase("idle")
        setPullY(0)
        pullYRef.current = 0
      }
    }

    window.addEventListener("touchstart", onTouchStart, { passive: true })
    window.addEventListener("touchmove",  onTouchMove,  { passive: true })
    window.addEventListener("touchend",   onTouchEnd)

    return () => {
      window.removeEventListener("touchstart", onTouchStart)
      window.removeEventListener("touchmove",  onTouchMove)
      window.removeEventListener("touchend",   onTouchEnd)
    }
  }, [trigger])

  if (phase === "idle") return null

  const progress    = Math.min(pullY / THRESHOLD, 1)
  const isReady     = phase === "ready"
  const isRefreshing = phase === "refreshing"
  const indicatorY  = isRefreshing
    ? THRESHOLD * 0.6         // fixed position while spinning
    : Math.min(pullY, THRESHOLD * 1.1)

  return (
    <div
      aria-live="polite"
      aria-label={isRefreshing ? "Actualizando…" : "Suelta para actualizar"}
      className="fixed left-0 right-0 z-50 flex justify-center pointer-events-none"
      style={{
        top: TOP_NAV_H,
        transform: `translateY(${indicatorY}px)`,
        transition: isRefreshing ? "transform 0.25s cubic-bezier(0.34,1.56,0.64,1)" : "none",
      }}
    >
      <div className={cn(
        "h-9 w-9 -translate-y-1/2 rounded-full bg-background border shadow-md",
        "flex items-center justify-center",
        "transition-[border-color,color] duration-150",
        isReady || isRefreshing
          ? "border-primary/40 text-primary"
          : "border-border text-muted-foreground"
      )}>
        <PTRSpinner progress={progress} spinning={isRefreshing} />
      </div>
    </div>
  )
}
