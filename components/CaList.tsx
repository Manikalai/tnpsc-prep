export type CA = { id: string; ca_date?: string; region: string; category: string; title_ta: string; note_ta: string; exam_point_ta: string | null; source_name: string | null; source_url: string | null };

export default function CaList({ items }: { items: CA[] }) {
  const groups = [
    ["tn", "தமிழ்நாடு"],
    ["india", "இந்தியா"],
  ] as const;
  return (
    <>
      {groups.map(([key, label]) => {
        const list = items.filter((i) => i.region === key);
        if (!list.length) return null;
        const cats = [...new Set(list.map((i) => i.category))];
        return (
          <section key={key} className="space-y-3">
            <h2 className="border-b-2 border-brand-500 pb-1 text-xl font-bold text-brand-700">{label}</h2>
            {cats.map((c) => (
              <div key={c} className="space-y-2">
                <p className="chip">{c}</p>
                {list.filter((i) => i.category === c).map((i) => (
                  <article key={i.id} className="card break-inside-avoid">
                    <h3 className="font-bold">{i.title_ta}</h3>
                    <p className="mt-1">{i.note_ta}</p>
                    {i.exam_point_ta && <p className="mt-2 rounded-lg bg-turmeric-50 px-3 py-2 text-sm"><b>தேர்வுக் குறிப்பு:</b> {i.exam_point_ta}</p>}
                    {i.source_url && (
                      <a href={i.source_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-stone-500 underline print:hidden">
                        மூலம்: {i.source_name}
                      </a>
                    )}
                  </article>
                ))}
              </div>
            ))}
          </section>
        );
      })}
    </>
  );
}

