import 'dotenv/config';
import * as fs from 'fs/promises';
import * as path from 'path';

const OUTPUT_PATH = path.join(process.cwd(), 'public', 'test_novita.mp4');

async function downloadFile(url: string, destPath: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download file from ${url}: ${response.statusText}`);
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  await fs.writeFile(destPath, buffer);
}

async function runTest() {
  const apiKey = process.env.NOVITA_API_KEY;
  if (!apiKey) {
    console.error('❌ NOVITA_API_KEY n\'est pas configurée dans .env !');
    process.exit(1);
  }

  const model = 'seedance-v1.5-pro-t2v';
  const url = `https://api.novita.ai/v3/async/${model}`;
  const prompt = 'A cute orange cat running on a beach in slow motion, cinematic 4k, brutalist lighting';

  const body = {
    prompt,
    fps: 24,
    ratio: '16:9',
    duration: 5, // Durée standard supportée par le modèle
    resolution: '720p',
    watermark: false
  };

  console.log(`🚀 Envoi de la requête de test à Novita AI (${model})...`);
  console.log(`Prompt: "${prompt}"`);

  try {
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
      throw new Error(`Échec de la soumission Novita: ${response.statusText} - ${errorText}`);
    }

    const submitData = await response.json();
    const taskId = submitData.task_id;
    if (!taskId) {
      throw new Error(`Pas de task_id retourné par Novita: ${JSON.stringify(submitData)}`);
    }

    console.log(`✅ Tâche soumise avec succès ! Task ID: ${taskId}`);
    console.log(`⏳ Suivi de la tâche toutes les 5 secondes...`);

    let attempts = 0;
    while (attempts < 60) {
      const statusRes = await fetch(`https://api.novita.ai/v3/async/task-result?task_id=${taskId}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });

      if (!statusRes.ok) {
        console.warn(`⚠️ Échec de la vérification du statut: ${statusRes.statusText}`);
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
          throw new Error(`URL de la vidéo introuvable dans le payload: ${JSON.stringify(statusData)}`);
        }
        console.log(`\n🎉 Génération réussie ! URL : ${videoUrl}`);
        console.log(`📥 Téléchargement de la vidéo vers : ${OUTPUT_PATH}...`);
        await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
        await downloadFile(videoUrl, OUTPUT_PATH);
        console.log(`✅ Téléchargement terminé avec succès !`);
        return;
      }

      if (status === 'TASK_STATUS_FAILED') {
        throw new Error(`La tâche a échoué: ${task?.reason || 'Raison inconnue'}`);
      }

      const progress = task?.progress_percent ?? 0;
      process.stdout.write(`\rGénération en cours : ${progress}%...`);
      await new Promise(r => setTimeout(r, 5000));
      attempts++;
    }

    throw new Error('Timeout de génération dépassé (300 secondes)');
  } catch (err: any) {
    console.error(`\n❌ Erreur pendant le test :`, err.message || err);
    process.exit(1);
  }
}

runTest();
