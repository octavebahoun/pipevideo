import 'dotenv/config';
import { ElevenLabsClient } from 'elevenlabs';
import { EdgeTTS } from 'edge-tts-universal';
import { parseFile } from 'music-metadata';
import * as fs from 'fs/promises';
import * as path from 'path';
import { loadStoryboard } from './storyboard';
import { WordTiming } from './types';

const STORYBOARD_PATH = path.join(process.cwd(), 'storyboard.json');
const MEDIA_DIR = path.join(process.cwd(), 'public');

/**
 * Choix du moteur TTS, centralisé dans .env (TTS_PROVIDER) :
 *  - "edge"       (défaut) : gratuit (Edge-TTS Microsoft), qualité correcte, karaoké au mot.
 *  - "elevenlabs"          : payant, voix les plus naturelles, toujours disponible via .env si besoin.
 * Le champ storyboard.voice reste le même levier dans les deux cas, mais son
 * vocabulaire diffère selon le moteur (voir VOICE_MAP / EDGE_VOICE_MAP ci-dessous).
 */
// Normalisation tolérante : accepte "edge", "edge-tts", "edgetts", "Edge-TTS", "EDGE_TTS"...
const rawProvider = process.env.TTS_PROVIDER || 'edge';
const normalizedProvider = rawProvider.toLowerCase().replace(/[^a-z]/g, '');
const isEdgeProvider = normalizedProvider === '' || normalizedProvider === 'edge' || normalizedProvider === 'edgetts';
const isElevenLabsProvider = normalizedProvider === 'elevenlabs' || normalizedProvider === 'eleven';
if (!isElevenLabsProvider && !isEdgeProvider) {
  console.log(`⚠️  TTS_PROVIDER inconnu ("${rawProvider}"). Utilisation d'Edge-TTS par défaut.`);
}
const useEdge = !isElevenLabsProvider;

const DEFAULT_API_KEY = '';
const apiKey = process.env.ELEVENLABS_API_KEY || DEFAULT_API_KEY;
const client = new ElevenLabsClient({ apiKey });

const VOICE_MAP: Record<string, string> = {
  george: 'JBFqnCBsd6RMkjVDRZzb',
  liam: 'EmZGlxI7QPvCEMOkFhB9',
  antoni: 'ErXwobaYiN019PkySvjV',
  anais: '5OnMHwgTFgvPVwE8jP6B',
  rachel: 'or4EV8aZq78KWcXw48wd',
};

function resolveVoiceId(voiceInput?: string): string {
  if (!voiceInput) return VOICE_MAP.george;
  const normalized = voiceInput.toLowerCase().trim();
  if (VOICE_MAP[normalized]) {
    return VOICE_MAP[normalized];
  }
  // Check if voiceInput looks like an ElevenLabs Voice ID (typically 20 chars alphanumeric)
  if (/^[a-zA-Z0-9]{15,25}$/.test(voiceInput)) {
    return voiceInput;
  }
  console.log(`⚠️  Voix inconnue ou ancienne voix Edge-TTS ("${voiceInput}"). Utilisation de la voix George par défaut.`);
  return VOICE_MAP.george;
}

/** Voix Edge-TTS (Microsoft) françaises courantes, référencées par un nom court. */
const EDGE_VOICE_MAP: Record<string, string> = {
  henri: 'fr-FR-HenriNeural',
  denise: 'fr-FR-DeniseNeural',
  eloise: 'fr-FR-EloiseNeural',
  vivienne: 'fr-FR-VivienneMultilingualNeural',
  remy: 'fr-FR-RemyMultilingualNeural',
};

function resolveEdgeVoice(voiceInput?: string): string {
  if (!voiceInput) return EDGE_VOICE_MAP.henri;
  const normalized = voiceInput.toLowerCase().trim();
  if (EDGE_VOICE_MAP[normalized]) {
    return EDGE_VOICE_MAP[normalized];
  }
  // Nom de voix Edge déjà complet (ex: "fr-FR-HenriNeural", "en-US-GuyNeural")
  if (/^[a-z]{2}-[A-Z]{2}-[A-Za-z]+Neural$/.test(voiceInput)) {
    return voiceInput;
  }
  console.log(`⚠️  Voix inconnue pour Edge-TTS ("${voiceInput}"). Utilisation de la voix Henri par défaut.`);
  return EDGE_VOICE_MAP.henri;
}

