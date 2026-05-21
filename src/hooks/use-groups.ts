"use client"

import { Timestamp } from "firebase/firestore"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-client"
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

export type GroupType = "casa" | "amigos" | "trabajo" | "viaje" | "otro"

export interface Group {
  id: string
  name: string
  emoji: string
  description?: string
  budget?: number
  type?: GroupType
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
  splitWith: string[]
  splitType: "equal" | "full" | "custom"
  customShares?: Record<string, number>
}

export interface GroupSettlement {
  id: string
  groupId: string
  fromUid: string
  toUid: string
  amount: number
  currency: string
  note: string
  date: Timestamp
  createdAt: Timestamp
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function generateInviteCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

function rowToGroup(row: Record<string, unknown>): Group {
  return {
    id:          row.id as string,
    name:        row.name as string,
    emoji:       (row.emoji as string) ?? "👥",
    description: (row.description as string) ?? undefined,
    budget:      row.budget != null ? Number(row.budget) : undefined,
    type:        (row.type as GroupType) ?? undefined,
    adminUid:    (row.adminUid as string) ?? "",
    memberUids:  (row.memberUids as string[]) ?? [],
    members:     ((row.members as Record<string, unknown>[]) ?? []).map((m) => ({
      uid:         m.uid as string,
      email:       (m.email as string) ?? "",
      displayName: (m.displayName as string) ?? "",
      role:        (m.role as MemberRole) ?? "member",
      joinedAt:    m.joinedAt
        ? Timestamp.fromDate(new Date(m.joinedAt as string))
        : Timestamp.now(),
    })),
    inviteCodes: (row.inviteCodes as string[]) ?? [],
    createdAt:   row.createdAt
      ? Timestamp.fromDate(new Date(row.createdAt as string))
      : Timestamp.now(),
  }
}

function rowToGroupExpense(row: Record<string, unknown>): GroupExpense {
  return {
    id:            row.id as string,
    account:       "personal",
    merchant:      row.merchant as string,
    date:          row.date
      ? Timestamp.fromDate(new Date(row.date as string))
      : Timestamp.now(),
    items:         [] as import("@/types").ReceiptItem[],
    subtotal:      Number(row.subtotal ?? 0),
    tax:           Number(row.tax ?? 0),
    total:         Number(row.total),
    paymentMethod: (row.paymentMethod as string) ?? null,
    reference:     (row.reference as string) ?? null,
    category:      (row.category as string) ?? "otros",
    currency:      (row.currency as string) ?? "USD",
    notes:         (row.notes as string) ?? "",
    tags:          (row.tags as string[]) ?? [],
    receiptImageUrl: null,
    project:       undefined,
    privacy:       "private" as const,
    archived:      false,
    flagged:       false,
    flaggedAt:     undefined,
    recurringId:   undefined,
    createdAt:     row.createdAt
      ? Timestamp.fromDate(new Date(row.createdAt as string))
      : Timestamp.now(),
    updatedAt:     row.updatedAt
      ? Timestamp.fromDate(new Date(row.updatedAt as string))
      : Timestamp.now(),
    groupId:       row.groupId as string,
    paidByUid:     (row.paidByUid as string) ?? "",
    paidByName:    (row.paidByName as string) ?? "",
    splitWith:     (row.splitWith as string[]) ?? [],
    splitType:     (row.splitType as "equal" | "full" | "custom") ?? "equal",
    customShares:  (row.customShares as Record<string, number>) ?? undefined,
  }
}

function rowToSettlement(row: Record<string, unknown>): GroupSettlement {
  return {
    id:        row.id as string,
    groupId:   row.groupId as string,
    fromUid:   row.fromUid as string,
    toUid:     row.toUid as string,
    amount:    Number(row.amount),
    currency:  (row.currency as string) ?? "USD",
    note:      (row.note as string) ?? "",
    date:      row.date
      ? Timestamp.fromDate(new Date(row.date as string))
      : Timestamp.now(),
    createdAt: row.createdAt
      ? Timestamp.fromDate(new Date(row.createdAt as string))
      : Timestamp.now(),
  }
}

// ─── Hooks ─────────────────────────────────────────────────────────────────────

export function useMyGroups() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ["groups", user?.uid],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return []
      const res = await apiFetch("/api/groups")
      if (!res.ok) throw new Error("Error cargando grupos")
      const rows = await res.json() as Record<string, unknown>[]
      return rows.map(rowToGroup)
    },
  })
}

