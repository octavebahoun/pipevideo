import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { exec } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';

export async function POST(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const baseUrl = `${requestUrl.protocol}//${requestUrl.host}`;

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

    if (!video.storyboard) {
      return NextResponse.json({ error: 'Video does not have a storyboard yet' }, { status: 400 });
    }

    // 1. Update status to RENDERING in DB
    const updatedVideo = await prisma.video.update({
      where: { id },
      data: { status: 'RENDERING' },
    });

    // 2. Write storyboard to storyboard.json (Remotion expects it at root)
    const storyboardPath = path.join(process.cwd(), 'storyboard.json');
    await fs.writeFile(storyboardPath, JSON.stringify(video.storyboard, null, 2), 'utf-8');

    // 3. Trigger rendering in the background (using asynchronous exec)
    const publicOutDir = path.join(process.cwd(), 'public/out');
    await fs.mkdir(publicOutDir, { recursive: true });

    const finalDestPath = path.join(publicOutDir, `video-${id}.mp4`);

    const isLambda = process.env.RENDER_ON_LAMBDA === 'true';
    const renderCmd = isLambda
      ? 'npm run novita && npm run tts && npm run check-video && npm run render:lambda'
      : 'npm run novita && npm run tts && npm run check-video && npm run render';

    console.log(`[Render] Starting background process for video ${id} with command: ${renderCmd}...`);

    // Run the pipeline chain
    const renderProcess = exec(renderCmd, {
      cwd: process.cwd(),
      env: { ...process.env },
    });

    renderProcess.on('close', async (code) => {
      console.log(`[Render] Background process finished with exit code: ${code}`);

      if (code === 0) {
        try {
          // Copy rendered file from out/video.mp4 to public/out/video-[id].mp4
          const renderedFile = path.join(process.cwd(), 'out/video.mp4');
          await fs.copyFile(renderedFile, finalDestPath);

          // Read updated storyboard.json to save any changes (e.g. Novita mediaPaths, TTS timings, etc.) back to DB
          let updatedStoryboard = null;
          try {
            const content = await fs.readFile(storyboardPath, 'utf-8');
            updatedStoryboard = JSON.parse(content);
          } catch (readErr) {
            console.error('[Render] Failed to read updated storyboard.json after success:', readErr);
          }

          // Update database to COMPLETED
          await prisma.video.update({
            where: { id },
            data: {
              status: 'COMPLETED',
              videoPath: `out/video-${id}.mp4`, // accessible via Next.js public directory
              ...(updatedStoryboard ? { storyboard: updatedStoryboard } : {}),
            },
          });
          console.log(`[Render] Video ${id} completed successfully! Path: public/out/video-${id}.mp4`);

          // 4. Notify n8n for publication if N8N_PUBLISH_URL is set
          const publishUrl = process.env.N8N_PUBLISH_URL;
          if (publishUrl) {
            console.log(`[Render] Notifying n8n at ${publishUrl}...`);
            try {
               const fs = require('fs');
               const path = require('path');
               const videoFilePath = path.join(process.cwd(), 'public', 'out', `video-${id}.mp4`);
               const fileExists = fs.existsSync(videoFilePath);
               const videoUrl = fileExists 
                 ? `${baseUrl}/out/video-${id}.mp4`
                 : `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4`;

               const meta = updatedStoryboard?.youtubeMetadata || (video.storyboard as any)?.youtubeMetadata || {};
               const payload = {
                 videoId: id,
                 status: 'COMPLETED',
                 videoUrl,
                 title: meta.title || video.title || '',
                 description: meta.description || '',
                 tags: meta.tags || [],
                 youtubeMetadata: meta,
               };
              
              const notifyRes = await fetch(publishUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
              });
              console.log(`[Render] n8n notified. Response status: ${notifyRes.status}`);
            } catch (notifyErr: any) {
              console.error(`[Render] Failed to notify n8n:`, notifyErr.message || notifyErr);
            }
          } else {
            console.log('[Render] N8N_PUBLISH_URL is not set. Skipping n8n notification.');
          }

        } catch (copyErr) {
          console.error('[Render] Error copying final video output:', copyErr);
          await prisma.video.update({
            where: { id },
            data: { status: 'FAILED' },
          });
        }
      } else {
        console.error(`[Render] Rendering pipeline failed for video ${id}`);
        await prisma.video.update({
          where: { id },
          data: { status: 'FAILED' },
        });
      }
    });

    // Handle stdio logging if running in dev mode
    renderProcess.stdout?.on('data', (data) => console.log(`[Render stdout] ${data}`));
    renderProcess.stderr?.on('data', (data) => console.error(`[Render stderr] ${data}`));

    return NextResponse.json(updatedVideo);
  } catch (error: any) {
    console.error('Error triggering video render:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
