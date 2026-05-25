"use client"

import { useState, useRef, useEffect } from "react"
import { useAuth } from "@/hooks/use-auth"
import {
  useExpenseComments,
  useAddComment,
  useDeleteComment,
  type ExpenseComment,
} from "@/hooks/use-expense-comments"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import { Trash2, Loader2, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface Props {
  expenseId: string
}

export function ExpenseComments({ expenseId }: Props) {
  const { user } = useAuth()
  const { data: comments, isLoading } = useExpenseComments(expenseId)
  const addComment = useAddComment(expenseId)
  const deleteComment = useDeleteComment(expenseId)

  const [draft, setDraft] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${el.scrollHeight}px`
  }, [draft])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = draft.trim()
    if (!trimmed) return
    try {
      await addComment.mutateAsync(trimmed)
      setDraft("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al añadir comentario")
    }
  }

  async function handleDelete(commentId: string) {
    try {
      await deleteComment.mutateAsync(commentId)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar comentario")
    }
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-1.5">
        <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Comentarios
        </p>
      </div>

      {/* Comment list */}
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 rounded-lg" />
          <Skeleton className="h-10 rounded-lg" />
        </div>
      ) : !comments || comments.length === 0 ? (
        <p className="text-xs text-muted-foreground italic py-1">
          Aún no hay comentarios
        </p>
      ) : (
        <div className="space-y-2">
          {comments.map((c: ExpenseComment) => {
            const isOwn = user?.uid === c.uid
            return (
              <div
                key={c.id}
                className={cn(
                  "rounded-xl px-3 py-2.5 text-sm space-y-0.5",
                  isOwn ? "bg-primary/8 border border-primary/12" : "bg-muted/40 border border-border"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    {isOwn ? "Tú" : "Usuario"}{" "}
                    &middot;{" "}
                    <span>
                      {formatDistanceToNow(new Date(c.created_at), {
                        addSuffix: true,
                        locale: es,
                      })}
                    </span>
                  </p>
                  {isOwn && (
                    <button
                      type="button"
                      onClick={() => void handleDelete(c.id)}
                      disabled={deleteComment.isPending}
                      className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                      aria-label="Eliminar comentario"
                    >
                      {deleteComment.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3" />
                      )}
                    </button>
                  )}
                </div>
                <p className="text-sm leading-relaxed break-words">{c.body}</p>
              </div>
            )
          })}
        </div>
      )}

      {/* Add comment form */}
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-2">
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Añade un comentario..."
          maxLength={1000}
          rows={2}
          className={cn(
            "w-full resize-none rounded-xl border bg-background px-3 py-2 text-sm",
            "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
            "transition-colors duration-150",
            "min-h-[60px] overflow-hidden"
          )}
        />
        <div className="flex items-center justify-between">
          {draft.length > 800 && (
            <p className="text-xs text-muted-foreground tabular-nums">
              {draft.length}/1000
            </p>
          )}
          <div className="ml-auto">
            <Button
              type="submit"
              size="sm"
              className="h-8 px-4 text-xs font-semibold"
              disabled={!draft.trim() || addComment.isPending}
            >
              {addComment.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                "Comentar"
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
