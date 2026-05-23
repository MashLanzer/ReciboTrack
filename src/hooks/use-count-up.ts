import { useEffect, useRef, useState } from "react"

/**
 * Animates a numeric value from its previous value to `target`
 * using an ease-out cubic curve over `duration` ms.
 *
 * Usage:
 *   const displayed = useCountUp(totalExpenses, 500)
 *   return <span>{formatCurrency(displayed)}</span>
 */
export function useCountUp(target: number, duration = 600): number {
  const [value, setValue] = useState(target)
  const prevRef     = useRef(target)
  const rafRef      = useRef<number>(0)
  const startTsRef  = useRef<number>(0)
  const fromRef     = useRef<number>(target)

  useEffect(() => {
    // Skip if unchanged (avoids unnecessary animation on re-renders)
    if (prevRef.current === target) return

    const from = prevRef.current
    prevRef.current = target
    fromRef.current = from
    startTsRef.current = 0

    cancelAnimationFrame(rafRef.current)

    const tick = (ts: number) => {
      if (!startTsRef.current) startTsRef.current = ts
      const elapsed  = ts - startTsRef.current
      const progress = Math.min(elapsed / duration, 1)
      // ease-out cubic: fast start, gentle finish
      const eased    = 1 - Math.pow(1 - progress, 3)
      setValue(fromRef.current + (target - fromRef.current) * eased)

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        setValue(target)
      }
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target, duration])

  return value
}
