"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useAuth } from "./use-auth"
import type { CategoryDoc } from "@/types"
import type { CategoryFormInput } from "@/lib/firebase/schemas"
import { apiFetch } from "@/lib/api-client"

function rowToCategory(row: Record<string, unknown>): CategoryDoc {
  return {
    id:        row.id as string,
    name:      row.name as string,
    icon:      (row.icon as string) ?? "",
    color:     (row.color as string) ?? "#6b7280",
    isDefault: (row.isDefault as boolean) ?? false,
  }
}

export function useCategories() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ["categories", user?.uid],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [] as CategoryDoc[]
      const res = await apiFetch("/api/categories")
      if (!res.ok) throw new Error("Error cargando categorías")
      const rows = await res.json() as Record<string, unknown>[]
      return rows.map(rowToCategory)
    },
  })
}

export function useAddCategory() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CategoryFormInput) => {
      if (!user) throw new Error("No autenticado")
      const res = await apiFetch("/api/categories", {
        method: "POST",
        body: JSON.stringify(input),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(err.error ?? "Error al crear categoría")
      }
      const json = await res.json() as { id: string }
      return json.id
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["categories", user?.uid] }),
  })
}

export function useUpdateCategory() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: Partial<CategoryFormInput> }) => {
      if (!user) throw new Error("No autenticado")
      const res = await apiFetch(`/api/categories/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      })
      if (!res.ok) throw new Error("Error al actualizar categoría")
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["categories", user?.uid] }),
  })
}

export function useDeleteCategory() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("No autenticado")
      const res = await apiFetch(`/api/categories/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Error al eliminar categoría")
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["categories", user?.uid] }),
  })
}

export function useReorderCategories() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (order: string[]) => {
      if (!user) throw new Error("No autenticado")
      const res = await apiFetch("/api/categories/reorder", {
        method: "PATCH",
        body: JSON.stringify({ order }),
      })
      if (!res.ok) throw new Error("Error al reordenar categorías")
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["categories", user?.uid] }),
  })
}
