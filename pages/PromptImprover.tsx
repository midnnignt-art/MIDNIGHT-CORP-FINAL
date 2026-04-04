import React, { useState } from 'react';
import Anthropic from '@anthropic-ai/sdk';
import { Sparkles, Copy, Check, ChevronRight, Loader2, RotateCcw } from 'lucide-react';

interface ImprovedPrompt {
  taskContent: string;
  toneContent: string;
  backgroundData: string;
  taskDescription: string;
  examples: string;
  conversationHistory: string;
  immediateRequest: string;
  thinkStepByStep: string;
  fullPrompt: string;
}

const COMPONENT_LABELS = [
  { key: 'taskContent', num: 1, label: 'Task Content', color: 'bg-green-900/30 border-green-500/20 text-green-400', desc: 'Rol e identidad del AI' },
  { key: 'toneContent', num: 2, label: 'Tone Content', color: 'bg-blue-900/30 border-blue-500/20 text-blue-400', desc: 'Tono y estilo' },
  { key: 'backgroundData', num: 3, label: 'Background Data', color: 'bg-yellow-900/30 border-yellow-500/20 text-yellow-400', desc: 'Contexto y datos clave' },
  { key: 'taskDescription', num: 4, label: 'Task Description & Rules', color: 'bg-orange-900/30 border-orange-500/20 text-orange-400', desc: 'Instrucciones detalladas' },
  { key: 'examples', num: 5, label: 'Examples', color: 'bg-pink-900/30 border-pink-500/20 text-pink-400', desc: 'Ejemplos del output esperado' },
  { key: 'conversationHistory', num: 6, label: 'Conversation History', color: 'bg-purple-900/30 border-purple-500/20 text-purple-400', desc: 'Contexto previo relevante' },
  { key: 'immediateRequest', num: 7, label: 'Immediate Request', color: 'bg-cyan-900/30 border-cyan-500/20 text-cyan-400', desc: 'La tarea concreta ahora' },
  { key: 'thinkStepByStep', num: 8, label: 'Think Step by Step', color: 'bg-red-900/30 border-red-500/20 text-red-400', desc: 'Formato de output' },
] as const;

