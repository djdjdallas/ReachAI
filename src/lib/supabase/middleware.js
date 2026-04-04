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
    pathname === "/callback" ||
    pathname.startsWith("/api/webhooks") ||
    pathname.startsWith("/compare") ||
    pathname.startsWith("/blog") ||
    pathname.startsWith("/for") ||
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

  // Onboarding guard — redirect to onboarding if not completed
  // Skip for onboarding routes themselves and API routes
  const isDashboardRoute =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/conversations") ||
    pathname.startsWith("/analytics") ||
    pathname.startsWith("/billing") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/script-builder") ||
    pathname.startsWith("/playground") ||
    pathname.startsWith("/calendar");

  if (isDashboardRoute) {
    const onboardingCookie = request.cookies.get("onboarding_completed")?.value;

    if (onboardingCookie !== "true") {
      // Cookie missing — check database once
      const { data: profile } = await supabase
        .from("users")
        .select("onboarding_completed")
        .eq("id", user.id)
        .single();

      if (profile?.onboarding_completed) {
        // Set cookie for future requests (avoids repeated DB queries)
        supabaseResponse.cookies.set("onboarding_completed", "true", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 60 * 60 * 24 * 365,
          path: "/",
        });
      } else {
        const url = request.nextUrl.clone();
        url.pathname = "/onboarding";
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}