export function useGroupExpenses(groupId: string | null) {
  return useQuery({
    queryKey: ["group-expenses", groupId],
    enabled: !!groupId,
    queryFn: async () => {
      if (!groupId) return []
      const res = await apiFetch(`/api/groups/${groupId}/expenses`)
      if (!res.ok) throw new Error("Error cargando gastos del grupo")
      const rows = await res.json() as Record<string, unknown>[]
      return rows.map(rowToGroupExpense)
    },
  })
}

export function useCreateGroup() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ name, emoji, description, type }: { name: string; emoji: string; description?: string; type?: GroupType }) => {
      if (!user) throw new Error("No autenticado")
      const inviteCode = generateInviteCode()
      const res = await apiFetch("/api/groups", {
        method: "POST",
        body: JSON.stringify({
          name,
          emoji,
          description,
          type,
          inviteCode,
          member: {
            uid:         user.uid,
            email:       user.email ?? "",
            displayName: user.displayName ?? user.email ?? "Yo",
          },
        }),
      })
      if (!res.ok) throw new Error("Error al crear grupo")
      const data = await res.json() as { id: string }
      return { groupId: data.id, inviteCode }
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
      const res = await apiFetch("/api/groups/join", {
        method: "POST",
        body: JSON.stringify({
          inviteCode,
          email:       user.email ?? "",
          displayName: user.displayName ?? user.email ?? "Usuario",
        }),
      })
      if (!res.ok) {
        const err = await res.json() as { error: string }
        throw new Error(err.error ?? "Error al unirse al grupo")
      }
      return res.json() as Promise<{ groupId: string; groupName: string }>
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
      // Leer el grupo para quitar al usuario de members
      const res = await apiFetch(`/api/groups/${groupId}`)
      if (!res.ok) throw new Error("Grupo no encontrado")
      const group = await res.json() as Group
      const updatedMembers = group.members
        .filter((m) => m.uid !== user.uid)
        .map((m) => ({ ...m, joinedAt: m.joinedAt.toDate().toISOString() }))
      const updatedUids = group.memberUids.filter((u) => u !== user.uid)

      const patchRes = await apiFetch(`/api/groups/${groupId}`, {
        method: "PATCH",
        body: JSON.stringify({ members: updatedMembers, memberUids: updatedUids }),
      })
      if (!patchRes.ok) throw new Error("Error al salir del grupo")
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
      customShares,
    }: {
      groupId: string
      input: ExpenseInput
      splitWith: string[]
      splitType?: "equal" | "full" | "custom"
      customShares?: Record<string, number>
    }) => {
      if (!user) throw new Error("No autenticado")
      const res = await apiFetch(`/api/groups/${groupId}/expenses`, {
        method: "POST",
        body: JSON.stringify({
          ...input,
          date:        input.date instanceof Date ? input.date.toISOString() : String(input.date),
          paidByUid:   user.uid,
          paidByName:  user.displayName ?? user.email ?? "Yo",
          splitWith,
          splitType,
          customShares,
        }),
      })
      if (!res.ok) throw new Error("Error al agregar gasto al grupo")
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
      const res = await apiFetch(`/api/groups/${groupId}/expenses/${expenseId}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Error al eliminar gasto del grupo")
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
      const res = await apiFetch(`/api/groups/${groupId}`, {
        method: "PATCH",
        body: JSON.stringify({ inviteCodes: [newCode], inviteCode: newCode }),
      })
      if (!res.ok) throw new Error("Error al renovar código de invitación")
      return newCode
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["groups"] }),
  })
}

export function useUpdateGroupExpense() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      groupId, expenseId, input, splitWith, splitType, customShares,
    }: {
      groupId: string; expenseId: string
      input: Partial<ExpenseInput> & { date?: Date }
      splitWith: string[]; splitType: "equal" | "full" | "custom"
      customShares?: Record<string, number>
    }) => {
      const res = await apiFetch(`/api/groups/${groupId}/expenses/${expenseId}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...input,
          ...(input.date ? { date: input.date.toISOString() } : {}),
          splitWith,
          splitType,
          customShares,
          paidByName: user?.displayName ?? user?.email ?? "Usuario",
        }),
      })
      if (!res.ok) throw new Error("Error al actualizar gasto del grupo")
    },
    onSuccess: (_, { groupId }) => queryClient.invalidateQueries({ queryKey: ["group-expenses", groupId] }),
  })
}

