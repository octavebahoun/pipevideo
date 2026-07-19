"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Subtitles = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const remotion_1 = require("remotion");
/** Nombre de mots affichés simultanément à l'écran. */
const CHUNK_SIZE = 5;
const Subtitles = ({ text, words, durationInFrames }) => {
    const frame = (0, remotion_1.useCurrentFrame)();
    const { fps } = (0, remotion_1.useVideoConfig)();
    const timeInSeconds = frame / fps;
    // Soit les vrais timings d'Edge-TTS (karaoké précis), soit une répartition
    // régulière du texte sur la durée de la scène (fallback si pas de timings).
    const timedWords = words && words.length > 0
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
    const chunks = [];
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
    const spr = (0, remotion_1.spring)({
        frame: frame - chunkStartFrame,
        fps,
        config: { damping: 14 },
    });
    const popScale = (0, remotion_1.interpolate)(spr, [0, 1], [0.92, 1]);
    const popOpacity = (0, remotion_1.interpolate)(spr, [0, 1], [0, 1]);
    return ((0, jsx_runtime_1.jsx)("div", { style: {
            position: 'absolute',
            bottom: '10%',
            left: '5%',
            right: '5%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            pointerEvents: 'none',
        }, children: (0, jsx_runtime_1.jsx)("div", { style: {
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
            }, children: activeChunk.map((word, index) => {
                // Le mot en cours de prononciation est surligné (karaoké).
                const isActive = timeInSeconds >= word.start && timeInSeconds < word.start + word.duration;
                return ((0, jsx_runtime_1.jsx)("span", { style: {
                        color: isActive ? '#ffd700' : 'white',
                        marginRight: '12px',
                        display: 'inline-block',
                        transform: isActive ? 'scale(1.08)' : 'scale(1)',
                    }, children: word.text }, index));
            }) }) }));
};
exports.Subtitles = Subtitles;
