import { z } from 'zod';

/**
 * Timing d'un mot prononcé, dérivé des évènements WordBoundary d'Edge-TTS.
 * Injecté automatiquement par tts.ts, consommé par Subtitles.tsx pour le karaoké.
 * Les valeurs sont en SECONDES, relatives au début de la scène.
 */
export const wordTimingSchema = z.object({
  text: z.string(),
  start: z.number(),
  duration: z.number(),
});

/**
 * Un son additionnel (bruitage/SFX, ambiance ou musique) joué PENDANT une scène,
 * en plus de la voix off. Le fichier est cherché dans public/ — typiquement dans
 * la bibliothèque de sons `public/sounds/` (voir public/sounds/README.md).
 */
export const sceneSoundSchema = z.object({
  /** Chemin du fichier son dans public/ (ex: "sounds/sfx/heartbeat.mp3"). */
  src: z.string(),
  /** Volume de 0 à 1. Défaut : 0.6. */
  volume: z.number().min(0).max(1).optional(),
  /** Décalage de départ en secondes, relatif au début de la scène. Défaut : 0. */
  startInSeconds: z.number().min(0).optional(),
  /** Boucler le son jusqu'à la fin de la scène. Défaut : false. */
  loop: z.boolean().optional(),
  /** Fondu d'entrée (montée du volume) en secondes. Défaut : 0. */
  fadeInSeconds: z.number().min(0).optional(),
  /** Fondu de sortie (descente du volume) en secondes. Défaut : 0. */
  fadeOutSeconds: z.number().min(0).optional(),
  /** Rogne le DÉBUT du fichier source, en secondes (pour isoler un impact). Défaut : 0. */
  trimStart: z.number().min(0).optional(),
  /** Rogne la FIN du fichier source, en secondes (lu depuis le début du fichier). */
  trimEnd: z.number().min(0).optional(),
});

export const sceneSchema = z.object({
  id: z.number(),
  /** Texte lu par la voix off (Edge-TTS). */
  narration: z.string(),
  /** Texte affiché en sous-titre. Par défaut : la narration. */
  subtitle: z.string().optional(),
  /**
   * Voix off FOURNIE par l'utilisateur (fichier dans public/, ex: "scene_1.mp3"
   * ou "voix/scene_1.mp3"). Si défini, `npm run tts` NE régénère PAS cette scène
   * via Edge-TTS : la durée est mesurée sur ce fichier et il n'y a pas de timings
   * karaoké mot-à-mot (les sous-titres retombent alors sur une répartition
   * régulière, ou sont désactivés).
   */
  audioPath: z.string().optional(),
  /**
   * Afficher les sous-titres pour CETTE scène.
   * Par défaut : la valeur globale `subtitles` du storyboard (true).
   * Mettre à `false` pour les plans purement visuels / cinématiques.
   */
  showSubtitles: z.boolean().optional(),
  /** Nom du fichier média dans public/ (ex: "scene_1.png" ou "scene_1.mp4"). */
  mediaPath: z.string().optional(),
  effects: z
    .object({
      zoom: z.enum(['in', 'out', 'none']).optional(),
      transition: z.enum(['fade', 'slide', 'none', 'black', 'wipe']).optional(),
      /** Léger tremblement de caméra (tension / effort). */
      shake: z.boolean().optional(),
    })
    .optional(),
  /**
   * Texte incrusté à l'écran par-dessus le média (ex: CTA « Commence aujourd'hui »).
   * Apparaît en fondu à `startInSeconds` et reste jusqu'à la fin de la scène.
   */
  overlayText: z
    .object({
      text: z.string(),
      startInSeconds: z.number().min(0).optional(),
    })
    .optional(),
  /**
   * Vitesse de lecture du clip vidéo (1 = normal, <1 = ralenti). Sert à étirer un
   * clip court pour remplir toute la scène SANS boucle visible (mouvement continu
   * au ralenti). Injecté par un script après mesure des durées.
   */
  playbackRate: z.number().positive().optional(),
  /**
   * Carte texte (ex: fin de vidéo) : écran noir + texte centré, SANS voix ni son,
   * sans média. Si présent, la scène ignore mediaPath/narration/sounds.
   */
  card: z
    .object({
      text: z.string(),
      subtext: z.string().optional(),
    })
    .optional(),
  /** Durée réelle de la voix off. Injectée automatiquement par tts.ts. */
  durationInSeconds: z.number().optional(),
  /** Timings mot-à-mot pour le karaoké. Injectés automatiquement par tts.ts (ne pas écrire à la main). */
  words: z.array(wordTimingSchema).optional(),
  /** Sons additionnels (bruitages, ambiances, musiques) joués pendant la scène. */
  sounds: z.array(sceneSoundSchema).optional(),
});

