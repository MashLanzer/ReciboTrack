"use client"

import { Timestamp } from "firebase/firestore"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-client"
import { useAuth } from "./use-auth"
import type { WishlistItem, WishlistItemInput } from "@/types"

function rowToWishlistItem(row: Record<string, unknown>): WishlistItem {
  return {
    id:             row.id as string,
    title:          row.title as string,
    url:            (row.url as string) ?? undefined,
    estimatedPrice: row.estimatedPrice != null ? Number(row.estimatedPrice) : undefined,
    currency:       (row.currency as string) ?? "USD",
    addedBy:        row.addedBy as string,
    likes:          (row.likes as string[]) ?? [],
    purchased:      Boolean(row.purchased ?? false),
    purchasedBy:    (row.purchasedBy as string) ?? undefined,
    purchasedAt:    row.purchasedAt
      ? Timestamp.fromDate(new Date(row.purchasedAt as string))
      : undefined,
    createdAt:      row.createdAt
      ? Timestamp.fromDate(new Date(row.createdAt as string))
      : Timestamp.now(),
  }
}

export function useGroupWishlist(groupId: string) {
  const query = useQuery({
    queryKey: ["group-wishlist", groupId],
    enabled: !!groupId,
    refetchInterval: 5000,
    queryFn: async (): Promise<WishlistItem[]> => {
      if (!groupId) return []
      const res = await apiFetch(`/api/groups/${groupId}/wishlist`)
      if (!res.ok) return []
      const rows = await res.json() as Record<string, unknown>[]
      const items = rows.map(rowToWishlistItem)
      return items.sort((a, b) => b.likes.length - a.likes.length)
    },
  })
  return { data: query.data ?? [], isLoading: query.isLoading }
}

export function useAddWishlistItem() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ groupId, input }: { groupId: string; input: WishlistItemInput }) => {
      if (!user) throw new Error("No autenticado")
      const res = await apiFetch(`/api/groups/${groupId}/wishlist`, {
        method: "POST",
        body: JSON.stringify(input),
      })
      if (!res.ok) throw new Error("Error al agregar ítem")
    },
    onSuccess: (_d, { groupId }) => qc.invalidateQueries({ queryKey: ["group-wishlist", groupId] }),
  })
}

export function useLikeWishlistItem() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ groupId, itemId, liked }: { groupId: string; itemId: string; liked: boolean }) => {
      if (!user) throw new Error("No autenticado")
      const res = await apiFetch(`/api/groups/${groupId}/wishlist/${itemId}`, {
        method: "PATCH",
        body: JSON.stringify({ liked }),
      })
      if (!res.ok) throw new Error("Error al actualizar like")
    },
    onSuccess: (_d, { groupId }) => qc.invalidateQueries({ queryKey: ["group-wishlist", groupId] }),
  })
}

export function useMarkWishlistPurchased() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ groupId, itemId }: { groupId: string; itemId: string }) => {
      if (!user) throw new Error("No autenticado")
      const res = await apiFetch(`/api/groups/${groupId}/wishlist/${itemId}`, {
        method: "PATCH",
        body: JSON.stringify({
          purchased:   true,
          purchasedBy: user.uid,
          purchasedAt: new Date().toISOString(),
        }),
      })
      if (!res.ok) throw new Error("Error al marcar como comprado")
    },
    onSuccess: (_d, { groupId }) => qc.invalidateQueries({ queryKey: ["group-wishlist", groupId] }),
  })
}
