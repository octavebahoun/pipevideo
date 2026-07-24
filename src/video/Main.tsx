import React from 'react';
import { z } from 'zod';
import { Audio, staticFile, useVideoConfig } from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import type { TransitionPresentation } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';
import { wipe } from '@remotion/transitions/wipe';
import {
  mainPropsSchema,
  Scene,
  getSceneDurationInFrames,
  getTransitionFramesBefore,
  transitionDurationFrames,
} from '../types';
import { SceneComponent } from './Scene';
import { fadeThroughBlack } from './transitions';

type MainProps = z.infer<typeof mainPropsSchema>;

/** Présentation de transition à jouer AVANT une scène, selon son effet. */
function presentationForScene(scene: Scene): TransitionPresentation<any> {
  const transition = scene.effects?.transition ?? 'fade';
  switch (transition) {
    case 'black':
      return fadeThroughBlack();
    case 'wipe':
      return wipe();
    case 'slide':
      return slide({ direction: 'from-right' });
    default:
      return fade();
  }
}

export const Main: React.FC<MainProps> = ({ storyboard }) => {
  const { fps } = useVideoConfig();

  // Réglages de sous-titres globaux (surchargeables par scène via showSubtitles).
  const subtitlesEnabled = storyboard.subtitles ?? true;
  const subtitleStyle = storyboard.subtitleStyle ?? 'karaoke';

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
          timing={linearTiming({
            durationInFrames: transitionDurationFrames(scene.effects?.transition ?? 'fade'),
          })}
        />
      );
    }

    children.push(
      <TransitionSeries.Sequence key={`scene-${scene.id}`} durationInFrames={durationInFrames}>
        <SceneComponent
          scene={scene}
          durationInFrames={durationInFrames}
          subtitlesEnabled={subtitlesEnabled}
          subtitleStyle={subtitleStyle}
          sfxVolume={storyboard.sfxVolume ?? 1}
        />
      </TransitionSeries.Sequence>
    );
  });

  return (
    <div style={{ flex: 1, backgroundColor: 'black', position: 'relative' }}>
      <TransitionSeries>{children}</TransitionSeries>

      {/* Musique de fond optionnelle, en boucle et à volume réduit sur toute la vidéo. */}
      {storyboard.music && (
        <Audio src={staticFile(storyboard.music)} volume={storyboard.musicVolume ?? 0.09} loop />
      )}
    </div>
  );
};
