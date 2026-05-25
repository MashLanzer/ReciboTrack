"use client"

import { useState } from "react"
import { useAuth } from "./use-auth"
import { useQueryClient } from "@tanstack/react-query"

export function useBankImport() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [importing, setImporting] = useState(false)

  async function importFile(file: File, bankFormat: string, currency: string) {
    setImporting(true)
    const token = await user?.getIdToken()
    const fd = new FormData()
    fd.append("file", file)
    fd.append("bankFormat", bankFormat)
    fd.append("currency", currency)
    const res = await fetch("/api/import/bank-csv", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    })
    const data = await res.json()
    qc.invalidateQueries({ queryKey: ["expenses"] })
    setImporting(false)
    return data as { imported: number; skipped: number; errors: string[] }
  }

  return { importFile, importing }
}
