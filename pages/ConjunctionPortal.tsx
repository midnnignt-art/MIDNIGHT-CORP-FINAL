import React, { useMemo, useState } from 'react';

export type BrandSelection = 'midnight' | 'solstice' | null;

interface ConjunctionPortalProps {
  onEnterBrand: (brand: 'midnight' | 'solstice') => void;
  /** Si false, la sección SOLSTICE no se renderiza. */
  showSolstice?: boolean;
}

// CSS del portal — adaptado del diseño del owner. Fuentes: Archivo (nuestra
// sans, para headings/CTAs) y Poiret One (nuestro display celestial, para los
// wordmarks MI◐NIGHT / S☀LSTICE). Clases prefijadas `cp-` para no colisionar.
const PORTAL_CSS = `
.cp-root{ --mid-glow:#3f6bff; --sol-glow:#ff7a1f; --sol-hot:#fff0cf;
  font-family:'Archivo', sans-serif; color:#e9ecf5; background:#010104;
  overflow-x:hidden; -webkit-font-smoothing:antialiased; }
.cp-root *{ box-sizing:border-box; }

.cp-eyebrow{ font-weight:300; letter-spacing:.42em; text-transform:uppercase; color:#c9cfe0; }
.cp-rule{ width:46px; height:1px; background:rgba(255,255,255,.28); margin:0 auto; }

.cp-cta{ display:inline-flex; align-items:center; gap:.9em; padding:1.15em 2.6em;
  border-radius:999px; font-family:'Archivo',sans-serif; font-weight:300;
  font-size:clamp(12px,2.9vw,15px); letter-spacing:.30em; text-transform:uppercase;
  text-decoration:none; background:transparent; cursor:pointer; color:inherit;
  transition:background .35s ease, box-shadow .35s ease, transform .2s ease, color .35s ease; }
.cp-cta .cp-arrow{ font-size:1.05em; letter-spacing:0; transition:transform .3s ease; }
.cp-cta:hover .cp-arrow{ transform:translateX(4px); }
.cp-cta:active{ transform:scale(.98); }

.cp-sun{ display:inline-block; position:relative; width:.9em; height:.9em;
  vertical-align:-.12em; margin:0 .02em; color:var(--sol-hot); }
.cp-sun::before{ content:''; position:absolute; inset:-6%; border-radius:50%;
  background:repeating-conic-gradient(currentColor 0deg 1.4deg, transparent 1.4deg 9deg);
  -webkit-mask:radial-gradient(circle, transparent 32%, #000 35%, #000 47%, transparent 51%);
          mask:radial-gradient(circle, transparent 32%, #000 35%, #000 47%, transparent 51%);
  filter:drop-shadow(0 0 4px rgba(255,150,60,.6)); }
.cp-sun::after{ content:''; position:absolute; inset:33%; border-radius:50%;
  background:currentColor; box-shadow:0 0 8px 1px rgba(255,180,90,.9); }

/* ===== SECTION 1 : MIDNIGHT ===== */
.cp-midnight{ position:relative; text-align:center;
  padding:clamp(46px,9vw,84px) 22px clamp(70px,11vw,120px);
  background:
    radial-gradient(120% 80% at 50% 6%, rgba(30,45,110,.16) 0%, transparent 55%),
    linear-gradient(180deg,#010105 0%,#02030b 34%,#04040f 55%,#0a0812 76%,#170d0c 100%);
  overflow:hidden; isolation:isolate; }
.cp-starfield{ position:absolute; inset:0; z-index:0; pointer-events:none; }
.cp-midnight > *{ position:relative; z-index:1; }

.cp-brand{ margin-bottom:clamp(30px,5vw,44px); }
.cp-brand h1{ font-family:'Archivo', sans-serif; font-weight:800;
  font-size:clamp(30px,7.8vw,48px); letter-spacing:.06em; color:#f4f6ff; line-height:1; }
.cp-ww{ display:flex; align-items:center; justify-content:center; gap:16px; margin-top:14px; }
.cp-ww span{ font-weight:300; letter-spacing:.55em; font-size:clamp(11px,2.7vw,15px);
  text-transform:uppercase; color:#d5d9e6; padding-left:.55em; }
.cp-ww i{ display:block; height:1px; width:clamp(28px,7vw,54px); background:rgba(255,255,255,.4); }

.cp-lede{ font-size:clamp(13px,3.4vw,18px); margin-bottom:22px; }
.cp-lede + .cp-rule{ margin-bottom:clamp(30px,6vw,48px); }

.cp-eclipse{ position:relative; width:clamp(230px,66vw,340px); aspect-ratio:1;
  margin:0 auto clamp(30px,6vw,46px); border-radius:50%; display:grid; place-items:center;
  background:radial-gradient(circle at 43% 40%, #0b0f1c 0%, #06080f 52%, #020309 100%);
  box-shadow:0 0 2px 1px rgba(160,195,255,.85), 0 0 34px 6px rgba(63,107,255,.55),
    0 0 120px 26px rgba(45,90,240,.34), inset 0 0 70px 12px rgba(0,0,0,.9); }
.cp-eclipse::before{ content:''; position:absolute; inset:-1px; border-radius:50%;
  border:1.5px solid rgba(175,205,255,.75); box-shadow:0 0 26px 3px rgba(90,140,255,.6); }
.cp-eclipse::after{ content:''; position:absolute; inset:-2px; border-radius:50%;
  background:conic-gradient(from 200deg, transparent 0deg, rgba(190,215,255,.9) 20deg, transparent 60deg, transparent 360deg);
  -webkit-mask:radial-gradient(circle, transparent 68%, #000 70%);
          mask:radial-gradient(circle, transparent 68%, #000 70%);
  filter:blur(1px); opacity:.8; }

.cp-logo{ position:relative; z-index:2; display:flex; flex-direction:column; align-items:center; gap:14px; }
.cp-word{ font-family:'Poiret One', sans-serif; font-weight:400;
  font-size:clamp(28px,7.4vw,44px); letter-spacing:.16em; color:#f2f5ff;
  text-shadow:0 0 18px rgba(120,160,255,.35); padding-left:.16em; display:flex; align-items:center; }
.cp-sub{ display:flex; align-items:center; gap:12px; font-weight:300; letter-spacing:.34em;
  font-size:clamp(11px,2.8vw,14px); text-transform:uppercase; padding-left:.34em; }
.cp-sub i{ height:1px; width:22px; display:block; }
.cp-sub.blue{ color:#5f86ff; } .cp-sub.blue i{ background:rgba(95,134,255,.7); }

.cp-tag{ font-size:clamp(13px,3.4vw,18px); letter-spacing:.16em; text-transform:uppercase;
  color:#dfe4f2; margin-bottom:clamp(26px,5.5vw,40px); font-weight:300; }

.cp-cta.blue{ border:1px solid rgba(120,155,255,.55); color:#e2e9ff;
  box-shadow:0 0 22px rgba(60,105,255,.16), inset 0 0 18px rgba(60,105,255,.06); }
.cp-cta.blue:hover{ background:rgba(63,107,255,.14);
  box-shadow:0 0 34px rgba(63,107,255,.4), inset 0 0 22px rgba(63,107,255,.12); }

/* ===== SECTION 2 : SOLSTICE ===== */
.cp-solstice{ position:relative; text-align:center; padding:clamp(64px,11vw,120px) 22px 0;
  background:linear-gradient(180deg,#170d0c 0%,#3a1606 16%,#6e2a06 36%,#a5450a 54%,#d1701c 68%,#b1560f 78%,#4c2410 90%,#140a07 100%);
  overflow:hidden; isolation:isolate; }
.cp-solstice > *{ position:relative; z-index:2; }
.cp-hi-stars{ position:absolute; inset:0 0 auto 0; height:38%; z-index:1; pointer-events:none; opacity:.5;
  background:
    radial-gradient(1px 1px at 20% 22%, rgba(255,255,255,.55), transparent),
    radial-gradient(1px 1px at 70% 14%, rgba(255,255,255,.45), transparent),
    radial-gradient(1px 1px at 46% 30%, rgba(255,255,255,.4), transparent),
    radial-gradient(1px 1px at 86% 26%, rgba(255,255,255,.4), transparent); }
.cp-clouds{ position:absolute; inset:0; z-index:1; pointer-events:none; overflow:hidden; }
.cp-clouds span{ position:absolute; border-radius:50%; filter:blur(28px);
  background:radial-gradient(ellipse at center, rgba(20,7,4,.85) 0%, rgba(20,7,4,0) 70%); }
.cp-clouds .c1{ width:60%; height:120px; left:-14%; top:14%; }
.cp-clouds .c2{ width:55%; height:100px; right:-12%; top:9%; }
.cp-clouds .c3{ width:48%; height:90px; left:8%; top:30%; filter:blur(34px); }
.cp-clouds .c4{ width:70%; height:130px; right:-20%; top:34%; opacity:.8; }
.cp-clouds .c5{ width:80%; height:120px; left:-10%; bottom:30%;
  background:radial-gradient(ellipse at center, rgba(30,10,5,.7) 0%, rgba(30,10,5,0) 72%); }

.cp-eclipse.sol{ background:radial-gradient(circle at 45% 40%, #150b04 0%, #0a0502 58%, #050201 100%);
  box-shadow:0 0 3px 1px rgba(255,190,110,.9), 0 0 52px 9px rgba(255,130,35,.6),
    0 0 170px 46px rgba(255,110,20,.5), inset 0 0 72px 12px rgba(0,0,0,.85);
  margin-bottom:clamp(28px,5.5vw,42px); }
.cp-eclipse.sol::before{ border:1.5px solid rgba(255,200,130,.8); box-shadow:0 0 30px 4px rgba(255,140,50,.65); }
.cp-eclipse.sol::after{ content:''; position:absolute; inset:-3px; border-radius:50%;
  background:conic-gradient(from 130deg, transparent 0deg, rgba(255,235,190,.95) 40deg, rgba(255,170,70,.6) 70deg, transparent 110deg, transparent 360deg);
  -webkit-mask:radial-gradient(circle, transparent 66%, #000 69%);
          mask:radial-gradient(circle, transparent 66%, #000 69%);
  filter:blur(1.5px); opacity:.95; }

.cp-word.sol{ color:#fff3e2; text-shadow:0 0 20px rgba(255,150,60,.4); }
.cp-sub.orange{ color:#ff8a3a; } .cp-sub.orange i{ background:rgba(255,138,58,.75); }
.cp-tag.sol{ color:#ffe4c9; }

.cp-cta.orange{ border:1px solid rgba(255,150,70,.6); color:#ffdcb6;
  box-shadow:0 0 24px rgba(255,110,25,.18), inset 0 0 18px rgba(255,110,25,.06);
  margin-bottom:clamp(46px,8vw,72px); }
.cp-cta.orange:hover{ background:rgba(255,110,25,.16);
  box-shadow:0 0 38px rgba(255,110,25,.45), inset 0 0 24px rgba(255,110,25,.14); }

.cp-ocean{ position:relative; z-index:2; height:clamp(120px,22vw,190px); margin:0 -22px;
  background:linear-gradient(180deg, rgba(150,66,14,.55) 0%, rgba(70,30,12,.85) 30%, #1a0d07 70%, #0a0503 100%);
  overflow:hidden; }
.cp-reflection{ position:absolute; top:0; left:50%; transform:translateX(-50%); width:38%; height:100%;
  background:linear-gradient(180deg, rgba(255,175,80,.8) 0%, rgba(255,140,50,.25) 30%, transparent 70%);
  filter:blur(9px); mix-blend-mode:screen; }
.cp-ripple{ position:absolute; left:0; right:0; height:1px; background:rgba(255,180,110,.18); }
.cp-ripple.r1{ top:16%; } .cp-ripple.r2{ top:34%; opacity:.6; }
.cp-ripple.r3{ top:52%; opacity:.4; } .cp-ripple.r4{ top:70%; opacity:.25; }

@keyframes cp-twinkle{ 0%,100%{opacity:.2} 50%{opacity:.9} }
@media (max-width:420px){ .cp-ww span{ letter-spacing:.4em; } .cp-eyebrow{ letter-spacing:.32em; } }
@media (prefers-reduced-motion:reduce){ .cp-star{ animation:none !important; } }
`;

