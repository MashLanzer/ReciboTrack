// localStorage-based snooze manager for budget and flag alerts

interface SnoozeEntry {
  until: number
}

function snoozeKey(key: string): string {
  return `snooze:${key}`
}

export function snoozeAlert(key: string, days: number): void {
  try {
    const entry: SnoozeEntry = { until: Date.now() + days * 86400000 }
    localStorage.setItem(snoozeKey(key), JSON.stringify(entry))
  } catch {
    // Ignore storage errors
  }
}

export function isAlertSnoozed(key: string): boolean {
  try {
    const raw = localStorage.getItem(snoozeKey(key))
    if (!raw) return false
    const entry = JSON.parse(raw) as SnoozeEntry
    return Date.now() < entry.until
  } catch {
    return false
  }
}

export function clearSnooze(key: string): void {
  try {
    localStorage.removeItem(snoozeKey(key))
  } catch {
    // Ignore storage errors
  }
}

export function getSnoozeUntil(key: string): Date | null {
  try {
    const raw = localStorage.getItem(snoozeKey(key))
    if (!raw) return null
    const entry = JSON.parse(raw) as SnoozeEntry
    if (Date.now() >= entry.until) return null
    return new Date(entry.until)
  } catch {
    return null
  }
}
