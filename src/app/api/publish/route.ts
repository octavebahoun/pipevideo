import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { notifyN8nPublish } from '@/lib/n8nPublish';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
    }

    const video = await prisma.video.findUnique({
      where: { id },
    });

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 444 });
    }

    if (video.status !== 'COMPLETED' && video.status !== 'PUBLISHED') {
      return NextResponse.json({ error: 'Video is not completed' }, { status: 400 });
    }

    const publishUrl = process.env.N8N_PUBLISH_URL;
    if (!publishUrl) {
      return NextResponse.json({ error: 'N8N_PUBLISH_URL is not set in .env' }, { status: 500 });
    }

    // Extract storyboard metadata
    const storyboard = video.storyboard as any;
    const youtubeMetadata = storyboard?.youtubeMetadata || {};

    const videoUrl = video.videoPath;
    if (!videoUrl || !videoUrl.startsWith('http')) {
      return NextResponse.json(
        { error: 'Video has no valid stored URL (videoPath is missing or not a public URL). Refusing to publish to avoid sending a placeholder video.' },
        { status: 409 }
      );
    }

    const payload = {
      videoId: id,
      status: 'COMPLETED' as const,
      videoUrl,
      title: youtubeMetadata.title || video.title || '',
      description: youtubeMetadata.description || '',
      tags: youtubeMetadata.tags || [],
      youtubeMetadata,
    };

    console.log(`[Publish] Manually triggering publication to n8n at ${publishUrl}...`);

    const result = await notifyN8nPublish(publishUrl, payload);

    if (!result.ok) {
      return NextResponse.json(
        { error: `n8n webhook failed after retries: ${result.error}` },
        { status: result.status || 502 }
      );
    }

    return NextResponse.json({ success: true, message: 'Notification sent to n8n' });
  } catch (error: any) {
    console.error('Error publishing video:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
