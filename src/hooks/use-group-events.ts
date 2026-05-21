"use client"

import { Timestamp } from "firebase/firestore"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-client"
import { useAuth } from "./use-auth"

export interface GroupEvent {
  id: string
  title: string
  date: Timestamp
  totalCost: number
  currency: string
  splitMethod: "equal" | "proportional"
  attendees: string[]
  createdBy: string
  createdAt: Timestamp
  settled: boolean
}

function rowToEvent(row: Record<string, unknown>): GroupEvent {
  return {
    id:          row.id as string,
    title:       row.title as string,
    date:        row.date
      ? Timestamp.fromDate(new Date(row.date as string))
      : Timestamp.now(),
    totalCost:   Number(row.totalCost ?? 0),
    currency:    (row.currency as string) ?? "USD",
    splitMethod: (row.splitMethod as "equal" | "proportional") ?? "equal",
    attendees:   (row.attendees as string[]) ?? [],
    createdBy:   (row.createdBy as string) ?? "",
    createdAt:   row.createdAt
      ? Timestamp.fromDate(new Date(row.createdAt as string))
      : Timestamp.now(),
    settled:     Boolean(row.settled ?? false),
  }
}

export function useGroupEvents(groupId: string) {
  const query = useQuery({
    queryKey: ["group-events", groupId],
    enabled: !!groupId,
    refetchInterval: 5000,  // polling cada 5s en lugar de onSnapshot
    queryFn: async (): Promise<GroupEvent[]> => {
      if (!groupId) return []
      const res = await apiFetch(`/api/groups/${groupId}/events`)
      if (!res.ok) return []
      const rows = await res.json() as Record<string, unknown>[]
      return rows.map(rowToEvent)
    },
  })
  return { data: query.data ?? [], isLoading: query.isLoading }
}

export function useAddGroupEvent() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      groupId, title, date, totalCost, currency, splitMethod,
    }: {
      groupId: string; title: string; date: Date
      totalCost: number; currency: string; splitMethod: "equal" | "proportional"
    }) => {
      if (!user) throw new Error("No autenticado")
      const res = await apiFetch(`/api/groups/${groupId}/events`, {
        method: "POST",
        body: JSON.stringify({ title, date: date.toISOString(), totalCost, currency, splitMethod }),
      })
      if (!res.ok) throw new Error("Error al crear evento")
    },
    onSuccess: (_d, { groupId }) => {
      qc.invalidateQueries({ queryKey: ["group-events", groupId] })
    },
  })
}

export function useRsvpEvent() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      groupId, eventId, attending,
    }: {
      groupId: string; eventId: string; attending: boolean
    }) => {
      if (!user) throw new Error("No autenticado")
      // El servidor lee los attendees actuales y aplica el RSVP
      const res = await apiFetch(`/api/groups/${groupId}/events/${eventId}/rsvp`, {
        method: "POST",
        body: JSON.stringify({ attending }),
      })
      if (!res.ok) throw new Error("Error al actualizar RSVP")
    },
    onSuccess: (_d, { groupId }) => {
      qc.invalidateQueries({ queryKey: ["group-events", groupId] })
    },
  })
}

export function useSettleEvent() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      groupId,
      event,
      memberMap,
    }: {
      groupId: string
      event: GroupEvent
      memberMap: Map<string, string>
    }) => {
      if (!user) throw new Error("No autenticado")
      const { attendees, totalCost, currency, splitMethod } = event
      if (attendees.length === 0) return

      const sharePerAttendee = totalCost / attendees.length

      // Crear un gasto de grupo por cada asistente que no sea el pagador
      for (const uid of attendees) {
        if (uid === user.uid) continue
        await apiFetch(`/api/groups/${groupId}/expenses`, {
          method: "POST",
          body: JSON.stringify({
            merchant:    event.title,
            date:        event.date.toDate().toISOString(),
            items:       [],
            subtotal:    sharePerAttendee,
            tax:         0,
            total:       sharePerAttendee,
            category:    "ocio",
            currency,
            notes:       `Evento: ${event.title}`,
            tags:        ["evento"],
            paidByUid:   user.uid,
            paidByName:  memberMap.get(user.uid) ?? "Yo",
            splitWith:   [uid],
            splitType:   splitMethod === "equal" ? "equal" : "custom",
          }),
        })
      }

      // Marcar evento como liquidado
      await apiFetch(`/api/groups/${groupId}/events/${event.id}`, {
        method: "PATCH",
        body: JSON.stringify({ settled: true }),
      })
    },
    onSuccess: (_d, { groupId }) => {
      qc.invalidateQueries({ queryKey: ["group-expenses", groupId] })
      qc.invalidateQueries({ queryKey: ["group-events", groupId] })
    },
  })
}
