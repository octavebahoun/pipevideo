import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { askOpenRouter } from '@/lib/openrouter';

function buildAnalysisPrompt(storyboard: any): string {
  const scenesSummary = (storyboard.scenes || [])
    .map((s: any, i: number) => {
      if (s.card) return `Scène ${i + 1} (carte de fin) : "${s.card.text}"`;
      return `Scène ${i + 1} : "${s.narration}"`;
    })
    .join('\n');

  const meta = storyboard.youtubeMetadata || {};

  return `Tu es un expert en création de vidéos courtes (Shorts/Reels) à forte rétention pour les réseaux sociaux.

Voici le script d'une vidéo à analyser :

Titre : ${storyboard.title}
Titre YouTube (SEO) : ${meta.title || '(non défini)'}
Description : ${meta.description || '(non définie)'}

Scènes (narration scène par scène) :
${scenesSummary}

Analyse ce script et donne un retour CONCIS et CONCRET (pas de généralités creuses) sur :
1. L'accroche (les 3 premières secondes donnent-elles envie de continuer à regarder ?)
2. Le rythme et la clarté de la narration (y a-t-il des scènes trop longues, confuses, ou redondantes ?)
3. La cohérence globale (la fin apporte-t-elle une conclusion satisfaisante ?)
4. Une suggestion d'amélioration concrète et actionnable pour chaque point faible identifié.

Réponds en français, en 150 mots maximum, format liste à puces.`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
    }

    const video = await prisma.video.findUnique({ where: { id } });
    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }
    if (!video.storyboard) {
      return NextResponse.json({ error: 'Video has no storyboard yet' }, { status: 400 });
    }

    const prompt = buildAnalysisPrompt(video.storyboard);
    const analysis = await askOpenRouter(prompt);

    return NextResponse.json({ analysis });
  } catch (error: any) {
    console.error('Error analyzing storyboard:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
