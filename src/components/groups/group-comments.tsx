"use client"

import { useState, useRef, useEffect } from "react"
import { useGroupComments, useAddGroupComment, useDeleteGroupComment } from "@/hooks/use-group-comments"
import { useAuth } from "@/hooks/use-auth"
import { formatDate } from "@/lib/utils"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { Send, Trash2, MessageCircle, Loader2 } from "lucide-react"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"

// ─── Comment thread dialog ────────────────────────────────────────────────────

interface CommentsDialogProps {
  open: boolean
  onClose: () => void
  groupId: string
  expenseId: string
  expenseName: string
}

export function CommentsDialog({ open, onClose, groupId, expenseId, expenseName }: CommentsDialogProps) {
  const { user } = useAuth()
  const { data: comments = [], isLoading } = useGroupComments(groupId, expenseId)
  const addComment = useAddGroupComment(groupId, expenseId)
  const deleteComment = useDeleteGroupComment(groupId, expenseId)
  const [text, setText] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom when new comments arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [comments.length])

  async function handleSend() {
    if (!text.trim()) return
    try {
      await addComment.mutateAsync(text)
      setText("")
    } catch {
      toast.error("Error al enviar comentario")
    }
  }

  function initials(name: string) {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
  }

  return (
    <>
    <ConfirmDialog
      open={!!deleteTarget}
      onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}
      title="¿Eliminar comentario?"
      description="Esta acción no se puede deshacer."
      confirmLabel="Eliminar"
      onConfirm={async () => {
        if (!deleteTarget) return
        try {
          await deleteComment.mutateAsync(deleteTarget)
        } catch {
          toast.error("Error al eliminar el comentario")
        }
      }}
    />
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm flex flex-col max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <MessageCircle className="h-4 w-4" />
            Comentarios · {expenseName}
          </DialogTitle>
        </DialogHeader>

        {/* Comment list */}
        <div className="flex-1 overflow-y-auto space-y-3 min-h-0 py-1">
          {isLoading && (
            <div className="space-y-3 px-1">
              {[1, 2].map((i) => (
                <div key={i} className="flex gap-2">
                  <Skeleton className="h-7 w-7 rounded-full shrink-0" />
                  <div className="space-y-1 flex-1">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-10 w-full rounded-xl" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isLoading && comments.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Sin comentarios aún</p>
              <p className="text-xs mt-0.5">¡Sé el primero en comentar!</p>
            </div>
          )}

          {comments.map((c) => {
            const isOwn = c.uid === user?.uid
            return (
              <div key={c.id} className={cn("flex gap-2", isOwn && "flex-row-reverse")}>
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarImage src={c.photoURL ?? ""} />
                  <AvatarFallback className="text-[10px]">{initials(c.displayName)}</AvatarFallback>
                </Avatar>
                <div className={cn("flex-1 max-w-[80%]", isOwn && "items-end flex flex-col")}>
                  <p className={cn("text-[10px] text-muted-foreground mb-0.5", isOwn && "text-right")}>
                    {isOwn ? "Tú" : c.displayName}
                  </p>
                  <div className={cn(
                    "group relative px-3 py-2 rounded-2xl text-sm",
                    isOwn
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-muted rounded-tl-sm"
                  )}>
                    <p className="leading-relaxed">{c.text}</p>
                    <p className={cn(
                      "text-[9px] mt-1 opacity-60",
                      isOwn ? "text-right" : "text-left"
                    )}>
                      {formatDate(c.createdAt, "d MMM HH:mm")}
                    </p>
                    {isOwn && (
                      <button
                        onClick={() => setDeleteTarget(c.id)}
                        className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-white
                          flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-2.5 w-2.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="flex gap-2 pt-2 border-t">
          <Input
            placeholder="Escribe un comentario..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            className="h-9 text-sm"
          />
          <Button
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={handleSend}
            disabled={!text.trim() || addComment.isPending}
          >
            {addComment.isPending
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Send className="h-4 w-4" />
            }
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  )
}

// ─── Trigger button (small, shown on expense rows) ───────────────────────────

interface CommentButtonProps {
  groupId: string
  expenseId: string
  expenseName: string
}

export function CommentButton({ groupId, expenseId, expenseName }: CommentButtonProps) {
  const [open, setOpen] = useState(false)
  const { data: comments = [] } = useGroupComments(groupId, expenseId)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
        title="Comentarios"
      >
        <MessageCircle className="h-3.5 w-3.5" />
        {comments.length > 0 && (
          <span className="text-[10px] font-medium">{comments.length}</span>
        )}
      </button>
      <CommentsDialog
        open={open}
        onClose={() => setOpen(false)}
        groupId={groupId}
        expenseId={expenseId}
        expenseName={expenseName}
      />
    </>
  )
}
