import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request) {
  return await updateSession(request);
}

// ingest/ is the PostHog proxy (next.config.mjs rewrites). Middleware runs
// before rewrites, so without this exclusion every anonymous visitor's events,
// flags and replay script were 307'd to /login and never reached PostHog.
export const config = {
  matcher: [
    "/((?!ingest/|_next/static|_next/image|favicon.ico|animations/|sitemap.*\\.xml|robots\\.txt|llms\\.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4|webm)$).*)",
  ],
};
