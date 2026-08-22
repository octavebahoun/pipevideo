import 'dotenv/config';
import { spawn } from 'child_process';
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

/**
 * Un clip déjà présent est-il RÉELLEMENT exploitable ?
 *
 * L'existence du fichier ne suffit pas : un rapatriement interrompu laisse un
 * MP4 lisible mais incomplet (constaté : 80 frames au lieu de 81 sur
 * scene_23.mp4, pod supprimé en cours de transfert). Sans ce contrôle, la
 * reprise considère le fichier comme bon et ne le régénère jamais.
 *
 * ATTENTION au piège : on ne compare PAS au nombre de frames déduit de
 * `durationInSeconds`. Les clips sont toujours générés au plafond de
 * `framesForDuration` (81 le plus souvent) et c'est `playbackRate` qui les étire
 * ensuite à la durée de la narration. Comparer à la durée narrée signalait à
 * tort tous les clips longs comme tronqués.
 *
 * On vérifie donc seulement qu'un clip est PLAUSIBLE : au moins `framesMin`
 * frames décodables. Une troncature réseau produit un fichier nettement plus
 * court, ou illisible.
 *
 * En cas de doute (ffprobe absent, sortie illisible) on répond `true` : mieux
 * vaut garder un clip suspect que rallumer un GPU sur une fausse alerte.
 */
async function clipValide(p: string, framesMin: number): Promise<boolean> {
  if (!(await fileExists(p))) return false;

  return new Promise((resolve) => {
    const probe = spawn('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-count_frames',
      '-show_entries', 'stream=nb_read_frames',
      '-of', 'csv=p=0',
      p,
    ]);

    let out = '';
    probe.stdout.on('data', (d) => (out += d));
    probe.on('error', () => resolve(true)); // ffprobe indisponible : on ne bloque pas.
    probe.on('close', () => {
      const n = parseInt(out.trim(), 10);
      if (!Number.isFinite(n)) return resolve(true);
      if (n >= framesMin) return resolve(true);
      console.warn(
        `[RunPod] ${path.basename(p)} : ${n} frames (minimum ${framesMin}) — fichier tronqué, à régénérer.`
      );
      resolve(false);
    });
  });
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

/**
 * Plancher de frames pour juger un clip déjà présent comme complet.
 * Wan produit 81 frames (5 s à 16 fps) dans la quasi-totalité des cas ; un
 * fichier plus court signale une troncature de transfert, pas un choix.
 */
const FRAMES_MIN_CLIP = 81;

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
 * Génère l'image de départ avec Flux schnell, sur le pod.
 *
 * Mesuré à ~2 s contre ~8 s via Cloudflare Workers AI, et surtout SANS rate
 * limit : un 429 Cloudflare interrompait le run alors que le GPU tournait déjà.
 * L'image produite reste dans le dossier output/ du pod et est réutilisée
 * directement par Wan — aucun aller-retour réseau.
 *
 * Une copie est tout de même rapatriée dans public/ : elle sert de point de
 * reprise si le run échoue plus loin, et permet de vérifier la composition.
 *
 * Retourne le nom du fichier tel que ComfyUI le voit en entrée.
 */
async function generateStartImage(
  pod: PodInfo,
  job: Job,
  ratio: '16:9' | '9:16',
  destLocal: string
): Promise<string> {
  const wf = await loadWorkflow('wf-flux-txt2img.json');
  const { width, height } = dimensionsFor(ratio);

  wf['2'].inputs.text = job.prompt;
  wf['4'].inputs.width = width;
  wf['4'].inputs.height = height;
  wf['5'].inputs.seed = 1000 + job.sceneId;
  wf['7'].inputs.filename_prefix = `s${job.sceneId}_start`;

  console.log(`[Flux] Scène ${job.sceneId} : image de départ ${width}x${height}...`);

  const promptId = await comfySubmit(pod, wf);
  const outputs = await comfyWait(pod, promptId, { timeoutMs: 5 * 60_000 });

  const png = outputs.find((f) => f.endsWith('.png'));
  if (!png) throw new Error(`Scène ${job.sceneId} : Flux n'a produit aucune image`);

  // ComfyUI écrit dans output/ mais LoadImage lit dans input/ : on copie sur le
  // pod plutôt que de faire redescendre puis remonter l'image.
  await ssh(pod, `cp /workspace/ComfyUI/output/${png} /workspace/ComfyUI/input/${png}`, 60_000);

  // Copie locale pour la reprise (n'ajoute pas de temps GPU : le clip suit).
  await comfyDownload(pod, png, destLocal).catch((err) => {
    console.warn(`[Flux] Copie locale de l'image ${job.sceneId} échouée (non bloquant) : ${err.message}`);
  });

  return png;
}

