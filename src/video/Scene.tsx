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
import { mediaUrl } from './mediaUrl';
import { FilmGrade, filmFilter, FilmGradeLevel } from './FilmGrade';
import {
  GoldenBackdrop,
  GoldenOverlay,
  goldenFilter,
  frameStyle,
  GoldenStyle,
} from './GoldenFrame';
import { Scene, SceneSound } from '../types';
import { Subtitles } from './Subtitles';
import { KineticTitle } from './KineticTitle';

interface SceneComponentProps {
  scene: Scene;
  durationInFrames: number;
  /** Sous-titres activés par défaut (valeur globale du storyboard). */
  subtitlesEnabled: boolean;
  /** Style des sous-titres. */
  subtitleStyle: 'karaoke' | 'fondant' | 'cinematic';
  /** Multiplicateur global de volume pour les sons additionnels (storyboard.sfxVolume, défaut 1). */
  sfxVolume: number;
  /** Base des URLs médias quand ils sont hébergés sur R2 (voir mediaUrl.ts). */
  assetBaseUrl?: string;
  /** Patine pellicule globale du storyboard (la scène peut la redéfinir). */
  filmGrade?: FilmGradeLevel;
  /** Habillage doré global : cadre arrondi, étalonnage chaud, particules. */
  goldenStyle?: GoldenStyle;
}

/**
 * Couche de sons additionnels (bruitages/SFX, ambiances, musiques) jouée pendant
 * la scène, EN PLUS de la voix off. Chaque son peut démarrer avec un décalage,
 * boucler, et avoir des fondus d'entrée/sortie (essentiel pour le sound design :
 * drones qui montent, battement de cœur, glitch, etc.).
 */
