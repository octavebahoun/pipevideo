import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

/**
 * Client RunPod : cycle de vie d'un pod GPU éphémère + dialogue avec ComfyUI.
 *
 * Principe : on n'allume JAMAIS un GPU qui dort. Un pod est créé au début d'une
 * session de génération, détruit à la fin (y compris en cas d'erreur, cf. le
 * `finally` de src/runpod.ts). La facturation est à la seconde d'allumage.
 */

const API = 'https://rest.runpod.io/v1';

export interface PodInfo {
  id: string;
  sshHost: string;
  sshPort: number;
  /** URL publique du proxy RunPod vers ComfyUI (port 8188). */
  comfyUrl: string;
}

function apiKey(): string {
  const key = process.env.RUNPOD_API_KEY;
  if (!key) throw new Error('RUNPOD_API_KEY absente de .env');
  return key;
}

/**
 * Appel API avec reprise sur incident réseau.
 *
 * L'API RunPod tombe ponctuellement (`fetch failed`, timeouts). Sans reprise,
 * une session de génération entière échoue sur un hoquet de quelques secondes.
 * On ne rejoue QUE les erreurs réseau et les 5xx : un 4xx est une vraie erreur
 * de requête, la rejouer ne ferait que la répéter.
 */
async function api(method: string, route: string, body?: unknown, attempts = 4): Promise<any> {
  let lastError: Error | null = null;

  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetch(`${API}${route}`, {
        method,
        headers: {
          Authorization: `Bearer ${apiKey()}`,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(60_000),
      });

      const text = await res.text();

      if (res.status >= 500 && i < attempts) {
        lastError = new Error(`RunPod ${method} ${route} → ${res.status}`);
        console.warn(`[RunPod] ${res.status} sur ${route}, tentative ${i}/${attempts}...`);
        await new Promise((r) => setTimeout(r, 3000 * i));
        continue;
      }

      if (!res.ok) {
        throw new Error(`RunPod ${method} ${route} → ${res.status} : ${text.slice(0, 400)}`);
      }
      return text ? JSON.parse(text) : null;
    } catch (err: any) {
      // Une erreur HTTP 4xx est définitive : on ne la rejoue pas.
      if (err.message?.startsWith('RunPod ') && !err.message.includes('→ 5')) throw err;

      lastError = err;
      if (i < attempts) {
        console.warn(`[RunPod] Réseau KO sur ${route} (${err.message}), tentative ${i}/${attempts}...`);
        await new Promise((r) => setTimeout(r, 3000 * i));
      }
    }
  }

  throw new Error(`RunPod ${method} ${route} : échec après ${attempts} tentatives — ${lastError?.message}`);
}

/** Retrouve un pod par son nom (sécurité anti-doublon après un échec réseau). */
async function findPodByName(name: string): Promise<string | null> {
  try {
    const res = await api('GET', '/pods');
    const pods = Array.isArray(res) ? res : res?.items ?? res?.data ?? [];
    return pods.find((p: any) => p.name === name)?.id ?? null;
  } catch {
    return null;
  }
}

/** Lit la clé SSH PUBLIQUE locale (celle autorisée sur le pod). */
async function readPublicKey(): Promise<string> {
  const configured = process.env.RUNPOD_SSH_KEY_PATH || '~/.ssh/id_ed25519';
  const privPath = configured.replace(/^~/, os.homedir());
  const pub = await fs.readFile(`${privPath}.pub`, 'utf-8').catch(() => {
    throw new Error(`Clé publique introuvable : ${privPath}.pub`);
  });
  return pub.trim();
}

/** Chemin de la clé SSH PRIVÉE, pour les commandes ssh. */
function privateKeyPath(): string {
  const configured = process.env.RUNPOD_SSH_KEY_PATH || '~/.ssh/id_ed25519';
  return configured.replace(/^~/, os.homedir());
}

/**
 * Crée un pod GPU. Renvoie son ID.
 * Le pod démarre immédiatement la facturation — l'appelant DOIT garantir sa
 * suppression (try/finally).
 */
