# Prompts médias — « La Surcharge Mentale »

Format : **16:9 (1920×1080)** — essai psychologique / anime sombre.
**Priorité VIDÉO** (le mouvement porte la profondeur). Images fixes réservées aux 2 plans statiques de tristesse (S1, S6).

## ⚙️ Règles techniques
- **Clip vidéo IA = ~10 s max.** La pipeline **boucle** automatiquement le clip pour remplir la durée de la scène → viser un clip **~8‑10 s** en **mouvement continu / bouclable** (le point de boucle doit être invisible).
- **Plans « ÉVÉNEMENT » (chute, bris de miroir, recomposition)** : un mouvement à sens unique boucle mal. Pour ces plans, viser le clip le **plus long possible** et, une fois ta **voix finale** enregistrée (durées connues), on **découpe la scène en 2 clips** si besoin plutôt que de boucler.
- **Génération** : `text_to_video` directement, **ou** (recommandé pour la cohérence du perso) générer d'abord une image-clé puis `image_to_video` (façon Luma/Runway de ta bible).
- **Effets à CUIRE dans le clip** (la pipeline ne fait que zoom + fondu) : bandes noires, grain, aberration chromatique, glitch, split-screen, ralenti. Aucun texte.

## 🎭 Cohérence
- **Personnage** : *a young man in his early twenties, short messy dark hair, wearing a dark hoodie*. À répéter dans CHAQUE prompt.
- **Style de base** : `90s psychological anime style, retro anime aesthetic, hand-drawn look, detailed linework, cinematic lighting, dramatic shadows, moody color grading, style of Perfect Blue and Neon Genesis Evangelion, subtle film grain, aspect ratio 16:9`.
- **Phases chromatiques** : Phase 1 bleu nuit/violet (S1‑S3) → Phase 2 rouge néon/orange + glitch (S4‑S8) → Phase 3 crème/blanc/golden hour (S9‑S11).

Fichiers à déposer dans `public/` : `scene_1.png`, `scene_2.mp4`, `scene_3.mp4`, `scene_4.mp4`, `scene_5.mp4`, `scene_6.png`, `scene_7.mp4`, `scene_8.mp4`, `scene_9.mp4`, `scene_10.mp4`, `scene_11.mp4`.

---

## ACTE I — Le Piège de la Perfection  (Phase 1 : bleu nuit / violet)

### Scène 1 — 🖼️ IMAGE (plan fixe) — ~8 s — `scene_1.png`
Narration : « Tu as l'esprit plein d'idées. L'envie de tout créer, de tout changer... Et pourtant, tu ne fais rien. »
Direction : plan fixe, contemplatif, la poussière flotte (statique = tristesse, image assumée).
> 90s psychological anime style, retro anime aesthetic, a young man in his early twenties with short messy dark hair wearing a dark hoodie, seen from behind, sitting motionless at a cluttered desk in a dark bedroom at night, the only light a single glowing computer monitor, dust particles suspended in the air, deep night-blue and profound purple tones, heavy black shadows, quiet melancholic isolating atmosphere, detailed linework, subtle film grain, cinematic still, aspect ratio 16:9

### Scène 2 — 🎬 VIDÉO (ambiant, bouclable) — ~10 s — `scene_2.mp4`  · zoom : in
Narration : « Tu restes figé devant cet écran. C'est l'histoire de la surcharge mentale : ce moment précis où ton cerveau simule tellement de perfection... qu'il finit par te paralyser. »
Mouvement : lent push-in sur l'arrière de la tête ; lignes de code holographiques qui **dérivent et pulsent doucement** dans le vide.
> 90s psychological anime style, slow cinematic push-in on the back of the same young man's head facing a glowing monitor in a dark room, faint holographic lines of code and abstract diagrams slowly drifting, floating and softly pulsing in the dark void around him, deep blue and violet tones, oppressive stillness, subtle continuous motion, seamless loop, detailed linework, film grain, aspect ratio 16:9

