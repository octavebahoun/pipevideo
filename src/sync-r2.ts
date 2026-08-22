import 'dotenv/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { loadStoryboard } from './storyboard';
import { Storyboard } from './types';

/**
 * Envoie sur Cloudflare R2 les médias qui ne peuvent pas venir du pod GPU.
 *
 *   npm run sync:r2
 *
 * Les images et les clips partent déjà du pod directement (voir src/runpod.ts).
 * Restent les fichiers produits en local ou puisés dans la bibliothèque :
 *   - les voix off générées par `npm run tts`
 *   - les bruitages et musiques de public/sounds/
 *   - les icônes des titres animés
 *
 * Sans cette étape, les Lambdas ne trouveraient pas ces fichiers : elles lisent
 * tout depuis `storyboard.assetBaseUrl`.
 *
 * Idempotent : un objet déjà présent sur R2 avec la même taille n'est pas
 * réenvoyé, donc relancer le script est sans coût.
 */

const STORYBOARD_PATH = path.join(process.cwd(), 'storyboard.json');
const PUBLIC_DIR = path.join(process.cwd(), 'public');

const TYPES: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.wav': 'audio/wav',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.svg': 'image/svg+xml',
};

function credentials() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID || process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME || process.env.CLOUDFLARE_R2_BUCKET_NAME;
  const publicDomain = process.env.R2_PUBLIC_DOMAIN || process.env.CLOUDFLARE_R2_PUBLIC_URL;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;
  return { accountId: accountId.trim(), accessKeyId, secretAccessKey, bucket, publicDomain };
}

/** Tous les fichiers de public/ dont le rendu a besoin, hors médias de scène. */
function assetsAnnexes(storyboard: Storyboard): string[] {
  const set = new Set<string>();

  if (storyboard.music) set.add(storyboard.music);

  for (const scene of storyboard.scenes) {
    if (scene.card) continue; // ni média, ni voix, ni son

    // Voix off : soit fournie, soit produite par tts.ts sous ce nom.
    set.add(scene.audioPath ?? `scene_${scene.id}.mp3`);

    for (const s of scene.sounds ?? []) set.add(s.src);
    if (scene.kineticTitle?.icon) set.add(scene.kineticTitle.icon);
  }

  return [...set];
}

async function main() {
  const creds = credentials();
  if (!creds) {
    console.error('❌ R2 non configuré (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME).');
    process.exit(1);
  }

  const storyboard = await loadStoryboard(STORYBOARD_PATH);
  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${creds.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: creds.accessKeyId, secretAccessKey: creds.secretAccessKey },
  });

  const assets = assetsAnnexes(storyboard);
  console.log(`[R2 Sync] ${assets.length} fichiers annexes à vérifier (voix off, sons, icônes).`);

  let envoyes = 0;
  let deja = 0;
  const absents: string[] = [];

  for (const rel of assets) {
    const local = path.join(PUBLIC_DIR, rel);

    let taille: number;
    try {
      taille = (await fs.stat(local)).size;
    } catch {
      absents.push(rel);
      continue;
    }

    // Déjà sur R2 à l'identique ? On ne réenvoie pas.
    try {
      const tete = await s3.send(new HeadObjectCommand({ Bucket: creds.bucket, Key: rel }));
      if (tete.ContentLength === taille) {
        deja++;
        continue;
      }
    } catch {
      /* absent de R2 : on envoie */
    }

    await s3.send(
      new PutObjectCommand({
        Bucket: creds.bucket,
        Key: rel,
        Body: await fs.readFile(local),
        ContentType: TYPES[path.extname(rel).toLowerCase()] ?? 'application/octet-stream',
      })
    );
    console.log(`[R2 Sync] ↑ ${rel} (${(taille / 1e3).toFixed(0)} ko)`);
    envoyes++;
  }

  console.log(`\n[R2 Sync] ✅ ${envoyes} envoyés, ${deja} déjà à jour.`);

  if (absents.length > 0) {
    // Bloquant : sans ces fichiers, les Lambdas rendront une vidéo muette ou
    // échoueront. Mieux vaut le savoir maintenant qu'après 10 min de rendu.
    console.error(`\n❌ ${absents.length} fichiers introuvables dans public/ :`);
    absents.forEach((a) => console.error(`   - ${a}`));
    console.error('\n   Lance `npm run tts` pour les voix off manquantes.');
    process.exit(1);
  }

  // Le storyboard doit porter la base d'URL, sinon le rendu cherchera en local.
  if (creds.publicDomain) {
    const base = creds.publicDomain.replace(/\/$/, '');
    if (storyboard.assetBaseUrl !== base) {
      (storyboard as any).assetBaseUrl = base;
      await fs.writeFile(STORYBOARD_PATH, JSON.stringify(storyboard, null, 2), 'utf-8');
      console.log(`[R2 Sync] assetBaseUrl écrit dans storyboard.json : ${base}`);
    }
  } else {
    console.warn('\n⚠️ R2_PUBLIC_DOMAIN absent : le rendu ne saura pas où lire les médias.');
  }
}

main().catch((err: any) => {
  console.error('\n❌ Erreur sync:r2 :', err.message);
  process.exit(1);
});
