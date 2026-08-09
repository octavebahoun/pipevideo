import { prisma } from '@/lib/db';
import DashboardClient from '@/components/DashboardClient';

// Disable caching for the dynamic dashboard page to always get the latest DB state
export const revalidate = 0;

import { Video } from '@prisma/client';

export default async function DashboardPage() {
  let videos: Video[] = [];
  try {
    videos = await prisma.video.findMany({
      orderBy: { createdAt: 'desc' },
    });
  } catch (error) {
    console.error('Error fetching videos from Prisma:', error);
  }

  // Serialize Prisma Date objects to JSON-compatible strings
  const serializedVideos = videos.map((v) => ({
    ...v,
    createdAt: v.createdAt.toISOString(),
    updatedAt: v.updatedAt.toISOString(),
    scheduledFor: v.scheduledFor ? v.scheduledFor.toISOString() : null,
  }));

  return <DashboardClient initialVideos={serializedVideos} />;
}
