import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import {
  deploySite,
  getOrCreateBucket,
  getFunctions,
  renderMediaOnLambda,
  getRenderProgress,
  downloadMedia,
} from '@remotion/lambda';
import type { AwsRegion } from '@remotion/lambda';
import { loadStoryboard } from './storyboard';
import { Storyboard, getTotalDurationInFrames } from './types';

/**
 * Rendu CLOUD (miroir de src/render.ts, mais sur AWS Lambda).
 *
 *   npm run render:lambda
 *
 * - Optimisé : n'uploade QUE les assets référencés par le storyboard (staging) et
 *   coupe les source maps → upload ~÷3.
 * - Résilient : chaque appel réseau est ré-essayé (backoff) sur connexion instable
 *   (ETIMEDOUT, ECONNRESET…), pour ne pas crasher au moindre timeout.
 */

const STORYBOARD_PATH = path.join(process.cwd(), 'storyboard.json');
const ENTRY_POINT = path.join(process.cwd(), 'src/video/index.tsx');
const PUBLIC_DIR = path.join(process.cwd(), 'public');
const OUTPUT_DIR = path.join(process.cwd(), 'out');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'video.mp4');
const SITE_NAME = 'content-factory';
const COMPOSITION_ID = 'ContentFactory';

/** Charge .env (REMOTION_AWS_REGION, etc.) sans dépendance externe. */
async function loadDotenv() {
  try {
    const raw = await fs.readFile(path.join(process.cwd(), '.env'), 'utf-8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
      }
    }
  } catch {
    /* pas de .env : on ignore */
  }
}

