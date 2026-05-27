import { notFound } from "next/navigation"
import { getSupabase } from "@/lib/supabase/server"
import Image from "next/image"
import { format } from "date-fns"
import { es } from "date-fns/locale"

interface PublicProfile {
  display_name: string | null
  photo_url:    string | null
  handle:       string | null
  created_at:   string | null
}

/**
 * Resuelve un handle a un perfil. Busca primero en `profiles.handle`
 * (la ubicación canónica desde migration 020). Si no está, fallback a
 * `user_settings.data.handle` y, si lo encuentra, sincroniza a profiles
 * para que las próximas búsquedas sean directas.
 */
async function findProfileByHandle(handle: string): Promise<PublicProfile | null> {
  const sb = getSupabase()
  const normalized = handle.trim().toLowerCase()

  // 1. Lookup canónico en profiles
  const { data: profile } = await sb
    .from("profiles")
    .select("display_name, photo_url, handle, created_at, uid")
    .ilike("handle", normalized)
    .maybeSingle()

  if (profile) return profile

  // 2. Fallback: el handle puede estar solo en user_settings.data.handle
  //    (caso de usuarios que guardaron el handle antes del fix que lo
  //    propagaba también a profiles). Buscamos y, si lo encontramos,
  //    completamos el profile.handle como auto-heal.
  const { data: settings } = await sb
    .from("user_settings")
    .select("uid, data")
    .filter("data->>handle", "ilike", normalized)
    .maybeSingle()

  if (!settings) return null

  // Auto-heal: copiar el handle a profiles para que el próximo lookup
  // del paso 1 funcione sin necesitar el fallback.
  await sb
    .from("profiles")
    .update({ handle: normalized })
    .eq("uid", settings.uid)

  const { data: healed } = await sb
    .from("profiles")
    .select("display_name, photo_url, handle, created_at")
    .eq("uid", settings.uid)
    .maybeSingle()

  return healed
}

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  const profile = await findProfileByHandle(handle)
  return {
    title: profile ? `${profile.display_name ?? handle} · ReciboTrack` : "Perfil · ReciboTrack",
  }
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>
}) {
  const { handle } = await params
  const profile = await findProfileByHandle(handle)

  if (!profile) notFound()

  const memberSince = profile.created_at
    ? format(new Date(profile.created_at), "MMMM yyyy", { locale: es })
    : null

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Card de perfil */}
        <div className="rounded-3xl border bg-card shadow-lg overflow-hidden">
          {/* Header con gradiente */}
          <div className="h-24 bg-gradient-to-br from-primary/20 to-primary/5" />

          {/* Avatar */}
          <div className="flex flex-col items-center -mt-12 px-6 pb-8">
            <div className="h-24 w-24 rounded-full border-4 border-background bg-muted overflow-hidden shadow-md">
              {profile.photo_url ? (
                <Image
                  src={profile.photo_url}
                  alt={profile.display_name ?? handle}
                  width={96}
                  height={96}
                  className="object-cover w-full h-full"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-primary/10 text-3xl font-bold text-primary">
                  {(profile.display_name ?? handle).charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            <h1 className="mt-3 text-xl font-black tracking-tight text-center">
              {profile.display_name ?? handle}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              ${profile.handle ?? handle}
            </p>
            {memberSince && (
              <p className="text-xs text-muted-foreground mt-2">
                Miembro desde {memberSince}
              </p>
            )}
          </div>
        </div>

        {/* Branding */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          Perfil de{" "}
          <a href="https://recibotrack.vercel.app" className="text-primary font-semibold">
            ReciboTrack
          </a>
          {" "}· Gestión financiera personal
        </p>
      </div>
    </div>
  )
}
