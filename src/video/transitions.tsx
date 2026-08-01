import React from 'react';
import { AbsoluteFill, interpolate } from 'remotion';
import type {
  TransitionPresentation,
  TransitionPresentationComponentProps,
} from '@remotion/transitions';

// ---------------------------------------------------------------------------
// FadeThroughBlack (existant)
// ---------------------------------------------------------------------------

type FadeThroughBlackProps = Record<string, never>;

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

// ---------------------------------------------------------------------------
// ZoomPunch
// La scène sortante zoome vers le centre (scale 1 → 1.5), la scène entrante
// démarre dézoomée (scale 1.5 → 1). Effet « coup » des edits musicaux.
// ---------------------------------------------------------------------------

type ZoomPunchProps = Record<string, never>;

const ZoomPunch: React.FC<
  TransitionPresentationComponentProps<ZoomPunchProps>
> = ({ children, presentationProgress, presentationDirection }) => {
  const scale =
    presentationDirection === 'exiting'
      ? interpolate(presentationProgress, [0, 1], [1, 1.5], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
      : interpolate(presentationProgress, [0, 1], [1.5, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });

  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          transform: `scale(${scale})`,
        }}
      >
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const zoomPunch = (): TransitionPresentation<ZoomPunchProps> => {
  return { component: ZoomPunch, props: {} };
};

// ---------------------------------------------------------------------------
// WhipPan
// Identique à slide mais avec un flou horizontal (blur) qui culmine au milieu
// de la transition quand la vitesse de défilement est maximale, simulant un
// motion blur directionnel.
// ---------------------------------------------------------------------------

type WhipPanProps = Record<string, never>;

const WhipPan: React.FC<
  TransitionPresentationComponentProps<WhipPanProps>
> = ({ children, presentationProgress, presentationDirection }) => {
  const exiting = presentationDirection === 'exiting';

  const translateX = exiting
    ? interpolate(presentationProgress, [0, 1], [0, -100], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : interpolate(presentationProgress, [0, 1], [100, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });

  const speed = Math.sin(presentationProgress * Math.PI);
  const blur = speed * 5;

  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          transform: `translateX(${translateX}%)`,
          filter: `blur(${blur}px)`,
        }}
      >
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const whipPan = (): TransitionPresentation<WhipPanProps> => {
  return { component: WhipPan, props: {} };
};

// ---------------------------------------------------------------------------
// GlitchCut
// Très courte coupure (8 frames) : la scène sortante se déforme avec un
// décalage RGB + bandes déplacées aléatoirement juste avant le cut, puis la
// scène entrante apparaît avec un flash blanc bref.
// ---------------------------------------------------------------------------

type GlitchCutProps = Record<string, never>;

const GlitchCut: React.FC<
  TransitionPresentationComponentProps<GlitchCutProps>
> = ({ children, presentationProgress, presentationDirection }) => {
  const exiting = presentationDirection === 'exiting';

  if (exiting) {
    const glitchIntensity = Math.max(0, (presentationProgress - 0.35) / 0.65);

    if (glitchIntensity < 0.01) {
      return (
        <AbsoluteFill style={{ backgroundColor: 'black' }}>
          <AbsoluteFill>{children}</AbsoluteFill>
        </AbsoluteFill>
      );
    }

    const seed = presentationProgress;
    const rOffset = Math.sin(seed * 17.3) * 10 * glitchIntensity;
    const bOffset = Math.sin(seed * 23.7) * 10 * glitchIntensity;

    const bandTop = (Math.sin(seed * 31.7) * 0.5 + 0.5) * 60 + 10;
    const bandHeight = 16;
    const bandShift = Math.sin(seed * 41.2) * 20 * glitchIntensity;
    const band2Top = (Math.sin(seed * 53.9) * 0.5 + 0.5) * 60 + 10;
    const band2Shift = Math.sin(seed * 67.3) * 15 * glitchIntensity;

    return (
      <AbsoluteFill style={{ backgroundColor: 'black' }}>
        <AbsoluteFill>{children}</AbsoluteFill>

        <AbsoluteFill
          style={{
            transform: `translateX(${rOffset}px)`,
            filter: 'sepia(1) saturate(100) hue-rotate(-50deg)',
            mixBlendMode: 'screen' as unknown as React.CSSProperties['mixBlendMode'],
            opacity: glitchIntensity * 0.8,
          }}
        >
          {children}
        </AbsoluteFill>

        <AbsoluteFill
          style={{
            transform: `translateX(${bOffset}px)`,
            filter: 'sepia(1) saturate(100) hue-rotate(120deg)',
            mixBlendMode: 'screen' as unknown as React.CSSProperties['mixBlendMode'],
            opacity: glitchIntensity * 0.8,
          }}
        >
          {children}
        </AbsoluteFill>

        <AbsoluteFill
          style={{
            clipPath: `inset(${bandTop}% 0% ${100 - bandTop - bandHeight}% 0%)`,
            transform: `translateX(${bandShift}px)`,
          }}
        >
          {children}
        </AbsoluteFill>

        <AbsoluteFill
          style={{
            clipPath: `inset(${band2Top}% 0% ${100 - band2Top - bandHeight}% 0%)`,
            transform: `translateX(${band2Shift}px)`,
            filter: 'brightness(1.3) contrast(1.5)',
          }}
        >
          {children}
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }

  const flash = interpolate(presentationProgress, [0, 0.35], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: 'white' }}>
      <AbsoluteFill style={{ opacity: 1 - flash }}>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
};