/** Ré-essaie une opération réseau tant que l'erreur est transitoire (backoff exponentiel). */
async function withRetry<T>(label: string, fn: () => Promise<T>, attempts = 4): Promise<T> {
  let lastErr: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = String((err as any)?.message ?? err);
      const transient =
        /ETIMEDOUT|ETIMEOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|EPIPE|socket hang up|timeout|network|Throttl|Rate exceeded|ProvisionedThroughput|503|500/i.test(
          msg
        );
      if (!transient || i === attempts) throw err;
      const delay = Math.min(20000, 2000 * 2 ** (i - 1)); // 2s, 4s, 8s, 16s (max 20s)
      console.warn(
        `⚠️  ${label} : ${msg}\n    → nouvel essai ${i + 1}/${attempts} dans ${delay / 1000}s…`
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

/** Chemins (relatifs à public/) de TOUS les assets réellement utilisés par le storyboard. */
function collectReferencedAssets(storyboard: Storyboard): string[] {
  const set = new Set<string>();
  if (storyboard.music) set.add(storyboard.music);
  for (const scene of storyboard.scenes) {
    if (scene.card) continue; // carte de fin : ni média, ni voix, ni son
    if (scene.mediaPath) set.add(scene.mediaPath);
    set.add(scene.audioPath ?? `scene_${scene.id}.mp3`); // voix off
    for (const s of scene.sounds ?? []) set.add(s.src);
  }
  return [...set];
}

/** Copie les assets référencés dans un publicDir temporaire (sous-chemins conservés). */
async function stageAssets(assets: string[]): Promise<string> {
  const stagingDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rl-public-'));
  const missing: string[] = [];
  let copied = 0;
  for (const rel of assets) {
    const src = path.join(PUBLIC_DIR, rel);
    try {
      await fs.access(src);
    } catch {
      missing.push(rel);
      continue;
    }
    const dest = path.join(stagingDir, rel);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(src, dest);
    copied++;
  }
  if (missing.length) {
    throw new Error(`Assets référencés introuvables dans public/ :\n  - ${missing.join('\n  - ')}`);
  }
  console.log(`Staging : ${copied} assets utiles copiés (au lieu de tout public/).`);
  return stagingDir;
}

async function main() {
  await loadDotenv();
  const region = (process.env.REMOTION_AWS_REGION || 'eu-west-3') as AwsRegion;

  const storyboard = await loadStoryboard(STORYBOARD_PATH);
  console.log(`Projet : "${storyboard.title}" | région : ${region}`);

  // 1. Retrouver la fonction Lambda déployée (compatible avec cette version).
  const functions = await withRetry('recherche de la fonction', () =>
    getFunctions({ region, compatibleOnly: true })
  );
  if (functions.length === 0) {
    throw new Error(
      `Aucune fonction Lambda compatible dans ${region}.\n` +
      `Déploie-la d'abord : npx remotion lambda functions deploy`
    );
  }
  const functionName = functions[0].functionName;
  console.log(`Fonction : ${functionName}`);

  // 2. Stager les assets référencés, puis (re)déployer le site (sans source maps).
  const { bucketName } = await withRetry('accès au bucket', () => getOrCreateBucket({ region }));
  console.log(`Bucket   : ${bucketName}`);
  const stagingDir = await stageAssets(collectReferencedAssets(storyboard));
  console.log('Déploiement du site (assets utiles + bundle sans source maps)…');
  let serveUrl: string;
  try {
    ({ serveUrl } = await withRetry('déploiement du site', () =>
      deploySite({
        entryPoint: ENTRY_POINT,
        bucketName,
        region,
        siteName: SITE_NAME,
        options: {
          publicDir: stagingDir,
          webpackOverride: (config) => ({ ...config, devtool: false }),
          onUploadProgress: (p: { totalSize: number; sizeUploaded: number }) => {
            const pct = Math.round((p.sizeUploaded / (p.totalSize || 1)) * 100);
            process.stdout.write(`\rEnvoi des fichiers sur S3 : ${pct}% (${(p.sizeUploaded / 1_000_000).toFixed(1)} / ${(p.totalSize / 1_000_000).toFixed(1)} Mo)   `);
          },
        },
      })
    ));
  } finally {
    await fs.rm(stagingDir, { recursive: true, force: true });
  }
  console.log(`Site     : ${serveUrl}`);

  // Limiter le nombre de Lambdas en parallèle. Un compte AWS neuf a un quota de
  // concurrence bas → "Rate Exceeded". Ajustable via RENDER_MAX_LAMBDAS (monte-le
  // après une augmentation de quota pour un rendu plus rapide).
  const maxLambdas = Number(process.env.RENDER_MAX_LAMBDAS || 30);
  const totalFrames = getTotalDurationInFrames(storyboard);
  const framesPerLambda = Math.max(20, Math.ceil(totalFrames / maxLambdas));
  const estLambdas = Math.ceil(totalFrames / framesPerLambda);

  // 3. Lancer le rendu sur Lambda. (Un retry peut, en cas de timeout APRÈS invoke
  //    réussi, lancer un 2e rendu — surcoût négligeable, on garde le dernier renderId.)
  console.log(
    `Lancement du rendu sur Lambda… (~${estLambdas} Lambdas, framesPerLambda=${framesPerLambda})`
  );
  const { renderId } = await withRetry(
    'lancement du rendu',
    () =>
      renderMediaOnLambda({
        region,
        functionName,
        serveUrl,
        composition: COMPOSITION_ID,
        inputProps: { storyboard },
        codec: 'h264',
        privacy: 'no-acl',
        framesPerLambda,
      }),
    5
  );
  console.log(`Rendu lancé : ${renderId}`);

  // 4. Suivre la progression (chaque sondage est résilient aux coupures).
  while (true) {
    const progress = await withRetry('suivi du rendu', () =>
      getRenderProgress({ renderId, bucketName, functionName, region })
    );
    if (progress.fatalErrorEncountered) {
      throw new Error(
        `Erreur de rendu Lambda :\n${progress.errors.map((e) => e.message).join('\n')}`
      );
    }
    if (progress.done) {
      process.stdout.write('\rRendu Lambda : 100%          \n');
      break;
    }
    process.stdout.write(`\rRendu Lambda : ${Math.round(progress.overallProgress * 100)}%   `);
    await new Promise((r) => setTimeout(r, 1500));
  }

  // 5. Télécharger le résultat dans out/video.mp4.
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const { outputPath, sizeInBytes } = await withRetry('téléchargement', () =>
    downloadMedia({ bucketName, renderId, region, outPath: OUTPUT_FILE })
  );
  console.log(`\n✅ Vidéo rendue sur Lambda et téléchargée : ${outputPath}`);
  console.log(`   Taille : ${(sizeInBytes / 1_000_000).toFixed(1)} Mo`);
}

main().catch((err: any) => {
  console.error('\n❌ Erreur render:lambda :', err.message);
  process.exit(1);
});
