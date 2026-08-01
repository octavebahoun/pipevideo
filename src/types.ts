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
      transition: z.enum(['fade', 'slide', 'none', 'black', 'wipe', 'zoomPunch', 'whipPan', 'glitchCut', 'particleDissolve']).optional(),
      /** Léger tremblement de caméra (tension / effort). */
      shake: z.boolean().optional(),
      /**
       * Contrainte pour l'étape « Pause Média » : quand vrai, le média de CETTE
       * scène doit être choisi de sorte que sa composition / posture du sujet
       * RACORDE avec la fin de la scène précédente (match cut). N'a aucun impact
       * sur le rendu technique — c'est une directive pour l'agent ou l'utilisateur
       * qui sélectionne les visuels.
       */
      matchCut: z.boolean().optional(),
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
      cameraMotion: z.enum(['orbit', 'dolly', 'pan', 'static']).optional(),
      /**
       * Flash lumineux plein écran, bref (type flash photo), pour souligner un
       * instant d'éblouissement/révélation (ex: sonoluminescence, explosion).
       */
      flash: z
        .object({
          /** Décalage avant le flash, en secondes depuis le début de la scène. Défaut : 0. */
          startInSeconds: z.number().min(0).optional(),
          /** Durée totale du flash (montée + descente), en secondes. Défaut : 0.35. */
          durationInSeconds: z.number().positive().optional(),
          /** Couleur du flash. Défaut : blanc. */
          color: z.string().optional(),
        })
        .optional(),
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
   * Titre animé mot par mot (kinetic typography). Alternative plus dynamique à
   * overlayText : chaque mot apparaît en stagger avec flou + translation,
   * et les mots entourés de `*astérisques*` sont mis en avant (couleur, poids).
   * N'affecte pas les sous-titres — c'est un habillage visuel autonome.
   */
  kineticTitle: z
    .object({
      text: z.string(),
      /** Décalage avant le début de l'animation (en secondes). Défaut : 0. */
      startInSeconds: z.number().min(0).optional(),
      /** Durée totale de l'animation d'entrée d'un mot (frames). Défaut : 60. */
      animationDuration: z.number().positive().optional(),
      /** Délai entre chaque mot (frames). Défaut : 4. */
      staggerDelay: z.number().positive().optional(),
      /** Couleur des mots surlignés (`*mot*`). Défaut : #ffd700. */
      highlightColor: z.string().optional(),
      /** Taille de police (n'importe quelle valeur CSS valide). Défaut : 4.5rem. */
      fontSize: z.string().optional(),
      /** Position verticale : 'bottom' (CTA, défaut) ou 'center' (titre plein écran). */
      position: z.enum(['bottom', 'center']).optional(),
      /**
       * Variante visuelle :
       * - "reveal" : mot par mot avec flou + translation (défaut)
       * - "neon"   : texte lumineux avec glow (text-shadow étagé)
       * - "icon"   : icône + label thématique (ex: logo + "MONTAGE")
       * - "pin"    : marqueur qui tombe avec rebond + texte
       */
      variant: z.enum(['reveal', 'neon', 'icon', 'pin']).optional(),
      /** Chemin du fichier icône dans public/ (ex: "icons/premiere.svg"). Utilisé si variant="icon". */
      icon: z.string().optional(),
      /** Texte du label pour la variante icon (affiché sous l'icône). Si absent, utilise text. */
      iconLabel: z.string().optional(),
      /** Couleur du glow néon (variante "neon"). Défaut : highlightColor. */
      glowColor: z.string().optional(),
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
  /** Volume du média vidéo (audio original du clip). 0 = muet, 1 = plein volume. Défaut : 0. */
  mediaVolume: z.number().min(0).max(1).optional(),
  /** Sons additionnels (bruitages, ambiances, musiques) joués pendant la scène. */
  sounds: z.array(sceneSoundSchema).optional(),
});

export const storyboardSchema = z.object({
  title: z.string(),
  ratio: z.enum(['16:9', '9:16']),
  /** Voix ElevenLabs (ex: "george", "anais", "liam", "rachel"). Par défaut : george. */
  voice: z.string().optional(),
  /**
   * Utiliser des voix off FOURNIES par l'utilisateur pour TOUTES les scènes
   * (skip ElevenLabs global). `npm run tts` se contente alors de mesurer la durée
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
 * Durée (en frames) d'une transition selon son type.
 * Le fondu au noir a besoin de respirer un peu plus (effet cinéma).
 * Le glitchCut est volontairement très court (8 frames = ~0.27s).
 */
export function transitionDurationFrames(transition?: string): number {
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
