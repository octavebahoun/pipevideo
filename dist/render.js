"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const bundler_1 = require("@remotion/bundler");
const renderer_1 = require("@remotion/renderer");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const storyboard_1 = require("./storyboard");
const STORYBOARD_PATH = path.join(process.cwd(), 'storyboard.json');
const ENTRY_POINT = path.join(process.cwd(), 'src/video/index.tsx');
const OUTPUT_DIR = path.join(process.cwd(), 'out');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'video.mp4');
async function main() {
    try {
        // 1. Lire et valider le storyboard.json
        console.log(`Lecture du storyboard depuis : ${STORYBOARD_PATH}`);
        const storyboard = await (0, storyboard_1.loadStoryboard)(STORYBOARD_PATH);
        // S'assurer que le dossier out/ existe
        await fs.mkdir(OUTPUT_DIR, { recursive: true });
        // 2. Compiler le projet Remotion (Webpack bundling)
        console.log('Compilation du projet Remotion (Webpack bundling)...');
        const bundleLocation = await (0, bundler_1.bundle)({
            entryPoint: ENTRY_POINT,
        });
        console.log('Sélection de la composition...');
        const composition = await (0, renderer_1.selectComposition)({
            serveUrl: bundleLocation,
            id: 'ContentFactory',
            inputProps: {
                storyboard,
            },
            browserExecutable: '/usr/bin/google-chrome-stable',
        });
        console.log(`Lancement du rendu vidéo :`);
        console.log(`- Résolution : ${composition.width}x${composition.height}`);
        console.log(`- FPS : ${composition.fps}`);
        console.log(`- Durée : ${(composition.durationInFrames / composition.fps).toFixed(2)}s (${composition.durationInFrames} frames)`);
        // 3. Effectuer le rendu media
        await (0, renderer_1.renderMedia)({
            composition,
            serveUrl: bundleLocation,
            codec: 'h264',
            outputLocation: OUTPUT_FILE,
            inputProps: {
                storyboard,
            },
            browserExecutable: '/usr/bin/google-chrome-stable',
            onProgress: ({ progress, renderedFrames }) => {
                const percent = Math.floor(progress * 100);
                process.stdout.write(`\rRendu en cours : ${percent}% (${renderedFrames}/${composition.durationInFrames} images)`);
            },
        });
        console.log(`\n\n✅ Rendu terminé avec succès !`);
        console.log(`Vidéo finale disponible dans : ${OUTPUT_FILE}`);
    }
    catch (error) {
        console.error('\n❌ Une erreur est survenue lors du rendu vidéo :', error.message);
        process.exit(1);
    }
}
main();
