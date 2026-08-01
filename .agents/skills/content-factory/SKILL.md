---
name: content-factory
description: >
  MUST USE when the user wants to create, edit, or render a video,
  generate shorts/Tiktok/Reels/YouTube videos, or run the Content Factory pipeline.
triggers:
  - video: génère une vidéo / crée un court-métrage / faire un short / content-factory / create video / generate video / video production / pipeline de montage
---

# Content Factory — Pipeline de Création Vidéo

> [!IMPORTANT]
> **CONSIGNE STRICTEMENT OBLIGATOIRE POUR TOUT AGENT IA** :
> Vous DEVEZ LIRE ET APPLIQUER STRICTEMENT l'ensemble des règles de ce skill (Content Factory) ainsi que des skills Remotion associés (`remotion-best-practices`) avant toute action. Ne pas ignorer ni déroger aux voix ElevenLabs (`george`, `anais`, `liam`, `rachel`), aux formats de sous-titres, et aux procédures de synchronisation TTS (`npm run tts`).

Ce skill permet à l'IA d'orchestrer la génération automatisée de vidéos de A à Z en local.

## Règle d'or
- **Ne pas coder de logique de montage à la main** : utiliser la pipeline Remotion déjà configurée dans `/home/precieux/pipevideo`.
- **Dossier de travail** : Toutes les commandes doivent être exécutées dans `/home/precieux/pipevideo`.

## Deux genres de contenu supportés
La pipeline gère aussi bien :
- **Short vertical (9:16)** — punchy, sous-titres **karaoké** (défaut), voix ElevenLabs.
- **Essai / documentaire (16:9)** — posé, sous-titres **cinématiques** ou coupés, voix souvent **fournie par l'utilisateur**, **sound design** par scène.

Choisir `ratio`, `subtitleStyle` et le mode voix en fonction du genre visé (voir ci-dessous).

## Workflow d'Orchestration

### 1. Recherche & Écriture du Script — ⚠️ CRÉATIVITÉ IMPOSÉE
- Faire des recherches (via `agent-reach` ou connaissances) sur le sujet.
- Diviser en scènes cohérentes ; enregistrer dans `storyboard.json` (structure `src/types.ts`).

**RÈGLES D'ÉCRITURE — NON NÉGOCIABLES.** Un script plat, linéaire ou encyclopédique est un **ÉCHEC** : le réécrire. Chaque script DOIT cocher les 5 points ci-dessous, et l'agent doit **s'auto-auditer AVANT `npm run tts`** :

