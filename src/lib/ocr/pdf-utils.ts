"use client"

const MAX_PAGES = 5      // Máximo de páginas a procesar
const RENDER_SCALE = 2.0 // Escala de renderizado (más alto = más nítido, pero más lento)
const PAGE_GAP = 20      // Píxeles de separación entre páginas

/**
 * Convierte todas las páginas de un PDF en una sola imagen PNG vertical.
 * Gemini ve el documento completo, no solo la primera página.
 */
export async function pdfToStitchedImage(file: File): Promise<Blob> {
  const pdfjsLib = await import("pdfjs-dist")

  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.mjs",
    import.meta.url
  ).toString()

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const totalPages = Math.min(pdf.numPages, MAX_PAGES)

  // 1. Renderizar cada página en su propio canvas
  const canvases: HTMLCanvasElement[] = []

  for (let i = 1; i <= totalPages; i++) {
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale: RENDER_SCALE })

    const canvas = document.createElement("canvas")
    canvas.width = viewport.width
    canvas.height = viewport.height

    const ctx = canvas.getContext("2d")
    if (!ctx) continue

    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await page.render({ canvas, canvasContext: ctx as any, viewport }).promise

    canvases.push(canvas)
  }

  if (canvases.length === 0) throw new Error("No se pudo renderizar el PDF")

  // 2. Si es una sola página, devolver directamente
  if (canvases.length === 1) {
    return canvasToBlob(canvases[0])
  }

  // 3. Unir páginas verticalmente en un solo canvas
  const maxWidth = Math.max(...canvases.map((c) => c.width))
  const totalHeight =
    canvases.reduce((sum, c) => sum + c.height, 0) +
    PAGE_GAP * (canvases.length - 1)

  const stitched = document.createElement("canvas")
  stitched.width = maxWidth
  stitched.height = totalHeight

  const ctx = stitched.getContext("2d")
  if (!ctx) throw new Error("No se pudo crear canvas combinado")

  ctx.fillStyle = "#f0f0f0" // gris claro entre páginas
  ctx.fillRect(0, 0, maxWidth, totalHeight)

  let y = 0
  for (const canvas of canvases) {
    // Centrar horizontalmente si las páginas tienen ancho distinto
    const x = Math.floor((maxWidth - canvas.width) / 2)
    ctx.drawImage(canvas, x, y)
    y += canvas.height + PAGE_GAP
  }

  return canvasToBlob(stitched)
}

/**
 * Convierte solo la primera página — para preview rápido.
 */
export async function pdfFirstPageToBlob(file: File): Promise<Blob> {
  const pdfjsLib = await import("pdfjs-dist")

  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.mjs",
    import.meta.url
  ).toString()

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const page = await pdf.getPage(1)
  const viewport = page.getViewport({ scale: RENDER_SCALE })

  const canvas = document.createElement("canvas")
  canvas.width = viewport.width
  canvas.height = viewport.height

  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("No se pudo crear contexto de canvas")

  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await page.render({ canvas, canvasContext: ctx as any, viewport }).promise

  return canvasToBlob(canvas)
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas vacío"))),
      "image/jpeg",
      0.92 // JPEG con calidad alta — más pequeño que PNG pero suficiente para texto
    )
  )
}
