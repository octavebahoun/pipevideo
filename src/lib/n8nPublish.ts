import { prisma } from '@/lib/db';

export type PublishPayload = {
  videoId: string;
  status: 'COMPLETED';
  videoUrl: string;
  title: string;
  description: string;
  tags: string[];
  youtubeMetadata: Record<string, any>;
  metadata?: Record<string, any>;
};

/**
 * Notifies the n8n publish webhook, retrying transient failures with backoff.
 * On a 2xx response, stamps `publishNotifiedAt` in DB so stuck/never-notified
 * videos (n8n down, DNS issue, etc.) can be found later with a simple query
 * (`status = 'COMPLETED' AND publishNotifiedAt IS NULL`) and re-triggered via
 * POST /api/publish, which reuses this same function.
 */
export async function notifyN8nPublish(
  publishUrl: string,
  payload: PublishPayload,
  attempts = 3
): Promise<{ ok: boolean; status?: number; error?: string }> {
  let lastError = '';
  let lastStatus: number | undefined;

  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetch(publishUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      lastStatus = res.status;

      if (res.ok) {
        await prisma.video.update({
          where: { id: payload.videoId },
          data: { publishNotifiedAt: new Date() },
        });
        return { ok: true, status: res.status };
      }

      lastError = `n8n webhook responded with status ${res.status}`;
    } catch (err: any) {
      lastError = err?.message || String(err);
    }

    if (i < attempts) {
      const delay = 2000 * 2 ** (i - 1); // 2s, 4s
      console.warn(`[n8n Publish] Attempt ${i}/${attempts} failed (${lastError}), retrying in ${delay / 1000}s...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  console.error(`[n8n Publish] Giving up after ${attempts} attempts for video ${payload.videoId}: ${lastError}`);
  return { ok: false, status: lastStatus, error: lastError };
}
