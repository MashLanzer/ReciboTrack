"use client"

import {
  collection, doc, addDoc, updateDoc, onSnapshot, Timestamp, arrayUnion, arrayRemove,
} from "firebase/firestore"
import { useEffect, useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { getFirebaseDb } from "@/lib/firebase/client"
import { useAuth } from "./use-auth"

export interface PollOption {
  id: string
  label: string
  votes: string[]  // array of UIDs
}

export interface GroupPoll {
  id: string
  question: string
  options: PollOption[]
  status: "open" | "closed"
  result?: string  // winning option id
  splitMethod?: "equal" | "proportional"
  createdBy: string
  createdAt: Timestamp
  closesAt?: Timestamp
}

export function useGroupPolls(groupId: string) {
  const [polls, setPolls] = useState<GroupPoll[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!groupId) return
    const col = collection(getFirebaseDb(), "groups", groupId, "polls")
    const unsub = onSnapshot(col, (snap) => {
      setPolls(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as GroupPoll))
      setIsLoading(false)
    })
    return unsub
  }, [groupId])

  return { data: polls, isLoading }
}

export function useCreatePoll() {
  const { user } = useAuth()
  return useMutation({
    mutationFn: async ({
      groupId,
      question,
      options,
      closesAt,
    }: {
      groupId: string
      question: string
      options: string[]
      closesAt?: Date
    }) => {
      if (!user) throw new Error("No autenticado")
      const pollOptions: PollOption[] = options.map((label, i) => ({
        id: `opt_${i}`,
        label,
        votes: [],
      }))
      await addDoc(collection(getFirebaseDb(), "groups", groupId, "polls"), {
        question,
        options: pollOptions,
        status: "open",
        createdBy: user.uid,
        createdAt: Timestamp.now(),
        ...(closesAt ? { closesAt: Timestamp.fromDate(closesAt) } : {}),
      })
    },
  })
}

export function useVotePoll() {
  const { user } = useAuth()
  return useMutation({
    mutationFn: async ({
      groupId,
      pollId,
      optionId,
      currentOptions,
    }: {
      groupId: string
      pollId: string
      optionId: string
      currentOptions: PollOption[]
    }) => {
      if (!user) throw new Error("No autenticado")
      const ref = doc(getFirebaseDb(), "groups", groupId, "polls", pollId)

      // Build updated options: remove vote from all, add to selected
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
        // Remove vote from others (one vote per user)
        return { ...opt, votes: opt.votes.filter((u) => u !== user.uid) }
      })

      await updateDoc(ref, { options: updated })
    },
  })
}

export function useClosePoll() {
  return useMutation({
    mutationFn: async ({ groupId, pollId, options }: { groupId: string; pollId: string; options: PollOption[] }) => {
      const winner = [...options].sort((a, b) => b.votes.length - a.votes.length)[0]
      const ref = doc(getFirebaseDb(), "groups", groupId, "polls", pollId)
      await updateDoc(ref, {
        status: "closed",
        result: winner?.id ?? null,
      })
    },
  })
}