/**
 * Génère une image FIXE (scène sans animation) avec Flux, sur le pod.
 *
 * Distinct de `generateStartImage` sur un point essentiel : ici l'image EST le
 * livrable, donc son rapatriement ne peut pas être « non bloquant ». Si le
 * transfert échoue, la scène n'a pas de média et l'appelant doit le savoir.
 *
 * Pourquoi sur le pod et non via Cloudflare Workers AI : les neurones Cloudflare
 * sont une ressource partagée avec les autres projets de l'utilisateur. Une vidéo
 * d'enseignement compte ~35 images fixes — à plusieurs vidéos par semaine, cela
 * épuiserait le quota commun. Sur un pod déjà allumé pour les clips, ces images
 * coûtent ~2 s de GPU chacune, soit quelques centimes au total.
 */
async function generateStillImage(
  pod: PodInfo,
  job: Job,
  ratio: '16:9' | '9:16',
  destLocal: string
): Promise<void> {
  const wf = await loadWorkflow('wf-flux-txt2img.json');

  // Pleine résolution, contrairement aux images de départ des clips (832x480) :
  // une image fixe subit un zoom Ken Burns au montage, qui révélerait le flou
  // d'une source basse résolution. Le surcoût est de ~2 s de GPU par image.
  const { width, height } = ratio === '9:16' ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 };

  wf['2'].inputs.text = job.prompt;
  wf['4'].inputs.width = width;
  wf['4'].inputs.height = height;
  wf['5'].inputs.seed = 1000 + job.sceneId;
  wf['7'].inputs.filename_prefix = `s${job.sceneId}_still`;

  console.log(`[Flux] Scène ${job.sceneId} : image fixe ${width}x${height}...`);

  const promptId = await comfySubmit(pod, wf);
  const outputs = await comfyWait(pod, promptId, { timeoutMs: 5 * 60_000 });

  const png = outputs.find((f) => f.endsWith('.png'));
  if (!png) throw new Error(`Scène ${job.sceneId} : Flux n'a produit aucune image`);

  await comfyDownload(pod, png, destLocal);
}

/**
 * Génère un clip vidéo : Flux produit l'image de départ sur le pod, puis
 * Wan 2.2 l'anime. Ce chaînage coûte moins cher qu'un text-to-video direct et
 * donne un bien meilleur contrôle sur la composition.
 */
