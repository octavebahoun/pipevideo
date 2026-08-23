import 'dotenv/config';
import { deployFunction, getFunctions } from '@remotion/lambda';
import type { AwsRegion } from '@remotion/lambda';

/**
 * (Re)déploie la fonction Lambda de rendu avec le timeout MAXIMAL.
 *
 *   npm run deploy:lambda
 *
 * Pourquoi ce script existe : la fonction déployée par défaut plafonne à 600 s,
 * alors qu'AWS en autorise 900 (MAX_TIMEOUT de Remotion). C'est 50 % de marge
 * abandonnée sans raison — et c'est ce qui a fait échouer un rendu de 15 min à
 * 58 %, après la génération GPU, donc en pure perte.
 *
 * La mémoire monte aussi de 2048 à 3072 Mo. Sur Lambda, le CPU est proportionnel
 * à la mémoire : plus de mémoire = plus de vCPU = rendu plus rapide. Le coût par
 * seconde augmente d'autant, mais la durée baisse dans les mêmes proportions —
 * la facture reste comparable, avec une marge de timeout bien meilleure.
 *
 * À relancer après chaque montée de version de Remotion : les fonctions sont
 * versionnées, et `getFunctions({ compatibleOnly: true })` ignore les anciennes.
 */

const TIMEOUT_SECONDS = 900; // MAX_TIMEOUT de Remotion, plafond AWS

/**
 * 5312 Mo = 3 vCPU pleins (AWS alloue ~1 vCPU par 1769 Mo).
 *
 * C'est le poste qui décide de la longueur maximale d'une vidéo : render-lambda.ts
 * en déduit `concurrencyPerLambda`, donc le nombre de frames qu'un chunk peut
 * rendre avant le timeout. Passer de 2048 à 5312 Mo triple la capacité.
 *
 * La facture ne triple pas pour autant : Lambda facture à la Go-seconde, et le
 * rendu dure d'autant moins longtemps. Le surcoût réel est celui de la contention
 * (~20 %), pas celui de la mémoire.
 */
const MEMORY_MB = 5312;
const DISK_MB = 4096; // vidéos longues : frames intermédiaires + audio

async function main() {
  const region = (process.env.REMOTION_AWS_REGION || 'eu-west-3') as AwsRegion;

  console.log(`[Deploy] Région : ${region}`);
  console.log(`[Deploy] Timeout ${TIMEOUT_SECONDS}s · ${MEMORY_MB} Mo RAM · ${DISK_MB} Mo disque`);

  const avant = await getFunctions({ region, compatibleOnly: true });
  if (avant.length > 0) {
    console.log('\n[Deploy] Fonctions compatibles déjà en place :');
    for (const f of avant) {
      console.log(`   - ${f.functionName} (timeout ${f.timeoutInSeconds}s, ${f.memorySizeInMb} Mo)`);
    }
  }

  const { functionName, alreadyExisted } = await deployFunction({
    region,
    timeoutInSeconds: TIMEOUT_SECONDS,
    memorySizeInMb: MEMORY_MB,
    diskSizeInMb: DISK_MB,
    createCloudWatchLogGroup: true,
  });

  console.log(
    `\n[Deploy] ✅ ${functionName} ${alreadyExisted ? '(déjà déployée, inchangée)' : 'déployée'}`
  );

  // Les anciennes fonctions ne sont PAS supprimées : elles ne coûtent rien au
  // repos, et `getFunctions` retourne la liste — src/render-lambda.ts prend
  // functions[0]. Si une fonction à 600 s traîne devant celle-ci, le rendu
  // repartirait sur l'ancien timeout.
  const apres = await getFunctions({ region, compatibleOnly: true });
  const anciennes = apres.filter((f) => f.timeoutInSeconds < TIMEOUT_SECONDS);
  if (anciennes.length > 0) {
    console.warn(
      `\n⚠️ ${anciennes.length} fonction(s) au timeout inférieur sont encore déployées :`
    );
    anciennes.forEach((f) => console.warn(`   - ${f.functionName} (${f.timeoutInSeconds}s)`));
    console.warn(
      `   render-lambda.ts choisit désormais la fonction au plus grand timeout,\n` +
        `   donc ce n'est pas bloquant. Pour faire le ménage :\n` +
        anciennes.map((f) => `   npx remotion lambda functions rm ${f.functionName}`).join('\n')
    );
  }

  console.log('\n[Deploy] Capacité par chunk :');
  console.log(`   ${TIMEOUT_SECONDS}s à ~0,5 s/frame ≈ 1700 frames ≈ 57 s de vidéo`);
  console.log(`   Avec 8 renderers : ≈ 7,5 min de vidéo par rendu.`);
  console.log(`   Au-delà, faire relever le quota AWS « Concurrent executions ».`);
}

main().catch((err: any) => {
  console.error('\n❌ Erreur deploy:lambda :', err.message);
  process.exit(1);
});
