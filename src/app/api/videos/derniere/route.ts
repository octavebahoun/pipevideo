import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import * as fs from 'fs/promises';
import * as path from 'path';
import { computeSceneCacheStatus } from '@/lib/renderCache';

/**
 * Dernière vidéo d'une conversation Telegram, avec l'état de son cache.
 *
 *   GET /api/videos/derniere?chatId=123456
 *
 * Sert la commande `/relance` du bot : sans interface, il n'existe aucun moyen
 * de retrouver l'identifiant d'une vidéo qui a échoué. n8n appelle cette route,
 * récupère le `videoId`, puis relance `/api/render` en mode `resume`.
 *
 * Renvoie aussi `scenesPretes` : c'est ce qui permet d'annoncer dans Telegram
 * combien de médias seront réutilisés, donc si le relancement coûtera du GPU.
 */

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const chatId = searchParams.get('chatId');

    if (!chatId) {
      return NextResponse.json({ error: 'Paramètre `chatId` manquant.' }, { status: 400 });
    }

    // La plus récente, quel que soit son statut : on relance aussi bien un échec
    // qu'une vidéo terminée dont on veut refaire le montage après un réglage.
    const video = await prisma.video.findFirst({
      where: { telegramChatId: chatId },
      orderBy: { createdAt: 'desc' },
    });

    if (!video) {
      return NextResponse.json(
        { error: 'Aucune vidéo pour cette conversation.' },
        { status: 404 }
      );
    }

    let totalScenes = 0;
    let scenesPretes = 0;
    if (video.storyboard) {
      const snapshotPath = path.join(
        process.cwd(),
        'public',
        `.storyboard-snapshot-${video.id}.json`
      );
      let previousStoryboard: any = null;
      try {
        previousStoryboard = JSON.parse(await fs.readFile(snapshotPath, 'utf-8'));
      } catch {
        /* jamais rendue : aucun cache, tout sera régénéré */
      }
      const etat = await computeSceneCacheStatus(video.storyboard, previousStoryboard);
      totalScenes = etat.length;
      scenesPretes = etat.filter((s) => s.audioReady && s.mediaReady).length;
    }

    return NextResponse.json({
      videoId: video.id,
      title: video.title,
      status: video.status,
      videoPath: video.videoPath,
      createdAt: video.createdAt,
      totalScenes,
      scenesPretes,
      // Un rendu déjà en cours : le relancer lancerait un second pipeline sur les
      // mêmes fichiers, avec deux processus qui s'écrasent mutuellement.
      dejaEnCours: video.status === 'RENDERING',
    });
  } catch (error: any) {
    console.error('[Videos] Erreur /derniere :', error);
    return NextResponse.json({ error: error.message || 'Erreur interne' }, { status: 500 });
  }
}
