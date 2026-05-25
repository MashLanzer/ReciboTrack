"use client"

import Link from "next/link"
import { useState, useRef, useCallback, useMemo, useEffect } from "react"
import { useAuth } from "@/hooks/use-auth"
import { useUserSettings, useUpdateUserSettings } from "@/hooks/use-user-settings"
import { useWebhookSettings } from "@/hooks/use-webhook-settings"
import { useExpensesPeriod } from "@/hooks/use-expenses"
import { useCategories } from "@/hooks/use-categories"
import { useRecurring } from "@/hooks/use-recurring"
import { useGoals } from "@/hooks/use-goals"
import { useRoundupSettings, useSetRoundupSettings } from "@/hooks/use-roundup-settings"
import { exportToCSV, exportHoldedCsv, exportContasimpleCsv } from "@/components/expenses/export-utils"
import { formatCurrency, cn } from "@/lib/utils"
import { CURRENCIES, PAYMENT_METHODS, DEFAULT_CATEGORIES } from "@/lib/constants"
import { getFirebaseAuth } from "@/lib/firebase/client"
import {
  updateProfile, updatePassword, reauthenticateWithCredential,
  EmailAuthProvider, deleteUser, sendPasswordResetEmail,
} from "firebase/auth"
import { useTheme } from "next-themes"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import {
  User, Camera, Sun, Moon, Monitor, Download, LogOut, Trash2, Bell, Globe,
  Shield, Check, Loader2, AlertTriangle, BarChart3, EyeOff, Wallet,
  Sheet, Webhook, ExternalLink, Link2Off, Send, RefreshCw, Settings2,
  ChevronRight, Lock, Smartphone, Database, Plug, CreditCard, Share2, Plus, ImageIcon,
} from "lucide-react"
import { CollapsibleContent, CollapsibleChevron } from "@/components/ui/collapsible"
import { AccentColorPicker } from "@/components/shared/accent-color-picker"
import { TrustedCircleCard } from "@/components/profile/trusted-circle-card"
import { PersonalStats } from "@/components/profile/personal-stats" // #32 — componente extraído
import { AchievementsGrid } from "@/components/profile/achievements-grid"
import { usePlan } from "@/hooks/use-plan"
import { PwaInstallButton } from "@/components/shared/pwa-install-button"
import { PasskeySetupCard } from "@/components/auth/passkey-setup-card"
import { CreatePortalDialog } from "@/components/portals/create-portal-dialog"
import { PortalCard } from "@/components/portals/portal-card"
import { usePortals } from "@/hooks/use-portals"
import { format, subMonths } from "date-fns"
import { es } from "date-fns/locale"
import { exportToGoogleSheets, SheetsRedirectPending } from "@/lib/google-sheets"
import { fireWebhook } from "@/lib/webhook"

// ─── Toggle switch ────────────────────────────────────────────────────────────
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${checked ? "bg-primary" : "bg-input"}`}
    >
      <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform ${checked ? "translate-x-5" : "translate-x-0"}`} />
    </button>
  )
}

// ─── Setting row ─────────────────────────────────────────────────────────────
function SettingRow({ label, description, children }: {
  label: string; description?: string; children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b last:border-b-0">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

// ─── Section card ─────────────────────────────────────────────────────────────
function SectionCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl border bg-card", className)}>
      {children}
    </div>
  )
}

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="px-4 py-3 border-b">
      <p className="text-sm font-semibold">{title}</p>
      {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
    </div>
  )
}

