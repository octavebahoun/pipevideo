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
  const gpuType = process.env.RUNPOD_GPU_TYPE || 'NVIDIA GeForce RTX 5090';
  const dataCenter = process.env.RUNPOD_DATACENTER || 'EU-RO-1';

  let pod: any;
  try {
    pod = await api('POST', '/pods', buildPodBody(name, gpuType, dataCenter, await readPublicKey()));
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

  console.log(`[RunPod] Pod créé : ${pod.id} (${gpuType} @ ${dataCenter}, $${pod.costPerHr ?? '?'}/h)`);
  return pod.id;
}

function buildPodBody(name: string, gpuType: string, dataCenter: string, publicKey: string) {
  return {
    name,
    gpuTypeIds: [gpuType],
    dataCenterIds: [dataCenter],
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

/** Envoie une image dans le dossier input/ de ComfyUI. Renvoie son nom côté serveur. */
export async function comfyUploadImage(pod: PodInfo, localPath: string): Promise<string> {
  const data = await fs.readFile(localPath);
  const name = path.basename(localPath);

  const form = new FormData();
  form.append('image', new Blob([new Uint8Array(data)]), name);
  form.append('overwrite', 'true');

  const res = await fetch(`${pod.comfyUrl}/upload/image`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Upload de ${name} échoué : ${res.status}`);

  const json = await res.json();
  return json.name ?? name;
}

/** Soumet un workflow au format API. Renvoie le prompt_id. */
export async function comfySubmit(pod: PodInfo, workflow: unknown): Promise<string> {
  const res = await fetch(`${pod.comfyUrl}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow, client_id: `pipevideo-${Date.now()}` }),
  });

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
    const res = await fetch(`${pod.comfyUrl}/history/${promptId}`);
    if (res.ok) {
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
export async function comfyDownload(pod: PodInfo, filename: string, destPath: string): Promise<void> {
  const url = `${pod.comfyUrl}/view?filename=${encodeURIComponent(filename)}&type=output`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Téléchargement de ${filename} échoué : ${res.status}`);

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length === 0) throw new Error(`${filename} téléchargé vide`);

  await fs.writeFile(destPath, buf);
  console.log(`[RunPod] ${filename} → ${path.basename(destPath)} (${(buf.length / 1e6).toFixed(1)} Mo)`);
}
