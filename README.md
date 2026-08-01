# Content Factory — Pipevideo

Pipeline automatisé de production vidéo par agent IA. Génère des vidéos complètes (shorts 9:16 ou essais 16:9) à partir d'un storyboard JSON, avec voix off ElevenLabs, sous-titres karaoké/cinematic, transitions, sound design et rendu local ou sur AWS Lambda.

## Architecture

```
storyboard.json          ← script généré/édité par l'agent
src/
  storyboard.ts           Chargement et validation Zod du storyboard
  tts.ts                  Génération voix off ElevenLabs (timestamps mot-à-mot)
  sounds.ts               Catalogue des bruitages/ambiances/musiques
  render.ts               Rendu vidéo local (Chrome + Remotion)
  render-lambda.ts        Rendu cloud distribué (Remotion Lambda)
  new-video.ts            Initialise un nouveau projet vidéo
  archive.ts              Archive le projet courant dans history/
  types.ts                Types, schémas Zod, constantes (FPS, dimensions)
  video/
    Root.tsx              Point d'entrée Remotion (Composition)
    Main.tsx              Orchestrateur TransitionSeries (scènes + transitions)
    Scene.tsx             Composant scène : média, zoom Ken Burns, shake, overlay, sons
    Subtitles.tsx         Sous-titres karaoké (surlignage mot-à-mot) ou cinematic
    transitions.tsx       Transition fondu au noir personnalisée
```

## Workflow

1. **`npm run new-video "sujet"`** — Crée un storyboard vierge et archive l'ancien projet
2. L'agent IA remplit `storyboard.json` (scènes, narration, médias, effets)
3. **`npm run tts`** — Génère les voix off ElevenLabs avec timings mot-à-mot
4. **`npm run sounds`** — Régénère le catalogue public/sounds/CATALOG.md
5. Déposer les médias (images/vidéos) dans `public/`
6. **`npm run render`** — Rendu local
7. **`npm run render:lambda`** — Rendu cloud distribué

## Storyboard

Le fichier `storyboard.json` décrit l'intégralité de la vidéo : titre, ratio (16:9 ou 9:16), voix, musique de fond, et la liste des scènes avec pour chacune :

| Champ | Description |
|-------|-------------|
| `narration` | Texte de la voix off |
| `mediaPath` | Fichier média (image ou vidéo) dans `public/` |
| `effects.zoom` | Ken Burns : `in`, `out`, `none` |
| `effects.transition` | `fade`, `slide`, `wipe`, `black`, `none` |
| `effects.shake` | Tremblement caméra |
| `sounds` | Bruitages/ambiances depuis `public/sounds/` |
| `overlayText` | Texte incrusté (CTA) |
| `card` | Écran de fin (texte centré, pas de voix) |
| `audioPath` | Voix off fournie (contourne ElevenLabs) |

Validation stricte via Zod dans `src/types.ts`.

## Voix ElevenLabs

Voix disponibles : `george` (défaut), `liam`, `antoni`, `anais`, `rachel` — documentation complète dans `docs/VOICES.md`.

## Sous-titres

- **karaoke** : mots en MAJUSCULES surlignés au fil de la voix (shorts verticaux)
- **cinematic** : phrase sobre centrée en bas (documentaires 16:9)

Les timings mot-à-mot sont extraits automatiquement par ElevenLabs. Si la voix est fournie par l'utilisateur (`audioPath`), les mots sont répartis régulièrement.

## Sound Design

La bibliothèque `public/sounds/` contient des bruitages (sfx), ambiances et musiques décrits par des fichiers `.md` avec front-matter (type, mood, bouclable, durée, tonalité, BPM, pics d'impact). Le catalogue est généré par `npm run sounds`.

## Rendu Cloud (Lambda)

`npm run render:lambda` déploie uniquement les assets référencés par le storyboard (staging), coupe les source maps, et rend la vidéo sur AWS Remotion Lambda. Le quota de concurrence Lambda se configure via `RENDER_MAX_LAMBDAS` dans `.env`.

## Scripts npm

| Script | Description |
|--------|-------------|
| `npm run tts` | Génération voix off ElevenLabs |
| `npm run render` | Rendu vidéo local |
| `npm run render:lambda` | Rendu cloud AWS Lambda |
| `npm run sounds` | Génération catalogue sons |
| `npm run new-video "sujet"` | Nouveau projet vidéo |
| `npm run archive` | Archive le projet dans history/ |
| `npm run build` | Compilation TypeScript |
