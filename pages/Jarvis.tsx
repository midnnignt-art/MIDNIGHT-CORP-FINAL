import { useState, useRef, useEffect } from "react";

type Mode = "midnight" | "ozono" | "mentor";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const ACCENT: Record<Mode, string> = {
  midnight: "#a855f7",
  ozono:    "#00d4ff",
  mentor:   "#f59e0b",
};

const MODE_LABELS: Record<Mode, string> = {
  midnight: "MIDNIGHT",
  ozono:    "OZONO",
  mentor:   "MENTOR",
};

const MODE_ICONS: Record<Mode, string> = {
  midnight: "🌙",
  ozono:    "🚗",
  mentor:   "🎯",
};

const MODULES: Record<Mode, { label: string; icon: string; prompt: string }[]> = {
  midnight: [
    { label: "Overview",     icon: "📊", prompt: "Dame un overview completo del estado actual de Midnight Events basado en el contexto disponible." },
    { label: "Esta semana",  icon: "📅", prompt: "Qué movimientos clave debo hacer esta semana en Midnight Events? Legal, operativo y crecimiento." },
    { label: "Análisis",     icon: "⚡", prompt: "Analiza el estado actual de Midnight Events y dame los 3 puntos más críticos a resolver." },
    { label: "Crecimiento",  icon: "📈", prompt: "Cuál es la estrategia de crecimiento más efectiva para Midnight ahora mismo?" },
  ],
  ozono: [
    { label: "Estado OZONO",  icon: "🚗", prompt: "Dame un resumen del estado actual de OZONO y qué viene primero." },
    { label: "Prioridades",   icon: "🎯", prompt: "Cuáles son mis 3 prioridades esta semana para OZONO?" },
    { label: "Estrategia",    icon: "🗺️", prompt: "Analiza la estrategia actual de OZONO. Qué está bien, qué hay que cambiar?" },
    { label: "Herramientas",  icon: "🔧", prompt: "Qué herramientas necesito ahora para hacer crecer OZONO más rápido?" },
  ],
  mentor: [
    { label: "Daily Debrief",  icon: "📝", prompt: "Hazme las preguntas de mentor para reflexionar sobre mi día como CEO." },
    { label: "Resolver algo",  icon: "🧠", prompt: "Tengo un problema que quiero analizar. Ayúdame con un framework." },
    { label: "Aprender",       icon: "📚", prompt: "Qué debería aprender esta semana para ser mejor CEO de Midnight y OZONO?" },
    { label: "Dirección",      icon: "🧭", prompt: "Dame un direccionamiento estratégico y personal para esta semana." },
  ],
};

