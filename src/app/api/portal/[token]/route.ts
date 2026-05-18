/**
 * Public Portal API — no authentication required.
 * Returns expense data filtered by portal permissions.
 *
 * Security:
 *  - Token is 48-char hex (192 bits of entropy) — brute-force infeasible
 *  - Permissions are applied SERVER-SIDE — client never sees masked data
 *  - Expiry and revocation checked before returning any data
 *  - CORS restricted to same origin
 */

import { NextRequest, NextResponse } from "next/server"
import {
  collectionGroup,
  getDocs,
  query,
  where,
  collection,
  getFirestore,
  Timestamp,
  updateDoc,
  doc,
  increment,
} from "firebase/firestore"
import { initializeApp, getApps } from "firebase/app"
import {
  applyPortalPermissions,
  buildPortalSummary,
  type PortalPermissions,
} from "@/lib/portal-permissions"
import type { Expense } from "@/types"

// ── Firebase init (server-side uses client SDK with public config) ─────────────

function getServerDb() {
  const apps = getApps()
  const app  = apps.find((a) => a.name === "[DEFAULT]") ?? initializeApp({
    apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  })
  return getFirestore(app)
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params

  if (!token || token.length < 32) {
    return NextResponse.json({ error: "Token inválido" }, { status: 400 })
  }

  try {
    const db = getServerDb()

    // ── Find portal by token across all users ──────────────────────────────
    // collectionGroup query on "portals" sub-collection
    const portalsGroup = collectionGroup(db, "portals")
    const portalQuery  = query(portalsGroup, where("token", "==", token))
    const portalSnap   = await getDocs(portalQuery)

    if (portalSnap.empty) {
      return NextResponse.json({ error: "Portal no encontrado" }, { status: 404 })
    }

    const portalDoc  = portalSnap.docs[0]
    const portalData = portalDoc.data()

    // ── Validate portal status ─────────────────────────────────────────────
    if (portalData.revoked) {
      return NextResponse.json({ error: "Este portal ha sido revocado" }, { status: 403 })
    }

    if (portalData.expiresAt) {
      const expiresAt = (portalData.expiresAt as Timestamp).toDate()
      if (expiresAt < new Date()) {
        return NextResponse.json({ error: "Este portal ha expirado" }, { status: 403 })
      }
    }

    const ownerUid   = portalData.ownerUid as string
    const permissions = portalData.permissions as PortalPermissions

    // ── Fetch owner's expenses ─────────────────────────────────────────────
    const expensesCol = collection(db, "users", ownerUid, "expenses")
    const expSnap     = await getDocs(expensesCol)
    const expenses    = expSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Expense[]

    // ── Apply permissions (server-side mask) ───────────────────────────────
    const maskedExpenses = applyPortalPermissions(expenses, permissions)
    const summary        = buildPortalSummary(expenses, permissions)

    // ── Track access (non-blocking) ────────────────────────────────────────
    void updateDoc(doc(db, portalDoc.ref.path), {
      lastAccessedAt: Timestamp.now(),
      accessCount:    increment(1),
    }).catch(() => {/* non-critical */})

    return NextResponse.json({
      expenses:    maskedExpenses,
      summary,
      permissions,
      portalName:  portalData.name as string,
      ownerName:   portalData.ownerName as string,
      generatedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error("[portal API]", err)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
