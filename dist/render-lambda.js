"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs/promises"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const lambda_1 = require("@remotion/lambda");
const storyboard_1 = require("./storyboard");
const types_1 = require("./types");
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
    }
    catch {
        /* pas de .env : on ignore */
    }
}
/** Ré-essaie une opération réseau tant que l'erreur est transitoire (backoff exponentiel). */
async function withRetry(label, fn, attempts = 4) {
    let lastErr;
    for (let i = 1; i <= attempts; i++) {
        try {
            return await fn();
        }
        catch (err) {
            lastErr = err;
            const msg = String(err?.message ?? err);
            const transient = /ETIMEDOUT|ETIMEOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|EPIPE|socket hang up|timeout|network|Throttl|Rate exceeded|ProvisionedThroughput|503|500/i.test(msg);
            if (!transient || i === attempts)
                throw err;
            const delay = Math.min(20000, 2000 * 2 ** (i - 1)); // 2s, 4s, 8s, 16s (max 20s)
            console.warn(`⚠️  ${label} : ${msg}\n    → nouvel essai ${i + 1}/${attempts} dans ${delay / 1000}s…`);
            await new Promise((r) => setTimeout(r, delay));
        }
    }
    throw lastErr;
}
/** Chemins (relatifs à public/) de TOUS les assets réellement utilisés par le storyboard. */
function collectReferencedAssets(storyboard) {
    const set = new Set();
    if (storyboard.music)
        set.add(storyboard.music);
    for (const scene of storyboard.scenes) {
        if (scene.card)
            continue; // carte de fin : ni média, ni voix, ni son
        if (scene.mediaPath)
            set.add(scene.mediaPath);
        set.add(scene.audioPath ?? `scene_${scene.id}.mp3`); // voix off
        for (const s of scene.sounds ?? [])
            set.add(s.src);
    }
    return [...set];
}
/** Copie les assets référencés dans un publicDir temporaire (sous-chemins conservés). */
async function stageAssets(assets) {
    const stagingDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rl-public-'));
    const missing = [];
    let copied = 0;
    for (const rel of assets) {
        const src = path.join(PUBLIC_DIR, rel);
        try {
            await fs.access(src);
        }
        catch {
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
    const region = (process.env.REMOTION_AWS_REGION || 'eu-west-3');
    const storyboard = await (0, storyboard_1.loadStoryboard)(STORYBOARD_PATH);
    console.log(`Projet : "${storyboard.title}" | région : ${region}`);
    // 1. Retrouver la fonction Lambda déployée (compatible avec cette version).
    const functions = await withRetry('recherche de la fonction', () => (0, lambda_1.getFunctions)({ region, compatibleOnly: true }));
    if (functions.length === 0) {
        throw new Error(`Aucune fonction Lambda compatible dans ${region}.\n` +
            `Déploie-la d'abord : npx remotion lambda functions deploy`);
    }
    const functionName = functions[0].functionName;
    console.log(`Fonction : ${functionName}`);
    // 2. Stager les assets référencés, puis (re)déployer le site (sans source maps).
    const { bucketName } = await withRetry('accès au bucket', () => (0, lambda_1.getOrCreateBucket)({ region }));
    console.log(`Bucket   : ${bucketName}`);
    const stagingDir = await stageAssets(collectReferencedAssets(storyboard));
    console.log('Déploiement du site (assets utiles + bundle sans source maps)…');
    let serveUrl;
    try {
        ({ serveUrl } = await withRetry('déploiement du site', () => (0, lambda_1.deploySite)({
            entryPoint: ENTRY_POINT,
            bucketName,
            region,
            siteName: SITE_NAME,
            options: {
                publicDir: stagingDir,
                webpackOverride: (config) => ({ ...config, devtool: false }),
                onUploadProgress: (p) => {
                    const pct = Math.round((p.sizeUploaded / (p.totalSize || 1)) * 100);
                    process.stdout.write(`\rEnvoi des fichiers sur S3 : ${pct}% (${(p.sizeUploaded / 1_000_000).toFixed(1)} / ${(p.totalSize / 1_000_000).toFixed(1)} Mo)   `);
                },
            },
        })));
    }
    finally {
        await fs.rm(stagingDir, { recursive: true, force: true });
    }
    console.log(`Site     : ${serveUrl}`);
    // 1. framesPerLambda petit (~40 images/chunk) pour qu'aucune Lambda ne dépasse le timeout de 120s.
    // 2. concurrency passé à renderMediaOnLambda pour borner le nombre de Lambdas simultanées sur AWS.
    const maxConcurrency = Number(process.env.RENDER_MAX_LAMBDAS || 10);
    const totalFrames = (0, types_1.getTotalDurationInFrames)(storyboard);
    const framesPerLambda = 40;
    const estChunks = Math.ceil(totalFrames / framesPerLambda);
    // 3. Lancer le rendu sur Lambda. (Un retry peut, en cas de timeout APRÈS invoke
    //    réussi, lancer un 2e rendu — surcoût négligeable, on garde le dernier renderId.)
    console.log(`Lancement du rendu sur Lambda… (${estChunks} chunks de ${framesPerLambda} frames, concurrence max=${maxConcurrency})`);
    const { renderId } = await withRetry('lancement du rendu', () => (0, lambda_1.renderMediaOnLambda)({
        region,
        functionName,
        serveUrl,
        composition: COMPOSITION_ID,
        inputProps: { storyboard },
        codec: 'h264',
        privacy: 'no-acl',
        concurrency: maxConcurrency,
    }), 5);
    console.log(`Rendu lancé : ${renderId}`);
    // 4. Suivre la progression (chaque sondage est résilient aux coupures).
    while (true) {
        const progress = await withRetry('suivi du rendu', () => (0, lambda_1.getRenderProgress)({ renderId, bucketName, functionName, region }));
        if (progress.fatalErrorEncountered) {
            throw new Error(`Erreur de rendu Lambda :\n${progress.errors.map((e) => e.message).join('\n')}`);
        }
        if (progress.done) {
            process.stdout.write('\rRendu Lambda : 100%          \n');
            if (progress.outputFile) {
                console.log(`\n☁️  Vidéo générée et sauvegardée sur AWS S3 (aucun risque de la perdre !) :`);
                console.log(`   👉 Lien S3 Cloud : ${progress.outputFile}\n`);
            }
            break;
        }
        process.stdout.write(`\rRendu Lambda : ${Math.round(progress.overallProgress * 100)}%   `);
        await new Promise((r) => setTimeout(r, 1500));
    }
    // 5. Télécharger le résultat dans out/video.mp4.
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    const { outputPath, sizeInBytes } = await withRetry('téléchargement', () => (0, lambda_1.downloadMedia)({ bucketName, renderId, region, outPath: OUTPUT_FILE }));
    console.log(`\n✅ Vidéo rendue sur Lambda et téléchargée : ${outputPath}`);
    console.log(`   Taille : ${(sizeInBytes / 1_000_000).toFixed(1)} Mo`);
}
main().catch((err) => {
    console.error('\n❌ Erreur render:lambda :', err.message);
    process.exit(1);
});
