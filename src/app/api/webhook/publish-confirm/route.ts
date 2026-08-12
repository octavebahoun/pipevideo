import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * Inbound callback for n8n once it has actually finished uploading a video
 * to YouTube (distinct from POST /api/publish and the scheduler in
 * src/instrumentation.ts, which only ever *trigger* n8n and stamp
 * publishNotifiedAt — neither of them knows whether the upload actually
 * succeeded or what the real YouTube video ID is).
 *
 * n8n already receives `videoId` in the payload sent by notifyN8nPublish
 * (src/lib/n8nPublish.ts) when the publish workflow is triggered — the
 * workflow should echo that same videoId back here together with the
 * YouTube video ID once the upload completes, so the video can be marked
 * PUBLISHED automatically instead of requiring a manual "Marquer comme
 * publiée" from the dashboard.
 *
 * External call, no browser session — protected by the same
 * N8N_WEBHOOK_SECRET/x-webhook-secret mechanism as /api/webhook/storyboard
 * (see src/middleware.ts).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { videoId, youtubeId, youtubeStatus } = body as {
      videoId?: string;
      youtubeId?: string;
      youtubeStatus?: string;
    };

    if (!videoId || !youtubeId) {
      return NextResponse.json({ error: 'Missing videoId or youtubeId' }, { status: 400 });
    }

    const updatedVideo = await prisma.video.update({
      where: { id: videoId },
      data: {
        status: 'PUBLISHED',
        youtubeId,
        youtubeStatus: youtubeStatus || 'PUBLIC',
      },
    });

    return NextResponse.json(updatedVideo);
  } catch (error: any) {
    console.error('Error confirming publish from n8n:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
