"use client"

import { useState, useRef, useCallback, useMemo, useEffect } from "react"
import { useAuth } from "@/hooks/use-auth"
import { useUserSettings, useUpdateUserSettings } from "@/hooks/use-user-settings"
import { useExpensesPeriod } from "@/hooks/use-expenses"
import { useCategories } from "@/hooks/use-categories"
import { useRecurring } from "@/hooks/use-recurring"
import { useGoals } from "@/hooks/use-goals"
import { useRoundupSettings, useSetRoundupSettings } from "@/hooks/use-roundup-settings"
import { exportToCSV, exportHoldedCsv, exportContasimpleCsv } from "@/components/expenses/export-utils"
import { formatCurrency, cn } from "@/lib/utils"
import { CURRENCIES, PAYMENT_METHODS, DEFAULT_CATEGORIES } from "@/lib/constants"
import { getFirebaseAuth, getFirebaseStorage } from "@/lib/firebase/client"
import {
  updateProfile, updatePassword, reauthenticateWithCredential,
  EmailAuthProvider, deleteUser, sendPasswordResetEmail,
} from "firebase/auth"
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage"
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
  ChevronRight, Lock, Smartphone, Database, Plug, CreditCard,
} from "lucide-react"
import { AccentColorPicker } from "@/components/shared/accent-color-picker"
import { TrustedCircleCard } from "@/components/profile/trusted-circle-card"
import { PwaInstallButton } from "@/components/shared/pwa-install-button"
import { PasskeySetupCard } from "@/components/auth/passkey-setup-card"
import { format, startOfYear, endOfYear, getMonth, getDay, subMonths } from "date-fns"
import { es } from "date-fns/locale"
import type { Expense } from "@/types"
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

