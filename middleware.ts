import { next, rewrite } from '@vercel/edge';

export const config = {
  matcher: ['/event/:id*'],
};

// User-Agents que renderizan OG cards al previsualizar links.
// Cobertura: WhatsApp, Facebook, Twitter/X, LinkedIn, Telegram, Slack, Discord,
// Pinterest, Skype, iMessage (Applebot), buscadores principales.
const CRAWLER_REGEX = /facebookexternalhit|Facebot|Twitterbot|LinkedInBot|WhatsApp|TelegramBot|Slackbot|Discordbot|Pinterest|Skype|Applebot|Googlebot|bingbot|DuckDuckBot|YandexBot|baidu|MetaInspector|vkShare/i;

export default function middleware(request: Request) {
  const ua = request.headers.get('user-agent') || '';
  const url = new URL(request.url);
  const match = url.pathname.match(/^\/event\/([^/]+)/);

  if (match && CRAWLER_REGEX.test(ua)) {
    const eventId = match[1];
    const target = new URL('/api/og', url);
    target.searchParams.set('id', eventId);
    return rewrite(target);
  }

  return next();
}
