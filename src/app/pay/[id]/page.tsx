import CopyButton from "./copy-button"
import { verifyPayToken } from "@/lib/pay-token"
import { ShieldAlert } from "lucide-react"

export default async function PayPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const result = await verifyPayToken(id)

  if (!result.ok) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-950 to-indigo-900 p-4">
        <div className="text-center text-white space-y-3">
          <p className="text-5xl">🔗</p>
          <h1 className="text-xl font-bold">Enlace inválido</h1>
          <p className="text-sm text-white/70">Este enlace de pago no es válido o ha expirado.</p>
        </div>
      </div>
    )
  }

  const { data, legacy } = result

  const formatted = new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: data.currency || "EUR",
  }).format(data.amount)

  const bizumUrl = `bizum://send?amount=${data.amount}&concept=${encodeURIComponent(data.concept || "Deuda")}`

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-violet-950 via-indigo-900 to-purple-900 p-4">
      {/* Legacy warning banner */}
      {legacy && (
        <div className="w-full max-w-sm mb-3 flex items-center gap-2 rounded-xl bg-warning/20 border border-warning/30 px-3 py-2">
          <ShieldAlert className="h-4 w-4 text-warning shrink-0" />
          <p className="text-xs text-warning/80">Este enlace es antiguo y no está verificado criptográficamente.</p>
        </div>
      )}

      {/* Card */}
      <div className="w-full max-w-sm bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 pt-8 pb-6 text-center">
          <div className="inline-flex items-center gap-2 mb-6">
            <div className="h-8 w-8 rounded-xl bg-white/20 flex items-center justify-center">
              <span className="text-white font-bold text-sm">RT</span>
            </div>
            <span className="text-white font-semibold text-sm">ReciboTrack</span>
          </div>

          {/* From / To */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="text-center">
              <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-1">
                <span className="text-white font-bold text-lg">{data.from.charAt(0).toUpperCase()}</span>
              </div>
              <p className="text-white/70 text-xs">Solicita</p>
              <p className="text-white font-semibold text-sm truncate max-w-[80px]">{data.from}</p>
            </div>

            <div className="text-white/50 text-2xl">→</div>

            <div className="text-center">
              <div className="h-12 w-12 rounded-full bg-violet-500/40 flex items-center justify-center mx-auto mb-1">
                <span className="text-white font-bold text-lg">{data.to.charAt(0).toUpperCase()}</span>
              </div>
              <p className="text-white/70 text-xs">Debe pagar</p>
              <p className="text-white font-semibold text-sm truncate max-w-[80px]">{data.to}</p>
            </div>
          </div>

          {/* Amount */}
          <div className="mb-4">
            <p className="text-6xl font-bold text-white tabular-nums">{formatted}</p>
          </div>

          {/* Concept */}
          {data.concept && (
            <p className="text-white/70 text-sm px-4">{data.concept}</p>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 pb-8 space-y-3">
          <a
            href={bizumUrl}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white text-violet-900 font-semibold py-3.5 text-sm hover:bg-white/90 transition-colors"
          >
            <span className="text-lg">💸</span>
            Pagar con Bizum
          </a>

          <CopyButton reference={`${data.from} → ${data.to}: ${formatted}`} />
        </div>
      </div>

      {/* Footer */}
      <p className="mt-6 text-white/40 text-xs text-center">
        Enviado desde{" "}
        <span className="text-white/60 font-medium">ReciboTrack</span>
      </p>
    </div>
  )
}
