import React from 'react';
import { random } from 'remotion';

/**
 * Patine « pellicule ancienne » posée sur le média d'une scène.
 *
 * Volontairement STATIQUE, contrairement aux filtres film habituels : sur une
 * vidéo de méditation de quinze minutes, un grain animé et des rayures qui
 * défilent captent l'œil en permanence — exactement l'inverse de l'effet
 * recherché. Ici le grain est figé, seul le vignettage respire imperceptiblement.
 *
 * Trois intensités : `subtle` (défaut), `medium`, `strong`.
 * Réglable par scène via `scene.effects.filmGrade`, ou globalement via
 * `storyboard.filmGrade`.
 */

export type FilmGradeLevel = 'none' | 'subtle' | 'medium' | 'strong';

interface Reglage {
  /** Désaturation (0 = couleurs intactes, 1 = noir et blanc). */
  desat: number;
  /** Virage sépia. */
  sepia: number;
  /** Contraste (1 = neutre). */
  contrast: number;
  /** Opacité du grain. */
  grain: number;
  /** Force du vignettage (0 = aucun). */
  vignette: number;
  /** Voile chaud posé sur l'image. */
  voile: number;
}

const NIVEAUX: Record<Exclude<FilmGradeLevel, 'none'>, Reglage> = {
  subtle: { desat: 0.18, sepia: 0.14, contrast: 1.04, grain: 0.05, vignette: 0.3, voile: 0.05 },
  medium: { desat: 0.32, sepia: 0.26, contrast: 1.08, grain: 0.09, vignette: 0.45, voile: 0.09 },
  strong: { desat: 0.5, sepia: 0.4, contrast: 1.14, grain: 0.14, vignette: 0.6, voile: 0.14 },
};

/**
 * Filtre CSS à appliquer AU MÉDIA lui-même (désaturation, sépia, contraste).
 * Séparé des calques : ces valeurs doivent teinter l'image, pas se superposer.
 */
export function filmFilter(niveau: FilmGradeLevel | undefined): string | undefined {
  if (!niveau || niveau === 'none') return undefined;
  const r = NIVEAUX[niveau];
  return `saturate(${1 - r.desat}) sepia(${r.sepia}) contrast(${r.contrast})`;
}

/**
 * Calques posés PAR-DESSUS le média : grain, vignettage, voile chaud.
 * `seed` fixe le motif de grain — passer l'id de la scène évite que toutes les
 * scènes portent exactement le même grain, sans pour autant qu'il bouge.
 */
export const FilmGrade: React.FC<{ niveau: FilmGradeLevel | undefined; seed: number }> = ({
  niveau,
  seed,
}) => {
  if (!niveau || niveau === 'none') return null;
  const r = NIVEAUX[niveau];

  // Grain : bruit SVG figé. `random()` de Remotion est déterministe, donc le
  // rendu reste identique d'une passe à l'autre (indispensable pour Lambda, où
  // chaque chunk est calculé séparément).
  const baseFreq = 0.62 + random(`grain-${seed}`) * 0.16;

  return (
    <>
      {/* Grain */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: r.grain,
          mixBlendMode: 'overlay',
          pointerEvents: 'none',
        }}
      >
        <svg width="100%" height="100%">
          <filter id={`grain-${seed}`}>
            <feTurbulence type="fractalNoise" baseFrequency={baseFreq} numOctaves={3} seed={seed} />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter={`url(#grain-${seed})`} />
        </svg>
      </div>

      {/* Voile chaud : rapproche les noirs d'un brun de pellicule. */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgb(120, 82, 45)',
          opacity: r.voile,
          mixBlendMode: 'soft-light',
          pointerEvents: 'none',
        }}
      />

      {/* Vignettage : assombrit les bords, concentre le regard au centre. */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse at center, transparent 42%, rgba(0,0,0,${r.vignette}) 100%)`,
          pointerEvents: 'none',
        }}
      />
    </>
  );
};
