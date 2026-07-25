# 📐 Résolutions techniques — Content Factory

Ce fichier consigne des décisions techniques prises sur le pipeline, pour éviter de refaire les mêmes erreurs ou de revenir dessus par erreur.

## 1. Pause d'1 seconde entre les scènes (transition incluse)

**Problème initial** : `TransitionSeries` fait chevaucher le début d'une scène avec la toute fin de la précédente (durée du chevauchement = durée de la transition, 15 à 26 frames). Comme la durée d'une scène collait pile à la longueur de sa voix off, la narration suivante démarrait **avant** que la précédente soit terminée → deux voix audibles en même temps.

**Résolution** : dans `src/types.ts`, `getSceneDurationInFrames` ajoute **30 frames (1s) de silence après la fin de la narration** de chaque scène (sauf les `card`, qui n'ont pas de voix) :

```ts
export const POST_NARRATION_PAUSE_FRAMES = 30; // 1s à 30fps

export function getSceneDurationInFrames(scene: Scene, fps: number = FPS): number {
  const narrationFrames = Math.ceil((scene.durationInSeconds ?? 2) * fps);
  const pauseFrames = scene.card ? 0 : Math.round((POST_NARRATION_PAUSE_FRAMES / FPS) * fps);
  return Math.max(MIN_SCENE_FRAMES, narrationFrames + pauseFrames);
}
```

**Règle à respecter si cette valeur est modifiée** : `POST_NARRATION_PAUSE_FRAMES` doit TOUJOURS rester **strictement supérieur** à la transition la plus longue (`transitionDurationFrames`, 26 frames pour `"black"`). Sinon le chevauchement de `TransitionSeries` mord de nouveau sur de l'audio actif et les voix se recroisent.

Avec 30 frames de pause, la transition est **entièrement comprise dans cette seconde**, jamais ajoutée en plus :

| Transition | Durée transition | Silence pur avant | Transition (scène N+1 déjà lancée) | Total |
| --- | --- | --- | --- | --- |
| fade / slide | 15 frames | 15 frames (0,5s) | 15 frames (0,5s) | 30 frames = **1s** |
| wipe | 20 frames | 10 frames (0,33s) | 20 frames (0,67s) | 30 frames = **1s** |
| black | 26 frames | 4 frames (0,13s) | 26 frames (0,87s) | 30 frames = **1s** |

➡️ Ne PAS ajouter un délai supplémentaire avant la voix off (ex: décaler le composant `<Audio>` dans un `<Sequence from={N}>`) en plus de cette pause : ça cumule deux mécanismes pour le même problème et rallonge le silence mort entre scènes au-delà d'1s (déjà tenté et retiré, voir historique git commits `2d814f8` → `57bd4f3`).

➡️ La durée de scène reste toujours pilotée par **l'audio réel mesuré** (`durationInSeconds`, écrit par `npm run tts` à partir du fichier `.mp3` sur le disque), jamais par une valeur arbitraire. Si un fichier audio est remplacé/régénéré manuellement, il FAUT relancer `npm run tts` pour resynchroniser `durationInSeconds` et les timings karaoké (`words`) — sinon le rendu se cale sur l'ancienne durée et coupe le nouvel audio.

## 2. Choix du moteur TTS (ElevenLabs / Edge-TTS), centralisé dans .env

Edge-TTS avait été entièrement retiré du pipeline (remplacé par ElevenLabs, voir historique git avant le commit `692d333`), mais la dépendance `edge-tts-universal` était restée dans `package.json`. Remis en place dans `src/tts.ts`, cette fois **sans dupliquer le script** : un seul `npm run tts`, le moteur est choisi via `.env` :

```bash
TTS_PROVIDER=elevenlabs   # défaut : payant, voix les plus naturelles
TTS_PROVIDER=edge         # gratuit : Edge-TTS (Microsoft)
```

- `storyboard.voice` reste le seul champ à éditer dans le storyboard pour choisir la voix, quel que soit le moteur — seul le vocabulaire des noms courts change (`george`/`liam`/... pour ElevenLabs, `henri`/`denise`/... pour Edge, voir `docs/VOICES.md`).
- Tout le reste de `tts.ts` (cas carte de fin, voix fournie par l'utilisateur, réutilisation d'un audio déjà généré) est **commun aux deux moteurs** : seule l'étape de synthèse elle-même (`useEdge ? ... : ...`) branche vers l'un ou l'autre.
- Basculer d'un moteur à l'autre ne nécessite AUCUN changement de code, uniquement `.env`.
- **Détection tolérante** : `TTS_PROVIDER` est normalisé (minuscules, tirets/underscores retirés) avant comparaison, donc `edge`, `edge-tts`, `edgetts`, `EDGE_TTS`... sont tous reconnus comme Edge-TTS. Bug vécu : une comparaison stricte sur `"edge"` uniquement rejetait `"edge-tts"` (pourtant le nom le plus naturel à taper) et retombait silencieusement sur ElevenLabs — toujours normaliser l'entrée utilisateur sur ce genre de switch `.env`, jamais une égalité stricte.

## 3. Style de sous-titres/karaoké, centralisé dans le storyboard

Champ `subtitleStyle` à la racine du storyboard (`src/types.ts`, rendu dans `src/video/Subtitles.tsx`), 3 valeurs possibles :
```json
{ "title": "...", "subtitleStyle": "fondant" }
```
- `"karaoke"` (défaut) : mots en MAJUSCULES, pop dur (scale + bascule instantanée blanc/or), contours noirs épais. Pour un sujet punchy/agressif.
- `"fondant"` : karaoké doux — chaque mot s'illumine **progressivement** (fondu autour de son instant de prononciation, pas de bascule instantanée), casse normale, contours légers. Pour un sujet qui doit paraître calme/attachant (ex: axolotl).
- `"cinematic"` : phrase sobre sans surlignage mot-à-mot, pour un essai/documentaire 16:9.

Un seul champ dans le storyboard suffit à changer l'ambiance visuelle des sous-titres d'une vidéo à l'autre, sans toucher au code.

## 4. Annuler les sons (SFX / ambiance / musique) sur une vidéo

Il y a deux couches de son distinctes dans le storyboard, à ne pas confondre :

### a) Musique de fond globale
Champs `music` / `musicVolume` à la racine du storyboard. Pour la retirer, supprimer ces deux clés :
```json
{
  "title": "...",
  "ratio": "9:16",
  "voice": "george"
  // pas de "music", pas de "musicVolume"
}
```

### b) Sons additionnels par scène (SFX / ambiance)
Tableau `sounds` dans une scène (`src/types.ts` → `sceneSoundSchema`). Pour les annuler sur une scène précise, retirer le champ `sounds` de cette scène (ou le laisser vide/absent). Rendu dans `src/video/Scene.tsx` via le composant `SceneSounds`, uniquement affiché si `scene.sounds` est non vide.

**Couper TOUS les SFX d'un coup sans toucher au code ni supprimer les `sounds` de chaque scène** : champ global `sfxVolume` à la racine du storyboard (même principe que `musicVolume`), multiplicateur appliqué à TOUS les `sounds` de TOUTES les scènes :
```json
{ "title": "...", "sfxVolume": 0 }
```
- `0` = tous les SFX/ambiances muets, mais restent définis dans le storyboard (faciles à réactiver).
- `1` (ou absent) = comportement normal, chaque son garde son propre `volume`.
- Toute autre valeur = multiplicateur (ex: `0.5` = tous les SFX à moitié volume).

### c) Audio natif du clip vidéo lui-même (embedded)
Un clip `.mp4` généré par IA peut contenir sa propre bande son (ambiance, souffle, etc.). Ce n'est ni un SFX ni une musique de la bibliothèque : c'est géré par `mediaVolume` (0 à 1) sur la scène, rendu dans `src/video/Scene.tsx` (`volume={scene.mediaVolume ?? 0.7}`) :
```json
{ "mediaPath": "scene_8.mp4", "mediaVolume": 0 }
```
- **Défaut : `0.7`** (audible) si `mediaVolume` est absent — décision prise après avoir remarqué que le son natif des clips n'était pris en compte que si on le demandait explicitement scène par scène (comportement contre-intuitif). Toutes les vidéos entendent maintenant leur son natif par défaut.
- `0` = clip explicitement muet sur cette scène (mettre la clé à `0` pour la faire taire).
- Toute autre valeur (0 à 1) = volume du son natif, en plus de la voix off.

**Pour couper le son natif sur une scène précise sans toucher aux autres** : mettre `"mediaVolume": 0` uniquement sur cette scène.

**Pour tout couper d'un coup (musique + SFX + audio natif)** : retirer `music`/`musicVolume` au niveau racine, retirer tout tableau `sounds` de chaque scène, et mettre `"mediaVolume": 0` sur toutes les scènes vidéo (maintenant nécessaire explicitement partout, puisque `0.7` est le défaut).
