import 'dotenv/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { parseMedia } from '@remotion/media-parser';
import { nodeReader } from '@remotion/media-parser/node';
import { loadStoryboard } from './storyboard';
import { FPS, getSceneDurationInFrames, getTransitionFramesBefore } from './types';
import { updateProgress, checkCancelled } from './lib/progressHelper';

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

/**
 * Où lire un média : sur R2 si le storyboard porte `assetBaseUrl`, sinon dans
 * public/. Depuis que le pod pousse directement sur R2, les fichiers ne sont
 * plus sur le disque local — les chercher là échouait systématiquement.
 * `parseMedia` de Remotion sait lire une URL comme un fichier.
 */
function sourceMedia(relPath: string, assetBaseUrl?: string): string {
  if (assetBaseUrl) return `${assetBaseUrl.replace(/\/$/, '')}/${relPath.replace(/^\//, '')}`;
  return path.join(MEDIA_DIR, relPath);
}

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
  if (await checkCancelled()) {
    console.log('[Check-Media] Annulation détectée. Arrêt.');
    process.exit(0);
  }
  await updateProgress(55, 'Vérification de la validité des médias...');

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
    if (Array.isArray(scene.mediaPath)) {
      console.log(`${label} : diaporama d'images (${scene.mediaPath.join(', ')}) — durées non contraintes par un clip, ignorée.`);
      // Sur R2, l'absence se verra au rendu : on ne fait pas une requête HTTP
      // par image ici.
      if (!storyboard.assetBaseUrl) {
        for (const p of scene.mediaPath) {
          if (!(await fileExists(path.join(MEDIA_DIR, p)))) {
            console.log(`   ⚠️ Image manquante dans public/ : ${p}`);
          }
        }
      }
      continue;
    }
    if (!scene.mediaPath || !isVideo(scene.mediaPath)) {
      console.log(`${label} : image ou pas de média — durée non contrainte par un clip, ignorée.`);
      continue;
    }

    const requiredSeconds = getSceneDurationInFrames(scene, FPS) / FPS;
    const surR2 = Boolean(storyboard.assetBaseUrl);
    const mediaFullPath = sourceMedia(scene.mediaPath, storyboard.assetBaseUrl);

    // Sur R2 on ne teste pas l'existence séparément : parseMedia échouera de
    // toute façon si l'URL ne répond pas, et une requête HTTP de plus par média
    // n'apporte rien.
    if (!surR2 && !(await fileExists(mediaFullPath))) {
      console.log(`⚠️  ${label} (${scene.mediaPath}) : fichier introuvable dans public/ — dépose-le puis relance.`);
      hasBlockingIssues = true;
      continue;
    }

    let actualSeconds: number | null | undefined;
    try {
      const { slowDurationInSeconds } = await parseMedia({
        src: mediaFullPath,
        // `nodeReader` lit le système de fichiers : il ferait échouer une URL R2
        // avec « File does not exist ». Sur R2 on laisse parseMedia utiliser son
        // reader HTTP par défaut.
        ...(surR2 ? {} : { reader: nodeReader }),
        fields: { slowDurationInSeconds: true },
        acknowledgeRemotionLicense: true,
      });
      actualSeconds = slowDurationInSeconds;
    } catch (err: any) {
      console.log(`⚠️  ${label} (${scene.mediaPath}) : impossible de lire le fichier (${err.message}).`);
      hasBlockingIssues = true;
      continue;
    }
    if (actualSeconds === undefined || actualSeconds === null) {
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
