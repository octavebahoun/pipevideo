import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import EditorClient from './EditorClient';

export const revalidate = 0;

interface EditorPageProps {
  params: {
    id: string;
  };
}

export default async function EditorPage({ params }: EditorPageProps) {
  const { id } = params;

  const video = await prisma.video.findUnique({
    where: { id },
  });

  if (!video) {
    notFound();
  }

  // Serialize Prisma Date objects to JSON-compatible strings
  const serializedVideo = {
    ...video,
    createdAt: video.createdAt.toISOString(),
    updatedAt: video.updatedAt.toISOString(),
    scheduledFor: video.scheduledFor ? video.scheduledFor.toISOString() : null,
  };

  return <EditorClient video={serializedVideo} />;
}
