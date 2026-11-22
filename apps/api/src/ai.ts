const groqKey = () => (process.env.GROQ_API_KEY || '').trim();
const base = () => (process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
const model = () => process.env.GROQ_MODEL || process.env.OLLAMA_MODEL || (groqKey() ? 'llama-3.3-70b-versatile' : 'llama3.2:3b');

export class AIUnavailableError extends Error { constructor(message: string) { super(message); this.name = 'AIUnavailableError'; } }

type OllamaReply = { message?: { role?: string; content?: string }; error?: string };
type GroqReply = { choices?: { message?: { content?: string } }[]; error?: { message?: string } };

async function askAI(messages: { role: string; content: string }[]): Promise<string> {
  if (groqKey()) {
    let response: Response;
    try {
      response = await fetch('https://groq.com', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'authorization': `Bearer ${groqKey()}` },
        body: JSON.stringify({ model: model(), messages, temperature: 0.5 }),
        signal: AbortSignal.timeout(60_000)
      });
    } catch {
      throw new AIUnavailableError('No fue posible conectar con el servicio de IA en la nube. Intenta de nuevo en unos segundos.');
    }
    const data = await response.json().catch(() => ({})) as GroqReply;
    if (!response.ok) throw new AIUnavailableError(`Error en el servicio de IA: ${data.error?.message || response.status}.`);
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) throw new AIUnavailableError('La IA no generó una respuesta. Intenta de nuevo.');
    return content;
  }

  let response: Response;
  try {
    response = await fetch(`${base()}/api/chat`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: model(), stream: false, messages, options: { temperature: 0.5 } }),
      signal: AbortSignal.timeout(120_000)
    });
  } catch {
    throw new AIUnavailableError('No fue posible conectar con Ollama ni hay una GROQ_API_KEY configurada.');
  }
  const data = await response.json().catch(() => ({})) as OllamaReply;
  if (!response.ok) throw new AIUnavailableError(`Ollama respondió con un error: ${data.error || response.status}.`);
  if (!data.message?.content?.trim()) throw new AIUnavailableError('Ollama no generó una respuesta. Intenta de nuevo.');
  return data.message.content.trim();
}

export async function aiStatus() {
  if (groqKey()) {
    return { connected: true, installed: true, model: model() };
  }
  try {
    const response = await fetch(`${base()}/api/tags`, { signal: AbortSignal.timeout(1800) });
    if (!response.ok) return { connected: false, model: model(), installed: false };
    const data = await response.json() as { models?: { name?: string }[] };
    const installed = (data.models || []).some(m => m.name === model() || m.name?.split(':')[0] === model().split(':')[0]);
    return { connected: true, installed, model: model() };
  } catch { return { connected: false, installed: false, model: model() }; }
}

export async function chatAI(history: { role: 'user' | 'assistant'; content: string }[], input: string) {
  return askAI([
    { role: 'system', content: 'Eres Focus, un tutor académico cálido, claro y preciso. Responde en español claro a menos que el estudiante pida otro idioma. Explica paso por paso, con ejemplos breves, evita culpabilizar, y termina proponiendo una acción pequeña y concreta cuando tenga sentido. Si no sabes algo, reconócelo. No inventes fuentes. Si te piden respuestas académicas, favorece guiar el aprendizaje. Mantén las respuestas entre 80 y 260 palabras salvo que pidan más.' },
    ...history.slice(-12), { role: 'user', content: input }
  ]);
}

export async function generateFlashcardsAI(notes: string): Promise<{ front: string; back: string }[]> {
  const output = await askAI([
    { role: 'system', content: 'Convierte apuntes en entre 3 y 8 tarjetas de memoria útiles, fieles al contenido. Devuelve EXCLUSIVAMENTE un arreglo JSON válido sin markdown ni comentarios, donde cada elemento tiene las propiedades "front" (pregunta corta) y "back" (respuesta concisa), ambos textos en español. No inventes información no presente en los apuntes.' },
    { role: 'user', content: notes }
  ]);
  try {
    const match = output.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('Sin JSON');
    const parsed: unknown = JSON.parse(match[0]);
    if (!Array.isArray(parsed)) throw new Error('No es arreglo');
    const clean = parsed.filter((v): v is { front: string; back: string } => typeof v === 'object' && v !== null && typeof v.front === 'string' && typeof v.back === 'string')
      .slice(0, 8).map(v => ({ front: v.front.trim().slice(0, 250), back: v.back.trim().slice(0, 800) })).filter(v => v.front && v.back);
    if (clean.length === 0) throw new Error('Tarjetas inválidas');
    return clean;
  } catch { throw new AIUnavailableError('El modelo devolvió tarjetas en un formato inesperado. Vuelve a intentar con apuntes más claros.'); }
}
