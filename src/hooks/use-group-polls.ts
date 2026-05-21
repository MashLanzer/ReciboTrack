"use client"

import { Timestamp } from "firebase/firestore"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-client"
import { useAuth } from "./use-auth"

export interface PollOption {
  id: string
  label: string
  votes: string[]
}

export interface GroupPoll {
  id: string
  question: string
  options: PollOption[]
  status: "open" | "closed"
  result?: string
  splitMethod?: "equal" | "proportional"
  createdBy: string
  createdAt: Timestamp
  closesAt?: Timestamp
}

function rowToPoll(row: Record<string, unknown>): GroupPoll {
  return {
    id:          row.id as string,
    question:    row.question as string,
    options:     (row.options as PollOption[]) ?? [],
    status:      (row.status as "open" | "closed") ?? "open",
    result:      (row.result as string) ?? undefined,
    splitMethod: (row.splitMethod as "equal" | "proportional") ?? undefined,
    createdBy:   (row.createdBy as string) ?? "",
    createdAt:   row.createdAt
      ? Timestamp.fromDate(new Date(row.createdAt as string))
      : Timestamp.now(),
    closesAt:    row.closesAt
      ? Timestamp.fromDate(new Date(row.closesAt as string))
      : undefined,
  }
}

export function useGroupPolls(groupId: string) {
  const query = useQuery({
    queryKey: ["group-polls", groupId],
    enabled: !!groupId,
    refetchInterval: 5000,
    queryFn: async (): Promise<GroupPoll[]> => {
      if (!groupId) return []
      const res = await apiFetch(`/api/groups/${groupId}/polls`)
      if (!res.ok) return []
      const rows = await res.json() as Record<string, unknown>[]
      return rows.map(rowToPoll)
    },
  })
  return { data: query.data ?? [], isLoading: query.isLoading }
}

export function useCreatePoll() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      groupId, question, options, closesAt,
    }: {
      groupId: string; question: string; options: string[]; closesAt?: Date
    }) => {
      if (!user) throw new Error("No autenticado")
      const pollOptions: PollOption[] = options.map((label, i) => ({
        id: `opt_${i}`, label, votes: [],
      }))
      const res = await apiFetch(`/api/groups/${groupId}/polls`, {
        method: "POST",
        body: JSON.stringify({
          question,
          options: pollOptions,
          closesAt: closesAt?.toISOString(),
        }),
      })
      if (!res.ok) throw new Error("Error al crear encuesta")
    },
    onSuccess: (_d, { groupId }) => qc.invalidateQueries({ queryKey: ["group-polls", groupId] }),
  })
}

export function useVotePoll() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      groupId, pollId, optionId, currentOptions,
    }: {
      groupId: string; pollId: string; optionId: string; currentOptions: PollOption[]
    }) => {
      if (!user) throw new Error("No autenticado")
      const updated = currentOptions.map((opt) => {
        const alreadyVoted = opt.votes.includes(user.uid)
        if (opt.id === optionId) {
          return {
            ...opt,
            votes: alreadyVoted
              ? opt.votes.filter((u) => u !== user.uid)
              : [...opt.votes, user.uid],
          }
        }
        return { ...opt, votes: opt.votes.filter((u) => u !== user.uid) }
      })
      const res = await apiFetch(`/api/groups/${groupId}/polls/${pollId}`, {
        method: "PATCH",
        body: JSON.stringify({ options: updated }),
      })
      if (!res.ok) throw new Error("Error al votar")
    },
    onSuccess: (_d, { groupId }) => qc.invalidateQueries({ queryKey: ["group-polls", groupId] }),
  })
}

export function useClosePoll() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      groupId, pollId, options,
    }: { groupId: string; pollId: string; options: PollOption[] }) => {
      const winner = [...options].sort((a, b) => b.votes.length - a.votes.length)[0]
      const res = await apiFetch(`/api/groups/${groupId}/polls/${pollId}`, {
        method: "PATCH",
        body: JSON.stringify({
          status:   "closed",
          result:   winner?.id ?? null,
          closedAt: new Date().toISOString(),
        }),
      })
      if (!res.ok) throw new Error("Error al cerrar encuesta")
    },
    onSuccess: (_d, { groupId }) => qc.invalidateQueries({ queryKey: ["group-polls", groupId] }),
  })
}
