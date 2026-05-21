/**
 * firebase/admin.ts — Firebase Admin SDK (server-side only)
 *
 * Requiere la variable de entorno FIREBASE_SERVICE_ACCOUNT_JSON con el JSON
 * completo de la cuenta de servicio de Firebase.
 *
 * En Vercel: Settings → Environment Variables → añadir FIREBASE_SERVICE_ACCOUNT_JSON
 * con el contenido del archivo serviceAccountKey.json descargado de:
 * Firebase Console → Configuración del proyecto → Cuentas de servicio → Generar clave privada
 *
 * NUNCA importar desde código client-side ("use client").
 * Solo usar en API routes (/app/api/...) y Server Components.
 */

import * as admin from "firebase-admin"

function initAdmin(): admin.app.App {
  // Reutilizar la app si ya fue inicializada (Next.js puede reutilizar módulos)
  if (admin.apps.length > 0) {
    return admin.apps[0]!
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (!serviceAccountJson) {
    throw new Error(
      "[firebase/admin] FIREBASE_SERVICE_ACCOUNT_JSON no está configurado. " +
      "Añádelo en Vercel → Settings → Environment Variables."
    )
  }

  let serviceAccount: admin.ServiceAccount
  try {
    serviceAccount = JSON.parse(serviceAccountJson) as admin.ServiceAccount
  } catch {
    throw new Error("[firebase/admin] FIREBASE_SERVICE_ACCOUNT_JSON no es JSON válido.")
  }

  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  })
}

/** Firestore Admin — accede sin restricciones de reglas de seguridad */
export function getAdminDb(): admin.firestore.Firestore {
  initAdmin()
  return admin.firestore()
}

/** Firebase Admin Auth — para lookups de usuarios por email, etc. */
export function getAdminAuth(): admin.auth.Auth {
  initAdmin()
  return admin.auth()
}
