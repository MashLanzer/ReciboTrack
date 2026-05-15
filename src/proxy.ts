import { NextResponse, type NextRequest } from "next/server"

// Rutas que NO requieren sesión
const PUBLIC_PATHS = ["/login", "/offline", "/share-target"]

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p))
  const sessionCookie = request.cookies.get("session")

  // Ruta protegida sin sesión → redirigir al login
  if (!isPublic && !sessionCookie) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("from", pathname)
    return NextResponse.redirect(url)
  }

  // Ruta de login con sesión activa → redirigir al dashboard
  if (isPublic && sessionCookie) {
    const url = request.nextUrl.clone()
    url.pathname = "/dashboard"
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon\\.ico|manifest\\.json|icon.*\\.png|apple.*\\.png|sw\\.js|\\.well-known).*)",
  ],
}
