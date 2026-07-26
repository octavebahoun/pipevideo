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
TTS_PROVIDER=edge         # défaut : gratuit, Edge-TTS (Microsoft), voix par défaut "henri"
TTS_PROVIDER=elevenlabs   # payant, voix les plus naturelles — toujours disponible si besoin
```

**Changement de défaut** : ElevenLabs (payant) était le moteur par défaut à l'origine ; Edge-TTS (gratuit) est désormais le défaut du pipeline, avec `"henri"` comme voix par défaut. ElevenLabs reste entièrement fonctionnel, à activer explicitement via `TTS_PROVIDER=elevenlabs` dans `.env` quand une vidéo a besoin de sa qualité vocale supérieure.

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
Un clip `.mp4` généré par IA peut contenir sa propre bande son (ambiance, souffle, etc.). Ce n'est ni un SFX ni une musique de la bibliothèque : c'est géré par `mediaVolume` (0 à 1) sur la scène, rendu dans `src/video/Scene.tsx` (`volume={scene.mediaVolume ?? 0.6}`) :
```json
{ "mediaPath": "scene_8.mp4", "mediaVolume": 0 }
```
- **Défaut : `0.6`** (audible) si `mediaVolume` est absent — décision prise après avoir remarqué que le son natif des clips n'était pris en compte que si on le demandait explicitement scène par scène (comportement contre-intuitif). Toutes les vidéos entendent maintenant leur son natif par défaut.
- `0` = clip explicitement muet sur cette scène (mettre la clé à `0` pour la faire taire).
- Toute autre valeur (0 à 1) = volume du son natif, en plus de la voix off.

**Pour couper le son natif sur une scène précise sans toucher aux autres** : mettre `"mediaVolume": 0` uniquement sur cette scène.

**Pour tout couper d'un coup (musique + SFX + audio natif)** : retirer `music`/`musicVolume` au niveau racine, retirer tout tableau `sounds` de chaque scène, et mettre `"mediaVolume": 0` sur toutes les scènes vidéo (maintenant nécessaire explicitement partout, puisque `0.6` est le défaut).

## 5. Template "HUD futuriste" — script + prompts visuels (réutilisable)

Style demandé pour toute vidéo qui doit sonner "épique, scientifique et captivant" en habillant des faits naturels réels d'un vocabulaire technologique/militaire. À appliquer quand le sujet s'y prête (pas systématique — voir avec l'utilisateur au cas par cas).

### Structure du script (3 blocs)

1. **Accroche (0-5s)** : casser une idée reçue → *« Vous pensez que [Sujet] est [banal/faible/inutile] ? FAUX ! »*, puis enchaîner immédiatement sur un terme fort (« machine de guerre », « génie de la nature », « survivant ultime »).
2. **Corps (autant de faits que nécessaire)** : vocabulaire technologique/militaire/futuriste plaqué sur des faits biologiques réels (« radar », « bouclier », « scanner optique », « stabilisateur »). Chiffres marquants en analogie concrète (« l'équivalent de... », « une pression de X bars »...). Phrases très courtes et rythmées, adaptées à une voix-off rapide.
   - ⚠️ **Pas de nombre de scènes imposé.** "3 à 4 faits" n'est qu'un point de départ, pas un plafond : si le sujet a plus de faits marquants et précis à offrir, les inclure tous plutôt que d'en compresser plusieurs dans une seule scène (ex: recaser un fait distinct dans la conclusion juste pour tenir un total de 6 scènes). Seule règle : chaque scène ajoutée doit apporter un fait réel et précis — jamais de remplissage ou de redite pour gonfler la durée.
3. **Conclusion (50-60s)** : récapitulatif ultra-rapide des mots-clés/fonctions mentionnées, puis phrase de clôture qui réaffirme la fascination (« Ce n'est pas juste un [Sujet], c'est un chef-d'œuvre d'évolution »).

**Référence** (script Âne, `video/ane-genie-survie`) :
> *"Vous pensez que l'âne est stupide et têtu ? FAUX. C'est une machine de survie ultra-sophistiquée. Ses oreilles ? Un radar acoustique longue portée. [...] Radar longue portée. Scanner à 360°. Calculateur de risques. Unité de combat. [...] Ce n'est pas un âne. C'est un chef-d'œuvre d'évolution."*

### Structure du prompt visuel (HUD)

⚠️ **Erreur vécue (crédits Kling gaspillés)** : une première version de ce template restait abstraite (« glowing futuristic HUD overlay ») — bien trop court pour qu'un modèle génératif (Kling, etc.) produise le niveau de détail voulu (réticule avec pourcentage qui grimpe, horloge digitale incrustée, scan avec labels techniques reliés par des fines lignes, cf. référence @DétenteDécouverte fournie par l'utilisateur). **Un modèle génératif a besoin d'une description PRÉCISE de chaque élément d'UI, pas d'un adjectif vague.** Et le prompt doit aussi décrire le SON à embarquer dans le clip généré — sinon la vidéo sort muette et il faut regénérer (= crédits perdus deux fois).

**Gabarit complet, avec DEUX blocs obligatoires (visuel détaillé + audio embarqué) :**

```
Cinematic [type de plan] of [SUJET, pose/action précise], with a detailed futuristic HUD overlay: [ÉLÉMENT HUD EXACT — type précis (réticule à crochets d'angle / cadran radar rotatif / jauge verticale / scan anatomique en X-ray), animation/comportement (pourcentage qui grimpe de 0 à X%, aiguille qui balaie, jauge qui se remplit), texte/chiffres EXACTS affichés à l'écran, position], thin glowing cyan-white leader lines connecting to small monospace technical data-readout labels, faint scanning grid lines, semi-transparent dark UI panels with tick marks, photorealistic 8k, atmospheric lighting, hyper-detailed, sharp focus --ar 9:16

Embedded audio in the generated clip: [SFX PRÉCIS ET DESCRIPTIF — ex: soft electronic targeting-lock beep rising in pitch as the reticle locks, low synth scanning hum, sharp digital confirmation chime, subtle mechanical whir]
```

- Le sujet réel (animal, objet...) reste photoréaliste ; seule une **surcouche HUD holographique cyan/néon** est ajoutée, mais celle-ci doit être décrite comme un vrai graphiste la spécifierait : type d'élément, comportement d'animation, texte/chiffres qui apparaissent réellement à l'écran (pas juste « des données » — écrire le texte exact, ex: `"RANGE: 60KM ACQUIRED"`, `"RISK: 12%"`, `"30L / 03:00"`).
- **Le son n'est jamais optionnel** : chaque prompt DOIT inclure sa propre description de SFX (bips électroniques, hum de scan, chime de confirmation, impact mécanique...) cohérente avec l'animation HUD décrite juste avant, pour que le clip généré embarque déjà l'audio adapté et n'ait pas besoin d'un second passage.
- `--ar 9:16` gardé tel quel (syntaxe flag façon Midjourney) plutôt que traduit en prose — format attendu par l'outil de génération de l'utilisateur.
- Chaque scène du corps a SON PROPRE élément HUD ET son propre SFX, cohérents avec le fait qu'elle illustre (radar + bip sonar pour l'ouïe, scanner rotatif + chime pour la vision, jauge + bip de remplissage pour une capacité chiffrée, réticule de combat + clunk d'impact pour une charge...).
- **Lien avec §4c** : ce son est embarqué DANS le clip généré (`scene_X.mp4`), pas ajouté après coup via `sounds`/`music`. Comme `mediaVolume` vaut `0.6` par défaut, ces SFX générés seront automatiquement audibles au rendu sans rien configurer de plus dans le storyboard.

### Toujours donner la durée cible, précisément (pas d'approximation)

Une fois `npm run tts` passé, `storyboard.json` contient la durée RÉELLE de chaque scène (`durationInSeconds`, mesurée sur l'audio généré). `media-prompts.md` doit toujours reprendre cette valeur précise (ex: `6,71 s`, pas `"6-7s"` ni `"~7s"`) pour chaque scène, sous forme d'une ligne `Durée cible (audio réel généré)`. Générer un clip de la mauvaise longueur = crédits perdus à régénérer.

**Cas d'une scène qui dépasse la limite d'une génération (5-10s selon l'outil)** : ne jamais se contenter d'un vague "génère 10s et ça s'étirera". Donner une vraie recommandation exploitable :
1. Utiliser la fonction "extend" de l'outil de génération (Kling, etc.) pour compléter jusqu'à la durée exacte.
2. Sinon, calculer et donner le `playbackRate` exact à ajouter sur la scène (`durée du clip généré ÷ durée cible`) pour un ralenti fluide qui remplit exactement la scène sans bouclage visible — sans ce réglage, `Scene.tsx` (`<Loop>`) BOUCLE le clip trop court au lieu de l'étirer, ce qui se voit à l'écran.

### Rigueur scientifique (le style HUD ne dispense pas de vérifier les faits)

Le ton "spec militaire" du template rend les affirmations très faciles à sur-vendre (ex: "capteur magnétique intégré", "système de guidage balistique", "verrouillé plein nord-est" pour un mécanisme dont la science n'a en réalité qu'observé une corrélation statistique, pas prouvé le mécanisme biologique). Erreur constatée sur le script Renard, corrigée après retour utilisateur.

**Règle** : reformuler tout ce qui affirme un mécanisme/organe comme prouvé alors que la source ne montre qu'une observation/hypothèse — sans perdre le côté spectaculaire :
- ❌ "Capteur magnétique intégré" / "Système de guidage balistique" (affirme un organe et un mécanisme prouvés) → ✅ "Une boussole invisible" / "Il **semble** percevoir..." / "Certaines études **suggèrent**..."
- ❌ "Verrouillés plein nord-est" (implique une précision mécanique garantie) → ✅ "Les chercheurs ont observé... quand il vise plein nord-est" (décrit l'observation, pas un mécanisme).
- ❌ Un chiffre/effet non sourcé présenté comme un fait établi (ex: "des appels à la police chaque année") → ✅ Reformuler en constat qualitatif plausible et invérifiable-mais-raisonnable ("son cri est régulièrement pris pour...").

Les phrases de RÉCAPITULATIF en conclusion (qui reprennent des mots-clés déjà posés plus tôt) ont plus de latitude créative que les affirmations initiales — mais rester cohérent avec la formulation déjà adoptée dans le corps (ex: si la scène 2 dit "boussole invisible", la conclusion doit reprendre "boussole invisible", pas repasser à "intégrée").

### Le HUD n'annule pas la règle vidéo/image (§5 du skill content-factory)

Piège vécu : en se concentrant sur le détail du HUD, il est facile d'oublier la règle de fond du skill ("🎬 VIDÉO par défaut, 🖼️ image par exception") et de proposer une vidéo **tout en clips vidéo**, y compris pour des scènes qui n'ont besoin d'aucun mouvement (un récapitulatif, une pause avant le CTA, un plan de transition). Une **image fixe** (infographie HUD, illustration) reste le bon choix par défaut dès qu'une scène doit "laisser respirer" le montage plutôt que montrer une action — la règle s'applique identiquement en HUD, elle ne se limite pas au style documentaire calme.

**Bonus redondance** : une image de récap (« SYSTEM REPORT » avec checklist des faits déjà montrés) est aussi le bon outil pour éviter de répéter 2-3 fois la même action filmée (ex: montrer l'animal vocaliser dans 3 scènes d'affilée) — elle referme le sujet visuellement sans ajouter un 4e plan quasi identique.

## 6. `npm run check-video` — vérification automatique des durées médias

Avant, cette vérification (durée réelle du clip vs durée requise par la scène, calcul du `playbackRate` si besoin) se faisait à la main pour chaque scène — source d'erreurs et de crédits gaspillés (cf. §5). Automatisé dans `src/check-media.ts`.

**Quand le lancer** : après `npm run tts` (durées de narration connues) ET après avoir déposé les fichiers médias dans `public/`. À relancer après tout remplacement de média.

```bash
npm run check-video
```

**Logique par scène vidéo** (les images et les cartes de fin sont ignorées, leur durée n'est pas contrainte par un clip) :
1. Durée requise = `getSceneDurationInFrames` (narration + pause post-narration, voir §1) ÷ FPS.
2. Durée réelle = mesurée sur le fichier dans `public/` via `music-metadata` (déjà utilisé pour l'audio, fonctionne aussi sur les conteneurs vidéo).
3. Écart = réelle − requise.
   - **Écart ≥ 0** : rien à faire (retire un `playbackRate` obsolète si la scène en avait un).
   - **Écart négatif mais ≤ durée de la transition suivante** : probablement invisible (masqué par le fondu vers la scène suivante) → juste signalé, à vérifier visuellement au rendu, aucune modification.
   - **Écart négatif au-delà de ce que la transition peut absorber** : `playbackRate` calculé (`durée réelle ÷ durée requise`) et **injecté automatiquement** dans `storyboard.json`, pour un ralenti qui remplit exactement la scène sans que `<Loop>` (dans `Scene.tsx`) ne fasse boucler le clip de façon visible.

Objectif : que l'agent (ou l'utilisateur) sache immédiatement, avant `npm run render`, quelles scènes ont besoin d'un vrai correctif vs lesquelles sont déjà couvertes par le design des transitions — sans recalculer ça à la main à chaque fois.

## 7. `overlayText` en HAUT de l'image (pas en bas, pour ne pas chevaucher le karaoké)

**Problème constaté** : `overlayText` (texte incrusté / labels HUD façon `"📡 RADAR : 60 KM"`) était positionné en bas (`bottom: '14%'`), trop proche des sous-titres karaoké (`bottom: '10%'`, voir `Subtitles.tsx`) → chevauchement visuel sur les deux textes.

**Résolution** : dans `src/video/Scene.tsx`, le conteneur `overlayText` est passé en haut de l'image (`top: '8%'` au lieu de `bottom: '14%'`), avec une animation d'entrée qui descend légèrement (`translateY` de `-16px` à `0`) plutôt que de monter. Les sous-titres karaoké restent en bas comme avant — les deux textes ne se croisent plus jamais.

S'applique automatiquement à toutes les scènes de toutes les vidéos qui utilisent `overlayText` (aucun changement de storyboard nécessaire).
