"use client";
import { Brand } from "@/components/Nav";
import InstallApp from "@/components/InstallApp";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

// Simple email + password login. The two users are created once in
// Supabase → Authentication → Users → Add user (tick "Auto Confirm User").
export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const configured = !!process.env.NEXT_PUBLIC_SUPABASE_URL;

  return (
    <div className="mx-auto mt-4 max-w-sm">
      <div className="relative mx-auto mb-4 h-64 w-52 overflow-hidden rounded-[2rem] border-4 border-gold-400 shadow-xl shadow-saffron-500/30">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/murugan/darshan.webp" alt="முருகன்" className="h-full w-full object-cover object-top" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-maroon-900/90 to-transparent p-2 text-center text-sm font-bold text-gold-400">யாமிருக்க பயமேன்</div>
      </div>
      <h1 className="text-center"><Brand big /></h1>
      <div className="mt-3"><InstallApp /></div>
      <p className="mt-3 text-center font-semibold text-maroon-500">வெற்றி வேல்! வீர வேல்!</p>
      <p className="mt-1 text-center text-stone-500">TNPSC தொகுதி 1 · 2 · 4 — தமிழ்வழிப் பயிற்சி</p>
      {!configured && (
        <p className="card mt-6 text-sm text-kumkum-500">Supabase அமைப்புகள் இன்னும் சேர்க்கப்படவில்லை. README-இல் உள்ள படிகளைப் பின்பற்றவும்.</p>
      )}
      <form
        className="card mt-6 space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setMsg(null);
          const { error } = await supabaseBrowser().auth.signInWithPassword({ email: email.trim(), password });
          if (error) {
            setMsg("மின்னஞ்சல் அல்லது கடவுச்சொல் தவறு.");
            setBusy(false);
          } else {
            router.replace("/");
            router.refresh();
          }
        }}
      >
        <label className="block text-sm font-semibold">மின்னஞ்சல்</label>
        <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
        <label className="block text-sm font-semibold">கடவுச்சொல்</label>
        <input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        <button className="btn w-full" disabled={busy}>{busy ? "Please wait…" : "Sign in"}</button>
        {msg && <p className="text-sm text-kumkum-500">{msg}</p>}
      </form>
    </div>
  );
}