export default function Jarvis() {
  const [mode, setMode]     = useState<Mode>("midnight");
  const [msgs, setMsgs]     = useState<Message[]>([]);
  const [input, setInput]   = useState("");
  const [busy, setBusy]     = useState(false);
  const [stat, setStat]     = useState("READY");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, busy]);

  const accent = ACCENT[mode];
  const statColor = stat === "ERROR" ? "#ff4444" : busy ? "#ff9500" : accent;
  const empty = msgs.length === 0;

  function switchMode(m: Mode) {
    if (m === mode) return;
    setMode(m);
    setMsgs([]);
    setInput("");
    setStat("READY");
  }

  async function ask(text: string) {
    if (!text.trim() || busy) return;
    const userMsg: Message = { role: "user", content: text.trim() };
    const history = [...msgs, userMsg];
    setMsgs(history);
    setInput("");
    setBusy(true);
    setStat(mode === "midnight" ? "CARGANDO CONTEXTO…" : "THINKING…");

    try {
      const res = await fetch("/api/juan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          messages: history.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const raw = await res.text();
      let data: any;
      try { data = JSON.parse(raw); } catch { throw new Error("Response not JSON: " + raw.slice(0, 200)); }

      if (!res.ok) throw new Error(`API ${res.status}: ${data?.error?.message || data?.error || raw.slice(0, 200)}`);
      if (data.type === "error") throw new Error(data.error?.message || "Unknown API error");

      const reply = (data.content || [])
        .filter((b: any) => b.type === "text")
        .map((b: any) => b.text)
        .join("\n")
        .trim();

      if (!reply) throw new Error("Empty content in response");

      setMsgs((prev) => [...prev, { role: "assistant", content: reply }]);
      setStat("READY");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setMsgs((prev) => [...prev, { role: "assistant", content: `⚠ ${message}` }]);
      setStat("ERROR");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{
      width: "100vw", height: "100vh", display: "flex", flexDirection: "column",
      background: "radial-gradient(ellipse at 50% 0%, #0a1628, #060d17 60%)",
      fontFamily: "system-ui, -apple-system, sans-serif", overflow: "hidden",
      position: "fixed", inset: 0, zIndex: 70,
    }}>
      {/* Grid bg */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.02, pointerEvents: "none",
        backgroundImage: `linear-gradient(${accent} 1px, transparent 1px), linear-gradient(90deg, ${accent} 1px, transparent 1px)`,
        backgroundSize: "60px 60px", transition: "all 0.5s",
      }} />

      {/* Header */}
      <div style={{
        padding: "12px 16px", display: "flex", alignItems: "center",
        justifyContent: "space-between", borderBottom: "1px solid #ffffff10", zIndex: 2, gap: 12,
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%", background: statColor,
            boxShadow: `0 0 12px ${statColor}80`, transition: "all 0.3s",
          }} />
          <div>
            <span style={{ fontSize: 13, fontWeight: 800, color: accent, letterSpacing: 3, fontFamily: "monospace", transition: "color 0.3s" }}>
              J.U.A.N.
            </span>
            <div style={{ fontSize: 7, color: "#ffffff20", letterSpacing: 1, fontFamily: "monospace" }}>
              AI NAVIGATOR
            </div>
          </div>
        </div>

        {/* Mode tabs */}
        <div style={{ display: "flex", gap: 4, flex: 1, justifyContent: "center" }}>
          {(["midnight", "ozono", "mentor"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              style={{
                padding: "5px 10px", borderRadius: 8, border: "none", cursor: "pointer",
                fontSize: 9, fontWeight: 800, letterSpacing: 1.5, fontFamily: "monospace",
                background: mode === m ? ACCENT[m] + "20" : "transparent",
                color: mode === m ? ACCENT[m] : "#ffffff20",
                borderBottom: mode === m ? `1px solid ${ACCENT[m]}` : "1px solid transparent",
                transition: "all 0.2s",
              }}
            >
              {MODE_ICONS[m]} {MODE_LABELS[m]}
            </button>
          ))}
        </div>

        {/* Status + clear */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {!empty && (
            <button
              onClick={() => { setMsgs([]); setStat("READY"); }}
              style={{
                fontSize: 8, color: "#ffffff20", background: "none", border: "none",
                cursor: "pointer", letterSpacing: 1, fontFamily: "monospace",
                padding: "4px 6px",
              }}
            >
              CLEAR
            </button>
          )}
          <span style={{ fontSize: 8, color: statColor + "90", letterSpacing: 1.5, fontFamily: "monospace" }}>
            {stat}
          </span>
        </div>
      </div>

      {/* Chat */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
        {empty ? (
          <div style={{
            height: "100%", display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 20,
          }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>{MODE_ICONS[mode]}</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: accent, letterSpacing: 6, fontFamily: "monospace", transition: "color 0.3s" }}>
                {MODE_LABELS[mode]}
              </div>
              <div style={{ fontSize: 10, color: "#ffffff15", marginTop: 4, letterSpacing: 2, fontFamily: "monospace" }}>
                {mode === "midnight" && "CON CONTEXTO DE NOTION"}
                {mode === "ozono"    && "CO-FOUNDER MODE"}
                {mode === "mentor"   && "EXECUTIVE MENTOR"}
              </div>
            </div>

            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, width: "100%", maxWidth: 380,
            }}>
              {MODULES[mode].map((m, i) => (
                <button
                  key={i}
                  onClick={() => ask(m.prompt)}
                  style={{
                    padding: "13px 12px", background: accent + "08",
                    border: `1px solid ${accent}15`, borderRadius: 12,
                    color: "#8899aa", fontSize: 12, cursor: "pointer",
                    textAlign: "left", fontFamily: "system-ui", transition: "all 0.15s",
                  }}
                  onPointerDown={(e) => {
                    e.currentTarget.style.background = accent + "18";
                    e.currentTarget.style.borderColor = accent + "40";
                  }}
                  onPointerUp={(e) => {
                    e.currentTarget.style.background = accent + "08";
                    e.currentTarget.style.borderColor = accent + "15";
                  }}
                >
                  <span style={{ marginRight: 6 }}>{m.icon}</span>{m.label}
                </button>
              ))}
            </div>

            <p style={{ color: "#ffffff15", fontSize: 11, textAlign: "center", maxWidth: 280 }}>
              {mode === "midnight" && "Cada respuesta incluye tu contexto de Notion"}
              {mode === "ozono"    && "Construyamos OZONO juntos, paso a paso"}
              {mode === "mentor"   && "Cuéntame lo que está pasando"}
            </p>
          </div>
        ) : (
          <>
            {msgs.map((m, i) => (
              <div key={i} style={{
                display: "flex",
                justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                marginBottom: 12,
              }}>
                <div style={{
                  maxWidth: "85%", padding: "11px 15px",
                  borderRadius: m.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                  background: m.role === "user" ? accent + "0c" : "#ffffff06",
                  border: `1px solid ${m.role === "user" ? accent + "20" : "#ffffff0c"}`,
                  color: m.role === "user" ? "#c0e8f0" : "#b0bcc5",
                  fontSize: 14, lineHeight: 1.65, whiteSpace: "pre-wrap", wordBreak: "break-word",
                }}>
                  {m.role !== "user" && (
                    <div style={{
                      fontSize: 8, color: accent, fontFamily: "monospace",
                      marginBottom: 5, letterSpacing: 2, transition: "color 0.3s",
                    }}>
                      J.U.A.N. · {MODE_LABELS[mode]}
                    </div>
                  )}
                  {m.content}
                </div>
              </div>
            ))}
            {busy && (
              <div style={{ display: "flex", gap: 5, padding: 8 }}>
                {[0, 1, 2].map((i) => (
                  <div key={i} style={{
                    width: 7, height: 7, borderRadius: "50%", background: accent,
                    animation: `juanPulse 1.4s ${i * 0.2}s infinite ease-in-out`,
                    transition: "background 0.3s",
                  }} />
                ))}
                <style>{`@keyframes juanPulse{0%,80%,100%{opacity:.3;transform:scale(.8)}40%{opacity:1;transform:scale(1.2)}}`}</style>
              </div>
            )}
          </>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div style={{ padding: "10px 16px 20px", borderTop: "1px solid #ffffff0a" }}>
        <div style={{
          display: "flex", gap: 8, background: "#ffffff06", borderRadius: 12,
          border: `1px solid ${accent}15`, padding: "3px 3px 3px 14px", transition: "border-color 0.3s",
        }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); ask(input); } }}
            placeholder={`Hablá con J.U.A.N. · ${MODE_LABELS[mode]}...`}
            style={{
              flex: 1, background: "none", border: "none", outline: "none",
              color: "#c0e8f0", fontSize: 14, padding: "10px 0",
            }}
          />
          <button
            onClick={() => ask(input)}
            disabled={!input.trim() || busy}
            style={{
              width: 38, height: 38, borderRadius: 10, border: "none",
              background: input.trim() && !busy ? accent : "#ffffff08",
              cursor: input.trim() && !busy ? "pointer" : "default",
              display: "flex", alignItems: "center", justifyContent: "center",
              opacity: input.trim() && !busy ? 1 : 0.3, flexShrink: 0,
              transition: "background 0.3s",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke={input.trim() ? "#0a1628" : "#fff4"} strokeWidth="2.5" strokeLinecap="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
