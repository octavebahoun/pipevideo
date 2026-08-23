import 'dotenv/config';

/**
 * Recolle la credential Telegram sur les nœuds qui en manquent.
 *
 *   npx ts-node script/n8n-fix-creds.ts --appliquer
 *
 * n8n refuse de publier un nœud Telegram sans credential (« Missing required
 * credential: telegramApi ») — mais il a tout de même enregistré les nœuds lors
 * de la tentative refusée. Ce script rattrape cet état intermédiaire en
 * reprenant la credential d'un nœud Telegram déjà correct.
 */

const WORKFLOW_ID = 'N7QqkFioBCagCp78';
const APPLIQUER = process.argv.includes('--appliquer');

async function requete(chemin: string, init: RequestInit = {}) {
  const base = (process.env.N8N_API_URL || '').replace(/\/$/, '') + '/api/v1';
  const key = process.env.N8N_API_KEY;
  if (!key) throw new Error('N8N_API_KEY absent du .env');
  const res = await fetch(`${base}${chemin}`, {
    ...init,
    headers: { 'X-N8N-API-KEY': key, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  const texte = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} : ${texte.slice(0, 300)}`);
  return texte ? JSON.parse(texte) : null;
}

async function main() {
  const wf = await requete(`/workflows/${WORKFLOW_ID}`);

  const modele = wf.nodes.find(
    (n: any) => n.type === 'n8n-nodes-base.telegram' && n.credentials?.telegramApi
  );
  if (!modele) throw new Error('Aucun nœud Telegram correctement configuré à copier.');

  const aCorriger = wf.nodes.filter(
    (n: any) => n.type === 'n8n-nodes-base.telegram' && !n.credentials?.telegramApi
  );

  if (aCorriger.length === 0) {
    console.log('✅ Tous les nœuds Telegram ont leur credential.');
    return;
  }

  console.log(`Credential source : ${JSON.stringify(modele.credentials.telegramApi)}`);
  console.log(`À corriger : ${aCorriger.map((n: any) => n.name).join(', ')}`);

  for (const n of aCorriger) n.credentials = modele.credentials;

  if (!APPLIQUER) {
    console.log('\n(aperçu — relance avec --appliquer)');
    return;
  }

  await requete(`/workflows/${WORKFLOW_ID}`, {
    method: 'PUT',
    body: JSON.stringify({
      name: wf.name,
      nodes: wf.nodes,
      connections: wf.connections,
      settings: wf.settings ?? {},
    }),
  });

  const apres = await requete(`/workflows/${WORKFLOW_ID}`);
  const restants = apres.nodes.filter(
    (n: any) => n.type === 'n8n-nodes-base.telegram' && !n.credentials?.telegramApi
  );
  console.log(
    restants.length === 0
      ? `\n✅ Corrigé — ${apres.nodes.length} nœuds, ${apres.active ? 'actif' : 'INACTIF'}`
      : `\n⚠️ Il reste ${restants.length} nœud(s) sans credential.`
  );
}

main().catch((err: any) => {
  console.error('\n❌', err.message);
  process.exit(1);
});
