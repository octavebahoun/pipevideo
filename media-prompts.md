# 🎬 Prompts Médias — EXEMPLE : Le vol de la graine de pissenlit

> Format : **9:16** (Short vertical / TikTok / Reels)
> Direction artistique : **calme, contemplative, sensorielle** — macro nature, lumière douce, pas de HUD/overlay technologique. Voir `.agents/skills/content-factory-nature/SKILL.md` pour le template complet (script + prompts).
> Chaque prompt vidéo a 2 blocs : le plan (mouvement décrit précisément) + le son ambiant à embarquer dans le clip généré. Durées cibles à compléter après `npm run tts` (voir `resolution.md` § 6, `npm run check-video`).
> ⚠️ Ceci est un EXEMPLE fourni comme modèle — remplace tout le contenu (titre, narration, prompts) par ton propre sujet dès que tu démarres un vrai projet (`npm run new-video "Ton Sujet"`).

---

### 🎥 Scène 1 — Hook : le vol qui semble aléatoire
- **Fichier cible** : `public/scene_1.mp4`
- **Durée cible** : à compléter après `npm run tts`
- **Type** : 🎬 Vidéo
- **Narration** : *"On pense qu'une graine de pissenlit s'envole au hasard, portée par le vent. En réalité, elle embarque un mécanisme que les physiciens n'ont décrit que récemment."*
- **Prompt** : Macro cinematic shot of a single dandelion seed detaching from its flower head and drifting slowly upward into a soft breeze, golden hour backlight, photorealistic 8k, shallow depth of field, gentle slow-motion, hyper-detailed, sharp focus --ar 9:16
- **Embedded ambient sound in the generated clip** : soft breeze through tall grass, faint distant birdsong, gentle rustle of the flower head as the seed detaches.

---

### 🎥 Scène 2 — Le halo de filaments
- **Fichier cible** : `public/scene_2.mp4`
- **Durée cible** : à compléter après `npm run tts`
- **Type** : 🎬 Vidéo
- **Narration** : *"Mais comment reste-t-elle en l'air aussi longtemps ? Une centaine de filaments forment un halo invisible juste au-dessus de la graine."*
- **Prompt** : Extreme macro cinematic shot of a dandelion seed's pappus (the fine filament halo) floating in still air, soft diffused daylight filtering through the filaments, photorealistic 8k, very shallow depth of field, hyper-detailed, sharp focus --ar 9:16
- **Embedded ambient sound in the generated clip** : near-silence with a faint airy hush, a single soft breath of wind passing through the filaments.

---

### 🎥 Scène 3 — Le vortex invisible
- **Fichier cible** : `public/scene_3.mp4`
- **Durée cible** : à compléter après `npm run tts`
- **Type** : 🎬 Vidéo
- **Narration** : *"Un vortex d'air se forme derrière ce halo, comme une bulle qui maintient la graine en suspension bien plus longtemps qu'un simple flocon."*
- **Prompt** : Cinematic macro shot of a dandelion seed drifting steadily in mid-air against a soft blurred green meadow background, tiny wisps of morning mist subtly swirling just behind the seed's filament halo, photorealistic 8k, gentle slow-motion, hyper-detailed, sharp focus --ar 9:16
- **Embedded ambient sound in the generated clip** : soft ambient meadow hush, a faint low whoosh of air, distant birdsong.

---

### 🖼️ Scène 4 — Pause contemplative : le champ au crépuscule
- **Fichier cible** : `public/scene_4.jpg`
- **Durée cible** : image fixe, aucune contrainte de clip.
- **Type** : 🖼️ Image — plan volontairement statique, sert de respiration avant la conclusion (voir règle vidéo/image du skill : un plan large et immobile est un choix, pas un manque, surtout en clôture).
- **Narration** : *"Ce halo minuscule peut porter la graine sur plus d'un kilomètre. Une graine, un vortex, un vol presque éternel : la nature invente déjà nos meilleures technologies."*
- **Prompt** : Wide cinematic shot of a dandelion meadow at golden dusk, dozens of seed heads softly backlit, faint mist hovering low over the grass, photorealistic 8k, warm atmospheric light, hyper-detailed, sharp focus --ar 9:16
- **Pas de bloc audio embarqué** : image fixe.

---

### 🃏 Scène 5 — Carte de fin (CTA)
- Pas de média/voix/son : texte centré sur fond noir (`card`), voir `storyboard.json`.
- Texte : *"D'autres secrets discrets de la nature arrivent bientôt."* / *"Abonne-toi pour ne pas les manquer."*

---

## 🔊 Note son / musique de fond

Contrairement à d'autres projets de ce pipeline qui tournent volontairement sans musique, ce créneau (nature/calme) bénéficie d'une **musique de fond douce** par défaut (nappe légère, piano discret, field recording) — voir `.agents/skills/content-factory-nature/SKILL.md`. Aucun fichier n'est fourni ici : dépose ton morceau dans `public/sounds/music/` et référence-le dans le champ global `music` du storyboard (`musicVolume` bas, ≈ 0.15–0.25).
