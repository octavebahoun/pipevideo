import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, storyboard } = body;

    if (!id || !storyboard) {
      return NextResponse.json({ error: 'Missing id or storyboard' }, { status: 400 });
    }

    // Extract title and voice from the storyboard if they exist
    const title = storyboard.title || undefined;
    const voice = storyboard.voice || undefined;

    const updatedVideo = await prisma.video.update({
      where: { id },
      data: {
        storyboard,
        title,
        voice,
        status: 'SCRIPTED',
      },
    });

    return NextResponse.json(updatedVideo);
  } catch (error: any) {
    console.error('Error updating storyboard:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
