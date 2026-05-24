/**
 * Firebase client SDK — solo Auth y Storage.
 * Firestore fue migrado a Supabase PostgreSQL; este archivo ya no inicializa Firestore.
 */

import { initializeApp, getApps, type FirebaseApp } from "firebase/app"
import { getAuth, type Auth } from "firebase/auth"
import { getStorage, type FirebaseStorage } from "firebase/storage"

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
}

let _app: FirebaseApp | undefined
let _auth: Auth | undefined
let _storage: FirebaseStorage | undefined

function ensureApp(): FirebaseApp {
  if (!_app) {
    _app = getApps()[0] ?? initializeApp(firebaseConfig)
  }
  return _app
}

export function getFirebaseAuth(): Auth {
  if (!_auth) _auth = getAuth(ensureApp())
  return _auth
}

export function getFirebaseStorage(): FirebaseStorage {
  if (!_storage) _storage = getStorage(ensureApp())
  return _storage
}
