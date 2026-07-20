"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SceneComponent = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const remotion_1 = require("remotion");
const Subtitles_1 = require("./Subtitles");
/**
 * Couche de sons additionnels (bruitages/SFX, ambiances, musiques) jouée pendant
 * la scène, EN PLUS de la voix off. Chaque son peut démarrer avec un décalage,
 * boucler, et avoir des fondus d'entrée/sortie (essentiel pour le sound design :
 * drones qui montent, battement de cœur, glitch, etc.).
 */
const SceneSounds = ({ sounds, durationInFrames, }) => {
    const { fps } = (0, remotion_1.useVideoConfig)();
    return ((0, jsx_runtime_1.jsx)(jsx_runtime_1.Fragment, { children: sounds.map((sound, i) => {
            const from = Math.round((sound.startInSeconds ?? 0) * fps);
            const localDuration = Math.max(1, durationInFrames - from);
            const base = sound.volume ?? 0.6;
            const fadeInFrames = Math.round((sound.fadeInSeconds ?? 0) * fps);
            const fadeOutFrames = Math.round((sound.fadeOutSeconds ?? 0) * fps);
            const hasFade = fadeInFrames > 0 || fadeOutFrames > 0;
            // Rognage du fichier source (pour isoler un impact, ex: un seul « boum »).
            const startFrom = sound.trimStart != null ? Math.round(sound.trimStart * fps) : undefined;
            const endAt = sound.trimEnd != null ? Math.round(sound.trimEnd * fps) : undefined;
            return ((0, jsx_runtime_1.jsx)(remotion_1.Sequence, { from: from, durationInFrames: localDuration, children: (0, jsx_runtime_1.jsx)(remotion_1.Audio, { src: (0, remotion_1.staticFile)(sound.src), loop: sound.loop ?? false, startFrom: startFrom, endAt: endAt, volume: hasFade
                        ? (f) => {
                            let v = base;
                            if (fadeInFrames > 0) {
                                v *= (0, remotion_1.interpolate)(f, [0, fadeInFrames], [0, 1], {
                                    extrapolateLeft: 'clamp',
                                    extrapolateRight: 'clamp',
                                });
                            }
                            if (fadeOutFrames > 0) {
                                v *= (0, remotion_1.interpolate)(f, [localDuration - fadeOutFrames, localDuration], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
                            }
                            return Math.max(0, v);
                        }
                        : base }) }, `${sound.src}-${i}`));
        }) }));
};
const SceneComponent = ({ scene, durationInFrames, subtitlesEnabled, subtitleStyle, }) => {
    const frame = (0, remotion_1.useCurrentFrame)();
    const { fps } = (0, remotion_1.useVideoConfig)();
    // Effet Ken Burns (zoom lent). Les fondus/slides entre scènes sont gérés
    // par TransitionSeries dans Main.tsx — on ne fait donc PAS de fondu ici
    // (sinon double fondu).
    const zoomType = scene.effects?.zoom ?? 'none';
    let scale = 1;
    if (zoomType === 'in') {
        scale = (0, remotion_1.interpolate)(frame, [0, durationInFrames], [1, 1.12], {
            extrapolateRight: 'clamp',
        });
    }
    else if (zoomType === 'out') {
        scale = (0, remotion_1.interpolate)(frame, [0, durationInFrames], [1.12, 1], {
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
        const appearIn = (0, remotion_1.interpolate)(frame, [8, 28], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
        });
        // Fondu de sortie doux sur la dernière seconde (laisser le message respirer).
        const fadeOut = (0, remotion_1.interpolate)(frame, [durationInFrames - 28, durationInFrames - 6], [1, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
        });
        const appear = appearIn * fadeOut;
        return ((0, jsx_runtime_1.jsxs)("div", { style: {
                width: '100%',
                height: '100%',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: '#000',
            }, children: [(0, jsx_runtime_1.jsx)("div", { style: {
                        opacity: appear,
                        color: 'rgba(255, 255, 255, 0.92)',
                        fontFamily: '"Inter", "Helvetica", sans-serif',
                        fontSize: '3.4rem',
                        fontWeight: 400,
                        letterSpacing: '1px',
                        textAlign: 'center',
                        lineHeight: 1.4,
                        padding: '0 8%',
                    }, children: scene.card.text }), scene.card.subtext && ((0, jsx_runtime_1.jsx)("div", { style: {
                        opacity: appear * 0.7,
                        color: 'rgba(255, 255, 255, 0.55)',
                        fontFamily: '"Inter", "Helvetica", sans-serif',
                        fontSize: '1.5rem',
                        marginTop: 24,
                        textAlign: 'center',
                    }, children: scene.card.subtext }))] }));
    }
    return ((0, jsx_runtime_1.jsxs)("div", { style: {
            width: '100%',
            height: '100%',
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: '#050505',
        }, children: [mediaPath ? ((0, jsx_runtime_1.jsx)("div", { style: {
                    width: '100%',
                    height: '100%',
                    transform: `translate(${dx}px, ${dy}px) scale(${scale * shakeScale})`,
                    transformOrigin: 'center center',
                }, children: isVideo ? ((0, jsx_runtime_1.jsx)(remotion_1.Loop, { durationInFrames: durationInFrames, children: (0, jsx_runtime_1.jsx)(remotion_1.OffthreadVideo, { src: (0, remotion_1.staticFile)(mediaPath), style: { width: '100%', height: '100%', objectFit: 'cover' }, muted: true, playbackRate: scene.playbackRate ?? 1 }) })) : ((0, jsx_runtime_1.jsx)(remotion_1.Img, { src: (0, remotion_1.staticFile)(mediaPath), style: { width: '100%', height: '100%', objectFit: 'cover' } })) })) : (
            /* Fallback si l'utilisateur n'a pas encore déposé de média */
            (0, jsx_runtime_1.jsxs)("div", { style: {
                    textAlign: 'center',
                    color: '#888',
                    fontSize: '2.5rem',
                    fontFamily: 'system-ui, sans-serif',
                    padding: 40,
                }, children: ["[ D\u00E9pose scene_", scene.id, ".png ou scene_", scene.id, ".mp4 dans le dossier public ]", (0, jsx_runtime_1.jsxs)("div", { style: { fontSize: '1.2rem', marginTop: 20, opacity: 0.7 }, children: ["Prompt sugg\u00E9r\u00E9 : ", scene.narration] })] })), (0, jsx_runtime_1.jsx)(remotion_1.Audio, { src: (0, remotion_1.staticFile)(voiceSrc) }), scene.sounds && scene.sounds.length > 0 && ((0, jsx_runtime_1.jsx)(SceneSounds, { sounds: scene.sounds, durationInFrames: durationInFrames })), showSubtitles && ((0, jsx_runtime_1.jsx)(Subtitles_1.Subtitles, { text: scene.subtitle ?? scene.narration, words: scene.words, durationInFrames: durationInFrames, style: subtitleStyle })), overlayText && ((0, jsx_runtime_1.jsx)("div", { style: {
                    position: 'absolute',
                    bottom: '14%',
                    left: '8%',
                    right: '8%',
                    display: 'flex',
                    justifyContent: 'center',
                    pointerEvents: 'none',
                }, children: (0, jsx_runtime_1.jsx)("div", { style: {
                        opacity: (0, remotion_1.interpolate)(frame, [overlayStart, overlayStart + 18], [0, 1], {
                            extrapolateLeft: 'clamp',
                            extrapolateRight: 'clamp',
                        }),
                        transform: `translateY(${(0, remotion_1.interpolate)(frame, [overlayStart, overlayStart + 18], [16, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}px)`,
                        color: '#fff',
                        fontFamily: '"Inter", "Helvetica", sans-serif',
                        fontSize: '2.4rem',
                        fontWeight: 600,
                        letterSpacing: '0.5px',
                        textAlign: 'center',
                        textShadow: '0 2px 12px rgba(0, 0, 0, 0.9)',
                    }, children: overlayText.text }) }))] }));
};
exports.SceneComponent = SceneComponent;
