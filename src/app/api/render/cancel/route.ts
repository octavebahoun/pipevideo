import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { activeRenders } from '@/lib/renderRegistry';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
    }

    console.log(`[Render Cancel] Requested cancellation for video ${id}`);

    // Check if we have an active process running
    const renderProcess = activeRenders.get(id);
    if (renderProcess) {
      console.log(`[Render Cancel] Found active child process with PID ${renderProcess.pid}. Killing it...`);
      // Kill the process group or process itself
      renderProcess.kill('SIGTERM');
      activeRenders.delete(id);
    } else {
      console.log(`[Render Cancel] No active child process found in registry for video ${id}.`);
    }

    // Reset video status in the database to DRAFT
    const updatedVideo = await prisma.video.update({
      where: { id },
      data: {
        status: 'DRAFT',
        progress: 0,
        progressStep: null,
      },
    });

    return NextResponse.json({ success: true, video: updatedVideo });
  } catch (error: any) {
    console.error('Error canceling video render:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
