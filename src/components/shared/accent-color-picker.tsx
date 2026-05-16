"use client"

import { useUserSettings, useUpdateUserSettings } from "@/hooks/use-user-settings"
import { cn } from "@/lib/utils"
import { Check } from "lucide-react"
import { toast } from "sonner"

const ACCENT_COLORS = [
  { label: "Índigo",   hue: "262", hex: "#6366f1" },
  { label: "Violeta",  hue: "271", hex: "#8b5cf6" },
  { label: "Rosa",     hue: "330", hex: "#ec4899" },
  { label: "Rojo",     hue: "0",   hex: "#ef4444" },
  { label: "Naranja",  hue: "25",  hex: "#f97316" },
  { label: "Ámbar",    hue: "43",  hex: "#f59e0b" },
  { label: "Verde",    hue: "142", hex: "#22c55e" },
  { label: "Esmeralda",hue: "160", hex: "#10b981" },
  { label: "Cian",     hue: "187", hex: "#06b6d4" },
  { label: "Azul",     hue: "217", hex: "#3b82f6" },
  { label: "Gris",     hue: "220", hex: "#6b7280" },
]

export function AccentColorPicker() {
  const { data: settings } = useUserSettings()
  const update = useUpdateUserSettings()
  const current = settings?.accentColor ?? "262"

  async function pick(hue: string) {
    if (hue === current) return
    await update.mutateAsync({ accentColor: hue })
    toast.success("Color de acento actualizado")
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Color de acento
      </p>
      <div className="flex flex-wrap gap-2.5">
        {ACCENT_COLORS.map(({ label, hue, hex }) => (
          <button
            key={hue}
            title={label}
            onClick={() => pick(hue)}
            className={cn(
              "h-8 w-8 rounded-full transition-all ring-offset-2 ring-offset-background",
              current === hue ? "ring-2 ring-foreground scale-110" : "hover:scale-105"
            )}
            style={{ backgroundColor: hex }}
          >
            {current === hue && (
              <Check className="h-4 w-4 text-white mx-auto" strokeWidth={3} />
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
