---
name: content-factory
description: >
  MUST USE when the user wants to create, edit, or render a video,
  generate shorts/Tiktok/Reels/YouTube videos, or run the Content Factory pipeline.
triggers:
  - video: génère une vidéo / crée un court-métrage / faire un short / content-factory / create video / generate video / video production / pipeline de montage
---

# Content Factory — Pipeline de Création Vidéo

Ce skill permet à l'IA d'orchestrer la génération automatisée de vidéos de A à Z en local.

## Règle d'or
- **Ne pas coder de logique de montage à la main** : utiliser la pipeline Remotion déjà configurée dans `/home/precieux/pipevideo`.
- **Dossier de travail** : Toutes les commandes doivent être exécutées dans `/home/precieux/pipevideo`.

## Deux genres de contenu supportés
La pipeline gère aussi bien :
- **Short vertical (9:16)** — punchy, sous-titres **karaoké** (défaut), voix Edge-TTS.
- **Essai / documentaire (16:9)** — posé, sous-titres **cinématiques** ou coupés, voix souvent **fournie par l'utilisateur**, **sound design** par scène.

Choisir `ratio`, `subtitleStyle` et le mode voix en fonction du genre visé (voir ci-dessous).

## Workflow d'Orchestration

### 1. Recherche & Écriture du Script
- Faire des recherches (via `agent-reach` ou connaissances) sur le sujet demandé.
- Rédiger le script et le diviser en scènes cohérentes.
- Enregistrer le storyboard au format JSON dans `/home/precieux/pipevideo/storyboard.json`.
- Respecter scrupuleusement la structure définie dans `src/types.ts`.
  - `ratio`: `"16:9"` | `"9:16"`.
  - Effets par scène : `zoom: "in" | "out" | "none"`, `transition: "fade" | "slide" | "none"`.
  - **Un clip vidéo IA = max 10 s** : si une narration dépasse ~10 s, découper l'acte en plusieurs scènes.

### 2. Voix off — deux modes
La voix off est TOUJOURS produite/mesurée par `npm run tts` :
```bash
npm run tts
```
- **Mode A — Edge-TTS (défaut)** : la voix est générée depuis `narration` (voix `voice`, défaut `fr-FR-HenriNeural`). Les timings mot-à-mot (karaoké) sont capturés automatiquement, et `durationInSeconds` est synchronisée.
- **Mode B — Voix FOURNIE par l'utilisateur** : quand l'utilisateur veut sa propre voix (ton intime, narration humaine…).
  - Global : mettre `"useProvidedAudio": true` → `npm run tts` **ne génère rien**, il attend `public/scene_<id>.mp3` pour chaque scène et se contente d'en **mesurer la durée**.
  - Par scène : renseigner `"audioPath": "scene_3.mp3"` (ou `"voix/scene_3.mp3"`) → cette scène utilise ce fichier, les autres restent en Edge-TTS.
  - ⚠️ Une voix fournie **n'a pas de timings karaoké** → les sous-titres retombent sur une répartition régulière. Pour un essai, préférer alors `subtitleStyle: "cinematic"` ou couper les sous-titres.
  - **Toujours lancer `npm run tts`** même en mode fourni : c'est lui qui écrit `durationInSeconds` (indispensable au rendu).

### 3. Sous-titres — savoir quand les désactiver
Réglages globaux du storyboard, surchargeables par scène :
- `"subtitles": true|false` — interrupteur global (défaut `true`).
- `"subtitleStyle": "karaoke" | "cinematic"` — défaut `"karaoke"`.
- Par scène : `"showSubtitles": true|false` — surcharge le global pour cette scène.

Recommandations :
- **Short vertical** → `karaoke` activé partout (rétention).
- **Essai 16:9** → `cinematic` (phrase sobre) OU couper.
- **Couper (`showSubtitles: false`)** sur : plans purement visuels/contemplatifs, moments d'émotion ou de silence, plans où du texte gênerait la composition, et quand la voix est fournie sans timings précis.

### 4. Sound design — bibliothèque de sons
Bibliothèque **réutilisable** dans `public/sounds/` (bruitages, ambiances, musiques), **préservée** d'un projet à l'autre. Voir `public/sounds/README.md`.
- **Choisir un son** : lire `public/sounds/CATALOG.md` (régénéré par `npm run sounds`) — il liste chaque son avec type, ambiance, usage et le `src` à copier.
- **Poser un son sur une scène** : ajouter un tableau `sounds` :
  ```json
  "sounds": [
    { "src": "sounds/music/synth-drone-dark.mp3", "volume": 0.3, "loop": true, "fadeInSeconds": 2 },
    { "src": "sounds/sfx/heartbeat-slow.mp3", "volume": 0.5, "startInSeconds": 1.5, "fadeOutSeconds": 1 }
  ]
  ```
  Champs : `src` (relatif à `public/`), `volume` (0→1, déf. 0.6), `startInSeconds`, `loop`, `fadeInSeconds`, `fadeOutSeconds`. Ces sons se superposent à la voix off.
- **Musique de fond unique** sur toute la vidéo : utiliser plutôt le champ global `"music": "..."`.
- **Ajouter un nouveau son** : déposer l'audio dans `music/`/`sfx/`/`ambient/`, créer une fiche `.md` du même nom (copier `public/sounds/_TEMPLATE.md`), puis `npm run sounds`.
  - ⚠️ L'IA ne génère pas de fichiers audio : demander à l'utilisateur de les fournir/générer.

### 5. Pause Média (Demande à l'utilisateur)
- Présenter la liste des scènes avec la narration et le **prompt visuel suggéré** (image/vidéo).
- Créer `media-prompts.md` à la racine détaillant les prompts par média (durées, découpages si > 10 s, ratio, style).
- Demander de placer les fichiers dans `public/` avec les bons noms (ex: `scene_1.png` / `scene_1.mp4`), et vérifier que `mediaPath` pointe dessus.

### 6. Rendu de la Vidéo Finale
- Une fois les médias (et voix/sons) en place :
  ```bash
  npm run render
  ```
- La vidéo finale : `/home/precieux/pipevideo/out/video.mp4`.

## Scripts npm disponibles
| Commande | Rôle |
| --- | --- |
| `npm run tts` | Génère (Edge-TTS) ou mesure (voix fournie) les voix off + durées + timings karaoké. |
| `npm run sounds` | Régénère `public/sounds/CATALOG.md` depuis les fiches de la bibliothèque. |
| `npm run render` | Compile et rend la vidéo finale dans `out/video.mp4`. |
| `npm run new-video "Sujet"` | Archive le projet courant dans `history/` et initialise un nouveau storyboard. |
| `npm run archive` | Archive le projet courant dans `history/` (⚠️ vide storyboard.json + médias de scène du dossier de travail). |
