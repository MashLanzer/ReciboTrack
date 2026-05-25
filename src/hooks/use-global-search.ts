"use client"

import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { useAuth } from "./use-auth"
import { apiFetch } from "@/lib/api-client"

export interface SearchExpense {
  id: string
  merchant: string
  category: string
  total: number
  currency: string
  date: string
}

export interface SearchClient {
  id: string
  name: string
  email: string | null
}

export interface SearchProject {
  id: string
  name: string
  status: string
  color: string | null
}

export interface SearchRecurring {
  id: string
  merchant: string
  category: string
  total: number
  currency: string
}

export interface GlobalSearchResults {
  results: {
    expenses: SearchExpense[]
    clients: SearchClient[]
    projects: SearchProject[]
    recurring: SearchRecurring[]
  }
  total: number
}

export function useGlobalSearch(query: string) {
  const { user } = useAuth()
  const [debouncedQuery, setDebouncedQuery] = useState(query)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(t)
  }, [query])

  return useQuery<GlobalSearchResults>({
    queryKey: ["global-search", debouncedQuery],
    queryFn: async () => {
      const res = await apiFetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`)
      if (!res.ok) throw new Error("Error buscando")
      return res.json() as Promise<GlobalSearchResults>
    },
    enabled: !!user && debouncedQuery.length >= 2,
    staleTime: 30_000,
  })
}
