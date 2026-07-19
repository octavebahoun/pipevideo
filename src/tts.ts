import { EdgeTTS } from 'edge-tts-universal';
import { parseFile } from 'music-metadata';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Storyboard } from './types';

const STORYBOARD_PATH = path.join(process.cwd(), 'storyboard.json');
const MEDIA_DIR = path.join(process.cwd(), 'public');

async function main() {
  try {
    // 1. Lire le storyboard.json
    console.log(`Lecture du storyboard depuis : ${STORYBOARD_PATH}`);
    const rawData = await fs.readFile(STORYBOARD_PATH, 'utf-8');
    const storyboard: Storyboard = JSON.parse(rawData);

    // 2. Créer le dossier media s'il n'existe pas
    await fs.mkdir(MEDIA_DIR, { recursive: true });

    const voice = storyboard.voice || 'fr-FR-HenriNeural';
    console.log(`Voix utilisée : ${voice}`);

    // 3. Parcourir et générer la voix-off pour chaque scène
    for (const scene of storyboard.scenes) {
      console.log(`\nTraitement de la scène ${scene.id}...`);
      console.log(`Texte : "${scene.narration}"`);

      // Chemin du fichier audio pour cette scène
      const audioFileName = `scene_${scene.id}.mp3`;
      const audioFilePath = path.join(MEDIA_DIR, audioFileName);

      // Générer avec EdgeTTS
      const tts = new EdgeTTS(scene.narration, voice);
      const result = await tts.synthesize();
      const audioBuffer = Buffer.from(await result.audio.arrayBuffer());
      await fs.writeFile(audioFilePath, audioBuffer);
      console.log(`Audio généré et sauvegardé dans : ${audioFilePath}`);

      // Mesurer la durée exacte du fichier audio
      const metadata = await parseFile(audioFilePath);
      const duration = metadata.format.duration;

      if (duration === undefined) {
        throw new Error(`Impossible de lire la durée du fichier audio : ${audioFilePath}`);
      }

      console.log(`Durée calculée : ${duration.toFixed(2)} secondes`);

      // Mettre à jour la durée dans le JSON
      scene.durationInSeconds = duration;
    }

    // 4. Sauvegarder le storyboard mis à jour
    await fs.writeFile(STORYBOARD_PATH, JSON.stringify(storyboard, null, 2), 'utf-8');
    console.log(`\n✅ Storyboard synchronisé avec succès dans storyboard.json !`);

  } catch (error: any) {
    console.error('❌ Une erreur est survenue lors de la génération TTS :', error.message);
    process.exit(1);
  }
}

main();
