"use client"

import { Timestamp } from "firebase/firestore"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useAuth } from "./use-auth"
import { apiFetch } from "@/lib/api-client"

// ── Types ─────────────────────────────────────────────────────────────────────

export type EntityType =
  | "merchant"
  | "person"
  | "project"
  | "place"
  | "warranty"
  | "intent"

export type EdgeType =
  | "WITH_PERSON"
  | "FOR_PROJECT"
  | "AT_PLACE"
  | "HAS_WARRANTY"
  | "HAS_INTENT"
  | "LINKED_MERCHANT"

export interface Entity {
  id: string
  type: EntityType
  name: string
  emoji: string
  color: string
  metadata: Record<string, unknown>
  totalSpend: number
  occurrences: number
  createdAt: Timestamp
}

export interface EntityEdge {
  id: string
  fromId: string       // "expense:{expenseId}" o entityId
  toId: string         // entityId
  type: EdgeType
  expenseId: string
  weight: number       // accumulated total amount
  createdAt: Timestamp
}

export interface EntityInput {
  type: EntityType
  name: string
  emoji?: string
  color?: string
  metadata?: Record<string, unknown>
}

// ── Default emojis per type ───────────────────────────────────────────────────

export const TYPE_EMOJI: Record<EntityType, string> = {
  merchant: "🏪",
  person:   "👤",
  project:  "📁",
  place:    "📍",
  warranty: "🛡️",
  intent:   "🎯",
}

export const TYPE_LABEL: Record<EntityType, string> = {
  merchant: "Comercio",
  person:   "Persona",
  project:  "Proyecto",
  place:    "Lugar",
  warranty: "Garantía",
  intent:   "Intención",
}

export const TYPE_COLOR: Record<EntityType, string> = {
  merchant: "#3b82f6",
  person:   "#8b5cf6",
  project:  "#22c55e",
  place:    "#f59e0b",
  warranty: "#ef4444",
  intent:   "#14b8a6",
}

// ── Row mappers ───────────────────────────────────────────────────────────────

function rowToEntity(row: Record<string, unknown>): Entity {
  return {
    id:          row.id as string,
    type:        row.type as EntityType,
    name:        row.name as string,
    emoji:       (row.emoji as string) ?? "",
    color:       (row.color as string) ?? "",
    metadata:    (row.metadata as Record<string, unknown>) ?? {},
    totalSpend:  Number(row.totalSpend ?? 0),
    occurrences: Number(row.occurrences ?? 0),
    createdAt:   row.createdAt
      ? Timestamp.fromDate(new Date(row.createdAt as string))
      : Timestamp.now(),
  }
}

function rowToEdge(row: Record<string, unknown>): EntityEdge {
  return {
    id:        row.id as string,
    fromId:    row.fromId as string,
    toId:      row.toId as string,
    type:      row.type as EdgeType,
    expenseId: row.expenseId as string,
    weight:    Number(row.weight ?? 0),
    createdAt: row.createdAt
      ? Timestamp.fromDate(new Date(row.createdAt as string))
      : Timestamp.now(),
  }
}

// ── Read ──────────────────────────────────────────────────────────────────────

export function useEntities(filterType?: EntityType) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ["entities", user?.uid, filterType],
    enabled: !!user,
    staleTime: 2 * 60_000,
    queryFn: async (): Promise<Entity[]> => {
      if (!user) return []
      const url = filterType ? `/api/entities?type=${filterType}` : "/api/entities"
      const res = await apiFetch(url)
      if (!res.ok) throw new Error("Error cargando entidades")
      const rows = await res.json() as Record<string, unknown>[]
      return rows.map(rowToEntity)
    },
  })
}

export function useEntityEdges(expenseId?: string) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ["entity-edges", user?.uid, expenseId],
    enabled: !!user,
    staleTime: 2 * 60_000,
    queryFn: async (): Promise<EntityEdge[]> => {
      if (!user) return []
      const url = expenseId ? `/api/entity-edges?expenseId=${expenseId}` : "/api/entity-edges"
      const res = await apiFetch(url)
      if (!res.ok) throw new Error("Error cargando edges")
      const rows = await res.json() as Record<string, unknown>[]
      return rows.map(rowToEdge)
    },
  })
}

// ── Create entity ─────────────────────────────────────────────────────────────

export function useCreateEntity() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (input: EntityInput): Promise<Entity> => {
      if (!user) throw new Error("No auth")
      const res = await apiFetch("/api/entities", {
        method: "POST",
        body: JSON.stringify({
          type:     input.type,
          name:     input.name,
          emoji:    input.emoji ?? TYPE_EMOJI[input.type],
          color:    input.color ?? TYPE_COLOR[input.type],
          metadata: input.metadata ?? {},
        }),
      })
      if (!res.ok) throw new Error("Error al crear entidad")
      const row = await res.json() as Record<string, unknown>
      return rowToEntity(row)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["entities", user?.uid] }),
  })
}

// ── Link entity to expense ────────────────────────────────────────────────────

export function useLinkEntityToExpense() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      entityId,
      expenseId,
      edgeType,
      amount,
    }: {
      entityId: string
      expenseId: string
      edgeType: EdgeType
      amount: number
    }) => {
      if (!user) throw new Error("No auth")
      const res = await apiFetch("/api/entity-edges", {
        method: "POST",
        body: JSON.stringify({ entityId, expenseId, edgeType, amount }),
      })
      if (!res.ok) throw new Error("Error al vincular entidad")
    },
    onSuccess: (_, { expenseId }) => {
      qc.invalidateQueries({ queryKey: ["entity-edges", user?.uid, expenseId] })
      qc.invalidateQueries({ queryKey: ["entities", user?.uid] })
    },
  })
}

// ── Delete entity ─────────────────────────────────────────────────────────────

export function useDeleteEntity() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (entityId: string) => {
      if (!user) throw new Error("No auth")
      const res = await apiFetch(`/api/entities/${entityId}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Error al eliminar entidad")
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["entities", user?.uid] }),
  })
}