export async function createPod(name: string): Promise<string> {
  /**
   * Plusieurs modèles de GPU, par ordre de préférence.
   *
   * Ne dépendre que de la RTX 5090 rendait le run tributaire d'un stock souvent
   * classé "LOW" : "no instances currently available" a fait échouer deux runs,
   * dont un où EU-RO-1 avait purement disparu de la liste des centres.
   *
   * La L40S (48 Go, même prix) et l'A40 (48 Go, moins chère mais ~2,4× plus lente
   * sur Wan) font parfaitement l'affaire. Tous tiennent Wan 2.2 fp8 + Flux.
   */
  const gpuTypes = (
    process.env.RUNPOD_GPU_TYPE || 'NVIDIA GeForce RTX 5090,NVIDIA L40S,NVIDIA A40'
  )
    .split(',')
    .map((g) => g.trim())
    .filter(Boolean);

  // Idem pour les datacenters : un seul centre épuisé suffisait à tout faire
  // échouer. RunPod choisit celui qui a de la place.
  const dataCenters = (process.env.RUNPOD_DATACENTER || 'EU-RO-1,EU-CZ-1,EUR-NO-1')
    .split(',')
    .map((d) => d.trim())
    .filter(Boolean);

  let pod: any;
  try {
    pod = await api('POST', '/pods', buildPodBody(name, gpuTypes, dataCenters, await readPublicKey()));
  } catch (err: any) {
    // Un échec réseau peut survenir APRÈS que RunPod ait créé le pod : on
    // vérifie avant de relancer, sinon on facture deux GPU en parallèle.
    const orphan = await findPodByName(name);
    if (orphan) {
      console.warn(`[RunPod] Le pod ${orphan} a bien été créé malgré l'erreur réseau — on le réutilise.`);
      return orphan;
    }
    throw err;
  }

  console.log(
    `[RunPod] Pod créé : ${pod.id} (${pod.machine?.gpuTypeId ?? pod.gpu?.id ?? gpuTypes[0]} @ ` +
      `${pod.dataCenterId ?? dataCenters.join('/')}, $${pod.costPerHr ?? '?'}/h)`
  );
  return pod.id;
}

function buildPodBody(name: string, gpuTypes: string[], dataCenters: string[], publicKey: string) {
  return {
    name,
    gpuTypeIds: gpuTypes,
    dataCenterIds: dataCenters,
    cloudType: 'SECURE',
    gpuCount: 1,
    imageName: 'runpod/pytorch:1.0.2-cu1281-torch280-ubuntu2404',
    containerDiskInGb: 20,
    volumeInGb: 100,
    volumeMountPath: '/workspace',
    ports: ['8188/http', '22/tcp'],
    // L'API REST n'a pas de champ `sshPublicKey` : les images officielles
    // runpod/* installent la clé trouvée dans PUBLIC_KEY au démarrage de sshd.
    env: { PUBLIC_KEY: publicKey },
  };
}

/**
 * Arme un compte à rebours d'auto-destruction SUR le pod.
 *
 * C'est le garde-fou le plus important de ce fichier. Le `finally` de
 * src/runpod.ts ne protège que si le processus Node meurt proprement : si la
 * session est fermée, le terminal tué ou la machine éteinte, le pod continue de
 * facturer indéfiniment. C'est arrivé — un pod a tourné 2 h 56 à vide, soit
 * ~$2.90, l'équivalent de dix-neuf vidéos.
 *
 * RunPod n'offre aucun champ d'expiration à la création (vérifié dans l'OpenAPI
 * v2). La seule protection qui survive à la mort du client est donc un timer
 * lancé sur le pod, qui appelle l'API RunPod pour se supprimer lui-même.
 *
 * `setsid` détache le timer : il survit à la fermeture de la session SSH.
 * L'orchestrateur peut le repousser (`renewKillSwitch`) tant qu'il travaille.
 */
