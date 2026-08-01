import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring, Img, staticFile } from 'remotion';

interface KineticTitleProps {
  text: string;
  startInSeconds?: number;
  animationDuration?: number;
  staggerDelay?: number;
  highlightColor?: string;
  fontSize?: string;
  position?: 'bottom' | 'center';
  variant?: 'reveal' | 'neon' | 'icon' | 'pin';
  icon?: string;
  iconLabel?: string;
  glowColor?: string;
}

interface WordSegment {
  text: string;
  highlighted: boolean;
}

function parseText(text: string): WordSegment[] {
  const segments: WordSegment[] = [];
  const regex = /\*(.*?)\*/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index), highlighted: false });
    }
    segments.push({ text: match[1], highlighted: true });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), highlighted: false });
  }
  return segments;
}

function splitWords(segments: WordSegment[]): { text: string; highlighted: boolean }[] {
  const words: { text: string; highlighted: boolean }[] = [];
  for (const seg of segments) {
    const split = seg.text.split(/\s+/).filter(Boolean);
    for (const w of split) {
      words.push({ text: w, highlighted: seg.highlighted });
    }
  }
  return words;
}

const pinSvg = (color: string) => (
  <svg width="80" height="96" viewBox="0 0 24 32" fill="none">
    <path
      d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
      fill={color}
    />
    <circle cx="12" cy="9" r="3.2" fill="#fff" />
  </svg>
);

