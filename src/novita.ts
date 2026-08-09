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
      console.log(`[Novita] Storyboard mis à jour en base de données pour la vidéo ${videoId}`);
    } catch (err: any) {
      console.error(`[Novita] Erreur lors de la mise à jour du storyboard en base :`, err.message);
    }
  }
}

async function submitVideoTaskForScene(
  sceneId: number,
  prompt: string,
  ratio: '9:16' | '16:9',
  apiKey: string
): Promise<string> {
  const model = 'seedance-v1.5-pro-t2v';
  const url = `https://api.novita.ai/v3/async/${model}`;

  const body = {
    prompt,
    fps: 24,
    ratio: ratio,
    duration: 5,
    resolution: '720p',
    watermark: false
  };

  console.log(`[Novita] Soumission du prompt pour Scène ${sceneId} via le modèle "${model}" : "${prompt}"...`);

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
  if (!apiKey) {
    console.log('⚠️ NOVITA_API_KEY n\'est pas configurée dans .env. Génération vidéo passée.');
    process.exit(0);
  }

  try {
    if (await checkCancelled()) {
      console.log('[Novita] Annulation détectée. Arrêt.');
      process.exit(0);
    }
    await updateProgress(5, 'Génération des vidéos IA (Novita)...');

    const storyboard = await loadStoryboard(STORYBOARD_PATH);
    console.log(`[Novita] Début de la génération de médias pour le storyboard : "${storyboard.title}"`);

    // Phase 1 : Soumission séquentielle pour éviter les conflits de base de données
    let storyboardChanged = false;
    for (const scene of storyboard.scenes) {
      if (scene.card) continue; // Pas de média pour les cartes texte

      const mediaFile = `scene_${scene.id}.mp4`;
      const mediaFullPath = path.join(MEDIA_DIR, mediaFile);

      // Si le fichier média existe déjà localement, on passe
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
            apiKey
          );
          scene.novitaTaskId = taskId;
          storyboardChanged = true;
          // Enregistrer immédiatement en base de données
          await saveStoryboardState(storyboard);
        } catch (err: any) {
          console.error(`[Novita] Erreur lors de la soumission de la Scène ${scene.id} :`, err.message);
          throw err;
        }
      } else {
        console.log(`[Novita] Scène ${scene.id} : Réutilisation de la tâche active (Task ID : ${scene.novitaTaskId})`);
      }
    }

    // Phase 2 : Polling et Téléchargement en parallèle
    const generationTasks: Promise<void>[] = [];
    const scenesToGenerate = storyboard.scenes.filter((s: any) => !s.card);
    const totalScenes = scenesToGenerate.length;

    // Compter le nombre de scènes déjà prêtes
    let completedScenes = 0;
    for (const scene of storyboard.scenes) {
      if (scene.card) continue;
      const mediaFile = `scene_${scene.id}.mp4`;
      const mediaFullPath = path.join(MEDIA_DIR, mediaFile);
      if (await fileExists(mediaFullPath)) {
        completedScenes++;
      }
    }

    for (const scene of storyboard.scenes) {
      if (scene.card) continue;

      const mediaFile = `scene_${scene.id}.mp4`;
      const mediaFullPath = path.join(MEDIA_DIR, mediaFile);

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
          const videoUrl = await pollVideoTask(scene.id, taskId, apiKey);

          if (await checkCancelled()) {
            console.log('[Novita] Annulation détectée.');
            process.exit(0);
          }

          console.log(`[Novita] Téléchargement de la vidéo pour Scène ${scene.id}...`);
          await downloadFile(videoUrl, mediaFullPath);
          console.log(`[Novita] Téléchargement réussi pour Scène ${scene.id} -> public/${mediaFile}`);
          
          // Mettre à jour le storyboard local
          scene.mediaPath = mediaFile;
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
      console.log('[Novita] Tous les médias sont déjà générés ou non requis.');
      await updateProgress(40, 'Vidéos IA prêtes (déjà en cache)');
      process.exit(0);
    }

    console.log(`[Novita] Attente en parallèle de ${generationTasks.length} tâches de génération...`);
    await Promise.all(generationTasks);

    // Enregistrer le storyboard final mis à jour sans les ID de tâches temporaires
    await saveStoryboardState(storyboard);
    console.log('[Novita] ✅ Tous les médias ont été générés et mis à jour.');

  } catch (error: any) {
    console.error('[Novita] ❌ Une erreur est survenue :', error.message);
    process.exit(1);
  }
}

main();