### Scène 3 — 🎬 VIDÉO (progressif) — ~10 s — `scene_3.mp4`  · zoom : in
Narration : « Chaque détail doit être parfait. Le premier projet, la première frame, la première ligne. Alors, pour ne pas risquer d'échouer... tu choisis inconsciemment de ne pas commencer. »
Mouvement : la caméra monte lentement ; des **fissures lumineuses s'étendent** dans un plafond/voûte étoilée, formules qui s'écoulent.
> 90s psychological anime style, the same young man from behind slowly tilting his head up toward a vast dark starry ceiling that is slowly cracking apart, glowing luminous mathematical formulas and abstract concepts flowing through the spreading fractures, deep night-blue and purple, overwhelming pressure, slow continuous motion, detailed linework, film grain, cinematic, aspect ratio 16:9

---

## ACTE II — Le Combat Silencieux  (Phase 2 : bascule rouge / orange)

### Scène 4 — 🎬 VIDÉO (ambiant, subtil) — ~10 s — `scene_4.mp4`  · zoom : none
Narration : « C'est un conflit interne épuisant. D'un côté, cette voix ambitieuse : imagine si c'est incroyable. De l'autre, une anxiété sourde : et si tu n'étais pas à la hauteur ? »
Mouvement : split-screen, **animation subtile** (respiration lente, clignement, léger flicker néon).
> 90s psychological anime style, split screen of the same young man's face in two halves, left half determined lit by cold blue neon, right half exhausted and anxious in deep shadow, subtle animation: slow breathing, slow blinking eyes, faint neon flicker, deep blue with encroaching red neon accents, internal conflict, seamless loop, dramatic contrast, film grain, aspect ratio 16:9

### Scène 5 — 🎬 VIDÉO (⚠️ ÉVÉNEMENT + ambiant) — ~10 s — `scene_5.mp4`  · zoom : out
Narration : « Résultat ? Ton cerveau sature. Pour faire taire cette panique invisible, tu te réfugies dans la dopamine facile. Tu scrolles, tu lances un jeu, tu fuis. Tu te consoles en te disant que tu t'y mettras demain. »
Mouvement : **chute/enfoncement au ralenti** sur le lit ; icônes d'apps et notifications qui **tourbillonnent en continu et s'effondrent**.
> 90s psychological anime style, the same young man falling and sinking in slow motion backward onto a bed into a dark void, hundreds of glowing social media app icons and notification bubbles continuously swirling, floating and collapsing around him, saturated red and orange neon glow, overwhelming digital chaos, slow motion, chromatic aberration, film grain, aspect ratio 16:9

### Scène 6 — 🖼️ IMAGE (plan fixe, jump cut) — ~6 s — `scene_6.png`  · zoom : in
Narration : « Mais demain arrive. Et la culpabilité qui l'accompagne est encore plus lourde. »
Direction : gros plan serré et FIXE sur les yeux (statique = tristesse ; jump-cut sec).
> 90s psychological anime style, extreme tight static close-up on the same young man's tired hollow eyes in total darkness, the cold light of a screen reflected in his pupils, heavy guilt and exhaustion, saturated red and orange screen glow, heavy film grain, dramatic, cinematic still, aspect ratio 16:9

---

## ACTE III — La Déconstruction  (Phase 2 pic → bascule Phase 3)

### Scène 7 — 🎬 VIDÉO (ambiant, très bouclable) — ~10 s — `scene_7.mp4`  · zoom : in
Narration : « On nous répète que la solution, c'est plus de discipline. Qu'il faut juste travailler plus dur. Mais comment avancer quand la simple idée de commencer te donne l'impression d'étouffer ? »
Mouvement : **pluie battante continue**, il marche lentement, reflets néon qui **ondulent** sur le sol mouillé.
> 90s psychological anime style, wide cinematic shot, the same young man walking slowly with slumped shoulders through an empty futuristic cyberpunk alley under heavy continuous pouring rain at night, faded glitching neon billboards, saturated red and orange neon reflections rippling on the wet ground, rain falling continuously, lonely oppressive mood, Cyberpunk Edgerunners energy, chromatic aberration, film grain, seamless loop, aspect ratio 16:9

