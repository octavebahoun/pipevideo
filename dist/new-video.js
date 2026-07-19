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
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const archive_1 = require("./archive");
const STORYBOARD_PATH = path.join(process.cwd(), 'storyboard.json');
async function main() {
    const subject = process.argv[2];
    if (!subject) {
        console.error('❌ Erreur : Veuillez fournir un sujet pour la vidéo.');
        console.error('Exemple : npm run new-video "L\'histoire du Bitcoin"');
        process.exit(1);
    }
    // Archiver l'ancien projet s'il existe
    await (0, archive_1.archiveCurrentProject)();
    const initialStoryboard = {
        title: subject,
        ratio: '16:9',
        voice: 'fr-FR-HenriNeural',
        scenes: [
            {
                id: 1,
                narration: `[L'agent doit remplacer ce texte par l'introduction de la vidéo sur : ${subject}]`,
                effects: {
                    zoom: 'in',
                    transition: 'fade'
                },
                mediaPath: 'scene_1.png'
            }
        ]
    };
    try {
        await fs.writeFile(STORYBOARD_PATH, JSON.stringify(initialStoryboard, null, 2), 'utf-8');
        console.log(`\n🎉 Nouveau projet vidéo initialisé avec succès !`);
        console.log(`- Sujet : "${subject}"`);
        console.log(`- Fichier créé : ${STORYBOARD_PATH}\n`);
        console.log(`🤖 CONSIGNE POUR L'AGENT IA :`);
        console.log(`--------------------------------------------------------------------------------`);
        console.log(`Un nouveau projet vidéo sur "${subject}" a été initialisé.`);
        console.log(`Agent, lis le fichier storyboard.json et utilise le skill "content-factory"`);
        console.log(`pour générer toutes les scènes (narration, effets, mediaPath) pour ce sujet.`);
        console.log(`--------------------------------------------------------------------------------\n`);
    }
    catch (error) {
        console.error('❌ Impossible d\'initialiser le projet vidéo :', error.message);
        process.exit(1);
    }
}
main();
