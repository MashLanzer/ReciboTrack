"use client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { collection, query, where, getDocs, setDoc, deleteDoc, doc, Timestamp } from "firebase/firestore"
import { getFirebaseDb } from "@/lib/firebase/client"
import { useAuth } from "./use-auth"
import { startOfMonth, endOfMonth } from "date-fns"
import { toast } from "sonner"
import { stripUndefined } from "@/lib/utils"

export interface Income {
  id: string
  amount: number
  currency: string
  source: string
  description?: string
  date: Timestamp
  recurring: boolean
  account?: "personal" | "business"
}

export interface IncomeInput {
  amount: number
  currency: string
  source: string
  description?: string
  date: Date
  recurring: boolean
  account?: "personal" | "business"
}

function incomeCol(uid: string) {
  return collection(getFirebaseDb(), "users", uid, "income")
}

// Shared fetch: gets income for a date range WITHOUT orderBy to avoid composite-index errors.
// Results are sorted client-side (desc by date) which is equally fast for typical income counts.
async function fetchIncomeRange(uid: string, start: Date, end: Date): Promise<Income[]> {
  const q = query(
    incomeCol(uid),
    where("date", ">=", Timestamp.fromDate(start)),
    where("date", "<=", Timestamp.fromDate(end)),
  )
  const snap = await getDocs(q)
  const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Income)
  // Sort descending by date on the client — avoids needing a Firestore composite index
  return docs.sort((a, b) => b.date.toMillis() - a.date.toMillis())
}

export function useIncome(year: number, month: number) {
  const { user } = useAuth()
  const start = startOfMonth(new Date(year, month - 1))
  const end   = endOfMonth(new Date(year, month - 1))
  return useQuery({
    queryKey: ["income", user?.uid, year, month],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [] as Income[]
      return fetchIncomeRange(user.uid, start, end)
    },
  })
}

export function useIncomePeriod(start: Date, end: Date) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ["income", user?.uid, "period", start.toISOString(), end.toISOString()],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [] as Income[]
      return fetchIncomeRange(user.uid, start, end)
    },
  })
}

export function useAddIncome() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: IncomeInput) => {
      if (!user) throw new Error("No auth")
      // setDoc+doc() avoids Firebase v12 internal __list__ bug on new subcollections
      const newRef = doc(incomeCol(user.uid))
      // stripUndefined removes optional fields left as undefined (e.g. empty description)
      // Firestore rejects documents with `undefined` field values
      const data = stripUndefined({
        amount:    input.amount,
        currency:  input.currency,
        source:    input.source,
        date:      Timestamp.fromDate(input.date),
        recurring: input.recurring,
        ...(input.description ? { description: input.description } : {}),
        ...(input.account     ? { account:     input.account }     : {}),
      })
      await setDoc(newRef, data as Record<string, unknown>)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["income", user?.uid] })
      toast.success("Ingreso añadido")
    },
    onError: (err) => {
      console.error("[useAddIncome]", err)
      toast.error("Error al añadir ingreso")
    },
  })
}

export function useDeleteIncome() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("No auth")
      await deleteDoc(doc(getFirebaseDb(), "users", user.uid, "income", id))
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["income", user?.uid] })
      toast.success("Ingreso eliminado")
    },
    onError: (err) => {
      console.error("[useDeleteIncome]", err)
      toast.error("Error al eliminar ingreso")
    },
  })
}