async function generateVideo(pod: PodInfo, job: Job, ratio: '16:9' | '9:16'): Promise<string> {
  // 1. Image de départ. Si elle existe déjà en local (reprise après crash), on
  //    la renvoie au pod ; sinon Flux la génère directement sur le GPU.
  const startLocal = path.join(MEDIA_DIR, `start_scene_${job.sceneId}.png`);
  let startImage: string;

  if (await fileExists(startLocal)) {
    console.log(`[RunPod] Scène ${job.sceneId} : image de départ déjà présente, réutilisée.`);
    startImage = await comfyUploadImage(pod, startLocal);
  } else {
    startImage = await generateStartImage(pod, job, ratio, startLocal);
  }

  // 2. Animation
  const wf = await loadWorkflow('wf-wan-i2v-4steps.json');
  const { width, height } = dimensionsFor(ratio);
  const frames = framesForDuration(job.durationSec);

  wf['9'].inputs.image = startImage;
  // Flux sort déjà aux bonnes dimensions, mais on garde le redimensionnement :
  // une image de reprise peut venir d'une ancienne génération Cloudflare (carrée).
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
    // Un clip vidéo est en plus contrôlé sur son nombre de frames : un
    // rapatriement interrompu laisse un MP4 lisible mais tronqué.
    // Seuil = le plancher réellement produit par Wan (81 frames), et non la
    // durée narrée : c'est `playbackRate` qui étire le clip au montage.
    const dest = path.join(MEDIA_DIR, job.file);
    const bon =
      job.kind === 'video' ? await clipValide(dest, FRAMES_MIN_CLIP) : await fileExists(dest);

    if (bon) {
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

  const imagesRatees: number[] = [];

  /**
   * Où générer les images fixes ?
   *
   * Sur le pod (Flux) dès qu'un pod est de toute façon nécessaire pour les clips :
   * les neurones Cloudflare sont partagés avec les autres projets de l'utilisateur
   * et une vidéo d'enseignement compte ~35 images fixes. Quelques secondes de GPU
   * coûtent moins cher qu'un quota commun épuisé.
   *
   * Cloudflare sert de repli quand il n'y a AUCUN clip à animer : allumer un GPU
   * juste pour des images fixes serait absurde.
   */
  const imagesSurPod = videoJobs.length > 0;

  // --- Phase 1 : les images fixes, sans GPU, uniquement si aucun pod prévu. ---
  if (!imagesSurPod && imageJobs.length > 0) {
    console.log(`[RunPod] ${imageJobs.length} images fixes via Cloudflare (aucun clip à animer, pas de GPU).`);

    for (const job of imageJobs) {
      if (await checkCancelled()) {
        console.log('[RunPod] Annulation détectée.');
        return;
      }
      if (!cloudflareCredentials()) {
        console.warn(`[RunPod] Scène ${job.sceneId} : identifiants Cloudflare absents, image non générée.`);
        imagesRatees.push(job.sceneId);
        continue;
      }
      try {
        await cloudflareImage(job.sceneId, job.prompt, ratio, path.join(MEDIA_DIR, job.file));
        await markDone(job);
        await tick();
      } catch (err: any) {
        console.warn(`[RunPod] Scène ${job.sceneId} : image échouée (${err.message.slice(0, 100)}) — on continue.`);
        imagesRatees.push(job.sceneId);
      }
    }

    if (imagesRatees.length > 0) {
      console.warn(`[RunPod] ⚠️ Images non générées pour les scènes : ${imagesRatees.join(', ')}. Relancer plus tard.`);
    }
    console.log('[RunPod] ✅ Aucun clip à animer : aucun GPU n\'a été allumé.');
    return;
  }

  if (videoJobs.length === 0 && imageJobs.length === 0) return;

  // --- Phase 2 : tout sur le pod GPU (images fixes Flux + clips Wan). ---
  await updateProgress(
    12,
    `Démarrage du GPU RunPod (${videoJobs.length} clips, ${imageJobs.length} images)...`
  );
  let podId: string | null = null;

  // Déclarés HORS du try : le finally doit pouvoir les attendre. Si une erreur
  // survient en pleine génération (ex. `fetch failed`), on saute directement au
  // finally — sans cette portée, le pod était supprimé pendant qu'un transfert
  // courait encore et le fichier arrivait TRONQUÉ (constaté sur scene_23.mp4,
  // 80 frames au lieu de 81).
  const transferts: Promise<void>[] = [];
  const echecs: number[] = [];

  try {
    podId = await createPod(`pipevideo-${Date.now()}`);
    const pod = await waitForPod(podId);

    await updateProgress(15, 'Installation de ComfyUI sur le GPU...');
    await runSetup(pod);

    // --- Images fixes d'abord : ~2 s chacune, autant les sortir avant les clips
    //     (si le run casse en cours, on garde le plus gros du travail).
    for (const job of imageJobs) {
      if (await checkCancelled()) {
        console.log('[RunPod] Annulation détectée — arrêt et suppression du pod.');
        break;
      }
      try {
        await generateStillImage(pod, job, ratio, path.join(MEDIA_DIR, job.file));
        await markDone(job);
        await tick();
      } catch (err: any) {
        // Une image ratée ne doit pas coûter les 39 suivantes.
        console.error(`[RunPod] Scène ${job.sceneId} : image échouée — ${err.message.slice(0, 120)}`);
        imagesRatees.push(job.sceneId);
      }
    }

    // --- Clips ensuite. Les téléchargements partent en tâche de fond :
    //     rapatrier un clip prend ~8 s pendant lesquelles le GPU ne calcule rien.
    for (const job of videoJobs) {
      if (await checkCancelled()) {
        console.log('[RunPod] Annulation détectée — arrêt et suppression du pod.');
        break;
      }

      console.log(`[RunPod] Scène ${job.sceneId} : ${job.motionPrompt.slice(0, 70)}...`);

      let produced: string;
      try {
        produced = await generateVideo(pod, job, ratio);
      } catch (err: any) {
        // Tolérance par scène : un incident réseau ou un job ComfyUI en échec ne
        // doit pas emporter tout le run. On note la scène et on passe à la suite —
        // une relance la reprendra, les autres clips sont déjà acquis.
        console.error(`[RunPod] Scène ${job.sceneId} : génération échouée — ${err.message.slice(0, 150)}`);
        echecs.push(job.sceneId);
        continue;
      }

      transferts.push(
        comfyDownload(pod, produced, path.join(MEDIA_DIR, job.file))
          .then(() => markDone(job))
          .then(() => tick())
          .catch((err: any) => {
            console.error(`[RunPod] Scène ${job.sceneId} : rapatriement échoué — ${err.message}`);
            echecs.push(job.sceneId);
          })
      );
    }

    console.log(`[RunPod] ✅ ${done}/${jobs.length} médias générés.`);
  } finally {
    // Ordre IMPÉRATIF : on attend les transferts en cours AVANT de supprimer le
    // pod, sinon le fichier en vol arrive tronqué. Vrai aussi sur chemin
    // d'erreur — c'est précisément là que le bug s'était produit.
    if (transferts.length > 0) {
      console.log(`[RunPod] Attente de ${transferts.length} transfert(s) avant suppression du pod...`);
      await Promise.all(transferts).catch(() => {});
    }

    if (echecs.length > 0) {
      console.error(`[RunPod] ⚠️ Clips manquants : ${echecs.join(', ')}. Relancer pour les récupérer.`);
    }
    if (imagesRatees.length > 0) {
      console.error(`[RunPod] ⚠️ Images manquantes : ${imagesRatees.join(', ')}. Relancer pour les récupérer.`);
    }

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
