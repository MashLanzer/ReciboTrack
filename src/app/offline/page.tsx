"use client"

export default function OfflinePage() {
  return (
    <html lang="es">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#0a0a0a", color: "#fafafa" }}>
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", minHeight: "100dvh", gap: "16px",
          padding: "24px", textAlign: "center",
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: "#1a1a1a", display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: 32,
          }}>
            🧾
          </div>
          <div>
            <p style={{ fontSize: 24, fontWeight: 600, margin: "0 0 8px" }}>Sin conexión</p>
            <p style={{ fontSize: 14, color: "#999", margin: 0, maxWidth: 280 }}>
              ReciboTrack necesita internet para sincronizar tus gastos y escanear recibos con IA.
              Conéctate y vuelve a intentarlo.
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 8, padding: "12px 28px", borderRadius: 10,
              background: "#fafafa", color: "#0a0a0a", border: "none",
              fontSize: 14, fontWeight: 600, cursor: "pointer",
            }}
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  )
}
