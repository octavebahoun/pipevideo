"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Main = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const remotion_1 = require("remotion");
const transitions_1 = require("@remotion/transitions");
const fade_1 = require("@remotion/transitions/fade");
const slide_1 = require("@remotion/transitions/slide");
const types_1 = require("../types");
const Scene_1 = require("./Scene");
/** Présentation de transition à jouer AVANT une scène, selon son effet. */
function presentationForScene(scene) {
    const transition = scene.effects?.transition ?? 'fade';
    if (transition === 'slide') {
        return (0, slide_1.slide)({ direction: 'from-right' });
    }
    return (0, fade_1.fade)();
}
const Main = ({ storyboard }) => {
    const { fps } = (0, remotion_1.useVideoConfig)();
    // Réglages de sous-titres globaux (surchargeables par scène via showSubtitles).
    const subtitlesEnabled = storyboard.subtitles ?? true;
    const subtitleStyle = storyboard.subtitleStyle ?? 'karaoke';
    // On construit une liste plate [Sequence, Transition, Sequence, ...] car
    // TransitionSeries attend ses enfants directement (pas dans des fragments).
    const children = [];
    storyboard.scenes.forEach((scene, index) => {
        const durationInFrames = (0, types_1.getSceneDurationInFrames)(scene, fps);
        if ((0, types_1.getTransitionFramesBefore)(scene, index) > 0) {
            children.push((0, jsx_runtime_1.jsx)(transitions_1.TransitionSeries.Transition, { presentation: presentationForScene(scene), timing: (0, transitions_1.linearTiming)({ durationInFrames: types_1.TRANSITION_FRAMES }) }, `transition-${scene.id}`));
        }
        children.push((0, jsx_runtime_1.jsx)(transitions_1.TransitionSeries.Sequence, { durationInFrames: durationInFrames, children: (0, jsx_runtime_1.jsx)(Scene_1.SceneComponent, { scene: scene, durationInFrames: durationInFrames, subtitlesEnabled: subtitlesEnabled, subtitleStyle: subtitleStyle }) }, `scene-${scene.id}`));
    });
    return ((0, jsx_runtime_1.jsxs)("div", { style: { flex: 1, backgroundColor: 'black', position: 'relative' }, children: [(0, jsx_runtime_1.jsx)(transitions_1.TransitionSeries, { children: children }), storyboard.music && ((0, jsx_runtime_1.jsx)(remotion_1.Audio, { src: (0, remotion_1.staticFile)(storyboard.music), volume: 0.18, loop: true }))] }));
};
exports.Main = Main;