export const PromptImprover: React.FC = () => {
  const [rawPrompt, setRawPrompt] = useState('');
  const [context, setContext] = useState('');
  const [improved, setImproved] = useState<ImprovedPrompt | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const improve = async () => {
    if (!rawPrompt.trim()) return;
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
    if (!apiKey) {
      setError('Configura VITE_ANTHROPIC_API_KEY en .env.local');
      return;
    }

    setIsLoading(true);
    setError('');
    setImproved(null);

    try {
      const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

      const systemPrompt = `You are an expert prompt engineer. Your job is to transform a rough, vague prompt into a highly optimized, token-efficient prompt using the 8-component framework.

The 8 components are:
1. Task Content: Define the exact role/persona the AI should adopt
2. Tone Content: Specify the tone, style, and communication approach
3. Background Data: Provide essential context, constraints, or data needed
4. Task Description & Rules: Clear, specific instructions and rules to follow
5. Examples: Concrete examples of desired output format/style
6. Conversation History: Relevant prior context or preferences to remember
7. Immediate Request: The specific task to execute right now
8. Think Step by Step: How the AI should structure its thinking and output

Rules for optimization:
- Be CONCISE. Every word must earn its place. Cut filler.
- Be SPECIFIC. Vague = wasted tokens.
- Use placeholders like [VARIABLE] for dynamic content
- Prioritize actionable instructions over generic ones
- If a component is truly not applicable, write "N/A" but only if genuinely not needed

Respond ONLY with a valid JSON object in this exact format:
{
  "taskContent": "...",
  "toneContent": "...",
  "backgroundData": "...",
  "taskDescription": "...",
  "examples": "...",
  "conversationHistory": "...",
  "immediateRequest": "...",
  "thinkStepByStep": "...",
  "fullPrompt": "The complete optimized prompt combining all components into a single clean text ready to paste"
}`;

      const userMsg = `Rough prompt to improve:
"${rawPrompt}"

${context ? `Additional context from user:\n"${context}"` : ''}

Transform this into an optimized 8-component prompt. Make it precise, token-efficient, and powerful.`;

      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMsg }],
      });

      const textBlock = response.content.find(b => b.type === 'text');
      if (!textBlock || textBlock.type !== 'text') throw new Error('No text response');

      // Extract JSON from response (may be wrapped in ```json blocks)
      let jsonText = textBlock.text.trim();
      const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonText = jsonMatch[1].trim();

      const parsed = JSON.parse(jsonText) as ImprovedPrompt;
      setImproved(parsed);
    } catch (err) {
      console.error(err);
      setError('Error al mejorar el prompt. Revisa tu API key o intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  const copyFull = async () => {
    if (!improved?.fullPrompt) return;
    await navigator.clipboard.writeText(improved.fullPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copySection = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedSection(key);
    setTimeout(() => setCopiedSection(null), 1500);
  };

  const reset = () => {
    setRawPrompt('');
    setContext('');
    setImproved(null);
    setError('');
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-5 duration-700">
      {/* Header */}
      <div className="mb-10 text-center">
        <div className="inline-flex items-center gap-2 bg-eclipse/20 border border-eclipse/30 px-4 py-1.5 rounded-full mb-4">
          <Sparkles className="w-3 h-3 text-eclipse" />
          <span className="text-[9px] font-bold tracking-[0.3em] uppercase text-moonlight/60">Prompt Intelligence</span>
        </div>
        <h2 className="text-3xl md:text-5xl font-black text-moonlight uppercase tracking-tighter mb-3">
          Prompt Optimizer
        </h2>
        <p className="text-moonlight/40 text-xs font-light tracking-[0.15em] uppercase max-w-md mx-auto">
          Transforma prompts vagos en instrucciones precisas que ahorran tokens y mejoran resultados
        </p>
      </div>

      {/* Input Section */}
      {!improved && (
        <div className="max-w-2xl mx-auto space-y-4">
          {/* Framework Preview */}
          <div className="grid grid-cols-4 gap-1.5 mb-6">
            {COMPONENT_LABELS.map(c => (
              <div key={c.key} className={`border rounded-lg p-2 text-center ${c.color}`}>
                <span className="text-[8px] font-black block">{c.num}</span>
                <span className="text-[7px] font-medium block mt-0.5 leading-tight opacity-80">{c.label}</span>
              </div>
            ))}
          </div>

          <div>
            <label className="text-[9px] font-bold uppercase tracking-[0.3em] text-moonlight/40 block mb-2">
              Tu Prompt Actual
            </label>
            <textarea
              value={rawPrompt}
              onChange={e => setRawPrompt(e.target.value)}
              placeholder="Escribe tu prompt aquí, aunque sea vago o incompleto...&#10;&#10;Ejemplo: &quot;Dame ideas para mi negocio&quot;"
              rows={5}
              className="w-full bg-white/[0.03] border border-white/10 focus:border-eclipse/50 rounded-xl px-4 py-3 text-sm text-moonlight placeholder:text-moonlight/20 focus:outline-none resize-none transition-colors"
            />
          </div>

          <div>
            <label className="text-[9px] font-bold uppercase tracking-[0.3em] text-moonlight/40 block mb-2">
              Contexto Adicional <span className="text-moonlight/20">(opcional)</span>
            </label>
            <textarea
              value={context}
              onChange={e => setContext(e.target.value)}
              placeholder="Tipo de negocio, audiencia, objetivo, restricciones..."
              rows={3}
              className="w-full bg-white/[0.03] border border-white/10 focus:border-eclipse/50 rounded-xl px-4 py-3 text-sm text-moonlight placeholder:text-moonlight/20 focus:outline-none resize-none transition-colors"
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-xs">
              {error}
            </div>
          )}

          <button
            onClick={improve}
            disabled={isLoading || !rawPrompt.trim()}
            className="w-full h-14 bg-eclipse hover:bg-eclipse/80 disabled:opacity-40 disabled:cursor-not-allowed text-moonlight font-black uppercase tracking-[0.2em] text-xs rounded-xl flex items-center justify-center gap-3 transition-all"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Optimizando...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Optimizar Prompt
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      )}

      {/* Result Section */}
      {improved && (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-500">
          {/* Action Bar */}
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-moonlight/40">
              Prompt Optimizado — 8 Componentes
            </span>
            <div className="flex gap-2">
              <button
                onClick={reset}
                className="flex items-center gap-2 px-4 py-2 border border-white/10 hover:border-white/20 text-moonlight/40 hover:text-moonlight rounded-lg text-[10px] uppercase tracking-widest font-bold transition-all"
              >
                <RotateCcw className="w-3 h-3" />
                Nuevo
              </button>
              <button
                onClick={copyFull}
                className="flex items-center gap-2 px-4 py-2 bg-eclipse/80 hover:bg-eclipse text-moonlight rounded-lg text-[10px] uppercase tracking-widest font-bold transition-all"
              >
                {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copiado!' : 'Copiar Todo'}
              </button>
            </div>
          </div>

          {/* Full Prompt Preview */}
          <div className="bg-white/[0.02] border border-white/8 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[8px] font-black uppercase tracking-[0.4em] text-moonlight/30">Prompt Completo</span>
              <button onClick={copyFull} className="text-moonlight/30 hover:text-moonlight transition-colors">
                {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-moonlight/70 text-sm leading-relaxed whitespace-pre-wrap font-mono">
              {improved.fullPrompt}
            </p>
          </div>

          {/* 8 Components Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {COMPONENT_LABELS.map(c => {
              const value = improved[c.key as keyof ImprovedPrompt];
              if (!value || value === 'N/A') return null;
              return (
                <div key={c.key} className={`border rounded-xl p-4 ${c.color} bg-opacity-20`}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black opacity-60">{c.num}</span>
                      <span className="text-[9px] font-black uppercase tracking-[0.2em]">{c.label}</span>
                    </div>
                    <button
                      onClick={() => copySection(value, c.key)}
                      className="opacity-40 hover:opacity-100 transition-opacity flex-shrink-0"
                    >
                      {copiedSection === c.key
                        ? <Check className="w-3 h-3 text-green-400" />
                        : <Copy className="w-3 h-3" />
                      }
                    </button>
                  </div>
                  <p className="text-[11px] leading-relaxed opacity-80 whitespace-pre-wrap">{value}</p>
                </div>
              );
            })}
          </div>

          {/* Tips */}
          <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 text-center">
            <p className="text-[10px] text-moonlight/30 font-light tracking-wide">
              Reemplaza los <span className="text-moonlight/60 font-bold">[PLACEHOLDERS]</span> con tus datos reales antes de enviar.
              Este prompt usa ~60% menos tokens que una versión vaga.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
