import React from 'react';
import { random, useCurrentFrame } from 'remotion';

/**
 * Habillage « chaîne de méditation » : cadre arrondi sur fond sombre,
 * étalonnage chaud doré et particules lumineuses flottantes.
 *
 * ATTENTION à ne pas confondre avec une patine « film ancien » : la direction est
 * INVERSE. Ici on RÉCHAUFFE et on SATURE l'image (tons ambrés, lumière dorée),
 * là où un filtre vintage désature et vire au sépia terne.
 *
 * Trois pièces, activables séparément :
 *   - `frame`     : le média est réduit et arrondi, le fond apparaît autour
 *   - `warm`      : étalonnage doré (saturation + chaleur + contraste doux)
 *   - `particles` : poussières lumineuses en suspension, dérive très lente
 */

export type GoldenStyle = 'none' | 'frame' | 'warm' | 'full';

interface Reglage {
  /** Marge autour du média, en % de la largeur (0 = plein écran). */
  marge: number;
  /** Rayon des coins, en px. */
  rayon: number;
  /** Épaisseur du liseré clair. */
  liseré: number;
  /** Saturation (>1 = plus saturé). */
  saturation: number;
  /** Chaleur : intensité du voile doré. */
  chaleur: number;
  /** Nombre de particules (0 = aucune). */
  particules: number;
}

const STYLES: Record<Exclude<GoldenStyle, 'none'>, Reglage> = {
  // Cadre seul, image intacte.
  frame: { marge: 5.5, rayon: 28, liseré: 2, saturation: 1, chaleur: 0, particules: 0 },
  // Étalonnage seul, plein écran.
  warm: { marge: 0, rayon: 0, liseré: 0, saturation: 1.18, chaleur: 0.14, particules: 0 },
  // Les trois : ce que fait la chaîne de référence.
  full: { marge: 5.5, rayon: 28, liseré: 2, saturation: 1.18, chaleur: 0.14, particules: 26 },
};

/** Filtre CSS d'étalonnage, à appliquer AU MÉDIA. */
export function goldenFilter(style: GoldenStyle | undefined): string | undefined {
  if (!style || style === 'none') return undefined;
  const r = STYLES[style];
  if (r.saturation === 1 && r.chaleur === 0) return undefined;
  // Léger gain de luminosité et de contraste : l'image doit paraître baignée de
  // lumière, pas assombrie.
  return `saturate(${r.saturation}) contrast(1.06) brightness(1.04)`;
}

/** Géométrie du cadre (marge, arrondi, liseré) pour le conteneur du média. */
export function frameStyle(style: GoldenStyle | undefined): React.CSSProperties {
  if (!style || style === 'none') return {};
  const r = STYLES[style];
  if (r.marge === 0) return {};
  return {
    inset: `${r.marge * 0.5625}% ${r.marge}%`,
    borderRadius: r.rayon,
    overflow: 'hidden',
    boxShadow: r.liseré
      ? `0 0 0 ${r.liseré}px rgba(255, 238, 205, 0.5), 0 24px 70px rgba(0,0,0,0.55)`
      : undefined,
  };
}

/** Le fond visible autour du cadre. */
export const GoldenBackdrop: React.FC<{ style: GoldenStyle | undefined }> = ({ style }) => {
  if (!style || style === 'none' || STYLES[style].marge === 0) return null;
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse at center, #17120c 0%, #080604 100%)',
        zIndex: 0,
      }}
    />
  );
};

/**
 * Voile doré + particules, posés SUR le média.
 * `seed` (l'id de scène) décorrèle les positions d'une scène à l'autre.
 */
export const GoldenOverlay: React.FC<{ style: GoldenStyle | undefined; seed: number }> = ({
  style,
  seed,
}) => {
  const frame = useCurrentFrame();
  if (!style || style === 'none') return null;
  const r = STYLES[style];

  return (
    <>
      {r.chaleur > 0 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(160deg, rgba(255, 196, 92, 0.55) 0%, rgba(255, 150, 40, 0.28) 55%, rgba(90, 40, 0, 0.18) 100%)',
            opacity: r.chaleur,
            mixBlendMode: 'soft-light',
            pointerEvents: 'none',
          }}
        />
      )}

      {r.particules > 0 &&
        Array.from({ length: r.particules }).map((_, i) => {
          // Positions et vitesses déterministes : Lambda calcule chaque chunk
          // séparément, un Math.random() donnerait des particules qui sautent.
          const x = random(`px-${seed}-${i}`) * 100;
          const yBase = random(`py-${seed}-${i}`) * 100;
          const taille = 2 + random(`ps-${seed}-${i}`) * 4;
          const vitesse = 0.008 + random(`pv-${seed}-${i}`) * 0.022;
          const amplitude = 3 + random(`pa-${seed}-${i}`) * 7;

          // Dérive lente vers le haut, avec une oscillation latérale douce.
          const y = (yBase - frame * vitesse * 3 + 200) % 120 - 10;
          const dx = Math.sin(frame * vitesse * 2 + i) * amplitude;
          const pulse = 0.35 + Math.sin(frame * 0.02 + i * 1.7) * 0.3;

          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: `calc(${x}% + ${dx}px)`,
                top: `${y}%`,
                width: taille,
                height: taille,
                borderRadius: '50%',
                background: 'rgba(255, 236, 190, 0.95)',
                boxShadow: `0 0 ${taille * 3}px rgba(255, 213, 130, 0.9)`,
                opacity: Math.max(0, pulse),
                pointerEvents: 'none',
              }}
            />
          );
        })}
    </>
  );
};
