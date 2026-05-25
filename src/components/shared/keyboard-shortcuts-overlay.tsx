"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface KeyboardShortcutsOverlayProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const shortcuts = [
  { key: "N", description: "Añadir gasto rápido" },
  { key: "S", description: "Abrir buscador" },
  { key: "B", description: "Ir a Presupuestos" },
  { key: "R", description: "Ir a Recurrentes" },
  { key: "?", description: "Mostrar atajos de teclado" },
]

export function KeyboardShortcutsOverlay({ open, onOpenChange }: KeyboardShortcutsOverlayProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Atajos de teclado</DialogTitle>
        </DialogHeader>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-border/40">
            {shortcuts.map(({ key, description }) => (
              <tr key={key} className="py-2">
                <td className="py-2.5 pr-4">
                  <kbd className="inline-flex items-center justify-center rounded-md border border-border bg-muted px-2.5 py-1 text-xs font-bold font-mono shadow-sm">
                    {key}
                  </kbd>
                </td>
                <td className="py-2.5 text-muted-foreground">{description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </DialogContent>
    </Dialog>
  )
}
