import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { exec } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { activeRenders } from '@/lib/renderRegistry';
import { uploadToR2 } from '@/lib/r2';
import { notifyN8nPublish } from '@/lib/n8nPublish';
import { computeSceneCacheStatus, cleanupStaleSceneFiles, cleanupAllSceneFiles } from '@/lib/renderCache';

export async function POST(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const baseUrl = `${requestUrl.protocol}//${requestUrl.host}`;

    const body = await request.json();
    const { id, mode } = body as { id?: string; mode?: 'resume' | 'fresh' };

    if (!id) {
      return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
    }
    const renderMode: 'resume' | 'fresh' = mode === 'fresh' ? 'fresh' : 'resume';

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
      data: { 
        status: 'RENDERING',
        progress: 0,
        progressStep: 'Préparation du storyboard'
      },
    });

    // 2. Write storyboard to storyboard.json (Remotion expects it at root)
    const storyboardPath = path.join(process.cwd(), 'storyboard.json');
    const publicDir = path.join(process.cwd(), 'public');

    // Per-video snapshot of the storyboard as it was at its own last render attempt.
    // Comparing against THIS (rather than the global storyboard.json, which reflects
    // whichever video rendered last) means alternating between videos never wipes
    // one video's cached scenes just because another one rendered in between.
    const snapshotPath = path.join(publicDir, `.storyboard-snapshot-${id}.json`);
    let previousStoryboard: any = null;
    try {
      previousStoryboard = JSON.parse(await fs.readFile(snapshotPath, 'utf-8'));
    } catch (_) {}

    if (renderMode === 'fresh') {
      console.log(`[Render] Fresh render requested for video ${id}. Cleaning all scene assets...`);
      await cleanupAllSceneFiles();
    } else if (previousStoryboard === null) {
      // First-ever render attempt for this video (no snapshot exists yet). public/
      // is a single directory SHARED by every video in this app, and scene IDs
      // always restart at 1 for a brand new storyboard — so any scene_N.* files
      // sitting there right now cannot legitimately belong to this video (it has
      // never rendered before). They're leftovers from a DIFFERENT video's scenes
      // that happened to share the same scene numbers, and reusing them would
      // silently mix another video's images/audio/clips into this one. Wipe the
      // whole shared media directory before generating anything, same as a fresh
      // render would.
      console.log(
        `[Render] First render attempt for video ${id}: no prior snapshot found, so any scene_N.* files ` +
          `currently in public/ belong to a different video. Wiping the shared media directory to avoid ` +
          `reusing another video's leftover scenes...`
      );
      await cleanupAllSceneFiles();
    } else {
      const cacheStatus = await computeSceneCacheStatus(video.storyboard, previousStoryboard);
      const staleCount = cacheStatus.filter((s) => !s.audioReady || !s.mediaReady).length;
      console.log(
        `[Render] Resuming video ${id}: ${cacheStatus.length - staleCount}/${cacheStatus.length} scenes already up to date.`
      );
      await cleanupStaleSceneFiles(cacheStatus);
    }

    await fs.writeFile(snapshotPath, JSON.stringify(video.storyboard, null, 2), 'utf-8').catch(() => {});
    await fs.writeFile(storyboardPath, JSON.stringify(video.storyboard, null, 2), 'utf-8');

    // 3. Trigger rendering in the background (using asynchronous exec)
    const publicOutDir = path.join(process.cwd(), 'public/out');
    await fs.mkdir(publicOutDir, { recursive: true });

    const finalDestPath = path.join(publicOutDir, `video-${id}.mp4`);

    const isLambda = process.env.RENDER_ON_LAMBDA === 'true';
    const renderCmd = isLambda
      ? 'npm run tts && npm run novita && npm run check-video && npm run render:lambda'
      : 'npm run tts && npm run novita && npm run check-video && npm run render';

    console.log(`[Render] Starting background process for video ${id} with command: ${renderCmd}...`);

    // Run the pipeline chain
    const renderProcess = exec(renderCmd, {
      cwd: process.cwd(),
      env: { ...process.env, VIDEO_ID: id },
    });

    activeRenders.set(id, renderProcess);

    renderProcess.on('close', async (code) => {
      console.log(`[Render] Background process finished with exit code: ${code}`);
      activeRenders.delete(id);

      // Check current video status in DB before setting to FAILED (in case of manual cancellation)
      const currentVideo = await prisma.video.findUnique({ where: { id } });
      if (currentVideo?.status === 'DRAFT') {
        console.log(`[Render] Video ${id} was canceled. Skipping status update.`);
        return;
      }

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
          // 1. Retrieve the AWS S3 URL if it was generated on Lambda
          let s3Url: string | null = null;
          try {
            const s3UrlPath = path.join(process.cwd(), 'out', `s3-url-${id}.txt`);
            s3Url = await fs.readFile(s3UrlPath, 'utf-8');
            s3Url = s3Url.trim();
            await fs.unlink(s3UrlPath).catch(() => {});
          } catch (e) {
            // Not a Lambda render, or file not created
          }

          // 2. Upload to Cloudflare R2 if configured
          let r2Url: string | null = null;
          try {
            r2Url = await uploadToR2(finalDestPath, `video-${id}.mp4`);
          } catch (r2Err) {
            console.error('[Render] Failed to upload to Cloudflare R2:', r2Err);
          }
          // 3. Determine the final video URL (Priority: R2 -> AWS S3 -> Local path fallback).
          // Note: we never guess an R2 URL here — it's only used above once uploadToR2()
          // has actually confirmed the upload succeeded (r2Url). Guessing the public URL
          // when the upload failed would point n8n at a key that doesn't exist on R2.
          let finalVideoPath = `out/video-${id}.mp4`;
          let finalVideoUrl = `${baseUrl}/out/video-${id}.mp4`;
          let hasDurableStorage = false;

          if (r2Url) {
            finalVideoPath = r2Url;
            finalVideoUrl = r2Url;
            hasDurableStorage = true;
            console.log(`[Render] Final URL configured to Cloudflare R2: ${r2Url}`);
          } else if (s3Url) {
            finalVideoPath = s3Url;
            finalVideoUrl = s3Url;
            hasDurableStorage = true;
            console.log(`[Render] Final URL configured to AWS S3: ${s3Url}`);
          } else {
            const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
            if (siteUrl) {
              const cleanSiteUrl = siteUrl.endsWith('/') ? siteUrl.slice(0, -1) : siteUrl;
              finalVideoUrl = `${cleanSiteUrl}/out/video-${id}.mp4`;
            }
            console.error(
              `[Render] WARNING: video ${id} has no durable storage (R2 upload failed or not configured, ` +
                `and this is not a Lambda render). Falling back to a local URL (${finalVideoUrl}) that will ` +
                `become invalid if this server/container is redeployed or its disk is wiped.`
            );
          }

          await prisma.video.update({
            where: { id },
            data: {
              status: 'COMPLETED',
              progress: 100,
              progressStep: 'Terminé',
              videoPath: finalVideoPath,
              ...(updatedStoryboard ? { storyboard: updatedStoryboard } : {}),
            },
          });
          console.log(`[Render] Video ${id} completed successfully! Path stored in DB: ${finalVideoPath}`);

          // 4. Notify n8n for publication if N8N_PUBLISH_URL is set.
          // Skip if the video has no durable storage: the local URL would go stale
          // as soon as this server/container is redeployed, so it's not safe to hand
          // off to YouTube. The video stays COMPLETED and can be republished via
          // POST /api/publish once R2/S3 storage is fixed and a fresh render exists.
          const publishUrl = process.env.N8N_PUBLISH_URL;
          // A future scheduledFor (set in the editor) means the user chose NOT to
          // publish as soon as the render finishes — src/instrumentation.ts polls
          // for it and notifies n8n once that date is reached. Re-read from
          // currentVideo (fetched just above) rather than the `video` fetched at
          // the start of the request, since the schedule may have been set/changed
          // by the user while this render was running.
          const hasFutureSchedule = !!currentVideo?.scheduledFor && new Date(currentVideo.scheduledFor) > new Date();

          if (hasFutureSchedule) {
            console.log(
              `[Render] Video ${id} is scheduled for ${currentVideo!.scheduledFor!.toISOString()}; ` +
                `skipping immediate n8n notification. The scheduler will publish it automatically at that time.`
            );
          } else if (publishUrl && !hasDurableStorage) {
            console.error(
              `[Render] Skipping n8n notification for video ${id}: no durable storage available ` +
                `(R2/S3 upload missing or failed). Fix storage and re-render before publishing.`
            );
          } else if (publishUrl) {
            const meta = updatedStoryboard?.youtubeMetadata || (video.storyboard as any)?.youtubeMetadata || {};
            const result = await notifyN8nPublish(publishUrl, {
              videoId: id,
              status: 'COMPLETED',
              videoUrl: finalVideoUrl,
              title: meta.title || video.title || '',
              description: meta.description || '',
              tags: meta.tags || [],
              youtubeMetadata: meta,
              metadata: {
                title: meta.title || video.title || '',
                description: meta.description || '',
                tags: meta.tags || [],
              },
            });
            if (result.ok) {
              console.log(`[Render] n8n notified successfully (status ${result.status}).`);
            } else {
              console.error(
                `[Render] n8n notification failed after retries: ${result.error}. ` +
                  `Video stays COMPLETED with publishNotifiedAt=null — retry manually via POST /api/publish.`
              );
            }
          } else {
            console.log('[Render] N8N_PUBLISH_URL is not set. Skipping n8n notification.');
          }

        } catch (copyErr) {
          console.error('[Render] Error copying final video output:', copyErr);
          const checkVideo = await prisma.video.findUnique({ where: { id } });
          if (checkVideo?.status !== 'DRAFT') {
            await prisma.video.update({
              where: { id },
              data: { status: 'FAILED' },
            });
          }
        }
      } else {
        console.error(`[Render] Rendering pipeline failed for video ${id}`);
        const checkVideo = await prisma.video.findUnique({ where: { id } });
        if (checkVideo?.status !== 'DRAFT') {
          await prisma.video.update({
            where: { id },
            data: { status: 'FAILED' },
          });
        }
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
