"use client"

/**
 * Force-directed graph visualization for the Money Graph feature.
 * Uses react-force-graph-2d (Canvas-based, no WebGL required).
 */

import { useRef, useCallback, useEffect, useState } from "react"
import type { Entity, EntityEdge } from "@/hooks/use-entities"
import type { Expense } from "@/types"
import { formatCurrency } from "@/lib/utils"

// Dynamic import type — the actual import is in the parent via next/dynamic
interface GraphData {
  nodes: GraphNode[]
  links: GraphLink[]
}

interface GraphNode {
  id: string
  label: string
  emoji: string
  color: string
  nodeType: "entity" | "expense"
  size: number
  data: Entity | Expense
}

interface GraphLink {
  source: string
  target: string
  label: string
  weight: number
}

interface Props {
  entities: Entity[]
  edges: EntityEdge[]
  expenses: Expense[]
  highlightIds?: Set<string>
  onNodeClick: (node: GraphNode) => void
  width: number
  height: number
}

// The actual ForceGraph2D import is handled by the parent via dynamic()
// This component only exports the graph data builder and node renderer helpers

export function buildGraphData(
  entities: Entity[],
  edges: EntityEdge[],
  expenses: Expense[],
): GraphData {
  const expenseMap = new Map(expenses.map((e) => [e.id, e]))

  // Build nodes from entities (top 50 by spend)
  const entityNodes: GraphNode[] = entities.slice(0, 50).map((e) => ({
    id:       `entity:${e.id}`,
    label:    e.name,
    emoji:    e.emoji,
    color:    e.color,
    nodeType: "entity" as const,
    size:     Math.max(8, Math.min(24, 8 + Math.sqrt(e.totalSpend ?? 0) / 10)),
    data:     e,
  }))

  // Build expense nodes (only those connected to entities, top 100)
  const connectedExpenseIds = new Set(edges.map((edge) => edge.expenseId))
  const expenseNodes: GraphNode[] = expenses
    .filter((e) => connectedExpenseIds.has(e.id))
    .slice(0, 100)
    .map((e) => ({
      id:       `expense:${e.id}`,
      label:    e.merchant,
      emoji:    "🧾",
      color:    "#94a3b8",
      nodeType: "expense" as const,
      size:     6,
      data:     e,
    }))

  // Build links from edges
  const links: GraphLink[] = edges
    .filter((edge) => {
      const entityNode   = entityNodes.find((n) => n.id === `entity:${edge.toId}`)
      const expenseNode  = expenseNodes.find((n) => n.id === `expense:${edge.expenseId}`)
      return entityNode && expenseNode
    })
    .map((edge) => ({
      source: `expense:${edge.expenseId}`,
      target: `entity:${edge.toId}`,
      label:  edge.type.replace(/_/g, " "),
      weight: edge.weight,
    }))

  return {
    nodes: [...entityNodes, ...expenseNodes],
    links,
  }
}

export type { GraphNode, GraphLink, GraphData }
