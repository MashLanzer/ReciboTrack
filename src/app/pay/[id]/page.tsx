import CopyButton from "./copy-button"
import { verifyPayToken } from "@/lib/pay-token"
import { ShieldAlert } from "lucide-react"

const CURRENCY_TO_PAYPAL_CODE: Record<string, string> = {
  USD: "USD",
  EUR: "EUR",
  GBP: "GBP",
  MXN: "MXN",
  CAD: "CAD",
}

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
  const currency = data.currency || "USD"
  const note = data.concept || "Deuda"

  const formatted = new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency,
  }).format(data.amount)

  // PayPal.me supports an optional currency code suffix; falls back gracefully if omitted.
  const paypalCurrency = CURRENCY_TO_PAYPAL_CODE[currency.toUpperCase()] ?? ""
  const paypalUrl = data.paypal
    ? `https://paypal.me/${encodeURIComponent(data.paypal)}/${data.amount}${paypalCurrency}`
    : null

  const venmoUrl = data.venmo
    ? `https://venmo.com/${encodeURIComponent(data.venmo)}?txn=pay&amount=${data.amount}&note=${encodeURIComponent(note)}`
    : null

  const cashappCashtag = data.cashapp?.replace(/^\$/, "") ?? null
  const cashappUrl = cashappCashtag
    ? `https://cash.app/$${encodeURIComponent(cashappCashtag)}/${data.amount}`
    : null

  const methods: { label: string; emoji: string; url: string; bg: string; text: string }[] = []
  if (paypalUrl)  methods.push({ label: "Pagar con PayPal",  emoji: "💳", url: paypalUrl,  bg: "bg-[#0070ba]",  text: "text-white" })
  if (venmoUrl)   methods.push({ label: "Pagar con Venmo",   emoji: "💸", url: venmoUrl,   bg: "bg-[#3D95CE]",  text: "text-white" })
  if (cashappUrl) methods.push({ label: "Pagar con Cash App", emoji: "💵", url: cashappUrl, bg: "bg-[#00d54b]", text: "text-black" })

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-violet-950 via-indigo-900 to-purple-900 p-4">
      {legacy && (
        <div className="w-full max-w-sm mb-3 flex items-center gap-2 rounded-xl bg-warning/20 border border-warning/30 px-3 py-2">
          <ShieldAlert className="h-4 w-4 text-warning shrink-0" />
          <p className="text-xs text-warning/80">Este enlace es antiguo y no está verificado criptográficamente.</p>
        </div>
      )}

      <div className="w-full max-w-sm bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl overflow-hidden shadow-2xl">
        <div className="px-6 pt-8 pb-6 text-center">
          <div className="inline-flex items-center gap-2 mb-6">
            <div className="h-8 w-8 rounded-xl bg-white/20 flex items-center justify-center">
              <span className="text-white font-bold text-sm">RT</span>
            </div>
            <span className="text-white font-semibold text-sm">ReciboTrack</span>
          </div>

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

          <div className="mb-4">
            <p className="text-6xl font-bold text-white tabular-nums">{formatted}</p>
          </div>

          {data.concept && (
            <p className="text-white/70 text-sm px-4">{data.concept}</p>
          )}
        </div>

        <div className="px-6 pb-8 space-y-3">
          {methods.length > 0 ? (
            <>
              {methods.map((m) => (
                <a
                  key={m.label}
                  href={m.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex w-full items-center justify-center gap-2 rounded-2xl ${m.bg} ${m.text} font-semibold py-3.5 text-sm hover:opacity-90 transition-opacity`}
                >
                  <span className="text-lg">{m.emoji}</span>
                  {m.label}
                </a>
              ))}
            </>
          ) : (
            <div className="rounded-2xl border border-white/20 bg-white/5 p-3 space-y-1">
              <p className="text-white text-xs font-semibold">No hay métodos de pago configurados</p>
              <p className="text-white/70 text-xs">
                Pide a {data.from} que añada PayPal, Venmo o Cash App en su perfil. Mientras tanto, copia la referencia y envíale el dinero por tu medio preferido.
              </p>
            </div>
          )}

          <CopyButton reference={`${data.from} → ${data.to}: ${formatted} — ${note}`} />
        </div>
      </div>

      <p className="mt-6 text-white/40 text-xs text-center">
        Enviado desde{" "}
        <span className="text-white/60 font-medium">ReciboTrack</span>
      </p>
    </div>
  )
}
