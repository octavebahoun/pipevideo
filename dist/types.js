"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST_NARRATION_PAUSE_FRAMES = exports.TRANSITION_FRAMES = exports.MIN_SCENE_FRAMES = exports.FPS = exports.mainPropsSchema = exports.storyboardSchema = exports.sceneSchema = exports.sceneSoundSchema = exports.wordTimingSchema = void 0;
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
        transition: zod_1.z.enum(['fade', 'slide', 'none', 'black', 'wipe', 'zoomPunch', 'whipPan', 'glitchCut', 'particleDissolve']).optional(),
        /** Léger tremblement de caméra (tension / effort). */
        shake: zod_1.z.boolean().optional(),
        /**
         * Contrainte pour l'étape « Pause Média » : quand vrai, le média de CETTE
         * scène doit être choisi de sorte que sa composition / posture du sujet
         * RACORDE avec la fin de la scène précédente (match cut). N'a aucun impact
         * sur le rendu technique — c'est une directive pour l'agent ou l'utilisateur
         * qui sélectionne les visuels.
         */
        matchCut: zod_1.z.boolean().optional(),
        /**
         * Mouvement de caméra suggéré pour cette scène. N'affecte PAS le rendu
         * Remotion (pas de caméra 3D), mais sert de directive pour la génération
         * du prompt visuel (étape 1 du skill) : l'agent doit inclure ce mouvement
         * dans le prompt destiné aux outils IA (Freepik, Kling, etc.) pour que le
         * média produit ait le bon cadrage / dynamique.
         *
         * - "orbit"   : la caméra tourne autour du sujet (plan cinématique)
         * - "dolly"   : la caméra avance ou recule (travelling avant/arrière)
         * - "pan"     : la caméra pivote horizontalement (panoramique)
         * - "static"  : plan fixe, pas de mouvement de caméra (défaut implicite)
         */
        cameraMotion: zod_1.z.enum(['orbit', 'dolly', 'pan', 'static']).optional(),
        /**
         * Flash lumineux plein écran, bref (type flash photo), pour souligner un
         * instant d'éblouissement/révélation (ex: sonoluminescence, explosion).
         */
        flash: zod_1.z
            .object({
            /** Décalage avant le flash, en secondes depuis le début de la scène. Défaut : 0. */
            startInSeconds: zod_1.z.number().min(0).optional(),
            /** Durée totale du flash (montée + descente), en secondes. Défaut : 0.35. */
            durationInSeconds: zod_1.z.number().positive().optional(),
            /** Couleur du flash. Défaut : blanc. */
            color: zod_1.z.string().optional(),
        })
            .optional(),
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
     * Titre animé mot par mot (kinetic typography). Alternative plus dynamique à
     * overlayText : chaque mot apparaît en stagger avec flou + translation,
     * et les mots entourés de `*astérisques*` sont mis en avant (couleur, poids).
     * N'affecte pas les sous-titres — c'est un habillage visuel autonome.
     */
    kineticTitle: zod_1.z
        .object({
        text: zod_1.z.string(),
        /** Décalage avant le début de l'animation (en secondes). Défaut : 0. */
        startInSeconds: zod_1.z.number().min(0).optional(),
        /** Durée totale de l'animation d'entrée d'un mot (frames). Défaut : 60. */
        animationDuration: zod_1.z.number().positive().optional(),
        /** Délai entre chaque mot (frames). Défaut : 4. */
        staggerDelay: zod_1.z.number().positive().optional(),
        /** Couleur des mots surlignés (`*mot*`). Défaut : #ffd700. */
        highlightColor: zod_1.z.string().optional(),
        /** Taille de police (n'importe quelle valeur CSS valide). Défaut : 4.5rem. */
        fontSize: zod_1.z.string().optional(),
        /** Position verticale : 'bottom' (CTA, défaut) ou 'center' (titre plein écran). */
        position: zod_1.z.enum(['bottom', 'center']).optional(),
        /**
         * Variante visuelle :
         * - "reveal" : mot par mot avec flou + translation (défaut)
         * - "neon"   : texte lumineux avec glow (text-shadow étagé)
         * - "icon"   : icône + label thématique (ex: logo + "MONTAGE")
         * - "pin"    : marqueur qui tombe avec rebond + texte
         */
        variant: zod_1.z.enum(['reveal', 'neon', 'icon', 'pin']).optional(),
        /** Chemin du fichier icône dans public/ (ex: "icons/premiere.svg"). Utilisé si variant="icon". */
        icon: zod_1.z.string().optional(),
        /** Texte du label pour la variante icon (affiché sous l'icône). Si absent, utilise text. */
        iconLabel: zod_1.z.string().optional(),
        /** Couleur du glow néon (variante "neon"). Défaut : highlightColor. */
        glowColor: zod_1.z.string().optional(),
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
    /** Volume du média vidéo (audio original du clip). 0 = muet, 1 = plein volume. Défaut : 0.6 (audible par défaut ; mettre 0 pour couper explicitement une scène). */
    mediaVolume: zod_1.z.number().min(0).max(1).optional(),
    /** Sons additionnels (bruitages, ambiances, musiques) joués pendant la scène. */
    sounds: zod_1.z.array(exports.sceneSoundSchema).optional(),
});
exports.storyboardSchema = zod_1.z.object({
    title: zod_1.z.string(),
    ratio: zod_1.z.enum(['16:9', '9:16']),
    /** Voix ElevenLabs (ex: "george", "anais", "liam", "rachel"). Par défaut : george. */
    voice: zod_1.z.string().optional(),
    /**
     * Utiliser des voix off FOURNIES par l'utilisateur pour TOUTES les scènes
     * (skip ElevenLabs global). `npm run tts` se contente alors de mesurer la durée
     * des fichiers public/scene_<id>.mp3 (ou du `audioPath` de chaque scène).
     * Une scène peut toujours surcharger avec son propre `audioPath`. Défaut : false.
     */
    useProvidedAudio: zod_1.z.boolean().optional(),
    /** Afficher les sous-titres par défaut sur toutes les scènes. Défaut : true. */
    subtitles: zod_1.z.boolean().optional(),
    /**
     * Style des sous-titres :
     *  - "karaoke"   : gros mots MAJUSCULES surlignés au fil de la voix, pop dur et contours
     *                  épais (shorts verticaux punchy/agressifs, défaut).
     *  - "fondant"   : karaoké doux — les mots s'illuminent progressivement (fondu, pas de pop
     *                  brutal ni de contours épais), casse normale. Pour un sujet plus calme/attachant.
     *  - "cinematic" : phrase discrète et sobre centrée en bas, sans surlignage mot-à-mot
     *                  (essai / documentaire 16:9).
     */
    subtitleStyle: zod_1.z.enum(['karaoke', 'fondant', 'cinematic']).optional(),
    /** Musique de fond optionnelle : nom de fichier dans public/ (ex: "music.mp3"). */
    music: zod_1.z.string().optional(),
    /** Volume de la musique de fond (de 0 à 1). Défaut : 0.09. */
    musicVolume: zod_1.z.number().min(0).max(1).optional(),
    /**
     * Multiplicateur GLOBAL appliqué au volume de tous les sons additionnels
     * (`scene.sounds`, bruitages/SFX/ambiances) de toutes les scènes. Défaut : 1
     * (inchangé, chaque son garde son propre `volume`). Mettre à 0 pour couper
     * TOUS les SFX d'un coup depuis le storyboard, sans supprimer les `sounds`
     * de chaque scène (pratique pour les réactiver plus tard sans repasser par le code).
     */
    sfxVolume: zod_1.z.number().min(0).optional(),
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
/**
 * Pause silencieuse ajoutée APRÈS la fin de la voix off d'une scène (le média
 * continue de s'afficher), pour laisser le temps de digérer l'info avant la
 * scène suivante. Cette pause DOIT durer plus longtemps que la transition la
 * plus longue (26 frames pour "black", voir transitionDurationFrames) : ainsi
 * le chevauchement de TransitionSeries avec la scène suivante tombe entièrement
 * dans ce silence, et n'entend jamais la voix off suivante par-dessus la
 * précédente (bug d'audio qui se chevauche entre deux scènes).
 */
exports.POST_NARRATION_PAUSE_FRAMES = 30; // 1s à 30fps
function getSceneDurationInFrames(scene, fps = exports.FPS) {
    const narrationFrames = Math.ceil((scene.durationInSeconds ?? 2) * fps);
    // Les cartes de fin (card) n'ont ni voix ni son : pas de pause à ajouter.
    const pauseFrames = scene.card ? 0 : Math.round((exports.POST_NARRATION_PAUSE_FRAMES / exports.FPS) * fps);
    return Math.max(exports.MIN_SCENE_FRAMES, narrationFrames + pauseFrames);
}
/**
 * Durée (en frames) d'une transition selon son type.
 * Le fondu au noir a besoin de respirer un peu plus (effet cinéma).
 * Le glitchCut est volontairement très court (8 frames = ~0.27s).
 */
function transitionDurationFrames(transition) {
    switch (transition) {
        case 'none':
            return 0;
        case 'black':
            return 26;
        case 'wipe':
            return 20;
        case 'zoomPunch':
            return 18;
        case 'whipPan':
            return 20;
        case 'glitchCut':
            return 8;
        case 'particleDissolve':
            return 40;
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
