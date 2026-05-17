/**
 * Fires a personal webhook with a structured payload.
 * Called client-side; errors are silently caught so they never block the user.
 */
export interface WebhookPayload {
  event:    "new_expense" | "budget_alert" | "test" | "automation"
  ts:       string            // ISO timestamp
  data:     Record<string, unknown>
}

export async function fireWebhook(
  url: string,
  payload: WebhookPayload
): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    const res = await fetch(url, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
      signal:  AbortSignal.timeout(8000),
    })
    return { ok: res.ok, status: res.status }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error de red" }
  }
}

export function buildExpensePayload(expense: {
  id:            string
  merchant:      string
  total:         number
  currency:      string
  category?:     string
  paymentMethod?: string | null
  date:          { toDate(): Date } | Date
}): WebhookPayload {
  const date = typeof (expense.date as any).toDate === "function"
    ? (expense.date as { toDate(): Date }).toDate()
    : expense.date as Date

  return {
    event: "new_expense",
    ts:    new Date().toISOString(),
    data:  {
      id:            expense.id,
      merchant:      expense.merchant,
      total:         expense.total,
      currency:      expense.currency,
      category:      expense.category ?? null,
      paymentMethod: expense.paymentMethod ?? null,
      date:          date.toISOString(),
    },
  }
}
