/**
 * Generador de icono para ReciboTrack
 * Crea un icono 1024x1024 con SVG embed y lo escala a todos los tamaños Android
 */
import sharp from "sharp"
import { writeFileSync, mkdirSync } from "fs"
import { join } from "path"

// ─── Diseño del icono ─────────────────────────────────────────────────────────
// Fondo: gradiente morado-índigo  |  Recibo blanco con gráfico de barras verde

const SIZE = 1024

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <defs>
    <!-- Fondo degradado morado → índigo -->
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="#4f46e5"/>
      <stop offset="100%" stop-color="#7c3aed"/>
    </linearGradient>
    <!-- Sombra suave del recibo -->
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="130%">
      <feDropShadow dx="0" dy="12" stdDeviation="20" flood-color="#00000040"/>
    </filter>
    <!-- Gradiente verde para las barras del gráfico -->
    <linearGradient id="bar" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%"   stop-color="#34d399"/>
      <stop offset="100%" stop-color="#059669"/>
    </linearGradient>
    <!-- Gradiente azul para las barras pequeñas -->
    <linearGradient id="bar2" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%"   stop-color="#60a5fa"/>
      <stop offset="100%" stop-color="#2563eb"/>
    </linearGradient>
  </defs>

  <!-- Fondo redondeado -->
  <rect width="${SIZE}" height="${SIZE}" rx="230" ry="230" fill="url(#bg)"/>

  <!-- Círculo de brillo sutil arriba-derecha -->
  <circle cx="780" cy="200" r="300" fill="white" opacity="0.05"/>

  <!-- Papel del recibo (cuerpo principal) -->
  <g filter="url(#shadow)">
    <rect x="240" y="200" width="544" height="660" rx="28" ry="28" fill="white"/>
    <!-- Borde zigzag inferior (simulando recibo) -->
    <!-- Usamos un polígono para el borde dentado -->
    <polygon
      points="240,840 268,860 296,840 324,860 352,840 380,860 408,840 436,860 464,840 492,860 520,840 548,860 576,840 604,860 632,840 660,860 688,840 716,860 744,840 772,860 784,840 784,860 240,860"
      fill="white"/>
  </g>

  <!-- Líneas de texto del recibo (decorativas) -->
  <rect x="296" y="270" width="200" height="16" rx="8" fill="#e0e7ff"/>
  <rect x="296" y="302" width="140" height="12" rx="6" fill="#f1f5f9"/>
  <rect x="296" y="326" width="170" height="12" rx="6" fill="#f1f5f9"/>

  <!-- Separador -->
  <rect x="296" y="360" width="432" height="2" rx="1" fill="#e2e8f0"/>

  <!-- ── Gráfico de barras (área principal del icono) ── -->
  <!-- Barra 1 – más alta, verde -->
  <rect x="320" y="480" width="72" height="240" rx="12" fill="url(#bar)"/>
  <!-- Barra 2 – mediana, azul -->
  <rect x="424" y="540" width="72" height="180" rx="12" fill="url(#bar2)"/>
  <!-- Barra 3 – pequeña, verde claro -->
  <rect x="528" y="580" width="72" height="140" rx="12" fill="url(#bar)" opacity="0.7"/>
  <!-- Barra 4 – grande, azul claro -->
  <rect x="632" y="510" width="72" height="210" rx="12" fill="url(#bar2)" opacity="0.85"/>

  <!-- Línea de tendencia sobre las barras -->
  <polyline
    points="356,465 460,520 564,560 668,495"
    fill="none"
    stroke="#fbbf24"
    stroke-width="9"
    stroke-linecap="round"
    stroke-linejoin="round"/>
  <!-- Puntos en la línea de tendencia -->
  <circle cx="356" cy="465" r="10" fill="#fbbf24"/>
  <circle cx="460" cy="520" r="10" fill="#fbbf24"/>
  <circle cx="564" cy="560" r="10" fill="#fbbf24"/>
  <circle cx="668" cy="495" r="10" fill="#fbbf24"/>

  <!-- Etiqueta "RR" arriba del recibo (logo simple) -->
  <rect x="636" y="252" width="112" height="52" rx="14" fill="url(#bg)" opacity="0.92"/>
  <text x="692" y="288" font-family="Georgia, serif" font-size="28" font-weight="bold" fill="white" text-anchor="middle">RT</text>
</svg>
`

// ─── Generar icono base 1024×1024 ─────────────────────────────────────────────

const BASE = join(import.meta.dirname ?? process.cwd(), "assets-icon")
mkdirSync(BASE, { recursive: true })

const baseBuffer = await sharp(Buffer.from(svg))
  .resize(SIZE, SIZE)
  .png()
  .toBuffer()

writeFileSync(join(BASE, "icon-1024.png"), baseBuffer)
console.log("✅ Icono base 1024×1024 creado")

// ─── Tamaños Android ──────────────────────────────────────────────────────────

const ANDROID_RES = join(
  import.meta.dirname ?? process.cwd(),
  "android/app/src/main/res"
)

const SIZES = [
  { folder: "mipmap-mdpi",    size: 48  },
  { folder: "mipmap-hdpi",    size: 72  },
  { folder: "mipmap-xhdpi",   size: 96  },
  { folder: "mipmap-xxhdpi",  size: 144 },
  { folder: "mipmap-xxxhdpi", size: 192 },
]

for (const { folder, size } of SIZES) {
  const dir = join(ANDROID_RES, folder)
  const buf = await sharp(baseBuffer).resize(size, size).png().toBuffer()
  writeFileSync(join(dir, "ic_launcher.png"),       buf)
  writeFileSync(join(dir, "ic_launcher_round.png"), buf)
  console.log(`✅ ${folder} → ${size}×${size}`)
}

// Icono foreground para adaptive icons (API 26+)
for (const { folder, size } of SIZES) {
  const dir = join(ANDROID_RES, folder)
  // Para adaptive, el foreground debe tener padding (~72% del área útil)
  const innerSize = Math.round(size * 0.72)
  const pad = Math.round((size - innerSize) / 2)
  const fg = await sharp(baseBuffer)
    .resize(innerSize, innerSize)
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
  writeFileSync(join(dir, "ic_launcher_foreground.png"), fg)
}

// Splash / Play Store icon (512)
const playBuf = await sharp(baseBuffer).resize(512, 512).png().toBuffer()
writeFileSync(join(BASE, "playstore-icon-512.png"), playBuf)
console.log("✅ Icono Play Store 512×512 guardado en assets-icon/")

console.log("\n🎉 ¡Todos los iconos generados correctamente!")
