import 'dotenv/config';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import * as fs from 'fs/promises';
import * as path from 'path';
import { loadStoryboard } from './storyboard';

const STORYBOARD_PATH = path.join(process.cwd(), 'storyboard.json');
const ENTRY_POINT = path.join(process.cwd(), 'src/video/index.tsx');
const OUTPUT_DIR = path.join(process.cwd(), 'out');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'video.mp4');

/**
 * Chemin d'un Chrome/Chromium déjà installé sur la machine (ex: variable
 * CHROME_EXECUTABLE_PATH dans .env). Si absente ou explicitement "false",
 * on laisse `browserExecutable` à `undefined` : Remotion télécharge et
 * gère alors lui-même son propre Chromium headless (comportement par défaut).
 */
const CHROME_EXECUTABLE_PATH = process.env.CHROME_EXECUTABLE_PATH;
const browserExecutable =
  CHROME_EXECUTABLE_PATH && CHROME_EXECUTABLE_PATH !== 'false' ? CHROME_EXECUTABLE_PATH : undefined;

async function main() {
  try {
    // 1. Lire et valider le storyboard.json
    console.log(`Lecture du storyboard depuis : ${STORYBOARD_PATH}`);
    const storyboard = await loadStoryboard(STORYBOARD_PATH);

    // S'assurer que le dossier out/ existe
    await fs.mkdir(OUTPUT_DIR, { recursive: true });

    // 2. Compiler le projet Remotion (Webpack bundling)
    console.log('Compilation du projet Remotion (Webpack bundling)...');
    const bundleLocation = await bundle({
      entryPoint: ENTRY_POINT,
    });

    console.log('Sélection de la composition...');
    console.log(
      browserExecutable
        ? `Navigateur : ${browserExecutable} (CHROME_EXECUTABLE_PATH)`
        : 'Navigateur : Chromium géré par Remotion (téléchargement automatique si besoin)'
    );
    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: 'ContentFactory',
      inputProps: {
        storyboard,
      },
      browserExecutable,
    });

    console.log(`Lancement du rendu vidéo :`);
    console.log(`- Résolution : ${composition.width}x${composition.height}`);
    console.log(`- FPS : ${composition.fps}`);
    console.log(`- Durée : ${(composition.durationInFrames / composition.fps).toFixed(2)}s (${composition.durationInFrames} frames)`);

    // 3. Effectuer le rendu media
    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: 'h264',
      outputLocation: OUTPUT_FILE,
      inputProps: {
        storyboard,
      },
      browserExecutable,
      onProgress: ({ progress, renderedFrames }) => {
        const percent = Math.floor(progress * 100);
        process.stdout.write(
          `\rRendu en cours : ${percent}% (${renderedFrames}/${composition.durationInFrames} images)`
        );
      },
    });

    console.log(`\n\n✅ Rendu terminé avec succès !`);
    console.log(`Vidéo finale disponible dans : ${OUTPUT_FILE}`);

  } catch (error: any) {
    console.error('\n❌ Une erreur est survenue lors du rendu vidéo :', error.message);
    process.exit(1);
  }
}

main();
