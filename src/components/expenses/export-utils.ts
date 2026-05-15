import type { Expense, CategoryDoc } from "@/types"
import { formatDate, formatCurrency, toDate } from "@/lib/utils"

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
