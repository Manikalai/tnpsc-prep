import { NextResponse } from "next/server";
import { apiUser } from "./supabase/server";
import { AIError } from "./ai";

export const ok = (data: unknown = { ok: true }) => NextResponse.json(data);
export const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

/** Wraps a route: requires login, turns thrown errors into readable JSON. */
export function route<T>(fn: (ctx: NonNullable<Awaited<ReturnType<typeof apiUser>>>, body: T) => Promise<Response>) {
  return async (req: Request) => {
    const ctx = await apiUser();
    if (!ctx) return fail("உள்நுழையவும் (login required)", 401);
    let body = {} as T;
    try {
      body = (await req.json()) as T;
    } catch {
      /* empty body */
    }
    try {
      return await fn(ctx, body);
    } catch (e) {
      if (e instanceof AIError) {
        console.error(e.attempts);
        return fail("AI சேவை இப்போது கிடைக்கவில்லை. சிறிது நேரம் கழித்து மீண்டும் முயலவும்.", 503);
      }
      console.error(e);
      return fail(e instanceof Error ? e.message : String(e), 500);
    }
  };
}
