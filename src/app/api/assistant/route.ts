import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { askOpenRouter } from '@/lib/openrouter';

/**
 * Free-form question endpoint for the floating AI assistant bubble. Distinct
 * from POST /api/analyze (Lot D): /api/analyze runs a fixed structured
 * critique of a script; this route answers arbitrary questions, optionally
 * scoped to one video's storyboard for context.
 */
export async function POST(request: Request) {
  try {
    const { question, videoId } = await request.json();

    if (!question || typeof question !== 'string') {
      return NextResponse.json({ error: 'Missing question' }, { status: 400 });
    }

    let contextBlock = '';
    if (videoId) {
      const video = await prisma.video.findUnique({ where: { id: videoId } });
      if (video?.storyboard) {
        const sb = video.storyboard as any;
        const scenesSummary = (sb.scenes || [])
          .map((s: any, i: number) => (s.card ? `Scène ${i + 1} (carte de fin) : "${s.card.text}"` : `Scène ${i + 1} : "${s.narration}"`))
          .join('\n');
        contextBlock = `Contexte — voici le script de la vidéo "${sb.title}" dont l'utilisateur parle :\n${scenesSummary}\n\n`;
      }
    }

    const prompt = `Tu es un assistant spécialisé en création de vidéos courtes pour YouTube/TikTok/Reels, intégré à un outil de production vidéo automatisée. Réponds de façon concise et actionnable, en français.\n\n${contextBlock}Question de l'utilisateur : ${question}`;

    const answer = await askOpenRouter(prompt);
    return NextResponse.json({ answer });
  } catch (error: any) {
    console.error('Error in AI assistant:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
