import 'dotenv/config';
import { deployFunction, getFunctions } from '@remotion/lambda';
import type { AwsRegion } from '@remotion/lambda';
import { capaciteLambda } from './lib/lambdaCapacity';

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
 * La mémoire monte aussi de 2048 à 3008 Mo. Sur Lambda, le CPU est proportionnel
 * à la mémoire : 3008 Mo donnent 2 vCPU, donc deux frames rendues en parallèle
 * au lieu d'une. Le coût par seconde augmente, mais la durée baisse d'autant —
 * la facture reste comparable, avec une marge de timeout bien meilleure.
 *
 * À relancer après chaque montée de version de Remotion : les fonctions sont
 * versionnées, et `getFunctions({ compatibleOnly: true })` ignore les anciennes.
 */

const TIMEOUT_SECONDS = 900; // MAX_TIMEOUT de Remotion, plafond AWS

/**
 * 3008 Mo : le PLAFOND des comptes AWS de base.
 *
 * Un compte non relevé refuse toute valeur supérieure avec « 'MemorySize' value
 * failed to satisfy constraint: Member must have value less than or equal to
 * 3008 ». Viser plus haut fait échouer le déploiement entier — on reste donc
 * sous la limite universelle, quitte à laisser du CPU sur la table pour les
 * comptes qui autorisent davantage.
 *
 * Ce qui compte ici : AWS accorde le second vCPU dès ~1769 Mo, donc 3008 Mo
 * donnent 2 cœurs et permettent de rendre 2 frames en parallèle — le double du
 * défaut de Remotion (2048 Mo, concurrencyPerLambda = 1).
 *
 * Pour dépasser : demander une hausse de « Function memory » au support AWS
 * (souvent débloqué en ajoutant un moyen de paiement), puis remonter ici.
 */
const MEMORY_MB = 3008;
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

  // Repli progressif sur la mémoire : les plafonds varient d'un compte à l'autre
  // (3008 Mo sur un compte de base, parfois moins). Sans ce repli, un plafond plus
  // bas fait échouer tout le déploiement et laisse l'ancienne fonction en place —
  // avec son timeout de 600 s, donc le problème qu'on cherche à corriger.
  const paliers = [MEMORY_MB, 2560, 2048];
  let deploiement: { functionName: string; alreadyExisted: boolean } | null = null;
  let derniereErreur = '';

  for (const memoire of paliers) {
    try {
      deploiement = await deployFunction({
        region,
        timeoutInSeconds: TIMEOUT_SECONDS,
        memorySizeInMb: memoire,
        diskSizeInMb: DISK_MB,
        createCloudWatchLogGroup: true,
      });
      if (memoire !== MEMORY_MB) {
        console.warn(
          `\n⚠️ ${MEMORY_MB} Mo refusés par ce compte AWS — déployé à ${memoire} Mo.\n` +
            `   Pour lever la limite : demander une hausse de « Function memory » au\n` +
            `   support AWS (souvent débloqué en ajoutant un moyen de paiement).`
        );
      }
      break;
    } catch (err: any) {
      derniereErreur = err?.message || String(err);
      // Seul un refus de plafond justifie de réessayer plus bas ; une erreur de
      // droits ou de réseau se reproduirait à l'identique.
      if (!/MemorySize|memory size|less than or equal/i.test(derniereErreur)) throw err;
      console.warn(`[Deploy] ${memoire} Mo refusés, essai à un palier inférieur…`);
    }
  }

  if (!deploiement) {
    throw new Error(`Aucun palier de mémoire accepté. Dernière erreur : ${derniereErreur}`);
  }
  const { functionName, alreadyExisted } = deploiement;

  console.log(
    `\n[Deploy] ✅ ${functionName} ${alreadyExisted ? '(déjà déployée, inchangée)' : 'déployée'}`
  );

  // Les anciennes fonctions ne sont PAS supprimées : elles ne coûtent rien au
  // repos, et render-lambda.ts retient celle au plus grand timeout. Elles sont
  // néanmoins signalées, une fonction obsolète prêtant à confusion au débogage.
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

  // Annoncer la capacité RÉELLE de ce qui vient d'être déployé, calculée par la
  // même formule que le rendu — un chiffre écrit en dur deviendrait faux au
  // premier repli de mémoire.
  const deployee = (await getFunctions({ region, compatibleOnly: true })).find(
    (f) => f.functionName === functionName
  );
  if (deployee) {
    const quota = Number(process.env.RENDER_MAX_LAMBDAS || 10);
    const cap = capaciteLambda(deployee.timeoutInSeconds, deployee.memorySizeInMb, quota, 30);
    console.log('\n[Deploy] Capacité effective :');
    console.log(`   ${cap.concurrencyPerLambda} frame(s) en parallèle par Lambda`);
    console.log(`   ${cap.maxFramesParChunk} frames/chunk · ${cap.renderers} renderers`);
    console.log(`   → ${cap.capaciteMinutes.toFixed(1)} min de vidéo au maximum`);
    // Nommer le facteur limitant réel : conseiller de relever un quota déjà
    // relevé enverrait sur une fausse piste.
    if (cap.concurrencyPerLambda < 3) {
      console.log(
        `\n   Facteur limitant : la mémoire (${deployee.memorySizeInMb} Mo = ` +
          `${cap.concurrencyPerLambda} vCPU). Les comptes de base plafonnent à 3008 Mo ;\n` +
          `   une hausse de « Function memory » auprès du support AWS donnerait un cœur\n` +
          `   de plus, donc des chunks plus gros.`
      );
    } else {
      console.log(
        `\n   Pour aller au-delà : augmenter RENDER_MAX_LAMBDAS (quota du compte permettant).`
      );
    }
  }
}

main().catch((err: any) => {
  console.error('\n❌ Erreur deploy:lambda :', err.message);
  process.exit(1);
});
