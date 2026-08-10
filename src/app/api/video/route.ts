import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import * as fs from 'fs/promises';
import * as path from 'path';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
    }

    const video = await prisma.video.findUnique({
      where: { id },
    });

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    return NextResponse.json(video);
  } catch (error: any) {
    console.error('Error fetching video:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
    }

    await prisma.video.delete({
      where: { id },
    });

    const snapshotPath = path.join(process.cwd(), 'public', `.storyboard-snapshot-${id}.json`);
    await fs.unlink(snapshotPath).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting video:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, title, topic, voice, ratio, storyboard, status, youtubeId, youtubeStatus, scheduledFor } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
    }

    const updatedVideo = await prisma.video.update({
      where: { id },
      data: {
        title,
        topic,
        voice,
        ratio,
        storyboard,
        status,
        youtubeId,
        youtubeStatus,
        scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined,
      },
    });

    return NextResponse.json(updatedVideo);
  } catch (error: any) {
    console.error('Error updating video:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

