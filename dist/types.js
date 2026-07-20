"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TRANSITION_FRAMES = exports.MIN_SCENE_FRAMES = exports.FPS = exports.mainPropsSchema = exports.storyboardSchema = exports.sceneSchema = exports.sceneSoundSchema = exports.wordTimingSchema = void 0;
exports.getSceneDurationInFrames = getSceneDurationInFrames;
exports.transitionDurationFrames = transitionDurationFrames;
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
/**
 * Un son additionnel (bruitage/SFX, ambiance ou musique) joué PENDANT une scène,
 * en plus de la voix off. Le fichier est cherché dans public/ — typiquement dans
 * la bibliothèque de sons `public/sounds/` (voir public/sounds/README.md).
 */
exports.sceneSoundSchema = zod_1.z.object({
    /** Chemin du fichier son dans public/ (ex: "sounds/sfx/heartbeat.mp3"). */
    src: zod_1.z.string(),
    /** Volume de 0 à 1. Défaut : 0.6. */
    volume: zod_1.z.number().min(0).max(1).optional(),
    /** Décalage de départ en secondes, relatif au début de la scène. Défaut : 0. */
    startInSeconds: zod_1.z.number().min(0).optional(),
    /** Boucler le son jusqu'à la fin de la scène. Défaut : false. */
    loop: zod_1.z.boolean().optional(),
    /** Fondu d'entrée (montée du volume) en secondes. Défaut : 0. */
    fadeInSeconds: zod_1.z.number().min(0).optional(),
    /** Fondu de sortie (descente du volume) en secondes. Défaut : 0. */
    fadeOutSeconds: zod_1.z.number().min(0).optional(),
    /** Rogne le DÉBUT du fichier source, en secondes (pour isoler un impact). Défaut : 0. */
    trimStart: zod_1.z.number().min(0).optional(),
    /** Rogne la FIN du fichier source, en secondes (lu depuis le début du fichier). */
    trimEnd: zod_1.z.number().min(0).optional(),
});
exports.sceneSchema = zod_1.z.object({
    id: zod_1.z.number(),
    /** Texte lu par la voix off (Edge-TTS). */
    narration: zod_1.z.string(),
    /** Texte affiché en sous-titre. Par défaut : la narration. */
    subtitle: zod_1.z.string().optional(),
    /**
     * Voix off FOURNIE par l'utilisateur (fichier dans public/, ex: "scene_1.mp3"
     * ou "voix/scene_1.mp3"). Si défini, `npm run tts` NE régénère PAS cette scène
     * via Edge-TTS : la durée est mesurée sur ce fichier et il n'y a pas de timings
     * karaoké mot-à-mot (les sous-titres retombent alors sur une répartition
     * régulière, ou sont désactivés).
     */
    audioPath: zod_1.z.string().optional(),
    /**
     * Afficher les sous-titres pour CETTE scène.
     * Par défaut : la valeur globale `subtitles` du storyboard (true).
     * Mettre à `false` pour les plans purement visuels / cinématiques.
     */
    showSubtitles: zod_1.z.boolean().optional(),
    /** Nom du fichier média dans public/ (ex: "scene_1.png" ou "scene_1.mp4"). */
    mediaPath: zod_1.z.string().optional(),
    effects: zod_1.z
        .object({
        zoom: zod_1.z.enum(['in', 'out', 'none']).optional(),
        transition: zod_1.z.enum(['fade', 'slide', 'none', 'black', 'wipe']).optional(),
        /** Léger tremblement de caméra (tension / effort). */
        shake: zod_1.z.boolean().optional(),
    })
        .optional(),
    /**
     * Texte incrusté à l'écran par-dessus le média (ex: CTA « Commence aujourd'hui »).
     * Apparaît en fondu à `startInSeconds` et reste jusqu'à la fin de la scène.
     */
    overlayText: zod_1.z
        .object({
        text: zod_1.z.string(),
        startInSeconds: zod_1.z.number().min(0).optional(),
    })
        .optional(),
    /**
     * Vitesse de lecture du clip vidéo (1 = normal, <1 = ralenti). Sert à étirer un
     * clip court pour remplir toute la scène SANS boucle visible (mouvement continu
     * au ralenti). Injecté par un script après mesure des durées.
     */
    playbackRate: zod_1.z.number().positive().optional(),
    /**
     * Carte texte (ex: fin de vidéo) : écran noir + texte centré, SANS voix ni son,
     * sans média. Si présent, la scène ignore mediaPath/narration/sounds.
     */
    card: zod_1.z
        .object({
        text: zod_1.z.string(),
        subtext: zod_1.z.string().optional(),
    })
        .optional(),
    /** Durée réelle de la voix off. Injectée automatiquement par tts.ts. */
    durationInSeconds: zod_1.z.number().optional(),
    /** Timings mot-à-mot pour le karaoké. Injectés automatiquement par tts.ts (ne pas écrire à la main). */
    words: zod_1.z.array(exports.wordTimingSchema).optional(),
    /** Sons additionnels (bruitages, ambiances, musiques) joués pendant la scène. */
    sounds: zod_1.z.array(exports.sceneSoundSchema).optional(),
});
exports.storyboardSchema = zod_1.z.object({
    title: zod_1.z.string(),
    ratio: zod_1.z.enum(['16:9', '9:16']),
    /** Voix Edge-TTS. Par défaut : fr-FR-HenriNeural. */
    voice: zod_1.z.string().optional(),
    /**
     * Utiliser des voix off FOURNIES par l'utilisateur pour TOUTES les scènes
     * (skip Edge-TTS global). `npm run tts` se contente alors de mesurer la durée
     * des fichiers public/scene_<id>.mp3 (ou du `audioPath` de chaque scène).
     * Une scène peut toujours surcharger avec son propre `audioPath`. Défaut : false.
     */
    useProvidedAudio: zod_1.z.boolean().optional(),
    /** Afficher les sous-titres par défaut sur toutes les scènes. Défaut : true. */
    subtitles: zod_1.z.boolean().optional(),
    /**
     * Style des sous-titres :
     *  - "karaoke"   : gros mots MAJUSCULES surlignés au fil de la voix (shorts verticaux, défaut).
     *  - "cinematic" : phrase discrète et sobre centrée en bas (essai / documentaire 16:9).
     */
    subtitleStyle: zod_1.z.enum(['karaoke', 'cinematic']).optional(),
    /** Musique de fond optionnelle : nom de fichier dans public/ (ex: "music.mp3"). */
    music: zod_1.z.string().optional(),
    /** Volume de la musique de fond (de 0 à 1). Défaut : 0.09. */
    musicVolume: zod_1.z.number().min(0).max(1).optional(),
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
/**
 * Durée (en frames) d'une transition selon son type.
 * Le fondu au noir a besoin de respirer un peu plus (effet cinéma).
 */
function transitionDurationFrames(transition) {
    switch (transition) {
        case 'none':
            return 0;
        case 'black':
            return 26; // fondu AU NOIR : plus long pour « fermer » puis rouvrir
        case 'wipe':
            return 20;
        default:
            return exports.TRANSITION_FRAMES; // fade, slide
    }
}
function getTransitionFramesBefore(scene, index) {
    if (index === 0)
        return 0;
    return transitionDurationFrames(scene.effects?.transition ?? 'fade');
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