export async function armKillSwitch(pod: PodInfo, minutes = 90): Promise<void> {
  const script = [
    '#!/bin/bash',
    '# Auto-destruction : filet de sécurité si le client disparaît.',
    'SECONDS_LEFT=$1',
    'while [ "$SECONDS_LEFT" -gt 0 ]; do',
    '  sleep 30',
    '  SECONDS_LEFT=$((SECONDS_LEFT - 30))',
    '  # Le client repousse l\'échéance en réécrivant ce fichier.',
    '  if [ -f /workspace/.killswitch_renew ]; then',
    '    SECONDS_LEFT=$(cat /workspace/.killswitch_renew)',
    '    rm -f /workspace/.killswitch_renew',
    '  fi',
    'done',
    'echo "AUTO-DESTRUCTION $(date -u)"',
    'curl -s -X DELETE "https://rest.runpod.io/v1/pods/$RUNPOD_POD_ID" \\',
    '  -H "Authorization: Bearer $RUNPOD_KILL_KEY"',
  ].join('\n');

  try {
    // Deux commandes SSH distinctes. Lancer le timer dans la même commande que
    // l'écriture du script faisait attendre le SSH indéfiniment : le processus
    // détaché hérite du tuyau de sortie et OpenSSH ne rend la main qu'une fois
    // TOUS les descripteurs fermés (même piège que le démarrage de ComfyUI).
    await ssh(
      pod,
      `cat > /workspace/killswitch.sh << 'KS_EOF'\n${script}\nKS_EOF\nchmod +x /workspace/killswitch.sh && echo KS_WRITTEN`,
      60_000
    );

    await ssh(
      pod,
      `RUNPOD_POD_ID=${pod.id} RUNPOD_KILL_KEY=${apiKey()} ` +
        `setsid nohup /workspace/killswitch.sh ${minutes * 60} ` +
        `> /workspace/killswitch.log 2>&1 < /dev/null & ` +
        `disown; echo KS_ARMED`,
      60_000
    );
    console.log(`[RunPod] 🛡️ Auto-destruction armée : le pod se supprimera seul dans ${minutes} min.`);
  } catch (err: any) {
    // Non bloquant, mais l'utilisateur doit le savoir : sans ce filet, un plantage
    // du client laisse le GPU facturer.
    console.warn(
      `[RunPod] ⚠️ Auto-destruction NON armée (${err.message.slice(0, 80)}).\n` +
        `   Surveille https://console.runpod.io/pods : en cas de plantage, le pod facturera.`
    );
  }
}

/** Repousse l'échéance de l'auto-destruction. Appelé pendant la génération. */
export async function renewKillSwitch(pod: PodInfo, minutes = 90): Promise<void> {
  await ssh(pod, `echo ${minutes * 60} > /workspace/.killswitch_renew`, 30_000).catch(() => {});
}

/**
 * Supprime les pods `pipevideo-*` oubliés d'un run précédent.
 *
 * Deuxième filet : si le kill switch a échoué ET que le client est mort, ce
 * ménage au démarrage du run suivant rattrape le pod orphelin.
 */
export async function cleanOrphanPods(exceptId?: string): Promise<void> {
  try {
    const res = await api('GET', '/pods');
    const pods = Array.isArray(res) ? res : res?.items ?? res?.data ?? [];
    const orphelins = pods.filter(
      (p: any) => p.name?.startsWith('pipevideo-') && p.id !== exceptId
    );

    for (const p of orphelins) {
      const minutes = Math.round((p.runtime?.uptime ?? 0) / 60);
      console.warn(`[RunPod] 🧹 Pod orphelin détecté : ${p.id} (${minutes} min d'uptime) — suppression.`);
      await deletePod(p.id);
    }
  } catch (err: any) {
    console.warn(`[RunPod] Ménage des pods orphelins impossible : ${err.message.slice(0, 80)}`);
  }
}

/** Attend que le pod expose son SSH et renvoie ses coordonnées. */
export async function waitForPod(podId: string, timeoutMs = 5 * 60_000): Promise<PodInfo> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const pod = await api('GET', `/pods/${podId}`);
    const ssh = pod?.portMappings?.['22'] ?? pod?.runtime?.ports?.find((p: any) => p.privatePort === 22 || p.private === 22);

    const host = pod?.publicIp ?? ssh?.ip;
    const port = pod?.portMappings?.['22'] ?? ssh?.publicPort ?? ssh?.public;

    if (host && port) {
      const info: PodInfo = {
        id: podId,
        sshHost: host,
        sshPort: Number(port),
        comfyUrl: `https://${podId}-8188.proxy.runpod.net`,
      };
      console.log(`[RunPod] Pod prêt : ssh root@${info.sshHost} -p ${info.sshPort}`);
      return info;
    }

    await new Promise((r) => setTimeout(r, 5000));
  }

  throw new Error(`Le pod ${podId} n'est pas devenu joignable en ${timeoutMs / 1000}s`);
}

/** Supprime définitivement le pod. Ne lève jamais — on ne veut pas masquer l'erreur d'origine. */
export async function deletePod(podId: string): Promise<void> {
  try {
    await api('DELETE', `/pods/${podId}`);
    console.log(`[RunPod] Pod ${podId} supprimé. Facturation arrêtée.`);
  } catch (err: any) {
    console.error(
      `[RunPod] ⚠️ ÉCHEC DE SUPPRESSION du pod ${podId} : ${err.message}\n` +
        `   ⚠️ SUPPRIME-LE À LA MAIN sur https://console.runpod.io/pods — il continue de facturer.`
    );
  }
}

