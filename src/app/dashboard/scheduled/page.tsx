import { prisma } from '@/lib/db';
import { Video } from '@prisma/client';
import VideoGrid from '@/components/VideoGrid';
import { CalendarClock } from 'lucide-react';

export const revalidate = 0;

export default async function ScheduledVideosPage() {
  let videos: Video[] = [];
  try {
    videos = await prisma.video.findMany({
      where: { scheduledFor: { gt: new Date() } },
      orderBy: { scheduledFor: 'asc' },
    });
  } catch (error) {
    console.error('Error fetching scheduled videos:', error);
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
          <CalendarClock className="w-7 h-7 text-red-500" /> Vidéos programmées
        </h1>
        <p className="text-sm text-zinc-500 mt-1">Publication automatique déclenchée à la date choisie dans l'éditeur.</p>
      </header>

      <VideoGrid
        initialVideos={serializedVideos}
        emptyTitle="Aucune vidéo programmée"
        emptyDescription="Définissez une date de publication depuis l'éditeur d'une vidéo terminée pour la voir apparaître ici."
      />
    </div>
  );
}
