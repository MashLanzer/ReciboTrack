// Service Worker custom handler — push notifications
// Este archivo se compila e inyecta dentro del SW generado por @ducanh2912/next-pwa.
// NO importar código de la app aquí: el SW corre en su propio contexto global.
//
// Tipos: el tsconfig usa lib "dom" (no "webworker"), así que los tipos del SW
// no están disponibles de forma nativa. Usamos `any` para los event listeners
// del SW y un tipo local para las APIs de ServiceWorkerGlobalScope.

/* eslint-disable @typescript-eslint/no-explicit-any */

// Tipo mínimo para las APIs del SW que usamos
interface SWGlobalScope extends EventTarget {
  registration: { showNotification(title: string, options?: object): Promise<void> }
  clients: {
    matchAll(options?: object): Promise<{ url: string; focus(): Promise<void>; navigate(url: string): Promise<void> }[]>
    openWindow(url: string): Promise<void>
  }
  location: { origin: string }
  addEventListener(type: string, listener: (event: any) => void): void
}

const sw = self as unknown as SWGlobalScope

// ── Push event — recibe notificaciones del servidor cuando la app está cerrada ─

sw.addEventListener("push", (event: any) => {
  if (!event.data) return

  let payload: { title: string; body: string; url?: string; tag?: string }
  try {
    payload = event.data.json() as typeof payload
  } catch {
    payload = { title: "ReciboTrack", body: event.data.text() }
  }

  const title = payload.title ?? "ReciboTrack"
  const options = {
    body: payload.body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: payload.tag ?? "rbt-default",
    renotify: true,
    data: { url: payload.url ?? "/dashboard" },
  }

  event.waitUntil(sw.registration.showNotification(title, options))
})

// ── Notification click — abre la URL asociada al hacer clic ──────────────────

sw.addEventListener("notificationclick", (event: any) => {
  event.notification.close()
  const url = (event.notification.data as { url?: string })?.url ?? "/dashboard"

  event.waitUntil(
    sw.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        // Si ya hay una ventana abierta, enfocarla y navegar
        for (const client of windowClients) {
          if (client.url.includes(sw.location.origin) && "focus" in client) {
            void client.focus()
            void client.navigate(url)
            return
          }
        }
        // Si no hay ventana abierta, abrir una nueva
        if (sw.clients.openWindow) {
          return sw.clients.openWindow(url)
        }
      })
  )
})
