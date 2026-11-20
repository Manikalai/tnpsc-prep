// Re-mounts on every page change: the new page slides gently into view (like a phone app).
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-[pagein_.24s_cubic-bezier(.2,.8,.2,1)] motion-reduce:animate-none">{children}</div>;
}