/** Section card with a collapsible body. Starts collapsed if defaultOpen=false */
function CollapsibleSectionCard({
  title,
  description,
  defaultOpen = false,
  children,
  className,
}: {
  title: string
  description?: string
  defaultOpen?: boolean
  children: React.ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={cn("rounded-2xl border bg-card", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/30 rounded-2xl transition-colors"
      >
        <div>
          <p className="text-sm font-semibold">{title}</p>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
        <CollapsibleChevron open={open} className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
      </button>
      <CollapsibleContent open={open}>
        <div className="border-t">{children}</div>
      </CollapsibleContent>
    </div>
  )
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
type Tab = "perfil" | "preferencias" | "datos" | "compartir" | "cuenta"
const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "perfil",        label: "Perfil",        icon: User },
  { id: "preferencias",  label: "Ajustes",        icon: Settings2 },
  { id: "datos",         label: "Datos",          icon: Database },
  { id: "compartir",     label: "Compartir",      icon: Share2 },
  { id: "cuenta",        label: "Cuenta",         icon: Shield },
]

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const { user } = useAuth()
  const { data: settings, isLoading: settingsLoading } = useUserSettings()
  const updateSettings = useUpdateUserSettings()
  const { data: categories = [] } = useCategories()
  const { data: recurringData = [] } = useRecurring()
  const { data: goals = [] } = useGoals()
  const { data: roundupSettings } = useRoundupSettings()
  const setRoundupSettings = useSetRoundupSettings()
  const { data: planData } = usePlan()
  const activeGoals = goals.filter(g => g.isActive && g.type === "saving")
  const { theme, setTheme } = useTheme()

  // Full year for export
  const now = useMemo(() => new Date(), [])
  const sixMonthsAgo = useMemo(() => subMonths(now, 6), [now])
  const { data: recentExpenses = [] } = useExpensesPeriod(sixMonthsAgo, now)

  const [tab, setTab] = useState<Tab>("perfil")

  // Profile edit
  const [displayName, setDisplayName] = useState("")
  const [editingName, setEditingName] = useState(false)
  const [handle, setHandle] = useState<string>("")
  const [editingHandle, setEditingHandle] = useState(false)
  const [handleInput, setHandleInput] = useState("")
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const avatarMenuRef  = useRef<HTMLDivElement>(null)
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false)

  // Password change dialog
  const [pwDialog, setPwDialog] = useState(false)
  const [currentPw, setCurrentPw] = useState("")
  const [newPw, setNewPw] = useState("")
  const [confirmPw, setConfirmPw] = useState("")
  const [pwLoading, setPwLoading] = useState(false)

  // Delete account dialog
  const [deleteDialog, setDeleteDialog] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState("")
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Integrations
  const [sheetsLoading, setSheetsLoading] = useState(false)
  const { settings: webhookConfig, save: saveWebhookToFirestore, remove: removeWebhookFromFirestore } = useWebhookSettings()
  const [webhookUrl, setWebhookUrl] = useState("")
  const [webhookEvents, setWebhookEvents] = useState<string[]>(["new_expense"])
  const [webhookTesting, setWebhookTesting] = useState(false)

  // Sync local state from Firestore when it loads
  useEffect(() => {
    setWebhookUrl(webhookConfig.webhookUrl)
    setWebhookEvents(webhookConfig.webhookEvents)
  }, [webhookConfig.webhookUrl, webhookConfig.webhookEvents])

  // Click-outside to close avatar source picker
  useEffect(() => {
    if (!avatarMenuOpen) return
    function onMouseDown(e: MouseEvent) {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(e.target as Node)) {
        setAvatarMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", onMouseDown)
    return () => document.removeEventListener("mousedown", onMouseDown)
  }, [avatarMenuOpen])

  // Compute achievement input from available data
  const achievementInput = useMemo(() => {
    // Streak: consecutive days ending today that have at least one expense
    const daySet = new Set(recentExpenses.map((e) => e.date.toDate().toISOString().split("T")[0]))
    let streakDays = 0
    const cursor = new Date()
    while (daySet.has(cursor.toISOString().split("T")[0])) {
      streakDays++
      cursor.setDate(cursor.getDate() - 1)
    }
    return {
      totalExpenses: recentExpenses.length,
      totalGroups: 0,
      totalGoals: goals.length,
      completedGoals: goals.filter((g) => g.currentAmount >= g.targetAmount).length,
      recurringCount: recurringData.length,
      hasExportedPDF: settings?.hasExportedPDF ?? false,
      hasWebhook: !!webhookConfig.webhookUrl,
      hasBudget: (settings?.monthlyBudget ?? 0) > 0,
      streakDays,
    }
  }, [recentExpenses, goals, recurringData, settings, webhookConfig.webhookUrl])

  // Sync handle from Firestore settings (cross-device)
  useEffect(() => {
    if (settings?.handle) setHandle(settings.handle)
  }, [settings?.handle])

  // Portals (Compartir tab)
  const { data: portals = [], isLoading: portalsLoading } = usePortals()
  const [createPortalOpen, setCreatePortalOpen] = useState(false)
  const [newPortalToken, setNewPortalToken] = useState<string | null>(null)

  const isGoogleUser = user?.providerData.some((p) => p.providerId === "google.com")
  const initials = user?.displayName
    ? user.displayName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() ?? "?"

  const memberSince = user?.metadata.creationTime
    ? format(new Date(user.metadata.creationTime), "d MMMM yyyy", { locale: es })
    : "—"

  // ── Avatar upload — Supabase Storage ──────────────────────────────────────
  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    if (file.size > 5 * 1024 * 1024) { toast.error("La imagen no puede superar 5 MB"); return }

    try {
      setUploadProgress(1) // indicar que comenzó
      const idToken = await user.getIdToken()
      const formData = new FormData()
      formData.append("file", file)

      const res = await fetch("/api/upload/avatar", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
        body: formData,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Error desconocido" }))
        throw new Error(err.error ?? "Error al subir")
      }

      const { url } = await res.json() as { url: string }

      // Actualizar photoURL en Firebase Auth para que useAuth() lo refleje de inmediato
      await updateProfile(getFirebaseAuth().currentUser!, { photoURL: url })
      setUploadProgress(null)
      toast.success("Foto actualizada")
    } catch (err) {
      console.error("[avatar upload]", err)
      toast.error("Error al subir la imagen")
      setUploadProgress(null)
    }
  }

  // ── Handle ($usuario) — guardado en Firestore (cross-device) ────────────────
  async function handleSaveHandle() {
    const cleaned = handleInput.trim().replace(/[^a-z0-9_]/gi, "").toLowerCase()
    if (!cleaned) { toast.error("Handle inválido"); return }
    try {
      await updateSettings.mutateAsync({ handle: cleaned })
      setHandle(cleaned)
      setEditingHandle(false)
      toast.success(`Handle guardado: $${cleaned}`)
    } catch { toast.error("Error al guardar el handle") }
  }

  // ── Display name ─────────────────────────────────────────────────────────
  async function handleSaveName() {
    if (!displayName.trim() || !user) return
    try {
      await updateProfile(getFirebaseAuth().currentUser!, { displayName: displayName.trim() })
      toast.success("Nombre actualizado")
      setEditingName(false)
    } catch { toast.error("Error al actualizar el nombre") }
  }

  // ── Password change ───────────────────────────────────────────────────────
  async function handleChangePassword() {
    if (newPw !== confirmPw) { toast.error("Las contraseñas no coinciden"); return }
    if (newPw.length < 6) { toast.error("La contraseña debe tener al menos 6 caracteres"); return }
    const currentUser = getFirebaseAuth().currentUser
    if (!currentUser || !user?.email) return
    setPwLoading(true)
    try {
      const cred = EmailAuthProvider.credential(user.email, currentPw)
      await reauthenticateWithCredential(currentUser, cred)
      await updatePassword(currentUser, newPw)
      toast.success("Contraseña actualizada")
      setPwDialog(false)
      setCurrentPw(""); setNewPw(""); setConfirmPw("")
    } catch (err: unknown) {
      if ((err as { code?: string }).code === "auth/wrong-password") toast.error("Contraseña actual incorrecta")
      else toast.error("Error al cambiar la contraseña")
    } finally { setPwLoading(false) }
  }

  async function handlePasswordReset() {
    if (!user?.email) return
    try {
      await sendPasswordResetEmail(getFirebaseAuth(), user.email)
      toast.success(`Correo enviado a ${user.email}`)
    } catch { toast.error("Error al enviar el correo") }
  }

  // ── Sign out ──────────────────────────────────────────────────────────────
  async function handleSignOut() {
    try {
      await getFirebaseAuth().signOut()
      document.cookie = "session=; path=/; Max-Age=0; SameSite=Lax"
      window.location.href = "/login"
    } catch { toast.error("Error al cerrar sesión") }
  }

  // ── Delete account ────────────────────────────────────────────────────────
  async function handleDeleteAccount() {
    if (deleteConfirm !== "ELIMINAR") { toast.error('Escribe "ELIMINAR" para confirmar'); return }
    const currentUser = getFirebaseAuth().currentUser
    if (!currentUser) return
    setDeleteLoading(true)
    try {
      await deleteUser(currentUser)
      document.cookie = "session=; path=/; Max-Age=0; SameSite=Lax"
      window.location.href = "/login"
    } catch (err: unknown) {
      if ((err as { code?: string }).code === "auth/requires-recent-login") {
        toast.error("Por seguridad, cierra sesión e inicia sesión de nuevo antes de eliminar tu cuenta")
      } else {
        toast.error("Error al eliminar la cuenta")
      }
      setDeleteLoading(false)
    }
  }

  // ── Setting shortcut ──────────────────────────────────────────────────────
  const save = useCallback((updates: Parameters<typeof updateSettings.mutate>[0]) => {
    updateSettings.mutate(updates, {
      onSuccess: () => toast.success("Guardado"),
      onError: () => toast.error("Error al guardar"),
    })
  }, [updateSettings])

  // ── Google Sheets sync ────────────────────────────────────────────────────
  async function handleSheetsSync() {
    if (!recentExpenses.length) { toast.info("Sin gastos para exportar"); return }
    setSheetsLoading(true)
    try {
      const url = await exportToGoogleSheets(recentExpenses, [])
      const ts = new Date().toISOString()
      save({ sheetsLastUrl: url, sheetsLastSyncedAt: ts })
      toast.success("Hoja de cálculo creada", {
        action: { label: "Abrir", onClick: () => window.open(url, "_blank") },
      })
    } catch (err) {
      if (err instanceof SheetsRedirectPending) {
        toast.info("Redirigiendo a Google para autorizar…")
      } else {
        toast.error(err instanceof Error ? err.message : "Error al exportar")
      }
    } finally { setSheetsLoading(false) }
  }

  // ── Webhook ───────────────────────────────────────────────────────────────
  async function saveWebhook() {
    // C5: Validate URL before saving
    if (webhookUrl) {
      try {
        const parsed = new URL(webhookUrl)
        if (!["http:", "https:"].includes(parsed.protocol)) {
          toast.error("La URL debe usar http:// o https://"); return
        }
      } catch {
        toast.error("URL del webhook inválida"); return
      }
    }
    try {
      await saveWebhookToFirestore(webhookUrl, webhookEvents)
      toast.success("Webhook guardado")
    } catch { toast.error("Error al guardar") }
  }

  async function testWebhook() {
    if (!webhookUrl) { toast.error("Introduce una URL primero"); return }
    setWebhookTesting(true)
    const result = await fireWebhook(webhookUrl, {
      event: "test", ts: new Date().toISOString(),
      data: { message: "Test desde ReciboTrack", merchant: "Comercio ejemplo", total: 42.5, currency: "USD" },
    })
    setWebhookTesting(false)
    if (result.ok) toast.success(`Webhook respondió con ${result.status}`)
    else toast.error(result.error ?? `Error ${result.status}`)
  }

  function toggleWebhookEvent(event: string) {
    setWebhookEvents(prev => prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event])
  }

  if (!user) return null

  return (
    <div className="container max-w-2xl mx-auto px-4 py-6 space-y-5">
      {/* ── Page header ── */}
      <div>
        <h1 className="font-serif text-xl">Perfil y ajustes</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Gestiona tu cuenta, preferencias e integraciones</p>
      </div>

      {/* ── Tab bar ── */}
      <div className="flex gap-0.5 rounded-xl bg-muted/50 p-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-lg transition-all",
              tab === id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="text-[10px] font-medium leading-none">{label}</span>
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 1: PERFIL
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === "perfil" && (
        <div className="space-y-4">
          {/* ── Identity card ── */}
          <SectionCard>
            <div className="p-4 space-y-4">
              {/* Avatar + name */}
              <div className="flex items-center gap-4">
                <div className="relative shrink-0">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={user.photoURL ?? ""} alt={user.displayName ?? ""} />
                    <AvatarFallback className="text-xl font-semibold">{initials}</AvatarFallback>
                  </Avatar>
                  <button
                    onClick={() => setAvatarMenuOpen((o) => !o)}
                    className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-foreground text-background flex items-center justify-center hover:bg-foreground/80 transition-colors"
                  >
                    <Camera className="h-3.5 w-3.5" />
                  </button>
                  {/* Gallery input */}
                  <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                  {/* Camera capture input (mobile front cam) */}
                  <input ref={cameraInputRef} type="file" accept="image/*" capture="user" className="hidden" onChange={handleAvatarChange} />

                  {/* Floating source picker */}
                  {avatarMenuOpen && (
                    <div ref={avatarMenuRef} className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 flex flex-col gap-1
                      rounded-xl border bg-card shadow-lg p-1.5 w-36 animate-[fadeSlideUp_0.15s_ease-out_both]">
                      <button
                        type="button"
                        onClick={() => { setAvatarMenuOpen(false); cameraInputRef.current?.click() }}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium hover:bg-muted transition-colors text-left"
                      >
                        <Camera className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        Cámara
                      </button>
                      <button
                        type="button"
                        onClick={() => { setAvatarMenuOpen(false); avatarInputRef.current?.click() }}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium hover:bg-muted transition-colors text-left"
                      >
                        <ImageIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        Galería
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  {editingName ? (
                    <div className="flex gap-2">
                      <Input
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
                        placeholder="Tu nombre"
                        className="h-8 text-sm"
                        autoFocus
                      />
                      <Button size="sm" className="h-8 w-8 p-0" onClick={handleSaveName}><Check className="h-3.5 w-3.5" /></Button>
                    </div>
                  ) : (
                    <button
                      className="text-left group"
                      onClick={() => { setDisplayName(user.displayName ?? ""); setEditingName(true) }}
                    >
                      <p className="font-semibold flex items-center gap-1.5 group-hover:underline underline-offset-2">
                        {user.displayName ?? "Sin nombre"}
                        <span className="text-xs text-muted-foreground font-normal opacity-60 md:opacity-0 md:group-hover:opacity-100 transition-opacity">editar</span>
                      </p>
                    </button>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{user.email}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Badge variant="outline" className="text-xs">{isGoogleUser ? "Google" : "Email"}</Badge>
                    <p className="text-xs text-muted-foreground">Miembro desde {memberSince}</p>
                  </div>
                </div>
              </div>

              {uploadProgress !== null && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Subiendo foto… {uploadProgress}%</p>
                  <Progress value={uploadProgress} className="h-1.5" />
                </div>
              )}
            </div>

            {/* Handle */}
            <div className="border-t px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Handle personal</p>
                <p className="text-xs text-muted-foreground">Tu @identificador público</p>
              </div>
              {editingHandle ? (
                <div className="flex gap-2 items-center">
                  <span className="text-sm text-muted-foreground">$</span>
                  <Input
                    value={handleInput}
                    onChange={(e) => setHandleInput(e.target.value.replace(/[^a-z0-9_]/gi, "").toLowerCase())}
                    onKeyDown={(e) => e.key === "Enter" && handleSaveHandle()}
                    placeholder="tuhandle"
                    className="h-7 text-xs w-24 font-mono"
                    autoFocus maxLength={20}
                  />
                  <Button size="sm" className="h-7 w-7 p-0" onClick={handleSaveHandle}><Check className="h-3 w-3" /></Button>
                  <button onClick={() => setEditingHandle(false)} className="text-xs text-muted-foreground hover:text-foreground">✕</button>
                </div>
              ) : (
                <button
                  onClick={() => { setHandleInput(handle); setEditingHandle(true) }}
                  className="text-sm font-mono text-primary hover:underline underline-offset-2"
                >
                  {handle ? `$${handle}` : <span className="text-muted-foreground text-xs">+ Añadir</span>}
                </button>
              )}
            </div>

            {/* Security */}
            <div className="border-t px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-sm font-medium">Contraseña</p>
                  <p className="text-xs text-muted-foreground">{isGoogleUser ? "Cuenta de Google" : "Contraseña establecida"}</p>
                </div>
              </div>
              {isGoogleUser ? (
                <Badge variant="secondary" className="text-xs">Google SSO</Badge>
              ) : (
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={handlePasswordReset}>Email</Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setPwDialog(true)}>Cambiar</Button>
                </div>
              )}
            </div>

            {/* Passkey */}
            <div className="border-t px-4 py-3">
              <PasskeySetupCard />
            </div>
          </SectionCard>

          {/* ── Stats ── */}
          <SectionCard>
            <SectionHeader title="Mis estadísticas" description="Resumen del año actual" />
            <div className="p-4">
              <PersonalStats />
            </div>
          </SectionCard>

          {/* ── Logros ── */}
          <SectionCard>
            <div className="p-4">
              <AchievementsGrid input={achievementInput} />
            </div>
          </SectionCard>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 2: PREFERENCIAS
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === "preferencias" && (
        <div className="space-y-4">
          {settingsLoading ? (
            <SectionCard>
              <div className="p-4 space-y-3">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-10 rounded-xl" />)}</div>
            </SectionCard>
          ) : (
            <>
              {/* ── Formato ── */}
              <SectionCard>
                <SectionHeader title="Formato y localización" />
                <div className="px-4 divide-y">
                  <SettingRow label="Moneda predeterminada" description="Usada al crear nuevos gastos">
                    <Select value={settings?.defaultCurrency ?? "USD"} onValueChange={(v) => save({ defaultCurrency: v })}>
                      <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </SettingRow>

                  <SettingRow label="Método de pago predeterminado" description="Prellenado al escanear recibos">
                    <Select value={settings?.defaultPaymentMethod ?? "__none__"} onValueChange={(v) => save({ defaultPaymentMethod: v === "__none__" ? null : v })}>
                      <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Sin especificar" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Sin especificar</SelectItem>
                        {PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </SettingRow>

                  <SettingRow label="Categoría predeterminada" description="Cuando el OCR no detecta categoría">
                    <Select value={settings?.defaultCategory ?? "otros"} onValueChange={(v) => save({ defaultCategory: v })}>
                      <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(categories.length > 0 ? categories : DEFAULT_CATEGORIES).map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </SettingRow>

                  <SettingRow label="Inicio de semana">
                    <div className="flex rounded-lg border overflow-hidden text-xs">
                      {([["Lun", 1], ["Dom", 0]] as const).map(([label, val]) => (
                        <button
                          key={val}
                          onClick={() => save({ weekStartsOn: val })}
                          className={`px-3 py-1.5 transition-colors ${settings?.weekStartsOn === val ? "bg-foreground text-background" : "hover:bg-muted"}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </SettingRow>

                  <SettingRow label="Presupuesto mensual" description="Límite de gasto total mensual">
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="number" inputMode="decimal" min={0} step={10}
                        value={settings?.monthlyBudget ?? ""}
                        placeholder="Sin límite"
                        onChange={(e) => { const v = parseFloat(e.target.value); save({ monthlyBudget: isNaN(v) || v === 0 ? null : v }) }}
                        className="w-24 h-8 text-xs tabular-nums text-right"
                      />
                      <span className="text-xs text-muted-foreground">{settings?.defaultCurrency ?? "USD"}</span>
                    </div>
                  </SettingRow>

                  <SettingRow label="Día de inicio del mes" description="¿Cuándo empieza tu mes de gastos?">
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="number" inputMode="decimal" min={1} max={28}
                        value={settings?.monthStartDay ?? 1}
                        onChange={(e) => { const v = parseInt(e.target.value); if (v >= 1 && v <= 28) save({ monthStartDay: v }) }}
                        className="w-16 h-8 text-xs text-center tabular-nums"
                      />
                      <span className="text-xs text-muted-foreground">de cada mes</span>
                    </div>
                  </SettingRow>
                </div>
              </SectionCard>

              {/* ── Apariencia ── */}
              <SectionCard>
                <SectionHeader title="Apariencia" />
                <div className="px-4 py-4 space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-3">Tema de la aplicación</p>
                    <div className="grid grid-cols-3 gap-2">
                      {([
                        { value: "light", label: "Claro", icon: Sun },
                        { value: "dark", label: "Oscuro", icon: Moon },
                        { value: "system", label: "Sistema", icon: Monitor },
                      ] as const).map(({ value, label, icon: Icon }) => (
                        <button
                          key={value}
                          onClick={() => setTheme(value)}
                          className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border text-xs transition-colors ${theme === value ? "border-foreground bg-accent font-medium" : "border-border text-muted-foreground hover:border-muted-foreground"}`}
                        >
                          <Icon className="h-4 w-4" />
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <AccentColorPicker />
                  <div className="divide-y">
                    <SettingRow label="Tema automático" description="Oscuro entre las 21:00 y las 7:00">
                      <Toggle checked={settings?.autoTheme ?? false} onChange={(v) => save({ autoTheme: v })} />
                    </SettingRow>
                  </div>
                </div>
              </SectionCard>

              {/* ── Round-Ups ── */}
              <CollapsibleSectionCard title="Round-Ups automáticos" description="Redondea cada gasto y ahorra la diferencia en una meta">
                <div className="px-4 divide-y">
                  <SettingRow label="Activar Round-Ups">
                    <Toggle checked={roundupSettings?.roundupEnabled ?? false} onChange={(v) => setRoundupSettings.mutate({ roundupEnabled: v })} />
                  </SettingRow>
                  {roundupSettings?.roundupEnabled && (
                    <SettingRow label="Meta para ahorros" description="Los redondeos se añaden a esta meta">
                      <Select value={roundupSettings?.roundupGoalId ?? ""} onValueChange={(v) => setRoundupSettings.mutate({ roundupGoalId: v })}>
                        <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Seleccionar meta" /></SelectTrigger>
                        <SelectContent>
                          {activeGoals.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </SettingRow>
                  )}
                </div>
              </CollapsibleSectionCard>

              {/* ── Notificaciones ── */}
              <CollapsibleSectionCard title="Notificaciones">
                <div className="px-4 divide-y">
                  <SettingRow label="Notificaciones push" description="Requiere permiso en el navegador">
                    <Toggle
                      checked={settings?.notificationsEnabled ?? false}
                      onChange={async (v) => {
                        if (v && "Notification" in window) {
                          const perm = await Notification.requestPermission()
                          if (perm !== "granted") { toast.error("Permite las notificaciones en la configuración del navegador"); return }
                        }
                        save({ notificationsEnabled: v })
                      }}
                    />
                  </SettingRow>
                  <SettingRow label="Aviso de gastos recurrentes" description="Recordatorio antes de que venza un recurrente">
                    <Toggle checked={settings?.notifyRecurring ?? true} onChange={(v) => save({ notifyRecurring: v })} />
                  </SettingRow>
                  <SettingRow label="Resumen semanal" description="Notificación los lunes con el gasto de la semana">
                    <Toggle checked={settings?.notifyWeeklySummary ?? false} onChange={(v) => save({ notifyWeeklySummary: v })} />
                  </SettingRow>
                  <SettingRow label="Días de aviso anticipado" description="Cuántos días antes de vencer un recurrente">
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="number" inputMode="decimal" min={0} max={30}
                        value={settings?.reminderDaysBefore ?? 3}
                        onChange={(e) => save({ reminderDaysBefore: parseInt(e.target.value) || 0 })}
                        className="w-16 h-8 text-xs text-center tabular-nums"
                      />
                      <span className="text-xs text-muted-foreground">días</span>
                    </div>
                  </SettingRow>
                </div>
              </CollapsibleSectionCard>

              {/* ── Presentación / onboarding ── */}
              <SectionCard>
                <div className="px-4 py-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">Presentación de la app</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Vuelve a ver el tour de bienvenida y la página de permisos</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 h-8 text-xs gap-1.5"
                    onClick={() => save({ onboardingCompleted: false })}
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                    Ver tour
                  </Button>
                </div>
              </SectionCard>

              {/* ── Categorías visibles ── */}
              <CollapsibleSectionCard title="Categorías visibles" description="Oculta las que no usas en los formularios">
                <div className="p-4 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {DEFAULT_CATEGORIES.map((cat) => {
                      const hidden = (settings?.hiddenDefaultCategories ?? []).includes(cat.id)
                      return (
                        <button
                          key={cat.id}
                          onClick={() => {
                            const current = settings?.hiddenDefaultCategories ?? []
                            const next = hidden ? current.filter(id => id !== cat.id) : [...current, cat.id]
                            save({ hiddenDefaultCategories: next })
                          }}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${
                            hidden
                              ? "opacity-40 bg-muted border-muted-foreground/20 line-through text-muted-foreground"
                              : "bg-background border-border hover:border-muted-foreground"
                          }`}
                        >
                          {cat.icon} {cat.name}
                        </button>
                      )
                    })}
                  </div>
                  {(settings?.hiddenDefaultCategories?.length ?? 0) > 0 && (
                    <button
                      onClick={() => save({ hiddenDefaultCategories: [] })}
                      className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                    >
                      Mostrar todas
                    </button>
                  )}
                </div>
              </CollapsibleSectionCard>
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 3: DATOS
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === "datos" && (
        <div className="space-y-4">
          {/* ── Export ── */}
          <SectionCard>
            <SectionHeader title="Exportar gastos" description="Descarga tus datos en distintos formatos" />
            <div className="p-4 space-y-3">
              <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-2.5">
                Los formatos de abajo exportan los gastos de los últimos 6 meses.
                Para rangos personalizados usa <strong>"Exportar"</strong> en la página de Gastos.
              </p>

              {/* CSV genérico */}
              <div>
                <Button
                  variant="outline" size="sm" className="w-full gap-2 justify-start"
                  onClick={() => {
                    if (!recentExpenses.length) { toast.info("Sin gastos para exportar"); return }
                    toast.info("Preparando exportación…")
                    exportToCSV(recentExpenses)
                  }}
                >
                  <Download className="h-4 w-4" /> Exportar CSV genérico
                </Button>
                <p className="text-xs text-muted-foreground mt-1 pl-1">
                  Columnas: fecha, comercio, categoría, total, moneda, notas. Compatible con Excel, Numbers y cualquier hoja de cálculo.
                </p>
              </div>

              {/* Holded */}
              <div>
                <Button
                  variant="outline" size="sm" className="w-full gap-2 justify-start"
                  onClick={() => {
                    if (!recentExpenses.length) { toast.info("Sin gastos para exportar"); return }
                    exportHoldedCsv(recentExpenses)
                    toast.success("Exportado para Holded")
                  }}
                >
                  <Download className="h-4 w-4" /> Exportar para Holded
                </Button>
                <p className="text-xs text-muted-foreground mt-1 pl-1">
                  Formato Holded ERP: importa tus gastos directamente como facturas recibidas en tu cuenta de Holded.
                </p>
              </div>

              {/* Contasimple */}
              <div>
                <Button
                  variant="outline" size="sm" className="w-full gap-2 justify-start"
                  onClick={() => {
                    if (!recentExpenses.length) { toast.info("Sin gastos para exportar"); return }
                    exportContasimpleCsv(recentExpenses)
                    toast.success("Exportado para Contasimple")
                  }}
                >
                  <Download className="h-4 w-4" /> Exportar para Contasimple
                </Button>
                <p className="text-xs text-muted-foreground mt-1 pl-1">
                  Formato Contasimple: columnas adaptadas al ERP español para importar gastos como apuntes contables.
                </p>
              </div>

              <Button
                variant="outline" size="sm" className="w-full gap-2 justify-start text-primary"
                onClick={() => { window.location.href = "/expenses" }}
              >
                <ChevronRight className="h-4 w-4" /> Ir a Gastos para exportar con filtros
              </Button>
            </div>
          </SectionCard>

          {/* ── Google Sheets ── */}
          <SectionCard>
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sheet className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-semibold">Google Sheets</p>
                </div>
                <span className={cn(
                  "text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full",
                  settings?.sheetsLastUrl ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground"
                )}>
                  {settings?.sheetsLastUrl ? "Sincronizado" : "Sin conectar"}
                </span>
              </div>

              {settings?.sheetsLastUrl && settings.sheetsLastSyncedAt && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Última sync · {format(new Date(settings.sheetsLastSyncedAt), "d MMM yyyy HH:mm", { locale: es })}</span>
                  <a href={settings.sheetsLastUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-primary hover:underline underline-offset-2 shrink-0">
                    <ExternalLink className="h-3 w-3" /> Abrir hoja
                  </a>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Exporta tus gastos a una nueva hoja de cálculo de Google. Necesitarás autorizar el acceso a Google Drive la primera vez.
              </p>

              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1 gap-2" onClick={handleSheetsSync} disabled={sheetsLoading}>
                  {sheetsLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  {settings?.sheetsLastUrl ? "Sincronizar de nuevo" : "Conectar y exportar"}
                </Button>
                {settings?.sheetsLastUrl && (
                  <Button size="sm" variant="ghost" className="gap-1.5 text-muted-foreground hover:text-destructive"
                    onClick={() => save({ sheetsLastUrl: null, sheetsLastSyncedAt: null })}>
                    <Link2Off className="h-3.5 w-3.5" /> Desconectar
                  </Button>
                )}
              </div>
            </div>
          </SectionCard>

          {/* ── Webhooks (outgoing) ── */}
          <SectionCard>
            <Link href="/settings/webhooks" className="flex items-center justify-between px-4 py-3.5 hover:bg-muted/30 rounded-2xl transition-colors">
              <div className="flex items-center gap-3">
                <Webhook className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Webhooks salientes</p>
                  <p className="text-xs text-muted-foreground">Integra con Zapier, n8n, Make y más</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </SectionCard>

          {/* ── Webhook (legacy single) ── */}
          <CollapsibleSectionCard title="Webhook personal (legado)" description="Automatiza con Zapier, Make o n8n">
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Webhook className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-semibold">Webhook personal</p>
                </div>
                <span className={cn(
                  "text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full",
                  webhookUrl ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground"
                )}>
                  {webhookUrl ? "Activo" : "Inactivo"}
                </span>
              </div>

              <p className="text-xs text-muted-foreground">
                Envía una petición POST a tu URL al ocurrir un evento. Compatible con Zapier, Make, n8n y cualquier endpoint HTTP.
              </p>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">URL del endpoint</Label>
                <Input
                  value={webhookUrl}
                  onChange={e => setWebhookUrl(e.target.value)}
                  placeholder="https://hooks.zapier.com/hooks/catch/…"
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Disparar cuando</Label>
                <div className="space-y-1.5">
                  {([
                    { key: "new_expense", label: "Se registra un nuevo gasto" },
                    { key: "budget_alert", label: "Se supera el presupuesto mensual" },
                  ] as const).map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2.5 cursor-pointer select-none">
                      <input type="checkbox" checked={webhookEvents.includes(key)} onChange={() => toggleWebhookEvent(key)}
                        className="rounded border-border accent-primary" />
                      <span className="text-xs">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={saveWebhook}>Guardar</Button>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={testWebhook} disabled={webhookTesting || !webhookUrl}>
                  {webhookTesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  Probar
                </Button>
                {webhookUrl && (
                  <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive"
                    onClick={() => { setWebhookUrl(""); void removeWebhookFromFirestore() }}>
                    <Link2Off className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>

              {webhookUrl && (
                <div className="rounded-lg bg-muted/40 border px-3 py-2 text-xs font-mono text-muted-foreground break-all">
                  POST → {webhookUrl}
                </div>
              )}
            </div>
          </CollapsibleSectionCard>

        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 4: COMPARTIR
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === "compartir" && (
        <div className="space-y-4">
          {/* ── Trusted Circle ── */}
          <TrustedCircleCard />

          <CreatePortalDialog
            open={createPortalOpen}
            onOpenChange={setCreatePortalOpen}
            onCreated={(token) => { setNewPortalToken(token) }}
          />

          {/* New portal token reveal */}
          {newPortalToken && (
            <SectionCard>
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                  <Check className="h-4 w-4" />
                  <p className="text-sm font-semibold">Portal creado</p>
                </div>
                <p className="text-xs text-muted-foreground">Copia el enlace y compártelo. Solo las personas con este link podrán ver los datos.</p>
                <div className="rounded-lg bg-muted/60 border px-3 py-2 flex items-center gap-2">
                  <code className="flex-1 text-xs font-mono break-all text-foreground">
                    {typeof window !== "undefined" ? `${window.location.origin}/portal/${newPortalToken}` : `/portal/${newPortalToken}`}
                  </code>
                  <Button size="sm" variant="ghost" className="h-7 shrink-0"
                    onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/portal/${newPortalToken}`); toast.success("Copiado") }}>
                    <Share2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Button size="sm" variant="ghost" className="w-full text-muted-foreground text-xs" onClick={() => setNewPortalToken(null)}>
                  Listo
                </Button>
              </div>
            </SectionCard>
          )}

          {/* Portals list */}
          <SectionCard>
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Portales compartidos</p>
                <p className="text-xs text-muted-foreground mt-0.5">Links con permisos finos para contadores, socios y familiares</p>
              </div>
              <Button size="sm" className="gap-1.5 h-8" onClick={() => setCreatePortalOpen(true)}>
                <Plus className="h-3.5 w-3.5" />
                Nuevo
              </Button>
            </div>
            <div className="p-4 space-y-3">
              {portalsLoading ? (
                <div className="space-y-2">
                  {[1,2].map(i => <div key={i} className="h-28 rounded-xl bg-muted/40 animate-pulse" />)}
                </div>
              ) : portals.length === 0 ? (
                <div className="text-center py-8">
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                    <Share2 className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium">Aún no tienes portales</p>
                  <p className="text-xs text-muted-foreground mt-1">Crea un portal para compartir tus gastos con permisos personalizados</p>
                  <Button size="sm" variant="outline" className="mt-4 gap-2" onClick={() => setCreatePortalOpen(true)}>
                    <Plus className="h-3.5 w-3.5" /> Crear mi primer portal
                  </Button>
                </div>
              ) : (
                portals.map((portal) => <PortalCard key={portal.id} portal={portal} />)
              )}
            </div>
          </SectionCard>

          {/* How it works */}
          <SectionCard>
            <div className="p-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cómo funciona</p>
              {[
                { emoji: "🔗", text: "Cada portal tiene un enlace único con token de 48 caracteres — imposible de adivinar" },
                { emoji: "🔒", text: "Los datos se filtran en el servidor. El visitante nunca recibe más de lo que le permites" },
                { emoji: "⏱️", text: "Los portales expiran automáticamente. Puedes revocarlos con un clic en cualquier momento" },
                { emoji: "📊", text: "Ves cuántas veces se accedió al portal y cuándo fue el último acceso" },
              ].map(({ emoji, text }) => (
                <div key={text} className="flex gap-2.5 items-start">
                  <span className="text-base shrink-0">{emoji}</span>
                  <p className="text-xs text-muted-foreground leading-relaxed">{text}</p>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 5: CUENTA
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === "cuenta" && (
        <div className="space-y-4">
          {/* ── Account summary ── */}
          <SectionCard>
            <SectionHeader title="Resumen de cuenta" />
            <div className="p-4 space-y-3">
              {/* Plan badge */}
              <div className="flex items-center justify-between rounded-xl border bg-muted/20 px-4 py-3">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Plan actual</p>
                  <p className="text-sm font-bold mt-0.5">
                    {planData?.plan === "pro" ? (
                      <span className="text-primary">⭐ Pro</span>
                    ) : (
                      "Gratuito"
                    )}
                  </p>
                </div>
                {planData?.plan !== "pro" && (
                  <button className="rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">
                    Actualizar
                  </button>
                )}
                {planData?.plan === "pro" && (
                  <Badge variant="outline" className="text-xs border-primary/30 text-primary">Activo</Badge>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="text-center rounded-xl border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Miembro desde</p>
                  <p className="text-sm font-bold mt-1">{memberSince}</p>
                </div>
                <div className="text-center rounded-xl border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Recurrentes</p>
                  <p className="text-lg font-bold mt-0.5">{recurringData.length}</p>
                </div>
                <div className="text-center rounded-xl border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Metas</p>
                  <p className="text-lg font-bold mt-0.5">{goals.length}</p>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* ── App ── */}
          <SectionCard>
            <SectionHeader title="Aplicación" description="Instala ReciboTrack como app nativa" />
            <div className="p-4">
              <PwaInstallButton />
            </div>
          </SectionCard>

          {/* ── Session ── */}
          <SectionCard>
            <SectionHeader title="Sesión" />
            <div className="p-4">
              <Button variant="outline" size="sm" className="w-full gap-2 justify-start" onClick={handleSignOut}>
                <LogOut className="h-4 w-4" /> Cerrar sesión
              </Button>
            </div>
          </SectionCard>

          {/* ── Danger zone ── */}
          <SectionCard>
            <div className="px-4 py-3 border-b">
              <p className="text-sm font-semibold text-destructive flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> Zona de peligro
              </p>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-xs text-muted-foreground">
                Eliminar tu cuenta es permanente e irreversible. Tu historial de gastos, grupos y demás datos de la app quedan eliminados de forma definitiva.
              </p>
              <Button
                variant="outline" size="sm"
                className="w-full gap-2 justify-start text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5"
                onClick={() => setDeleteDialog(true)}
              >
                <Trash2 className="h-4 w-4" /> Eliminar mi cuenta permanentemente
              </Button>
            </div>
          </SectionCard>
        </div>
      )}

      {/* ── Change password dialog ── */}
      <Dialog open={pwDialog} onOpenChange={(o) => { if (!o) { setPwDialog(false); setCurrentPw(""); setNewPw(""); setConfirmPw("") } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Cambiar contraseña</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-1">
            <div className="space-y-1.5">
              <Label>Contraseña actual</Label>
              <Input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} autoComplete="current-password" />
            </div>
            <div className="space-y-1.5">
              <Label>Nueva contraseña</Label>
              <Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" />
            </div>
            <div className="space-y-1.5">
              <Label>Confirmar nueva contraseña</Label>
              <Input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} autoComplete="new-password"
                onKeyDown={(e) => e.key === "Enter" && handleChangePassword()} />
            </div>
            {newPw && confirmPw && newPw !== confirmPw && <p className="text-xs text-destructive">Las contraseñas no coinciden</p>}
            <Button className="w-full" onClick={handleChangePassword} disabled={pwLoading || !currentPw || !newPw || newPw !== confirmPw}>
              {pwLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Cambiar contraseña
            </Button>
            <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={handlePasswordReset}>
              Recibir enlace de restablecimiento por correo
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete account dialog ── */}
      <Dialog open={deleteDialog} onOpenChange={(o) => { if (!o) { setDeleteDialog(false); setDeleteConfirm("") } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Eliminar cuenta
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-1">
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive space-y-1">
              <p className="font-semibold">Esta acción es irreversible.</p>
              <p>Se eliminarán tu cuenta y todos tus datos de autenticación.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Escribe <strong>ELIMINAR</strong> para confirmar</Label>
              <Input value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder="ELIMINAR" className="font-mono" />
            </div>
            <Button variant="destructive" className="w-full" disabled={deleteConfirm !== "ELIMINAR" || deleteLoading} onClick={handleDeleteAccount}>
              {deleteLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Eliminar mi cuenta
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
