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

## 2. Annuler les sons (SFX / ambiance / musique) sur une vidéo

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
Tableau `sounds` dans une scène (`src/types.ts` → `sceneSoundSchema`). Pour les annuler sur une scène, retirer le champ `sounds` de cette scène (ou le laisser vide/absent). Rendu dans `src/video/Scene.tsx` via le composant `SceneSounds`, uniquement affiché si `scene.sounds` est non vide.

### c) Audio natif du clip vidéo lui-même (embedded)
Un clip `.mp4` généré par IA peut contenir sa propre bande son (ambiance, souffle, etc.). Ce n'est ni un SFX ni une musique de la bibliothèque : c'est géré par `mediaVolume` (0 à 1, défaut `0`) sur la scène :
```json
{ "mediaPath": "scene_8.mp4", "mediaVolume": 0 }
```
- `0` = clip totalement muet (par défaut).
- `> 0` (ex: `0.7`) = le son natif du clip est audible à ce volume, en plus de la voix off.

**Pour couper le son natif sur une scène précise sans toucher aux autres** : mettre `"mediaVolume": 0` uniquement sur cette scène, laisser les autres telles quelles.

**Pour tout couper d'un coup (musique + SFX + audio natif)** : retirer `music`/`musicVolume` au niveau racine, retirer tout tableau `sounds` de chaque scène, et mettre `"mediaVolume": 0` sur toutes les scènes vidéo. Seule la voix off (narration) reste alors audible.