/** Exécute une commande sur le pod via SSH. Renvoie stdout. */
export function ssh(pod: PodInfo, command: string, timeoutMs = 20 * 60_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'ssh',
      [
        '-i', privateKeyPath(),
        '-o', 'StrictHostKeyChecking=accept-new',
        '-o', 'ConnectTimeout=25',
        '-p', String(pod.sshPort),
        `root@${pod.sshHost}`,
        command,
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    );

    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`SSH timeout après ${timeoutMs / 1000}s : ${command.slice(0, 80)}`));
    }, timeoutMs);

    child.stdout.on('data', (d) => (out += d.toString()));
    child.stderr.on('data', (d) => (err += d.toString()));
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out);
      else reject(new Error(`SSH code ${code} : ${err.slice(0, 400) || out.slice(0, 400)}`));
    });
  });
}

/**
 * Installe ComfyUI + les modèles sur le pod et démarre le serveur.
 * Mesuré à ~2,5 min sur un datacenter au réseau sain.
 */
export async function runSetup(pod: PodInfo): Promise<void> {
  const script = await fs.readFile(path.join(process.cwd(), 'runpod', 'setup-pod.sh'), 'utf-8');

  console.log('[RunPod] Installation de ComfyUI + modèles (~2,5 min)...');
  // On pousse le script via stdin plutôt que par scp : une seule connexion.
  await sshWithInput(pod, 'cat > /workspace/setup.sh && chmod +x /workspace/setup.sh', script);

  // On NE garde PAS la connexion ouverte pendant le setup : le script démarre
  // ComfyUI en arrière-plan, et OpenSSH attend la fermeture de tous les
  // descripteurs hérités — la session resterait bloquée bien après la fin réelle
  // du script. On lance donc en détaché, puis on interroge le journal.
  await ssh(
    pod,
    'setsid nohup bash /workspace/setup.sh > /workspace/setup.log 2>&1 < /dev/null & echo LANCE',
    60_000
  );

  const deadline = Date.now() + 15 * 60_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 10_000));

    const log = await ssh(pod, 'tail -c 4000 /workspace/setup.log 2>/dev/null || true', 60_000);

    if (log.includes('SETUP_DONE')) {
      console.log('[RunPod] ComfyUI opérationnel.');
      return;
    }

    // Le script est-il encore vivant ? S'il est mort sans SETUP_DONE, inutile d'attendre.
    const alive = await ssh(pod, 'pgrep -f setup.sh > /dev/null && echo OUI || echo NON', 60_000);
    if (alive.includes('NON')) {
      throw new Error(`Le setup s'est arrêté sans aboutir. Journal :\n${log.slice(-1200)}`);
    }

    const step = log.match(/### (\w+) \d+/g)?.pop();
    if (step) console.log(`[RunPod] setup : ${step.replace(/### | \d+/g, '')}...`);
  }

  throw new Error('Le setup du pod dépasse 15 min — abandon.');
}

/** Comme ssh(), mais envoie `input` sur stdin de la commande distante. */
function sshWithInput(pod: PodInfo, command: string, input: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'ssh',
      [
        '-i', privateKeyPath(),
        '-o', 'StrictHostKeyChecking=accept-new',
        '-o', 'ConnectTimeout=25',
        '-p', String(pod.sshPort),
        `root@${pod.sshHost}`,
        command,
      ],
      { stdio: ['pipe', 'ignore', 'pipe'] }
    );

    let err = '';
    child.stderr.on('data', (d) => (err += d.toString()));
    child.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`SSH stdin code ${code} : ${err.slice(0, 300)}`))
    );
    child.stdin.write(input);
    child.stdin.end();
  });
}

// ---------------------------------------------------------------------------
// API ComfyUI (via le proxy HTTPS du pod — pas de SSH nécessaire)
// ---------------------------------------------------------------------------

/**
 * `fetch` vers le proxy du pod, avec reprise sur incident réseau.
 *
 * Le proxy `*.proxy.runpod.net` coupe ponctuellement (`fetch failed`), typiquement
 * après une dizaine de minutes d'activité. Sans reprise, une session de génération
 * entière meurt sur une coupure de deux secondes — constaté trois fois de suite,
 * dont un run de 30 minutes perdu à la scène 39 sur 60.
 *
 * Le pod, lui, continue de tourner (et d'être facturé) pendant ces secondes :
 * réessayer est toujours moins cher que perdre le run.
 *
 * On rejoue les erreurs réseau et les 5xx. Un 4xx est une vraie erreur de requête
 * (workflow invalide, fichier absent) : la rejouer ne ferait que la répéter.
 */
