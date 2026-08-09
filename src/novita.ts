import 'dotenv/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { loadStoryboard } from './storyboard';
import { updateProgress, checkCancelled } from './lib/progressHelper';
import { prisma } from './lib/db';

const STORYBOARD_PATH = path.join(process.cwd(), 'storyboard.json');
const MEDIA_DIR = path.join(process.cwd(), 'public');

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function downloadFile(url: string, destPath: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download file from ${url}: ${response.statusText}`);
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  await fs.writeFile(destPath, buffer);
}

async function saveStoryboardState(storyboard: any): Promise<void> {
  // Enregistrer localement pour Remotion
  await fs.writeFile(STORYBOARD_PATH, JSON.stringify(storyboard, null, 2), 'utf-8');

  // Enregistrer en base de données pour la reprise en cas de crash/relance
  const videoId = process.env.VIDEO_ID;
  if (videoId) {
    try {
      await prisma.video.update({
        where: { id: videoId },
        data: { storyboard: storyboard as any },
      });
      console.log(`[Media Gen] Storyboard mis à jour en base de données pour la vidéo ${videoId}`);
    } catch (err: any) {
      console.error(`[Media Gen] Erreur lors de la mise à jour du storyboard en base :`, err.message);
    }
  }
}

async function generateImageWithCloudflare(
  sceneId: number,
  prompt: string,
  ratio: '9:16' | '16:9',
  accountId: string,
  apiToken: string,
  destPath: string
): Promise<void> {
  const model = '@cf/black-forest-labs/flux-1-schnell';
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId.trim()}/ai/run/${model}`;

  // Dimensions based on ratio
  let width = 768;
  let height = 1344;
  if (ratio === '16:9') {
    width = 1344;
    height = 768;
  }

  const body = {
    prompt,
    width,
    height,
    num_steps: 4
  };

  console.log(`[Cloudflare AI] Génération d'image pour Scène ${sceneId} via ${model} (${width}x${height})...`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiToken}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Cloudflare Workers AI image generation failed: ${response.statusText} - ${errorText}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const json = await response.json();
    const base64Image = json.result?.image || json.image;
    if (!base64Image) {
      throw new Error(`Failed to find image in Cloudflare JSON response: ${JSON.stringify(json)}`);
    }
    const buffer = Buffer.from(base64Image, 'base64');
    await fs.writeFile(destPath, buffer);
  } else {
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await fs.writeFile(destPath, buffer);
  }

  console.log(`[Cloudflare AI] Scène ${sceneId} : Image générée et enregistrée dans ${destPath}`);
}