### Scène 8 — 🎬 VIDÉO (⚠️ ÉVÉNEMENT) — ~10 s — `scene_8.mp4`  · zoom : in
Narration : « Le vrai problème, ce n'est pas ton manque de volonté. C'est ton ego. Tu as peur que ton premier jet ne soit pas le chef-d'œuvre imaginé. Tu confonds ton identité avec ton travail. »
Mouvement : le **reflet se brise au ralenti** en dizaines d'éclats de verre lumineux, chacun une version différente de lui.
> 90s psychological anime style, the same young man standing in the rain before a large mirror, his reflection shattering in slow motion into dozens of glowing glass shards, each shard reflecting a slightly different version of himself, dramatic, saturated red and orange neon breaking toward warmer amber, slow motion, chromatic aberration, detailed linework, film grain, cinematic, aspect ratio 16:9

### Scène 9 — 🎬 VIDÉO (⚠️ ÉVÉNEMENT) — ~10 s — `scene_9.mp4`  · zoom : out
Narration : « Pour briser ce mur, il faut accepter quelque chose de douloureux mais de libérateur : accepte de faire des choses médiocres au début. Donne-toi le droit d'échouer proprement. »
Mouvement : les éclats se **recomposent différemment**, imparfaits mais solides ; la lumière **vire lentement vers le chaud**.
> 90s psychological anime style, the broken glowing glass shards slowly reassembling in slow motion into an imperfect but solid new whole, the reflection reforming differently, the lighting gradually shifting from cold red and orange toward warm amber and soft cream, acceptance and quiet relief, softer linework, gentle film grain, cinematic, aspect ratio 16:9

---

## ACTE IV — Le Premier Pas  (Phase 3 : crème / blanc / golden hour)

### Scène 10 — 🎬 VIDÉO (ambiant) — ~10 s — `scene_10.mp4`  · zoom : in
Narration : « Éteins le bruit. Ferme les vingt onglets ouverts dans ta tête. Choisis une seule tâche. Une tâche ridiculement simple. Écris une seule ligne. Crée une seule seconde de vidéo. »
Mouvement : il ouvre la fenêtre, **lumière dorée qui envahit** la pièce, **rideaux et cheveux dans le vent**, écrans qui s'éteignent un à un.
> 90s anime style, the same young man opening a large bedroom window wide, warm golden morning sunlight (golden hour) flooding into the room, curtains and his hair gently blowing in the wind, computer screens switching off one by one, hopeful peaceful atmosphere, soft pastel cream and warm white tones, natural light, gentle continuous motion, seamless loop, film grain, cinematic, aspect ratio 16:9

### Scène 11 — 🎬 VIDÉO (ambiant → blanc) — ~10 s — `scene_11.mp4`  · zoom : in
Narration : « La clarté ne vient pas de la réflexion. Elle vient de l'action. Alors fais-toi confiance, et commence maintenant. Juste un petit pas... Le reste suivra. »
Mouvement : minimal — mains posées sur le clavier, respiration calme, léger sourire, l'image **s'éclaircit doucement vers le blanc pur**.
> 90s anime style, the same young man three-quarter view resting his hands calmly on a keyboard, a faint serene smile, bathed in soft pure natural morning light, cream and pure white tones, calm resolve and a new beginning, minimal clean composition, very gentle motion, the whole frame slowly brightening toward pure white at the end, subtle film grain, cinematic, aspect ratio 16:9

---

## Récap — à déposer dans `public/`
1 image + 9 vidéos + 1 image = `scene_1.png`, `scene_2.mp4` … `scene_5.mp4`, `scene_6.png`, `scene_7.mp4` … `scene_11.mp4`.
Puis `npm run render` → `out/video.mp4`. (Les plans ÉVÉNEMENT S5/S8/S9 seront affinés — découpe en 2 clips — une fois ta voix finale enregistrée.)
