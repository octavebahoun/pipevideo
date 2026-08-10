const SCHEDULED_PUBLISH_CHECK_INTERVAL_MS = 60_000;

/**
 * Publishes every COMPLETED video whose scheduledFor time has passed and
 * hasn't been notified to n8n yet. Runs on a plain in-memory interval — no
 * external cron is set up in this container, and the server runs with
 * restart:always, so this is "good enough" scheduling without extra infra.
 * A missed check (server down at the exact scheduled minute) just means the
 * video publishes on the next check after the server comes back up, since
 * the query is `scheduledFor <= now`, not `scheduledFor == now`.
 */
async function checkScheduledPublications() {
  const { prisma } = await import('@/lib/db');
  const { notifyN8nPublish } = await import('@/lib/n8nPublish');

  const dueVideos = await prisma.video.findMany({
    where: {
      status: 'COMPLETED',
      scheduledFor: { lte: new Date() },
      publishNotifiedAt: null,
    },
  });

  for (const video of dueVideos) {
    if (!video.videoPath || !video.videoPath.startsWith('http')) {
      console.error(
        `[Scheduler] Skipping scheduled publish for video ${video.id}: no valid stored URL ` +
          `(videoPath is missing or not public). Fix storage before it can be published.`
      );
      continue;
    }

    const publishUrl = process.env.N8N_PUBLISH_URL;
    if (!publishUrl) {
      console.error(`[Scheduler] Cannot publish video ${video.id}: N8N_PUBLISH_URL is not set.`);
      continue;
    }

    const meta = (video.storyboard as any)?.youtubeMetadata || {};
    console.log(`[Scheduler] Publishing scheduled video ${video.id} (was due at ${video.scheduledFor?.toISOString()})...`);
    const result = await notifyN8nPublish(publishUrl, {
      videoId: video.id,
      status: 'COMPLETED',
      videoUrl: video.videoPath,
      title: meta.title || video.title || '',
      description: meta.description || '',
      tags: meta.tags || [],
      youtubeMetadata: meta,
    });

    if (result.ok) {
      console.log(`[Scheduler] Video ${video.id} published successfully (status ${result.status}).`);
    } else {
      console.error(`[Scheduler] Failed to publish scheduled video ${video.id}: ${result.error}`);
    }
  }
}

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return;
  }

  const { prisma } = await import('@/lib/db');

  // activeRenders is an in-memory Map: it is always empty right after a server
  // restart, even if a render was genuinely in progress when the process died.
  // Any video still marked RENDERING at boot has no chance of ever completing
  // (its ChildProcess and 'close' callback are gone), so it would otherwise
  // stay stuck forever. Mark those as FAILED so they're visible and re-triggerable.
  try {
    const { count } = await prisma.video.updateMany({
      where: { status: 'RENDERING' },
      data: {
        status: 'FAILED',
        progressStep: 'Échec : rendu interrompu par un redémarrage du serveur',
      },
    });

    if (count > 0) {
      console.log(`[Startup] Marked ${count} stale RENDERING video(s) as FAILED after server restart.`);
    }
  } catch (err) {
    console.error('[Startup] Failed to clean up stale RENDERING videos:', err);
  }

  setInterval(() => {
    checkScheduledPublications().catch((err) => {
      console.error('[Scheduler] Error while checking scheduled publications:', err);
    });
  }, SCHEDULED_PUBLISH_CHECK_INTERVAL_MS);
}
