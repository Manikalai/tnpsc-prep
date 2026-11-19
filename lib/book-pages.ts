// Real textbook pages: each PDF page is stored as an image in Supabase Storage (bucket "pages"),
// at pages/<bookKey>/<pdf page number>.webp, where bookKey = first 12 hex chars of sha1(book title).
// The textbook loader (scripts/ingest_textbooks.py) uses the same key.
export async function bookKey(title: string) {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(title));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 12);
}

export const pageUrl = (key: string, page: number) =>
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/pages/${key}/${page}.webp`;

export const PAGES_CACHE = "tnpsc-pages";
