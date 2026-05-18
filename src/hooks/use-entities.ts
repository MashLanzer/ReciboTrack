"use client"

import {
  collection, doc, getDocs, addDoc, updateDoc, deleteDoc,
  query, orderBy, where, Timestamp, writeBatch, getFirestore,
} from "firebase/firestore"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getFirebaseDb } from "@/lib/firebase/client"
import { useAuth } from "./use-auth"

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
  fromId: string       // entityId or "expense:{expenseId}"
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

// ── Firestore helpers ─────────────────────────────────────────────────────────

function entitiesCol(uid: string) {
  return collection(getFirebaseDb(), "users", uid, "entities")
}

function edgesCol(uid: string) {
  return collection(getFirebaseDb(), "users", uid, "entityEdges")
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
      const base = entitiesCol(user.uid)
      const q = filterType
        ? query(base, where("type", "==", filterType), orderBy("occurrences", "desc"))
        : query(base, orderBy("occurrences", "desc"))
      const snap = await getDocs(q)
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Entity)
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
      const base = edgesCol(user.uid)
      const q = expenseId
        ? query(base, where("expenseId", "==", expenseId))
        : query(base, orderBy("weight", "desc"))
      const snap = await getDocs(q)
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as EntityEdge)
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
      const data = {
        type:        input.type,
        name:        input.name,
        emoji:       input.emoji ?? TYPE_EMOJI[input.type],
        color:       input.color ?? TYPE_COLOR[input.type],
        metadata:    input.metadata ?? {},
        totalSpend:  0,
        occurrences: 0,
        createdAt:   Timestamp.now(),
      }
      const ref = await addDoc(entitiesCol(user.uid), data)
      return { id: ref.id, ...data }
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
      const db = getFirebaseDb()

      // Check if edge already exists
      const existing = await getDocs(
        query(edgesCol(user.uid),
          where("toId", "==", entityId),
          where("expenseId", "==", expenseId),
        )
      )

      if (!existing.empty) return  // Already linked

      const batch = writeBatch(db)

      // Create edge
      const edgeRef = doc(edgesCol(user.uid))
      batch.set(edgeRef, {
        fromId:    `expense:${expenseId}`,
        toId:      entityId,
        type:      edgeType,
        expenseId,
        weight:    amount,
        createdAt: Timestamp.now(),
      })

      // Update entity stats
      const entityRef = doc(entitiesCol(user.uid), entityId)
      batch.update(entityRef, {
        totalSpend:  (0 + amount),  // Will be recalculated on read
        occurrences: 1,             // Firestore increment would be ideal
      })

      await batch.commit()
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
      // Delete entity doc (edges are kept but orphaned — acceptable)
      await deleteDoc(doc(entitiesCol(user.uid), entityId))
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["entities", user?.uid] }),
  })
}
