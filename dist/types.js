"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TRANSITION_FRAMES = exports.MIN_SCENE_FRAMES = exports.FPS = exports.mainPropsSchema = exports.storyboardSchema = exports.sceneSchema = exports.wordTimingSchema = void 0;
exports.getSceneDurationInFrames = getSceneDurationInFrames;
exports.getTransitionFramesBefore = getTransitionFramesBefore;
exports.getTotalDurationInFrames = getTotalDurationInFrames;
exports.getDimensions = getDimensions;
const zod_1 = require("zod");
/**
 * Timing d'un mot prononcé, dérivé des évènements WordBoundary d'Edge-TTS.
 * Injecté automatiquement par tts.ts, consommé par Subtitles.tsx pour le karaoké.
 * Les valeurs sont en SECONDES, relatives au début de la scène.
 */
exports.wordTimingSchema = zod_1.z.object({
    text: zod_1.z.string(),
    start: zod_1.z.number(),
    duration: zod_1.z.number(),
});
exports.sceneSchema = zod_1.z.object({
    id: zod_1.z.number(),
    /** Texte lu par la voix off (Edge-TTS). */
    narration: zod_1.z.string(),
    /** Texte affiché en sous-titre. Par défaut : la narration. */
    subtitle: zod_1.z.string().optional(),
    /** Nom du fichier média dans public/ (ex: "scene_1.png" ou "scene_1.mp4"). */
    mediaPath: zod_1.z.string().optional(),
    effects: zod_1.z
        .object({
        zoom: zod_1.z.enum(['in', 'out', 'none']).optional(),
        transition: zod_1.z.enum(['fade', 'slide', 'none']).optional(),
    })
        .optional(),
    /** Durée réelle de la voix off. Injectée automatiquement par tts.ts. */
    durationInSeconds: zod_1.z.number().optional(),
    /** Timings mot-à-mot pour le karaoké. Injectés automatiquement par tts.ts (ne pas écrire à la main). */
    words: zod_1.z.array(exports.wordTimingSchema).optional(),
});
exports.storyboardSchema = zod_1.z.object({
    title: zod_1.z.string(),
    ratio: zod_1.z.enum(['16:9', '9:16']),
    /** Voix Edge-TTS. Par défaut : fr-FR-HenriNeural. */
    voice: zod_1.z.string().optional(),
    /** Musique de fond optionnelle : nom de fichier dans public/ (ex: "music.mp3"). */
    music: zod_1.z.string().optional(),
    scenes: zod_1.z.array(exports.sceneSchema),
});
/** Props du composant racine Remotion (utilisé aussi comme schéma de Composition). */
exports.mainPropsSchema = zod_1.z.object({
    storyboard: exports.storyboardSchema,
});
// ---------------------------------------------------------------------------
// Constantes & calcul de durée
// Source UNIQUE partagée par Root.tsx (durée totale) et Main.tsx (durée par scène)
// pour éviter toute divergence (bug de troncature des scènes).
// ---------------------------------------------------------------------------
exports.FPS = 30;
/** Durée minimale d'une scène (garde-fou si l'audio est très court). */
exports.MIN_SCENE_FRAMES = 30;
/** Durée du chevauchement d'une transition (fade/slide) entre deux scènes. */
exports.TRANSITION_FRAMES = 15;
function getSceneDurationInFrames(scene, fps = exports.FPS) {
    return Math.max(exports.MIN_SCENE_FRAMES, Math.ceil((scene.durationInSeconds ?? 2) * fps));
}
/**
 * Frames de transition consommées AVANT une scène (chevauchement avec la précédente).
 * La première scène n'a pas de transition entrante.
 */
function getTransitionFramesBefore(scene, index) {
    if (index === 0)
        return 0;
    const transition = scene.effects?.transition ?? 'fade';
    return transition === 'none' ? 0 : exports.TRANSITION_FRAMES;
}
/**
 * Durée totale de la composition.
 * Les transitions chevauchent les scènes adjacentes (TransitionSeries) : on
 * soustrait leur durée pour que la composition colle exactement au contenu.
 */
function getTotalDurationInFrames(storyboard, fps = exports.FPS) {
    const total = storyboard.scenes.reduce((acc, scene, index) => acc + getSceneDurationInFrames(scene, fps) - getTransitionFramesBefore(scene, index), 0);
    return Math.max(exports.MIN_SCENE_FRAMES, total);
}
/** Dimensions de la vidéo selon le ratio choisi. */
function getDimensions(storyboard) {
    return storyboard.ratio === '9:16'
        ? { width: 1080, height: 1920 }
        : { width: 1920, height: 1080 };
}
