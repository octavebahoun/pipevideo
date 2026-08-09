import { prisma } from './db';

export async function updateProgress(progress: number, step: string) {
  const videoId = process.env.VIDEO_ID;
  if (!videoId) return;
  try {
    await prisma.video.update({
      where: { id: videoId },
      data: { progress, progressStep: step },
    });
  } catch (err) {
    console.error(`[Progress Update Error]`, err);
  }
}

export async function checkCancelled(): Promise<boolean> {
  const videoId = process.env.VIDEO_ID;
  if (!videoId) return false;
  try {
    const video = await prisma.video.findUnique({
      where: { id: videoId },
      select: { status: true },
    });
    return video?.status !== 'RENDERING';
  } catch {
    return false;
  }
}
