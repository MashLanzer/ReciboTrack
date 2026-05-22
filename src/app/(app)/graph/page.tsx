"use client"

import dynamic from "next/dynamic"
import { useState, useMemo, useCallback, useRef, useEffect } from "react"
import { useEntities, useEntityEdges, TYPE_LABEL, type Entity, type EntityType } from "@/hooks/use-entities"
import { buildGraphData, type GraphNode } from "@/components/graph/force-graph"
import { useExpensesPeriod } from "@/hooks/use-expenses"
import { GraphQueryInput } from "@/components/graph/graph-query-input"
import { EntityPanel } from "@/components/graph/entity-panel"
import { formatCurrency } from "@/lib/utils"
import { subMonths } from "date-fns"
import {
  Network, Loader2, Users, Briefcase, MapPin, Target, Shield,
  Filter,
} from "lucide-react"

// Dynamic import for the heavy canvas graph
const ForceGraph2D = dynamic(
  () => import("react-force-graph-2d").then((m) => m.default),
  { ssr: false, loading: () => <GraphLoadingState /> },
)

function GraphLoadingState() {
  return (
    <div className="h-full flex items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  )
}

const TYPE_ICONS: Partial<Record<EntityType, React.ElementType>> = {
  person:  Users,
  project: Briefcase,
  place:   MapPin,
  intent:  Target,
  warranty: Shield,
}

export default function GraphPage() {
  const now          = useMemo(() => new Date(), [])
  const sixMonthsAgo = useMemo(() => subMonths(now, 6), [now])

  const { data: entities = [], isLoading: entitiesLoading } = useEntities()
  const { data: edges    = [], isLoading: edgesLoading    } = useEntityEdges()
  const { data: expenses = [], isLoading: expensesLoading } = useExpensesPeriod(sixMonthsAgo, now)

  const isLoading = entitiesLoading || edgesLoading || expensesLoading

  const [filterType, setFilterType]       = useState<EntityType | "all">("all")
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null)
  const [highlightIds, setHighlightIds]   = useState<Set<string>>(new Set())
  const [queryResultIds, setQueryResultIds] = useState<string[]>([])

  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 600, height: 500 })

  useEffect(() => {
    function updateSize() {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setDimensions({ width: rect.width, height: rect.height })
      }
    }
    updateSize()
    window.addEventListener("resize", updateSize)
    return () => window.removeEventListener("resize", updateSize)
  }, [])

  // Build graph data
  const filteredEntities = useMemo(() =>
    filterType === "all" ? entities : entities.filter((e) => e.type === filterType),
    [entities, filterType],
  )

  // buildGraphData is imported from force-graph.tsx

  const graphData = useMemo(
    () => buildGraphData(filteredEntities, edges, expenses),
    [filteredEntities, edges, expenses],
  )

  const handleNodeClick = useCallback((node: GraphNode) => {
    if (node.nodeType === "entity") {
      setSelectedEntity(node.data as Entity)
    }
  }, [])

  const handleQueryResults = useCallback((ids: string[]) => {
    setQueryResultIds(ids)
    setHighlightIds(new Set(ids.map((id) => `expense:${id}`)))
  }, [])

  // Node canvas render
  const nodeCanvasObject = useCallback((node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const { id, label, emoji, color, size } = node
    const x = (node as { x?: number }).x ?? 0
    const y = (node as { y?: number }).y ?? 0

    const isHighlighted = highlightIds.size === 0 || highlightIds.has(id)
    const alpha = isHighlighted ? 1 : 0.2

    ctx.globalAlpha = alpha

    // Draw circle
    ctx.beginPath()
    ctx.arc(x, y, size, 0, 2 * Math.PI)
    ctx.fillStyle = color + (isHighlighted ? "dd" : "44")
    ctx.fill()
    ctx.strokeStyle = color
    ctx.lineWidth   = isHighlighted ? 2 : 1
    ctx.stroke()

    // Draw emoji
    const fontSize = Math.max(size * 0.9, 6)
    ctx.font = `${fontSize}px serif`
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillStyle = "#000"
    ctx.fillText(emoji, x, y)

    // Draw label if zoomed in enough
    if (globalScale > 0.8 && label) {
      const labelSize = Math.max(10 / globalScale, 4)
      ctx.font = `${labelSize}px sans-serif`
      ctx.fillStyle = isHighlighted ? "#1a1a1a" : "#aaa"
      ctx.fillText(label.slice(0, 18), x, y + size + labelSize * 0.8)
    }

    ctx.globalAlpha = 1
  }, [highlightIds])

  return (
    <div className="flex flex-col md:h-[calc(100dvh-4rem)] max-w-6xl mx-auto px-4 py-4 gap-4">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
          <Network className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Money Graph</h1>
          <p className="text-xs text-muted-foreground">
            {entities.length} entidades · {edges.length} conexiones · {expenses.length} gastos
          </p>
        </div>
      </div>

      {/* ── Query input ── */}
      <div className="shrink-0">
        <GraphQueryInput
          expenses={expenses}
          entities={entities}
          onResults={handleQueryResults}
        />
      </div>

      {/* ── Main layout — vertical on mobile, horizontal on desktop ── */}
      <div className="flex flex-col md:flex-row gap-4 md:flex-1 md:min-h-0">

        {/* Graph canvas */}
        <div className="flex flex-col gap-2 md:flex-1 md:min-h-0">
          {/* Filter bar — wraps on small screens */}
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            {(["all", "person", "project", "place", "intent", "warranty"] as const).map((type) => {
              const Icon = type === "all" ? Network : (TYPE_ICONS[type as EntityType] ?? Network)
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFilterType(type)}
                  className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    filterType === type
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  {type === "all" ? "Todo" : TYPE_LABEL[type as EntityType]}
                </button>
              )
            })}
          </div>

          {/* Canvas — fixed height on mobile, fills remaining space on desktop */}
          <div ref={containerRef} className="h-80 sm:h-96 md:h-auto md:flex-1 md:min-h-0 rounded-2xl border bg-card overflow-hidden relative">
            {isLoading ? (
              <GraphLoadingState />
            ) : graphData.nodes.length === 0 ? (
              <EmptyGraphState />
            ) : (
              <ForceGraph2D
                graphData={graphData as { nodes: object[]; links: object[] }}
                width={dimensions.width}
                height={dimensions.height}
                nodeCanvasObject={nodeCanvasObject as unknown as (node: object, ctx: CanvasRenderingContext2D, scale: number) => void}
                nodeCanvasObjectMode={() => "replace"}
                onNodeClick={(node) => handleNodeClick(node as unknown as GraphNode)}
                linkColor={() => "#e2e8f0"}
                linkWidth={1}
                linkDirectionalParticles={2}
                linkDirectionalParticleSpeed={0.004}
                enableNodeDrag
                enableZoomInteraction
                backgroundColor="transparent"
                nodeRelSize={4}
              />
            )}
          </div>
        </div>

        {/* Sidebar — full width on mobile, fixed 288px column on desktop */}
        <div className="h-64 md:h-auto md:w-72 md:shrink-0 rounded-2xl border bg-card overflow-hidden flex flex-col">
          {selectedEntity ? (
            <EntityPanel
              entity={selectedEntity}
              onClose={() => setSelectedEntity(null)}
            />
          ) : (
            <EntityList
              entities={filteredEntities}
              queryResultIds={queryResultIds}
              onSelect={setSelectedEntity}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyGraphState() {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-3 p-8 text-center">
      <p className="text-5xl">🕸️</p>
      <p className="text-sm font-semibold">El grafo está vacío</p>
      <p className="text-xs text-muted-foreground max-w-52">
        Las entidades aparecerán aquí cuando asocies personas, proyectos o lugares a tus gastos.
        <br /><br />
        Edita un gasto y asígnale una persona o proyecto para verlo en el grafo.
      </p>
    </div>
  )
}

// ── Entity list sidebar ───────────────────────────────────────────────────────

function EntityList({ entities, queryResultIds, onSelect }: {
  entities: Entity[]
  queryResultIds: string[]
  onSelect: (e: Entity) => void
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b">
        <p className="text-sm font-semibold">Entidades</p>
        <p className="text-xs text-muted-foreground mt-0.5">{entities.length} registradas</p>
      </div>
      <div className="flex-1 overflow-y-auto divide-y">
        {entities.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6 px-4">
            Asocia personas y proyectos a tus gastos para verlos aquí
          </p>
        ) : (
          entities.map((entity) => (
            <button
              key={entity.id}
              type="button"
              onClick={() => onSelect(entity)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left"
            >
              <div
                className="h-8 w-8 rounded-lg flex items-center justify-center text-sm shrink-0"
                style={{ backgroundColor: `${entity.color}20` }}
              >
                {entity.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{entity.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{TYPE_LABEL[entity.type as EntityType]}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-semibold tabular-nums">{formatCurrency(entity.totalSpend ?? 0)}</p>
                <p className="text-[10px] text-muted-foreground">{entity.occurrences ?? 0} gastos</p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