async function comfyFetch(
  url: string,
  init: RequestInit = {},
  opts: { attempts?: number; timeoutMs?: number; label?: string } = {}
): Promise<Response> {
  const attempts = opts.attempts ?? 4;
  const timeoutMs = opts.timeoutMs ?? 120_000;
  const label = opts.label ?? url.split('/').pop() ?? 'requête';
  let lastError: Error | null = null;

  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });

      if (res.status >= 500 && i < attempts) {
        lastError = new Error(`${res.status}`);
        console.warn(`[ComfyUI] ${res.status} sur ${label}, tentative ${i}/${attempts}...`);
        await new Promise((r) => setTimeout(r, 3000 * i));
        continue;
      }
      return res;
    } catch (err: any) {
      lastError = err;
      if (i < attempts) {
        console.warn(`[ComfyUI] Réseau KO sur ${label} (${err.message}), tentative ${i}/${attempts}...`);
        await new Promise((r) => setTimeout(r, 3000 * i));
      }
    }
  }

  throw new Error(`ComfyUI ${label} : échec après ${attempts} tentatives — ${lastError?.message}`);
}

/** Envoie une image dans le dossier input/ de ComfyUI. Renvoie son nom côté serveur. */
export async function comfyUploadImage(pod: PodInfo, localPath: string): Promise<string> {
  const data = await fs.readFile(localPath);
  const name = path.basename(localPath);

  const form = new FormData();
  form.append('image', new Blob([new Uint8Array(data)]), name);
  form.append('overwrite', 'true');

  const res = await comfyFetch(
    `${pod.comfyUrl}/upload/image`,
    { method: 'POST', body: form },
    { label: `upload ${name}` }
  );
  if (!res.ok) throw new Error(`Upload de ${name} échoué : ${res.status}`);

  const json = await res.json();
  return json.name ?? name;
}

/** Soumet un workflow au format API. Renvoie le prompt_id. */
export async function comfySubmit(pod: PodInfo, workflow: unknown): Promise<string> {
  const res = await comfyFetch(
    `${pod.comfyUrl}/prompt`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: workflow, client_id: `pipevideo-${Date.now()}` }),
    },
    { label: 'soumission du workflow' }
  );

  const text = await res.text();
  if (!res.ok) throw new Error(`ComfyUI a refusé le workflow : ${text.slice(0, 600)}`);
  return JSON.parse(text).prompt_id;
}

/**
 * Attend la fin d'un job et renvoie les noms de fichiers produits.
 * `onTick` permet de remonter la progression (utilisé pour le dashboard).
 */
export async function comfyWait(
  pod: PodInfo,
  promptId: string,
  opts: { timeoutMs?: number; onTick?: (elapsedSec: number) => Promise<void> | void } = {}
): Promise<string[]> {
  const timeoutMs = opts.timeoutMs ?? 20 * 60_000;
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    // Sondage : une seule tentative par tour. La boucle elle-même EST la reprise
    // (on repasse dans 3 s), donc une coupure ponctuelle est absorbée sans bruit.
    const res = await fetch(`${pod.comfyUrl}/history/${promptId}`, {
      signal: AbortSignal.timeout(30_000),
    }).catch(() => null);

    if (res?.ok) {
      const hist = await res.json();
      const entry = hist?.[promptId];

      if (entry) {
        const status = entry.status?.status_str;
        if (status !== 'success') {
          throw new Error(`Job ComfyUI ${promptId} en échec : ${JSON.stringify(entry.status).slice(0, 600)}`);
        }

        // Les sorties sont regroupées par node ; on récupère tout ce qui porte un filename.
        const files: string[] = [];
        for (const node of Object.values<any>(entry.outputs ?? {})) {
          for (const list of Object.values<any>(node)) {
            if (!Array.isArray(list)) continue;
            for (const item of list) {
              if (item && typeof item === 'object' && item.filename) files.push(item.filename);
            }
          }
        }
        return files;
      }
    }

    await opts.onTick?.(Math.round((Date.now() - started) / 1000));
    await new Promise((r) => setTimeout(r, 3000));
  }

  throw new Error(`Job ComfyUI ${promptId} : timeout après ${timeoutMs / 1000}s`);
}

