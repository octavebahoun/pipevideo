import 'dotenv/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { loadStoryboard } from './storyboard';
import { updateProgress, checkCancelled } from './lib/progressHelper';
import { prisma } from './lib/db';
import {
  createPod,
  waitForPod,
  deletePod,
  runSetup,
  ssh,
  comfyUploadImage,
  comfySubmit,
  comfyWait,
  comfyDownload,
  PodInfo,
} from './lib/runpodClient';
import { generateImage as cloudflareImage, cloudflareCredentials } from './lib/cloudflareImage';

/**
 * Génération des médias IA sur un pod GPU RunPod éphémère.
 *
 * Remplace src/novita.ts : au lieu de payer à la seconde de vidéo produite
 * (~$0.30 le clip de 5 s chez un endpoint public), on loue un GPU à l'heure et
 * on génère avec Wan 2.2 + LoRA Lightning 4-steps — mesuré à 38 s le clip de
 * 5 s en 480p sur RTX 5090, soit ~$0.011.
 *
 * Le pod est TOUJOURS supprimé en fin d'exécution (bloc finally), y compris si
 * la génération plante : un pod oublié coûte plus cher que toute la production.
 */

const STORYBOARD_PATH = path.join(process.cwd(), 'storyboard.json');
const MEDIA_DIR = path.join(process.cwd(), 'public');
const WORKFLOW_DIR = path.join(process.cwd(), 'runpod');

