import React from 'react';
import { useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';

interface SubtitlesProps {
  text: string;
  durationInFrames: number;
}

export const Subtitles: React.FC<SubtitlesProps> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Animation d'entrée douce (pop in) pour chaque scène
  const spr = spring({
    frame,
    fps,
    config: {
      damping: 12,
    },
  });

  const scale = interpolate(spr, [0, 1], [0.9, 1]);
  const opacity = interpolate(spr, [0, 1], [0, 1]);

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
          transform: `scale(${scale})`,
          opacity,
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
        }}
      >
        {/* Colorer certains mots pour donner un style dynamique (jaune/orange) */}
        {text.split(' ').map((word, index) => {
          // Colorer un mot sur 4 ou 5
          const shouldHighlight = index % 4 === 1;
          return (
            <span
              key={index}
              style={{
                color: shouldHighlight ? '#ffd700' : 'white',
                marginRight: '12px',
                display: 'inline-block',
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    </div>
  );
};
