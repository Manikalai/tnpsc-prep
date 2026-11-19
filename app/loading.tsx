// Shown instantly while a page loads, so tapping a menu item responds immediately.
export default function Loading() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label="ஏற்றுகிறது">
      <div className="h-7 w-2/3 rounded-lg bg-stone-200/80" />
      <div className="h-4 w-1/2 rounded bg-stone-200/70" />
      <div className="card space-y-3">
        <div className="h-4 w-3/4 rounded bg-stone-200/70" />
        <div className="h-4 w-full rounded bg-stone-200/60" />
        <div className="h-4 w-5/6 rounded bg-stone-200/60" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="card h-24" />
        <div className="card h-24" />
      </div>
      <div className="card space-y-3">
        <div className="h-4 w-2/3 rounded bg-stone-200/70" />
        <div className="h-4 w-full rounded bg-stone-200/60" />
      </div>
    </div>
  );
}
