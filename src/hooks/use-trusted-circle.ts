"use client"

import { Timestamp } from "firebase/firestore"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useAuth } from "./use-auth"
import type { TrustedCircleMember, TrustedCircleMemberInput } from "@/types"
import { apiFetch } from "@/lib/api-client"

function rowToMember(row: Record<string, unknown>): TrustedCircleMember {
  return {
    id:               row.id as string,
    userId:           (row.userId as string) ?? "",
    displayName:      (row.displayName as string) ?? "",
    email:            row.email as string,
    addedAt:          row.addedAt
      ? Timestamp.fromDate(new Date(row.addedAt as string))
      : Timestamp.now(),
    canSeeFullBudget: (row.canSeeFullBudget as boolean) ?? false,
    linked:           (row.linked as boolean) ?? false,
  }
}

export function useTrustedCircle() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ["trustedCircle", user?.uid],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [] as TrustedCircleMember[]
      const res = await apiFetch("/api/trusted-circle")
      if (!res.ok) throw new Error("Error cargando círculo de confianza")
      const rows = await res.json() as Record<string, unknown>[]
      return rows.map(rowToMember)
    },
  })
}

export function useAddToTrustedCircle() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: TrustedCircleMemberInput) => {
      if (!user) throw new Error("No autenticado")
      const res = await apiFetch("/api/trusted-circle", {
        method: "POST",
        body: JSON.stringify(input),
      })
      if (!res.ok) throw new Error("Error al añadir miembro")
      const json = await res.json() as { id: string }
      return json.id
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["trustedCircle", user?.uid] }),
  })
}

export function useRemoveFromTrustedCircle() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (memberId: string) => {
      if (!user) throw new Error("No autenticado")
      const res = await apiFetch(`/api/trusted-circle/${memberId}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Error al eliminar miembro")
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["trustedCircle", user?.uid] }),
  })
}

export function useUpdateTrustedCirclePermissions() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ memberId, canSeeFullBudget }: { memberId: string; canSeeFullBudget: boolean }) => {
      if (!user) throw new Error("No autenticado")
      const res = await apiFetch(`/api/trusted-circle/${memberId}`, {
        method: "PATCH",
        body: JSON.stringify({ canSeeFullBudget }),
      })
      if (!res.ok) throw new Error("Error al actualizar permisos")
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["trustedCircle", user?.uid] }),
  })
}
