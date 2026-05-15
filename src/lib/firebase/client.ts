import { initializeApp, getApps, type FirebaseApp } from "firebase/app"
import {
  initializeAuth,
  getAuth,
  browserLocalPersistence,
  browserPopupRedirectResolver,
  type Auth,
} from "firebase/auth"
import { getFirestore, type Firestore } from "firebase/firestore"
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
let _db: Firestore | undefined
let _storage: FirebaseStorage | undefined

function ensureApp(): FirebaseApp {
  if (!_app) {
    _app = getApps()[0] ?? initializeApp(firebaseConfig)
  }
  return _app
}

// Funciones lazy — Firebase solo se inicializa cuando se llama por primera vez
export function getFirebaseAuth(): Auth {
  if (!_auth) {
    const app = ensureApp()
    // initializeAuth con parámetros explícitos evita que Firebase cargue el
    // iframe de Google en segundo plano, lo que elimina las advertencias de
    // "Tracking Prevention blocked access to storage" en Edge/Safari/Firefox.
    try {
      _auth = initializeAuth(app, {
        persistence: browserLocalPersistence,
        popupRedirectResolver: browserPopupRedirectResolver,
      })
    } catch {
      // Si ya fue inicializado (hot reload en dev), reusar la instancia existente
      _auth = getAuth(app)
    }
  }
  return _auth as Auth
}

export function getFirebaseDb(): Firestore {
  if (!_db) _db = getFirestore(ensureApp())
  return _db
}

export function getFirebaseStorage(): FirebaseStorage {
  if (!_storage) _storage = getStorage(ensureApp())
  return _storage
}
