import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

export async function updateSession(request) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Track which cookie names are being set by Supabase
          const newCookieNames = new Set(
            cookiesToSet.map(({ name }) => name)
          );

          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );

          // Clean up stale chunked auth cookies that Supabase no longer needs.
          // Supabase SSR chunks large tokens into cookies like
          // sb-<ref>-auth-token.0, .1, .2, etc.
          // When the token shrinks, old higher-numbered chunks linger and
          // inflate the Cookie header, eventually triggering HTTP 431.
          const allCookies = request.cookies.getAll();
          for (const cookie of allCookies) {
            if (
              cookie.name.includes("-auth-token.") &&
              !newCookieNames.has(cookie.name)
            ) {
              supabaseResponse.cookies.set(cookie.name, "", {
                maxAge: 0,
                path: "/",
              });
            }
          }
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, searchParams } = request.nextUrl;

  // If an auth code lands on the homepage, redirect to /callback so it gets exchanged.
  // This happens when Supabase can't match the redirectTo URL (e.g. www vs non-www).
  if (pathname === "/" && searchParams.get("code")) {
    const url = request.nextUrl.clone();
    url.pathname = "/callback";
    return NextResponse.redirect(url);
  }

  // Public routes
  if (
    pathname === "/" ||
    pathname.startsWith("/api/webhooks") ||
    pathname.startsWith("/compare") ||
    pathname.startsWith("/blog") ||
    pathname === "/privacy" ||
    pathname === "/terms"
  ) {
    return supabaseResponse;
  }

  // Auth routes — redirect to dashboard if logged in
  if (pathname === "/login" || pathname === "/signup") {
    if (user) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  // Protected routes — redirect to login if not logged in
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
