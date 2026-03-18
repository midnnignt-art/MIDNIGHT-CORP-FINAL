import Anthropic from "@anthropic-ai/sdk";

// Migrated from Google Gemini to Claude (Anthropic)
// Same function signatures preserved for full backwards compatibility
export const getFinancialInsights = async (
  totalRevenue: number,
  liquidity: number,
  soldPercent: number
): Promise<string> => {
  try {
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;

    if (!apiKey) {
      return "Configura VITE_ANTHROPIC_API_KEY en .env.local para activar AI Insights.";
    }

    const client = new Anthropic({
      apiKey,
      dangerouslyAllowBrowser: true,
    });

    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: `Act as a senior financial analyst for an event management platform called "MIDNIGHT".
Analyze these metrics:
- Total Revenue Generated: $${totalRevenue}
- Immediately Available Liquidity: $${liquidity}
- Event Sold Out Percentage: ${soldPercent}%

Provide a concise, strategic executive summary (max 2 sentences) focusing on liquidity utilization and sales momentum.
Do not use markdown formatting.`,
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    return textBlock && textBlock.type === "text"
      ? textBlock.text
      : "Unable to generate insights at this time.";
  } catch (error) {
    console.error("Claude API Error:", error);
    return "AI Insights currently unavailable. Please check your VITE_ANTHROPIC_API_KEY.";
  }
};
