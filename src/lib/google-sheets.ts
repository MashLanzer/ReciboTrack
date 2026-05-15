"use client"

import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
} from "firebase/auth"
import { getFirebaseAuth } from "@/lib/firebase/client"
import type { Expense, CategoryDoc } from "@/types"
import { formatCurrency, toDate } from "@/lib/utils"
import { format } from "date-fns"
import { es } from "date-fns/locale"

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets"
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file"

const SHEETS_PENDING_KEY = "sheets_export_pending"

/**
 * Obtiene un access token de Google con los scopes necesarios para Sheets.
 *
 * Estrategia:
 * 1. Intenta signInWithPopup (Chrome/Firefox sin tracking prevention estricto).
 * 2. Si el popup es bloqueado o falla por tracking prevention, usa signInWithRedirect.
 *    En ese caso lanza SheetsRedirectPending para que el llamador maneje el redirect.
 */
async function getGoogleAccessToken(): Promise<string> {
  const provider = new GoogleAuthProvider()
  provider.addScope(SHEETS_SCOPE)
  provider.addScope(DRIVE_SCOPE)
  provider.setCustomParameters({ prompt: "consent" })

  try {
    // Intento 1: popup (rápido, no recarga la página)
    const result = await signInWithPopup(getFirebaseAuth(), provider)
    const credential = GoogleAuthProvider.credentialFromResult(result)
    if (!credential?.accessToken) throw new Error("Sin token")
    return credential.accessToken
  } catch (err: unknown) {
    const code = (err as { code?: string }).code ?? ""
    // Popup bloqueado o tracking prevention — usar redirect
    if (
      code === "auth/popup-blocked" ||
      code === "auth/popup-closed-by-user" ||
      code === "auth/cancelled-popup-request" ||
      code === "auth/operation-not-supported-in-this-environment"
    ) {
      // Guardar la intención en sessionStorage para retomar al volver
      sessionStorage.setItem(SHEETS_PENDING_KEY, "1")
      await signInWithRedirect(getFirebaseAuth(), provider)
      // La página se redirige — nunca llega a la siguiente línea
      throw new SheetsRedirectPending()
    }
    throw err
  }
}

/** Señal especial: se lanzó un redirect, no es un error real */
export class SheetsRedirectPending extends Error {
  constructor() { super("redirect_pending") }
}

/**
 * Llamar en el layout o en la página de vuelta del redirect.
 * Devuelve la URL de la hoja si se venía de un redirect de Sheets, null si no.
 */
export async function resumeSheetsExportAfterRedirect(
  expenses: Expense[],
  categories: CategoryDoc[]
): Promise<string | null> {
  if (!sessionStorage.getItem(SHEETS_PENDING_KEY)) return null
  sessionStorage.removeItem(SHEETS_PENDING_KEY)

  const result = await getRedirectResult(getFirebaseAuth())
  if (!result) return null

  const credential = GoogleAuthProvider.credentialFromResult(result)
  if (!credential?.accessToken) throw new Error("No se pudo obtener el token de Google")

  return buildSpreadsheet(credential.accessToken, expenses, categories)
}

// ─── Internal: build and format the spreadsheet ───────────────────────────

async function buildSpreadsheet(
  accessToken: string,
  expenses: Expense[],
  categories: CategoryDoc[],
  title = `ReciboTrack — Gastos ${format(new Date(), "MMMM yyyy", { locale: es })}`
): Promise<string> {
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

// ─── Public API ────────────────────────────────────────────────────────────

export async function exportToGoogleSheets(
  expenses: Expense[],
  categories: CategoryDoc[],
  title?: string
): Promise<string> {
  const accessToken = await getGoogleAccessToken()
  return buildSpreadsheet(accessToken, expenses, categories, title)
}
