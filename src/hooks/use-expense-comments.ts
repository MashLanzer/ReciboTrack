"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-client"

export interface ExpenseComment {
  id: string
  expense_id: string
  uid: string
  body: string
  created_at: string
}

export function useExpenseComments(expenseId: string) {
  return useQuery<ExpenseComment[]>({
    queryKey: ["expense-comments", expenseId],
    enabled: !!expenseId,
    queryFn: async () => {
      const res = await apiFetch(`/api/expenses/${expenseId}/comments`)
      if (!res.ok) throw new Error("Error al cargar comentarios")
      const { comments } = (await res.json()) as { comments: ExpenseComment[] }
      return comments
    },
  })
}

export function useAddComment(expenseId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: string) => {
      const res = await apiFetch(`/api/expenses/${expenseId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      })
      if (!res.ok) {
        const err = (await res.json()) as { error?: string }
        throw new Error(err.error ?? "Error al añadir comentario")
      }
      return res.json() as Promise<{ comment: ExpenseComment }>
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["expense-comments", expenseId] })
    },
  })
}

export function useDeleteComment(expenseId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (commentId: string) => {
      const res = await apiFetch(
        `/api/expenses/${expenseId}/comments/${commentId}`,
        { method: "DELETE" }
      )
      if (!res.ok) {
        const err = (await res.json()) as { error?: string }
        throw new Error(err.error ?? "Error al eliminar comentario")
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["expense-comments", expenseId] })
    },
  })
}
