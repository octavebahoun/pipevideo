import 'dotenv/config';

/**
 * Ajoute la commande `/relance` au workflow n8n de création, via l'API REST.
 *
 *   npx ts-node script/n8n-ajout-relance.ts          (aperçu, n'écrit rien)
 *   npx ts-node script/n8n-ajout-relance.ts --appliquer
 *
 * Pourquoi passer par l'API plutôt que par un réimport manuel : le workflow en
 * production porte les credentials et le prompt DeepSeek collé à la main. Un
 * réimport du JSON du dépôt les écraserait.
 *
 * Ce que fait `/relance` : reprendre le dernier rendu d'une conversation sans
 * régénérer ce qui existe déjà. Sans interface, c'est le seul moyen de retrouver
 * l'identifiant d'une vidéo dont le montage a échoué — sinon chaque nouvelle
 * demande repart du GPU pour des images déjà produites.
 *
 * Branchement obtenu :
 *
 *   Telegram Trigger → Chat autorisé ? → Est-ce /relance ?
 *                                          ├─ oui → Chercher la dernière
 *                                          │         → Relancer le rendu
 *                                          │         → Confirmer la relance
 *                                          └─ non → Accusé de réception → (flux normal)
 */

const WORKFLOW_ID = 'N7QqkFioBCagCp78'; // Pipevideo — Création depuis Telegram
const APPLIQUER = process.argv.includes('--appliquer');

function api() {
  const base = (process.env.N8N_API_URL || '').replace(/\/$/, '');
  const key = process.env.N8N_API_KEY;
  if (!base || !key) throw new Error('N8N_API_URL ou N8N_API_KEY absent du .env');
  return { base: `${base}/api/v1`, key };
}

