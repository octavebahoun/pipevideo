---
name: content-factory-nature
description: >
  MUST USE when the user wants to create, edit, or render a calm/contemplative
  video about nature, plants, insects, or landscapes (shorts or documentary)
  using this repo's Content Factory pipeline.
triggers:
  - video: vidéo nature / plante / insecte / paysage / documentaire nature / faune / flore / macro nature / contemplatif
---

# Content Factory — Variante Nature & Contemplative

> [!IMPORTANT]
> **CONSIGNE STRICTEMENT OBLIGATOIRE POUR TOUT AGENT IA** :
> Lire et appliquer ce skill ET le skill `remotion-best-practices` avant toute action. Ce document est la variante **nature/contemplative** du pipeline Content Factory : même moteur technique que le skill `content-factory` général, mais orienté vers un ton calme, posé, sensoriel — adapté aux sujets plantes, insectes, paysages. Ne pas appliquer le ton "HUD futuriste / militaire" documenté ailleurs : ce n'est pas le registre de cette chaîne.

Ce skill permet à l'IA d'orchestrer la génération automatisée de vidéos de A à Z en local, à partir du pipeline Remotion déjà configuré dans ce dépôt.

## Règle d'or
- **Ne pas coder de logique de montage à la main** : utiliser la pipeline Remotion déjà en place (`src/`).
- **Dossier de travail** : toutes les commandes (`npm run ...`) s'exécutent à la racine du dépôt cloné (vérifie avec `pwd` si besoin — ne suppose jamais un chemin fixe).

## Deux formats possibles
- **Short vertical (9:16)** — le plus courant pour démarrer une chaîne (TikTok/Reels/Shorts). Rythme plus lent qu'un short "punchy" classique : on assume le calme comme identité, pas comme défaut.
- **Essai / documentaire (16:9)** — pour un format plus long, contemplatif, sous-titres cinématiques ou coupés, voix parfois fournie par l'utilisateur.

## Ton et mood par défaut : calme, posé, sensoriel
C'est ce qui différencie cette variante du template "HUD futuriste" (vocabulaire militaire/technologique, rythme punchy) utilisé sur d'autres projets de ce pipeline :
- **Rythme plus lent** : laisser les plans respirer, ne pas enchaîner les coupes trop vite. Une scène qui montre juste le vent dans les herbes ou la lumière du matin peut durer un peu plus longtemps qu'un short "choc".
- **Sous-titres recommandés : `"fondant"` par défaut** (mots qui s'illuminent en fondu, pas de pop dur) plutôt que `"karaoke"` — voir `resolution.md` §3. `"cinematic"` est un bon choix aussi pour un format 16:9. `"karaoke"` reste disponible si tu veux ponctuellement un short plus punchy.
- **Musique de fond calme recommandée par défaut** — à la différence d'autres projets de ce pipeline qui tournent volontairement sans musique, une nappe douce (piano léger, ambiance nature, field recording) sert le mood contemplatif de ce type de contenu. Mécanique technique : champ global `music` (chemin du fichier) + `musicVolume` à la racine du storyboard (voir `resolution.md` §4a). Recommandation : volume bas (`musicVolume` ≈ 0.15–0.25) pour rester discret sous la voix off, jamais au premier plan.
  - ⚠️ **L'IA ne génère pas de musique** : c'est à toi de trouver/produire un morceau (libre de droits ou tien) et de le déposer dans `public/sounds/music/`, puis de référencer son chemin relatif dans `music`.
- **Ambiances sonores naturelles** (vent, oiseaux, ruisseau, insectes) : deux façons de les intégrer —
  1. **Embarquées directement dans le prompt vidéo** généré par l'outil IA (le plus simple, voir plus bas).
  2. **Ajoutées après coup** via le tableau `sounds` d'une scène, en piochant dans la bibliothèque `public/sounds/` (voir `public/sounds/CATALOG.md`, régénéré par `npm run sounds`).

## Workflow d'orchestration

### 1. Recherche & écriture du script
Les 5 règles d'écriture ci-dessous restent valables même en mode calme — seul le REGISTRE change (jamais "FAUX", jamais de ton choc/militaire). L'agent doit s'auto-auditer avant `npm run tts` :

1. **HOOK (0–3s)** — pas besoin d'un choc ; une observation qui déplace le regard suffit (« On croit qu'une graine de pissenlit s'envole au hasard. » plutôt qu'une affirmation-piège agressive). Éviter : une définition encyclopédique plate, « aujourd'hui on va voir... », et — comme partout ailleurs dans ce pipeline — « reste jusqu'au bout »/« regarde jusqu'à la fin » (le spectateur qui doit attendre pour avoir de la valeur décroche ; livrer de l'info en continu fait le travail de rétention tout seul).
2. **ÉTAPE MANQUANTE (curiosity gap)** — poser une question ouverte avant de révéler le mécanisme (« comment reste-t-elle en l'air si longtemps ? »).
3. **TERMES VISUELS / MÉTAPHORES SENSORIELLES** — préférer l'image évocatrice au terme sec (« un parachute vivant », « un halo invisible ») sans tomber dans le vocabulaire technologique/militaire (pas de « radar », « scanner », « unité de combat » — ce n'est pas le registre ici).
4. **MICRO-FACT AU MILIEU** — un fait précis et vérifiable qui relance l'attention, pas juste une jolie image.
5. **LOOP DE FIN** — refermer sur le hook + une note d'émerveillement calme, jamais une fin plate. CTA doux (« Abonne-toi pour d'autres secrets discrets de la nature »), pas un ordre pressant.