async function submitVideoTaskForScene(
  sceneId: number,
  prompt: string,
  ratio: '9:16' | '16:9',
  apiKey: string,
  targetDuration?: number
): Promise<string> {
  const model = process.env.NOVITA_MODEL || 'seedance-v1.5-pro-t2v';
  const resolution = process.env.NOVITA_RESOLUTION || '480p';
  const url = `https://api.novita.ai/v3/async/${model}`;

  // Calculate dynamic duration between 4 and 12 seconds
  let duration = 5;
  if (targetDuration) {
    duration = Math.max(4, Math.min(12, Math.ceil(targetDuration)));
  }

  const body = {
    prompt,
    fps: 24,
    seed: 42,
    ratio: ratio,
    duration: duration,
    resolution: resolution,
    watermark: false,
    camera_fixed: false,
    service_tier: 'default',
    generate_audio: false,
    execution_expires_after: 172800
  };

  console.log(`[Novita] Soumission du prompt pour Scène ${sceneId} via le modèle "${model}" (${resolution}), durée demandée: ${duration}s : "${prompt}"...`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Novita T2V submission failed for model ${model}: ${response.statusText} - ${errorText}`);
  }

  const submitData = await response.json();
  const taskId = submitData.task_id;
  if (!taskId) {
    throw new Error(`No task_id returned from Novita submission: ${JSON.stringify(submitData)}`);
  }

  console.log(`[Novita] Scène ${sceneId} : tâche soumise avec succès. Task ID : ${taskId}`);
  return taskId;
}

async function pollVideoTask(
  sceneId: number,
  taskId: string,
  apiKey: string
): Promise<string> {
  let attempts = 0;
  while (attempts < 60) {
    if (await checkCancelled()) {
      throw new Error('CANCELLED');
    }

    const statusRes = await fetch(`https://api.novita.ai/v3/async/task-result?task_id=${taskId}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    if (!statusRes.ok) {
      console.warn(`[Novita] Échec de la vérification de la tâche ${taskId}: ${statusRes.statusText}`);
      await new Promise(r => setTimeout(r, 5000));
      attempts++;
      continue;
    }

    const statusData = await statusRes.json();
    const task = statusData.payload?.task || statusData.task;
    const status = task?.status;

    if (status === 'TASK_STATUS_SUCCEED') {
      const videos = statusData.payload?.videos || statusData.videos;
      const videoUrl = videos?.[0]?.video_url;
      if (!videoUrl) {
        throw new Error(`Video URL not found in payload: ${JSON.stringify(statusData)}`);
      }
      console.log(`[Novita] Scène ${sceneId} terminée ! URL : ${videoUrl}`);
      return videoUrl;
    }

    if (status === 'TASK_STATUS_FAILED') {
      throw new Error(`Task failed: ${task?.reason || 'Reason unknown'}`);
    }

    // Still processing
    const progress = task?.progress_percent ?? 0;
    console.log(`[Novita] Scène ${sceneId} en cours de génération... (Progrès : ${progress}%)`);
    await new Promise(r => setTimeout(r, 6000));
    attempts++;
  }

  throw new Error(`Timeout waiting for video generation of Scene ${sceneId}`);
}

