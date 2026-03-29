export const config = { runtime: "nodejs" };

// --- Notion helpers ---

function extractRichText(richText: any[]): string {
  return (richText || []).map((t: any) => t.plain_text || "").join("");
}

function extractBlockText(block: any): string {
  const type = block.type;
  const content = block[type];
  if (!content) return "";
  if (content.rich_text) return extractRichText(content.rich_text);
  return "";
}

async function getBlockChildren(
  token: string,
  blockId: string,
  depth = 0
): Promise<string> {
  if (depth > 2) return "";
  const res = await fetch(
    `https://api.notion.com/v1/blocks/${blockId}/children?page_size=50`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": "2022-06-28",
      },
    }
  );
  if (!res.ok) return "";
  const data = await res.json();
  const blocks = data.results || [];

  let text = "";
  for (const block of blocks) {
    const line = extractBlockText(block);
    if (line) text += line + "\n";
    if (block.has_children && depth < 2) {
      text += await getBlockChildren(token, block.id, depth + 1);
    }
  }
  return text;
}

function getPageTitle(page: any): string {
  try {
    const props = page.properties || {};
    for (const key of Object.keys(props)) {
      const prop = props[key];
      if (prop.type === "title" && prop.title?.length) {
        return extractRichText(prop.title) || "Sin título";
      }
    }
  } catch {}
  return "Sin título";
}

async function getMidnightNotionContext(token: string): Promise<string> {
  try {
    const searchRes = await fetch("https://api.notion.com/v1/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        page_size: 30,
        filter: { value: "page", property: "object" },
      }),
    });

    if (!searchRes.ok) {
      const err = await searchRes.text();
      return `Error Notion (${searchRes.status}): ${err.slice(0, 200)}`;
    }

    const searchData = await searchRes.json();
    const pages: any[] = searchData.results || [];

    let context = "";
    for (const page of pages.slice(0, 15)) {
      const title = getPageTitle(page);
      context += `\n### ${title}\n`;
      const content = await getBlockChildren(token, page.id);
      if (content.trim()) context += content.slice(0, 2000) + "\n";
    }

    return context.slice(0, 20000) || "No hay contenido en Notion.";
  } catch (err) {
    return "Error al cargar Notion: " + (err instanceof Error ? err.message : "unknown");
  }
}

// --- System prompts ---

const BASE = `Eres J.U.A.N. (Juan's Universal AI Navigator), el asistente ejecutivo de Juan.
Juan: estudiante Universidad de La Sabana (negocios), fundador de OZONO y socio de Midnight Events SAS.
Responde en español casual, directo y conciso. Sin relleno. Sin introducciones largas.`;

const SYSTEM: Record<string, string> = {
  midnight: `${BASE}

ROL: Strategic Advisor de Midnight Events SAS (empresa de eventos en Colombia).
Tienes acceso al contexto completo de Notion de Midnight.
Usa esa info para dar respuestas concretas con datos reales.
Si el contexto no tiene la info, dilo claramente — no inventes.
Conecta todo a acciones concretas para esta semana.

=== CONTEXTO NOTION MIDNIGHT ===
{{NOTION_CONTEXT}}
================================`,

  ozono: `${BASE}

ROL: Co-founder virtual de OZONO.
OZONO: plataforma WhatsApp de carpooling universitario en Colombia. MVP activo.
Misión: ayudar a Juan a construir, iterar y escalar OZONO.
Mentalidad lean startup. Conecta a recursos y herramientas reales.
Cuando lleguen a conclusiones clave, indícalo para documentar.`,

  mentor: `${BASE}

ROL: Mentor Ejecutivo CEO.
Juan maneja dos empresas siendo estudiante. Tu misión:
- Analizar problemas con frameworks reales (First Principles, MECE, Porter, etc.)
- Enseñar herramientas de negocios y cómo aplicarlas en sus proyectos
- Dar dirección ejecutiva sin paternalismos
- Desarrollar mentalidad y hábitos de CEO profesional
- Enseñar cualquier tema que Juan solicite con ejemplos prácticos aplicados a su realidad
Sé directo y exigente. Hazlo pensar. No le des todo masticado.`,

  general: BASE,
};

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" }); return; }

  try {
    const { messages, mode = "general" } = req.body;

    let system = SYSTEM[mode] || SYSTEM.general;

    if (mode === "midnight") {
      const notionToken = process.env.NOTION_MIDNIGHT_SECRET;
      const notionContext = notionToken
        ? await getMidnightNotionContext(notionToken)
        : "⚠ NOTION_MIDNIGHT_SECRET no configurado en Vercel.";
      system = system.replace("{{NOTION_CONTEXT}}", notionContext);
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        system,
        messages,
      }),
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
}
