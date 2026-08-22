import 'dotenv/config';
import { createPod, waitForPod, armKillSwitch, cleanOrphanPods } from './lib/runpodClient';

/**
 * Vérifie que l'auto-destruction fonctionne SANS ce processus.
 * Crée un pod, arme le compte à rebours à 2 min, puis sort immédiatement.
 * Le pod doit disparaître seul — c'est le scénario de la session fermée.
 */
(async () => {
  await cleanOrphanPods();
  const id = await createPod(`pipevideo-testks-${Date.now()}`);
  const pod = await waitForPod(id);
  await armKillSwitch(pod, 2);
  console.log(`\n>>> Pod ${id} armé pour auto-destruction dans 2 min.`);
  console.log('>>> Ce processus sort MAINTENANT. Le pod doit disparaître seul.');
  process.exit(0);
})();