const SceneSounds: React.FC<{
  sounds: SceneSound[];
  durationInFrames: number;
  sfxVolume: number;
  assetBaseUrl?: string;
}> = ({
  sounds,
  durationInFrames,
  sfxVolume,
  assetBaseUrl,
}) => {
  const { fps } = useVideoConfig();
  return (
    <>
      {sounds.map((sound, i) => {
        const from = Math.round((sound.startInSeconds ?? 0) * fps);
        const localDuration = Math.max(1, durationInFrames - from);
        const base = (sound.volume ?? 0.6) * sfxVolume;
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
              src={mediaUrl(sound.src, assetBaseUrl)}
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
  sfxVolume,
  assetBaseUrl,
  filmGrade,
  goldenStyle,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Effet Ken Burns (zoom lent). Les fondus/slides entre scènes sont gérés
  // par TransitionSeries dans Main.tsx — on ne fait donc PAS de fondu ici
  // (sinon double fondu).
  // La scène peut redéfinir la patine ; sinon on prend celle du storyboard.
  const grade = scene.effects?.filmGrade ?? filmGrade;
  const golden = scene.effects?.goldenStyle ?? goldenStyle;

  // Les deux étalonnages se composent : filmFilter (patine) puis goldenFilter
  // (chaleur dorée). En pratique on utilise l'un OU l'autre.
  const mediaFilter = [filmFilter(grade), goldenFilter(golden)].filter(Boolean).join(' ') || undefined;
  const cadre = frameStyle(golden);
  const aCadre = Object.keys(cadre).length > 0;

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
  const isVideo = !Array.isArray(mediaPath) && mediaPath != null && /\.(mp4|mkv|webm|mov|avi)$/i.test(mediaPath);
  const isImageArray = Array.isArray(mediaPath) && mediaPath.length > 0;

  // Zoom par image (diaporama) : chaque image zoome sur sa propre fenêtre.
  const localZoom = (localFrame: number, segFrames: number) => {
    if (zoomType === 'in') return interpolate(localFrame, [0, segFrames], [1, 1.12], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    if (zoomType === 'out') return interpolate(localFrame, [0, segFrames], [1.12, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    return 1;
  };

  // Fondu croisé entre images d'un diaporama.
  const slideOpacity = (i: number, seg: number) => {
    if ((mediaPath as string[]).length === 1) return 1;
    const cross = Math.max(1, Math.min(Math.floor(seg * 0.25), 30));
    const start = i * seg;
    const end = start + seg;
    const fadeIn = interpolate(frame, [start, start + cross], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    const fadeOut = interpolate(frame, [end - cross, end], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    return Math.min(1, fadeIn) * Math.min(1, fadeOut);
  };

  // Voix off : fichier fourni par l'utilisateur (audioPath) sinon la sortie TTS.
  const voiceSrc = scene.audioPath ?? `scene_${scene.id}.mp3`;

  // Sous-titres : la scène peut surcharger le défaut global.
  const showSubtitles = scene.showSubtitles ?? subtitlesEnabled;

  // Texte incrusté (CTA) éventuel.
  const overlayText = scene.overlayText;
  const overlayStart = (overlayText?.startInSeconds ?? 0) * fps;

  // Flash lumineux plein écran (ex: sonoluminescence) : montée quasi instantanée
  // puis décroissance, façon flash photo.
  const flash = scene.effects?.flash;
  let flashOpacity = 0;
  if (flash) {
    const flashStart = (flash.startInSeconds ?? 0) * fps;
    const flashDuration = Math.max(1, Math.round((flash.durationInSeconds ?? 0.35) * fps));
    const riseFrames = Math.max(1, Math.round(flashDuration * 0.25));
    flashOpacity = interpolate(
      frame,
      [flashStart, flashStart + riseFrames, flashStart + flashDuration],
      [0, 1, 0],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );
  }

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
      {/* Fond visible autour du cadre (habillage doré) */}
      <GoldenBackdrop style={golden} />

      {/* Le cadre arrondi : le média est réduit et ses coins adoucis. Sans
          habillage, `cadre` est vide et ce conteneur est transparent. */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          ...cadre,
        }}
      >
      {/* Média de fond */}
      {isImageArray ? (
        <div
          style={{
            width: '100%',
            height: '100%',
            transform: `translate(${dx}px, ${dy}px) scale(${shakeScale})`,
            transformOrigin: 'center center',
          }}
        >
          {(mediaPath as string[]).map((img, i) => {
            const seg = durationInFrames / mediaPath.length;
            const local = frame - i * seg;
            return (
              <Img
                key={img}
                src={mediaUrl(img, assetBaseUrl)}
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  opacity: slideOpacity(i, seg),
                  transform: `scale(${localZoom(local, seg)})`,
                }}
              />
            );
          })}
        </div>
      ) : mediaPath ? (
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
                src={mediaUrl(mediaPath as string, assetBaseUrl)}
                style={{ width: '100%', height: '100%', objectFit: 'cover', filter: mediaFilter }}
                volume={scene.mediaVolume ?? 0.6}
                playbackRate={scene.playbackRate ?? 1}
              />
            </Loop>
          ) : (
            <Img
              src={mediaUrl(mediaPath as string, assetBaseUrl)}
              style={{ width: '100%', height: '100%', objectFit: 'cover', filter: mediaFilter }}
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

      {/* Voile doré + particules : DANS le cadre, donc arrondis avec lui. */}
        <GoldenOverlay style={golden} seed={scene.id} />
      </div>

      {/* Patine pellicule : grain, voile chaud, vignettage. Posée SUR le média
          mais SOUS les sous-titres et les titres, qui doivent rester nets. */}
      <FilmGrade niveau={grade} seed={scene.id} />

      {/* Voix off (Edge-TTS/ElevenLabs ou fichier fourni par l'utilisateur) */}
      <Audio src={mediaUrl(voiceSrc, assetBaseUrl)} />

      {/* Sons additionnels (bruitages / ambiances / musiques) */}
      {scene.sounds && scene.sounds.length > 0 && (
        <SceneSounds
          sounds={scene.sounds}
          durationInFrames={durationInFrames}
          sfxVolume={sfxVolume}
          assetBaseUrl={assetBaseUrl}
        />
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

      {/* Texte incrusté : KineticTitle (mot par mot) OU overlayText (CTA / label HUD).
          L'overlayText est en HAUT de l'image pour ne jamais chevaucher les sous-titres
          karaoké (positionnés en bas, voir Subtitles.tsx). Apparaît en fondu à startInSeconds. */}
      {scene.kineticTitle ? (
        <KineticTitle
          text={scene.kineticTitle.text}
          startInSeconds={scene.kineticTitle.startInSeconds}
          animationDuration={scene.kineticTitle.animationDuration}
          staggerDelay={scene.kineticTitle.staggerDelay}
          highlightColor={scene.kineticTitle.highlightColor}
          fontSize={scene.kineticTitle.fontSize}
          position={scene.kineticTitle.position}
          variant={scene.kineticTitle.variant}
          icon={scene.kineticTitle.icon}
          iconLabel={scene.kineticTitle.iconLabel}
          glowColor={scene.kineticTitle.glowColor}
        />
      ) : (
        overlayText && (
          <div
            style={{
              position: 'absolute',
              top: '8%',
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
                  [-16, 0],
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
        )
      )}

      {/* Flash lumineux plein écran (ex: sonoluminescence) */}
      {flash && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: flash.color ?? '#ffffff',
            opacity: flashOpacity,
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  );
};
