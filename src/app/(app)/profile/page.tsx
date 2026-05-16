"use client"

import { useState, useRef, useCallback } from "react"
import { useAuth } from "@/hooks/use-auth"
import { useUserSettings, useUpdateUserSettings } from "@/hooks/use-user-settings"
import { useExpenses } from "@/hooks/use-expenses"
import { useCategories } from "@/hooks/use-categories"
import { useRecurring } from "@/hooks/use-recurring"
import { exportToCSV, exportHoldedCsv, exportContasimpleCsv } from "@/components/expenses/export-utils"
import { formatCurrency } from "@/lib/utils"
import { CURRENCIES, PAYMENT_METHODS, DEFAULT_CATEGORIES } from "@/lib/constants"
import { getFirebaseAuth, getFirebaseStorage } from "@/lib/firebase/client"
import {
  updateProfile, updatePassword, reauthenticateWithCredential,
  EmailAuthProvider, deleteUser, sendPasswordResetEmail,
} from "firebase/auth"
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage"
import { useTheme } from "next-themes"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  User, Mail, Lock, Camera, Sun, Moon, Monitor, Download,
  LogOut, Trash2, Bell, Calendar, LayoutList, Globe,
  Shield, ChevronRight, Check, Loader2, AlertTriangle,
} from "lucide-react"
import { AccentColorPicker } from "@/components/shared/accent-color-picker"
import { PwaInstallButton } from "@/components/shared/pwa-install-button"
import { format } from "date-fns"
import { es } from "date-fns/locale"

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({ title, icon: Icon, children }: {
  title: string; icon: React.ElementType; children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  )
}

