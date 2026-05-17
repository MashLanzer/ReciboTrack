"use client"

import {
  collection, doc, addDoc, updateDoc, onSnapshot, Timestamp, arrayUnion, arrayRemove,
} from "firebase/firestore"
import { useEffect, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { getFirebaseDb } from "@/lib/firebase/client"
import { useAuth } from "./use-auth"

export interface GroupEvent {
  id: string
  title: string
  date: Timestamp
  totalCost: number
  currency: string
  splitMethod: "equal" | "proportional"
  attendees: string[]  // member UIDs who RSVP'd
  createdBy: string
  createdAt: Timestamp
  settled: boolean
}

export function useGroupEvents(groupId: string) {
  const [events, setEvents] = useState<GroupEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!groupId) return
    const col = collection(getFirebaseDb(), "groups", groupId, "events")
    const unsub = onSnapshot(col, (snap) => {
      setEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as GroupEvent))
      setIsLoading(false)
    })
    return unsub
  }, [groupId])

  return { data: events, isLoading }
}

export function useAddGroupEvent() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      groupId,
      title,
      date,
      totalCost,
      currency,
      splitMethod,
    }: {
      groupId: string
      title: string
      date: Date
      totalCost: number
      currency: string
      splitMethod: "equal" | "proportional"
    }) => {
      if (!user) throw new Error("No autenticado")
      await addDoc(collection(getFirebaseDb(), "groups", groupId, "events"), {
        title,
        date: Timestamp.fromDate(date),
        totalCost,
        currency,
        splitMethod,
        attendees: [user.uid],
        createdBy: user.uid,
        createdAt: Timestamp.now(),
        settled: false,
      })
    },
    onSuccess: (_d, { groupId }) => {
      qc.invalidateQueries({ queryKey: ["group-expenses", groupId] })
    },
  })
}

export function useRsvpEvent() {
  const { user } = useAuth()

  return useMutation({
    mutationFn: async ({ groupId, eventId, attending }: { groupId: string; eventId: string; attending: boolean }) => {
      if (!user) throw new Error("No autenticado")
      const ref = doc(getFirebaseDb(), "groups", groupId, "events", eventId)
      await updateDoc(ref, {
        attendees: attending ? arrayUnion(user.uid) : arrayRemove(user.uid),
      })
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
      memberMap: Map<string, string>  // uid → displayName
    }) => {
      if (!user) throw new Error("No autenticado")
      const { attendees, totalCost, currency, splitMethod } = event

      if (attendees.length === 0) return

      const sharePerAttendee =
        splitMethod === "equal" ? totalCost / attendees.length : totalCost / attendees.length

      // Create one group expense per attendee
      for (const uid of attendees) {
        if (uid === user.uid) continue  // skip the payer themselves
        await addDoc(collection(getFirebaseDb(), "groups", groupId, "expenses"), {
          merchant: event.title,
          date: event.date,
          items: [],
          subtotal: sharePerAttendee,
          tax: 0,
          total: sharePerAttendee,
          paymentMethod: null,
          reference: null,
          category: "ocio",
          currency,
          notes: `Evento: ${event.title}`,
          tags: ["evento"],
          receiptImageUrl: null,
          paidByUid: user.uid,
          paidByName: memberMap.get(user.uid) ?? "Yo",
          splitWith: [uid],
          splitType: "equal",
          groupId,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        })
      }

      // Mark event as settled
      const ref = doc(getFirebaseDb(), "groups", groupId, "events", event.id)
      await updateDoc(ref, { settled: true })
    },
    onSuccess: (_d, { groupId }) => {
      qc.invalidateQueries({ queryKey: ["group-expenses", groupId] })
    },
  })
}
