import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { fetchYouTubeStats } from '@/lib/youtube';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
    }

    const video = await prisma.video.findUnique({ where: { id }, select: { youtubeId: true } });
    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }
    if (!video.youtubeId) {
      return NextResponse.json({ error: 'Video has no youtubeId yet' }, { status: 400 });
    }

    const stats = await fetchYouTubeStats(video.youtubeId);
    if (!stats) {
      return NextResponse.json({ error: 'Video not found on YouTube (deleted or private)' }, { status: 404 });
    }

    return NextResponse.json(stats);
  } catch (error: any) {
    console.error('Error fetching YouTube stats:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