1. **HOOK (0–3 s)** — accroche immédiate. ❌ Interdit : « un abonné m'a demandé… », une définition, un « aujourd'hui on va voir… ». ✅ Choisir un angle fort : **Choc** (« techniquement, du vomi d'abeille »), **Exploit** (« 4 millions de fleurs pour UN pot »), ou **Mystère** (« le seul aliment qui ne périme jamais »).
   - ❌ **Interdit aussi** : « reste jusqu'au bout », « regarde jusqu'à la fin » et toute variante qui promet une révélation plus tard sans rien livrer tout de suite. Constaté à l'usage (drop-off net juste après cette phrase) : le spectateur qui doit *attendre* pour avoir de la valeur décroche. Livrer de l'info nouvelle en continu, scène après scène, fait tout le travail de rétention — pas besoin de le demander explicitement.
2. **ÉTAPE MANQUANTE (curiosity gap)** — ne pas tout révéler d'un coup. Poser une question ouverte au milieu (« mais comment ce liquide devient une pâte dorée ? ») AVANT d'expliquer.
3. **TERMES VISUELS / MÉTAPHORES** — nommer les choses de façon imagée (« l'estomac social », « la danse de la ventilation »), jamais plat (« un estomac », « elles battent des ailes »).
4. **MICRO-FACTS AU MILIEU** — glisser un fait marquant vers le **milieu** pour relancer l'attention (pas seulement à la fin).
5. **LOOP DE FIN** — clore en renvoyant au hook (« voilà comment… ») + émotion/CTA. Jamais une fin à plat.

> **Auto-check obligatoire** : les 5 cases cochées, sinon réécrire. (Réf. : l'audit du short « miel » est passé de **1/5 → 5/5** grâce à ces règles.)

**Variante « HUD futuriste »** : quand l'utilisateur demande explicitement ce style (vocabulaire technologique/militaire plaqué sur des faits naturels réels, ex: « radar », « scanner », « unité de combat »), suivre le template dédié dans `resolution.md` (§ 5) pour le script ET pour les prompts médias (surcouche HUD holographique cyan/néon). Ne pas l'appliquer par défaut — seulement sur demande.

- Effets par scène : `zoom: in|out|none`, `transition: fade|slide|none|black|wipe|zoomPunch|whipPan|glitchCut|particleDissolve` (voir `docs/TRANSITIONS.md`).
  - `black` = fondu **au noir** (fermeture cinéma), `wipe` = **révélation**, `glitchCut` = coupe glitchée ultra-courte, `particleDissolve` = dissolution en particules. S'en servir pour rythmer et masquer un point de boucle.
- **Audio natif d'un clip vidéo** : `mediaVolume` (0→1) par scène, **défaut 0.6 (audible)**. Si le clip généré contient un son parasite (ambiance, souffle IA), le couper explicitement avec `"mediaVolume": 0` sur la scène. Pour muter tous les SFX/bruitages d'un coup : `"sfxVolume": 0` à la racine du storyboard (voir `resolution.md` §4).
- **Clip vidéo IA ~10 s** : si la scène (voix) est plus longue, la pipeline **étire le clip en ralenti** (`playbackRate`, calculé après les durées) ou le boucle → **préférer le ralenti** (mouvement continu, effet ciné). Une `card` (écran noir + texte, sans audio) sert de carte de fin.

### 2. Voix off — deux modes
La voix off est TOUJOURS produite/mesurée par `npm run tts` :
```bash
npm run tts
```
- **Mode A — ElevenLabs TTS (défaut)** : la voix est générée depuis `narration` via **ElevenLabs Multilingual v2** (`voice`, défaut `"george"` ou `voiceId` spécifique). Les voix disponibles (`george`, `liam`, `antoni`, `anais`, `rachel`) et leur guide d'utilisation sont documentés dans `docs/VOICES.md`.
  - Grâce à `convertWithTimestamps`, les timings mot-à-mot (karaoké) sont capturés automatiquement avec précision, et `durationInSeconds` est réajustée.
- **Mode B — Voix FOURNIE par l'utilisateur** : quand l'utilisateur veut sa propre voix (ton intime, narration humaine…).
  - Global : mettre `"useProvidedAudio": true` → `npm run tts` **ne génère rien**, il attend `public/scene_<id>.mp3` pour chaque scène et se contente d'en **mesurer la durée**.
  - Par scène : renseigner `"audioPath": "scene_3.mp3"` (ou `"voix/scene_3.mp3"`) → cette scène utilise ce fichier, les autres restent en ElevenLabs.
  - ⚠️ Une voix fournie **n'a pas de timings karaoké** → les sous-titres retombent sur une répartition régulière. Pour un essai, préférer alors `subtitleStyle: "cinematic"` ou couper les sous-titres.
  - **Toujours lancer `npm run tts`** même en mode fourni : c'est lui qui écrit `durationInSeconds` (indispensable au rendu).
- **Choix du moteur** : centralisé dans `.env` (`TTS_PROVIDER=elevenlabs` ou `edge`), pas dans le code ni le storyboard. Voir `docs/VOICES.md` et `resolution.md` §2.

### 2bis. ⏱️ Pause d'1 seconde après chaque narration (règle système)
`getSceneDurationInFrames` (`src/types.ts`) ajoute **30 frames (1s) de silence après la fin de la voix off** de chaque scène (sauf `card` de fin, sans voix). C'est ce qui empêche les voix off de se chevaucher pendant les transitions (`TransitionSeries`) : la transition d'entrée de la scène suivante tombe entièrement dans ce silence.

- **Règle d'or** : `POST_NARRATION_PAUSE_FRAMES` doit TOUJOURS rester **strictement supérieur** à la transition la plus longue (`transitionDurationFrames`, 26 frames pour `"black"`). Sinon les voix se recroisent.
- **Ne JAMAIS ajouter un délai supplémentaire avant la voix off** (ex: décaler `<Audio>` dans un `<Sequence>`) en plus de cette pause — ça cumule deux mécanismes et rallonge le silence mort au-delà d'1s (déjà tenté et retiré, commits `2d814f8` → `57bd4f3`).
- La durée de scène reste toujours pilotée par **l'audio réel mesuré** (`durationInSeconds`, écrit par `npm run tts`) : si un `.mp3` est remplacé/régénéré manuellement, il FAUT relancer `npm run tts` pour resynchroniser durées et timings karaoké. Détails : `resolution.md` §1.

### 3. Sous-titres — savoir quand les désactiver
Réglages globaux du storyboard, surchargeables par scène :
- `"subtitles": true|false` — interrupteur global (défaut `true`).
- `"subtitleStyle": "karaoke" | "fondant" | "cinematic"` — défaut `"karaoke"`.
  - `karaoke` : mots MAJUSCULES, pop dur blanc/or, contours épais — shorts punchy (défaut, rester dessus sauf demande contraire).
  - `fondant` : karaoké doux, mots qui s'illuminent en fondu progressif — sujet calme/attachant.
  - `cinematic` : phrase sobre centrée en bas sans surlignage mot-à-mot — essai/documentaire 16:9.
- Par scène : `"showSubtitles": true|false` — surcharge le global pour cette scène.

Recommandations :
- **Short vertical** → `karaoke` activé partout (rétention).
- **Essai 16:9** → `cinematic` (phrase sobre) OU couper.
- **Couper (`showSubtitles: false`)** sur : plans purement visuels/contemplatifs, moments d'émotion ou de silence, plans où du texte gênerait la composition, et quand la voix est fournie sans timings précis.

### 4. Sound design — bibliothèque de sons
Bibliothèque **réutilisable et déjà fournie** dans `public/sounds/` (bruitages, ambiances, musiques), **préservée** d'un projet à l'autre. Voir `public/sounds/README.md`.
- **Choisir un son** : lire `public/sounds/CATALOG.md` (régénéré par `npm run sounds`) — il liste chaque son avec `type`, `mood`, `usage`, `key`/`bpm`, ses `peaks` (secondes des pics d'impact) et le `src` à copier. Filtrer par type/ambiance/usage. Utiliser les `peaks` pour caler un cut/flash/zoom sur un temps fort.
- **⚠️ Traçabilité (archivage)** : à l'archivage, les fichiers audio de la biblio **ne sont pas copiés** dans `history/`. La liste des sons utilisés (musique globale + `sounds` de chaque scène) est écrite en **noms seuls** dans `history/<projet>/sounds-used.md`. Donc : ne jamais renommer/supprimer un son encore référencé, et pour re-rendre une vidéo archivée, ses sons doivent rester présents dans `public/sounds/`.
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

### 5. Pause Média — 🎬 VIDÉO par défaut, 🖼️ image par exception
- **RÈGLE DE FOND (ne pas y déroger sans raison)** : privilégier des **clips vidéo `.mp4`** — c'est le mouvement qui donne la profondeur et un meilleur rendu. Réserver les **images fixes `.png`** aux plans **délibérément statiques** (contemplation, tristesse, gros plan figé, jump-cut). ❌ Ne JAMAIS proposer une vidéo « tout en images » : ça tue la profondeur (surtout pour un essai/récit).
- **Choix vidéo/image par scène** : lire la direction d'animation du plan. Un mouvement est décrit (pluie, vent, chute, particules, glitch, ralenti, caméra qui bouge) ? → **vidéo**. Plan volontairement immobile et lourd de sens ? → **image**.
- **Durée > 10 s** : un clip IA fait ~10 s max ; la pipeline **étire le clip en ralenti** (`playbackRate`) pour remplir la scène, ou le boucle. **Préférer le ralenti** (mouvement continu, effet ciné) — idéal pour chute/bris/révélation « au ralenti ». Le découpage en 2 clips reste possible si le ralenti est trop lent (< 0,5×).
- Créer `media-prompts.md` : par scène → **type (🎬 vidéo / 🖼️ image)**, narration, prompt (mouvement décrit pour les vidéos), durée, ratio, style, et **effets à cuire dans le média** (grain, glitch, aberration, split-screen, bandes noires…) que la pipeline ne fait pas.
- Demander de déposer les fichiers dans `public/` aux bons noms (`.mp4` ou `.png`) et vérifier que `mediaPath` pointe dessus.

### 6. Vérification des durées médias — après `npm run tts` ET dépôt des fichiers
- Une fois les voix générées (`npm run tts`) et les fichiers déposés dans `public/` :
  ```bash
  npm run check-video
  ```
- Compare la durée RÉELLE de chaque clip à la durée REQUISE par sa scène (narration + pause). Trois verdicts possibles par scène :
  - ✅ Clip assez long → rien à faire.
  - 🟡 Clip un peu court, mais l'écart tient dans la transition suivante → probablement invisible, à vérifier au rendu.
  - 🔴 Clip trop court → `playbackRate` calculé et **injecté automatiquement** dans `storyboard.json` pour un ralenti qui remplit exactement la scène sans bouclage visible.
- Relancer après tout remplacement de média (les durées changent).

### 7. Rendu de la Vidéo Finale
- Une fois les médias (et voix/sons) en place, et `npm run check-video` passé sans 🔴 non résolu :
  ```bash
  npm run render
  ```
- La vidéo finale : `/home/precieux/pipevideo/out/video.mp4`.

### 8. Rendu cloud (AWS Lambda) — optionnel, pour décharger la machine
```bash
npm run render:lambda
```
Miroir cloud de `npm run render` : trouve la fonction Lambda déployée, (re)déploie le site (bundle + tout `public/` sur S3), rend avec le `storyboard.json` courant, télécharge dans `out/video.mp4`.
- **Prérequis** : AWS CLI configuré, fonction déployée (`npx remotion lambda functions deploy`), région dans `.env` (`REMOTION_AWS_REGION`), et **toutes les versions `remotion`/`@remotion/*` identiques** (sinon le rendu casse).
- **Temps** : 1er run lent (upload du site) ; suivants rapides car `deploySite` est **incrémental** (ré-uploade seulement les fichiers modifiés). Le rendu Lambda lui-même est rapide quelle que soit la durée (chunks parallèles).

## Scripts npm disponibles
| Commande | Rôle |
| --- | --- |
| `npm run tts` | Génère (ElevenLabs/Edge-TTS selon `.env`) ou mesure (voix fournie) les voix off + durées + timings karaoké. |
| `npm run check-video` | Compare durée réelle des clips vs durée requise par scène ; injecte `playbackRate` si besoin (voir §6). |
| `npm run sounds` | Régénère `public/sounds/CATALOG.md` depuis les fiches de la bibliothèque. |
| `npm run render` | Compile et rend la vidéo finale **en local** dans `out/video.mp4`. |
| `npm run render:lambda` | Rend la vidéo **sur AWS Lambda** (cloud) et la télécharge dans `out/video.mp4`. |
| `npm run new-video "Sujet"` | Archive le projet courant dans `history/` et initialise un nouveau storyboard. |
| `npm run archive` | Archive le projet courant dans `history/` (⚠️ vide storyboard.json + médias de scène du dossier de travail). |