interface ElevenLabsAlignment {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

function parseElevenLabsAlignment(alignment?: ElevenLabsAlignment) {
  const words: { text: string; start: number; duration: number }[] = [];
  if (!alignment || !alignment.characters || alignment.characters.length === 0) {
    return words;
  }

  const { characters, character_start_times_seconds, character_end_times_seconds } = alignment;

  let currentWordChars: string[] = [];
  let wordStartTime: number | null = null;
  let wordEndTime = 0;

  for (let i = 0; i < characters.length; i++) {
    const char = characters[i];
    const start = character_start_times_seconds[i];
    const end = character_end_times_seconds[i];

    if (/\s/.test(char)) {
      if (currentWordChars.length > 0 && wordStartTime !== null) {
        const wordText = currentWordChars.join('');
        words.push({
          text: wordText,
          start: Number(wordStartTime.toFixed(3)),
          duration: Number(Math.max(0, wordEndTime - wordStartTime).toFixed(3)),
        });
        currentWordChars = [];
        wordStartTime = null;
      }
    } else {
      if (wordStartTime === null) {
        wordStartTime = start;
      }
      currentWordChars.push(char);
      wordEndTime = end;
    }
  }

  if (currentWordChars.length > 0 && wordStartTime !== null) {
    const wordText = currentWordChars.join('');
    words.push({
      text: wordText,
      start: Number(wordStartTime.toFixed(3)),
      duration: Number(Math.max(0, wordEndTime - wordStartTime).toFixed(3)),
    });
  }

  return words;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  try {
    // 1. Lire et valider le storyboard.json
    console.log(`Lecture du storyboard depuis : ${STORYBOARD_PATH}`);
    const storyboard = await loadStoryboard(STORYBOARD_PATH);

    // 2. Créer le dossier media s'il n'existe pas
    await fs.mkdir(MEDIA_DIR, { recursive: true });

    const voiceId = useEdge ? undefined : resolveVoiceId(storyboard.voice);
    const edgeVoice = useEdge ? resolveEdgeVoice(storyboard.voice) : undefined;
    console.log(
      useEdge
        ? `Moteur TTS : Edge-TTS (gratuit) | Voix : ${edgeVoice}`
        : `Moteur TTS : ElevenLabs Multilingual v2 | Voice ID : ${voiceId}`
    );

    // 3. Parcourir et générer la voix-off pour chaque scène
    for (const scene of storyboard.scenes) {
      console.log(`\nTraitement de la scène ${scene.id}...`);

      // --- Cas 0 : carte texte (fin) → pas de voix, on garde sa durée manuelle. ---
      if (scene.card) {
        console.log('Carte texte (pas de voix off).');
        scene.words = undefined;
        if (scene.durationInSeconds === undefined) scene.durationInSeconds = 5;
        continue;
      }

      // --- Cas 1 : voix off FOURNIE par l'utilisateur → on ne régénère pas. ---
      const providedRelPath =
        scene.audioPath ?? (storyboard.useProvidedAudio ? `scene_${scene.id}.mp3` : undefined);

      if (providedRelPath) {
        const providedPath = path.join(MEDIA_DIR, providedRelPath);
        if (!(await fileExists(providedPath))) {
          throw new Error(
            `Voix off fournie manquante pour la scène ${scene.id} : ${providedPath}\n` +
            `→ Dépose le fichier dans public/, ou retire "audioPath"/"useProvidedAudio" pour repasser en ElevenLabs.`
          );
        }
        console.log(`Voix off fournie par l'utilisateur : ${providedRelPath} (ElevenLabs ignoré)`);

        scene.words = undefined;

        const metadata = await parseFile(providedPath);
        const duration = metadata.format.duration;
        if (duration === undefined) {
          throw new Error(`Impossible de lire la durée du fichier audio : ${providedPath}`);
        }
        console.log(`Durée mesurée : ${duration.toFixed(2)} secondes`);
        scene.durationInSeconds = duration;
        continue;
      }

      // --- Cas 2 : génération TTS (ElevenLabs ou Edge-TTS selon TTS_PROVIDER) avec timestamps mot-à-mot ---
      console.log(`Texte : "${scene.narration}"`);

      const audioFileName = `scene_${scene.id}.mp3`;
      const audioFilePath = path.join(MEDIA_DIR, audioFileName);

      // Si le fichier audio existe déjà et est valide, on réutilise (économise les crédits ElevenLabs ; Edge-TTS est gratuit de toute façon)
      if (await fileExists(audioFilePath)) {
        try {
          const metadata = await parseFile(audioFilePath);
          const duration = metadata.format.duration;
          if (duration !== undefined) {
            console.log(`⚡ Audio déjà existant dans public/${audioFileName} — Réutilisation (0 régénération)`);
            console.log(`Durée mesurée : ${duration.toFixed(2)} secondes`);
            scene.durationInSeconds = duration;
            await fs.writeFile(STORYBOARD_PATH, JSON.stringify(storyboard, null, 2), 'utf-8');
            continue;
          }
        } catch {
          console.log(`⚠️  Fichier ${audioFileName} corrompu, régénération...`);
        }
      }

      let audioBuffer: Buffer;
      let words: WordTiming[];

      if (useEdge) {
        const tts = new EdgeTTS(scene.narration, edgeVoice!);
        const result = await tts.synthesize();
        audioBuffer = Buffer.from(await result.audio.arrayBuffer());
        // offset/duration en unités de 100 ns (ticks Windows) → conversion en secondes.
        words =
          Array.isArray(result.subtitle) && result.subtitle.length > 0
            ? result.subtitle.map((wb: any) => ({
                text: wb.text,
                start: wb.offset / 10_000_000,
                duration: wb.duration / 10_000_000,
              }))
            : [];
      } else {
        const response = await client.textToSpeech.convertWithTimestamps(voiceId!, {
          text: scene.narration,
          model_id: 'eleven_multilingual_v2',
          output_format: 'mp3_44100_128',
        });
        audioBuffer = Buffer.from(response.audio_base64, 'base64');
        words = parseElevenLabsAlignment(response.alignment as ElevenLabsAlignment);
      }

      await fs.writeFile(audioFilePath, audioBuffer);
      console.log(`Audio généré et sauvegardé dans : ${audioFilePath}`);

      // Capturer les timings mot-à-mot pour le karaoké Remotion
      if (words.length > 0) {
        scene.words = words;
        console.log(`Timings karaoké : ${scene.words.length} mots capturés avec succès`);
      } else {
        scene.words = undefined;
      }

      // Mesurer la durée exacte du fichier audio
      const metadata = await parseFile(audioFilePath);
      const duration = metadata.format.duration;

      if (duration === undefined) {
        throw new Error(`Impossible de lire la durée du fichier audio : ${audioFilePath}`);
      }

      console.log(`Durée calculée : ${duration.toFixed(2)} secondes`);
      scene.durationInSeconds = duration;

      // Sauvegarde progressive après chaque scène
      await fs.writeFile(STORYBOARD_PATH, JSON.stringify(storyboard, null, 2), 'utf-8');
    }

    // 4. Sauvegarder le storyboard final
    await fs.writeFile(STORYBOARD_PATH, JSON.stringify(storyboard, null, 2), 'utf-8');
    console.log(`\n✅ Storyboard synchronisé avec succès (${useEdge ? 'Edge-TTS' : 'ElevenLabs'}) !`);

  } catch (error: any) {
    console.error('❌ Une erreur est survenue lors de la génération TTS :', error.message);
    process.exit(1);
  }
}

main();
