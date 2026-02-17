
import { GoogleGenAI } from "@google/genai";

// Refactored to follow strict initialization guidelines using process.env.API_KEY
export const getFinancialInsights = async (
  totalRevenue: number, 
  liquidity: number, 
  soldPercent: number
): Promise<string> => {
  try {
    // Create instance right before use as per guidelines to ensure latest configuration
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const model = "gemini-3-flash-preview";
    
    const prompt = `
      Act as a senior financial analyst for an event management platform called "MIDNIGHT".
      Analyze these metrics:
      - Total Revenue Generated: $${totalRevenue}
      - Immediately Available Liquidity: $${liquidity}
      - Event Sold Out Percentage: ${soldPercent}%

      Provide a concise, strategic executive summary (max 2 sentences) focusing on liquidity utilization and sales momentum. 
      Do not use markdown formatting.
    `;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    });

    // Access the .text property directly as per modern SDK guidelines
    return response.text || "Unable to generate insights at this time.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "AI Insights currently unavailable. Please check API Key configuration.";
  }
};