// ─── Personal stats ───────────────────────────────────────────────────────────
function PersonalStats() {
  const now = new Date()
  const yearStart = startOfYear(now)
  const yearEnd = endOfYear(now)
  const { data: yearExpenses = [], isLoading } = useExpensesPeriod(yearStart, yearEnd)
  const { data: categories = [] } = useCategories()

  const stats = useMemo(() => {
    if (!yearExpenses.length) return null
    const expDate = (e: Expense) => (e.date as { toDate(): Date }).toDate()
    const totalYear = yearExpenses.reduce((s, e) => s + e.total, 0)

    const byCategory = new Map<string, number>()
    yearExpenses.forEach(e => byCategory.set(e.category ?? "otros", (byCategory.get(e.category ?? "otros") ?? 0) + e.total))
    const topCatId = [...byCategory.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
    const topCat = categories.find(c => c.id === topCatId)
    const topCatLabel = topCat ? `${topCat.icon} ${topCat.name}` : topCatId ?? "—"

    const byMerchant = new Map<string, number>()
    yearExpenses.forEach(e => {
      const k = e.merchant.trim().toLowerCase()
      byMerchant.set(k, (byMerchant.get(k) ?? 0) + 1)
    })
    const topMerchantKey = [...byMerchant.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
    const topMerchantCount = byMerchant.get(topMerchantKey ?? "") ?? 0
    const topMerchantName = yearExpenses.find(e => e.merchant.trim().toLowerCase() === topMerchantKey)?.merchant ?? "—"

    const byMonth = new Map<number, number>()
    yearExpenses.forEach(e => { const m = getMonth(expDate(e)); byMonth.set(m, (byMonth.get(m) ?? 0) + e.total) })
    const topMonthNum = [...byMonth.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
    const topMonth = topMonthNum !== undefined ? format(new Date(now.getFullYear(), topMonthNum), "MMMM", { locale: es }) : "—"

    const byDow = new Map<number, number>()
    yearExpenses.forEach(e => { const d = getDay(expDate(e)); byDow.set(d, (byDow.get(d) ?? 0) + 1) })
    const DOW = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
    const topDowNum = [...byDow.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
    const topDow = topDowNum !== undefined ? DOW[topDowNum] : "—"

    const monthsElapsed = Math.max(getMonth(now) + 1, 1)
    return { totalYear, topCatLabel, topMerchantName, topMerchantCount, topMonth, topDow, monthlyAvg: totalYear / monthsElapsed, count: yearExpenses.length }
  }, [yearExpenses, categories, now])

  if (isLoading) return <div className="grid grid-cols-2 gap-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>

  if (!stats) return <p className="text-xs text-muted-foreground text-center py-4">Aún no hay datos para mostrar estadísticas del año.</p>

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/10 p-4 text-center">
        <p className="text-[10px] font-semibold text-primary/70 uppercase tracking-widest mb-1">{now.getFullYear()} · Total gastado</p>
        <p className="text-3xl font-bold tabular-nums">{formatCurrency(stats.totalYear)}</p>
        <p className="text-xs text-muted-foreground mt-1">~{formatCurrency(stats.monthlyAvg)} / mes · {stats.count} gastos</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-muted/40 border p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Categoría top</p>
          <p className="text-sm font-bold mt-1 truncate">{stats.topCatLabel}</p>
        </div>
        <div className="rounded-xl bg-muted/40 border p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Mes más activo</p>
          <p className="text-sm font-bold mt-1 capitalize">{stats.topMonth}</p>
        </div>
        <div className="rounded-xl bg-muted/40 border p-3 col-span-2">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Comercio favorito</p>
          <p className="text-sm font-bold mt-1 truncate">{stats.topMerchantName}</p>
          <p className="text-[10px] text-muted-foreground">{stats.topMerchantCount} visitas este año</p>
        </div>
      </div>
    </div>
  )
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
type Tab = "perfil" | "preferencias" | "datos" | "cuenta"
const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "perfil",        label: "Perfil",        icon: User },
  { id: "preferencias",  label: "Ajustes",        icon: Settings2 },
  { id: "datos",         label: "Datos",          icon: Database },
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
  const [handle, setHandle] = useState<string>(() => {
    try { return localStorage.getItem("rt-handle") ?? "" } catch { return "" }
  })
  const [editingHandle, setEditingHandle] = useState(false)
  const [handleInput, setHandleInput] = useState("")
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)

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
  const [webhookUrl, setWebhookUrl] = useState<string>(() => {
    try { return localStorage.getItem("rt-webhook-url") ?? "" } catch { return "" }
  })
  const [webhookEvents, setWebhookEvents] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("rt-webhook-events") ?? '["new_expense"]') } catch { return ["new_expense"] }
  })
  const [webhookTesting, setWebhookTesting] = useState(false)

  const isGoogleUser = user?.providerData.some((p) => p.providerId === "google.com")
  const initials = user?.displayName
    ? user.displayName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() ?? "?"

  const memberSince = user?.metadata.creationTime
    ? format(new Date(user.metadata.creationTime), "d MMMM yyyy", { locale: es })
    : "—"

  // ── Avatar upload ─────────────────────────────────────────────────────────
  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    if (file.size > 5 * 1024 * 1024) { toast.error("La imagen no puede superar 5 MB"); return }
    try {
      const storage = getFirebaseStorage()
      const fileRef = storageRef(storage, `avatars/${user.uid}/${Date.now()}.jpg`)
      const task = uploadBytesResumable(fileRef, file)
      await new Promise<void>((resolve, reject) => {
        task.on("state_changed",
          (snap) => setUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
          reject,
          async () => {
            const url = await getDownloadURL(task.snapshot.ref)
            await updateProfile(getFirebaseAuth().currentUser!, { photoURL: url })
            setUploadProgress(null)
            resolve()
          }
        )
      })
      toast.success("Foto actualizada")
    } catch {
      toast.error("Error al subir la imagen")
      setUploadProgress(null)
    }
  }

  // ── Handle ($usuario) ─────────────────────────────────────────────────────
  function handleSaveHandle() {
    const cleaned = handleInput.trim().replace(/[^a-z0-9_]/gi, "").toLowerCase()
    if (!cleaned) { toast.error("Handle inválido"); return }
    try {
      localStorage.setItem("rt-handle", cleaned)
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
  function saveWebhook() {
    try {
      localStorage.setItem("rt-webhook-url", webhookUrl)
      localStorage.setItem("rt-webhook-events", JSON.stringify(webhookEvents))
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
        <h1 className="text-xl font-semibold">Perfil y ajustes</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Gestiona tu cuenta, preferencias e integraciones</p>
      </div>

      {/* ── Tab bar ── */}
      <div className="flex gap-1 rounded-xl bg-muted/50 p-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all",
              tab === id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">{label}</span>
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
                    onClick={() => avatarInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-foreground text-background flex items-center justify-center hover:bg-foreground/80 transition-colors"
                  >
                    <Camera className="h-3.5 w-3.5" />
                  </button>
                  <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
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
                        <span className="text-[10px] text-muted-foreground font-normal opacity-0 group-hover:opacity-100 transition-opacity">editar</span>
                      </p>
                    </button>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{user.email}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Badge variant="outline" className="text-[10px]">{isGoogleUser ? "Google" : "Email"}</Badge>
                    <p className="text-[10px] text-muted-foreground">Miembro desde {memberSince}</p>
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
                        type="number" min={0} step={10}
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
                        type="number" min={1} max={28}
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
              <SectionCard>
                <SectionHeader title="Round-Ups automáticos" description="Redondea cada gasto y ahorra la diferencia en una meta" />
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
              </SectionCard>

              {/* ── Notificaciones ── */}
              <SectionCard>
                <SectionHeader title="Notificaciones" />
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
                        type="number" min={0} max={30}
                        value={settings?.reminderDaysBefore ?? 3}
                        onChange={(e) => save({ reminderDaysBefore: parseInt(e.target.value) || 0 })}
                        className="w-16 h-8 text-xs text-center tabular-nums"
                      />
                      <span className="text-xs text-muted-foreground">días</span>
                    </div>
                  </SettingRow>
                </div>
              </SectionCard>

              {/* ── Categorías visibles ── */}
              <SectionCard>
                <SectionHeader title="Categorías visibles" description="Oculta las que no usas en los formularios" />
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
                      className="text-[10px] text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                    >
                      Mostrar todas
                    </button>
                  )}
                </div>
              </SectionCard>
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
            <div className="p-4 space-y-2">
              <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-2.5">
                Los botones de abajo exportan los gastos de los últimos 6 meses.
                Para exportar rangos personalizados usa el botón <strong>"Exportar"</strong> en la página de Gastos.
              </p>
              <Button
                variant="outline" size="sm" className="w-full gap-2 justify-start"
                onClick={() => {
                  if (!recentExpenses.length) { toast.info("Sin gastos para exportar"); return }
                  toast.info("Preparando exportación…")
                  exportToCSV(recentExpenses)
                }}
              >
                <Download className="h-4 w-4" /> Exportar CSV (últimos 6 meses)
              </Button>
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
                  "text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full",
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

          {/* ── Webhook ── */}
          <SectionCard>
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Webhook className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-semibold">Webhook personal</p>
                </div>
                <span className={cn(
                  "text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full",
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
                    onClick={() => { setWebhookUrl(""); try { localStorage.removeItem("rt-webhook-url") } catch {} }}>
                    <Link2Off className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>

              {webhookUrl && (
                <div className="rounded-lg bg-muted/40 border px-3 py-2 text-[10px] font-mono text-muted-foreground break-all">
                  POST → {webhookUrl}
                </div>
              )}
            </div>
          </SectionCard>

          {/* ── Trusted Circle ── */}
          <TrustedCircleCard />
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 4: CUENTA
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === "cuenta" && (
        <div className="space-y-4">
          {/* ── Account summary ── */}
          <SectionCard>
            <SectionHeader title="Resumen de cuenta" />
            <div className="p-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center rounded-xl border bg-muted/20 p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Miembro desde</p>
                  <p className="text-sm font-bold mt-1">{memberSince}</p>
                </div>
                <div className="text-center rounded-xl border bg-muted/20 p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Recurrentes</p>
                  <p className="text-lg font-bold mt-0.5">{recurringData.length}</p>
                </div>
                <div className="text-center rounded-xl border bg-muted/20 p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Metas</p>
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
                Eliminar tu cuenta es permanente e irreversible. Los datos en Firestore (gastos, grupos, etc.) se mantienen hasta que los elimines manualmente.
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
