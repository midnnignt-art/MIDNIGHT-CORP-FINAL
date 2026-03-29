import { useState, useRef, useEffect } from "react";

const SYSTEM_PROMPT = `Eres J.U.A.N., el asistente personal de Juan. Personalidad tipo JARVIS: profesional, ingenioso, orientado a resultados.

CONTEXTO:
- Estudiante Universidad de La Sabana, Colombia (negocios)
- Fundador de OZONO: plataforma WhatsApp para universitarios (carpooling MVP)
- Socio de Midnight Events SAS (eventos)
- Cursos: supply chain, matemáticas financieras, marketing, negociación

ROLES: Strategic Advisor, Growth Coach, Tool Scout, Accountability Partner.
Responde en español casual, conciso, sin relleno. Conecta respuestas a sus proyectos reales.`;

const MODULES = [
  { label: "OZONO Strategy", icon: "🚗", prompt: "Dame mis 3 prioridades esta semana para OZONO" },
  { label: "Tool Discovery", icon: "🔧", prompt: "Recomiéndame 3 herramientas game-changer para un founder universitario" },
  { label: "Skill Upgrade", icon: "📈", prompt: "Qué skill debería aprender ahora para mayor ROI en 6 meses?" },
  { label: "Daily Debrief", icon: "🎯", prompt: "Hazme preguntas de mentor para reflexionar sobre mi día" },
  { label: "Midnight Events", icon: "🌙", prompt: "Análisis estratégico de Midnight Events: movimientos clave esta semana en lo legal, operativo y crecimiento" },
  { label: "La Sabana", icon: "🎓", prompt: "Cómo hago que mis materias de este semestre sirvan para OZONO o Midnight? Ideas concretas" },
];

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function Jarvis() {
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [stat, setStat] = useState("READY");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, busy]);

  async function ask(text: string) {
    if (!text.trim() || busy) return;
    const userMsg: Message = { role: "user", content: text.trim() };
    const history = [...msgs, userMsg];
    setMsgs(history);
    setInput("");
    setBusy(true);
    setStat("THINKING…");

    try {
      const res = await fetch("/api/juan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: SYSTEM_PROMPT,
          messages: history.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const raw = await res.text();
      let data: any;
      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error("Response not JSON: " + raw.slice(0, 200));
      }

      if (!res.ok) throw new Error(`API ${res.status}: ${data?.error || raw.slice(0, 200)}`);
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

  const empty = msgs.length === 0;
  const accent = "#00d4ff";
  const statColor = stat === "ERROR" ? "#ff4444" : busy ? "#ff9500" : accent;

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "radial-gradient(ellipse at 50% 0%, #0a1628, #060d17 60%)",
        fontFamily: "system-ui, -apple-system, sans-serif",
        overflow: "hidden",
        position: "fixed",
        inset: 0,
        zIndex: 70,
      }}
    >
      {/* Grid bg */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.02,
          pointerEvents: "none",
          backgroundImage: `linear-gradient(${accent} 1px, transparent 1px), linear-gradient(90deg, ${accent} 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      {/* Header */}
      <div
        style={{
          padding: "14px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid #ffffff10",
          zIndex: 2,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 9,
              height: 9,
              borderRadius: "50%",
              background: statColor,
              boxShadow: `0 0 12px ${statColor}80`,
              transition: "all 0.3s",
            }}
          />
          <div>
            <span
              style={{
                fontSize: 15,
                fontWeight: 800,
                color: accent,
                letterSpacing: 4,
                fontFamily: "monospace",
              }}
            >
              J.U.A.N.
            </span>
            <div
              style={{
                fontSize: 8,
                color: "#ffffff30",
                letterSpacing: 1,
                fontFamily: "monospace",
              }}
            >
              PERSONAL AI NAVIGATOR
            </div>
          </div>
        </div>
        <span
          style={{
            fontSize: 9,
            color: statColor + "90",
            letterSpacing: 1.5,
            fontFamily: "monospace",
          }}
        >
          {stat}
        </span>
      </div>

      {/* Chat */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
        {empty ? (
          <div
            style={{
              height: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 24,
            }}
          >
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 900,
                  color: accent,
                  letterSpacing: 8,
                  fontFamily: "monospace",
                }}
              >
                J.U.A.N.
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "#ffffff20",
                  marginTop: 6,
                  letterSpacing: 2,
                  fontFamily: "monospace",
                }}
              >
                v1.0
              </div>
            </div>
            <p style={{ color: "#ffffff30", fontSize: 13, textAlign: "center" }}>
              Tocá un módulo o escribí algo
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                width: "100%",
                maxWidth: 400,
              }}
            >
              {MODULES.map((m, i) => (
                <button
                  key={i}
                  onClick={() => ask(m.prompt)}
                  style={{
                    padding: "12px",
                    background: "#ffffff05",
                    border: "1px solid #ffffff0d",
                    borderRadius: 10,
                    color: "#8899aa",
                    fontSize: 13,
                    cursor: "pointer",
                    textAlign: "left",
                    fontFamily: "system-ui",
                    transition: "all 0.15s",
                  }}
                  onPointerDown={(e) => {
                    e.currentTarget.style.background = "#00d4ff10";
                    e.currentTarget.style.borderColor = "#00d4ff40";
                  }}
                  onPointerUp={(e) => {
                    e.currentTarget.style.background = "#ffffff05";
                    e.currentTarget.style.borderColor = "#ffffff0d";
                  }}
                >
                  <span style={{ marginRight: 6 }}>{m.icon}</span>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {msgs.map((m, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    maxWidth: "85%",
                    padding: "11px 15px",
                    borderRadius:
                      m.role === "user"
                        ? "14px 14px 4px 14px"
                        : "14px 14px 14px 4px",
                    background:
                      m.role === "user" ? "#00d4ff0c" : "#ffffff06",
                    border: `1px solid ${m.role === "user" ? "#00d4ff20" : "#ffffff0c"}`,
                    color: m.role === "user" ? "#c0e8f0" : "#b0bcc5",
                    fontSize: 14,
                    lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {m.role !== "user" && (
                    <div
                      style={{
                        fontSize: 9,
                        color: accent,
                        fontFamily: "monospace",
                        marginBottom: 4,
                        letterSpacing: 2,
                      }}
                    >
                      J.U.A.N.
                    </div>
                  )}
                  {m.content}
                </div>
              </div>
            ))}
            {busy && (
              <div style={{ display: "flex", gap: 5, padding: 8 }}>
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: accent,
                      animation: `juanPulse 1.4s ${i * 0.2}s infinite ease-in-out`,
                    }}
                  />
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
        <div
          style={{
            display: "flex",
            gap: 8,
            background: "#ffffff06",
            borderRadius: 12,
            border: "1px solid #ffffff0d",
            padding: "3px 3px 3px 14px",
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                ask(input);
              }
            }}
            placeholder="Hablá con J.U.A.N..."
            style={{
              flex: 1,
              background: "none",
              border: "none",
              outline: "none",
              color: "#c0e8f0",
              fontSize: 14,
              padding: "10px 0",
            }}
          />
          <button
            onClick={() => ask(input)}
            disabled={!input.trim() || busy}
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              border: "none",
              background: input.trim() && !busy ? accent : "#ffffff08",
              cursor: input.trim() && !busy ? "pointer" : "default",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: input.trim() && !busy ? 1 : 0.3,
              flexShrink: 0,
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke={input.trim() ? "#0a1628" : "#fff4"}
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
