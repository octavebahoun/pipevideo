/**
 * Free OpenRouter models tend to get rate-limited unpredictably (shared pool
 * across all OpenRouter users), so we try a short list in order rather than
 * depending on a single one. Order picked from what responded reliably during
 * testing; gpt-oss-20b first (fastest, no visible "reasoning" preamble to strip).
 */
const FREE_MODELS = [
  'openai/gpt-oss-20b:free',
  'google/gemma-4-31b-it:free',
  'nvidia/nemotron-3-nano-30b-a3b:free',
];

/**
 * Sends a prompt to OpenRouter, trying each free model in FREE_MODELS until
 * one succeeds. Throws only if all of them fail (e.g. all rate-limited).
 */
export async function askOpenRouter(prompt: string): Promise<string> {
  const apiKey = process.env.OPENROUTER_URL;
  if (!apiKey) {
    throw new Error('OPENROUTER_URL is not set in .env');
  }

  let lastError = '';

  for (const model of FREE_MODELS) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        lastError = data.error?.message || `HTTP ${res.status}`;
        console.warn(`[OpenRouter] Model ${model} failed (${lastError}), trying next...`);
        continue;
      }

      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        lastError = 'Empty response';
        continue;
      }

      return content;
    } catch (err: any) {
      lastError = err?.message || String(err);
      console.warn(`[OpenRouter] Model ${model} threw (${lastError}), trying next...`);
    }
  }

  throw new Error(`All free OpenRouter models failed. Last error: ${lastError}`);
}
