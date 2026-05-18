"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ImportStatementDialog } from "./import-statement-dialog"
import { Upload } from "lucide-react"

export function ImportStatementButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        className="h-9 w-9 shrink-0"
        onClick={() => setOpen(true)}
        title="Importar CSV"
        aria-label="Importar CSV"
      >
        <Upload className="h-4 w-4" />
      </Button>
      <ImportStatementDialog open={open} onClose={() => setOpen(false)} />
    </>
  )
}
