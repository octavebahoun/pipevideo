"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.particleDissolve = exports.glitchCut = exports.whipPan = exports.zoomPunch = exports.fadeThroughBlack = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const remotion_1 = require("remotion");
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
const ZoomPunch = ({ children, presentationProgress, presentationDirection }) => {
    const scale = presentationDirection === 'exiting'
        ? (0, remotion_1.interpolate)(presentationProgress, [0, 1], [1, 1.5], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
        })
        : (0, remotion_1.interpolate)(presentationProgress, [0, 1], [1.5, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
        });
    return ((0, jsx_runtime_1.jsx)(remotion_1.AbsoluteFill, { children: (0, jsx_runtime_1.jsx)(remotion_1.AbsoluteFill, { style: {
                transform: `scale(${scale})`,
            }, children: children }) }));
};
const zoomPunch = () => {
    return { component: ZoomPunch, props: {} };
};
exports.zoomPunch = zoomPunch;
const WhipPan = ({ children, presentationProgress, presentationDirection }) => {
    const exiting = presentationDirection === 'exiting';
    const translateX = exiting
        ? (0, remotion_1.interpolate)(presentationProgress, [0, 1], [0, -100], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
        })
        : (0, remotion_1.interpolate)(presentationProgress, [0, 1], [100, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
        });
    const speed = Math.sin(presentationProgress * Math.PI);
    const blur = speed * 5;
    return ((0, jsx_runtime_1.jsx)(remotion_1.AbsoluteFill, { children: (0, jsx_runtime_1.jsx)(remotion_1.AbsoluteFill, { style: {
                transform: `translateX(${translateX}%)`,
                filter: `blur(${blur}px)`,
            }, children: children }) }));
};
const whipPan = () => {
    return { component: WhipPan, props: {} };
};
exports.whipPan = whipPan;
const GlitchCut = ({ children, presentationProgress, presentationDirection }) => {
    const exiting = presentationDirection === 'exiting';
    if (exiting) {
        const glitchIntensity = Math.max(0, (presentationProgress - 0.35) / 0.65);
        if (glitchIntensity < 0.01) {
            return ((0, jsx_runtime_1.jsx)(remotion_1.AbsoluteFill, { style: { backgroundColor: 'black' }, children: (0, jsx_runtime_1.jsx)(remotion_1.AbsoluteFill, { children: children }) }));
        }
        const seed = presentationProgress;
        const rOffset = Math.sin(seed * 17.3) * 10 * glitchIntensity;
        const bOffset = Math.sin(seed * 23.7) * 10 * glitchIntensity;
        const bandTop = (Math.sin(seed * 31.7) * 0.5 + 0.5) * 60 + 10;
        const bandHeight = 16;
        const bandShift = Math.sin(seed * 41.2) * 20 * glitchIntensity;
        const band2Top = (Math.sin(seed * 53.9) * 0.5 + 0.5) * 60 + 10;
        const band2Shift = Math.sin(seed * 67.3) * 15 * glitchIntensity;
        return ((0, jsx_runtime_1.jsxs)(remotion_1.AbsoluteFill, { style: { backgroundColor: 'black' }, children: [(0, jsx_runtime_1.jsx)(remotion_1.AbsoluteFill, { children: children }), (0, jsx_runtime_1.jsx)(remotion_1.AbsoluteFill, { style: {
                        transform: `translateX(${rOffset}px)`,
                        filter: 'sepia(1) saturate(100) hue-rotate(-50deg)',
                        mixBlendMode: 'screen',
                        opacity: glitchIntensity * 0.8,
                    }, children: children }), (0, jsx_runtime_1.jsx)(remotion_1.AbsoluteFill, { style: {
                        transform: `translateX(${bOffset}px)`,
                        filter: 'sepia(1) saturate(100) hue-rotate(120deg)',
                        mixBlendMode: 'screen',
                        opacity: glitchIntensity * 0.8,
                    }, children: children }), (0, jsx_runtime_1.jsx)(remotion_1.AbsoluteFill, { style: {
                        clipPath: `inset(${bandTop}% 0% ${100 - bandTop - bandHeight}% 0%)`,
                        transform: `translateX(${bandShift}px)`,
                    }, children: children }), (0, jsx_runtime_1.jsx)(remotion_1.AbsoluteFill, { style: {
                        clipPath: `inset(${band2Top}% 0% ${100 - band2Top - bandHeight}% 0%)`,
                        transform: `translateX(${band2Shift}px)`,
                        filter: 'brightness(1.3) contrast(1.5)',
                    }, children: children })] }));
    }
    const flash = (0, remotion_1.interpolate)(presentationProgress, [0, 0.35], [1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    return ((0, jsx_runtime_1.jsx)(remotion_1.AbsoluteFill, { style: { backgroundColor: 'white' }, children: (0, jsx_runtime_1.jsx)(remotion_1.AbsoluteFill, { style: { opacity: 1 - flash }, children: children }) }));
};
const glitchCut = () => {
    return { component: GlitchCut, props: {} };
};
exports.glitchCut = glitchCut;
// ---------------------------------------------------------------------------
// ParticleDissolve
// La scène sortante se dissout en un nuage de particules lumineuses qui
// scintillent et se dispersent, puis le nuage converge et se recompose en
// la scène entrante. Transition douce et « propre », idéale pour les cards /
// titres ou comme transition générale entre deux scènes.
// Durée : 40 frames.
// ---------------------------------------------------------------------------
const PARTICLE_COUNT = 100;
const PARTICLES = (() => {
    const colors = ['#ffffff', '#ffd700', '#87ceeb', '#ffb6c1', '#ffa500', '#90ee90'];
    const ps = [];
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
const ParticleDissolve = ({ children, presentationProgress, presentationDirection }) => {
    const exiting = presentationDirection === 'exiting';
    if (exiting) {
        const sceneOpacity = (0, remotion_1.interpolate)(presentationProgress, [0, 0.5], [1, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
        });
        const particleT = (0, remotion_1.interpolate)(presentationProgress, [0, 0.5], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
        });
        const particleOpacity = (0, remotion_1.interpolate)(presentationProgress, [0.12, 0.35, 0.5, 0.75], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        const twinkle = Math.sin(presentationProgress * Math.PI * 6) * 0.2 + 0.8;
        return ((0, jsx_runtime_1.jsxs)(remotion_1.AbsoluteFill, { style: { backgroundColor: 'black' }, children: [(0, jsx_runtime_1.jsx)(remotion_1.AbsoluteFill, { style: { opacity: sceneOpacity }, children: children }), PARTICLES.map((p, i) => {
                    const effectiveT = Math.max(0, Math.min(1, (particleT - p.delay) / (1 - p.delay)));
                    const x = effectiveT * p.ox;
                    const y = effectiveT * p.oy;
                    const s = (effectiveT * 0.6 + 0.4) * twinkle;
                    return ((0, jsx_runtime_1.jsx)("div", { style: {
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
                        } }, i));
                })] }));
    }
    // Entering
    const sceneOpacity = (0, remotion_1.interpolate)(presentationProgress, [0.4, 0.9], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const particleT = (0, remotion_1.interpolate)(presentationProgress, [0.35, 0.85], [1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const particleOpacity = (0, remotion_1.interpolate)(presentationProgress, [0.12, 0.35, 0.5, 0.8], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    const twinkle = Math.sin(presentationProgress * Math.PI * 6) * 0.2 + 0.8;
    return ((0, jsx_runtime_1.jsxs)(remotion_1.AbsoluteFill, { style: { backgroundColor: 'black' }, children: [PARTICLES.map((p, i) => {
                const effectiveT = Math.max(0, Math.min(1, (particleT - p.delay) / (1 - p.delay)));
                const x = effectiveT * p.ox;
                const y = effectiveT * p.oy;
                const s = (effectiveT * 0.6 + 0.4) * twinkle;
                return ((0, jsx_runtime_1.jsx)("div", { style: {
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
                    } }, i));
            }), (0, jsx_runtime_1.jsx)(remotion_1.AbsoluteFill, { style: { opacity: sceneOpacity }, children: children })] }));
};
const particleDissolve = () => {
    return { component: ParticleDissolve, props: {} };
};
exports.particleDissolve = particleDissolve;
