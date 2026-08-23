import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { exec } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { activeRenders } from '@/lib/renderRegistry';
import { uploadToR2 } from '@/lib/r2';
import { notifyN8nPublish } from '@/lib/n8nPublish';
import { notifyN8nRender } from '@/lib/n8nNotify';
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

    // Deux générateurs de médias possibles. `runpod` (défaut sur cette branche)
    // produit les images Flux et les clips Wan sur un GPU loué, et les dépose
    // directement sur R2 ; `novita` appelle une API externe et écrit en local.
    const generateur = process.env.MEDIA_PROVIDER === 'novita' ? 'npm run novita' : 'npm run runpod';

    // L'ORDRE EST CONTRAINT, ne pas réarranger :
    //   voice:fx AVANT check-video — la réverbération allonge chaque piste
    //     (~45 ms), et check-video calcule les ralentis sur les durées finales.
    //   sync:r2 AVANT render:lambda — Lambda lit les médias par URL ; un fichier
    //     absent de R2 fait échouer le rendu après plusieurs minutes.
    const etapes = [
      // EN PREMIER, avant toute dépense : vérifie la musique et les sons de
      // scène, que le pipeline ne sait pas générer. sync:r2 refait ce contrôle,
      // mais lui n'intervient qu'après la location du GPU — un fichier absent
      // faisait payer toute la génération avant d'échouer.
      'npm run preflight',
      generateur,
      'npm run tts',
      'npm run voice:fx',
      'npm run check-video',
      ...(isLambda ? ['npm run sync:r2', 'npm run render:lambda'] : ['npm run render']),
    ];
    const renderCmd = etapes.join(' && ');

    console.log(`[Render] Starting background process for video ${id} with command: ${renderCmd}...`);

    // Chronomètre affiché dans le message Telegram final : sur un pipeline de
    // 20 à 40 min, c'est la première chose qu'on regarde pour juger d'une dérive.
    const debutPipeline = Date.now();

    // `id` est garanti non nul par le garde en tête de fonction, mais ce
    // narrowing ne survit pas dans le callback `on('close')` ci-dessous — d'où
    // cette constante, plutôt qu'un `!` à chaque usage.
    const videoId: string = id;

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

          // 5. Prévenir n8n que la vidéo est prête, pour qu'il poste l'URL dans
          // Telegram. Séparé de la notification de publication ci-dessus : ici on
          // annonce seulement qu'il y a quelque chose à valider.
          const doneUrl = process.env.N8N_RENDER_DONE_URL;
          if (doneUrl) {
            const meta = updatedStoryboard?.youtubeMetadata || (video.storyboard as any)?.youtubeMetadata || {};
            const res = await notifyN8nRender(doneUrl, {
              videoId,
              status: 'COMPLETED',
              telegramChatId: currentVideo?.telegramChatId ?? video.telegramChatId,
              telegramMessageId: currentVideo?.telegramMessageId ?? video.telegramMessageId,
              videoUrl: finalVideoUrl,
              title: meta.title || video.title || '',
              durationSeconds: Math.round((Date.now() - debutPipeline) / 1000),
              youtubeMetadata: meta,
            });
            console.log(
              res.ok
                ? `[Render] n8n prévenu : vidéo ${id} prête (${finalVideoUrl}).`
                : `[Render] Notification n8n échouée pour ${id} — la vidéo reste accessible dans le dashboard.`
            );
          }

        } catch (copyErr: any) {
          console.error('[Render] Error copying final video output:', copyErr);
          await marquerEchec(`Rendu terminé mais récupération du fichier impossible : ${copyErr?.message || copyErr}`);
        }
      } else {
        console.error(`[Render] Rendering pipeline failed for video ${id}`);
        await marquerEchec(`Le pipeline a échoué (code ${code}). Voir les logs du serveur.`);
      }

      /**
       * Passe la vidéo en FAILED et prévient Telegram.
       *
       * Notifier l'échec compte autant que le succès : le pipeline dure 20 à
       * 40 min, et sans message l'utilisateur attend indéfiniment une vidéo qui
       * ne viendra pas. Un statut DRAFT signale une annulation manuelle — dans
       * ce cas on ne touche à rien et on n'envoie aucun message.
       */
      async function marquerEchec(raison: string) {
        const checkVideo = await prisma.video.findUnique({ where: { id } });
        if (checkVideo?.status === 'DRAFT') {
          console.log(`[Render] Vidéo ${id} annulée — pas de notification d'échec.`);
          return;
        }

        await prisma.video.update({
          where: { id },
          data: { status: 'FAILED', progressStep: 'Échec' },
        });

        const doneUrl = process.env.N8N_RENDER_DONE_URL;
        if (!doneUrl) return;

        await notifyN8nRender(doneUrl, {
          videoId,
          status: 'FAILED',
          // `checkVideo` vient d'être relu : il porte le chatId même s'il a été
          // renseigné après le début du rendu.
          telegramChatId: checkVideo?.telegramChatId ?? null,
          telegramMessageId: checkVideo?.telegramMessageId ?? null,
          title: checkVideo?.title ?? '',
          durationSeconds: Math.round((Date.now() - debutPipeline) / 1000),
          error: raison,
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
