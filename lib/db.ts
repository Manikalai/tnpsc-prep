// Supabase returns at most 1000 rows per request. fetchAll reads every page.
export async function fetchAll<T = Record<string, unknown>>(build: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error?: unknown }>, max = 50000): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < max; from += 1000) {
    const { data } = await build(from, from + 999);
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}
