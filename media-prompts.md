# 🎬 Prompts Médias — Le Renard : Le Système de Chasse le Plus Sophistiqué de la Nature

> Format : **9:16** (Short vertical / TikTok / Reels)
> Direction artistique : **HUD futuriste / militaire**, progression cohérente d'une seule analyse (SCAN → ANALYSIS → TARGET LOCK → WARNING → SIGNAL ANALYSIS → SYSTEM REPORT → MISSION COMPLETE, voir `overlayText` de chaque scène dans `storyboard.json`). Réticules à crochets, cadrans, jauges, labels reliés par des fines lignes cyan, tons cyan néon sur fond photoréaliste. Campagne/forêt hivernale, puis lisière urbaine au crépuscule pour la scène finale.
> Template complet (visuel + audio) : voir `resolution.md` § 5. **Chaque prompt vidéo a 2 blocs : le plan + son HUD détaillé, puis le son à embarquer dans le clip généré.** Durées cibles à compléter après `npm run tts` (voir `resolution.md` § 6, `npm run check-video`).
> ⚠️ **Précision scientifique** : formulations volontairement prudentes (« suggèrent », « chercheurs ont observé », pas de terme affirmant un organe/mécanisme prouvé) — voir `resolution.md` § 5 note sur la rigueur scientifique du template HUD.

---

### 🎥 Scène 1 — HOOK : scan initial
- **Fichier cible** : `public/scene_1.mp4`
- **Durée cible (audio réel généré)** : **6,30 s** — génère un clip de 6-7s
- **Type** : 🎬 Vidéo
- **Narration** : *"Vous pensez que le renard chasse au hasard ? FAUX. Il possède un sens que la science commence à peine à percer."*
- **Prompt** : Cinematic shot of a red fox standing alert in a snowy field at dusk, ears perked toward the camera, with a detailed futuristic HUD overlay: a circular target-lock reticle with four corner brackets scanning slowly across its body, a small readout panel reading "SENSE: UNIDENTIFIED" with a blinking question-mark icon, thin glowing cyan-white leader lines connecting to a data label reading "SUBJECT: PREDATOR CLASS", faint scanning grid lines sweeping across the frame, semi-transparent dark UI panel with tick marks along the bottom edge, photorealistic 8k, atmospheric dusk lighting, hyper-detailed, sharp focus --ar 9:16
- **Embedded audio in the generated clip** : soft electronic scanning beep sweeping left to right across the frame, a low rising synth tension underneath, distant winter wind ambience.

---

### 🎥 Scène 2 — Boussole invisible (hypothèse scientifique)
- **Fichier cible** : `public/scene_2.mp4`
- **Durée cible (audio réel généré)** : **7,34 s** — génère un clip de 7-8s
- **Type** : 🎬 Vidéo
- **Prompt** : Cinematic close-up of a red fox's head in profile, ears twitching, with a detailed futuristic HUD overlay: a rotating compass-dial HUD centered above its head, a glowing needle swinging and gently settling toward "N-E" on a circular bearing scale, a readout beneath reading "MAGNETIC SENSE: SUSPECTED", thin glowing cyan-white leader lines from the dial to the fox's eyes, faint scanning grid lines, photorealistic 8k, cold winter daylight, hyper-detailed, sharp focus --ar 9:16
- **Embedded audio in the generated clip** : soft mechanical compass-needle click settling into place, a gentle electronic hum resolving into a soft confirmation beep, faint winter wind underneath.

---

### 🎥 Scène 3 — Meilleur plan : le bond (preuve visuelle)
- **Fichier cible** : `public/scene_3.mp4`
- **Durée cible (audio réel généré)** : **11,13 s** ⚠️ — dépasse une génération standard (5-10s). Utilise l'extend Kling pour ajouter ~1,1s, ou ajoute `"playbackRate": 0.898` sur la scène si tu génères seulement 10s (10 ÷ 11,13).
- **Type** : 🎬 Vidéo
- **Prompt** : Dynamic cinematic shot of a red fox leaping high in an arc and diving headfirst into deep snow, with a detailed futuristic HUD overlay: a targeting reticle tracking the arc of the leap, a thin glowing trajectory line curving down to the point of impact, a percentage counter climbing rapidly to "SUCCESS RATE: 70% (N-E BEARING)" beside the impact point, faint scanning grid lines, photorealistic 8k, bright winter daylight, hyper-detailed, sharp focus --ar 9:16
- **Embedded audio in the generated clip** : sharp electronic targeting-lock beep as the leap begins, a soft whoosh through the air, a muffled snow-impact thump, ending on a digital confirmation chime as "70%" appears.

---

### 🎥 Scène 4 — Bridge dramatique : avertissement
- **Fichier cible** : `public/scene_4.mp4`
- **Durée cible (audio réel généré)** : **4,26 s** — génère un clip de 5s
- **Type** : 🎬 Vidéo
- **Prompt** : Cinematic wide shot of a red fox standing atop a moonlit ridge at dusk, silhouetted against a darkening sky, slowly turning its head toward camera as the shot dramatically pushes in, with a detailed futuristic HUD overlay: an angular red-orange warning panel flashing "SECONDARY WEAPON DETECTED" across the frame, faint radiating soundwave rings beginning to emanate from its silhouette, thin glowing cyan-white leader lines, faint scanning grid lines pulsing red, photorealistic 8k, dramatic moonlit atmospheric lighting with rim light on the fox's silhouette, hyper-detailed, sharp focus --ar 9:16
- **Embedded audio in the generated clip** : a low ominous synth rise building in intensity, a sharp digital alert blip synced to "DETECTED" flashing on screen, distant wind and quiet nocturnal ambience underneath, ending on a tense held note.

---