// Glifo de luna (máscara SVG) para el wordmark MI◐NIGHT
const MoonGlyph: React.FC = () => (
  <svg viewBox="8 10 52 72" aria-hidden="true"
    style={{ height: '.74em', width: 'auto', verticalAlign: '-.03em', margin: '0 .06em', overflow: 'visible' }}>
    <mask id="cpMoonD">
      <rect x="0" y="0" width="66" height="92" fill="#000" />
      <circle cx="24" cy="46" r="36" fill="#fff" />
      <circle cx="-8" cy="46" r="36" fill="#000" />
    </mask>
    <rect x="0" y="0" width="66" height="92" fill="currentColor" mask="url(#cpMoonD)"
      style={{ filter: 'drop-shadow(0 0 3px rgba(150,180,255,.5))' }} />
  </svg>
);

export const ConjunctionPortal: React.FC<ConjunctionPortalProps> = ({ onEnterBrand, showSolstice = true }) => {
  const [selected, setSelected] = useState<'midnight' | 'solstice' | null>(null);

  const handleSelect = (brand: 'midnight' | 'solstice') => {
    if (selected) return;
    setSelected(brand);
    setTimeout(() => onEnterBrand(brand), 600);
  };

  // Campo de estrellas generado una sola vez (mismo efecto que el script original).
  const stars = useMemo(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    return Array.from({ length: 150 }, (_, i) => {
      const size = Math.random() < 0.85 ? 1 : 2;
      const twinkle = !reduce && Math.random() < 0.28;
      return {
        key: i,
        style: {
          position: 'absolute' as const,
          borderRadius: '50%',
          background: '#fff',
          width: size, height: size,
          left: `${(Math.random() * 100).toFixed(2)}%`,
          top: `${(Math.random() * 100).toFixed(2)}%`,
          opacity: (0.25 + Math.random() * 0.65).toFixed(2),
          animation: twinkle
            ? `cp-twinkle ${(2.4 + Math.random() * 3.6).toFixed(2)}s ease-in-out ${(Math.random() * 4).toFixed(2)}s infinite`
            : undefined,
        },
      };
    });
  }, []);

  return (
    <div
      className="cp-root min-h-screen w-full select-none"
      style={{ opacity: selected ? 0 : 1, transition: 'opacity .5s ease' }}
    >
      <style>{PORTAL_CSS}</style>

      {/* ===================== MIDNIGHT ===================== */}
      <section className="cp-midnight">
        <div className="cp-starfield">
          {stars.map(s => <span key={s.key} className="cp-star" style={s.style} />)}
        </div>

        <div className="cp-brand">
          <h1>MIDNIGHT</h1>
          <div className="cp-ww"><i /><span>Worldwide</span><i /></div>
        </div>

        <p className="cp-lede cp-eyebrow">Dos experiencias. Un mismo universo.</p>
        <div className="cp-rule" />

        <div className="cp-eclipse">
          <div className="cp-logo">
            <div className="cp-word">MI<MoonGlyph />NIGHT</div>
            <div className="cp-sub blue"><i />The Eclipse<i /></div>
          </div>
        </div>

        <p className="cp-tag">Misterio. Vibras. Toda la noche.</p>

        <button type="button" className="cp-cta blue" onClick={() => handleSelect('midnight')}>
          Entrar a Midnight <span className="cp-arrow">&rarr;</span>
        </button>
      </section>

      {/* ===================== SOLSTICE ===================== */}
      {showSolstice && (
        <section className="cp-solstice">
          <div className="cp-hi-stars" />
          <div className="cp-clouds">
            <span className="c1" /><span className="c2" /><span className="c3" />
            <span className="c4" /><span className="c5" />
          </div>

          <div className="cp-eclipse sol">
            <div className="cp-logo">
              <div className="cp-word sol">S<span className="cp-sun" />LSTICE</div>
              <div className="cp-sub orange"><i />The Awakening<i /></div>
            </div>
          </div>

          <p className="cp-tag sol">Energía. Luz. Un nuevo comienzo.</p>

          <button type="button" className="cp-cta orange" onClick={() => handleSelect('solstice')}>
            Entrar a Solstice <span className="cp-arrow">&rarr;</span>
          </button>

          <div className="cp-ocean">
            <div className="cp-reflection" />
            <div className="cp-ripple r1" /><div className="cp-ripple r2" />
            <div className="cp-ripple r3" /><div className="cp-ripple r4" />
          </div>
        </section>
      )}
    </div>
  );
};