export const storyboardSchema = z.object({
  title: z.string(),
  ratio: z.enum(['16:9', '9:16']),
  /** Voix Edge-TTS. Par défaut : fr-FR-HenriNeural. */
  voice: z.string().optional(),
  /**
   * Utiliser des voix off FOURNIES par l'utilisateur pour TOUTES les scènes
   * (skip Edge-TTS global). `npm run tts` se contente alors de mesurer la durée
   * des fichiers public/scene_<id>.mp3 (ou du `audioPath` de chaque scène).
   * Une scène peut toujours surcharger avec son propre `audioPath`. Défaut : false.
   */
  useProvidedAudio: z.boolean().optional(),
  /** Afficher les sous-titres par défaut sur toutes les scènes. Défaut : true. */
  subtitles: z.boolean().optional(),
  /**
   * Style des sous-titres :
   *  - "karaoke"   : gros mots MAJUSCULES surlignés au fil de la voix (shorts verticaux, défaut).
   *  - "cinematic" : phrase discrète et sobre centrée en bas (essai / documentaire 16:9).
   */
  subtitleStyle: z.enum(['karaoke', 'cinematic']).optional(),
  /** Musique de fond optionnelle : nom de fichier dans public/ (ex: "music.mp3"). */
  music: z.string().optional(),
  /** Volume de la musique de fond (de 0 à 1). Défaut : 0.09. */
  musicVolume: z.number().min(0).max(1).optional(),
  scenes: z.array(sceneSchema),
});

/** Props du composant racine Remotion (utilisé aussi comme schéma de Composition). */
export const mainPropsSchema = z.object({
  storyboard: storyboardSchema,
});

export type WordTiming = z.infer<typeof wordTimingSchema>;
export type SceneSound = z.infer<typeof sceneSoundSchema>;
export type Scene = z.infer<typeof sceneSchema>;
export type Storyboard = z.infer<typeof storyboardSchema>;

// ---------------------------------------------------------------------------
// Constantes & calcul de durée
// Source UNIQUE partagée par Root.tsx (durée totale) et Main.tsx (durée par scène)
// pour éviter toute divergence (bug de troncature des scènes).
// ---------------------------------------------------------------------------

export const FPS = 30;

/** Durée minimale d'une scène (garde-fou si l'audio est très court). */
export const MIN_SCENE_FRAMES = 30;

/** Durée du chevauchement d'une transition (fade/slide) entre deux scènes. */
export const TRANSITION_FRAMES = 15;

export function getSceneDurationInFrames(scene: Scene, fps: number = FPS): number {
  return Math.max(MIN_SCENE_FRAMES, Math.ceil((scene.durationInSeconds ?? 2) * fps));
}

/**
 * Frames de transition consommées AVANT une scène (chevauchement avec la précédente).
 * La première scène n'a pas de transition entrante.
 */
/**
 * Durée (en frames) d'une transition selon son type.
 * Le fondu au noir a besoin de respirer un peu plus (effet cinéma).
 */
export function transitionDurationFrames(transition?: string): number {
  switch (transition) {
    case 'none':
      return 0;
    case 'black':
      return 26; // fondu AU NOIR : plus long pour « fermer » puis rouvrir
    case 'wipe':
      return 20;
    default:
      return TRANSITION_FRAMES; // fade, slide
  }
}

export function getTransitionFramesBefore(scene: Scene, index: number): number {
  if (index === 0) return 0;
  return transitionDurationFrames(scene.effects?.transition ?? 'fade');
}

/**
 * Durée totale de la composition.
 * Les transitions chevauchent les scènes adjacentes (TransitionSeries) : on
 * soustrait leur durée pour que la composition colle exactement au contenu.
 */
export function getTotalDurationInFrames(storyboard: Storyboard, fps: number = FPS): number {
  const total = storyboard.scenes.reduce(
    (acc, scene, index) =>
      acc + getSceneDurationInFrames(scene, fps) - getTransitionFramesBefore(scene, index),
    0
  );
  return Math.max(MIN_SCENE_FRAMES, total);
}

/** Dimensions de la vidéo selon le ratio choisi. */
export function getDimensions(storyboard: Storyboard): { width: number; height: number } {
  return storyboard.ratio === '9:16'
    ? { width: 1080, height: 1920 }
    : { width: 1920, height: 1080 };
}
