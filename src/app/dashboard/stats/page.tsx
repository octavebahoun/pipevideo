import { prisma } from '@/lib/db';
import { Video } from '@prisma/client';
import StatsClient from '@/components/StatsClient';
import { BarChart3 } from 'lucide-react';

export const revalidate = 0;

export default async function StatsPage() {
  let videos: Video[] = [];
  try {
    videos = await prisma.video.findMany({
      where: { youtubeId: { not: null } },
      orderBy: { createdAt: 'desc' },
    });
  } catch (error) {
    console.error('Error fetching videos for stats:', error);
  }

  const statsVideos = videos.map((v) => ({
    id: v.id,
    title: v.title,
    youtubeId: v.youtubeId as string,
    createdAt: v.createdAt.toISOString(),
  }));

  return (
    <div className="p-6 md:p-12 max-w-7xl mx-auto">
      <header className="mb-10">
        <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 flex items-center gap-3">
          <BarChart3 className="w-7 h-7 text-red-500" /> Statistiques
        </h1>
        <p className="text-sm text-zinc-500 mt-1">Performance de vos vidéos publiées sur YouTube.</p>
      </header>

      <StatsClient videos={statsVideos} />
    </div>
  );
}
