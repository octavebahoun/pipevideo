import 'dotenv/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { parseFile } from 'music-metadata';
import { loadStoryboard } from './storyboard';
import { FPS, getSceneDurationInFrames, getTransitionFramesBefore } from './types';

/**
 * Vérifie, pour chaque scène vidéo, l'écart entre la durée RÉELLE du clip déposé
 * dans public/ et la durée REQUISE par la scène (narration + pause post-narration,
 * voir getSceneDurationInFrames dans types.ts). Permet de savoir, avant de lancer
 * npm run render, si un clip trop court va :
 *  - être invisible (l'écart est masqué par le chevauchement de la transition
 *    suivante) → rien à faire ;
 *  - ou nécessiter un ralenti explicite (playbackRate), injecté automatiquement
 *    dans storyboard.json (voir le commentaire de `playbackRate` dans types.ts :
 *    "Injecté par un script après mesure des durées" — c'est ce script).
 *
 * À lancer après npm run tts (durées de narration connues) ET après avoir déposé
 * les fichiers médias dans public/ :
 *
 *   npm run check-video
 */

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

function isVideo(mediaPath: string): boolean {
  return /\.(mp4|mkv|webm|mov|avi)$/i.test(mediaPath);
}

async function main() {
  console.log(`Lecture du storyboard depuis : ${STORYBOARD_PATH}`);
  const storyboard = await loadStoryboard(STORYBOARD_PATH);

  let changed = false;
  let hasBlockingIssues = false;

  console.log('\n📏 Vérification des durées médias vs durées de scène requises\n');

  for (let i = 0; i < storyboard.scenes.length; i++) {
    const scene = storyboard.scenes[i];
    const label = `Scène ${scene.id}`;

    if (scene.card) {
      console.log(`${label} : carte de fin (pas de média) — ignorée.`);
      continue;
    }
    if (!scene.mediaPath || !isVideo(scene.mediaPath)) {
      console.log(`${label} : image ou pas de média — durée non contrainte par un clip, ignorée.`);
      continue;
    }

    const requiredSeconds = getSceneDurationInFrames(scene, FPS) / FPS;
    const mediaFullPath = path.join(MEDIA_DIR, scene.mediaPath);

    if (!(await fileExists(mediaFullPath))) {
      console.log(`⚠️  ${label} (${scene.mediaPath}) : fichier introuvable dans public/ — dépose-le puis relance.`);
      hasBlockingIssues = true;
      continue;
    }

    let actualSeconds: number | undefined;
    try {
      actualSeconds = (await parseFile(mediaFullPath)).format.duration;
    } catch (err: any) {
      console.log(`⚠️  ${label} (${scene.mediaPath}) : impossible de lire le fichier (${err.message}).`);
      hasBlockingIssues = true;
      continue;
    }
    if (actualSeconds === undefined) {
      console.log(`⚠️  ${label} (${scene.mediaPath}) : durée illisible dans ce fichier.`);
      hasBlockingIssues = true;
      continue;
    }

    const gapSeconds = actualSeconds - requiredSeconds;

    // Frames de transition qui mordent sur la FIN de cette scène (chevauchement
    // avec le DÉBUT de la scène suivante) : un manque inférieur ou égal à ça
    // tombe dans la zone de fondu et a de bonnes chances d'être invisible.
    const nextScene = storyboard.scenes[i + 1];
    const transitionSeconds = nextScene ? getTransitionFramesBefore(nextScene, i + 1) / FPS : 0;

    const req = requiredSeconds.toFixed(2);
    const act = actualSeconds.toFixed(2);
    const gap = gapSeconds.toFixed(2);

    if (gapSeconds >= 0) {
      console.log(`✅ ${label} (${scene.mediaPath}) : requis ${req}s, clip ${act}s (+${gap}s) — OK.`);
      if (scene.playbackRate !== undefined) {
        delete scene.playbackRate;
        changed = true;
        console.log('   ↳ playbackRate retiré (plus nécessaire, le clip suffit maintenant).');
      }
    } else if (Math.abs(gapSeconds) <= transitionSeconds) {
      console.log(
        `🟡 ${label} (${scene.mediaPath}) : requis ${req}s, clip ${act}s (${gap}s) — manque ${Math.abs(gapSeconds).toFixed(2)}s, ` +
          `mais la transition suivante (${transitionSeconds.toFixed(2)}s) devrait l'absorber. À vérifier visuellement au rendu.`
      );
    } else {
      const playbackRate = Number((actualSeconds / requiredSeconds).toFixed(3));
      console.log(
        `🔴 ${label} (${scene.mediaPath}) : requis ${req}s, clip ${act}s (${gap}s) — dépasse ce que la transition ` +
          `(${transitionSeconds.toFixed(2)}s) peut absorber. Ralenti nécessaire.`
      );
      console.log(`   ↳ playbackRate calculé et injecté dans storyboard.json : ${playbackRate}`);
      scene.playbackRate = playbackRate;
      changed = true;
    }
  }

  if (changed) {
    await fs.writeFile(STORYBOARD_PATH, JSON.stringify(storyboard, null, 2), 'utf-8');
    console.log('\n💾 storyboard.json mis à jour (playbackRate ajusté).');
  }

  if (hasBlockingIssues) {
    console.log('\n⚠️  Des médias sont manquants ou illisibles — corrige-les puis relance npm run check-video.');
    process.exit(1);
  }

  console.log('\n✅ Vérification terminée.');
}

main().catch((err: any) => {
  console.error('❌ Erreur lors de la vérification des médias :', err.message);
  process.exit(1);
});
