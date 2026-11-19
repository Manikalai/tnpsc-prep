import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { SUPABASE_ANON, SUPABASE_URL, isAllowed } from "../env";

export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // called from a Server Component: middleware refreshes the session instead
        }
      },
    },
  });
}

type AuthUser = { id: string; email?: string };

/** The signed-in user, checked once per request. getClaims() verifies the login token locally
 *  (no call to the auth server on every page), which makes page changes much faster. */
const currentUser = cache(async () => {
  const sb = await supabaseServer();
  const { data } = await sb.auth.getClaims();
  const c = data?.claims as { sub?: string; email?: string } | undefined;
  const user: AuthUser | null = c?.sub ? { id: c.sub, email: c.email } : null;
  return { sb, user };
});

/** Returns the signed-in user and a client acting as them, or redirects to /login. */
export async function requireUser() {
  const { sb, user } = await currentUser();
  if (!user || !isAllowed(user.email)) redirect("/login");
  return { sb, user };
}

/** Same as requireUser for API routes: returns null instead of redirecting. */
export async function apiUser() {
  const { sb, user } = await currentUser();
  if (!user || !isAllowed(user.email)) return null;
  return { sb, user };
}
