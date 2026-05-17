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
        size="sm"
        className="gap-1.5"
        onClick={() => setOpen(true)}
      >
        <Upload className="h-4 w-4" />
        Importar CSV
      </Button>
      <ImportStatementDialog open={open} onClose={() => setOpen(false)} />
    </>
  )
}
