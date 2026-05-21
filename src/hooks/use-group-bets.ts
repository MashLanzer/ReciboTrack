"use client"

import { Timestamp } from "firebase/firestore"
import { useQuery, useMutation } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-client"
import { useAuth } from "./use-auth"

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface GroupBet {
  id: string
  title: string
  creatorId: string
  creatorName: string
  category?: string
  targetAmount: number
  currency: string
  period: "week" | "month"
  stake: string
  participants: string[]
  status: "open" | "active" | "resolved"
  result?: {
    winnerId: string
    winnerName: string
    actualAmount: number
  }
  createdAt: Timestamp
  endsAt: Timestamp
}

export interface GroupBetInput {
  title: string
  category?: string
  targetAmount: number
  currency: string
  period: "week" | "month"
  stake: string
}

// ─── Hooks ─────────────────────────────────────────────────────────────────────

function rowToBet(row: Record<string, unknown>): GroupBet {
  return {
    id:           row.id as string,
    title:        row.title as string,
    creatorId:    (row.creatorId as string) ?? "",
    creatorName:  (row.creatorName as string) ?? "",
    category:     (row.category as string) ?? undefined,
    targetAmount: Number(row.targetAmount ?? 0),
    currency:     (row.currency as string) ?? "USD",
    period:       (row.period as "week" | "month") ?? "month",
    stake:        (row.stake as string) ?? "",
    participants: (row.participants as string[]) ?? [],
    status:       (row.status as "open" | "active" | "resolved") ?? "open",
    result:       (row.result as GroupBet["result"]) ?? undefined,
    createdAt:    row.createdAt
      ? Timestamp.fromDate(new Date(row.createdAt as string))
      : Timestamp.now(),
    endsAt:       row.endsAt
      ? Timestamp.fromDate(new Date(row.endsAt as string))
      : Timestamp.now(),
  }
}

export function useGroupBets(groupId: string) {
  const query = useQuery({
    queryKey: ["group-bets", groupId],
    enabled: !!groupId,
    refetchInterval: 5000,
    queryFn: async (): Promise<GroupBet[]> => {
      if (!groupId) return []
      const res = await apiFetch(`/api/groups/${groupId}/bets`)
      if (!res.ok) return []
      const rows = await res.json() as Record<string, unknown>[]
      return rows.map(rowToBet)
    },
  })
  return { bets: query.data ?? [], isLoading: query.isLoading }
}

export function useCreateBet(groupId: string) {
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (input: GroupBetInput) => {
      if (!user) throw new Error("No autenticado")
      const now = new Date()
      const endsAt = new Date(now.getTime() + (input.period === "week" ? 7 : 30) * 24 * 60 * 60 * 1000)

      const res = await apiFetch(`/api/groups/${groupId}/bets`, {
        method: "POST",
        body: JSON.stringify({
          ...input,
          creatorName: user.displayName ?? user.email ?? "Usuario",
          endsAt:      endsAt.toISOString(),
        }),
      })
      if (!res.ok) throw new Error("Error al crear apuesta")
      const data = await res.json() as { id: string }
      return data.id
    },
  })
}

export function useJoinBet(groupId: string) {
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (betId: string) => {
      if (!user) throw new Error("No autenticado")
      // El servidor lee los participantes actuales y agrega al usuario
      const res = await apiFetch(`/api/groups/${groupId}/bets/${betId}/join`, {
        method: "POST",
      })
      if (!res.ok) throw new Error("Error al unirse a la apuesta")
    },
  })
}

export function useResolveBet(groupId: string) {
  return useMutation({
    mutationFn: async ({
      betId,
      participants,
      memberExpenses,
    }: {
      betId: string
      participants: { uid: string; displayName: string }[]
      memberExpenses: Record<string, number>
    }) => {
      let winnerId = ""
      let winnerName = ""
      let winnerAmount = Infinity

      for (const p of participants) {
        const spent = memberExpenses[p.uid] ?? 0
        if (spent < winnerAmount) {
          winnerAmount = spent
          winnerId = p.uid
          winnerName = p.displayName
        }
      }

      const res = await apiFetch(`/api/groups/${groupId}/bets/${betId}`, {
        method: "PATCH",
        body: JSON.stringify({
          status:     "resolved",
          resultData: { winnerId, winnerName, actualAmount: winnerAmount },
        }),
      })
      if (!res.ok) throw new Error("Error al resolver la apuesta")
    },
  })
}

/** Fetch personal expenses for bet participants within the bet period */
export function useBetParticipantExpenses() {
  const { user } = useAuth()

  return async (
    participantUids: string[],
    startDate: Date,
    endDate: Date,
    category?: string
  ): Promise<Record<string, number>> => {
    if (!user) return {}

    const results: Record<string, number> = {}

    await Promise.all(
      participantUids.map(async (uid) => {
        const params = new URLSearchParams({
          startDate: startDate.toISOString(),
          endDate:   endDate.toISOString(),
          ...(category ? { category } : {}),
          all:       "true",
        })
        const res = await apiFetch(`/api/expenses?${params.toString()}`)
        if (!res.ok) { results[uid] = 0; return }
        const expenses = await res.json() as Array<{ total: number; category: string }>
        results[uid] = expenses
          .filter((e) => !category || e.category === category)
          .reduce((s, e) => s + e.total, 0)
      })
    )

    return results
  }
}
