import type { Expense, CategoryDoc } from "@/types"
import { formatDate, formatCurrency, toDate } from "@/lib/utils"
import { format } from "date-fns"
import { es } from "date-fns/locale"

export function exportToCSV(expenses: Expense[]) {
  const headers = ["Fecha", "Comercio", "Categoría", "Total", "Moneda", "Método de pago", "Referencia", "Notas"]
  const rows = expenses.map((e) => [
    formatDate(toDate(e.date)),
    e.merchant,
    e.category,
    e.total.toString(),
    e.currency,
    e.paymentMethod ?? "",
    e.reference ?? "",
    e.notes,
  ])

  const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n")

  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `gastos-${new Date().toISOString().split("T")[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export async function exportToPDF(expenses: Expense[], categories: CategoryDoc[]) {
  const { default: jsPDF } = await import("jspdf")
  const { default: autoTable } = await import("jspdf-autotable")

  const doc = new jsPDF()

  doc.setFontSize(18)
  doc.text("ReciboTrack — Gastos", 14, 22)
  doc.setFontSize(10)
  doc.setTextColor(130)
  doc.text(`Exportado el ${new Date().toLocaleDateString("es")}`, 14, 30)

  const rows = expenses.map((e) => {
    const cat = categories.find((c) => c.id === e.category)
    return [
      formatDate(toDate(e.date)),
      e.merchant,
      cat?.name ?? e.category,
      formatCurrency(e.total, e.currency),
      e.paymentMethod ?? "—",
    ]
  })

  autoTable(doc, {
    startY: 36,
    head: [["Fecha", "Comercio", "Categoría", "Total", "Pago"]],
    body: rows,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [20, 20, 20] },
  })

  doc.save(`gastos-${new Date().toISOString().split("T")[0]}.pdf`)
}

// ─── Monthly PDF report ────────────────────────────────────────────────────────
export async function exportMonthlyPDF(
  expenses: Expense[],
  categories: CategoryDoc[],
  monthDate: Date,
  prevTotal: number,
) {
  const { default: jsPDF } = await import("jspdf")
  const { default: autoTable } = await import("jspdf-autotable")

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const monthLabel = format(monthDate, "MMMM yyyy", { locale: es })
  const monthLabelCap = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 14

  // ── Palette ──────────────────────────────────────────────────────────────
  const INK:   [number, number, number] = [15,  15,  15]
  const MUTED: [number, number, number] = [100, 100, 100]
  const LIGHT: [number, number, number] = [240, 240, 240]
  const ACCENT:[number, number, number] = [79,  70,  229] // indigo-600

  // ── Header band ───────────────────────────────────────────────────────────
  doc.setFillColor(...ACCENT)
  doc.rect(0, 0, pageW, 28, "F")

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.setFont("helvetica", "bold")
  doc.text("ReciboTrack", margin, 12)

  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  doc.text(`Reporte mensual · ${monthLabelCap}`, margin, 20)

  doc.setFontSize(8)
  doc.text(`Generado el ${format(new Date(), "dd/MM/yyyy HH:mm")}`, pageW - margin, 20, { align: "right" })

  // ── Summary KPIs ──────────────────────────────────────────────────────────
  const total     = expenses.reduce((s, e) => s + e.total, 0)
  const txCount   = expenses.length
  const daysInMo  = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate()
  const dailyAvg  = total / daysInMo
  const delta     = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : null

  const kpis = [
    { label: "Total del mes",    value: formatCurrency(total) },
    { label: "Transacciones",    value: String(txCount) },
    { label: "Promedio diario",  value: formatCurrency(dailyAvg) },
    { label: "vs mes anterior",  value: delta !== null ? `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%` : "—" },
  ]

  const colW  = (pageW - margin * 2) / kpis.length
  const boxY  = 34
  const boxH  = 22

  kpis.forEach((kpi, i) => {
    const x = margin + i * colW
    doc.setFillColor(...LIGHT)
    doc.roundedRect(x, boxY, colW - 2, boxH, 2, 2, "F")

    doc.setTextColor(...MUTED)
    doc.setFontSize(7)
    doc.setFont("helvetica", "normal")
    doc.text(kpi.label.toUpperCase(), x + 3, boxY + 7)

    doc.setTextColor(...INK)
    doc.setFontSize(12)
    doc.setFont("helvetica", "bold")
    // Color delta red/green
    if (kpi.label === "vs mes anterior" && delta !== null) {
      doc.setTextColor(delta > 0 ? 220 : 34, delta > 0 ? 38 : 197, delta > 0 ? 38 : 94)
    }
    doc.text(kpi.value, x + 3, boxY + 17)
    doc.setTextColor(...INK)
  })

  // ── Category breakdown ────────────────────────────────────────────────────
  const catMap: Record<string, { total: number; count: number }> = {}
  expenses.forEach((e) => {
    if (!catMap[e.category]) catMap[e.category] = { total: 0, count: 0 }
    catMap[e.category].total += e.total
    catMap[e.category].count++
  })
  const catRows = Object.entries(catMap)
    .map(([id, { total: t, count }]) => {
      const cat = categories.find((c) => c.id === id)
      return { name: cat?.name ?? id, total: t, count, pct: total > 0 ? (t / total) * 100 : 0 }
    })
    .sort((a, b) => b.total - a.total)

  const sectionY1 = boxY + boxH + 8
  doc.setTextColor(...INK)
  doc.setFontSize(9)
  doc.setFont("helvetica", "bold")
  doc.text("DESGLOSE POR CATEGORÍA", margin, sectionY1)
  doc.setDrawColor(...ACCENT)
  doc.setLineWidth(0.4)
  doc.line(margin, sectionY1 + 1.5, margin + 60, sectionY1 + 1.5)

  autoTable(doc, {
    startY: sectionY1 + 5,
    margin: { left: margin, right: margin },
    head: [["Categoría", "Transacciones", "% del total", "Total"]],
    body: catRows.map((r) => [r.name, r.count, `${r.pct.toFixed(1)}%`, formatCurrency(r.total)]),
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: ACCENT, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 248, 252] },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { halign: "center" },
      2: { halign: "center" },
      3: { halign: "right", fontStyle: "bold" },
    },
  })

  // ── Transactions table ────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const afterCats = (doc as any).lastAutoTable.finalY + 8

  doc.setTextColor(...INK)
  doc.setFontSize(9)
  doc.setFont("helvetica", "bold")
  doc.text("DETALLE DE TRANSACCIONES", margin, afterCats)
  doc.setDrawColor(...ACCENT)
  doc.line(margin, afterCats + 1.5, margin + 70, afterCats + 1.5)

  const txRows = [...expenses]
    .sort((a, b) => a.date.toDate().getTime() - b.date.toDate().getTime())
    .map((e) => {
      const cat = categories.find((c) => c.id === e.category)
      return [
        formatDate(toDate(e.date), "dd MMM"),
        e.merchant.length > 28 ? e.merchant.slice(0, 26) + "…" : e.merchant,
        cat?.name ?? e.category,
        e.paymentMethod ?? "—",
        formatCurrency(e.total, e.currency),
      ]
    })

  autoTable(doc, {
    startY: afterCats + 5,
    margin: { left: margin, right: margin },
    head: [["Fecha", "Comercio", "Categoría", "Pago", "Total"]],
    body: txRows,
    styles: { fontSize: 7.5, cellPadding: 2 },
    headStyles: { fillColor: [30, 30, 30], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7.5 },
    alternateRowStyles: { fillColor: [248, 248, 252] },
    columnStyles: {
      0: { cellWidth: 18 },
      1: { cellWidth: "auto" },
      2: { cellWidth: 30 },
      3: { cellWidth: 22 },
      4: { halign: "right", fontStyle: "bold", cellWidth: 24 },
    },
    didDrawPage: (data: { pageNumber: number }) => {
      // Footer on every page
      const pageH = doc.internal.pageSize.getHeight()
      doc.setFontSize(7)
      doc.setTextColor(...MUTED)
      doc.text(
        `ReciboTrack · ${monthLabelCap} · Página ${data.pageNumber}`,
        pageW / 2,
        pageH - 6,
        { align: "center" }
      )
    },
  })

  doc.save(`reporte-${format(monthDate, "yyyy-MM")}.pdf`)
}
