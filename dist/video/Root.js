"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RemotionRoot = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const remotion_1 = require("remotion");
const Main_1 = require("./Main");
const types_1 = require("../types");
const storyboard_json_1 = __importDefault(require("../../storyboard.json"));
const RemotionRoot = () => {
    return ((0, jsx_runtime_1.jsx)(remotion_1.Composition, { id: "ContentFactory", component: Main_1.Main, schema: types_1.mainPropsSchema, fps: types_1.FPS, 
        // Valeurs de secours : recalculées par calculateMetadata à partir du storyboard réel.
        durationInFrames: types_1.FPS, width: 1920, height: 1080, defaultProps: { storyboard: storyboard_json_1.default }, calculateMetadata: ({ props }) => {
            const { storyboard } = props;
            const { width, height } = (0, types_1.getDimensions)(storyboard);
            return {
                durationInFrames: (0, types_1.getTotalDurationInFrames)(storyboard, types_1.FPS),
                width,
                height,
            };
        } }));
};
exports.RemotionRoot = RemotionRoot;
