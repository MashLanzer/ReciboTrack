import { notFound } from "next/navigation"
import { getSupabase } from "@/lib/supabase/server"
import { format } from "date-fns"
import { es } from "date-fns/locale"

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  const { data } = await getSupabase()
    .from("profiles")
    .select("display_name")
    .ilike("handle", handle)
    .single()

  return {
    title: data ? `${data.display_name ?? handle} · ReciboTrack` : "Perfil · ReciboTrack",
  }
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>
}) {
  const { handle } = await params

  const { data: profile } = await getSupabase()
    .from("profiles")
    .select("display_name, photo_url, handle, created_at")
    .ilike("handle", handle)
    .single()

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
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.photo_url}
                  alt={profile.display_name ?? handle}
                  width={96}
                  height={96}
                  className="object-cover w-full h-full"
                  referrerPolicy="no-referrer"
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
              ${profile.handle}
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
