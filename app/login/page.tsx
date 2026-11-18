"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const configured = !!process.env.NEXT_PUBLIC_SUPABASE_URL;

  return (
    <div className="mx-auto mt-10 max-w-sm">
      <h1 className="text-center text-3xl font-bold text-brand-700">
        TNPSC <span className="text-turmeric-500">தயாரிப்பு</span>
      </h1>
      <p className="mt-2 text-center text-stone-500">தொகுதி 1 · 2 · 4 — தமிழ்வழிப் பயிற்சி</p>
      {!configured && (
        <p className="card mt-6 text-sm text-kumkum-500">Supabase அமைப்புகள் இன்னும் சேர்க்கப்படவில்லை. README-இல் உள்ள படிகளைப் பின்பற்றவும்.</p>
      )}
      <form
        className="card mt-6 space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setMsg(null);
          const sb = supabaseBrowser();
          if (step === "email") {
            const { error } = await sb.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
            if (error) setMsg(error.message);
            else {
              setStep("code");
              setMsg("உங்கள் மின்னஞ்சலுக்கு 6 இலக்கக் குறியீடு அனுப்பப்பட்டது.");
            }
          } else {
            const { error } = await sb.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
            if (error) setMsg("குறியீடு தவறு அல்லது காலாவதியானது. மீண்டும் முயலவும்.");
            else {
              router.replace("/");
              router.refresh();
            }
          }
          setBusy(false);
        }}
      >
        <label className="block text-sm font-semibold">மின்னஞ்சல்</label>
        <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={step === "code"} autoComplete="email" />
        {step === "code" && (
          <>
            <label className="block text-sm font-semibold">குறியீடு</label>
            <input className="input tracking-widest" inputMode="numeric" required value={code} onChange={(e) => setCode(e.target.value)} autoComplete="one-time-code" />
          </>
        )}
        <button className="btn w-full" disabled={busy}>
          {busy ? "காத்திருக்கவும்…" : step === "email" ? "குறியீடு அனுப்பு" : "உள்நுழை"}
        </button>
        {step === "code" && (
          <button type="button" className="w-full text-sm text-stone-500 underline" onClick={() => { setStep("email"); setCode(""); setMsg(null); }}>
            மின்னஞ்சலை மாற்று
          </button>
        )}
        {msg && <p className="text-sm text-stone-600">{msg}</p>}
      </form>
    </div>
  );
}