/** Une unité de travail : un fichier média à produire pour une scène. */
interface Job {
  sceneId: number;
  /** Nom du fichier attendu dans public/ (ex: "scene_3.mp4"). */
  file: string;
  kind: 'image' | 'video';
  /** Décrit la composition FIXE : envoyé à Flux pour l'image de départ. */
  prompt: string;
  /** Décrit le MOUVEMENT : envoyé à Wan pour l'animation. */
  motionPrompt: string;
  /** Durée visée du clip, en secondes (vidéos uniquement). */
  durationSec?: number;
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function saveStoryboardState(storyboard: any): Promise<void> {
  await fs.writeFile(STORYBOARD_PATH, JSON.stringify(storyboard, null, 2), 'utf-8');

  const videoId = process.env.VIDEO_ID;
  if (!videoId) return;
  try {
    await prisma.video.update({
      where: { id: videoId },
      data: { storyboard: storyboard as any },
    });
  } catch (err: any) {
    console.error('[RunPod] Storyboard non sauvegardé en base :', err.message);
  }
}

async function loadWorkflow(name: string): Promise<any> {
  const raw = await fs.readFile(path.join(WORKFLOW_DIR, name), 'utf-8');
  return JSON.parse(raw);
}

/**
 * Nombre de frames Wan pour une durée donnée.
 * Contrainte du modèle : multiple de 4 + 1. 81 frames (5 s à 16 fps) est le
 * point d'entraînement natif — au-delà la cohérence se dégrade et le temps de
 * calcul explose de façon quadratique (mesuré : 10 s coûte 2,4× deux clips de 5 s).
 */
function framesForDuration(durationSec?: number): number {
  const target = Math.max(2, Math.min(10, Math.ceil(durationSec ?? 5)));
  const raw = Math.round(target * 16);
  return Math.floor(raw / 4) * 4 + 1;
}

/** Dimensions de génération selon le ratio du storyboard (480p, validé côté qualité). */
function dimensionsFor(ratio: '16:9' | '9:16'): { width: number; height: number } {
  return ratio === '9:16' ? { width: 480, height: 832 } : { width: 832, height: 480 };
}

/** Parcourt le storyboard et liste tout ce qui manque encore. */
function collectJobs(storyboard: any): Job[] {
  const jobs: Job[] = [];

  for (const scene of storyboard.scenes) {
    if (scene.card) continue; // Les cartes texte n'ont pas de média.

    const raw = scene.mediaPath;
    const files: string[] = !raw ? [`scene_${scene.id}.mp4`] : Array.isArray(raw) ? raw : [raw];

    for (const file of files) {
      const isImage = /\.(png|jpe?g)$/i.test(file);
      const visual = scene.mediaPrompt || `Cinematic visual for ${scene.narration}`;
      jobs.push({
        sceneId: scene.id,
        file,
        kind: isImage ? 'image' : 'video',
        prompt: visual,
        // Sans motionPrompt, on retombe sur la description visuelle : le plan
        // sera quasi statique, mais jamais incohérent.
        motionPrompt: scene.motionPrompt || visual,
        durationSec: scene.durationInSeconds,
      });
    }
  }

  return jobs;
}

/**
 * Génère un clip vidéo : Cloudflare Workers AI produit l'image de départ, puis
 * Wan 2.2 l'anime sur le GPU. Ce chaînage coûte moins cher qu'un text-to-video
 * direct et donne un bien meilleur contrôle sur la composition — une image
 * ratée se régénère sans toucher au GPU.
 */
async function generateVideo(pod: PodInfo, job: Job, ratio: '16:9' | '9:16'): Promise<string> {
  // 1. Image de départ via Cloudflare (pas de Flux sur le pod).
  //    Conservée dans public/ : une relance ne la régénère pas.
  const startLocal = path.join(MEDIA_DIR, `start_scene_${job.sceneId}.png`);
  if (!(await fileExists(startLocal))) {
    await cloudflareImage(job.sceneId, job.prompt, ratio, startLocal);
  } else {
    console.log(`[RunPod] Scène ${job.sceneId} : image de départ déjà présente, réutilisée.`);
  }

  // 2. Envoi de l'image dans le dossier input/ de ComfyUI
  const startImage = await comfyUploadImage(pod, startLocal);

  // 3. Animation
  const wf = await loadWorkflow('wf-wan-i2v-4steps.json');
  const { width, height } = dimensionsFor(ratio);
  const frames = framesForDuration(job.durationSec);

  wf['9'].inputs.image = startImage;
  // Cloudflare sort du 1344x768 : on redimensionne au format de génération Wan.
  wf['20'].inputs.width = width;
  wf['20'].inputs.height = height;
  wf['10'].inputs.width = width;
  wf['10'].inputs.height = height;
  wf['10'].inputs.length = frames;
  wf['6'].inputs.text = job.motionPrompt;
  wf['11'].inputs.noise_seed = 2000 + job.sceneId;
  wf['12'].inputs.noise_seed = 2000 + job.sceneId;
  wf['14'].inputs.filename_prefix = `s${job.sceneId}_clip`;

  console.log(`[RunPod] Scène ${job.sceneId} : animation ${frames} frames (${(frames / 16).toFixed(1)} s)...`);

  const promptId = await comfySubmit(pod, wf);
  const outputs = await comfyWait(pod, promptId, {
    timeoutMs: 20 * 60_000,
    onTick: async (sec) => {
      if (sec % 30 === 0 && sec > 0) console.log(`[RunPod] Scène ${job.sceneId} : ${sec}s écoulées...`);
    },
  });

  const webp = outputs.find((f) => f.endsWith('.webp'));
  if (!webp) throw new Error(`Scène ${job.sceneId} : aucun clip produit`);

  // 3. ComfyUI sort du WEBP animé, que ffmpeg ne sait pas décoder directement.
  //    On convertit sur le pod (PIL extrait les frames, ffmpeg les réencode).
  const mp4 = webp.replace(/\.webp$/, '.mp4');
  await ssh(pod, `python /workspace/to_mp4.py ${webp}`, 5 * 60_000);
  return mp4;
}

async function main() {
  if (!process.env.RUNPOD_API_KEY) {
    console.log('⚠️ RUNPOD_API_KEY absente de .env. Génération de médias passée.');
    process.exit(0);
  }

  // Les images de départ viennent de Cloudflare : sans ces identifiants, aucun
  // clip ne peut être animé. On échoue tout de suite plutôt qu'après avoir
  // allumé un GPU.
  if (!cloudflareCredentials()) {
    console.error('❌ CLOUDFLARE_API_TOKEN ou R2_ACCOUNT_ID absent de .env — requis pour les images de départ.');
    process.exit(1);
  }

  if (await checkCancelled()) {
    console.log('[RunPod] Annulation détectée avant démarrage.');
    process.exit(0);
  }

  const storyboard = await loadStoryboard(STORYBOARD_PATH);
  const ratio = (storyboard.ratio || '16:9') as '16:9' | '9:16';

  // On ne retient que ce qui manque réellement : un média déjà présent dans
  // public/ n'est jamais régénéré (reprise après crash, et économie de GPU).
  const allJobs = collectJobs(storyboard);
  const jobs: Job[] = [];
  for (const job of allJobs) {
    if (await fileExists(path.join(MEDIA_DIR, job.file))) {
      console.log(`[RunPod] Scène ${job.sceneId} : ${job.file} déjà présent, réutilisé.`);
      continue;
    }
    jobs.push(job);
  }

  if (jobs.length === 0) {
    console.log('[RunPod] Tous les médias sont déjà générés. Aucun GPU allumé.');
    await updateProgress(30, 'Médias déjà générés');
    return;
  }

  const imageJobs = jobs.filter((j) => j.kind === 'image');
  const videoJobs = jobs.filter((j) => j.kind === 'video');
  console.log(`[RunPod] ${jobs.length} médias à produire (${videoJobs.length} clips, ${imageJobs.length} images).`);

  /** Marque une scène comme produite et persiste immédiatement l'état. */
  const markDone = async (job: Job) => {
    const scene = storyboard.scenes.find((s: any) => s.id === job.sceneId);
    if (scene && !scene.mediaPath) scene.mediaPath = job.file;
    await saveStoryboardState(storyboard);
  };

  let done = 0;
  const tick = async () => {
    done++;
    await updateProgress(10 + Math.round((done / jobs.length) * 20), `Médias : ${done}/${jobs.length}`);
  };

  // --- Phase 1 : les images, via Cloudflare Workers AI. Aucun GPU requis. ---
  for (const job of imageJobs) {
    if (await checkCancelled()) {
      console.log('[RunPod] Annulation détectée.');
      return;
    }
    await cloudflareImage(job.sceneId, job.prompt, ratio, path.join(MEDIA_DIR, job.file));
    await markDone(job);
    await tick();
  }

  // --- Phase 2 : les clips, sur GPU. On n'allume le pod que maintenant. ---
  if (videoJobs.length === 0) {
    console.log('[RunPod] ✅ Aucun clip à animer : aucun GPU n\'a été allumé.');
    return;
  }

  await updateProgress(12, `Démarrage du GPU RunPod (${videoJobs.length} clips)...`);
  let podId: string | null = null;

  try {
    podId = await createPod(`pipevideo-${Date.now()}`);
    const pod = await waitForPod(podId);

    await updateProgress(15, 'Installation de ComfyUI sur le GPU...');
    await runSetup(pod);

    for (const job of videoJobs) {
      if (await checkCancelled()) {
        console.log('[RunPod] Annulation détectée — arrêt et suppression du pod.');
        break;
      }

      console.log(`[RunPod] Scène ${job.sceneId} : ${job.motionPrompt.slice(0, 70)}...`);

      const produced = await generateVideo(pod, job, ratio);
      await comfyDownload(pod, produced, path.join(MEDIA_DIR, job.file));
      await markDone(job);
      await tick();
    }

    console.log(`[RunPod] ✅ ${done}/${jobs.length} médias générés.`);
  } finally {
    // Filet de sécurité : le pod part quoi qu'il arrive.
    if (podId) await deletePod(podId);
  }
}

main()
  .catch((err) => {
    console.error('[RunPod] Échec :', err.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });
