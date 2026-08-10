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
    const videoFullPath = path.join(PUBLIC_DIR, `scene_${scene.id}.mp4`);

    const narrationChanged = !prevScene || prevScene.narration !== scene.narration;
    const audioStale = narrationChanged || voiceChanged;
    const audioReady = !audioStale && (await fileExists(audioFullPath));

    const promptChanged = !prevScene || prevScene.mediaPrompt !== scene.mediaPrompt;
    const noTaskId = !scene.novitaTaskId && !scene.mediaPath;
    const mediaStale = promptChanged || narrationChanged || noTaskId;
    const mediaReady = !mediaStale && (await fileExists(videoFullPath));

    results.push({ sceneId: scene.id, audioReady, mediaReady });
  }

  return results;
}

/** Deletes only the scene files that computeSceneCacheStatus flagged as stale. */
export async function cleanupStaleSceneFiles(cacheStatus: SceneCacheStatus[]): Promise<void> {
  for (const { sceneId, audioReady, mediaReady } of cacheStatus) {
    if (!audioReady) {
      await fs.unlink(path.join(PUBLIC_DIR, `scene_${sceneId}.mp3`)).catch(() => {});
    }
    if (!mediaReady) {
      await fs.unlink(path.join(PUBLIC_DIR, `scene_${sceneId}.mp4`)).catch(() => {});
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
