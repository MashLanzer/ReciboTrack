"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { apiFetch } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Users, Loader2, CheckCircle2, XCircle } from "lucide-react"
import { toast } from "sonner"

type PageStatus = "loading" | "preview" | "joining" | "success" | "error"

export default function JoinWorkspacePage() {
  const params = useParams()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const token = typeof params.token === "string" ? params.token : ""

  const [status, setStatus] = useState<PageStatus>("loading")
  const [workspaceName, setWorkspaceName] = useState("")
  const [errorMsg, setErrorMsg] = useState("")

  // Previsualizar el espacio (sin autenticación)
  useEffect(() => {
    if (!token) return
    fetch(`/api/workspaces/join/${token}`)
      .then((r) => r.json())
      .then((data: { valid?: boolean; workspaceName?: string; error?: string }) => {
        if (data.valid && data.workspaceName) {
          setWorkspaceName(data.workspaceName)
          setStatus("preview")
        } else {
          setErrorMsg(data.error ?? "Invitación inválida")
          setStatus("error")
        }
      })
      .catch(() => {
        setErrorMsg("No se pudo cargar la invitación")
        setStatus("error")
      })
  }, [token])

  async function handleJoin() {
    if (!user) {
      // Redirigir al login con returnUrl
      const returnUrl = encodeURIComponent(`/join/workspace/${token}`)
      router.replace(`/login?returnUrl=${returnUrl}`)
      return
    }

    setStatus("joining")
    try {
      const res = await apiFetch(`/api/workspaces/join/${token}`, { method: "POST" })
      const data = await res.json() as { success?: boolean; workspaceName?: string; error?: string }

      if (!res.ok) {
        throw new Error(data.error ?? "Error al unirse al espacio")
      }

      if (data.workspaceName) setWorkspaceName(data.workspaceName)
      setStatus("success")
      toast.success(`Te uniste a "${workspaceName || data.workspaceName}"`)
    } catch (err) {
      setErrorMsg((err as Error).message ?? "Error al unirse")
      setStatus("error")
    }
  }

  if (status === "loading" || authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 gap-4 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Cargando invitación…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 gap-6 text-center">
      <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
        <Users className="h-8 w-8 text-muted-foreground" />
      </div>

      {status === "preview" && (
        <>
          <div>
            <p className="text-lg font-semibold">Invitación a espacio compartido</p>
            <p className="text-sm text-muted-foreground mt-1">
              Te han invitado a unirte a{" "}
              <span className="font-medium text-foreground">{workspaceName}</span>
            </p>
          </div>

          {!user && (
            <p className="text-xs text-muted-foreground max-w-xs">
              Necesitas iniciar sesión para unirte al espacio compartido.
            </p>
          )}

          <Button onClick={handleJoin} className="w-full max-w-xs">
            {user ? "Unirte al espacio compartido" : "Iniciar sesión para unirte"}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.replace("/dashboard")}
            className="text-muted-foreground"
          >
            Cancelar
          </Button>
        </>
      )}

      {status === "joining" && (
        <>
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Uniéndome al espacio…</p>
        </>
      )}

      {status === "success" && (
        <>
          <CheckCircle2 className="h-10 w-10 text-green-600" />
          <div>
            <p className="font-semibold text-lg">¡Bienvenido al espacio!</p>
            <p className="text-sm text-muted-foreground mt-1">
              Ahora eres miembro de{" "}
              <span className="font-medium text-foreground">{workspaceName}</span>
            </p>
          </div>
          <Button onClick={() => router.replace("/workspaces")} className="w-full max-w-xs">
            Ver espacios compartidos
          </Button>
        </>
      )}

      {status === "error" && (
        <>
          <XCircle className="h-10 w-10 text-destructive" />
          <div>
            <p className="font-semibold text-lg">No se pudo unir</p>
            <p className="text-sm text-muted-foreground mt-1">{errorMsg}</p>
          </div>
          <div className="flex gap-3 w-full max-w-xs">
            <Button variant="outline" onClick={() => router.replace("/workspaces")} className="flex-1">
              Ver espacios
            </Button>
            <Button onClick={() => router.replace("/dashboard")} className="flex-1">
              Ir al inicio
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
