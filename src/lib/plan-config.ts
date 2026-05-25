export type Plan = "free" | "pro"

export const PLAN_LIMITS = {
  free: { maxExpenses: 100, csvExport: false, pdfReport: false, workspaces: 0, forecast: false },
  pro:  { maxExpenses: Infinity, csvExport: true, pdfReport: true, workspaces: 3, forecast: true },
} as const
