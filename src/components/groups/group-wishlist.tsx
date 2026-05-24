"use client"

import { useState } from "react"
import { useGroupWishlist, useAddWishlistItem, useLikeWishlistItem, useMarkWishlistPurchased } from "@/hooks/use-group-wishlist"
import { useAuth } from "@/hooks/use-auth"
import { formatCurrency, cn } from "@/lib/utils"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Plus, Heart, Check, ExternalLink } from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type { WishlistItemInput } from "@/types"

interface GroupWishlistProps {
  groupId: string
  currency: string
}

export function GroupWishlist({ groupId, currency }: GroupWishlistProps) {
  const { user } = useAuth()
  const { data: items = [], isLoading } = useGroupWishlist(groupId)
  const addItem = useAddWishlistItem()
  const likeItem = useLikeWishlistItem()
  const markPurchased = useMarkWishlistPurchased()

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<{ title: string; url: string; estimatedPrice: string }>({
    title: "",
    url: "",
    estimatedPrice: "",
  })

  async function handleAdd() {
    if (!form.title.trim()) return
    const input: WishlistItemInput = {
      title: form.title.trim(),
      currency,
    }
    if (form.url.trim()) input.url = form.url.trim()
    if (form.estimatedPrice) {
      const n = parseFloat(form.estimatedPrice)
      if (!isNaN(n)) input.estimatedPrice = n
    }
    try {
      await addItem.mutateAsync({ groupId, input })
      setForm({ title: "", url: "", estimatedPrice: "" })
      setShowForm(false)
      toast.success("Ítem añadido")
    } catch {
      toast.error("Error al añadir ítem")
    }
  }

  if (isLoading) return <Skeleton className="h-32 rounded-2xl" />

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Lista de deseos ({items.length})</p>
        <button
          onClick={() => setShowForm((o) => !o)}
          className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          <Plus className="h-3.5 w-3.5" />
          Añadir
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border bg-muted/20 p-3 space-y-2">
          <Input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Nombre del ítem..."
            className="h-8 text-sm"
            autoFocus
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              value={form.url}
              onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
              placeholder="URL (opcional)"
              className="h-8 text-xs"
            />
            <Input
              type="number" inputMode="decimal"
              step="0.01"
              value={form.estimatedPrice}
              onChange={(e) => setForm((f) => ({ ...f, estimatedPrice: e.target.value }))}
              placeholder={`Precio estimado (${currency})`}
              className="h-8 text-xs tabular-nums"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-7 text-xs"
              onClick={() => setShowForm(false)}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              className="flex-1 h-7 text-xs"
              onClick={handleAdd}
              disabled={!form.title.trim() || addItem.isPending}
            >
              Añadir
            </Button>
          </div>
        </div>
      )}

      {items.length === 0 && !showForm && (
        <div className="text-center py-8 text-sm text-muted-foreground">
          <p>Lista de deseos vacía</p>
          <p className="text-xs mt-1">Añade ítems que el grupo quiera conseguir</p>
        </div>
      )}

      <div className="space-y-2">
        {items.map((item) => {
          const liked = user ? item.likes.includes(user.uid) : false
          const purchasedDate = item.purchasedAt
            ? (item.purchasedAt as { toDate(): Date }).toDate()
            : null

          return (
            <div
              key={item.id}
              className={cn(
                "rounded-xl border p-3 transition-opacity",
                item.purchased ? "opacity-60" : ""
              )}
            >
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "text-sm font-semibold",
                    item.purchased && "line-through text-muted-foreground"
                  )}>
                    {item.title}
                  </p>
                  {item.estimatedPrice && (
                    <p className="text-xs text-muted-foreground tabular-nums">
                      ~{formatCurrency(item.estimatedPrice, item.currency)}
                    </p>
                  )}
                  {item.purchased && purchasedDate && (
                    <p className="text-[10px] text-muted-foreground">
                      Comprado el {format(purchasedDate, "d MMM", { locale: es })}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-primary transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                  <button
                    onClick={() => likeItem.mutate({ groupId, itemId: item.id, liked: !liked })}
                    className={cn(
                      "flex items-center gap-1 text-xs font-medium transition-colors",
                      liked ? "text-rose-500" : "text-muted-foreground hover:text-rose-500"
                    )}
                  >
                    <Heart className={cn("h-3.5 w-3.5", liked && "fill-current")} />
                    {item.likes.length > 0 && <span>{item.likes.length}</span>}
                  </button>
                  {!item.purchased && (
                    <button
                      onClick={() => markPurchased.mutate({ groupId, itemId: item.id })}
                      className="flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:underline"
                      disabled={markPurchased.isPending}
                    >
                      <Check className="h-3.5 w-3.5" />
                      Comprado
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
