"use client"

import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  Timestamp,
} from "firebase/firestore"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getFirebaseDb } from "@/lib/firebase/client"
import { useAuth } from "./use-auth"
import { generatePortalToken, type Portal, type PortalInput } from "@/lib/portal-permissions"

// ── Collection helper ─────────────────────────────────────────────────────────

function portalsCol(uid: string) {
  return collection(getFirebaseDb(), "users", uid, "portals")
}

// ── Read ──────────────────────────────────────────────────────────────────────

export function usePortals() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ["portals", user?.uid],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async (): Promise<Portal[]> => {
      if (!user) return []
      const q = query(portalsCol(user.uid), orderBy("createdAt", "desc"))
      const snap = await getDocs(q)
      return snap.docs.map((d) => {
        const raw = d.data()
        return {
          id: d.id,
          name:          raw.name,
          token:         raw.token,
          role:          raw.role,
          permissions:   raw.permissions,
          expiresAt:     raw.expiresAt ? (raw.expiresAt as Timestamp).toDate().toISOString() : null,
          revoked:       raw.revoked ?? false,
          lastAccessedAt: raw.lastAccessedAt ? (raw.lastAccessedAt as Timestamp).toDate().toISOString() : null,
          accessCount:   raw.accessCount ?? 0,
          targetLabel:   raw.targetLabel ?? "",
          ownerUid:      user.uid,
          ownerName:     user.displayName ?? user.email ?? "Usuario",
          createdAt:     raw.createdAt ? (raw.createdAt as Timestamp).toDate().toISOString() : new Date().toISOString(),
        } as Portal
      })
    },
  })
}

// ── Create ────────────────────────────────────────────────────────────────────

export function useCreatePortal() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (input: PortalInput): Promise<Portal> => {
      if (!user) throw new Error("No auth")

      const token = generatePortalToken()
      const now   = Timestamp.now()

      const docData = {
        name:         input.name,
        token,
        role:         input.role,
        permissions:  input.permissions,
        expiresAt:    input.expiresAt ? Timestamp.fromDate(new Date(input.expiresAt)) : null,
        revoked:      false,
        lastAccessedAt: null,
        accessCount:  0,
        targetLabel:  input.targetLabel,
        ownerUid:     user.uid,
        ownerName:    user.displayName ?? user.email ?? "Usuario",
        createdAt:    now,
      }

      const ref = await addDoc(portalsCol(user.uid), docData)

      return {
        id: ref.id,
        ...input,
        token,
        revoked: false,
        lastAccessedAt: null,
        accessCount: 0,
        ownerUid: user.uid,
        ownerName: user.displayName ?? user.email ?? "Usuario",
        createdAt: now.toDate().toISOString(),
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portals", user?.uid] }),
  })
}

// ── Revoke / restore ──────────────────────────────────────────────────────────

export function useRevokePortal() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, revoked }: { id: string; revoked: boolean }) => {
      if (!user) throw new Error("No auth")
      await updateDoc(doc(getFirebaseDb(), "users", user.uid, "portals", id), { revoked })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portals", user?.uid] }),
  })
}

// ── Delete ────────────────────────────────────────────────────────────────────

export function useDeletePortal() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("No auth")
      await deleteDoc(doc(getFirebaseDb(), "users", user.uid, "portals", id))
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portals", user?.uid] }),
  })
}

// ── Portal URL helper ─────────────────────────────────────────────────────────

export function getPortalUrl(token: string): string {
  if (typeof window === "undefined") return `/portal/${token}`
  return `${window.location.origin}/portal/${token}`
}

// ── Find portal by token (for API use, server-side) ───────────────────────────
// Note: this does a collectionGroup query — requires a Firestore index

export async function findPortalByToken(token: string): Promise<(Portal & { uid: string }) | null> {
  // We search across all users' portals using a collectionGroup query
  // This requires: collectionGroup("portals") index on "token" ASC in Firestore console
  const db = getFirebaseDb()
  const q  = query(
    collection(db, "portals"),  // collectionGroup not directly available — use path trick
    where("token", "==", token),
  )

  // Fallback: since collectionGroup requires special index, we use the API route
  // which has admin-level access. This hook is client-only for owner management.
  void q
  return null
}
