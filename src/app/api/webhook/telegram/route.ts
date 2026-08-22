import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * Point d'entrée de l'automatisation Telegram → n8n → pipevideo.
 *
 * Reçoit un sujet et la conversation Telegram d'origine, crée la vidéo en base
 * et rend la main AUSSITÔT. Le workflow n8n enchaîne ensuite :
 *   1. DeepSeek rédige le storyboard
 *   2. POST /api/webhook/storyboard  (dépose le script, statut SCRIPTED)
 *   3. POST /api/render              (lance runpod → tts → lambda)
 *   4. pipevideo poste vers N8N_RENDER_DONE_URL → message Telegram final
 *
 * Cette route ne déclenche PAS le rendu elle-même : sans storyboard il n'y a
 * rien à rendre, et c'est n8n qui pilote la génération du script.
 *
 * Protégée par `x-webhook-secret` (voir src/middleware.ts) : n8n appelle depuis
 * l'extérieur, sans cookie de session.
 */

/** Taille max d'un sujet. Au-delà, c'est un copier-coller accidentel. */
const TOPIC_MAX = 2000;

function titreDepuisSujet(sujet: string): string {
  // Titre provisoire : DeepSeek fournira le vrai dans le storyboard, et
  // /api/webhook/storyboard l'écrasera. Sert uniquement à ce que la vidéo soit
  // identifiable dans le dashboard entre la demande et la fin de la rédaction.
  const premiereLigne = sujet.split('\n')[0].trim();
  return premiereLigne.length > 80 ? `${premiereLigne.slice(0, 77)}...` : premiereLigne;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 });
    }

    // Tolérant sur les noms de champs : selon la façon dont le nœud Telegram
    // Trigger est branché dans n8n, le texte arrive sous `topic`, `message` ou
    // `text`. Autant les accepter tous que de casser sur un détail de câblage.
    const sujet: unknown = body.topic ?? body.message ?? body.text;
    const chatId: unknown = body.telegramChatId ?? body.chatId ?? body.chat_id;

    if (typeof sujet !== 'string' || !sujet.trim()) {
      return NextResponse.json(
        { error: 'Sujet manquant : attendu `topic` (ou `message` / `text`).' },
        { status: 400 }
      );
    }
    if (sujet.length > TOPIC_MAX) {
      return NextResponse.json(
        { error: `Sujet trop long (${sujet.length} caractères, maximum ${TOPIC_MAX}).` },
        { status: 400 }
      );
    }
    if (chatId !== undefined && chatId !== null && typeof chatId !== 'string' && typeof chatId !== 'number') {
      return NextResponse.json({ error: '`telegramChatId` doit être une chaîne ou un nombre.' }, { status: 400 });
    }

    const topic = sujet.trim();

    const video = await prisma.video.create({
      data: {
        title: titreDepuisSujet(topic),
        topic,
        status: 'DRAFT',
        // Réglages de la chaîne de méditation chrétienne : format paysage et
        // voix grave. Un storyboard peut les surcharger, mais ce sont les
        // valeurs justes par défaut sur cette branche — les défauts du schéma
        // Prisma ('george', '9:16') viennent des vidéos courtes verticales.
        voice: 'gerard',
        ratio: '16:9',
        telegramChatId: chatId === undefined || chatId === null ? null : String(chatId),
        ...(body.telegramMessageId ? { telegramMessageId: String(body.telegramMessageId) } : {}),
      },
    });

    console.log(
      `[Telegram] Vidéo ${video.id} créée depuis la conversation ${video.telegramChatId ?? '(inconnue)'} : "${topic.slice(0, 60)}"`
    );

    return NextResponse.json({
      videoId: video.id,
      status: video.status,
      title: video.title,
      topic: video.topic,
      telegramChatId: video.telegramChatId,
    });
  } catch (error: any) {
    console.error('[Telegram] Erreur webhook :', error);
    return NextResponse.json({ error: error.message || 'Erreur interne' }, { status: 500 });
  }
}