async function main() {
  const apiKey = process.env.NOVITA_API_KEY;
  const cfToken = process.env.CLOUDFLARE_API_TOKEN;
  const cfAccount = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.R2_ACCOUNT_ID;

  if (!apiKey && !cfToken) {
    console.log('⚠️ Ni NOVITA_API_KEY ni CLOUDFLARE_API_TOKEN n\'est configurée dans .env. Génération de médias passée.');
    process.exit(0);
  }

  try {
    if (await checkCancelled()) {
      console.log('[Media Gen] Annulation détectée. Arrêt.');
      process.exit(0);
    }
    await updateProgress(5, 'Génération des médias IA (Novita / Cloudflare Workers AI)...');

    const storyboard = await loadStoryboard(STORYBOARD_PATH);
    console.log(`[Media Gen] Début de la génération de médias pour le storyboard : "${storyboard.title}"`);

    // Phase 1 : Soumission séquentielle (et génération synchrone pour les images Cloudflare Workers AI)
    let storyboardChanged = false;
    for (const scene of storyboard.scenes) {
      if (scene.card) continue; // Pas de média pour les cartes texte

      const mediaPathVal = scene.mediaPath;
      let mediaFiles: string[] = [];
      if (!mediaPathVal) {
        mediaFiles = [`scene_${scene.id}.mp4`];
      } else if (Array.isArray(mediaPathVal)) {
        mediaFiles = mediaPathVal;
      } else {
        mediaFiles = [mediaPathVal];
      }

      for (const file of mediaFiles) {
        const isImage = file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg');
        const mediaFullPath = path.join(MEDIA_DIR, file);

        // Si le fichier média existe déjà localement, on le réutilise pour économiser le budget API
        if (await fileExists(mediaFullPath)) {
          console.log(`[Media Gen] Scène ${scene.id} : Média ${file} déjà existant localement. Réutilisation.`);
          continue;
        }

        if (isImage) {
          if (!cfToken || !cfAccount) {
            console.warn(`[Media Gen] ⚠️ Scène ${scene.id} demande une image (${file}), mais CLOUDFLARE_API_TOKEN ou R2_ACCOUNT_ID n'est pas configuré. Ignorée.`);
            continue;
          }

          if (await checkCancelled()) {
            console.log('[Media Gen] Annulation détectée.');
            process.exit(0);
          }

          const prompt = scene.mediaPrompt || `Cinematic visual for ${scene.narration}`;
          try {
            await generateImageWithCloudflare(
              scene.id,
              prompt,
              storyboard.ratio || '9:16',
              cfAccount,
              cfToken,
              mediaFullPath
            );
            
            // Si on avait un novitaTaskId résiduel, on le nettoie
            if (scene.novitaTaskId) delete scene.novitaTaskId;
            
            // Mettre à jour le mediaPath de la scène pour s'assurer que c'est renseigné
            if (!scene.mediaPath) {
              scene.mediaPath = file;
            }
            storyboardChanged = true;
            await saveStoryboardState(storyboard);
          } catch (err: any) {
            console.error(`[Media Gen] Erreur lors de la génération de l'image de la Scène ${scene.id} (${file}) :`, err.message);
            throw err;
          }
        } else {
          // C'est une vidéo (.mp4)
          if (!apiKey) {
            console.warn(`[Media Gen] ⚠️ Scène ${scene.id} demande une vidéo (${file}), mais NOVITA_API_KEY n'est pas configuré. Ignorée.`);
            continue;
          }

          // Si la tâche n'a pas de novitaTaskId ni de mediaPath, cela signifie que la scène doit être régénérée.
          // Dans ce cas, on supprime tout média local existant pour forcer la soumission à Novita.
          if (!scene.novitaTaskId && !scene.mediaPath) {
            if (await fileExists(mediaFullPath)) {
              console.log(`[Novita] Nettoyage du fichier média local existant pour Scène ${scene.id} (pas de task ID ni de mediaPath)...`);
              await fs.unlink(mediaFullPath).catch(() => {});
            }
          }

          // Si le fichier média existe déjà localement, on continue
          if (await fileExists(mediaFullPath)) {
            continue;
          }

          // Si la tâche n'a pas encore de Task ID Novita, on la soumet
          if (!scene.novitaTaskId) {
            if (await checkCancelled()) {
              console.log('[Novita] Annulation détectée.');
              process.exit(0);
            }
            const prompt = scene.mediaPrompt || `Cinematic visual for ${scene.narration}`;
            try {
              const taskId = await submitVideoTaskForScene(
                scene.id,
                prompt,
                storyboard.ratio || '9:16',
                apiKey,
                scene.durationInSeconds
              );
              scene.novitaTaskId = taskId;
              if (!scene.mediaPath) {
                scene.mediaPath = file;
              }
              storyboardChanged = true;
              await saveStoryboardState(storyboard);
            } catch (err: any) {
              console.error(`[Novita] Erreur lors de la soumission de la Scène ${scene.id} :`, err.message);
              throw err;
            }
          } else {
            console.log(`[Novita] Scène ${scene.id} : Réutilisation de la tâche active (Task ID : ${scene.novitaTaskId})`);
          }
        }
      }
    }

    // Phase 2 : Polling et Téléchargement en parallèle (uniquement pour les vidéos)
    const generationTasks: Promise<void>[] = [];
    const scenesToGenerate = storyboard.scenes.filter((s: any) => {
      if (s.card) return false;
      const mediaPathVal = s.mediaPath;
      let mediaFiles: string[] = [];
      if (!mediaPathVal) {
        mediaFiles = [`scene_${s.id}.mp4`];
      } else if (Array.isArray(mediaPathVal)) {
        mediaFiles = mediaPathVal;
      } else {
        mediaFiles = [mediaPathVal];
      }
      return mediaFiles.some((file: string) => !(file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg')));
    });
    const totalScenes = scenesToGenerate.length;

    // Compter le nombre de scènes vidéo déjà prêtes
    let completedScenes = 0;
    for (const scene of scenesToGenerate) {
      const mediaPathVal = scene.mediaPath;
      let mediaFiles: string[] = [];
      if (!mediaPathVal) {
        mediaFiles = [`scene_${scene.id}.mp4`];
      } else if (Array.isArray(mediaPathVal)) {
        mediaFiles = mediaPathVal;
      } else {
        mediaFiles = [mediaPathVal];
      }
      
      let allReady = true;
      for (const file of mediaFiles) {
        const mediaFullPath = path.join(MEDIA_DIR, file);
        if (!(await fileExists(mediaFullPath))) {
          allReady = false;
          break;
        }
      }
      if (allReady) {
        completedScenes++;
      }
    }

    for (const scene of storyboard.scenes) {
      if (scene.card) continue;

      const mediaPathVal = scene.mediaPath;
      let mediaFiles: string[] = [];
      if (!mediaPathVal) {
        mediaFiles = [`scene_${scene.id}.mp4`];
      } else if (Array.isArray(mediaPathVal)) {
        mediaFiles = mediaPathVal;
      } else {
        mediaFiles = [mediaPathVal];
      }

      const hasVideo = mediaFiles.some((file: string) => !(file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg')));
      if (!hasVideo) {
        continue;
      }

      const videoFile = mediaFiles.find((file: string) => !(file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg')));
      if (!videoFile) continue;

      const mediaFullPath = path.join(MEDIA_DIR, videoFile);

      // Si le média existe déjà, pas besoin de poll
      if (await fileExists(mediaFullPath)) {
        continue;
      }

      const taskId = scene.novitaTaskId;
      if (!taskId) continue;

      const task = (async () => {
        try {
          if (await checkCancelled()) {
            console.log('[Novita] Annulation détectée.');
            process.exit(0);
          }

          console.log(`[Novita] Récupération du résultat de la Scène ${scene.id} (Task ID : ${taskId})...`);
          const videoUrl = await pollVideoTask(scene.id, taskId, apiKey!);

          if (await checkCancelled()) {
            console.log('[Novita] Annulation détectée.');
            process.exit(0);
          }

          console.log(`[Novita] Téléchargement de la vidéo pour Scène ${scene.id}...`);
          await downloadFile(videoUrl, mediaFullPath);
          console.log(`[Novita] Téléchargement réussi pour Scène ${scene.id} -> public/${videoFile}`);
          
          // Mettre à jour le storyboard local
          if (!scene.mediaPath) {
            scene.mediaPath = videoFile;
          }
          // Supprimer le Task ID temporaire une fois téléchargé
          delete scene.novitaTaskId;

          completedScenes++;
          const percent = Math.min(5 + Math.round((completedScenes / totalScenes) * 35), 40);
          await updateProgress(percent, `Vidéos IA générées : ${completedScenes}/${totalScenes}`);
        } catch (err: any) {
          if (err.message === 'CANCELLED') {
            process.exit(0);
          }
          console.error(`[Novita] Erreur lors du polling/téléchargement de la Scène ${scene.id} :`, err.message);
          throw err;
        }
      })();

      generationTasks.push(task);
    }

    if (generationTasks.length === 0) {
      console.log('[Media Gen] Tous les médias (vidéos et images) sont déjà prêtes ou non requis.');
      await updateProgress(40, 'Médias IA prêts (déjà en cache)');
      // S'assurer de sauvegarder le storyboard une dernière fois par sécurité
      await saveStoryboardState(storyboard);
      process.exit(0);
    }

    console.log(`[Novita] Attente en parallèle de ${generationTasks.length} tâches de génération...`);
    await Promise.all(generationTasks);

    // Enregistrer le storyboard final mis à jour sans les ID de tâches temporaires
    await saveStoryboardState(storyboard);
    console.log('[Media Gen] ✅ Tous les médias ont été générés et mis à jour.');

  } catch (error: any) {
    console.error('[Media Gen] ❌ Une erreur est survenue :', error.message);
    process.exit(1);
  }
}

main();
