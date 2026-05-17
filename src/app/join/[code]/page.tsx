"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { useJoinGroup } from "@/hooks/use-groups"
import { Button } from "@/components/ui/button"
import { UsersRound, Loader2, CheckCircle2, XCircle } from "lucide-react"

export default function JoinGroupPage() {
  const params = useParams()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const joinGroup = useJoinGroup()
  const code = typeof params.code === "string" ? params.code.toUpperCase() : ""

  const [status, setStatus] = useState<"idle" | "joining" | "success" | "error">("idle")
  const [groupName, setGroupName] = useState("")
  const [errorMsg, setErrorMsg] = useState("")

  useEffect(() => {
    if (authLoading || !code) return
    if (!user) {
      // Not logged in — redirect to login, then come back
      const returnUrl = encodeURIComponent(`/join/${code}`)
      router.replace(`/login?returnUrl=${returnUrl}`)
      return
    }
    // Auto-join on mount
    if (status === "idle") {
      setStatus("joining")
      joinGroup.mutateAsync(code)
        .then(({ groupName: name }) => {
          setGroupName(name)
          setStatus("success")
        })
        .catch((err: Error) => {
          setErrorMsg(err.message ?? "Error al unirse al grupo")
          setStatus("error")
        })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, code])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 gap-6 text-center">
      <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
        <UsersRound className="h-8 w-8 text-muted-foreground" />
      </div>

      {(status === "idle" || status === "joining") && (
        <>
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Uniéndome al grupo…</p>
        </>
      )}

      {status === "success" && (
        <>
          <CheckCircle2 className="h-10 w-10 text-green-600" />
          <div>
            <p className="font-semibold text-lg">¡Ya eres miembro!</p>
            <p className="text-sm text-muted-foreground mt-1">Te uniste a <span className="font-medium">{groupName}</span></p>
          </div>
          <Button onClick={() => router.replace("/groups")} className="w-full max-w-xs">
            Ir al grupo
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
            <Button variant="outline" onClick={() => router.replace("/groups")} className="flex-1">
              Ver grupos
            </Button>
            <Button onClick={() => { setStatus("idle") }} className="flex-1">
              Reintentar
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
