import type { NextConfig } from "next";
import withPWA from "@ducanh2912/next-pwa";

const nextConfig: NextConfig = {
  turbopack: {},
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Permite que los popups de OAuth (Google) se comuniquen con la app.
          // "same-origin" (default de Next.js) bloquea window.opener del popup
          // lo que impide que Firebase signInWithPopup complete el flujo de auth.
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
          // S6 — Security headers
          // Evita que el browser envíe el referrer completo a sitios externos
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Impide que la app se incruste en iframes de otros dominios (clickjacking)
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          // Deshabilita MIME type sniffing (protege contra XSS por archivos mal tipados)
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Deshabilita la API XSS Auditor obsoleta y potencialmente explotable
          { key: "X-XSS-Protection", value: "0" },
          // HSTS: fuerza HTTPS durante 1 año (incluye subdominios)
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          // Permissions Policy: deshabilita APIs que la app no usa
          {
            key: "Permissions-Policy",
            value: [
              "camera=(self)",          // Scanner de recibos usa la cámara
              "geolocation=(self)",     // Mapa usa geolocalización
              "microphone=()",          // No usa micrófono
              "payment=()",             // No usa Payment Request API
              "usb=()",                 // No usa USB
              "serial=()",              // No usa Serial
              "bluetooth=()",           // No usa Bluetooth
            ].join(", "),
          },
        ],
      },
      // Headers adicionales solo para rutas de API
      {
        source: "/api/(.*)",
        headers: [
          // Evita que Vercel o proxies cacheen respuestas de API privadas
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
        ],
      },
    ]
  },
};

const withPWAConfig = withPWA({
  dest: "public",
  register: true,
  // Service Worker desactivado en dev para no interferir con hot reload
  disable: process.env.NODE_ENV === "development",
  // Elimina el SW anterior automáticamente cuando hay una nueva versión
  reloadOnOnline: true,
  // Caché agresivo para assets estáticos (JS, CSS, imágenes)
  workboxOptions: {
    // Cuando hay nueva versión, se activa inmediatamente sin esperar
    skipWaiting: true,
    clientsClaim: true,
    // Estrategia de caché por tipo de recurso
    runtimeCaching: [
      {
        // Páginas HTML: Network first (siempre intenta la versión más nueva)
        urlPattern: /^https:\/\/recibotrack\.vercel\.app\/.*/,
        handler: "NetworkFirst",
        options: {
          cacheName: "pages-cache",
          networkTimeoutSeconds: 10,
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 24 * 60 * 60, // 1 día
          },
        },
      },
      {
        // API de OCR: Network only (nunca cachear — siempre necesita internet)
        urlPattern: /\/api\/ocr/,
        handler: "NetworkOnly",
      },
      {
        // Firebase/Firestore: Network first con fallback
        urlPattern: /firestore\.googleapis\.com/,
        handler: "NetworkFirst",
        options: {
          cacheName: "firestore-cache",
          networkTimeoutSeconds: 8,
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 5 * 60, // 5 minutos
          },
        },
      },
      {
        // Fonts y assets externos: Cache first (raramente cambian)
        urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com/,
        handler: "CacheFirst",
        options: {
          cacheName: "fonts-cache",
          expiration: {
            maxEntries: 20,
            maxAgeSeconds: 365 * 24 * 60 * 60, // 1 año
          },
        },
      },
    ],
  },
});

export default withPWAConfig(nextConfig);