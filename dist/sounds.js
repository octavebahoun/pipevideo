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
/**
 * Génère le catalogue de la bibliothèque de sons.
 *
 * Parcourt public/sounds/ à la recherche de fichiers `.md` (un par son, portant
 * le MÊME nom que le fichier audio décrit), lit leur front-matter, puis écrit un
 * récap lisible dans public/sounds/CATALOG.md. Ce catalogue sert à l'agent IA
 * pour choisir rapidement quel bruitage/ambiance/musique associer à une scène.
 *
 *   npm run sounds
 */
const SOUNDS_DIR = path.join(process.cwd(), 'public', 'sounds');
const CATALOG_PATH = path.join(SOUNDS_DIR, 'CATALOG.md');
const IGNORED_MD = new Set(['README.md', '_TEMPLATE.md', 'CATALOG.md']);
async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...(await walk(full)));
        }
        else if (entry.name.endsWith('.md') && !IGNORED_MD.has(entry.name)) {
            files.push(full);
        }
    }
    return files;
}
/** Parse un front-matter YAML plat (clé: valeur). Pas de dépendance externe. */
function parseFrontmatter(content) {
    const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
    const fm = {};
    if (!match)
        return fm;
    for (const line of match[1].split('\n')) {
        const idx = line.indexOf(':');
        if (idx === -1)
            continue;
        const key = line.slice(0, idx).trim();
        let value = line.slice(idx + 1).trim();
        // Nettoyage léger : crochets de liste et guillemets.
        value = value.replace(/^\[|\]$/g, '').replace(/^["']|["']$/g, '');
        if (key)
            fm[key] = value;
    }
    return fm;
}
function cell(value) {
    return (value ?? '').replace(/\|/g, '\\|');
}
async function main() {
    let mdFiles;
    try {
        mdFiles = await walk(SOUNDS_DIR);
    }
    catch {
        console.error(`❌ Dossier introuvable : ${SOUNDS_DIR}`);
        console.error('   Crée-le et ajoute des sons (voir public/sounds/README.md).');
        process.exit(1);
    }
    const descriptors = [];
    for (const file of mdFiles) {
        const content = await fs.readFile(file, 'utf-8');
        const frontmatter = parseFrontmatter(content);
        const relPath = path.relative(SOUNDS_DIR, file);
        const dir = path.dirname(relPath);
        const audioFile = frontmatter.file || `${path.basename(relPath, '.md')}.mp3`;
        const src = `sounds/${dir === '.' ? '' : dir + '/'}${audioFile}`;
        descriptors.push({ relPath, src, frontmatter });
    }
    descriptors.sort((a, b) => a.relPath.localeCompare(b.relPath));
    const rows = descriptors.map((d) => {
        const fm = d.frontmatter;
        const name = fm.name || path.basename(d.relPath, '.md');
        const keyVal = fm.key === 'null' || !fm.key ? '-' : fm.key;
        const bpmVal = fm.bpm === 'null' || !fm.bpm ? '-' : fm.bpm;
        let peaksVal = '-';
        if (fm.peaks && fm.peaks.trim() !== '') {
            const parts = fm.peaks.split(',').map(p => p.trim()).filter(Boolean);
            if (parts.length > 0) {
                peaksVal = `\`[${parts.join(', ')}]\``;
            }
        }
        return `| \`${cell(name)}\` | ${cell(fm.type)} | ${cell(fm.mood)} | ${cell(fm.loopable)} | ${cell(fm.duration)} | ${cell(keyVal)} | ${cell(bpmVal)} | ${cell(peaksVal)} | ${cell(fm.usage)} | \`${cell(d.src)}\` |`;
    });
    const catalog = [
        '# 🎧 Catalogue des sons — GÉNÉRÉ AUTOMATIQUEMENT',
        '',
        '> Ne pas éditer à la main. Régénère avec `npm run sounds` après chaque ajout/retrait de son.',
        `> ${descriptors.length} son(s) référencé(s).`,
        '',
        'Pour utiliser un son : copie sa colonne `src` dans un objet du tableau `sounds` d\'une scène du storyboard.',
        '',
        '| Nom | Type | Ambiance | Bouclable | Durée | Tonalité | BPM | Pics d\'impact (s) | Usage | `src` |',
        '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
        ...rows,
        '',
    ].join('\n');
    await fs.writeFile(CATALOG_PATH, catalog, 'utf-8');
    console.log(`✅ Catalogue régénéré : ${CATALOG_PATH} (${descriptors.length} son(s))`);
    if (descriptors.length === 0) {
        console.log("ℹ️ Aucun son pour l'instant. Ajoute un fichier audio + son .md (voir public/sounds/_TEMPLATE.md).");
    }
}
main();