**Exemple de référence (calme, scientifiquement vérifiable)** :
> *"On pense qu'une graine de pissenlit s'envole au hasard, portée par le vent. En réalité, elle embarque un mécanisme que les physiciens n'ont décrit que récemment. Une centaine de filaments forment un halo invisible juste au-dessus de la graine : un vortex d'air se forme derrière elle, comme une bulle qui la maintient en suspension bien plus longtemps qu'un simple flocon. Ce halo minuscule peut la porter sur plus d'un kilomètre. Une graine, un vortex, un vol presque éternel — la nature invente déjà nos meilleures technologies."*

- Rigueur scientifique : comme pour tout autre template de ce pipeline, ne jamais présenter une hypothèse comme un mécanisme prouvé. Préférer « semble », « les chercheurs ont observé », « suggère » dès que la source n'est pas définitive.
- Effets par scène : `zoom: in|out|none`, `transition: fade|slide|none|black|wipe`. En mode calme, préférer `fade`/`wipe` (douceur) à `black` (coupure sèche, à réserver à un vrai effet dramatique).

### 2. Choix vidéo/image par scène — encore plus central en mode calme
- **Règle de fond identique au skill général** : vidéo par défaut (le mouvement donne la profondeur), image réservée aux plans délibérément statiques.
- En nature/paysage, les meilleures candidates à l'**image fixe** : un plan large de paysage figé (lever/coucher de soleil, brume immobile, un sous-bois sans vent), une pause contemplative avant un CTA. Les meilleures candidates à la **vidéo** : un insecte qui se déplace, une fleur qui s'ouvre en accéléré, l'eau qui coule, le vent dans les herbes.
- Ne jamais faire une vidéo « tout en clips vidéo » par réflexe — une scène de respiration en image fixe est un choix, pas un manque.

### 3. Prompts médias — toujours décrire le son embarqué
Même leçon que sur le reste du pipeline (crédits de génération gaspillés si le prompt est vague ou muet) : chaque prompt vidéo doit décrire précisément le plan ET le son ambiant à embarquer.

