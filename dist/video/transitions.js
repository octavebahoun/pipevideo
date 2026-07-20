"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fadeThroughBlack = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const remotion_1 = require("remotion");
/**
 * Transition cinématographique : la scène sortante s'assombrit jusqu'au NOIR
 * total (première moitié), puis la scène entrante émerge du noir (seconde
 * moitié). Donne l'effet « on ferme, on rouvre » demandé (fermeture de rideau
 * sombre / révélation), et masque proprement le point de boucle des clips.
 */
const FadeThroughBlack = ({ children, presentationProgress, presentationDirection }) => {
    const opacity = presentationDirection === 'exiting'
        ? (0, remotion_1.interpolate)(presentationProgress, [0, 0.5], [1, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
        })
        : (0, remotion_1.interpolate)(presentationProgress, [0.5, 1], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
        });
    return ((0, jsx_runtime_1.jsx)(remotion_1.AbsoluteFill, { style: { backgroundColor: 'black' }, children: (0, jsx_runtime_1.jsx)(remotion_1.AbsoluteFill, { style: { opacity }, children: children }) }));
};
const fadeThroughBlack = () => {
    return { component: FadeThroughBlack, props: {} };
};
exports.fadeThroughBlack = fadeThroughBlack;