export function useGroupSettlements(groupId: string | null) {
  return useQuery({
    queryKey: ["group-settlements", groupId],
    enabled: !!groupId,
    staleTime: 1000 * 60,
    queryFn: async () => {
      if (!groupId) return []
      const res = await apiFetch(`/api/groups/${groupId}/settlements`)
      if (!res.ok) throw new Error("Error cargando liquidaciones")
      const rows = await res.json() as Record<string, unknown>[]
      return rows.map(rowToSettlement)
    },
  })
}

export function useSettleDebt() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      groupId, fromUid, toUid, amount, currency, note,
    }: {
      groupId: string; fromUid: string; toUid: string
      amount: number; currency: string; note?: string
    }) => {
      const res = await apiFetch(`/api/groups/${groupId}/settlements`, {
        method: "POST",
        body: JSON.stringify({ fromUid, toUid, amount, currency, note }),
      })
      if (!res.ok) throw new Error("Error al registrar liquidación")
    },
    onSuccess: (_, { groupId }) =>
      queryClient.invalidateQueries({ queryKey: ["group-settlements", groupId] }),
  })
}

export function useDeleteSettlement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ groupId, settlementId }: { groupId: string; settlementId: string }) => {
      const res = await apiFetch(`/api/groups/${groupId}/settlements/${settlementId}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Error al eliminar liquidación")
    },
    onSuccess: (_, { groupId }) =>
      queryClient.invalidateQueries({ queryKey: ["group-settlements", groupId] }),
  })
}

export function useUpdateGroup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ groupId, name, emoji, description, budget }: {
      groupId: string; name: string; emoji: string; description?: string; budget?: number | null
    }) => {
      const res = await apiFetch(`/api/groups/${groupId}`, {
        method: "PATCH",
        body: JSON.stringify({ name, emoji, description, budget }),
      })
      if (!res.ok) throw new Error("Error al actualizar grupo")
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["groups"] }),
  })
}

export function useArchiveGroup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (groupId: string) => {
      const res = await apiFetch(`/api/groups/${groupId}`, {
        method: "PATCH",
        body: JSON.stringify({ archived: true, archivedAt: new Date().toISOString() }),
      })
      if (!res.ok) throw new Error("Error al archivar grupo")
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["groups"] }),
  })
}

export function useUnarchiveGroup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (groupId: string) => {
      const res = await apiFetch(`/api/groups/${groupId}`, {
        method: "PATCH",
        body: JSON.stringify({ archived: false }),
      })
      if (!res.ok) throw new Error("Error al desarchivar grupo")
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["groups"] }),
  })
}

// ─── Audit log ─────────────────────────────────────────────────────────────────

export interface ExpenseAuditEntry {
  id: string
  expenseId: string
  groupId: string
  action: "created" | "updated" | "deleted"
  byUid: string
  byName: string
  summary: string
  timestamp: Timestamp
}

export function useExpenseAuditLog(groupId: string | null, expenseId: string | null) {
  return useQuery({
    queryKey: ["expense-audit", groupId, expenseId],
    enabled: !!groupId && !!expenseId,
    staleTime: 60_000,
    queryFn: async () => {
      if (!groupId || !expenseId) return []
      const res = await apiFetch(`/api/groups/${groupId}/expenses/${expenseId}/audit`)
      if (!res.ok) return []
      const rows = await res.json() as Record<string, unknown>[]
      return rows.map((r) => ({
        id:        r.id as string,
        expenseId: r.expenseId as string,
        groupId:   r.groupId as string,
        action:    r.action as "created" | "updated" | "deleted",
        byUid:     r.byUid as string,
        byName:    r.byName as string,
        summary:   r.summary as string,
        timestamp: r.timestamp
          ? Timestamp.fromDate(new Date(r.timestamp as string))
          : Timestamp.now(),
      })) as ExpenseAuditEntry[]
    },
  })
}
