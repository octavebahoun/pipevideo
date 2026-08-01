"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KineticTitle = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const remotion_1 = require("remotion");
function parseText(text) {
    const segments = [];
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
function splitWords(segments) {
    const words = [];
    for (const seg of segments) {
        const split = seg.text.split(/\s+/).filter(Boolean);
        for (const w of split) {
            words.push({ text: w, highlighted: seg.highlighted });
        }
    }
    return words;
}
const pinSvg = (color) => ((0, jsx_runtime_1.jsxs)("svg", { width: "80", height: "96", viewBox: "0 0 24 32", fill: "none", children: [(0, jsx_runtime_1.jsx)("path", { d: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z", fill: color }), (0, jsx_runtime_1.jsx)("circle", { cx: "12", cy: "9", r: "3.2", fill: "#fff" })] }));
const RevealWords = ({ words, relativeFrame, staggerDelay, animationDuration, highlightColor, fontSize }) => {
    return ((0, jsx_runtime_1.jsx)(jsx_runtime_1.Fragment, { children: words.map((word, i) => {
            const wordStartFrame = i * staggerDelay;
            const localProgress = (relativeFrame - wordStartFrame) / animationDuration;
            const opacity = (0, remotion_1.interpolate)(localProgress, [0, 1], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
            });
            const translateY = (0, remotion_1.interpolate)(localProgress, [0, 1], [24, 0], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
            });
            const blur = (0, remotion_1.interpolate)(localProgress, [0, 1], [10, 0], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
            });
            const isHighlighted = word.highlighted;
            const highlightedScale = isHighlighted
                ? (0, remotion_1.interpolate)(localProgress, [0, 0.3, 1], [0.9, 1.12, 1.08], {
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                })
                : 1;
            return ((0, jsx_runtime_1.jsx)("span", { style: {
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
                }, children: word.text }, i));
        }) }));
};
const NeonGlow = ({ words, relativeFrame, staggerDelay, animationDuration, highlightColor, fontSize }) => {
    return ((0, jsx_runtime_1.jsx)(jsx_runtime_1.Fragment, { children: words.map((word, i) => {
            const wordStartFrame = i * staggerDelay;
            const localProgress = (relativeFrame - wordStartFrame) / animationDuration;
            const opacity = (0, remotion_1.interpolate)(localProgress, [0, 1], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
            });
            const isHighlighted = word.highlighted;
            const color = isHighlighted ? highlightColor : '#fff';
            const glowSize = isHighlighted ? 30 : 15;
            const glowSpread = isHighlighted ? 60 : 30;
            return ((0, jsx_runtime_1.jsx)("span", { style: {
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
                }, children: word.text }, i));
        }) }));
};
const IconLabel = ({ label, iconPath, frame, startFrame, highlightColor, fontSize, text }) => {
    const { fps } = (0, remotion_1.useVideoConfig)();
    const relativeFrame = frame - startFrame;
    const iconOpacity = (0, remotion_1.interpolate)(relativeFrame, [0, 15], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const iconScale = (0, remotion_1.interpolate)(relativeFrame, [0, 15], [0.5, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const labelWords = splitWords(parseText(label));
    return ((0, jsx_runtime_1.jsxs)("div", { style: {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
        }, children: [iconPath ? ((0, jsx_runtime_1.jsx)("div", { style: {
                    opacity: iconOpacity,
                    transform: `scale(${iconScale})`,
                    width: 80,
                    height: 80,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }, children: (0, jsx_runtime_1.jsx)(remotion_1.Img, { src: (0, remotion_1.staticFile)(iconPath), style: { width: '100%', height: '100%', objectFit: 'contain' } }) })) : ((0, jsx_runtime_1.jsx)("div", { style: {
                    opacity: iconOpacity,
                    transform: `scale(${iconScale})`,
                    width: 64,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: highlightColor,
                } })), (0, jsx_runtime_1.jsx)("div", { style: { width: '100%', textAlign: 'center', lineHeight: 1.3 }, children: labelWords.map((word, i) => {
                    const wordStartFrame = 15 + i * 4;
                    const localProgress = (relativeFrame - wordStartFrame) / 50;
                    const opacity = (0, remotion_1.interpolate)(localProgress, [0, 1], [0, 1], {
                        extrapolateLeft: 'clamp',
                        extrapolateRight: 'clamp',
                    });
                    const translateY = (0, remotion_1.interpolate)(localProgress, [0, 1], [20, 0], {
                        extrapolateLeft: 'clamp',
                        extrapolateRight: 'clamp',
                    });
                    const blur = (0, remotion_1.interpolate)(localProgress, [0, 1], [8, 0], {
                        extrapolateLeft: 'clamp',
                        extrapolateRight: 'clamp',
                    });
                    const isHighlighted = word.highlighted;
                    return ((0, jsx_runtime_1.jsx)("span", { style: {
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
                        }, children: word.text }, i));
                }) })] }));
};
const PinDrop = ({ words, frame, startFrame, fps, highlightColor, fontSize }) => {
    const relativeFrame = frame - startFrame;
    const dropSpringVal = (0, remotion_1.spring)({
        frame: relativeFrame,
        fps,
        config: { damping: 12, stiffness: 170, mass: 0.5 },
    });
    const pinY = (0, remotion_1.interpolate)(dropSpringVal, [0, 1], [-120, 0]);
    const pinOpacity = (0, remotion_1.interpolate)(relativeFrame, [0, 8], [1, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const landingFrame = 28;
    const revealWords = relativeFrame - landingFrame;
    return ((0, jsx_runtime_1.jsxs)("div", { style: {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
        }, children: [(0, jsx_runtime_1.jsx)("div", { style: {
                    opacity: pinOpacity,
                    transform: `translateY(${pinY}px)`,
                    filter: `drop-shadow(0 4px 12px ${highlightColor}60)`,
                }, children: pinSvg(highlightColor) }), (0, jsx_runtime_1.jsx)("div", { style: { width: '100%', textAlign: 'center', lineHeight: 1.3 }, children: words.map((word, i) => {
                    const wordStartFrame = landingFrame + i * 4;
                    const localProgress = (revealWords - i * 4) / 50;
                    const opacity = (0, remotion_1.interpolate)(localProgress, [0, 1], [0, 1], {
                        extrapolateLeft: 'clamp',
                        extrapolateRight: 'clamp',
                    });
                    const translateY = (0, remotion_1.interpolate)(localProgress, [0, 1], [16, 0], {
                        extrapolateLeft: 'clamp',
                        extrapolateRight: 'clamp',
                    });
                    const blur = (0, remotion_1.interpolate)(localProgress, [0, 1], [8, 0], {
                        extrapolateLeft: 'clamp',
                        extrapolateRight: 'clamp',
                    });
                    const isHighlighted = word.highlighted;
                    return ((0, jsx_runtime_1.jsx)("span", { style: {
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
                        }, children: word.text }, i));
                }) })] }));
};
const KineticTitle = ({ text, startInSeconds = 0, animationDuration = 60, staggerDelay = 4, highlightColor = '#ffd700', fontSize = '4.5rem', position = 'bottom', variant = 'reveal', icon, iconLabel, glowColor, }) => {
    const frame = (0, remotion_1.useCurrentFrame)();
    const { fps } = (0, remotion_1.useVideoConfig)();
    const startFrame = startInSeconds * fps;
    const relativeFrame = frame - startFrame;
    const segments = parseText(text);
    const words = splitWords(segments);
    if (words.length === 0)
        return null;
    const effectiveGlowColor = glowColor ?? highlightColor;
    const bottomStyle = { bottom: '14%' };
    const centerStyle = {
        top: 0,
        bottom: 0,
        justifyContent: 'center',
    };
    return ((0, jsx_runtime_1.jsx)("div", { style: {
            position: 'absolute',
            left: '8%',
            right: '8%',
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            pointerEvents: 'none',
            ...(position === 'center' ? centerStyle : bottomStyle),
        }, children: (0, jsx_runtime_1.jsx)("div", { style: {
                textAlign: 'center',
                width: '100%',
                lineHeight: 1.3,
            }, children: variant === 'neon' ? ((0, jsx_runtime_1.jsx)(NeonGlow, { words: words, relativeFrame: relativeFrame, staggerDelay: staggerDelay, animationDuration: animationDuration, highlightColor: effectiveGlowColor, fontSize: fontSize })) : variant === 'icon' ? ((0, jsx_runtime_1.jsx)(IconLabel, { label: iconLabel ?? text, iconPath: icon, frame: frame, startFrame: startFrame, highlightColor: highlightColor, fontSize: fontSize, text: text })) : variant === 'pin' ? ((0, jsx_runtime_1.jsx)(PinDrop, { words: words, frame: frame, startFrame: startFrame, fps: fps, highlightColor: highlightColor, fontSize: fontSize })) : ((0, jsx_runtime_1.jsx)(RevealWords, { words: words, relativeFrame: relativeFrame, staggerDelay: staggerDelay, animationDuration: animationDuration, highlightColor: highlightColor, fontSize: fontSize })) }) }));
};
exports.KineticTitle = KineticTitle;
