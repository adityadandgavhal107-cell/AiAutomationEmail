import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/signup')
  const isApiRoute = pathname.startsWith('/api/')
  const isPublic = pathname === '/' || isAuthPage

  console.log('MIDDLEWARE DEBUG:', { pathname, isApiRoute, isPublic, hasUser: !!user })

  if (!user && !isPublic) {
    // Return JSON 401 for API routes instead of redirecting to HTML login page
    if (isApiRoute) {
      console.log('MIDDLEWARE RETURNING 401 JSON FOR:', pathname)
      return NextResponse.json(
        { error: 'Unauthorized — session expired. Please log in again.' },
        { status: 401 }
      )
    }
    console.log('MIDDLEWARE REDIRECTING TO /login FOR:', pathname)
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && isAuthPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