const RevealWords: React.FC<{
  words: { text: string; highlighted: boolean }[];
  relativeFrame: number;
  staggerDelay: number;
  animationDuration: number;
  highlightColor: string;
  fontSize: string;
}> = ({ words, relativeFrame, staggerDelay, animationDuration, highlightColor, fontSize }) => {
  return (
    <>
      {words.map((word, i) => {
        const wordStartFrame = i * staggerDelay;
        const localProgress = (relativeFrame - wordStartFrame) / animationDuration;

        const opacity = interpolate(localProgress, [0, 1], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        const translateY = interpolate(localProgress, [0, 1], [24, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        const blur = interpolate(localProgress, [0, 1], [10, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });

        const isHighlighted = word.highlighted;
        const highlightedScale = isHighlighted
          ? interpolate(localProgress, [0, 0.3, 1], [0.9, 1.12, 1.08], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            })
          : 1;

        return (
          <span
            key={i}
            style={{
              opacity,
              transform: `translateY(${translateY}px) scale(${highlightedScale})`,
              filter: `blur(${blur}px)`,
              color: isHighlighted ? highlightColor : '#fff',
              fontFamily: '"Outfit", "Inter", "Helvetica", sans-serif',
              fontSize,
              fontWeight: isHighlighted ? 900 : 700,
              letterSpacing: isHighlighted ? '0.5px' : '0.3px',
              textShadow: isHighlighted
                ? `0 0 20px ${highlightColor}40, 0 2px 12px rgba(0, 0, 0, 0.9)`
                : '0 2px 12px rgba(0, 0, 0, 0.9)',
              marginRight: '0.25em',
              display: 'inline-block',
              whiteSpace: 'nowrap',
            }}
          >
            {word.text}
          </span>
        );
      })}
    </>
  );
};

const NeonGlow: React.FC<{
  words: { text: string; highlighted: boolean }[];
  relativeFrame: number;
  staggerDelay: number;
  animationDuration: number;
  highlightColor: string;
  fontSize: string;
}> = ({ words, relativeFrame, staggerDelay, animationDuration, highlightColor, fontSize }) => {
  return (
    <>
      {words.map((word, i) => {
        const wordStartFrame = i * staggerDelay;
        const localProgress = (relativeFrame - wordStartFrame) / animationDuration;

        const opacity = interpolate(localProgress, [0, 1], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });

        const isHighlighted = word.highlighted;
        const color = isHighlighted ? highlightColor : '#fff';
        const glowSize = isHighlighted ? 30 : 15;
        const glowSpread = isHighlighted ? 60 : 30;

        return (
          <span
            key={i}
            style={{
              opacity,
              color,
              fontFamily: '"Outfit", "Inter", "Helvetica", sans-serif',
              fontSize,
              fontWeight: 900,
              letterSpacing: '1px',
              textShadow: `
                0 0 ${glowSize}px ${color},
                0 0 ${glowSpread}px ${color}80,
                0 2px 12px rgba(0, 0, 0, 0.9)
              `,
              marginRight: '0.3em',
              display: 'inline-block',
              whiteSpace: 'nowrap',
            }}
          >
            {word.text}
          </span>
        );
      })}
    </>
  );
};

const IconLabel: React.FC<{
  label: string;
  iconPath?: string;
  frame: number;
  startFrame: number;
  highlightColor: string;
  fontSize: string;
  text: string;
}> = ({ label, iconPath, frame, startFrame, highlightColor, fontSize, text }) => {
  const { fps } = useVideoConfig();
  const relativeFrame = frame - startFrame;

  const iconOpacity = interpolate(relativeFrame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const iconScale = interpolate(relativeFrame, [0, 15], [0.5, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const labelWords = splitWords(parseText(label));

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
      }}
    >
      {iconPath ? (
        <div
          style={{
            opacity: iconOpacity,
            transform: `scale(${iconScale})`,
            width: 80,
            height: 80,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Img
            src={staticFile(iconPath)}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </div>
      ) : (
        <div
          style={{
            opacity: iconOpacity,
            transform: `scale(${iconScale})`,
            width: 64,
            height: 4,
            borderRadius: 2,
            backgroundColor: highlightColor,
          }}
        />
      )}
      <div style={{ width: '100%', textAlign: 'center', lineHeight: 1.3 }}>
        {labelWords.map((word, i) => {
          const wordStartFrame = 15 + i * 4;
          const localProgress = (relativeFrame - wordStartFrame) / 50;

          const opacity = interpolate(localProgress, [0, 1], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          const translateY = interpolate(localProgress, [0, 1], [20, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          const blur = interpolate(localProgress, [0, 1], [8, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });

          const isHighlighted = word.highlighted;

          return (
            <span
              key={i}
              style={{
                opacity,
                transform: `translateY(${translateY}px)`,
                filter: `blur(${blur}px)`,
                color: isHighlighted ? highlightColor : '#fff',
                fontFamily: '"Outfit", "Inter", "Helvetica", sans-serif',
                fontSize,
                fontWeight: isHighlighted ? 900 : 700,
                letterSpacing: isHighlighted ? '0.5px' : '0.3px',
                textShadow: isHighlighted
                  ? `0 0 20px ${highlightColor}40, 0 2px 12px rgba(0, 0, 0, 0.9)`
                  : '0 2px 12px rgba(0, 0, 0, 0.9)',
                marginRight: '0.25em',
                display: 'inline-block',
                whiteSpace: 'nowrap',
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

const PinDrop: React.FC<{
  words: { text: string; highlighted: boolean }[];
  frame: number;
  startFrame: number;
  fps: number;
  highlightColor: string;
  fontSize: string;
}> = ({ words, frame, startFrame, fps, highlightColor, fontSize }) => {
  const relativeFrame = frame - startFrame;

  const dropSpringVal = spring({
    frame: relativeFrame,
    fps,
    config: { damping: 12, stiffness: 170, mass: 0.5 },
  });
  const pinY = interpolate(dropSpringVal, [0, 1], [-120, 0]);

  const pinOpacity = interpolate(relativeFrame, [0, 8], [1, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const landingFrame = 28;
  const revealWords = relativeFrame - landingFrame;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <div
        style={{
          opacity: pinOpacity,
          transform: `translateY(${pinY}px)`,
          filter: `drop-shadow(0 4px 12px ${highlightColor}60)`,
        }}
      >
        {pinSvg(highlightColor)}
      </div>
      <div style={{ width: '100%', textAlign: 'center', lineHeight: 1.3 }}>
        {words.map((word, i) => {
          const wordStartFrame = landingFrame + i * 4;
          const localProgress = (revealWords - i * 4) / 50;

          const opacity = interpolate(localProgress, [0, 1], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          const translateY = interpolate(localProgress, [0, 1], [16, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          const blur = interpolate(localProgress, [0, 1], [8, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });

          const isHighlighted = word.highlighted;

          return (
            <span
              key={i}
              style={{
                opacity,
                transform: `translateY(${translateY}px)`,
                filter: `blur(${blur}px)`,
                color: isHighlighted ? highlightColor : '#fff',
                fontFamily: '"Outfit", "Inter", "Helvetica", sans-serif',
                fontSize,
                fontWeight: isHighlighted ? 900 : 700,
                letterSpacing: isHighlighted ? '0.5px' : '0.3px',
                textShadow: isHighlighted
                  ? `0 0 20px ${highlightColor}40, 0 2px 12px rgba(0, 0, 0, 0.9)`
                  : '0 2px 12px rgba(0, 0, 0, 0.9)',
                marginRight: '0.25em',
                display: 'inline-block',
                whiteSpace: 'nowrap',
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

export const KineticTitle: React.FC<KineticTitleProps> = ({
  text,
  startInSeconds = 0,
  animationDuration = 60,
  staggerDelay = 4,
  highlightColor = '#ffd700',
  fontSize = '4.5rem',
  position = 'bottom',
  variant = 'reveal',
  icon,
  iconLabel,
  glowColor,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const startFrame = startInSeconds * fps;
  const relativeFrame = frame - startFrame;

  const segments = parseText(text);
  const words = splitWords(segments);

  if (words.length === 0) return null;

  const effectiveGlowColor = glowColor ?? highlightColor;

  const bottomStyle: React.CSSProperties = { bottom: '14%' };
  const centerStyle: React.CSSProperties = {
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  };

  return (
    <div
      style={{
        position: 'absolute',
        left: '8%',
        right: '8%',
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        pointerEvents: 'none',
        ...(position === 'center' ? centerStyle : bottomStyle),
      }}
    >
      <div
        style={{
          textAlign: 'center',
          width: '100%',
          lineHeight: 1.3,
        }}
      >
        {variant === 'neon' ? (
          <NeonGlow
            words={words}
            relativeFrame={relativeFrame}
            staggerDelay={staggerDelay}
            animationDuration={animationDuration}
            highlightColor={effectiveGlowColor}
            fontSize={fontSize}
          />
        ) : variant === 'icon' ? (
          <IconLabel
            label={iconLabel ?? text}
            iconPath={icon}
            frame={frame}
            startFrame={startFrame}
            highlightColor={highlightColor}
            fontSize={fontSize}
            text={text}
          />
        ) : variant === 'pin' ? (
          <PinDrop
            words={words}
            frame={frame}
            startFrame={startFrame}
            fps={fps}
            highlightColor={highlightColor}
            fontSize={fontSize}
          />
        ) : (
          <RevealWords
            words={words}
            relativeFrame={relativeFrame}
            staggerDelay={staggerDelay}
            animationDuration={animationDuration}
            highlightColor={highlightColor}
            fontSize={fontSize}
          />
        )}
      </div>
    </div>
  );
};
