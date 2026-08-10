import { prisma } from '@/lib/db';
import { Video } from '@prisma/client';
import VideoGrid from '@/components/VideoGrid';
import CreateIdeaButton from '@/components/CreateIdeaButton';
import { Clock } from 'lucide-react';

export const revalidate = 0;

export default async function UnpublishedVideosPage() {
  let videos: Video[] = [];
  try {
    videos = await prisma.video.findMany({
      where: {
        status: { not: 'PUBLISHED' },
        OR: [{ scheduledFor: null }, { scheduledFor: { lte: new Date() } }],
      },
      orderBy: { createdAt: 'desc' },
    });
  } catch (error) {
    console.error('Error fetching unpublished videos:', error);
  }

  const serializedVideos = videos.map((v) => ({
    ...v,
    createdAt: v.createdAt.toISOString(),
    updatedAt: v.updatedAt.toISOString(),
    scheduledFor: v.scheduledFor ? v.scheduledFor.toISOString() : null,
  }));

  return (
    <div className="p-6 md:p-12 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 flex items-center gap-3">
            <Clock className="w-7 h-7 text-red-500" /> Vidéos non publiées
          </h1>
          <p className="text-sm text-zinc-500 mt-1">Brouillons, en cours de rendu, prêtes à publier ou en échec.</p>
        </div>
        <CreateIdeaButton />
      </header>

      <VideoGrid
        initialVideos={serializedVideos}
        emptyTitle="Aucune vidéo en cours"
        emptyDescription="Commencez par ajouter une nouvelle idée de vidéo pour démarrer le pipeline automatisé."
      />
    </div>
  );
}
