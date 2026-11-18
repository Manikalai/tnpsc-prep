"use client";
import { useState } from "react";

type Card = { id: string; front: string; back: string; interval_days: number };

export default function Flashcards({ cards }: { cards: Card[] }) {
  const [i, setI] = useState(0);
  const [flip, setFlip] = useState(false);
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const c = cards[i];
  const grade = async (knew: boolean) => {
    await fetch("/api/flashcards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "grade", id: c.id, knew, interval: c.interval_days }) });
    setFlip(false);
    setI(i + 1);
  };
  return (
    <>
      {c ? (
        <div>
          <button onClick={() => setFlip(!flip)} className="card flex min-h-56 w-full flex-col items-center justify-center text-center">
            <p className="text-xs text-stone-400">{i + 1}/{cards.length} · {flip ? "விடை" : "வினா — தொட்டுத் திருப்புக"}</p>
            <p className={`mt-3 whitespace-pre-line text-xl ${flip ? "text-brand-700" : ""}`}>{flip ? c.back : c.front}</p>
          </button>
          {flip && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button className="btn-ghost" onClick={() => grade(false)}>மறந்துவிட்டேன்</button>
              <button className="btn" onClick={() => grade(true)}>நினைவிருக்கிறது</button>
            </div>
          )}
        </div>
      ) : (
        <p className="card text-center">இன்றைய அட்டைகள் முடிந்தன 🎉</p>
      )}
      <details className="card">
        <summary className="cursor-pointer font-semibold">புதிய அட்டை சேர்</summary>
        <div className="mt-2 space-y-2">
          <input className="input" placeholder="வினா" value={front} onChange={(e) => setFront(e.target.value)} />
          <input className="input" placeholder="விடை" value={back} onChange={(e) => setBack(e.target.value)} />
          <button
            className="btn"
            disabled={!front || !back}
            onClick={async () => {
              await fetch("/api/flashcards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "add", front, back }) });
              setFront(""); setBack("");
              alert("சேர்க்கப்பட்டது");
            }}
          >
            சேர்
          </button>
        </div>
      </details>
    </>
  );
}
