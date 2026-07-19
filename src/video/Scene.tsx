import React from 'react';
import { Img, Video, Audio, staticFile, useCurrentFrame, interpolate } from 'remotion';
import { Scene } from '../types';
import { Subtitles } from './Subtitles';

interface SceneComponentProps {
  scene: Scene;
  durationInFrames: number;
}

export const SceneComponent: React.FC<SceneComponentProps> = ({ scene, durationInFrames }) => {
  const frame = useCurrentFrame();

  // Effet Ken Burns (zoom lent). Les fondus/slides entre scènes sont gérés
  // par TransitionSeries dans Main.tsx — on ne fait donc PAS de fondu ici
  // (sinon double fondu).
  const zoomType = scene.effects?.zoom ?? 'none';
  let scale = 1;
  if (zoomType === 'in') {
    scale = interpolate(frame, [0, durationInFrames], [1, 1.12], {
      extrapolateRight: 'clamp',
    });
  } else if (zoomType === 'out') {
    scale = interpolate(frame, [0, durationInFrames], [1.12, 1], {
      extrapolateRight: 'clamp',
    });
  }

  const mediaPath = scene.mediaPath;
  const isVideo = mediaPath ? /\.(mp4|mkv|webm|mov|avi)$/i.test(mediaPath) : false;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#050505',
      }}
    >
      {/* Média de fond */}
      {mediaPath ? (
        <div
          style={{
            width: '100%',
            height: '100%',
            transform: `scale(${scale})`,
            transformOrigin: 'center center',
          }}
        >
          {isVideo ? (
            <Video
              src={staticFile(mediaPath)}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              muted
            />
          ) : (
            <Img
              src={staticFile(mediaPath)}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          )}
        </div>
      ) : (
        /* Fallback si l'utilisateur n'a pas encore déposé de média */
        <div
          style={{
            textAlign: 'center',
            color: '#888',
            fontSize: '2.5rem',
            fontFamily: 'system-ui, sans-serif',
            padding: 40,
          }}
        >
          [ Dépose scene_{scene.id}.png ou scene_{scene.id}.mp4 dans le dossier public ]
          <div style={{ fontSize: '1.2rem', marginTop: 20, opacity: 0.7 }}>
            Prompt suggéré : {scene.narration}
          </div>
        </div>
      )}

      {/* Voix off (Edge-TTS) */}
      <Audio src={staticFile(`scene_${scene.id}.mp3`)} />

      {/* Sous-titres karaoké */}
      <Subtitles
        text={scene.subtitle ?? scene.narration}
        words={scene.words}
        durationInFrames={durationInFrames}
      />
    </div>
  );
};
