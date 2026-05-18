// AI Insights deshabilitado en producción.
//
// La versión anterior llamaba a Claude desde el browser con
// `dangerouslyAllowBrowser: true`, lo que exponía la API key de Anthropic
// en el bundle público. Para reactivar AI Insights, mover la llamada a una
// edge function de Supabase (p.ej. `supabase/functions/ai-insights/`) y
// guardar `ANTHROPIC_API_KEY` como secret server-side.
//
// La firma se conserva para no romper futuros callsites.

export const getFinancialInsights = async (
  _totalRevenue: number,
  _liquidity: number,
  _soldPercent: number
): Promise<string> => {
  return "AI Insights deshabilitado. Para activarlo, mover la llamada a una edge function server-side.";
};
