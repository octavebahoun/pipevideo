import React from 'react';
import {
  Img,
  OffthreadVideo,
  Audio,
  Sequence,
  Loop,
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
        // Rognage du fichier source (pour isoler un impact, ex: un seul « boum »).
        const startFrom =
          sound.trimStart != null ? Math.round(sound.trimStart * fps) : undefined;
        const endAt = sound.trimEnd != null ? Math.round(sound.trimEnd * fps) : undefined;

        return (
          <Sequence key={`${sound.src}-${i}`} from={from} durationInFrames={localDuration}>
            <Audio
              src={staticFile(sound.src)}
              loop={sound.loop ?? false}
              startFrom={startFrom}
              endAt={endAt}
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
  const { fps } = useVideoConfig();

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

  // Léger tremblement de caméra (tension / effort). On ajoute un peu d'overscan
  // (shakeScale) pour que le décalage ne fasse jamais apparaître les bords.
  const shake = scene.effects?.shake ?? false;
  const shakeScale = shake ? 1.05 : 1;
  const dx = shake ? Math.sin(frame * 0.9) * 4 + Math.sin(frame * 2.3) * 2 : 0;
  const dy = shake ? Math.cos(frame * 1.1) * 4 + Math.cos(frame * 1.7) * 2 : 0;

  const mediaPath = scene.mediaPath;
  const isVideo = mediaPath ? /\.(mp4|mkv|webm|mov|avi)$/i.test(mediaPath) : false;

  // Voix off : fichier fourni par l'utilisateur (audioPath) sinon la sortie TTS.
  const voiceSrc = scene.audioPath ?? `scene_${scene.id}.mp3`;

  // Sous-titres : la scène peut surcharger le défaut global.
  const showSubtitles = scene.showSubtitles ?? subtitlesEnabled;

  // Texte incrusté (CTA) éventuel.
  const overlayText = scene.overlayText;
  const overlayStart = (overlayText?.startInSeconds ?? 0) * fps;

  // Carte texte (ex: fin) : écran noir + texte centré, SANS média / voix / son.
  if (scene.card) {
    const appearIn = interpolate(frame, [8, 28], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    // Fondu de sortie doux sur la dernière seconde (laisser le message respirer).
    const fadeOut = interpolate(frame, [durationInFrames - 28, durationInFrames - 6], [1, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    const appear = appearIn * fadeOut;
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#000',
        }}
      >
        <div
          style={{
            opacity: appear,
            color: 'rgba(255, 255, 255, 0.92)',
            fontFamily: '"Inter", "Helvetica", sans-serif',
            fontSize: '3.4rem',
            fontWeight: 400,
            letterSpacing: '1px',
            textAlign: 'center',
            lineHeight: 1.4,
            padding: '0 8%',
          }}
        >
          {scene.card.text}
        </div>
        {scene.card.subtext && (
          <div
            style={{
              opacity: appear * 0.7,
              color: 'rgba(255, 255, 255, 0.55)',
              fontFamily: '"Inter", "Helvetica", sans-serif',
              fontSize: '1.5rem',
              marginTop: 24,
              textAlign: 'center',
            }}
          >
            {scene.card.subtext}
          </div>
        )}
      </div>
    );
  }

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
            transform: `translate(${dx}px, ${dy}px) scale(${scale * shakeScale})`,
            transformOrigin: 'center center',
          }}
        >
          {isVideo ? (
            <Loop durationInFrames={durationInFrames}>
              <OffthreadVideo
                src={staticFile(mediaPath)}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                volume={scene.mediaVolume ?? 0}
                playbackRate={scene.playbackRate ?? 1}
              />
            </Loop>
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

      {/* Voix off (Edge-TTS/ElevenLabs ou fichier fourni par l'utilisateur) */}
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

      {/* Texte incrusté (CTA) : apparaît en fondu + léger montée à startInSeconds */}
      {overlayText && (
        <div
          style={{
            position: 'absolute',
            bottom: '14%',
            left: '8%',
            right: '8%',
            display: 'flex',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              opacity: interpolate(frame, [overlayStart, overlayStart + 18], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }),
              transform: `translateY(${interpolate(
                frame,
                [overlayStart, overlayStart + 18],
                [16, 0],
                { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
              )}px)`,
              color: '#fff',
              fontFamily: '"Inter", "Helvetica", sans-serif',
              fontSize: '2.4rem',
              fontWeight: 600,
              letterSpacing: '0.5px',
              textAlign: 'center',
              textShadow: '0 2px 12px rgba(0, 0, 0, 0.9)',
            }}
          >
            {overlayText.text}
          </div>
        </div>
      )}
    </div>
  );
};
