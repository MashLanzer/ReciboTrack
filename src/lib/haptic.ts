/**
 * Haptic feedback utility — uses the Vibration API (Android Chrome, Firefox).
 * Silently no-ops on iOS (vibration not supported) and desktop.
 */

function vibe(pattern: number | number[]) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try { navigator.vibrate(pattern) } catch { /* ignore */ }
  }
}

export const haptic = {
  /** Very light: confirmación de tap */
  light:   () => vibe(8),
  /** Medio: acción completada */
  medium:  () => vibe(18),
  /** Fuerte: acción destructiva */
  heavy:   () => vibe(35),
  /** Patrón de éxito: doble pulso suave */
  success: () => vibe([10, 40, 18]),
  /** Patrón de error: triple corto */
  error:   () => vibe([20, 30, 20, 30, 20]),
  /** Patrón de warning: doble medio */
  warning: () => vibe([15, 40, 15]),
}
