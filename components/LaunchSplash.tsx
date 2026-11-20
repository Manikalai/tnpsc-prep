// Launch screen: shown the moment the app opens (before the page or any JavaScript bundle loads),
// with the Vel and Murugan slogans changing every second. Once per app launch, then it fades away.
import { SLOGANS, nameOfDay } from "@/lib/murugan";

const G = "#ffd76a", D = "#8a5a00";
const STEP = 1.2; // seconds per slogan
const pct = (k: number) => ((k * 100) / SLOGANS.length).toFixed(2);
const VEL = `<svg viewBox="0 0 64 160" style="position:relative;height:122px;animation:velglow 1.6s ease-in-out infinite" aria-hidden="true"><defs><linearGradient id="lvb" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${D}"/><stop offset=".22" stop-color="${G}"/><stop offset=".5" stop-color="#fff3c4"/><stop offset=".78" stop-color="${G}"/><stop offset="1" stop-color="${D}"/></linearGradient><linearGradient id="lvs" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${D}"/><stop offset=".45" stop-color="${G}"/><stop offset="1" stop-color="${D}"/></linearGradient></defs><path d="M32 1C43 15 57 31 56 48C55 61 44 68 32 73C20 68 9 61 8 48C7 31 21 15 32 1Z" fill="url(#lvb)" stroke="${D}" stroke-width="2.2" stroke-linejoin="round"/><path d="M32 10C40 22 49 34 48.5 47C48 57 40.5 62 32 66C23.5 62 16 57 15.5 47C15 34 24 22 32 10Z" fill="none" stroke="${D}" stroke-width="1.3" opacity=".7"/><path d="M32 12V30M32 56V64" stroke="${D}" stroke-width="1.2" opacity=".55"/><g stroke="#fffaf0" stroke-width="2.6" stroke-linecap="round"><path d="M22 37H42"/><path d="M21 42.5H43"/><path d="M22 48H42"/></g><circle cx="32" cy="42.5" r="3.6" fill="#d32f2f" stroke="#7f1010" stroke-width=".8"/><path d="M14 72C20 70 26 71 32 76C38 71 44 70 50 72C47 79 40 81 32 80C24 81 17 79 14 72Z" fill="url(#lvs)" stroke="${D}" stroke-width="1.6" stroke-linejoin="round"/><path d="M24 74.5Q28 79 32 76M40 74.5Q36 79 32 76" fill="none" stroke="${D}" stroke-width="1" opacity=".7"/><g fill="${G}" stroke="${D}" stroke-width="1.1"><circle cx="25" cy="84.5" r="2.6"/><circle cx="32" cy="85" r="2.8"/><circle cx="39" cy="84.5" r="2.6"/></g><circle cx="32" cy="94" r="6.5" fill="url(#lvs)" stroke="${D}" stroke-width="1.6"/><circle cx="32" cy="94" r="2.6" fill="#d32f2f" stroke="#7f1010" stroke-width=".7"/><path d="M24.5 101.5H39.5L36.5 106.5H27.5Z" fill="url(#lvs)" stroke="${D}" stroke-width="1.4" stroke-linejoin="round"/><rect x="27.5" y="106" width="9" height="44" rx="3" fill="url(#lvs)" stroke="${D}" stroke-width="1.4"/><g fill="${G}" stroke="${D}" stroke-width="1.1"><rect x="26" y="118" width="12" height="3.6" rx="1.5"/><rect x="26" y="134" width="12" height="3.6" rx="1.5"/></g><path d="M25.5 149.5H38.5L32 159Z" fill="url(#lvs)" stroke="${D}" stroke-width="1.4" stroke-linejoin="round"/></svg>`;

function html() {
  return `<style>
#launch{position:fixed;inset:0;z-index:100;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 24px;text-align:center;
background:linear-gradient(#fbf4e8,#fdeccd 55%,#f6d9a8);transition:opacity .45s ease;font-family:"Mukta Malar","Noto Sans Tamil",sans-serif}
#launch .lp-ring{position:relative;display:grid;place-items:center;width:144px;height:144px}
#launch .lp-ping{position:absolute;inset:0;border-radius:50%;background:rgba(245,158,11,.25);animation:launchping 1.6s cubic-bezier(0,0,.2,1) infinite}
#launch .lp-disc{position:absolute;inset:12px;border-radius:50%;background:linear-gradient(135deg,#7a1414,#e07b00);box-shadow:0 12px 30px rgba(224,123,0,.4)}
#launch-slogan{position:relative;margin-top:12px;width:100%;height:2.7em;font-size:24px;font-weight:700;line-height:1.3;color:#7a1414}
#launch-slogan span{position:absolute;inset:0;opacity:0;animation:launchcycle ${(SLOGANS.length * STEP).toFixed(1)}s linear infinite}
@keyframes launchping{75%,100%{transform:scale(1.5);opacity:0}}
@keyframes launchcycle{0%{opacity:0;transform:translateY(8px)}${pct(0.12)}%{opacity:1;transform:none}${pct(0.88)}%{opacity:1;transform:none}${pct(1)}%,100%{opacity:0;transform:translateY(-6px)}}
@keyframes velglow{0%,100%{transform:translateY(0) scale(1);filter:drop-shadow(0 0 2px #ffd76a)}50%{transform:translateY(-3px) scale(1.06);filter:drop-shadow(0 0 10px #ffd76a)}}
</style>
<div class="lp-ring"><span class="lp-ping"></span><span class="lp-disc"></span>${VEL}</div>
<p style="margin-top:24px;font-size:14px;font-weight:600;letter-spacing:.04em;color:#9b2c1c">ஓம் சரவணபவ</p>
<p id="launch-slogan">${SLOGANS.map((x, i) => `<span style="animation-delay:calc(var(--off,0s) + ${(i * STEP).toFixed(1)}s)">${x}</span>`).join("")}</p>
<p style="margin-top:20px;font-size:18px;font-weight:600;color:#44403c">வணக்கம் சரண்யா 🙏</p>
<p style="margin-top:4px;font-size:14px;color:#78716c">இன்று ${nameOfDay()} அருள் துணை</p>
<p style="position:absolute;bottom:calc(24px + env(safe-area-inset-bottom));font-size:11px;font-weight:600;letter-spacing:.25em;color:#a8a29e">SARANYA PREP</p>`;
}

function script() {
  return `(function(){
var el=document.getElementById('launch');if(!el)return;
function gone(){el.style.display='none'}
try{if(sessionStorage.getItem('launched')){gone();return}sessionStorage.setItem('launched','1')}catch(e){}
var t0=Date.now();el.style.setProperty('--off','-'+(Math.floor(Math.random()*${SLOGANS.length})*${STEP})+'s');
var done=false;function hide(){if(done)return;done=true;el.style.opacity='0';el.style.pointerEvents='none';setTimeout(gone,480)}
function ready(){setTimeout(hide,Math.max(0,2300-(Date.now()-t0)))}
if(document.readyState==='complete')ready();else window.addEventListener('load',ready);
setTimeout(hide,5000);el.addEventListener('click',hide);
})();`;
}

// The screen is part of the page HTML (so it paints before any JavaScript); the script right after it
// only changes the slogan and hides it. React leaves it alone (no hydration mismatch).
export default function LaunchSplash() {
  return (
    <>
      <div id="launch" aria-hidden suppressHydrationWarning dangerouslySetInnerHTML={{ __html: html() }} />
      <script dangerouslySetInnerHTML={{ __html: script() }} />
    </>
  );
}
