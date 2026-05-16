"use client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { collection, query, where, orderBy, getDocs, addDoc, deleteDoc, doc, Timestamp } from "firebase/firestore"
import { getFirebaseDb } from "@/lib/firebase/client"
import { useAuth } from "./use-auth"
import { startOfMonth, endOfMonth } from "date-fns"
import { toast } from "sonner"

export interface Income {
  id: string
  amount: number
  currency: string
  source: string        // "Nómina", "Freelance", "Alquiler", "Inversiones", "Otro"
  description?: string
  date: Timestamp
  recurring: boolean    // si es un ingreso mensual recurrente
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

export function useIncome(year: number, month: number) {
  const { user } = useAuth()
  const start = startOfMonth(new Date(year, month - 1))
  const end = endOfMonth(new Date(year, month - 1))
  return useQuery({
    queryKey: ["income", user?.uid, year, month],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return []
      const q = query(
        incomeCol(user.uid),
        where("date", ">=", Timestamp.fromDate(start)),
        where("date", "<=", Timestamp.fromDate(end)),
        orderBy("date", "desc")
      )
      const snap = await getDocs(q)
      return snap.docs.map(d => ({ id: d.id, ...d.data() }) as Income)
    },
  })
}

export function useAddIncome() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: IncomeInput) => {
      if (!user) throw new Error("No auth")
      await addDoc(incomeCol(user.uid), { ...input, date: Timestamp.fromDate(input.date) })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["income"] })
      toast.success("Ingreso añadido")
    },
    onError: () => toast.error("Error al añadir ingreso"),
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
      qc.invalidateQueries({ queryKey: ["income"] })
      toast.success("Ingreso eliminado")
    },
  })
}
