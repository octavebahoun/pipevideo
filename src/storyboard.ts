import * as fs from 'fs/promises';
import { storyboardSchema, Storyboard } from './types';

/**
 * Lit et VALIDE storyboard.json contre le schéma Zod.
 * Lève une erreur lisible si le fichier est absent, mal formé ou non conforme,
 * plutôt que de planter en plein milieu de la génération (TTS/rendu).
 */
export async function loadStoryboard(storyboardPath: string): Promise<Storyboard> {
  let rawData: string;
  try {
    rawData = await fs.readFile(storyboardPath, 'utf-8');
  } catch {
    throw new Error(`storyboard.json introuvable : ${storyboardPath}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawData);
  } catch {
    throw new Error(`storyboard.json contient du JSON invalide : ${storyboardPath}`);
  }

  const result = storyboardSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(racine)'} : ${issue.message}`)
      .join('\n');
    throw new Error(`storyboard.json ne respecte pas le schéma attendu :\n${issues}`);
  }

  return result.data;
}
