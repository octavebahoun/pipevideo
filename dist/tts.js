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
const edge_tts_universal_1 = require("edge-tts-universal");
const music_metadata_1 = require("music-metadata");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const storyboard_1 = require("./storyboard");
const STORYBOARD_PATH = path.join(process.cwd(), 'storyboard.json');
const MEDIA_DIR = path.join(process.cwd(), 'public');
async function main() {
    try {
        // 1. Lire et valider le storyboard.json
        console.log(`Lecture du storyboard depuis : ${STORYBOARD_PATH}`);
        const storyboard = await (0, storyboard_1.loadStoryboard)(STORYBOARD_PATH);
        // 2. Créer le dossier media s'il n'existe pas
        await fs.mkdir(MEDIA_DIR, { recursive: true });
        const voice = storyboard.voice || 'fr-FR-HenriNeural';
        console.log(`Voix utilisée : ${voice}`);
        // 3. Parcourir et générer la voix-off pour chaque scène
        for (const scene of storyboard.scenes) {
            console.log(`\nTraitement de la scène ${scene.id}...`);
            console.log(`Texte : "${scene.narration}"`);
            // Chemin du fichier audio pour cette scène
            const audioFileName = `scene_${scene.id}.mp3`;
            const audioFilePath = path.join(MEDIA_DIR, audioFileName);
            // Générer avec EdgeTTS
            const tts = new edge_tts_universal_1.EdgeTTS(scene.narration, voice);
            const result = await tts.synthesize();
            const audioBuffer = Buffer.from(await result.audio.arrayBuffer());
            await fs.writeFile(audioFilePath, audioBuffer);
            console.log(`Audio généré et sauvegardé dans : ${audioFilePath}`);
            // Capturer les timings mot-à-mot (WordBoundary) pour le karaoké.
            // offset/duration sont en unités de 100 ns → conversion en secondes.
            if (Array.isArray(result.subtitle) && result.subtitle.length > 0) {
                scene.words = result.subtitle.map((wb) => ({
                    text: wb.text,
                    start: wb.offset / 10_000_000,
                    duration: wb.duration / 10_000_000,
                }));
                console.log(`Timings karaoké : ${scene.words.length} mots capturés`);
            }
            // Mesurer la durée exacte du fichier audio
            const metadata = await (0, music_metadata_1.parseFile)(audioFilePath);
            const duration = metadata.format.duration;
            if (duration === undefined) {
                throw new Error(`Impossible de lire la durée du fichier audio : ${audioFilePath}`);
            }
            console.log(`Durée calculée : ${duration.toFixed(2)} secondes`);
            // Mettre à jour la durée dans le JSON
            scene.durationInSeconds = duration;
        }
        // 4. Sauvegarder le storyboard mis à jour
        await fs.writeFile(STORYBOARD_PATH, JSON.stringify(storyboard, null, 2), 'utf-8');
        console.log(`\n✅ Storyboard synchronisé avec succès dans storyboard.json !`);
    }
    catch (error) {
        console.error('❌ Une erreur est survenue lors de la génération TTS :', error.message);
        process.exit(1);
    }
}
main();
