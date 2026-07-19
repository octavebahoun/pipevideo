import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Storyboard } from './types';

const STORYBOARD_PATH = path.join(process.cwd(), 'storyboard.json');
const ENTRY_POINT = path.join(process.cwd(), 'src/video/index.tsx');
const OUTPUT_DIR = path.join(process.cwd(), 'out');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'video.mp4');

async function main() {
  try {
    // 1. Lire le storyboard.json
    console.log(`Lecture du storyboard depuis : ${STORYBOARD_PATH}`);
    const rawData = await fs.readFile(STORYBOARD_PATH, 'utf-8');
    const storyboard: Storyboard = JSON.parse(rawData);

    // S'assurer que le dossier out/ existe
    await fs.mkdir(OUTPUT_DIR, { recursive: true });

    // 2. Compiler le projet Remotion (Webpack bundling)
    console.log('Compilation du projet Remotion (Webpack bundling)...');
    const bundleLocation = await bundle({
      entryPoint: ENTRY_POINT,
    });

    console.log('Sélection de la composition...');
    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: 'ContentFactory',
      inputProps: {
        storyboard,
      },
      browserExecutable: '/usr/bin/google-chrome-stable',
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
      browserExecutable: '/usr/bin/google-chrome-stable',
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
