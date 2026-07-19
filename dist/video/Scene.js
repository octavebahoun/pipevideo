"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SceneComponent = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const remotion_1 = require("remotion");
const Subtitles_1 = require("./Subtitles");
const SceneComponent = ({ scene, durationInFrames }) => {
    const frame = (0, remotion_1.useCurrentFrame)();
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
    const mediaPath = scene.mediaPath;
    const isVideo = mediaPath ? /\.(mp4|mkv|webm|mov|avi)$/i.test(mediaPath) : false;
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
                    transform: `scale(${scale})`,
                    transformOrigin: 'center center',
                }, children: isVideo ? ((0, jsx_runtime_1.jsx)(remotion_1.Video, { src: (0, remotion_1.staticFile)(mediaPath), style: { width: '100%', height: '100%', objectFit: 'cover' }, muted: true })) : ((0, jsx_runtime_1.jsx)(remotion_1.Img, { src: (0, remotion_1.staticFile)(mediaPath), style: { width: '100%', height: '100%', objectFit: 'cover' } })) })) : (
            /* Fallback si l'utilisateur n'a pas encore déposé de média */
            (0, jsx_runtime_1.jsxs)("div", { style: {
                    textAlign: 'center',
                    color: '#888',
                    fontSize: '2.5rem',
                    fontFamily: 'system-ui, sans-serif',
                    padding: 40,
                }, children: ["[ D\u00E9pose scene_", scene.id, ".png ou scene_", scene.id, ".mp4 dans le dossier public ]", (0, jsx_runtime_1.jsxs)("div", { style: { fontSize: '1.2rem', marginTop: 20, opacity: 0.7 }, children: ["Prompt sugg\u00E9r\u00E9 : ", scene.narration] })] })), (0, jsx_runtime_1.jsx)(remotion_1.Audio, { src: (0, remotion_1.staticFile)(`scene_${scene.id}.mp3`) }), (0, jsx_runtime_1.jsx)(Subtitles_1.Subtitles, { text: scene.subtitle ?? scene.narration, words: scene.words, durationInFrames: durationInFrames })] }));
};
exports.SceneComponent = SceneComponent;
