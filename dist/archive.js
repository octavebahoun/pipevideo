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
exports.archiveCurrentProject = archiveCurrentProject;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const STORYBOARD_PATH = path.join(process.cwd(), 'storyboard.json');
const PUBLIC_DIR = path.join(process.cwd(), 'public');
const OUT_DIR = path.join(process.cwd(), 'out');
const HISTORY_DIR = path.join(process.cwd(), 'history');
async function fileExists(filePath) {
    try {
        await fs.access(filePath);
        return true;
    }
    catch {
        return false;
    }
}
async function archiveCurrentProject() {
    // 1. Vérifier si un storyboard existe
    if (!(await fileExists(STORYBOARD_PATH))) {
        return false;
    }
    try {
        const rawData = await fs.readFile(STORYBOARD_PATH, 'utf-8');
        const storyboard = JSON.parse(rawData);
        // Si le storyboard est vide ou n'a pas de titre, on ignore
        if (!storyboard.title) {
            return false;
        }
        // Nom de dossier propre pour l'archive
        const cleanTitle = storyboard.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/(^_|_$)/g, '');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const archiveFolderName = `${timestamp}_${cleanTitle || 'video'}`;
        const archivePath = path.join(HISTORY_DIR, archiveFolderName);
        const archivePublicPath = path.join(archivePath, 'public');
        console.log(`📦 Archivage du projet actuel : "${storyboard.title}"...`);
        // Créer les dossiers de destination
        await fs.mkdir(archivePath, { recursive: true });
        await fs.mkdir(archivePublicPath, { recursive: true });
        // Copier storyboard.json
        await fs.copyFile(STORYBOARD_PATH, path.join(archivePath, 'storyboard.json'));
        // Copier la vidéo finale si elle existe
        const videoPath = path.join(OUT_DIR, 'video.mp4');
        if (await fileExists(videoPath)) {
            await fs.copyFile(videoPath, path.join(archivePath, 'video.mp4'));
            await fs.unlink(videoPath); // Nettoyer
        }
        // Copier le fichier de métadonnées s'il existe
        const metadataPath = path.join(process.cwd(), 'metadata.md');
        if (await fileExists(metadataPath)) {
            await fs.copyFile(metadataPath, path.join(archivePath, 'metadata.md'));
            await fs.unlink(metadataPath); // Nettoyer
        }
        // Parcourir les scènes pour copier et nettoyer les fichiers média associés
        for (const scene of storyboard.scenes) {
            // 1. Copier et supprimer l'audio de la scène
            const audioFileName = `scene_${scene.id}.mp3`;
            const audioSourcePath = path.join(PUBLIC_DIR, audioFileName);
            if (await fileExists(audioSourcePath)) {
                await fs.copyFile(audioSourcePath, path.join(archivePublicPath, audioFileName));
                await fs.unlink(audioSourcePath);
            }
            // 2. Copier et supprimer l'image/vidéo de la scène
            if (scene.mediaPath) {
                const mediaSourcePath = path.join(PUBLIC_DIR, scene.mediaPath);
                if (await fileExists(mediaSourcePath)) {
                    await fs.copyFile(mediaSourcePath, path.join(archivePublicPath, scene.mediaPath));
                    await fs.unlink(mediaSourcePath);
                }
            }
            // 3. Copier et supprimer la voix off FOURNIE par l'utilisateur (audioPath),
            //    sauf si elle vient de la bibliothèque de sons partagée (public/sounds/),
            //    qui, elle, doit être PRÉSERVÉE d'un projet à l'autre.
            if (scene.audioPath && !scene.audioPath.startsWith('sounds/')) {
                const providedAudioPath = path.join(PUBLIC_DIR, scene.audioPath);
                if (await fileExists(providedAudioPath)) {
                    const destPath = path.join(archivePublicPath, scene.audioPath);
                    await fs.mkdir(path.dirname(destPath), { recursive: true });
                    await fs.copyFile(providedAudioPath, destPath);
                    await fs.unlink(providedAudioPath);
                }
            }
            // NB : on ne touche JAMAIS à scene.sounds[].src → ce sont des références
            // vers la bibliothèque réutilisable public/sounds/ (bruitages, musiques).
        }
        // Supprimer le storyboard.json d'origine
        await fs.unlink(STORYBOARD_PATH);
        console.log(`✅ Projet archivé avec succès dans : ${archivePath}`);
        return true;
    }
    catch (error) {
        console.warn(`⚠️ Erreur lors de l'archivage automatique : ${error.message}`);
        return false;
    }
}
// Permettre l'exécution directe du script
if (require.main === module) {
    archiveCurrentProject().then((archived) => {
        if (!archived) {
            console.log('ℹ️ Aucun projet actif à archiver.');
        }
    });
}