async function requete(chemin: string, init: RequestInit = {}) {
  const { base, key } = api();
  const res = await fetch(`${base}${chemin}`, {
    ...init,
    headers: { 'X-N8N-API-KEY': key, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  const texte = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} sur ${chemin} : ${texte.slice(0, 300)}`);
  return texte ? JSON.parse(texte) : null;
}

/** Reprend l'URL et le secret d'un nœud existant : ils sont codés en dur dans ce workflow. */
function contexte(nodes: any[]) {
  const lanceur = nodes.find((n) => n.name === 'Lancer le rendu');
  if (!lanceur) throw new Error('Nœud « Lancer le rendu » introuvable.');
  // Retirer le « = » de tête : n8n le préfixe aux champs en mode expression, et le
  // conserver produirait des URL en « ==https://… » dans les nœuds créés ici.
  const sansPrefixe = (v: unknown) =>
    typeof v === 'string' && v.startsWith('=') ? v.slice(1) : String(v ?? '');

  const url = sansPrefixe(lanceur.parameters.url);
  const secret = sansPrefixe(
    lanceur.parameters.headerParameters?.parameters?.find(
      (p: any) => p.name === 'x-webhook-secret'
    )?.value
  );
  const chatId = sansPrefixe(
    nodes.find((n) => n.name === 'Accusé de réception')?.parameters?.chatId
  );
  // Credential Telegram reprise d'un nœud existant : n8n refuse de publier un
  // nœud Telegram sans elle (« Missing required credential: telegramApi »), et
  // l'écrire en dur ici la ferait divergier au moindre changement de bot.
  const credsTelegram = nodes.find(
    (n) => n.type === 'n8n-nodes-base.telegram' && n.credentials?.telegramApi
  )?.credentials;
  if (!credsTelegram) throw new Error('Aucune credential telegramApi trouvée dans le workflow.');

  return { baseUrl: url.replace(/\/api\/render$/, ''), secret, chatId, credsTelegram };
}

function nouveauxNoeuds(ctx: {
  baseUrl: string;
  secret: string;
  chatId: string;
  credsTelegram: any;
}) {
  const enTete = {
    parameters: [{ name: 'x-webhook-secret', value: ctx.secret }],
  };

  return [
    {
      parameters: {
        conditions: {
          options: { caseSensitive: false, leftValue: '', typeValidation: 'loose', version: 2 },
          conditions: [
            {
              id: 'est-relance',
              operator: { type: 'string', operation: 'startsWith' },
              leftValue: '={{ $json.message.text.trim().toLowerCase() }}',
              rightValue: '/relance',
            },
          ],
          combinator: 'and',
        },
        options: {},
      },
      id: 'est-relance-if',
      name: 'Est-ce /relance ?',
      type: 'n8n-nodes-base.if',
      typeVersion: 2.2,
      position: [-260, 300],
      notes:
        "Aiguillage placé APRÈS le filtre de conversation : sans quoi n'importe qui pourrait relancer un rendu, donc dépenser du GPU.",
    },
    {
      parameters: {
        method: 'GET',
        url: `=${ctx.baseUrl}/api/videos/derniere`,
        sendHeaders: true,
        headerParameters: enTete,
        sendQuery: true,
        queryParameters: {
          parameters: [
            { name: 'chatId', value: '={{ $json.message.chat.id }}' },
          ],
        },
        options: { timeout: 30000 },
      },
      id: 'chercher-derniere',
      name: 'Chercher la dernière',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.2,
      position: [-40, 460],
      notes:
        'Renvoie videoId, statut, et scenesPretes/totalScenes — ce dernier chiffre dit si le relancement coûtera du GPU ou réutilisera les médias.',
      onError: 'continueErrorOutput',
    },
    {
      parameters: {
        method: 'POST',
        url: `=${ctx.baseUrl}/api/render`,
        sendHeaders: true,
        headerParameters: enTete,
        sendBody: true,
        specifyBody: 'json',
        jsonBody:
          "={{ JSON.stringify({ id: $json.videoId, mode: 'resume' }) }}",
        options: { timeout: 60000 },
      },
      id: 'relancer-rendu',
      name: 'Relancer le rendu',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.2,
      position: [180, 460],
      notes:
        "mode 'resume' : tout l'intérêt de /relance. Les scènes dont ni la narration ni le prompt n'ont changé gardent leurs médias. Répond 409 si un rendu de cette vidéo tourne déjà.",
      onError: 'continueErrorOutput',
    },
    {
      parameters: {
        chatId: '={{ $(\'Telegram Trigger\').item.json.message.chat.id }}',
        text:
          "=♻️ Relance de *{{ $('Chercher la dernière').item.json.title }}*\n\n" +
          "{{ $('Chercher la dernière').item.json.scenesPretes }}/" +
          "{{ $('Chercher la dernière').item.json.totalScenes }} scènes réutilisées " +
          "— {{ $('Chercher la dernière').item.json.scenesPretes > 0 ? 'pas de régénération pour celles-là' : 'tout sera régénéré' }}.\n\n" +
          'Je te renvoie le lien à la fin.',
        additionalFields: { parse_mode: 'Markdown' },
      },
      id: 'confirmer-relance',
      name: 'Confirmer la relance',
      type: 'n8n-nodes-base.telegram',
      typeVersion: 1.2,
      position: [400, 460],
      credentials: ctx.credsTelegram,
      notes: 'Annonce ce qui sera réutilisé : c\'est la seule information qui dit si le relancement va coûter de l\'argent.',
    },
    {
      parameters: {
        chatId: '={{ $(\'Telegram Trigger\').item.json.message.chat.id }}',
        text:
          "=⚠️ Relance impossible.\n\n`{{ $json.error?.message || $json.error || 'aucune vidéo trouvée' }}`\n\n" +
          "Envoie un sujet pour lancer une nouvelle vidéo.",
        additionalFields: { parse_mode: 'Markdown' },
      },
      id: 'relance-impossible',
      name: 'Relance impossible',
      type: 'n8n-nodes-base.telegram',
      typeVersion: 1.2,
      position: [180, 640],
      credentials: ctx.credsTelegram,
      notes:
        "Cas courants : aucune vidéo dans cette conversation (404), ou un rendu déjà en cours (409). Sans ce nœud, /relance resterait sans réponse.",
    },
  ];
}

async function main() {
  const wf = await requete(`/workflows/${WORKFLOW_ID}`);
  console.log(`Workflow : « ${wf.name} » — ${wf.nodes.length} nœuds, ${wf.active ? 'actif' : 'inactif'}`);

  const dejaFait = wf.nodes.some((n: any) => n.name === 'Est-ce /relance ?');
  if (dejaFait) {
    console.log('\n✅ La commande /relance est déjà en place. Rien à faire.');
    return;
  }

  const ctx = contexte(wf.nodes);
  console.log(`Base pipevideo : ${ctx.baseUrl}`);
  console.log(`Secret : ${ctx.secret ? 'repris du nœud existant' : '⚠️ INTROUVABLE'}`);

  const ajouts = nouveauxNoeuds(ctx);
  const nodes = [...wf.nodes, ...ajouts];

  // Réaiguiller : « Chat autorisé ? » alimente désormais le test /relance, qui
  // renvoie soit vers la branche de relance, soit vers le flux normal.
  const connections = JSON.parse(JSON.stringify(wf.connections));
  connections['Chat autorisé ?'] = {
    main: [[{ node: 'Est-ce /relance ?', type: 'main', index: 0 }], []],
  };
  connections['Est-ce /relance ?'] = {
    main: [
      [{ node: 'Chercher la dernière', type: 'main', index: 0 }],
      [{ node: 'Accusé de réception', type: 'main', index: 0 }],
    ],
  };
  // Sortie 0 = succès, sortie 1 = erreur (onError: continueErrorOutput).
  connections['Chercher la dernière'] = {
    main: [
      [{ node: 'Relancer le rendu', type: 'main', index: 0 }],
      [{ node: 'Relance impossible', type: 'main', index: 0 }],
    ],
  };
  connections['Relancer le rendu'] = {
    main: [
      [{ node: 'Confirmer la relance', type: 'main', index: 0 }],
      [{ node: 'Relance impossible', type: 'main', index: 0 }],
    ],
  };

  // Le flux normal doit rendre les médias réutilisables : 'fresh' les supprimait
  // tous avant chaque rendu, ce qui vidait le cache que /relance exploite.
  const lanceur = nodes.find((n: any) => n.name === 'Lancer le rendu');
  const avant = lanceur.parameters.jsonBody;
  lanceur.parameters.jsonBody = avant.replace(/mode:\s*'fresh'/, "mode: 'resume'");
  if (avant !== lanceur.parameters.jsonBody) {
    console.log("Mode du rendu : 'fresh' → 'resume'");
  }

  console.log(`\nNœuds ajoutés (${ajouts.length}) : ${ajouts.map((n) => n.name).join(', ')}`);

  if (!APPLIQUER) {
    console.log('\n(aperçu — relance avec --appliquer pour écrire dans n8n)');
    return;
  }

  // L'API PUT n'accepte qu'un sous-ensemble de champs : envoyer l'objet complet
  // renvoyé par le GET fait échouer la requête sur les propriétés en lecture seule.
  await requete(`/workflows/${WORKFLOW_ID}`, {
    method: 'PUT',
    body: JSON.stringify({
      name: wf.name,
      nodes,
      connections,
      settings: wf.settings ?? {},
    }),
  });

  const apres = await requete(`/workflows/${WORKFLOW_ID}`);
  console.log(`\n✅ Mis à jour : ${apres.nodes.length} nœuds, ${apres.active ? 'actif' : 'INACTIF'}`);
  if (!apres.active) {
    console.log('⚠️ Le workflow est inactif — le réactiver dans n8n.');
  }
}

main().catch((err: any) => {
  console.error('\n❌', err.message);
  process.exit(1);
});
