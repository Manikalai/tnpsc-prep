import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC = ["/login", "/manifest.webmanifest", "/sw.js", "/icon.svg", "/favicon-64.png", "/apple-touch-icon.png", "/logo-128.webp", "/icon-192.png", "/icon-512.png", "/icon-maskable-512.png", "/api/cron"];

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return res; // not configured yet: pages show the setup notice

  const sb = createServerClient(url, anon, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });
  // getClaims() checks the login token locally (and refreshes it when it expires) instead of asking the auth server every time
  const { data } = await sb.auth.getClaims();
  const user = data?.claims?.sub ? data.claims : null;

  const path = req.nextUrl.pathname;
  if (!user && !PUBLIC.some((p) => path.startsWith(p))) {
    if (path.startsWith("/api/")) return NextResponse.json({ error: "login required" }, { status: 401 });
    const to = req.nextUrl.clone();
    to.pathname = "/login";
    return NextResponse.redirect(to);
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|webp)$).*)"],
};
