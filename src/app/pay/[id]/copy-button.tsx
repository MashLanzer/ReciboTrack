"use client"

import { useState } from "react"

export default function CopyButton({ reference }: { reference: string }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(reference).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <button
      onClick={handleCopy}
      className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/30 text-white font-semibold py-3.5 text-sm hover:bg-white/10 transition-colors"
    >
      {copied ? "✓ Referencia copiada" : "📋 Copiar referencia"}
    </button>
  )
}
