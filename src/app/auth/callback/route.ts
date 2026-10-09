import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const error_description = searchParams.get('error_description')
  
  // if "next" is in param, use it as the redirect URL
  const next = searchParams.get('next') ?? '/dashboard'

  // 1. Tratamento de erro vindo via Query String
  if (error) {
    return NextResponse.redirect(`${origin}/auth/auth-code-error?error=${error}&error_description=${error_description}`)
  }

  // 2. Fluxo PKCE (código presente)
  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // The `setAll` method was called from a Server Component.
            }
          },
        },
      }
    )
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    if (!exchangeError) {
      return NextResponse.redirect(`${origin}${next}`)
    } else {
      return NextResponse.redirect(`${origin}/auth/auth-code-error?error=${exchangeError.name}&error_description=${exchangeError.message}`)
    }
  }

  // 3. Se não tem código nem erro na query, pode ser que o Supabase tenha
  // enviado os dados no fragmento da URL (#access_token=... ou #error=...).
  // Como o servidor não lê fragmentos, enviamos para uma página cliente que processará o hash.
  return NextResponse.redirect(`${origin}/auth/callback/client?next=${next}`)
}
