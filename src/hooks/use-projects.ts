"use client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useAuth } from "./use-auth"
import { apiFetch } from "@/lib/api-client"
import type { Project, ProjectInput, Expense } from "@/types"

export type { Project }

export function useProjects(status?: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ["projects", user?.uid, status],
    enabled: !!user,
    queryFn: async () => {
      const params = status ? `?status=${status}` : ""
      const res = await apiFetch(`/api/projects${params}`)
      if (!res.ok) throw new Error("Error cargando proyectos")
      return res.json() as Promise<Project[]>
    },
  })
}

export function useProjectDetail(id: string | null) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ["projects", user?.uid, "detail", id],
    enabled: !!user && !!id,
    queryFn: async () => {
      const res = await apiFetch(`/api/projects/${id}`)
      if (!res.ok) throw new Error("Error cargando proyecto")
      return res.json() as Promise<{ project: Project; expenses: Expense[] }>
    },
  })
}

export function useCreateProject() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: ProjectInput) => {
      const res = await apiFetch("/api/projects", { method: "POST", body: JSON.stringify(input) })
      if (!res.ok) { const e = await res.json().catch(()=>({})) as {error?:string}; throw new Error(e.error ?? "Error") }
      return res.json() as Promise<{ id: string }>
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects", user?.uid] }),
  })
}

export function useUpdateProject() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<ProjectInput> & { id: string }) => {
      const res = await apiFetch(`/api/projects/${id}`, { method: "PATCH", body: JSON.stringify(input) })
      if (!res.ok) throw new Error("Error")
      return res.json()
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["projects", user?.uid] })
      qc.invalidateQueries({ queryKey: ["projects", user?.uid, "detail", vars.id] })
    },
  })
}

export function useDeleteProject() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/api/projects/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Error")
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects", user?.uid] }),
  })
}
