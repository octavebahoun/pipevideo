import 'dotenv/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { spawn } from 'child_process';
import { loadStoryboard } from './storyboard';

/**
 * Ajoute une réverbération à la voix off, pour la profondeur.
 *
 *   npm run voice:fx
 *
 * À lancer APRÈS `npm run tts` et AVANT `npm run check-video` : la queue de
 * réverbération allonge légèrement chaque fichier (~45 ms en 'leger'), et
 * check-video doit mesurer les durées définitives pour calculer les ralentis.
 *
 * L'original est conservé en `.brut.mp3` : relancer le script repart de lui,
 * donc l'effet ne s'accumule jamais — sans quoi chaque passage ajouterait une
 * réverbération par-dessus la précédente jusqu'à rendre la voix inintelligible.
 */

const MEDIA_DIR = path.join(process.cwd(), 'public');
const STORYBOARD_PATH = path.join(process.cwd(), 'storyboard.json');

/**
 * Réglages `aecho` de ffmpeg : in_gain:out_gain:delais_ms:decroissances.
 *
 * 'leger' est le défaut : une seule réflexion courte. Validé à l'écoute contre
 * 'moyen' et 'ample' — au-delà, sur une narration de quinze minutes, la
 * réverbération fatigue et nuit à l'intelligibilité.
 */
const PRESETS: Record<string, string> = {
  leger: 'aecho=0.8:0.85:45:0.16',
  moyen: 'aecho=0.8:0.85:60|120:0.22|0.11',
  ample: 'aecho=0.8:0.88:80|160|240:0.3|0.17|0.09',
};

function ffmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', ['-y', '-v', 'error', ...args]);
    let err = '';
    p.stderr.on('data', (d) => (err += d));
    p.on('error', (e) => reject(new Error(`ffmpeg introuvable : ${e.message}`)));
    p.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(err.slice(0, 300) || `ffmpeg a quitté avec ${code}`))
    );
  });
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const preset = process.argv[2] || process.env.VOICE_FX || 'leger';
  const filtre = PRESETS[preset];
  if (!filtre) {
    console.error(`❌ Preset inconnu : "${preset}". Disponibles : ${Object.keys(PRESETS).join(', ')}.`);
    process.exit(1);
  }

  const storyboard = await loadStoryboard(STORYBOARD_PATH);
  console.log(`[Voice FX] Réverbération « ${preset} » : ${filtre}`);

  let traites = 0;
  let absents = 0;

  for (const scene of storyboard.scenes) {
    if (scene.card) continue;

    const nom = scene.audioPath ?? `scene_${scene.id}.mp3`;
    const cible = path.join(MEDIA_DIR, nom);
    const brut = cible.replace(/\.mp3$/, '.brut.mp3');

    // Première passe : on met l'original de côté. Passes suivantes : on repart
    // de cet original, jamais du fichier déjà traité.
    if (!(await exists(brut))) {
      if (!(await exists(cible))) {
        console.warn(`[Voice FX] Scène ${scene.id} : ${nom} absent — lance d'abord npm run tts.`);
        absents++;
        continue;
      }
      await fs.copyFile(cible, brut);
    }

    await ffmpeg(['-i', brut, '-af', filtre, cible]);
    traites++;
    process.stdout.write(`\r[Voice FX] ${traites} voix traitées...`);
  }

  process.stdout.write('\n');
  console.log(`[Voice FX] ✅ ${traites} voix traitées.`);
  if (absents > 0) {
    console.warn(`[Voice FX] ⚠️ ${absents} voix off manquantes — relance npm run tts.`);
  }
  console.log('[Voice FX] Pense à relancer npm run check-video : les durées ont changé.');
}

main().catch((err: any) => {
  console.error('\n❌ Erreur voice:fx :', err.message);
  process.exit(1);
});