Gabarit :
```
Macro cinematic shot of [SUJET, action/mouvement précis], soft natural [lumière : golden hour / brume matinale / lumière filtrée par les feuilles], gentle slow-motion, photorealistic 8k, shallow depth of field, hyper-detailed, sharp focus --ar 9:16

Embedded ambient sound in the generated clip: [SON PRÉCIS — ex: soft breeze through tall grass, distant birdsong, gentle rustle of leaves, faint water trickling]
```
- Contrairement au template HUD (SFX électroniques), ici le son embarqué doit être une **ambiance naturelle réaliste**, cohérente avec le plan.
- Toujours donner la durée cible précise après `npm run tts` (ex : `6,71 s`, jamais `"6-7s"`) dans `media-prompts.md`. Si une scène dépasse la limite d'une génération (5-10s selon l'outil) : utiliser l'extend de l'outil, ou calculer le `playbackRate` exact (voir §5 et §6 plus bas) — jamais laisser un clip trop court boucler visiblement.

### 4. Voix off — deux modes (identique au pipeline général)
```bash
npm run tts
```
- **Mode A — TTS (défaut)** : moteur choisi via `.env` (`TTS_PROVIDER=elevenlabs` ou `TTS_PROVIDER=edge`), voix via `storyboard.voice`. Voir `docs/VOICES.md` pour les noms disponibles selon le moteur, et `resolution.md` §2 pour le détail technique du switch.
- **Mode B — voix fournie par toi** (utile pour un ton intime/personnel) : `"useProvidedAudio": true` global, ou `"audioPath": "scene_3.mp3"` par scène. Une voix fournie n'a pas de timings karaoké → préférer `subtitleStyle: "cinematic"` ou couper les sous-titres sur ces scènes.
- Toujours lancer `npm run tts`, même en mode fourni : c'est lui qui mesure `durationInSeconds`, indispensable au rendu.

### 5. Vérification des durées médias
Après `npm run tts` et le dépôt des fichiers dans `public/` :
```bash
npm run check-video
```
Compare la durée réelle de chaque clip à la durée requise (narration + pause) et injecte automatiquement un `playbackRate` si le clip est trop court pour éviter un bouclage visible (`<Loop>`). Voir `resolution.md` §6 pour le détail. Relancer après tout remplacement de média.

### 6. Rendu final
```bash
npm run render          # local, sortie dans out/video.mp4
npm run render:lambda   # cloud AWS Lambda (décharge la machine), voir prérequis dans resolution.md
```

## Scripts npm disponibles
| Commande | Rôle |
| --- | --- |
| `npm run tts` | Génère ou mesure les voix off + durées + timings karaoké. |
| `npm run check-video` | Compare durée réelle des clips vs durée requise ; injecte `playbackRate` si besoin. |
| `npm run sounds` | Régénère `public/sounds/CATALOG.md` (bibliothèque de sons/musiques réutilisable). |
| `npm run render` | Rend la vidéo finale en local dans `out/video.mp4`. |
| `npm run render:lambda` | Rend la vidéo sur AWS Lambda et la télécharge dans `out/video.mp4`. |
| `npm run new-video "Sujet"` | Archive le projet courant dans `history/` et initialise un nouveau storyboard. |
| `npm run archive` | Archive le projet courant dans `history/`. |

## Référence technique approfondie
Pour le détail technique (pourquoi la pause d'1s entre scènes existe, comment fonctionne le switch TTS, la mécanique exacte de `playbackRate`, les pièges déjà rencontrés...), voir `resolution.md` à la racine du dépôt — commun à tout le pipeline, indépendant du style de vidéo choisi.

## Fichiers de démarrage
Un exemple complet (storyboard, prompts médias, script voix-off, métadonnées de publication) sur le sujet "le vol de la graine de pissenlit" est fourni à la racine du dépôt (`storyboard.json`, `media-prompts.md`, `script_voiceover.md`, `metadata.md`), à titre de modèle. Remplace son contenu par ton propre sujet dès que tu démarres un vrai projet — utilise `npm run new-video "Ton Sujet"` pour l'archiver proprement et repartir d'un squelette vierge.
