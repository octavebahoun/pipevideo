"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Subtitles = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const remotion_1 = require("remotion");
const Subtitles = ({ text, words, durationInFrames, style = 'karaoke', }) => {
    const frame = (0, remotion_1.useCurrentFrame)();
    const { fps } = (0, remotion_1.useVideoConfig)();
    const timeInSeconds = frame / fps;
    // Le style cinéma affiche des groupes plus longs (lecture posée) ;
    // le karaoké des groupes courts et punchy.
    const chunkSize = style === 'cinematic' ? 8 : 5;
    // Soit les vrais timings d'Edge-TTS (karaoké précis), soit une répartition
    // régulière du texte sur la durée de la scène (fallback si pas de timings —
    // typiquement quand la voix off est fournie par l'utilisateur).
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
    // Découpe en groupes.
    const chunks = [];
    for (let i = 0; i < timedWords.length; i += chunkSize) {
        chunks.push(timedWords.slice(i, i + chunkSize));
    }
    // Groupe courant : le groupe activement prononcé en ce moment.
    let activeChunk = null;
    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const chunkStart = chunk[0].start;
        const lastWord = chunk[chunk.length - 1];
        const nextChunkStart = chunks[i + 1] ? chunks[i + 1][0].start : Infinity;
        const chunkEnd = Math.min(nextChunkStart, lastWord.start + lastWord.duration + 0.6);
        if (timeInSeconds >= chunkStart && timeInSeconds < chunkEnd) {
            activeChunk = chunk;
            break;
        }
    }
    if (!activeChunk) {
        return null;
    }
    // Petite animation d'apparition à l'arrivée du groupe.
    const chunkStartFrame = activeChunk[0].start * fps;
    const spr = (0, remotion_1.spring)({
        frame: Math.max(0, frame - chunkStartFrame),
        fps,
        config: { damping: 14 },
    });
    if (style === 'cinematic') {
        // Sous-titre sobre : sans MAJUSCULES, sans surlignage mot-à-mot, léger fondu.
        const opacity = (0, remotion_1.interpolate)(spr, [0, 1], [0, 1]);
        return ((0, jsx_runtime_1.jsx)("div", { style: {
                position: 'absolute',
                bottom: '8%',
                left: '10%',
                right: '10%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'flex-end',
                pointerEvents: 'none',
            }, children: (0, jsx_runtime_1.jsx)("div", { style: {
                    opacity,
                    color: 'rgba(255, 255, 255, 0.94)',
                    fontFamily: '"Inter", "Helvetica", sans-serif',
                    fontSize: '2.6rem',
                    fontWeight: 500,
                    textAlign: 'center',
                    lineHeight: '1.35',
                    letterSpacing: '0.2px',
                    maxWidth: '100%',
                    textShadow: '0px 2px 8px rgba(0, 0, 0, 0.9)',
                }, children: activeChunk.map((w) => w.text).join(' ') }) }));
    }
    // Style "karaoke" (défaut) — inchangé.
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