/** Télécharge un fichier produit par ComfyUI vers le disque local. */
// ---------------------------------------------------------------------------
// Envoi direct pod -> Cloudflare R2
// ---------------------------------------------------------------------------

/** Identifiants R2, ou null si la configuration est incomplète. */
export function r2Credentials(): {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicDomain?: string;
} | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID || process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME || process.env.CLOUDFLARE_R2_BUCKET_NAME;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;
  return {
    accountId: accountId.trim(),
    accessKeyId,
    secretAccessKey,
    bucket,
    publicDomain: process.env.R2_PUBLIC_DOMAIN || process.env.CLOUDFLARE_R2_PUBLIC_URL,
  };
}

/**
 * Écrit la configuration rclone sur le pod. À appeler une fois, après le setup.
 *
 * Renvoie `false` si R2 n'est pas configuré ou si rclone est absent : l'appelant
 * retombe alors sur le rapatriement classique via le proxy.
 */
export async function configureR2(pod: PodInfo): Promise<boolean> {
  const creds = r2Credentials();
  if (!creds) {
    console.log('[R2] Identifiants absents — rapatriement classique via le proxy.');
    return false;
  }

  const dispo = await ssh(pod, 'command -v rclone > /dev/null 2>&1 && echo OUI || echo NON', 60_000);
  if (!dispo.includes('OUI')) {
    console.warn('[R2] rclone absent du pod — rapatriement classique via le proxy.');
    return false;
  }

  // Le heredoc évite d'exposer les secrets dans la ligne de commande (donc dans
  // la liste des processus du pod).
  const conf = [
    '[r2]',
    'type = s3',
    'provider = Cloudflare',
    `access_key_id = ${creds.accessKeyId}`,
    `secret_access_key = ${creds.secretAccessKey}`,
    `endpoint = https://${creds.accountId}.r2.cloudflarestorage.com`,
    'acl = private',
    'no_check_bucket = true',
  ].join('\n');

  await ssh(
    pod,
    `mkdir -p ~/.config/rclone && cat > ~/.config/rclone/rclone.conf << 'RCLONE_EOF'\n${conf}\nRCLONE_EOF\necho CONF_OK`,
    60_000
  );

  console.log(`[R2] rclone configuré sur le pod (bucket "${creds.bucket}").`);
  return true;
}

/**
 * Pousse un fichier produit par ComfyUI directement du pod vers R2.
 *
 * C'est la voie rapide : le fichier ne traverse plus le poste local, donc le
 * proxy RunPod — maillon le plus fragile de la chaîne — sort du chemin critique.
 * Un média poussé est immédiatement durable, même si le pod meurt juste après.
 *
 * Renvoie l'URL publique si un domaine est configuré, sinon la clé R2.
 */
export async function uploadFromPodToR2(
  pod: PodInfo,
  filename: string,
  key: string
): Promise<string> {
  const creds = r2Credentials();
  if (!creds) throw new Error('R2 non configuré');

  const src = `/workspace/ComfyUI/output/${filename}`;
  const out = await ssh(
    pod,
    `rclone copyto --s3-no-check-bucket -q "${src}" "r2:${creds.bucket}/${key}" && echo R2_OK || echo R2_KO`,
    5 * 60_000
  );

  if (!out.includes('R2_OK')) {
    throw new Error(`Envoi R2 de ${filename} échoué : ${out.slice(-300)}`);
  }

  const url = creds.publicDomain
    ? `${creds.publicDomain.replace(/\/$/, '')}/${key}`
    : `r2://${creds.bucket}/${key}`;

  console.log(`[R2] ${filename} → ${key}`);
  return url;
}

export async function comfyDownload(pod: PodInfo, filename: string, destPath: string): Promise<void> {
  const url = `${pod.comfyUrl}/view?filename=${encodeURIComponent(filename)}&type=output`;
  const res = await comfyFetch(url, {}, { label: `téléchargement ${filename}`, timeoutMs: 180_000 });
  if (!res.ok) throw new Error(`Téléchargement de ${filename} échoué : ${res.status}`);

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length === 0) throw new Error(`${filename} téléchargé vide`);

  await fs.writeFile(destPath, buf);
  console.log(`[RunPod] ${filename} → ${path.basename(destPath)} (${(buf.length / 1e6).toFixed(1)} Mo)`);
}