### 🎥 Scène 5 — Le cri (cœur du twist)
- **Fichier cible** : `public/scene_5.mp4`
- **Durée cible (audio réel généré)** : **5,56 s** — génère un clip de 6s
- **Type** : 🎬 Vidéo
- **Prompt** : Cinematic shot of a red fox screaming into the night, silhouetted against the moon on a rooftop or open field, with a detailed futuristic HUD overlay: a waveform-analyzer panel comparing two overlapping soundwave graphs labeled "FOX" and "HUMAN", a readout reading "SIGNAL SIMILARITY: HIGH", thin glowing cyan-white leader lines connecting the waveform to the fox, faint scanning grid lines, photorealistic 8k, moody moonlit lighting, hyper-detailed, sharp focus --ar 9:16
- **Embedded audio in the generated clip** : the fox's real eerie vixen-scream cry, layered with a subtle electronic analysis beep and a soft waveform-scan tone underneath.

---

### 🖼️ Scène 6 — Pause : rapport système (image fixe, courte)
- **Fichier cible** : `public/scene_6.jpg`
- **Durée cible (audio réel généré)** : **1,33 s** — image fixe, aucune contrainte de clip.
- **Type** : 🖼️ Image — plan volontairement statique, sert de respiration avant le CTA (voir règle vidéo/image du skill content-factory : une scène qui doit "laisser attendre" est une candidate naturelle à l'image fixe plutôt qu'à un 3e plan de vocalisation redondant avec les scènes 4 et 5).
- **Prompt** : Clean futuristic HUD infographic still: a dark navy interface panel displaying a system diagnostic checklist with three items, each with a glowing cyan checkmark — a compass icon labeled "MAGNETIC SENSE", a target-reticle icon labeled "70% HUNTING SUCCESS (N-E)", a soundwave icon labeled "HUMAN-LIKE SCREAM" — a bold header at the top reading "SYSTEM ANALYSIS COMPLETE", faint scanning grid lines, a blurred silhouette of a red fox faintly visible behind the semi-transparent panel, photorealistic 8k render, hyper-detailed, sharp focus --ar 9:16
- **Pas de bloc audio embarqué** : c'est une image fixe.

---

### 🎥 Scène 7 — LOOP Final : mission accomplie
- **Fichier cible** : `public/scene_7.mp4`
- **Durée cible (audio réel généré)** : **16,74 s** ⚠️ — dépasse largement une génération Kling standard.
- **⚠️ Gestion spéciale (exception de code, propre à cette branche, non mergée sur main)** : la narration reste **unique et continue** (pas splittée, pas régénérée). Le clip Kling ne fait que **10s**, donc `src/video/Scene.tsx` affiche `public/remplacement.jpg` pendant les 6 premières secondes de la scène 7, puis fondu-enchaîne vers `scene_7.mp4` pour le reste, sans jamais couper l'unique piste audio. **Dépose `remplacement.jpg` dans `public/`** (même format 9:16) avant de rendre. La vidéo (10s) est un peu plus courte que la fenêtre qui lui reste (~11,7s) : elle boucle légèrement en fin de scène (`<Loop>`) — si la boucle est visible au rendu, ajouter un `playbackRate` sur la scène pour l'étirer proprement.
- **Type** : 🎬 Vidéo
- **Prompt** : Cinematic shot of a red fox sitting calmly at the edge of an urban park at dusk, blurred city lights in the background, with a detailed futuristic HUD overlay: four small holographic icons (compass dial, target reticle, waveform analyzer, checklist) orbiting slowly around its silhouette before converging and stamping into a final glowing seal reading "MISSION COMPLETE", thin glowing cyan-white leader lines linking each icon briefly before it converges, faint scanning grid lines fading out, photorealistic 8k, atmospheric dusk city lighting, hyper-detailed, sharp focus --ar 9:16, leave clean space near the bottom third of frame for on-screen CTA text.
- **Embedded audio in the generated clip** : rising warm synth swell as the icons orbit, each icon passing with a soft chime, resolving into a single deep confirmation "stamp" sound when the seal completes.

#### 🖼️ `public/remplacement.jpg` — image de patience (0-6s de la scène 7, voir exception de code dans `Scene.tsx`)
- **Rôle** : couvre les ~6 premières secondes de la scène 7 pendant que la narration récite le récap ("Boussole invisible... Bonds... Signal vocal... charognard."), avant le fondu-enchaîné vers la vraie vidéo. Décor urbain crépusculaire identique à la vidéo ci-dessus pour un raccord visuel fluide au fondu.
- **Prompt** : Futuristic HUD data-compilation screen: a dark navy translucent interface panel overlaying a blurred red fox silhouette standing at the edge of an urban park at dusk, soft city lights glowing in the background, three glowing cyan report icons stacked vertically — a compass icon labeled "MAGNETIC SENSE", a target-reticle icon labeled "70% SUCCESS (N-E)", a soundwave icon labeled "HUMAN-LIKE SCREAM" — thin glowing cyan-white leader lines connecting each icon to the fox's silhouette, a horizontal progress bar along the bottom filling toward a label reading "COMPILING FINAL REPORT...", faint scanning grid lines, photorealistic 8k render, atmospheric dusk city lighting, hyper-detailed, sharp focus --ar 9:16
- **Pas de bloc audio embarqué** : image fixe.

---

## 🔊 Note son / musique de bibliothèque

Toujours sans musique de fond ni SFX de bibliothèque (`music`/`sounds` du storyboard) sur ce projet — le son des scènes vidéo est **embarqué directement dans chaque clip généré** (voir blocs "Embedded audio" ci-dessus), pas ajouté après coup dans Remotion. `mediaVolume` par défaut (`0.6`) rendra ce son audible automatiquement au rendu. La scène 6 (image) n'a pas de son embarqué par nature.
