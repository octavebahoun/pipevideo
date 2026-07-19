import React from 'react';
import { z } from 'zod';
import { Audio, staticFile, useVideoConfig } from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';
import {
  mainPropsSchema,
  Scene,
  getSceneDurationInFrames,
  getTransitionFramesBefore,
  TRANSITION_FRAMES,
} from '../types';
import { SceneComponent } from './Scene';

type MainProps = z.infer<typeof mainPropsSchema>;

/** Présentation de transition à jouer AVANT une scène, selon son effet. */
function presentationForScene(scene: Scene) {
  const transition = scene.effects?.transition ?? 'fade';
  if (transition === 'slide') {
    return slide({ direction: 'from-right' });
  }
  return fade();
}

export const Main: React.FC<MainProps> = ({ storyboard }) => {
  const { fps } = useVideoConfig();

  // On construit une liste plate [Sequence, Transition, Sequence, ...] car
  // TransitionSeries attend ses enfants directement (pas dans des fragments).
  const children: React.ReactNode[] = [];
  storyboard.scenes.forEach((scene, index) => {
    const durationInFrames = getSceneDurationInFrames(scene, fps);

    if (getTransitionFramesBefore(scene, index) > 0) {
      children.push(
        <TransitionSeries.Transition
          key={`transition-${scene.id}`}
          presentation={presentationForScene(scene)}
          timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
        />
      );
    }

    children.push(
      <TransitionSeries.Sequence key={`scene-${scene.id}`} durationInFrames={durationInFrames}>
        <SceneComponent scene={scene} durationInFrames={durationInFrames} />
      </TransitionSeries.Sequence>
    );
  });

  return (
    <div style={{ flex: 1, backgroundColor: 'black', position: 'relative' }}>
      <TransitionSeries>{children}</TransitionSeries>

      {/* Musique de fond optionnelle, en boucle et à volume réduit sur toute la vidéo. */}
      {storyboard.music && (
        <Audio src={staticFile(storyboard.music)} volume={0.18} loop />
      )}
    </div>
  );
};
