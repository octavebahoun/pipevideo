import * as fs from 'fs/promises';
import * as path from 'path';
import { Storyboard } from './types';
import { archiveCurrentProject } from './archive';

const STORYBOARD_PATH = path.join(process.cwd(), 'storyboard.json');

async function main() {
  const subject = process.argv[2];

  if (!subject) {
    console.error('❌ Erreur : Veuillez fournir un sujet pour la vidéo.');
    console.error('Exemple : npm run new-video "L\'histoire du Bitcoin"');
    process.exit(1);
  }

  // Archiver l'ancien projet s'il existe
  await archiveCurrentProject();

  const initialStoryboard: Storyboard = {
    title: subject,
    ratio: '9:16',
    voice: 'remy',
    subtitleStyle: 'fondant',
    scenes: [
      {
        id: 1,
        narration: `[L'agent doit remplacer ce texte par l'introduction de la vidéo sur : ${subject}]`,
        effects: {
          zoom: 'in',
          transition: 'fade'
        },
        mediaPath: 'scene_1.mp4'
      }
    ]
  };

  try {
    await fs.writeFile(STORYBOARD_PATH, JSON.stringify(initialStoryboard, null, 2), 'utf-8');
    console.log(`\n🎉 Nouveau projet vidéo initialisé avec succès !`);
    console.log(`- Sujet : "${subject}"`);
    console.log(`- Fichier créé : ${STORYBOARD_PATH}\n`);

    console.log(`🤖 CONSIGNE STRICTEMENT OBLIGATOIRE POUR L'AGENT IA :`);
    console.log(`--------------------------------------------------------------------------------`);
    console.log(`⚠️ ATTENTION AGENT : Tu DOIS consulter et appliquer STRICTEMENT le skill`);
    console.log(`   "content-factory-nature" (fichier .agents/skills/content-factory-nature/SKILL.md)`);
    console.log(`   ainsi que les best-practices Remotion. Tu ne dois JAMAIS ignorer ces règles.`);
    console.log(`   Génère le script dans storyboard.json avec des voix Edge-TTS (ex: "remy", "henri")`);
    console.log(`   et lance "npm run tts".`);
    console.log(`--------------------------------------------------------------------------------\n`);

  } catch (error: any) {
    console.error('❌ Impossible d\'initialiser le projet vidéo :', error.message);
    process.exit(1);
  }
}

main();
