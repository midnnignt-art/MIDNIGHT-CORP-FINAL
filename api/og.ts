// Vercel Edge Function: HTML mínimo con OG meta tags dinámicos por evento.
//
// Lo invoca el middleware (`/middleware.ts`) cuando un crawler accede a
// `/event/[id]`. Los usuarios humanos NUNCA llegan a esta URL — siguen
// viendo la SPA normal.
//
// Env vars necesarias en Vercel:
//   SUPABASE_URL
//   SUPABASE_ANON_KEY     (lectura pública de eventos publicados)

export const config = {
  runtime: 'edge',
};

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default:  return c;
    }
  });
}

const FALLBACK_HTML = `<!DOCTYPE html>
<html lang="es-CO"><head><meta charset="UTF-8"><title>MIDNIGHT CORP</title>
<meta property="og:title" content="MIDNIGHT CORP"><meta property="og:image" content="https://midnightcorp.click/og-image.png">
<meta http-equiv="refresh" content="0; url=/"></head><body></body></html>`;

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return new Response(FALLBACK_HTML, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const SUPABASE_URL = (globalThis as any).process?.env?.SUPABASE_URL ?? '';
  const SUPABASE_KEY = (globalThis as any).process?.env?.SUPABASE_ANON_KEY ?? '';

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return new Response(FALLBACK_HTML, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  let event: any = null;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/events?id=eq.${id}&status=eq.published&select=id,title,cover_image,event_date,venue,city`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );
    const rows = await res.json();
    event = Array.isArray(rows) ? rows[0] : null;
  } catch {
    return new Response(FALLBACK_HTML, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  if (!event) {
    return new Response(FALLBACK_HTML, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const title = event.title ?? 'MIDNIGHT CORP';
  const date = event.event_date
    ? new Date(event.event_date).toLocaleDateString('es-CO', {
        weekday: 'long', day: 'numeric', month: 'long',
      })
    : '';
  const descParts = [date, event.venue, event.city].filter(Boolean);
  const description = descParts.length > 0
    ? `${descParts.join(' · ')} — MIDNIGHT CORP`
    : 'Compra tus entradas en MIDNIGHT CORP';
  const image = event.cover_image || 'https://midnightcorp.click/og-image.png';
  const canonical = `https://midnightcorp.click/event/${event.id}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: title,
    startDate: event.event_date,
    location: {
      '@type': 'Place',
      name: event.venue ?? '',
      address: event.city ?? '',
    },
    image,
    url: canonical,
    organizer: {
      '@type': 'Organization',
      name: 'Midnight Corp',
      url: 'https://midnightcorp.click/',
    },
  };

  const html = `<!DOCTYPE html>
<html lang="es-CO">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(title)} | MIDNIGHT CORP</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="MIDNIGHT CORP">
<meta property="og:locale" content="es_CO">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${escapeHtml(image)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${escapeHtml(image)}">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<meta http-equiv="refresh" content="0; url=${canonical}">
</head>
<body style="background:#050505;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;">
<a href="${canonical}" style="color:#fff">Cargando ${escapeHtml(title)}…</a>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  });
}
