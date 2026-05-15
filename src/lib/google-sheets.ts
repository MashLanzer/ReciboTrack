"use client"

import { GoogleAuthProvider, signInWithPopup } from "firebase/auth"
import { getFirebaseAuth } from "@/lib/firebase/client"
import type { Expense, CategoryDoc } from "@/types"
import { formatCurrency, toDate } from "@/lib/utils"
import { format } from "date-fns"
import { es } from "date-fns/locale"

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets"
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file"

async function getGoogleAccessToken(): Promise<string> {
  const provider = new GoogleAuthProvider()
  provider.addScope(SHEETS_SCOPE)
  provider.addScope(DRIVE_SCOPE)

  // signInWithPopup re-uses the existing session but requests new scopes
  const result = await signInWithPopup(getFirebaseAuth(), provider)
  const credential = GoogleAuthProvider.credentialFromResult(result)

  if (!credential?.accessToken) {
    throw new Error("No se pudo obtener el token de Google")
  }

  return credential.accessToken
}

export async function exportToGoogleSheets(
  expenses: Expense[],
  categories: CategoryDoc[],
  title = `ReciboTrack — Gastos ${format(new Date(), "MMMM yyyy", { locale: es })}`
): Promise<string> {
  const accessToken = await getGoogleAccessToken()

  // ── Build spreadsheet values ──────────────────────────────────────────────
  const headers = [
    "Fecha", "Comercio", "Categoría", "Subtotal", "Impuestos", "Total",
    "Moneda", "Método de pago", "Referencia", "Notas", "Etiquetas",
  ]

  const rows = expenses.map((e) => {
    const cat = categories.find((c) => c.id === e.category)
    const date = toDate(e.date)
    return [
      format(date, "dd/MM/yyyy"),
      e.merchant,
      cat?.name ?? e.category,
      e.subtotal,
      e.tax,
      e.total,
      e.currency,
      e.paymentMethod ?? "",
      e.reference ?? "",
      e.notes ?? "",
      (e.tags ?? []).join(", "),
    ]
  })

  // Totals row
  const totalAmount = expenses.reduce((a, e) => a + e.total, 0)
  const totalsRow = ["TOTAL", "", "", "", "", totalAmount, "", "", "", "", ""]

  // ── Create spreadsheet ────────────────────────────────────────────────────
  const createRes = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: { title, locale: "es_ES", timeZone: "America/Caracas" },
      sheets: [{
        properties: { title: "Gastos", gridProperties: { frozenRowCount: 1 } },
      }],
    }),
  })

  if (!createRes.ok) {
    const err = await createRes.json()
    throw new Error(err?.error?.message ?? "Error creando hoja de cálculo")
  }

  const spreadsheet = await createRes.json()
  const spreadsheetId: string = spreadsheet.spreadsheetId
  const sheetId: number = spreadsheet.sheets[0].properties.sheetId

  // ── Write data ────────────────────────────────────────────────────────────
  const allRows = [headers, ...rows, [], totalsRow]
  const range = `Gastos!A1:K${allRows.length}`

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values: allRows }),
    }
  )

  // ── Format: bold header, alternate rows, total row ────────────────────────
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: [
          // Bold header row
          {
            repeatCell: {
              range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
              cell: { userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.08, green: 0.08, blue: 0.08 } } },
              fields: "userEnteredFormat(textFormat,backgroundColor)",
            },
          },
          // Bold totals row
          {
            repeatCell: {
              range: { sheetId, startRowIndex: allRows.length - 1, endRowIndex: allRows.length },
              cell: { userEnteredFormat: { textFormat: { bold: true } } },
              fields: "userEnteredFormat(textFormat)",
            },
          },
          // Auto-resize columns
          {
            autoResizeDimensions: {
              dimensions: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: 11 },
            },
          },
          // Freeze header
          {
            updateSheetProperties: {
              properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
              fields: "gridProperties.frozenRowCount",
            },
          },
        ],
      }),
    }
  )

  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
}
