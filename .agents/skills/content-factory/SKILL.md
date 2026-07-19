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

## Workflow d'Orchestration

### 1. Recherche & Écriture du Script
- Faire des recherches (via `agent-reach` ou connaissances) sur le sujet demandé.
- Rédiger le script et le diviser en scènes cohérentes.
- Enregistrer le storyboard au format JSON dans `/home/precieux/pipevideo/storyboard.json`.
- Respecter scrupuleusement la structure TypeScript définie dans `src/types.ts`.
  - Exemple d'effets autorisés : `zoom: "in" | "out" | "none"`, `transition: "fade" | "none"`.

### 2. Synthèse Vocale (Edge-TTS)
- Lancer la génération des voix off de chaque scène et la synchronisation automatique des durées dans le fichier JSON :
  ```bash
  npm run tts
  ```

### 3. Pause Média (Demande à l'utilisateur)
- Présenter à l'utilisateur la liste des scènes avec la narration et le **prompt visuel suggéré** (image/vidéo).
- Demander à l'utilisateur de placer les fichiers dans le dossier `/home/precieux/pipevideo/public/` avec les noms correspondants (ex: `scene_1.png` ou `scene_1.mp4`).
- S'assurer que le champ `mediaPath` dans `storyboard.json` pointe bien vers le nom du fichier (ex: `scene_1.png`).

### 4. Rendu de la Vidéo Finale
- Une fois que l'utilisateur confirme la présence des médias, lancer le rendu :
  ```bash
  npm run render
  ```
- La vidéo finale sera disponible dans `/home/precieux/pipevideo/out/video.mp4`.
