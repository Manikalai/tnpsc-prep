// Launch screen: shown the moment the app opens (before the page or any JavaScript bundle loads),
// with the Vel and Murugan slogans changing every second. Once per app launch, then it fades away.
import { SLOGANS, nameOfDay } from "@/lib/murugan";

const G = "#ffd76a", D = "#8a5a00";
const STEP = 1.2; // seconds per slogan
const pct = (k: number) => ((k * 100) / SLOGANS.length).toFixed(2);
const VEL = `<svg viewBox="0 0 64 160" style="position:relative;height:96px;animation:velglow 1.6s ease-in-out infinite" aria-hidden="true">
<path d="M32 4C46 24 50 46 32 66C14 46 18 24 32 4Z" fill="${G}" stroke="${D}" stroke-width="2"/>
<path d="M32 14C39 28 40 44 32 56C24 44 25 28 32 14Z" fill="none" stroke="${D}" stroke-width="1.6" opacity=".8"/>
<circle cx="32" cy="38" r="3.2" fill="#c62828"/><path d="M20 70h24l-4 7H24z" fill="${G}" stroke="${D}" stroke-width="1.6"/>
<circle cx="32" cy="82" r="5" fill="${G}" stroke="${D}" stroke-width="1.6"/><path d="M24 90h16l-3 5H27z" fill="${G}" stroke="${D}" stroke-width="1.4"/>
<rect x="29" y="95" width="6" height="56" rx="3" fill="${G}" stroke="${D}" stroke-width="1.4"/><path d="M26 151h12l-6 7z" fill="${G}" stroke="${D}" stroke-width="1.4"/></svg>`;

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
