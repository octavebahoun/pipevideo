import 'dotenv/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { loadStoryboard } from './storyboard';

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

async function generateVideoForScene(
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

  // Polling loop
  let attempts = 0;
  while (attempts < 60) {
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
    const storyboard = await loadStoryboard(STORYBOARD_PATH);
    console.log(`[Novita] Début de la génération de médias pour le storyboard : "${storyboard.title}"`);

    // Prepare tasks for parallel execution
    const generationTasks: Promise<void>[] = [];

    for (const scene of storyboard.scenes) {
      if (scene.card) continue; // Pas de média pour les cartes texte

      const mediaFile = `scene_${scene.id}.mp4`;
      const mediaFullPath = path.join(MEDIA_DIR, mediaFile);

      // Si le média existe déjà localement, on ne le régénère pas
      if (await fileExists(mediaFullPath)) {
        console.log(`[Novita] Scène ${scene.id} : ${mediaFile} existe déjà. Passer.`);
        continue;
      }

      const prompt = scene.mediaPrompt || `Cinematic visual for ${scene.narration}`;
      
      const task = (async () => {
        try {
          const videoUrl = await generateVideoForScene(
            scene.id,
            prompt,
            storyboard.ratio || '9:16',
            apiKey
          );
          console.log(`[Novita] Téléchargement de la vidéo pour Scène ${scene.id}...`);
          await downloadFile(videoUrl, mediaFullPath);
          console.log(`[Novita] Téléchargement réussi pour Scène ${scene.id} -> public/${mediaFile}`);
          // Mettre à jour le storyboard localement
          scene.mediaPath = mediaFile;
        } catch (err: any) {
          console.error(`[Novita] Erreur lors de la génération de la Scène ${scene.id} :`, err.message);
          throw err;
        }
      })();

      generationTasks.push(task);
    }

    if (generationTasks.length === 0) {
      console.log('[Novita] Tous les médias sont déjà générés ou non requis.');
      process.exit(0);
    }

    console.log(`[Novita] Lancement de ${generationTasks.length} générations de vidéo en parallèle...`);
    await Promise.all(generationTasks);

    // Enregistrer le storyboard mis à jour
    await fs.writeFile(STORYBOARD_PATH, JSON.stringify(storyboard, null, 2), 'utf-8');
    console.log('[Novita] ✅ Tous les médias ont été générés et mis à jour dans le storyboard.');

  } catch (error: any) {
    console.error('[Novita] ❌ Une erreur est survenue :', error.message);
    process.exit(1);
  }
}

main();
