# 🎬 Prompts Médias — Le Renard : Le Système de Chasse le Plus Sophistiqué de la Nature

> Format : **9:16** (Short vertical / TikTok / Reels)
> Direction artistique : **HUD futuriste / militaire** — même esthétique que le projet Âne (réticules à crochets, cadrans, jauges, réticules de ciblage, labels reliés par des fines lignes cyan), tons cyan néon sur fond photoréaliste, campagne/forêt hivernale puis lisière urbaine au crépuscule.
> Template complet (visuel + audio) : voir `resolution.md` § 5. **Chaque prompt a 2 blocs : le plan + son HUD détaillé, puis le son à embarquer dans le clip généré.** Durées cibles à compléter après `npm run tts` (voir `resolution.md` § 6, `npm run check-video`).

---

### 🎥 Scène 1 — HOOK : système de guidage inconnu
- **Fichier cible** : `public/scene_1.mp4`
- **Type** : 🎬 Vidéo
- **Narration** : *"Vous pensez que le renard chasse au hasard ? FAUX. C'est un prédateur équipé d'un système de guidage que même l'armée n'a pas."*
- **Prompt** : Cinematic shot of a red fox standing alert in a snowy field at dusk, ears perked toward the camera, with a detailed futuristic HUD overlay: a circular target-lock reticle with four corner brackets scanning slowly across its body, a small readout panel reading "GUIDANCE SYSTEM: UNKNOWN" with a blinking question-mark icon, thin glowing cyan-white leader lines connecting to a data label reading "SUBJECT: PREDATOR CLASS", faint scanning grid lines sweeping across the frame, semi-transparent dark UI panel with tick marks along the bottom edge, photorealistic 8k, atmospheric dusk lighting, hyper-detailed, sharp focus --ar 9:16
- **Embedded audio in the generated clip** : soft electronic scanning beep sweeping left to right across the frame, a low rising synth tension underneath, distant winter wind ambience.

---

### 🎥 Scène 2 — Boussole magnétique
- **Fichier cible** : `public/scene_2.mp4`
- **Type** : 🎬 Vidéo
- **Prompt** : Cinematic close-up of a red fox's head in profile, ears twitching, with a detailed futuristic HUD overlay: a rotating compass-dial HUD centered above its head, a glowing needle swinging and settling on "N-E" on a circular bearing scale, a readout beneath reading "MAGNETIC LOCK: ENGAGED", thin glowing cyan-white leader lines from the dial to the fox's eyes, faint scanning grid lines, photorealistic 8k, cold winter daylight, hyper-detailed, sharp focus --ar 9:16
- **Embedded audio in the generated clip** : soft mechanical compass-needle click settling into place, a rising electronic lock-on tone resolving into a confirmation beep, faint winter wind underneath.

---

### 🎥 Scène 3 — Précision de tir
- **Fichier cible** : `public/scene_3.mp4`
- **Type** : 🎬 Vidéo
- **Prompt** : Dynamic cinematic shot of a red fox leaping high in an arc and diving headfirst into deep snow, with a detailed futuristic HUD overlay: a targeting reticle tracking the arc of the leap, a thin glowing trajectory line curving down to the point of impact, a percentage counter climbing rapidly to "SUCCESS RATE: 70%" beside the impact point, faint scanning grid lines, photorealistic 8k, bright winter daylight, hyper-detailed, sharp focus --ar 9:16
- **Embedded audio in the generated clip** : sharp electronic targeting-lock beep as the leap begins, a soft whoosh through the air, a muffled snow-impact thump, ending on a digital confirmation chime as "70%" appears.

---

### 🎥 Scène 4 — Bridge : arme secondaire détectée
- **Fichier cible** : `public/scene_4.mp4`
- **Type** : 🎬 Vidéo
- **Prompt** : Cinematic close-up of a red fox's mouth opening to vocalize at night, with a detailed futuristic HUD overlay: an angular red-orange warning panel flashing "SECONDARY WEAPON DETECTED", faint radiating soundwave rings emanating outward from the mouth, thin glowing cyan-white leader lines, faint scanning grid lines, photorealistic 8k, moody moonlit atmospheric lighting, hyper-detailed, sharp focus --ar 9:16
- **Embedded audio in the generated clip** : a low ominous synth rise, a sharp digital alert blip synced to "DETECTED" flashing on screen, quiet nocturnal ambience underneath.

---

### 🎥 Scène 5 — Signal : anomalie humaine
- **Fichier cible** : `public/scene_5.mp4`
- **Type** : 🎬 Vidéo
- **Prompt** : Cinematic shot of a red fox screaming into the night, silhouetted against the moon on a rooftop or open field, with a detailed futuristic HUD overlay: a waveform-analyzer panel comparing two overlapping soundwave graphs labeled "FOX" and "HUMAN", a readout reading "SIGNAL MATCH: 91%", thin glowing cyan-white leader lines connecting the waveform to the fox, faint scanning grid lines, photorealistic 8k, moody moonlit lighting, hyper-detailed, sharp focus --ar 9:16
- **Embedded audio in the generated clip** : the fox's real eerie vixen-scream cry, layered with a subtle electronic analysis beep and a soft waveform-scan tone underneath.

---

### 🎥 Scène 6 — Répertoire vocal
- **Fichier cible** : `public/scene_6.mp4`
- **Type** : 🎬 Vidéo
- **Prompt** : Cinematic close-up of a red fox with ears rotating independently and mouth mid-vocalization, with a detailed futuristic HUD overlay: a small vertical audio-library panel scrolling through icons beside its head, a counter reading "VOCAL LIBRARY: 40+ SIGNALS" ticking upward, thin glowing cyan-white leader lines, faint scanning grid lines, photorealistic 8k, twilight lighting, hyper-detailed, sharp focus --ar 9:16
- **Embedded audio in the generated clip** : a rapid sequence of soft overlapping electronic blips as the counter scrolls, resolving into a single confirmation chime.

---

### 🎥 Scène 7 — LOOP Final : système de chasse ultime
- **Fichier cible** : `public/scene_7.mp4`
- **Type** : 🎬 Vidéo
- **Prompt** : Cinematic shot of a red fox sitting calmly at the edge of an urban park at dusk, blurred city lights in the background, with a detailed futuristic HUD overlay: four small holographic icons (compass dial, target reticle, waveform analyzer, vocal-library counter) orbiting slowly around its silhouette before converging and stamping into a final glowing seal reading "ULTIMATE HUNTING SYSTEM", thin glowing cyan-white leader lines linking each icon briefly before it converges, faint scanning grid lines fading out, photorealistic 8k, atmospheric dusk city lighting, hyper-detailed, sharp focus --ar 9:16, leave clean space near the bottom third of frame for on-screen CTA text.
- **Embedded audio in the generated clip** : rising warm synth swell as the icons orbit, each icon passing with a soft chime, resolving into a single deep confirmation "stamp" sound when the seal completes.

---

## 🔊 Note son / musique de bibliothèque

Toujours sans musique de fond ni SFX de bibliothèque (`music`/`sounds` du storyboard) sur ce projet — le son est **embarqué directement dans chaque clip généré** (voir blocs "Embedded audio" ci-dessus), pas ajouté après coup dans Remotion. `mediaVolume` par défaut (`0.6`) rendra ce son audible automatiquement au rendu.
