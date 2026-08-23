import 'dotenv/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { loadStoryboard } from './storyboard';
import { getTotalDurationInFrames, FPS } from './types';
import { capaciteLambda } from './lib/lambdaCapacity';

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
    console.log('[Preflight] Aucun audio de fond référencé.');
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

  if (attendus.size > 0) {
    console.log(`[Preflight] ✅ ${attendus.size} audio de fond présent(s).`);
  }

  await verifierCapaciteLambda(storyboard);
}

/**
 * Refuse une vidéo trop longue pour la capacité Lambda, AVANT la génération GPU.
 *
 * render-lambda.ts fait déjà ce contrôle, mais il intervient en dernier : un
 * rendu de 15 min a été refusé après huit minutes de génération payée. Ici, le
 * même calcul coûte un appel d'API.
 *
 * Volontairement NON bloquant sur les erreurs d'API : si AWS est injoignable, on
 * laisse passer plutôt que d'interdire un rendu pour un souci réseau. Le contrôle
 * en aval reste là comme filet.
 */
async function verifierCapaciteLambda(storyboard: any) {
  if (process.env.RENDER_ON_LAMBDA !== 'true') return;

  const totalFrames = getTotalDurationInFrames(storyboard);
  const minutes = totalFrames / (FPS * 60);

  let timeout = 900;
  let memoire = 2048;
  try {
    const { getFunctions } = await import('@remotion/lambda');
    const region = (process.env.REMOTION_AWS_REGION || 'eu-west-3') as any;
    const fns = await getFunctions({ region, compatibleOnly: true });
    if (fns.length === 0) {
      console.warn('[Preflight] ⚠️ Aucune fonction Lambda déployée — lance npm run deploy:lambda.');
      return;
    }
    // Même sélection que render-lambda.ts : la fonction au plus grand timeout.
    const fn = fns.reduce((m, f) => (f.timeoutInSeconds > m.timeoutInSeconds ? f : m));
    timeout = fn.timeoutInSeconds;
    memoire = fn.memorySizeInMb;
  } catch (err: any) {
    console.warn(`[Preflight] ⚠️ Capacité Lambda non vérifiée (${err.message}).`);
    return;
  }

  const quota = Number(process.env.RENDER_MAX_LAMBDAS || 10);
  const { capaciteFrames, maxFramesParChunk, renderers, concurrencyPerLambda } = capaciteLambda(
    timeout,
    memoire,
    quota,
    FPS
  );

  if (totalFrames > capaciteFrames) {
    const capaciteMin = (capaciteFrames / (FPS * 60)).toFixed(1);
    console.error(
      `\n❌ Vidéo trop longue pour la capacité Lambda actuelle.\n` +
        `   Demandé : ${minutes.toFixed(1)} min (${totalFrames} frames)\n` +
        `   Capacité : ${capaciteMin} min (${renderers} renderers × ${maxFramesParChunk} frames, timeout ${timeout}s)\n\n` +
        (timeout < 900
          ? `   → npm run deploy:lambda  (timeout ${timeout}s → 900s, gain immédiat)\n`
          : `   → Faire relever le quota AWS « Concurrent executions », puis RENDER_MAX_LAMBDAS.\n`) +
        `   → Ou demander une vidéo plus courte (moins de scènes).\n\n` +
        `   Arrêt AVANT la génération GPU : rien n'a été dépensé.\n`
    );
    process.exit(1);
  }

  console.log(
    `[Preflight] ✅ ${minutes.toFixed(1)} min tiennent dans la capacité Lambda ` +
      `(${(capaciteFrames / (FPS * 60)).toFixed(1)} min, timeout ${timeout}s).`
  );
}

main().catch((err: any) => {
  console.error('\n❌ Erreur preflight :', err.message);
  process.exit(1);
});
