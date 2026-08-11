import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { askOpenRouter } from '@/lib/openrouter';

export type SceneEditAction = {
  type: 'update_scene_prompt';
  sceneId: number;
  newPrompt: string;
};

/**
 * Pulls a `{"action":"update_scene_prompt", "sceneId":N, "newPrompt":"..."}`
 * object out of the model's raw answer (the system prompt asks it to wrap
 * this in a ```json fence when — and only when — the user asked to
 * rewrite/soften a scene's visual prompt), validates it against the real
 * scene IDs of the video, and strips the JSON block out of the text shown
 * to the user. Returns the answer unchanged and no action if nothing
 * matches — the model not complying with the format degrades to a normal
 * chat reply instead of a hard failure.
 */
function extractSceneEditAction(
  rawAnswer: string,
  validSceneIds: Set<number>
): { answer: string; action: SceneEditAction | null } {
  const fenceMatch = rawAnswer.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/i);
  const candidate = fenceMatch?.[1];
  if (!candidate) {
    return { answer: rawAnswer, action: null };
  }

  try {
    const parsed = JSON.parse(candidate);
    if (
      parsed?.action === 'update_scene_prompt' &&
      typeof parsed.sceneId === 'number' &&
      typeof parsed.newPrompt === 'string' &&
      parsed.newPrompt.trim().length > 0 &&
      validSceneIds.has(parsed.sceneId)
    ) {
      const cleanedAnswer = rawAnswer.replace(fenceMatch[0], '').trim();
      return {
        answer: cleanedAnswer,
        action: { type: 'update_scene_prompt', sceneId: parsed.sceneId, newPrompt: parsed.newPrompt.trim() },
      };
    }
  } catch {
    // Not valid JSON, or not the expected shape — treat as plain text below.
  }

  return { answer: rawAnswer, action: null };
}

/**
 * Free-form question endpoint for the floating AI assistant bubble. Distinct
 * from POST /api/analyze (Lot D): /api/analyze runs a fixed structured
 * critique of a script; this route answers arbitrary questions, optionally
 * scoped to one video's storyboard for context.
 *
 * When scoped to a video (videoId set, i.e. called from the editor), the
 * assistant is also allowed to propose rewriting a scene's visual prompt —
 * handy when a media provider's content filter rejects a prompt and the
 * user just wants a more factual/neutral phrasing instead of editing it by
 * hand. See extractSceneEditAction for the response contract.
 */
export async function POST(request: Request) {
  try {
    const { question, videoId } = await request.json();

    if (!question || typeof question !== 'string') {
      return NextResponse.json({ error: 'Missing question' }, { status: 400 });
    }

    let contextBlock = '';
    let editInstructions = '';
    const validSceneIds = new Set<number>();

    if (videoId) {
      const video = await prisma.video.findUnique({ where: { id: videoId } });
      if (video?.storyboard) {
        const sb = video.storyboard as any;
        const scenesSummary = (sb.scenes || [])
          .map((s: any) => {
            if (s.card) return `Scène ${s.id} (carte de fin) : "${s.card.text}"`;
            if (typeof s.id === 'number') validSceneIds.add(s.id);
            const promptLine = s.mediaPrompt ? ` | prompt visuel actuel : "${s.mediaPrompt}"` : '';
            return `Scène ${s.id} : narration "${s.narration}"${promptLine}`;
          })
          .join('\n');
        contextBlock = `Contexte — voici le script de la vidéo "${sb.title}" dont l'utilisateur parle :\n${scenesSummary}\n\n`;

        if (validSceneIds.size > 0) {
          editInstructions =
            `\nSi (et seulement si) l'utilisateur te demande explicitement de reformuler, adoucir ou rendre plus factuel/neutre ` +
            `le prompt visuel d'une scène (par exemple parce qu'un générateur d'image/vidéo IA l'a rejeté à cause d'un filtre de ` +
            `contenu), réponds d'abord en une phrase, puis ajoute un bloc de code contenant EXACTEMENT ce JSON (rien d'autre dans ` +
            `le bloc) :\n` +
            '```json\n' +
            `{"action":"update_scene_prompt","sceneId":<id de la scène>,"newPrompt":"<nouveau prompt en ANGLAIS, même idée visuelle mais formulation neutre/factuelle>"}\n` +
            '```\n' +
            `N'utilise ce format QUE pour ce cas précis. Pour toute autre question, réponds normalement en texte libre, sans JSON.\n`;
        }
      }
    }

    const prompt =
      `Tu es un assistant spécialisé en création de vidéos courtes pour YouTube/TikTok/Reels, intégré à un outil de production ` +
      `vidéo automatisée. Réponds de façon concise et actionnable, en français.\n${editInstructions}\n${contextBlock}` +
      `Question de l'utilisateur : ${question}`;

    const rawAnswer = await askOpenRouter(prompt);
    const { answer, action } = extractSceneEditAction(rawAnswer, validSceneIds);

    return NextResponse.json({ answer, action });
  } catch (error: any) {
    console.error('Error in AI assistant:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
