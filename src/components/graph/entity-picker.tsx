"use client"

import { useState, useRef, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Plus, X, Search } from "lucide-react"
import { useEntities, useCreateEntity, TYPE_EMOJI, TYPE_LABEL, type Entity, type EntityType } from "@/hooks/use-entities"
import { toast } from "sonner"

interface Props {
  /** Types to show and allow creating */
  types?: EntityType[]
  /** Currently selected entity IDs */
  selected: string[]
  onChange: (ids: string[]) => void
  placeholder?: string
  maxItems?: number
}

const DEFAULT_TYPES: EntityType[] = ["person", "project", "intent"]

export function EntityPicker({
  types = DEFAULT_TYPES,
  selected,
  onChange,
  placeholder = "Buscar o añadir…",
  maxItems = 5,
}: Props) {
  const { data: entities = [] } = useEntities()
  const createEntity = useCreateEntity()

  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const filtered = entities.filter((e) => {
    if (!types.includes(e.type)) return false
    if (!query) return true
    return e.name.toLowerCase().includes(query.toLowerCase())
  })

  const selectedEntities = entities.filter((e) => selected.includes(e.id))

  function toggle(entity: Entity) {
    if (selected.includes(entity.id)) {
      onChange(selected.filter((id) => id !== entity.id))
    } else if (selected.length < maxItems) {
      onChange([...selected, entity.id])
      setQuery("")
    }
  }

  async function createNew(type: EntityType) {
    if (!query.trim()) return
    try {
      const entity = await createEntity.mutateAsync({ type, name: query.trim() })
      onChange([...selected, entity.id])
      setQuery("")
      toast.success(`${TYPE_EMOJI[type]} "${entity.name}" creado`)
    } catch {
      toast.error("Error al crear")
    }
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Selected chips */}
      {selectedEntities.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {selectedEntities.map((e) => (
            <span key={e.id} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium border"
              style={{ backgroundColor: `${e.color}15`, borderColor: `${e.color}40`, color: e.color }}>
              {e.emoji} {e.name}
              <button type="button" onClick={() => onChange(selected.filter((id) => id !== e.id))}
                className="hover:text-destructive ml-0.5">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search input */}
      {selected.length < maxItems && (
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="pl-7 h-8 text-sm"
            placeholder={placeholder}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
          />
        </div>
      )}

      {/* Dropdown */}
      {open && (query || filtered.length > 0) && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-xl border bg-popover shadow-lg overflow-hidden max-h-56 overflow-y-auto">
          {filtered.slice(0, 8).map((entity) => (
            <button
              key={entity.id}
              type="button"
              onClick={() => toggle(entity)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors ${
                selected.includes(entity.id) ? "bg-muted" : ""
              }`}
            >
              <span>{entity.emoji}</span>
              <span className="flex-1 text-left">{entity.name}</span>
              <span className="text-[11px] text-muted-foreground capitalize">{TYPE_LABEL[entity.type]}</span>
              {selected.includes(entity.id) && <X className="h-3 w-3 text-muted-foreground" />}
            </button>
          ))}

          {/* Create new options */}
          {query.trim() && types.map((type) => (
            <button
              key={`create-${type}`}
              type="button"
              onClick={() => createNew(type)}
              disabled={createEntity.isPending}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-primary/5 transition-colors text-primary"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Crear {TYPE_LABEL[type].toLowerCase()} "{query.trim()}"</span>
            </button>
          ))}

          {filtered.length === 0 && !query.trim() && (
            <p className="px-3 py-2 text-xs text-muted-foreground">Sin entidades — empieza escribiendo para crear una</p>
          )}
        </div>
      )}
    </div>
  )
}
