"use client"

import { useState } from "react"
import { useGroupNotes, usePostGroupNote } from "@/hooks/use-group-notes"
import { useAuth } from "@/hooks/use-auth"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { Plus } from "lucide-react"

interface Member {
  uid: string
  displayName: string
  photoURL?: string | null
}

interface GroupNotesProps {
  groupId: string
  members: Member[]
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

export function GroupNotes({ groupId, members }: GroupNotesProps) {
  const { user } = useAuth()
  const { data: notes = [], isLoading } = useGroupNotes(groupId)
  const postNote = usePostGroupNote()
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState("")

  const myNote = notes.find((n) => n.userId === user?.uid)

  async function handlePost() {
    if (!text.trim()) return
    try {
      await postNote.mutateAsync({ groupId, text: text.trim() })
      toast.success("Nota publicada (24h)")
      setEditing(false)
      setText("")
    } catch {
      toast.error("Error al publicar nota")
    }
  }

  if (isLoading) return null
  if (members.length === 0) return null

  return (
    <div className="px-4 py-3 flex items-start gap-3 overflow-x-auto scrollbar-none">
      {members.map((member) => {
        const note = notes.find((n) => n.userId === member.uid)
        const isMe = member.uid === user?.uid

        return (
          <div key={member.uid} className="flex flex-col items-center gap-1 shrink-0">
            <button
              onClick={() => {
                if (isMe) {
                  setText(myNote?.text ?? "")
                  setEditing(true)
                }
              }}
              className={cn(
                "h-12 w-12 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-all",
                note
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-muted text-muted-foreground",
                isMe && "cursor-pointer hover:border-primary/60"
              )}
            >
              {getInitials(member.displayName)}
            </button>
            {note ? (
              <p className="text-[10px] text-center max-w-[60px] leading-tight text-muted-foreground truncate">
                {note.text.slice(0, 20)}
              </p>
            ) : isMe ? (
              <p className="text-[10px] text-muted-foreground">+</p>
            ) : null}
          </div>
        )
      })}

      {/* Add/edit note for current user */}
      {!myNote && user && !members.some((m) => m.uid === user.uid) && (
        <button
          onClick={() => setEditing(true)}
          className="h-12 w-12 rounded-full flex items-center justify-center border-2 border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors shrink-0"
        >
          <Plus className="h-5 w-5" />
        </button>
      )}

      {/* Edit overlay */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4" onClick={() => setEditing(false)}>
          <div
            className="w-full max-w-sm rounded-2xl bg-card border p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold">Tu nota efímera (24h)</p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="¿Qué quieres compartir?"
              rows={3}
              maxLength={150}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              autoFocus
            />
            <p className="text-[10px] text-muted-foreground text-right">{text.length}/150</p>
            <div className="flex gap-2">
              <button
                onClick={() => setEditing(false)}
                className="flex-1 rounded-xl border py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handlePost}
                disabled={!text.trim() || postNote.isPending}
                className="flex-1 rounded-xl bg-primary text-primary-foreground py-2 text-sm font-semibold disabled:opacity-50 hover:bg-primary/90 transition-colors"
              >
                Publicar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
