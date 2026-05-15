"use client"

import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDoc, getDocs,
  query, where, orderBy, Timestamp, arrayUnion, arrayRemove, setDoc,
} from "firebase/firestore"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getFirebaseDb } from "@/lib/firebase/client"
import { useAuth } from "./use-auth"
import type { Expense, ExpenseInput } from "@/types"

// ─── Types ─────────────────────────────────────────────────────────────────────

export type MemberRole = "admin" | "member"

export interface GroupMember {
  uid: string
  email: string
  displayName: string
  role: MemberRole
  joinedAt: Timestamp
}

export interface Group {
  id: string
  name: string
  emoji: string
  adminUid: string
  memberUids: string[]
  members: GroupMember[]
  inviteCodes: string[]
  createdAt: Timestamp
}

export interface GroupExpense extends Expense {
  groupId: string
  paidByUid: string
  paidByName: string
  splitWith: string[] // array of UIDs who split this expense
  splitType: "equal" | "full"
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function generateInviteCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

// ─── Hooks ─────────────────────────────────────────────────────────────────────

export function useMyGroups() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ["groups", user?.uid],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return []
      const q = query(
        collection(getFirebaseDb(), "groups"),
        where("memberUids", "array-contains", user.uid)
      )
      const snap = await getDocs(q)
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Group)
    },
  })
}

export function useGroupExpenses(groupId: string | null) {
  return useQuery({
    queryKey: ["group-expenses", groupId],
    enabled: !!groupId,
    queryFn: async () => {
      if (!groupId) return []
      const q = query(
        collection(getFirebaseDb(), "groups", groupId, "expenses"),
        orderBy("date", "desc")
      )
      const snap = await getDocs(q)
      return snap.docs.map((d) => ({ id: d.id, groupId, ...d.data() }) as GroupExpense)
    },
  })
}

export function useCreateGroup() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ name, emoji }: { name: string; emoji: string }) => {
      if (!user) throw new Error("No autenticado")
      const inviteCode = generateInviteCode()
      const member: GroupMember = {
        uid: user.uid,
        email: user.email ?? "",
        displayName: user.displayName ?? user.email ?? "Yo",
        role: "admin",
        joinedAt: Timestamp.now(),
      }
      const ref = await addDoc(collection(getFirebaseDb(), "groups"), {
        name,
        emoji,
        adminUid: user.uid,
        memberUids: [user.uid],
        members: [member],
        inviteCodes: [inviteCode],
        createdAt: Timestamp.now(),
      })
      return { groupId: ref.id, inviteCode }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["groups", user?.uid] }),
  })
}

export function useJoinGroup() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (inviteCode: string) => {
      if (!user) throw new Error("No autenticado")
      const code = inviteCode.toUpperCase().trim()

      // Find group with this invite code
      const q = query(
        collection(getFirebaseDb(), "groups"),
        where("inviteCodes", "array-contains", code)
      )
      const snap = await getDocs(q)
      if (snap.empty) throw new Error("Código de invitación inválido o expirado")

      const groupDoc = snap.docs[0]
      const group = groupDoc.data() as Group

      if (group.memberUids.includes(user.uid)) {
        throw new Error("Ya eres miembro de este grupo")
      }

      const newMember: GroupMember = {
        uid: user.uid,
        email: user.email ?? "",
        displayName: user.displayName ?? user.email ?? "Usuario",
        role: "member",
        joinedAt: Timestamp.now(),
      }

      await updateDoc(groupDoc.ref, {
        memberUids: arrayUnion(user.uid),
        members: arrayUnion(newMember),
      })

      return { groupId: groupDoc.id, groupName: group.name }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["groups", user?.uid] }),
  })
}

export function useLeaveGroup() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (groupId: string) => {
      if (!user) throw new Error("No autenticado")
      const groupRef = doc(getFirebaseDb(), "groups", groupId)
      const groupSnap = await getDoc(groupRef)
      if (!groupSnap.exists()) throw new Error("Grupo no encontrado")

      const group = groupSnap.data() as Group
      const updatedMembers = group.members.filter((m) => m.uid !== user.uid)

      await updateDoc(groupRef, {
        memberUids: arrayRemove(user.uid),
        members: updatedMembers,
      })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["groups", user?.uid] }),
  })
}

export function useAddGroupExpense() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      groupId,
      input,
      splitWith,
      splitType = "equal",
    }: {
      groupId: string
      input: ExpenseInput
      splitWith: string[]
      splitType?: "equal" | "full"
    }) => {
      if (!user) throw new Error("No autenticado")
      const now = Timestamp.now()
      await addDoc(collection(getFirebaseDb(), "groups", groupId, "expenses"), {
        ...input,
        date: Timestamp.fromDate(input.date),
        paidByUid: user.uid,
        paidByName: user.displayName ?? user.email ?? "Yo",
        splitWith,
        splitType,
        groupId,
        createdAt: now,
        updatedAt: now,
      })
    },
    onSuccess: (_, { groupId }) => {
      queryClient.invalidateQueries({ queryKey: ["group-expenses", groupId] })
    },
  })
}

export function useDeleteGroupExpense() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ groupId, expenseId }: { groupId: string; expenseId: string }) => {
      await deleteDoc(doc(getFirebaseDb(), "groups", groupId, "expenses", expenseId))
    },
    onSuccess: (_, { groupId }) => {
      queryClient.invalidateQueries({ queryKey: ["group-expenses", groupId] })
    },
  })
}

export function useRefreshInviteCode() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (groupId: string) => {
      const newCode = generateInviteCode()
      await updateDoc(doc(getFirebaseDb(), "groups", groupId), {
        inviteCodes: [newCode],
      })
      return newCode
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["groups"] }),
  })
}
