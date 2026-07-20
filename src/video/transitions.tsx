import React from 'react';
import { AbsoluteFill, interpolate } from 'remotion';
import type {
  TransitionPresentation,
  TransitionPresentationComponentProps,
} from '@remotion/transitions';

type FadeThroughBlackProps = Record<string, never>;

/**
 * Transition cinématographique : la scène sortante s'assombrit jusqu'au NOIR
 * total (première moitié), puis la scène entrante émerge du noir (seconde
 * moitié). Donne l'effet « on ferme, on rouvre » demandé (fermeture de rideau
 * sombre / révélation), et masque proprement le point de boucle des clips.
 */
const FadeThroughBlack: React.FC<
  TransitionPresentationComponentProps<FadeThroughBlackProps>
> = ({ children, presentationProgress, presentationDirection }) => {
  const opacity =
    presentationDirection === 'exiting'
      ? interpolate(presentationProgress, [0, 0.5], [1, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
      : interpolate(presentationProgress, [0.5, 1], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });

  return (
    <AbsoluteFill style={{ backgroundColor: 'black' }}>
      <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
};

export const fadeThroughBlack = (): TransitionPresentation<FadeThroughBlackProps> => {
  return { component: FadeThroughBlack, props: {} };
};
