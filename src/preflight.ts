import 'dotenv/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { loadStoryboard } from './storyboard';

/**
 * Contrôle avant vol : vérifie ce qui NE PEUT PAS être généré automatiquement.
 *
 *   npm run preflight
 *
 * À lancer en TÊTE de pipeline, avant `npm run runpod`. Motif : `sync:r2`
 * effectue déjà cette vérification, mais il intervient en cinquième position —
 * après la location du GPU. Un fichier musique absent faisait donc payer toute
 * la génération avant d'échouer sur un détail réparable en dix secondes.
 *
 * Ne vérifie QUE les fichiers que le pipeline ne sait pas produire :
 *   - la musique de fond et les sons de scène (déposés à la main)
 * Les voix off (`npm run tts`) et les médias (`npm run runpod`) sont exclus :
 * ils sont censés manquer à ce stade, c'est le pipeline qui les crée.
 */

const PUBLIC_DIR = path.join(process.cwd(), 'public');
const STORYBOARD_PATH = path.join(process.cwd(), 'storyboard.json');

async function existe(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const storyboard = await loadStoryboard(STORYBOARD_PATH);

  // Chemin -> raison de sa présence, pour un message d'erreur utile.
  const attendus = new Map<string, string>();

  if (storyboard.music) {
    attendus.set(storyboard.music, 'musique de fond (champ `music` du storyboard)');
  }
  for (const scene of storyboard.scenes) {
    for (const son of scene.sounds ?? []) {
      attendus.set(son.src, `son de la scène ${scene.id}`);
    }
  }

  if (attendus.size === 0) {
    console.log('[Preflight] Aucun audio de fond référencé — rien à vérifier.');
    return;
  }

  const absents: string[] = [];
  for (const [rel, raison] of attendus) {
    if (!(await existe(path.join(PUBLIC_DIR, rel)))) {
      absents.push(`${rel}  (${raison})`);
    }
  }

  if (absents.length > 0) {
    console.error(`\n❌ ${absents.length} fichier(s) audio introuvable(s) dans public/ :\n`);
    absents.forEach((a) => console.error(`   - ${a}`));
    console.error(
      '\n   Ces fichiers ne sont pas générés par le pipeline : il faut les déposer.\n' +
        '   Les .mp3 ne sont pas versionnés dans git — sur un serveur, les copier\n' +
        '   dans le volume : docker cp public/sounds/. <conteneur>:/app/public/sounds/\n' +
        '   Voir public/sounds/CATALOG.md pour les chemins disponibles.\n'
    );
    process.exit(1);
  }

  console.log(`[Preflight] ✅ ${attendus.size} audio de fond présent(s).`);
}

main().catch((err: any) => {
  console.error('\n❌ Erreur preflight :', err.message);
  process.exit(1);
});
