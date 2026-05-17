"use client"

import { Suspense, useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import {
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithCredential,
} from "firebase/auth"
import { doc, setDoc } from "firebase/firestore"
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { Loader2, Receipt, Smartphone, Fingerprint } from "lucide-react"
import { usePasskeySupport, usePasskeyLogin } from "@/hooks/use-passkey"

/** Returns true when running inside a Capacitor native WebView */
function useIsNativeApp() {
  const [isNative, setIsNative] = useState(false)
  useEffect(() => {
    // window.Capacitor is injected by Capacitor's WebView bridge
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
    setIsNative(cap?.isNativePlatform?.() ?? false)
  }, [])
  return isNative
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const searchParams = useSearchParams()
  const rawFrom = searchParams.get("from") ?? "/dashboard"
  // Prevent redirect loops: if "from" points back to login, go to dashboard
  const from = rawFrom.startsWith("/login") ? "/dashboard" : rawFrom

  const [mode, setMode] = useState<"login" | "register">("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const isNative = useIsNativeApp()
  const firebaseConfigured = !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  const passkeySupported = usePasskeySupport()
  const { login: passkeyLogin, isLoading: passkeyLoading, hasPasskey } = usePasskeyLogin()

  function setSessionCookie() {
    document.cookie = `session=1; path=/; SameSite=Lax; max-age=${60 * 60 * 24 * 7}`
  }

  function navigateAfterLogin() {
    // Full navigation avoids timing issues where AuthGuard reads stale auth state
    window.location.href = from
  }

  async function initUserProfile(uid: string, displayName: string, email: string) {
    const ref = doc(getFirebaseDb(), "users", uid)
    await setDoc(ref, {
      displayName,
      email,
      photoURL: getFirebaseAuth().currentUser?.photoURL ?? null,
      defaultCurrency: "USD",
    }, { merge: true })
  }

  async function handleGoogle() {
    setGoogleLoading(true)
    try {
      let uid = "", displayName = "", email = ""

      if (isNative) {
        // ── Nativo (APK): usa el diálogo de Google de Android ──────────────
        const { FirebaseAuthentication } = await import("@capacitor-firebase/authentication")
        const result = await FirebaseAuthentication.signInWithGoogle()

        const idToken = result.credential?.idToken
        if (!idToken) throw new Error("No se obtuvo token de Google")

        // Enlazar con Firebase Web SDK para mantener sesión en el WebView
        const credential = GoogleAuthProvider.credential(idToken)
        const webResult = await signInWithCredential(getFirebaseAuth(), credential)
        uid = webResult.user.uid
        displayName = webResult.user.displayName ?? result.user?.displayName ?? ""
        email = webResult.user.email ?? result.user?.email ?? ""
      } else {
        // ── Web: popup normal ────────────────────────────────────────────────
        const provider = new GoogleAuthProvider()
        const result = await signInWithPopup(getFirebaseAuth(), provider)
        uid = result.user.uid
        displayName = result.user.displayName ?? ""
        email = result.user.email ?? ""
      }

      try {
        await initUserProfile(uid, displayName, email)
      } catch { /* no crítico */ }

      setSessionCookie()
      navigateAfterLogin()
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? ""
      const msg = (err as { message?: string }).message ?? ""

      // Errores que el usuario canceló intencionalmente — no mostrar toast
      const IGNORED = ["auth/popup-closed-by-user", "auth/cancelled-popup-request"]
      if (!IGNORED.includes(code) && !msg.includes("cancelled") && !msg.includes("canceled")) {
        const messages: Record<string, string> = {
          "auth/unauthorized-domain":
            "Dominio no autorizado en Firebase. Ve a Firebase Console → Authentication → Settings → Authorized domains.",
          "auth/operation-not-allowed":
            "Google Sign-In no está habilitado. Actívalo en Firebase Console → Authentication → Sign-in method.",
          "auth/popup-blocked":
            "El navegador bloqueó el popup. Permite popups para este sitio.",
          "auth/network-request-failed":
            "Error de red. Verifica tu conexión a internet.",
          "auth/internal-error":
            "Error interno de Firebase. Revisa la consola del navegador.",
        }
        toast.error(messages[code] ?? `Error (${code || msg || "desconocido"})`, { duration: 10000 })
      }
      setGoogleLoading(false)
    }
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      if (mode === "register") {
        const result = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password)
        await updateProfile(result.user, { displayName: name })
        await initUserProfile(result.user.uid, name, email)
        toast.success("Cuenta creada")
      } else {
        await signInWithEmailAndPassword(getFirebaseAuth(), email, password)
      }
      setSessionCookie()
      navigateAfterLogin()
    } catch (err: unknown) {
      const code = (err as { code?: string }).code
      const messages: Record<string, string> = {
        "auth/email-already-in-use": "El email ya está en uso",
        "auth/wrong-password": "Contraseña incorrecta",
        "auth/user-not-found": "No existe una cuenta con ese email",
        "auth/invalid-credential": "Credenciales inválidas",
        "auth/weak-password": "La contraseña debe tener al menos 6 caracteres",
        "auth/too-many-requests": "Demasiados intentos. Espera unos minutos e intenta de nuevo.",
        "auth/network-request-failed": "Error de red. Verifica tu conexión a internet.",
      }
      toast.error(code ? (messages[code] ?? `Error (${code})`) : "Error inesperado")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-sm space-y-8">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-foreground text-background mb-2">
          <Receipt className="h-6 w-6" />
        </div>
        <h1 className="font-serif text-3xl">ReciboTrack</h1>
        <p className="text-sm text-muted-foreground">
          {mode === "login" ? "Inicia sesión en tu cuenta" : "Crea tu cuenta gratis"}
        </p>
      </div>

      <div className="space-y-4">
        {/* Passkey quick login */}
        {passkeySupported && hasPasskey && mode === "login" && (
          <Button
            type="button"
            variant="outline"
            className="w-full gap-3"
            onClick={async () => {
              const ok = await passkeyLogin()
              if (ok) {
                toast.success("Autenticado con biometría")
                navigateAfterLogin()
              } else {
                toast.error("La autenticación biométrica falló")
              }
            }}
            disabled={passkeyLoading}
          >
            {passkeyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Fingerprint className="h-4 w-4" />}
            Entrar con huella / Face ID
          </Button>
        )}

        {!firebaseConfigured && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive space-y-1">
            <p className="font-semibold">⚠️ Firebase no configurado</p>
            <p>Las variables de entorno de Firebase no están disponibles. Ve a Vercel → tu proyecto → Settings → Environment Variables y agrega:</p>
            <ul className="mt-1 space-y-0.5 font-mono text-[10px]">
              <li>NEXT_PUBLIC_FIREBASE_API_KEY</li>
              <li>NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN</li>
              <li>NEXT_PUBLIC_FIREBASE_PROJECT_ID</li>
              <li>NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET</li>
              <li>NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID</li>
              <li>NEXT_PUBLIC_FIREBASE_APP_ID</li>
            </ul>
          </div>
        )}
        <Button
          type="button"
          variant="outline"
          className="w-full gap-3"
          onClick={handleGoogle}
          disabled={googleLoading || !firebaseConfigured}
        >
          {googleLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isNative ? (
            <Smartphone className="h-4 w-4" />
          ) : (
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
          )}
          {googleLoading ? "Verificando..." : "Continuar con Google"}
        </Button>

        <div className="flex items-center gap-4">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground">o</span>
          <Separator className="flex-1" />
        </div>

        <form onSubmit={handleEmailSubmit} className="space-y-3">
          {mode === "register" && (
            <div className="space-y-1.5">
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                type="text"
                placeholder="Tu nombre"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={6}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          {mode === "login" ? "¿No tienes cuenta? " : "¿Ya tienes cuenta? "}
          <button
            type="button"
            onClick={() => setMode(mode === "login" ? "register" : "login")}
            className="font-medium text-foreground hover:underline"
          >
            {mode === "login" ? "Regístrate" : "Inicia sesión"}
          </button>
        </p>
      </div>
    </div>
  )
}
