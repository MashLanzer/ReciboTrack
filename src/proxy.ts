import { NextResponse, type NextRequest } from "next/server"

const PUBLIC_PATHS = ["/login"]

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p))
  const sessionCookie = request.cookies.get("session")

  if (!isPublic && !sessionCookie) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("from", pathname)
    return NextResponse.redirect(url)
  }

  if (isPublic && sessionCookie) {
    const url = request.nextUrl.clone()
    url.pathname = "/dashboard"
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  // Excluir API routes, archivos estáticos de Next.js e íconos/assets públicos
  matcher: ["/((?!api|_next/static|_next/image|favicon\\.ico|manifest\\.json|icon.*\\.png|apple.*\\.png|\\.well-known).*)"],
}
