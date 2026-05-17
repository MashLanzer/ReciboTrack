"use client"

import {
  collection,
  addDoc,
  updateDoc,
  doc,
  Timestamp,
  arrayUnion,
  onSnapshot,
  query,
  orderBy,
  where,
  getDocs,
} from "firebase/firestore"
import { useEffect, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { getFirebaseDb } from "@/lib/firebase/client"
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

function betsCollection(groupId: string) {
  return collection(getFirebaseDb(), "groups", groupId, "bets")
}

export function useGroupBets(groupId: string) {
  const [bets, setBets] = useState<GroupBet[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!groupId) return
    const col = betsCollection(groupId)
    const q = query(col, orderBy("createdAt", "desc"))
    const unsub = onSnapshot(q, (snap) => {
      setBets(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as GroupBet))
      setIsLoading(false)
    }, () => setIsLoading(false))
    return unsub
  }, [groupId])

  return { bets, isLoading }
}

export function useCreateBet(groupId: string) {
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (input: GroupBetInput) => {
      if (!user) throw new Error("No autenticado")
      const col = betsCollection(groupId)
      const now = Timestamp.now()
      const endsAt = input.period === "week"
        ? Timestamp.fromMillis(now.toMillis() + 7 * 24 * 60 * 60 * 1000)
        : Timestamp.fromMillis(now.toMillis() + 30 * 24 * 60 * 60 * 1000)

      const ref = await addDoc(col, {
        title: input.title,
        creatorId: user.uid,
        creatorName: user.displayName ?? user.email ?? "Usuario",
        category: input.category ?? null,
        targetAmount: input.targetAmount,
        currency: input.currency,
        period: input.period,
        stake: input.stake,
        participants: [user.uid],
        status: "open",
        createdAt: now,
        endsAt,
      })
      return ref.id
    },
  })
}

export function useJoinBet(groupId: string) {
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (betId: string) => {
      if (!user) throw new Error("No autenticado")
      const ref = doc(getFirebaseDb(), "groups", groupId, "bets", betId)
      await updateDoc(ref, {
        participants: arrayUnion(user.uid),
        status: "active",
      })
    },
  })
}

export function useResolveBet(groupId: string) {
  const { user } = useAuth()

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
      if (!user) throw new Error("No autenticado")

      // Winner = participant who spent the least (stayed under budget)
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

      const ref = doc(getFirebaseDb(), "groups", groupId, "bets", betId)
      await updateDoc(ref, {
        status: "resolved",
        result: {
          winnerId,
          winnerName,
          actualAmount: winnerAmount,
        },
      })
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
        const col = collection(getFirebaseDb(), "users", uid, "expenses")
        const constraints = [
          where("date", ">=", Timestamp.fromDate(startDate)),
          where("date", "<=", Timestamp.fromDate(endDate)),
          orderBy("date", "desc"),
        ]
        const q = query(col, ...constraints)
        const snap = await getDocs(q)
        let total = 0
        snap.docs.forEach((d) => {
          const data = d.data()
          if (!category || data.category === category) {
            total += data.total as number
          }
        })
        results[uid] = total
      })
    )

    return results
  }
}
