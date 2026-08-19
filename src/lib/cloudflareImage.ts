import * as fs from 'fs/promises';

/**
 * Génération d'images via Cloudflare Workers AI (Flux-1 schnell).
 *
 * Extrait de src/novita.ts pour être partagé avec src/runpod.ts : les images de
 * départ de l'image-to-video sont produites ici plutôt que sur le GPU RunPod.
 * Ça évite d'embarquer 17 Go de Flux sur le pod et ça raccourcit le setup.
 */

export type Ratio = '9:16' | '16:9';

/**
 * Indication de cadrage injectée dans le prompt.
 *
 * Depuis août 2026, l'API Cloudflare REFUSE `width`/`height`/`num_steps` et
 * renvoie systématiquement du 1024x1024 (JPEG). On ne peut donc plus imposer
 * les dimensions : on oriente la composition par le texte, et le recadrage au
 * ratio final est fait en aval (node ImageScale `crop: center` côté ComfyUI,
 * `object-fit: cover` côté Remotion).
 */
function framingHint(ratio: Ratio): string {
  return ratio === '16:9'
    ? 'wide horizontal composition, subject centered, generous headroom, nothing important near the top or bottom edges'
    : 'vertical composition, subject centered, nothing important near the left or right edges';
}

/** Récupère les identifiants Cloudflare, ou null si non configurés. */
export function cloudflareCredentials(): { accountId: string; apiToken: string } | null {
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.R2_ACCOUNT_ID;
  if (!apiToken || !accountId) return null;
  return { accountId: accountId.trim(), apiToken };
}

/**
 * Génère une image et l'écrit sur le disque.
 * `label` ne sert qu'aux logs (numéro de scène le plus souvent).
 */
export async function generateImage(
  label: string | number,
  prompt: string,
  ratio: Ratio,
  destPath: string
): Promise<void> {
  const creds = cloudflareCredentials();
  if (!creds) {
    throw new Error('CLOUDFLARE_API_TOKEN ou R2_ACCOUNT_ID absent de .env');
  }

  const model = '@cf/black-forest-labs/flux-1-schnell';
  const url = `https://api.cloudflare.com/client/v4/accounts/${creds.accountId}/ai/run/${model}`;
  const fullPrompt = `${prompt}, ${framingHint(ratio)}`;

  console.log(`[Cloudflare AI] Image ${label} : ${prompt.slice(0, 70)}...`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${creds.apiToken}`,
    },
    // NE PAS ajouter width/height/num_steps : l'API les rejette (erreur 5006).
    body: JSON.stringify({ prompt: fullPrompt, steps: 4 }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Cloudflare Workers AI a échoué (${response.status}) : ${errorText.slice(0, 300)}`);
  }

  // L'API renvoie soit du JSON avec l'image en base64, soit les octets bruts.
  const contentType = response.headers.get('content-type') || '';
  let buffer: Buffer;

  if (contentType.includes('application/json')) {
    const json = await response.json();
    const base64Image = json.result?.image || json.image;
    if (!base64Image) {
      throw new Error(`Image absente de la réponse Cloudflare : ${JSON.stringify(json).slice(0, 300)}`);
    }
    buffer = Buffer.from(base64Image, 'base64');
  } else {
    buffer = Buffer.from(await response.arrayBuffer());
  }

  if (buffer.length === 0) throw new Error(`Image ${label} générée vide`);

  await fs.writeFile(destPath, buffer);
  console.log(`[Cloudflare AI] Image ${label} → ${destPath} (${(buffer.length / 1e3).toFixed(0)} ko)`);
}
