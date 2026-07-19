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
exports.loadStoryboard = loadStoryboard;
const fs = __importStar(require("fs/promises"));
const types_1 = require("./types");
/**
 * Lit et VALIDE storyboard.json contre le schéma Zod.
 * Lève une erreur lisible si le fichier est absent, mal formé ou non conforme,
 * plutôt que de planter en plein milieu de la génération (TTS/rendu).
 */
async function loadStoryboard(storyboardPath) {
    let rawData;
    try {
        rawData = await fs.readFile(storyboardPath, 'utf-8');
    }
    catch {
        throw new Error(`storyboard.json introuvable : ${storyboardPath}`);
    }
    let parsed;
    try {
        parsed = JSON.parse(rawData);
    }
    catch {
        throw new Error(`storyboard.json contient du JSON invalide : ${storyboardPath}`);
    }
    const result = types_1.storyboardSchema.safeParse(parsed);
    if (!result.success) {
        const issues = result.error.issues
            .map((issue) => `  - ${issue.path.join('.') || '(racine)'} : ${issue.message}`)
            .join('\n');
        throw new Error(`storyboard.json ne respecte pas le schéma attendu :\n${issues}`);
    }
    return result.data;
}
