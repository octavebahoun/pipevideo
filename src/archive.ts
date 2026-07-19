import * as fs from 'fs/promises';
import * as path from 'path';
import { Storyboard } from './types';

const STORYBOARD_PATH = path.join(process.cwd(), 'storyboard.json');
const PUBLIC_DIR = path.join(process.cwd(), 'public');
const OUT_DIR = path.join(process.cwd(), 'out');
const HISTORY_DIR = path.join(process.cwd(), 'history');

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function archiveCurrentProject(): Promise<boolean> {
  // 1. Vérifier si un storyboard existe
  if (!(await fileExists(STORYBOARD_PATH))) {
    return false;
  }

  try {
    const rawData = await fs.readFile(STORYBOARD_PATH, 'utf-8');
    const storyboard: Storyboard = JSON.parse(rawData);

    // Si le storyboard est vide ou n'a pas de titre, on ignore
    if (!storyboard.title) {
      return false;
    }

    // Nom de dossier propre pour l'archive
    const cleanTitle = storyboard.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/(^_|_$)/g, '');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archiveFolderName = `${timestamp}_${cleanTitle || 'video'}`;
    const archivePath = path.join(HISTORY_DIR, archiveFolderName);
    const archivePublicPath = path.join(archivePath, 'public');

    console.log(`📦 Archivage du projet actuel : "${storyboard.title}"...`);

    // Créer les dossiers de destination
    await fs.mkdir(archivePath, { recursive: true });
    await fs.mkdir(archivePublicPath, { recursive: true });

    // Copier storyboard.json
    await fs.copyFile(STORYBOARD_PATH, path.join(archivePath, 'storyboard.json'));

    // Copier la vidéo finale si elle existe
    const videoPath = path.join(OUT_DIR, 'video.mp4');
    if (await fileExists(videoPath)) {
      await fs.copyFile(videoPath, path.join(archivePath, 'video.mp4'));
      await fs.unlink(videoPath); // Nettoyer
    }

    // Parcourir les scènes pour copier et nettoyer les fichiers média associés
    for (const scene of storyboard.scenes) {
      // 1. Copier et supprimer l'audio de la scène
      const audioFileName = `scene_${scene.id}.mp3`;
      const audioSourcePath = path.join(PUBLIC_DIR, audioFileName);
      if (await fileExists(audioSourcePath)) {
        await fs.copyFile(audioSourcePath, path.join(archivePublicPath, audioFileName));
        await fs.unlink(audioSourcePath);
      }

      // 2. Copier et supprimer l'image/vidéo de la scène
      if (scene.mediaPath) {
        const mediaSourcePath = path.join(PUBLIC_DIR, scene.mediaPath);
        if (await fileExists(mediaSourcePath)) {
          await fs.copyFile(mediaSourcePath, path.join(archivePublicPath, scene.mediaPath));
          await fs.unlink(mediaSourcePath);
        }
      }
    }

    // Supprimer le storyboard.json d'origine
    await fs.unlink(STORYBOARD_PATH);

    console.log(`✅ Projet archivé avec succès dans : ${archivePath}`);
    return true;

  } catch (error: any) {
    console.warn(`⚠️ Erreur lors de l'archivage automatique : ${error.message}`);
    return false;
  }
}

// Permettre l'exécution directe du script
if (require.main === module) {
  archiveCurrentProject().then((archived) => {
    if (!archived) {
      console.log('ℹ️ Aucun projet actif à archiver.');
    }
  });
}
