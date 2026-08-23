/**
 * Capacité de rendu Lambda : combien de minutes de vidéo la configuration
 * actuelle peut monter.
 *
 * Extrait ici parce que DEUX endroits en ont besoin — `preflight` pour refuser
 * avant la génération GPU, `render-lambda` pour dimensionner les chunks. Deux
 * copies de la formule divergeraient, et un rendu passerait le premier contrôle
 * pour être refusé par le second : après huit minutes de GPU payé.
 */

/** Mémoire par vCPU chez AWS Lambda : ~1769 Mo. */
const MO_PAR_VCPU = 1769;

/**
 * Coût de rendu d'une frame, en séquentiel. MESURÉ, pas estimé : un chunk de
 * 1229 frames a dépassé le timeout de 600 s sur une vidéo `goldenStyle: "full"`
 * (1229 × 0,49 s ≈ 600 s).
 *
 * Valeur retenue avant l'allègement des particules — donc pessimiste depuis, ce
 * qui va dans le bon sens : mieux vaut refuser un rendu qui aurait passé que
 * l'inverse.
 */
const SECONDES_PAR_FRAME_SEQ = 0.55;

/**
 * Rendement du parallélisme interne. Pas linéaire : les onglets Chromium se
 * disputent le disque et la mémoire. 80 % par cœur supplémentaire.
 */
const RENDEMENT_PARALLELE = 0.8;

/** Part du timeout réservée au rendu, le reste couvrant l'amorçage et l'assemblage. */
const MARGE_TIMEOUT = 0.85;

export interface CapaciteLambda {
  /** Frames rendues en parallèle dans UNE Lambda. */
  concurrencyPerLambda: number;
  /** Nombre de Lambdas de rendu utilisables en une vague. */
  renderers: number;
  /** Frames maximales par chunk avant de risquer le timeout. */
  maxFramesParChunk: number;
  /** Frames totales que la configuration peut monter. */
  capaciteFrames: number;
  /** La même valeur en minutes de vidéo. */
  capaciteMinutes: number;
  /** Coût par frame après parallélisation. */
  secondesParFrame: number;
}

/**
 * @param timeoutSeconds timeout de la fonction Lambda déployée
 * @param memoryMb       mémoire de la fonction (c'est elle qui achète les vCPU)
 * @param quotaLambdas   quota AWS « Concurrent executions » du compte
 * @param fps            images par seconde de la composition
 */
export function capaciteLambda(
  timeoutSeconds: number,
  memoryMb: number,
  quotaLambdas: number,
  fps: number
): CapaciteLambda {
  // Deux slots réservés : la fonction « launch » qui orchestre, et une marge pour
  // les invocations transitoires de Remotion. Dépasser le quota est fatal et non
  // retenté (« Rate Exceeded »).
  const renderers = Math.max(1, quotaLambdas - 2);

  // En dessous du nombre de vCPU disponibles : chaque onglet Chromium consomme de
  // la mémoire, et un dépassement fait tomber la Lambda en OOM — bien plus
  // coûteux qu'un rendu un peu plus lent.
  const vcpu = Math.max(1, Math.floor(memoryMb / MO_PAR_VCPU));
  const concurrencyPerLambda = Math.max(1, Math.min(vcpu, Math.floor(memoryMb / 1400)));

  const secondesParFrame =
    SECONDES_PAR_FRAME_SEQ / (1 + (concurrencyPerLambda - 1) * RENDEMENT_PARALLELE);
  const maxFramesParChunk = Math.floor((timeoutSeconds * MARGE_TIMEOUT) / secondesParFrame);
  const capaciteFrames = maxFramesParChunk * renderers;

  return {
    concurrencyPerLambda,
    renderers,
    maxFramesParChunk,
    capaciteFrames,
    capaciteMinutes: capaciteFrames / (fps * 60),
    secondesParFrame,
  };
}
