import * as fs from 'fs/promises';
import * as path from 'path';

const PUBLIC_DIR = path.join(process.cwd(), 'public');

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export type SceneCacheStatus = {
  sceneId: number;
  audioReady: boolean;
  mediaReady: boolean;
};

/**
 * For each scene of a storyboard, checks whether its audio/media files already
 * exist in public/ AND are still valid for the CURRENT scene content (narration,
 * voice, media prompt unchanged since those files were generated).
 *
 * This is the single source of truth for "what can be reused" — used both to
 * report cache status to the UI (GET /api/render/status) and to decide which
 * stale files to delete before a resumed render (POST /api/render).
 *
 * Deliberately does NOT depend on "which video rendered last" (the old
 * public/.last_rendered_id marker): comparing directly against the storyboard's
 * own previous state means switching between videos never silently wipes a
 * video's progress just because another one rendered in between.
 */
/**
 * Fichiers médias d'une scène, relatifs à public/.
 *
 * `mediaPath` accepte une chaîne ou un tableau (plusieurs plans sur une scène).
 * Sans valeur, on retombe sur les deux extensions possibles pour retrouver un
 * fichier déjà produit dont le storyboard aurait perdu la trace.
 */
function mediaPathsDe(scene: any): string[] {
  if (Array.isArray(scene.mediaPath)) return scene.mediaPath;
  if (typeof scene.mediaPath === 'string' && scene.mediaPath) return [scene.mediaPath];
  return [];
}

export async function computeSceneCacheStatus(
  storyboard: any,
  previousStoryboard: any | null
): Promise<SceneCacheStatus[]> {
  const scenes = storyboard?.scenes || [];
  const prevScenes = previousStoryboard?.scenes || [];
  const voiceChanged = previousStoryboard ? previousStoryboard.voice !== storyboard.voice : false;

  const results: SceneCacheStatus[] = [];

  for (const scene of scenes) {
    if (scene.card) {
      results.push({ sceneId: scene.id, audioReady: true, mediaReady: true });
      continue;
    }

    const prevScene = prevScenes.find((s: any) => s.id === scene.id);
    const audioFullPath = path.join(PUBLIC_DIR, `scene_${scene.id}.mp3`);

    const narrationChanged = !prevScene || prevScene.narration !== scene.narration;
    const audioStale = narrationChanged || voiceChanged;
    const audioReady = !audioStale && (await fileExists(audioFullPath));

    // Suivre le `mediaPath` du storyboard plutôt que de supposer un .mp4 : sur du
    // contenu de méditation, ~95 % des scènes sont des .png. Supposer l'extension
    // faisait déclarer chaque image « absente » et la régénérait sur le GPU, même
    // quand elle était là — le cache ne servait donc à rien pour ce format.
    const mediaFiles = mediaPathsDe(scene);

    const promptChanged = !prevScene || prevScene.mediaPrompt !== scene.mediaPrompt;
    // Le mouvement compte autant que l'image pour un clip : changer le seul
    // motionPrompt doit régénérer la vidéo.
    const motionChanged = !prevScene || prevScene.motionPrompt !== scene.motionPrompt;
    const noTaskId = !scene.novitaTaskId && !scene.mediaPath;
    const mediaStale = promptChanged || motionChanged || narrationChanged || noTaskId;

    let mediaReady = !mediaStale && mediaFiles.length > 0;
    for (const rel of mediaFiles) {
      if (!mediaReady) break;
      mediaReady = await fileExists(path.join(PUBLIC_DIR, rel));
    }

    results.push({ sceneId: scene.id, audioReady, mediaReady });
  }

  return results;
}

/** Deletes only the scene files that computeSceneCacheStatus flagged as stale. */
export async function cleanupStaleSceneFiles(cacheStatus: SceneCacheStatus[]): Promise<void> {
  for (const { sceneId, audioReady, mediaReady } of cacheStatus) {
    if (!audioReady) {
      await fs.unlink(path.join(PUBLIC_DIR, `scene_${sceneId}.mp3`)).catch(() => {});
      // La voix off traitée à la réverbération est dérivée du .brut : la laisser
      // ferait repartir voice:fx d'un original qui ne correspond plus au texte.
      await fs.unlink(path.join(PUBLIC_DIR, `scene_${sceneId}.brut.mp3`)).catch(() => {});
    }
    if (!mediaReady) {
      // Toutes les extensions possibles : le storyboard peut avoir changé de .png
      // à .mp4 pour une même scène, et l'ancien fichier ferait alors croire le
      // média présent.
      for (const ext of ['mp4', 'png', 'jpg', 'jpeg', 'webm']) {
        await fs.unlink(path.join(PUBLIC_DIR, `scene_${sceneId}.${ext}`)).catch(() => {});
      }
    }
  }
}

/** Deletes ALL scene asset files for a fresh, from-scratch render. */
export async function cleanupAllSceneFiles(): Promise<void> {
  try {
    const files = await fs.readdir(PUBLIC_DIR);
    for (const file of files) {
      if (/^scene_\d+.*\.(mp3|mp4|webm|png|jpg|jpeg)$/.test(file)) {
        await fs.unlink(path.join(PUBLIC_DIR, file)).catch(() => {});
      }
    }
  } catch (e) {
    console.error('[RenderCache] Error during full scene cleanup:', e);
  }
}