export const glitchCut = (): TransitionPresentation<GlitchCutProps> => {
  return { component: GlitchCut, props: {} };
};

// ---------------------------------------------------------------------------
// ParticleDissolve
// La scène sortante se dissout en un nuage de particules lumineuses qui
// scintillent et se dispersent, puis le nuage converge et se recompose en
// la scène entrante. Transition douce et « propre », idéale pour les cards /
// titres ou comme transition générale entre deux scènes.
// Durée : 40 frames.
// ---------------------------------------------------------------------------

const PARTICLE_COUNT = 100;

interface Particle {
  ox: number;
  oy: number;
  size: number;
  color: string;
  delay: number;
}

const PARTICLES: Particle[] = (() => {
  const colors = ['#ffffff', '#ffd700', '#87ceeb', '#ffb6c1', '#ffa500', '#90ee90'];
  const ps: Particle[] = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const angle = (i / PARTICLE_COUNT) * Math.PI * 2 + 0.3;
    const dist = 40 + ((i * 37) % 210);
    ps.push({
      ox: Math.cos(angle) * dist,
      oy: Math.sin(angle) * dist,
      size: 2 + (i % 5),
      color: colors[i % colors.length],
      delay: ((i * 7) % 12) / 15,
    });
  }
  return ps;
})();

type ParticleDissolveProps = Record<string, never>;

const ParticleDissolve: React.FC<
  TransitionPresentationComponentProps<ParticleDissolveProps>
> = ({ children, presentationProgress, presentationDirection }) => {
  const exiting = presentationDirection === 'exiting';

  if (exiting) {
    const sceneOpacity = interpolate(presentationProgress, [0, 0.5], [1, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });

    const particleT = interpolate(presentationProgress, [0, 0.5], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });

    const particleOpacity = interpolate(
      presentationProgress,
      [0.12, 0.35, 0.5, 0.75],
      [0, 1, 1, 0],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
    );

    const twinkle = Math.sin(presentationProgress * Math.PI * 6) * 0.2 + 0.8;

    return (
      <AbsoluteFill style={{ backgroundColor: 'black' }}>
        <AbsoluteFill style={{ opacity: sceneOpacity }}>{children}</AbsoluteFill>
        {PARTICLES.map((p, i) => {
          const effectiveT = Math.max(
            0,
            Math.min(1, (particleT - p.delay) / (1 - p.delay)),
          );
          const x = effectiveT * p.ox;
          const y = effectiveT * p.oy;
          const s = (effectiveT * 0.6 + 0.4) * twinkle;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: p.size,
                height: p.size,
                borderRadius: '50%',
                backgroundColor: p.color,
                opacity: particleOpacity * (0.7 + Math.sin(i * 3 + presentationProgress * 10) * 0.3),
                transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(${s})`,
                boxShadow: `0 0 ${p.size * 2.5}px ${p.color}90`,
              }}
            />
          );
        })}
      </AbsoluteFill>
    );
  }

  // Entering
  const sceneOpacity = interpolate(presentationProgress, [0.4, 0.9], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const particleT = interpolate(presentationProgress, [0.35, 0.85], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const particleOpacity = interpolate(
    presentationProgress,
    [0.12, 0.35, 0.5, 0.8],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  const twinkle = Math.sin(presentationProgress * Math.PI * 6) * 0.2 + 0.8;

  return (
    <AbsoluteFill style={{ backgroundColor: 'black' }}>
      {PARTICLES.map((p, i) => {
        const effectiveT = Math.max(
          0,
          Math.min(1, (particleT - p.delay) / (1 - p.delay)),
        );
        const x = effectiveT * p.ox;
        const y = effectiveT * p.oy;
        const s = (effectiveT * 0.6 + 0.4) * twinkle;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: p.size,
              height: p.size,
              borderRadius: '50%',
              backgroundColor: p.color,
              opacity: particleOpacity * (0.7 + Math.sin(i * 7 + presentationProgress * 10) * 0.3),
              transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(${s})`,
              boxShadow: `0 0 ${p.size * 2.5}px ${p.color}90`,
            }}
          />
        );
      })}
      <AbsoluteFill style={{ opacity: sceneOpacity }}>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
};

export const particleDissolve = (): TransitionPresentation<ParticleDissolveProps> => {
  return { component: ParticleDissolve, props: {} };
};
