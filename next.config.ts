import type { NextConfig } from "next";
import withPWA from "@ducanh2912/next-pwa";

const nextConfig: NextConfig = {
  trailingSlash: true,
  turbopack: {},
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