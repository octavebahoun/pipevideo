import { prisma } from '@/lib/db';
import { Video } from '@prisma/client';
import VideoGrid from '@/components/VideoGrid';
import { Tv } from 'lucide-react';

export const revalidate = 0;

export default async function PublishedVideosPage() {
  let videos: Video[] = [];
  try {
    videos = await prisma.video.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { createdAt: 'desc' },
    });
  } catch (error) {
    console.error('Error fetching published videos:', error);
  }

  const serializedVideos = videos.map((v) => ({
    ...v,
    createdAt: v.createdAt.toISOString(),
    updatedAt: v.updatedAt.toISOString(),
    scheduledFor: v.scheduledFor ? v.scheduledFor.toISOString() : null,
  }));

  return (
    <div className="p-6 md:p-12 max-w-7xl mx-auto">
      <header className="mb-10">
        <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 flex items-center gap-3">
          <Tv className="w-7 h-7 text-red-500" /> Vidéos publiées
        </h1>
        <p className="text-sm text-zinc-500 mt-1">Toutes les vidéos déjà en ligne sur YouTube.</p>
      </header>

      <VideoGrid
        initialVideos={serializedVideos}
        emptyTitle="Aucune vidéo publiée pour le moment"
        emptyDescription="Une fois une vidéo rendue, publiez-la depuis l'onglet « Non publiées » pour la voir apparaître ici."
      />
    </div>
  );
}