// ─── Setting row ─────────────────────────────────────────────────────────────
function SettingRow({ label, description, children }: {
  label: string; description?: string; children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

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

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="text-center rounded-xl border bg-muted/20 p-3">
      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-lg font-bold tabular-nums mt-0.5">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const { user } = useAuth()
  const { data: settings, isLoading: settingsLoading } = useUserSettings()
  const updateSettings = useUpdateUserSettings()
  const { data: categories = [] } = useCategories()
  const { data: recurringData = [] } = useRecurring()
  const { data: expenseData } = useExpenses({ page: 1 })
  const { theme, setTheme } = useTheme()

  // Profile edit
  const [displayName, setDisplayName] = useState("")
  const [editingName, setEditingName] = useState(false)
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

  const isGoogleUser = user?.providerData.some((p) => p.providerId === "google.com")
  const initials = user?.displayName
    ? user.displayName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() ?? "?"

  const memberSince = user?.metadata.creationTime
    ? format(new Date(user.metadata.creationTime), "MMMM yyyy", { locale: es })
    : "—"

  const totalExpenses = expenseData?.total ?? 0

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

  // ── Display name ─────────────────────────────────────────────────────────
  async function handleSaveName() {
    if (!displayName.trim() || !user) return
    try {
      await updateProfile(getFirebaseAuth().currentUser!, { displayName: displayName.trim() })
      toast.success("Nombre actualizado")
      setEditingName(false)
    } catch {
      toast.error("Error al actualizar el nombre")
    }
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
    } catch (err: any) {
      if (err.code === "auth/wrong-password") toast.error("Contraseña actual incorrecta")
      else toast.error("Error al cambiar la contraseña")
    } finally {
      setPwLoading(false)
    }
  }

  // ── Password reset email ──────────────────────────────────────────────────
  async function handlePasswordReset() {
    if (!user?.email) return
    try {
      await sendPasswordResetEmail(getFirebaseAuth(), user.email)
      toast.success(`Se envió un correo de restablecimiento a ${user.email}`)
    } catch {
      toast.error("Error al enviar el correo")
    }
  }

  // ── Sign out ──────────────────────────────────────────────────────────────
  async function handleSignOut() {
    try {
      await getFirebaseAuth().signOut()
      document.cookie = "session=; path=/; Max-Age=0; SameSite=Lax"
      window.location.href = "/login"
    } catch {
      toast.error("Error al cerrar sesión")
    }
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
    } catch (err: any) {
      if (err.code === "auth/requires-recent-login") {
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

  if (!user) return null

  return (
    <div className="container max-w-2xl mx-auto px-4 py-6 space-y-5">
      <h1 className="font-serif text-2xl">Perfil y ajustes</h1>

      {/* ── 1. Perfil ── */}
      <Section title="Tu perfil" icon={User}>
        {/* Avatar */}
        <div className="flex items-center gap-4">
          <div className="relative">
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
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
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
                <Button size="sm" className="h-8" onClick={handleSaveName}>
                  <Check className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <button
                className="text-left group"
                onClick={() => { setDisplayName(user.displayName ?? ""); setEditingName(true) }}
              >
                <p className="font-semibold group-hover:underline underline-offset-2 flex items-center gap-1.5">
                  {user.displayName ?? "Sin nombre"}
                  <span className="text-[10px] text-muted-foreground font-normal opacity-0 group-hover:opacity-100 transition-opacity">editar</span>
                </p>
              </button>
            )}
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{user.email}</p>
            <Badge variant="outline" className="text-[10px] mt-1.5">
              {isGoogleUser ? "Google" : "Email y contraseña"}
            </Badge>
          </div>
        </div>

        {/* Upload progress */}
        {uploadProgress !== null && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Subiendo foto… {uploadProgress}%</p>
            <Progress value={uploadProgress} className="h-1.5" />
          </div>
        )}

        {/* Password */}
        <div className="border-t pt-3">
          {isGoogleUser ? (
            <SettingRow label="Contraseña" description="Tu cuenta usa autenticación de Google">
              <Badge variant="secondary" className="text-xs">Google SSO</Badge>
            </SettingRow>
          ) : (
            <SettingRow label="Contraseña" description="Última vez que cambiaste tu contraseña">
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handlePasswordReset}>
                  Restablecer por correo
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setPwDialog(true)}>
                  Cambiar
                </Button>
              </div>
            </SettingRow>
          )}
        </div>
      </Section>

      {/* ── 2. Preferencias ── */}
      <Section title="Preferencias" icon={Globe}>
        {settingsLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-8 rounded" />)}
          </div>
        ) : (
          <>
            <SettingRow label="Moneda predeterminada" description="Se usará al crear nuevos gastos">
              <Select
                value={settings?.defaultCurrency ?? "USD"}
                onValueChange={(v) => save({ defaultCurrency: v })}
              >
                <SelectTrigger className="w-28 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </SettingRow>

            <SettingRow label="Método de pago predeterminado" description="Prellenado al escanear recibos">
              <Select
                value={settings?.defaultPaymentMethod ?? "__none__"}
                onValueChange={(v) => save({ defaultPaymentMethod: v === "__none__" ? null : v })}
              >
                <SelectTrigger className="w-36 h-8 text-xs">
                  <SelectValue placeholder="Sin especificar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin especificar</SelectItem>
                  {PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </SettingRow>

            <SettingRow label="Categoría predeterminada" description="Cuando el OCR no detecta categoría">
              <Select
                value={settings?.defaultCategory ?? "otros"}
                onValueChange={(v) => save({ defaultCategory: v })}
              >
                <SelectTrigger className="w-36 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
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

            <div className="border-t pt-3">
              <p className="text-xs font-medium mb-3 text-muted-foreground uppercase tracking-wide">Tema</p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { value: "light", label: "Claro", icon: Sun },
                  { value: "dark", label: "Oscuro", icon: Moon },
                  { value: "system", label: "Sistema", icon: Monitor },
                ] as const).map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    onClick={() => setTheme(value)}
                    className={`flex flex-col items-center gap-1.5 py-2.5 rounded-xl border text-xs transition-colors ${theme === value ? "border-foreground bg-accent font-medium" : "border-border text-muted-foreground hover:border-muted-foreground"}`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t pt-3">
              <AccentColorPicker />
            </div>

            <SettingRow
              label="Tema automático (21h–7h oscuro)"
              description="Cambia a oscuro entre las 21:00 y las 7:00 automáticamente"
            >
              <Toggle
                checked={settings?.autoTheme ?? false}
                onChange={(v) => save({ autoTheme: v })}
              />
            </SettingRow>

            <SettingRow label="Vista compacta" description="Reduce el espaciado en la lista de gastos">
              <Toggle
                checked={settings?.compactView ?? false}
                onChange={(v) => save({ compactView: v })}
              />
            </SettingRow>
          </>
        )}
      </Section>

      {/* ── 3. Gastos recurrentes / Notificaciones ── */}
      <Section title="Recordatorios" icon={Bell}>
        <SettingRow
          label="Días de aviso anticipado"
          description="Cuántos días antes de que venza un recurrente te avisamos"
        >
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              max={30}
              value={settings?.reminderDaysBefore ?? 3}
              onChange={(e) => save({ reminderDaysBefore: parseInt(e.target.value) || 0 })}
              className="w-16 h-8 text-xs text-center tabular-nums"
            />
            <span className="text-xs text-muted-foreground">días</span>
          </div>
        </SettingRow>
        <div className="rounded-lg bg-muted/40 border p-3 text-xs text-muted-foreground">
          Tienes <strong className="text-foreground">{recurringData.length}</strong> gasto{recurringData.length !== 1 ? "s" : ""} recurrente{recurringData.length !== 1 ? "s" : ""} activo{recurringData.length !== 1 ? "s" : ""}.
          Los recordatorios se muestran en el banner de la página de gastos y en los recurrentes.
        </div>
      </Section>

      {/* ── 4. Tu cuenta ── */}
      <Section title="Tu cuenta" icon={Shield}>
        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <StatCard label="Miembro desde" value={memberSince.split(" ")[0]} sub={memberSince.split(" ")[1]} />
          <StatCard label="Gastos" value={String(totalExpenses)} />
          <StatCard label="Recurrentes" value={String(recurringData.length)} />
        </div>

        {/* App install */}
        <div className="border-t pt-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Aplicación</p>
          <PwaInstallButton />
        </div>

        {/* Data export */}
        <div className="border-t pt-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Datos</p>
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2 justify-start"
            onClick={async () => {
              // Fetch all expenses for export (no pagination)
              toast.info("Preparando exportación…")
              // We use the current page data as a start — for a full export
              // the user can use the filters on /expenses
              if (expenseData?.expenses) {
                exportToCSV(expenseData.expenses)
                toast.success("Descargado. Para exportar todo, usa la página de Gastos sin filtros.")
              }
            }}
          >
            <Download className="h-4 w-4" />
            Exportar mis gastos (CSV)
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2 justify-start"
            onClick={() => {
              if (expenseData?.expenses?.length) {
                exportHoldedCsv(expenseData.expenses)
                toast.success("Exportado para Holded")
              } else {
                toast.info("Sin gastos para exportar")
              }
            }}
          >
            <Download className="h-4 w-4" />
            Exportar para Holded
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2 justify-start"
            onClick={() => {
              if (expenseData?.expenses?.length) {
                exportContasimpleCsv(expenseData.expenses)
                toast.success("Exportado para Contasimple")
              } else {
                toast.info("Sin gastos para exportar")
              }
            }}
          >
            <Download className="h-4 w-4" />
            Exportar para Contasimple
          </Button>
        </div>

        {/* Sign out */}
        <div className="border-t pt-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sesión</p>
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2 justify-start"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </Button>
        </div>

        {/* Danger zone */}
        <div className="border-t pt-3 space-y-2">
          <p className="text-xs font-medium text-destructive uppercase tracking-wide flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" />
            Zona de peligro
          </p>
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2 justify-start text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5"
            onClick={() => setDeleteDialog(true)}
          >
            <Trash2 className="h-4 w-4" />
            Eliminar mi cuenta permanentemente
          </Button>
        </div>
      </Section>

      {/* ── Change password dialog ── */}
      <Dialog open={pwDialog} onOpenChange={(o) => { if (!o) { setPwDialog(false); setCurrentPw(""); setNewPw(""); setConfirmPw("") } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Cambiar contraseña</DialogTitle>
          </DialogHeader>
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
            {newPw && confirmPw && newPw !== confirmPw && (
              <p className="text-xs text-destructive">Las contraseñas no coinciden</p>
            )}
            <Button className="w-full" onClick={handleChangePassword} disabled={pwLoading || !currentPw || !newPw || newPw !== confirmPw}>
              {pwLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Cambiar contraseña
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
              <p>Se eliminarán tu cuenta y todos tus datos de autenticación. Los datos en Firestore (gastos, grupos, etc.) se mantienen hasta que los elimines manualmente desde la consola de Firebase.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Escribe <strong>ELIMINAR</strong> para confirmar</Label>
              <Input
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder="ELIMINAR"
                className="font-mono"
              />
            </div>
            <Button
              variant="destructive"
              className="w-full"
              disabled={deleteConfirm !== "ELIMINAR" || deleteLoading}
              onClick={handleDeleteAccount}
            >
              {deleteLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Eliminar mi cuenta
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
