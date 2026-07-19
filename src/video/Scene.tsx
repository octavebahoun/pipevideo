import React from 'react';
import {
  Img,
  Video,
  Audio,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from 'remotion';
import { Scene, SceneSound } from '../types';
import { Subtitles } from './Subtitles';

interface SceneComponentProps {
  scene: Scene;
  durationInFrames: number;
  /** Sous-titres activés par défaut (valeur globale du storyboard). */
  subtitlesEnabled: boolean;
  /** Style des sous-titres. */
  subtitleStyle: 'karaoke' | 'cinematic';
}

/**
 * Couche de sons additionnels (bruitages/SFX, ambiances, musiques) jouée pendant
 * la scène, EN PLUS de la voix off. Chaque son peut démarrer avec un décalage,
 * boucler, et avoir des fondus d'entrée/sortie (essentiel pour le sound design :
 * drones qui montent, battement de cœur, glitch, etc.).
 */
const SceneSounds: React.FC<{ sounds: SceneSound[]; durationInFrames: number }> = ({
  sounds,
  durationInFrames,
}) => {
  const { fps } = useVideoConfig();
  return (
    <>
      {sounds.map((sound, i) => {
        const from = Math.round((sound.startInSeconds ?? 0) * fps);
        const localDuration = Math.max(1, durationInFrames - from);
        const base = sound.volume ?? 0.6;
        const fadeInFrames = Math.round((sound.fadeInSeconds ?? 0) * fps);
        const fadeOutFrames = Math.round((sound.fadeOutSeconds ?? 0) * fps);
        const hasFade = fadeInFrames > 0 || fadeOutFrames > 0;

        return (
          <Sequence key={`${sound.src}-${i}`} from={from} durationInFrames={localDuration}>
            <Audio
              src={staticFile(sound.src)}
              loop={sound.loop ?? false}
              volume={
                hasFade
                  ? (f) => {
                      let v = base;
                      if (fadeInFrames > 0) {
                        v *= interpolate(f, [0, fadeInFrames], [0, 1], {
                          extrapolateLeft: 'clamp',
                          extrapolateRight: 'clamp',
                        });
                      }
                      if (fadeOutFrames > 0) {
                        v *= interpolate(
                          f,
                          [localDuration - fadeOutFrames, localDuration],
                          [1, 0],
                          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
                        );
                      }
                      return Math.max(0, v);
                    }
                  : base
              }
            />
          </Sequence>
        );
      })}
    </>
  );
};

export const SceneComponent: React.FC<SceneComponentProps> = ({
  scene,
  durationInFrames,
  subtitlesEnabled,
  subtitleStyle,
}) => {
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

  // Voix off : fichier fourni par l'utilisateur (audioPath) sinon la sortie TTS.
  const voiceSrc = scene.audioPath ?? `scene_${scene.id}.mp3`;

  // Sous-titres : la scène peut surcharger le défaut global.
  const showSubtitles = scene.showSubtitles ?? subtitlesEnabled;

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
              loop
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

      {/* Voix off (Edge-TTS ou fichier fourni par l'utilisateur) */}
      <Audio src={staticFile(voiceSrc)} />

      {/* Sons additionnels (bruitages / ambiances / musiques) */}
      {scene.sounds && scene.sounds.length > 0 && (
        <SceneSounds sounds={scene.sounds} durationInFrames={durationInFrames} />
      )}

      {/* Sous-titres (désactivables par scène ou globalement) */}
      {showSubtitles && (
        <Subtitles
          text={scene.subtitle ?? scene.narration}
          words={scene.words}
          durationInFrames={durationInFrames}
          style={subtitleStyle}
        />
      )}
    </div>
  );
};
