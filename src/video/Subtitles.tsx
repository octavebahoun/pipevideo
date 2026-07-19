import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { WordTiming } from '../types';

interface SubtitlesProps {
  text: string;
  /** Timings mot-à-mot (karaoké). Si absent, le texte est réparti régulièrement. */
  words?: WordTiming[];
  durationInFrames: number;
}

/** Nombre de mots affichés simultanément à l'écran. */
const CHUNK_SIZE = 5;

export const Subtitles: React.FC<SubtitlesProps> = ({ text, words, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const timeInSeconds = frame / fps;

  // Soit les vrais timings d'Edge-TTS (karaoké précis), soit une répartition
  // régulière du texte sur la durée de la scène (fallback si pas de timings).
  const timedWords: WordTiming[] =
    words && words.length > 0
      ? words
      : (() => {
          const rawWords = text.split(/\s+/).filter(Boolean);
          const totalSeconds = durationInFrames / fps;
          const per = totalSeconds / Math.max(1, rawWords.length);
          return rawWords.map((w, i) => ({ text: w, start: i * per, duration: per }));
        })();

  if (timedWords.length === 0) {
    return null;
  }

  // Découpe en groupes de CHUNK_SIZE mots.
  const chunks: WordTiming[][] = [];
  for (let i = 0; i < timedWords.length; i += CHUNK_SIZE) {
    chunks.push(timedWords.slice(i, i + CHUNK_SIZE));
  }

  // Groupe courant : le dernier dont le 1er mot a déjà commencé.
  let activeChunk = chunks[0];
  for (const chunk of chunks) {
    if (timeInSeconds >= chunk[0].start) {
      activeChunk = chunk;
    }
  }

  // Petite animation d'apparition à l'arrivée du groupe.
  const chunkStartFrame = activeChunk[0].start * fps;
  const spr = spring({
    frame: frame - chunkStartFrame,
    fps,
    config: { damping: 14 },
  });
  const popScale = interpolate(spr, [0, 1], [0.92, 1]);
  const popOpacity = interpolate(spr, [0, 1], [0, 1]);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '10%',
        left: '5%',
        right: '5%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          transform: `scale(${popScale})`,
          opacity: popOpacity,
          color: 'white',
          fontFamily: '"Outfit", "Inter", "Helvetica", sans-serif',
          fontSize: '4.5rem',
          fontWeight: 900,
          textAlign: 'center',
          textTransform: 'uppercase',
          padding: '15px 30px',
          borderRadius: '12px',
          textShadow: `
            -3px -3px 0 #000,
             3px -3px 0 #000,
            -3px  3px 0 #000,
             3px  3px 0 #000,
             0px  5px 15px rgba(0, 0, 0, 0.8)
          `,
          letterSpacing: '1px',
          lineHeight: '1.2',
          maxWidth: '90%',
        }}
      >
        {activeChunk.map((word, index) => {
          // Le mot en cours de prononciation est surligné (karaoké).
          const isActive =
            timeInSeconds >= word.start && timeInSeconds < word.start + word.duration;
          return (
            <span
              key={index}
              style={{
                color: isActive ? '#ffd700' : 'white',
                marginRight: '12px',
                display: 'inline-block',
                transform: isActive ? 'scale(1.08)' : 'scale(1)',
              }}
            >
              {word.text}
            </span>
          );
        })}
      </div>
    </div>
  );
};
