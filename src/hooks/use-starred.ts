"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useAuth } from "./use-auth"
import { apiFetch } from "@/lib/api-client"

export interface StarredData {
  categories: string[]
  merchants: string[]
}

const EMPTY: StarredData = { categories: [], merchants: [] }

export function useStarred() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ["starred", user?.uid],
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<StarredData> => {
      if (!user) return EMPTY
      const res = await apiFetch("/api/starred")
      if (!res.ok) return EMPTY
      const data = await res.json() as Partial<StarredData>
      return { ...EMPTY, ...data }
    },
  })
}

export function useToggleStarCategory() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ categoryId, isStarred }: { categoryId: string; isStarred: boolean }) => {
      if (!user) throw new Error("No autenticado")
      const current = queryClient.getQueryData<StarredData>(["starred", user.uid]) ?? EMPTY
      const categories = isStarred
        ? current.categories.filter((c) => c !== categoryId)
        : [...current.categories, categoryId]
      const res = await apiFetch("/api/starred", {
        method: "PATCH",
        body: JSON.stringify({ categories }),
      })
      if (!res.ok) throw new Error("Error al actualizar favoritos")
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["starred", user?.uid] }),
  })
}

export function useToggleStarMerchant() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ merchant, isStarred }: { merchant: string; isStarred: boolean }) => {
      if (!user) throw new Error("No autenticado")
      const current = queryClient.getQueryData<StarredData>(["starred", user.uid]) ?? EMPTY
      const merchants = isStarred
        ? current.merchants.filter((m) => m !== merchant)
        : [...current.merchants, merchant]
      const res = await apiFetch("/api/starred", {
        method: "PATCH",
        body: JSON.stringify({ merchants }),
      })
      if (!res.ok) throw new Error("Error al actualizar favoritos")
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["starred", user?.uid] }),
  })
}
