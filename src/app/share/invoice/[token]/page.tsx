"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Printer, AlertTriangle, Loader2 } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("es", { style: "currency", currency }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}

type InvoiceData = {
  project: {
    id: string
    name: string
    clientName: string | null
    clientEmail: string | null
    clientPhone: string | null
    description: string | null
    budget: number | null
    currency: string
    color: string
  }
  client: { name: string; email: string | null; phone: string | null } | null
  expenses: {
    id: string
    merchant: string
    date: string | null
    total: number
    currency: string
    category: string
    notes: string
  }[]
}

export default function PublicInvoicePage() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<InvoiceData | null>(null)
  const [expired, setExpired] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) return
    fetch(`/api/public/invoice/${token}`, { cache: "no-store" })
      .then(async (res) => {
        if (res.status === 410) { setExpired(true); return }
        if (!res.ok) { setExpired(true); return }
        const json = await res.json()
        setData(json)
      })
      .catch(() => setExpired(true))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) {
    return (
      <div className="container max-w-2xl mx-auto px-4 py-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (expired || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertTriangle className="h-6 w-6 text-destructive" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">Factura expirada o no encontrada</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Este link ya no es válido o ha expirado.
          </p>
        </div>
      </div>
    )
  }

  const { project, expenses } = data
  const total = expenses.reduce((s, e) => s + e.total, 0)
  const today = format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: es })

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .invoice-wrapper { box-shadow: none !important; border: none !important; }
        }
      `}</style>

      <div className="container max-w-2xl mx-auto px-4 py-6">
        <div className="no-print flex items-center justify-end mb-6">
          <Button onClick={() => window.print()} className="gap-2">
            <Printer className="h-4 w-4" />
            Imprimir / Guardar PDF
          </Button>
        </div>

        <div
          className="invoice-wrapper bg-white text-gray-900 rounded-2xl border shadow-sm p-8 space-y-8"
          style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 style={{ fontSize: "2rem", fontWeight: 700, letterSpacing: "0.05em", color: "#111" }}>
                FACTURA
              </h2>
              <p style={{ fontSize: "0.95rem", color: "#555", marginTop: "0.25rem" }}>Tu Empresa</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: "0.85rem", color: "#777" }}>Fecha de emisión</p>
              <p style={{ fontSize: "0.95rem", fontWeight: 600 }}>{today}</p>
              {project.color && (
                <div
                  style={{
                    width: "2.5rem",
                    height: "4px",
                    borderRadius: "999px",
                    backgroundColor: project.color,
                    marginTop: "0.75rem",
                    marginLeft: "auto",
                  }}
                />
              )}
            </div>
          </div>

          <hr style={{ borderColor: "#e5e7eb" }} />

          <div className="grid grid-cols-2 gap-6">
            {(project.clientName || project.clientEmail || project.clientPhone) && (
              <div>
                <p style={{ fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6b7280", marginBottom: "0.5rem" }}>
                  Facturar a
                </p>
                <p style={{ fontWeight: 700, fontSize: "1rem" }}>{project.clientName ?? "—"}</p>
                {project.clientEmail && (
                  <p style={{ fontSize: "0.875rem", color: "#555", marginTop: "0.15rem" }}>
                    {project.clientEmail}
                  </p>
                )}
                {project.clientPhone && (
                  <p style={{ fontSize: "0.875rem", color: "#555", marginTop: "0.15rem" }}>
                    {project.clientPhone}
                  </p>
                )}
              </div>
            )}
            <div>
              <p style={{ fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6b7280", marginBottom: "0.5rem" }}>
                Proyecto
              </p>
              <p style={{ fontWeight: 700, fontSize: "1rem" }}>{project.name}</p>
              {project.description && (
                <p style={{ fontSize: "0.875rem", color: "#555", marginTop: "0.15rem" }}>{project.description}</p>
              )}
            </div>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #111" }}>
                {["Fecha", "Descripción", "Categoría", "Monto"].map((h, i) => (
                  <th
                    key={h}
                    style={{
                      padding: "0.5rem 0.75rem",
                      textAlign: i === 3 ? "right" : "left",
                      fontSize: "0.75rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      color: "#374151",
                      paddingLeft: i === 0 ? 0 : undefined,
                      paddingRight: i === 3 ? 0 : undefined,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: "1.5rem 0", textAlign: "center", color: "#9ca3af", fontSize: "0.85rem" }}>
                    Sin gastos registrados
                  </td>
                </tr>
              ) : (
                expenses.map((e, i) => {
                  const dateStr = e.date
                    ? format(new Date(e.date), "d MMM yyyy", { locale: es })
                    : "—"
                  return (
                    <tr
                      key={e.id}
                      style={{ borderBottom: "1px solid #f3f4f6", backgroundColor: i % 2 === 0 ? "transparent" : "#fafafa" }}
                    >
                      <td style={{ padding: "0.6rem 0.75rem", paddingLeft: 0, color: "#374151", whiteSpace: "nowrap" }}>
                        {dateStr}
                      </td>
                      <td style={{ padding: "0.6rem 0.75rem" }}>
                        <span style={{ fontWeight: 500 }}>{e.merchant}</span>
                        {e.notes && (
                          <span style={{ display: "block", fontSize: "0.8rem", color: "#9ca3af" }}>
                            {e.notes}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "0.6rem 0.75rem", color: "#6b7280" }}>{e.category}</td>
                      <td style={{ padding: "0.6rem 0.75rem", paddingRight: 0, textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 500 }}>
                        {formatMoney(e.total, e.currency)}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: "2px solid #111" }}>
                <td colSpan={3} style={{ padding: "0.75rem 0.75rem", paddingLeft: 0, fontWeight: 700, textAlign: "right" }}>
                  Total
                </td>
                <td style={{ padding: "0.75rem 0", paddingRight: 0, textAlign: "right", fontWeight: 700, fontSize: "1.1rem", fontVariantNumeric: "tabular-nums" }}>
                  {formatMoney(total, project.currency ?? "USD")}
                </td>
              </tr>
              {project.budget && (
                <tr>
                  <td colSpan={3} style={{ padding: "0.25rem 0.75rem", paddingLeft: 0, color: "#9ca3af", textAlign: "right", fontSize: "0.8rem" }}>
                    Presupuesto
                  </td>
                  <td style={{ padding: "0.25rem 0", paddingRight: 0, textAlign: "right", color: "#9ca3af", fontSize: "0.8rem", fontVariantNumeric: "tabular-nums" }}>
                    {formatMoney(project.budget, project.currency ?? "USD")}
                  </td>
                </tr>
              )}
            </tfoot>
          </table>

          <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "1.5rem", textAlign: "center" }}>
            <p style={{ fontSize: "0.75rem", color: "#9ca3af" }}>Generado por ReciboTrack</p>
          </div>
        </div>
      </div>
    </>
  )
}
